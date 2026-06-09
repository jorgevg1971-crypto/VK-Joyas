package com.example.vkaudifonos.audio

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.DynamicsProcessing
import android.media.audiofx.NoiseSuppressor
import android.os.Process
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlin.math.log10
import kotlin.math.sqrt

class AudioEngine {
    companion object {
        private const val TAG = "AudioEngine"
        private const val SAMPLE_RATE = 44100
        private const val CHANNEL_IN = AudioFormat.CHANNEL_IN_MONO
        private const val CHANNEL_OUT = AudioFormat.CHANNEL_OUT_MONO
        private const val ENCODING = AudioFormat.ENCODING_PCM_16BIT
        private const val BUFFER_SIZE_SHORT = 512 // ~11.6ms buffer at 44.1kHz
    }

    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    private var dynamicsProcessing: DynamicsProcessing? = null
    private var echoCanceler: AcousticEchoCanceler? = null
    private var noiseSuppressor: NoiseSuppressor? = null

    private var processingThread: Thread? = null
    @Volatile
    private var isRunning = false

    // State parameters
    var masterGain: Float = 1.0f // Multiplier for PCM samples (0.0 to 3.0)
    var voiceClarity: Float = 0.5f // 0.0 to 1.0 (emphasizes vocal bands 1k-4k)
    var noiseReduction: Float = 0.5f // 0.0 to 1.0 (cuts lower frequencies < 300Hz)
    var isAecEnabled: Boolean = true
    var isNsEnabled: Boolean = true

    // Real-time audio level (RMS and dB) for visualizer
    private val _audioLevelDb = MutableStateFlow(-100f)
    val audioLevelDb: StateFlow<Float> = _audioLevelDb

    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording

    @SuppressLint("MissingPermission")
    fun start() {
        if (isRunning) return

        try {
            val minRecordBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_IN, ENCODING)
            val minTrackBuf = AudioTrack.getMinBufferSize(SAMPLE_RATE, CHANNEL_OUT, ENCODING)

            // Ensure our internal buffers are larger than minimums
            val recordBufSize = minRecordBuf.coerceAtLeast(BUFFER_SIZE_SHORT * 4)
            val trackBufSize = minTrackBuf.coerceAtLeast(BUFFER_SIZE_SHORT * 4)

            // 1. Initialize AudioRecord with VOICE_COMMUNICATION to automatically engage hardware AEC/NS
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                SAMPLE_RATE,
                CHANNEL_IN,
                ENCODING,
                recordBufSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord could not be initialized")
                release()
                return
            }

            // 2. Initialize AudioTrack with PERFORMANCE_MODE_LOW_LATENCY
            audioTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setSampleRate(SAMPLE_RATE)
                        .setChannelMask(CHANNEL_OUT)
                        .setEncoding(ENCODING)
                        .build()
                )
                .setBufferSizeInBytes(trackBufSize)
                .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
                .build()

            if (audioTrack?.state != AudioTrack.STATE_INITIALIZED) {
                Log.e(TAG, "AudioTrack could not be initialized")
                release()
                return
            }

            // 3. Enable System Effects on AudioRecord if requested
            val recordSessionId = audioRecord!!.audioSessionId
            if (isAecEnabled && AcousticEchoCanceler.isAvailable()) {
                echoCanceler = AcousticEchoCanceler.create(recordSessionId)?.apply {
                    enabled = true
                }
            }
            if (isNsEnabled && NoiseSuppressor.isAvailable()) {
                noiseSuppressor = NoiseSuppressor.create(recordSessionId)?.apply {
                    enabled = true
                }
            }

            // 4. Configure DynamicsProcessing on AudioTrack for DSP
            setupDynamicsProcessing(audioTrack!!.audioSessionId)

            // Start hardware streaming
            audioRecord!!.startRecording()
            audioTrack!!.play()

            isRunning = true
            _isRecording.value = true

            // 5. Start audio loop thread
            processingThread = Thread({ audioLoop() }, "VKAudioLoop").apply {
                start()
            }

            Log.d(TAG, "Audio Engine successfully started")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting Audio Engine: ${e.message}", e)
            release()
        }
    }

    fun stop() {
        if (!isRunning) return
        isRunning = false
        _isRecording.value = false

        processingThread?.join(500)
        processingThread = null

        release()
        Log.d(TAG, "Audio Engine stopped")
    }

    private fun release() {
        try {
            audioRecord?.let {
                if (it.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    it.stop()
                }
                it.release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing AudioRecord", e)
        } finally {
            audioRecord = null
        }

        try {
            audioTrack?.let {
                if (it.playState == AudioTrack.PLAYSTATE_PLAYING) {
                    it.stop()
                }
                it.release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing AudioTrack", e)
        } finally {
            audioTrack = null
        }

        echoCanceler?.release()
        echoCanceler = null
        noiseSuppressor?.release()
        noiseSuppressor = null
        dynamicsProcessing?.release()
        dynamicsProcessing = null

        _audioLevelDb.value = -100f
    }

    private fun audioLoop() {
        // Set urgent thread priority for real-time audio loop
        Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)

        val buffer = ShortArray(BUFFER_SIZE_SHORT)

        while (isRunning) {
            val record = audioRecord ?: break
            val track = audioTrack ?: break

            val read = record.read(buffer, 0, buffer.size)
            if (read > 0) {
                // Apply real-time parameter modifications before playing
                // Apply master gain and prevent clipping
                var rmsSum = 0.0
                for (i in 0 until read) {
                    val sample = buffer[i]
                    rmsSum += sample * sample

                    // Apply master digital gain boost
                    val amplified = (sample * masterGain).toInt()
                    buffer[i] = amplified.coerceIn(-32768, 32767).toShort()
                }

                // Update db values for visualizer
                val rms = sqrt(rmsSum / read)
                val db = if (rms > 0.0) (20.0 * log10(rms)).toFloat() else -100f
                // Map DB to UI range (typically -80 to 0)
                _audioLevelDb.value = db

                // Write processed PCM back to the audio track
                track.write(buffer, 0, read)
            }
        }
    }

    private fun setupDynamicsProcessing(audioSessionId: Int) {
        try {
            // PreEQ configuration: 5 bands
            // Band 0: 100 Hz (Low rumble noise)
            // Band 1: 300 Hz (Lower mid speech)
            // Band 2: 1000 Hz (Vowel/core speech)
            // Band 3: 2500 Hz (Consonants / Speech clarity)
            // Band 4: 5000 Hz (High speech / Sibilants)
            val numBands = 5
            val configBuilder = DynamicsProcessing.Config.Builder(
                DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION,
                1,      // Mono channel
                true,   // use PreEQ
                numBands,
                false,  // no multi-band compressor
                0,
                false,  // no PostEQ
                0,
                true    // use Limiter (protect hearing)
            )

            dynamicsProcessing = DynamicsProcessing(0, audioSessionId, configBuilder.build()).apply {
                enabled = true
            }

            // Push initial EQ and limiter settings
            updateDspParameters()
        } catch (e: Exception) {
            Log.e(TAG, "Error setting up DynamicsProcessing", e)
        }
    }

    // Call this method whenever voiceClarity or noiseReduction changes
    fun updateDspParameters() {
        val dp = dynamicsProcessing ?: return
        try {
            // Configure 5 PreEQ bands to highlight voice and reduce noise
            // Band 0: 100 Hz (High noise-reduction cuts this deeply)
            val cut100 = -25f * noiseReduction
            dp.setPreEqBandAllChannelsTo(0, DynamicsProcessing.EqBand(true, 100f, cut100))

            // Band 1: 300 Hz (Moderate cut for noise reduction)
            val cut300 = -12f * noiseReduction + 2f * voiceClarity
            dp.setPreEqBandAllChannelsTo(1, DynamicsProcessing.EqBand(true, 300f, cut300))

            // Band 2: 1000 Hz (Speech core - boost with voice clarity)
            val boost1k = 3f + (10f * voiceClarity)
            dp.setPreEqBandAllChannelsTo(2, DynamicsProcessing.EqBand(true, 1000f, boost1k))

            // Band 3: 2500 Hz (Clarity and articulation - high boost)
            val boost2k = 5f + (15f * voiceClarity)
            dp.setPreEqBandAllChannelsTo(3, DynamicsProcessing.EqBand(true, 2500f, boost2k))

            // Band 4: 5000 Hz (Sibilance and crispness)
            val boost5k = 2f + (8f * voiceClarity)
            dp.setPreEqBandAllChannelsTo(4, DynamicsProcessing.EqBand(true, 5000f, boost5k))

            // Configure safety Limiter
            // Threshold is lower if masterGain is higher to prevent clipping and protect hearing
            val limiterThreshold = -6.0f - (masterGain * 2.0f).coerceAtMost(6f)
            val safetyLimiter = DynamicsProcessing.Limiter(
                true,       // inUse
                true,       // enabled
                0,          // linkGroup
                1.0f,       // attackTime (ms)
                50.0f,      // releaseTime (ms)
                20.0f,      // ratio
                limiterThreshold, // threshold (dB)
                0.0f        // postGain (dB)
            )
            dp.setLimiterAllChannelsTo(safetyLimiter)
        } catch (e: Exception) {
            Log.e(TAG, "Error updating DynamicsProcessing parameters", e)
        }
    }
}
