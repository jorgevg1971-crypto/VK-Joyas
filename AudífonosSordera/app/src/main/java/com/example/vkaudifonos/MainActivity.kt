package com.example.vkaudifonos

import android.Manifest
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.vkaudifonos.audio.AudioEngine
import com.example.vkaudifonos.audio.AudioProcessingService
import com.example.vkaudifonos.theme.VKAudifonosTheme
import com.example.vkaudifonos.ui.main.MainScreen
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private var audioService: AudioProcessingService? = null
    private var isBound = false
    private var serviceJob: Job? = null

    // Compose State variables
    private var isRecordingState by mutableStateOf(false)
    private var audioLevelDbState by mutableStateOf(-100f)
    private var masterGainState by mutableStateOf(1.2f) // Default 120% boost
    private var voiceClarityState by mutableStateOf(0.6f) // Clear speech
    private var noiseReductionState by mutableStateOf(0.4f) // Moderate low-cut
    private var aecEnabledState by mutableStateOf(true)
    private var nsEnabledState by mutableStateOf(true)
    private var isHeadphonesConnectedState by mutableStateOf(false)
    private var permissionsGranted by mutableStateOf(false)

    // Service connection monitor
    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as AudioProcessingService.LocalBinder
            audioService = binder.getService()
            isBound = true

            val engine = audioService!!.getAudioEngine()
            // Sync engine parameters with current UI state
            engine.masterGain = masterGainState
            engine.voiceClarity = voiceClarityState
            engine.noiseReduction = noiseReductionState
            engine.isAecEnabled = aecEnabledState
            engine.isNsEnabled = nsEnabledState
            engine.updateDspParameters()

            // Observe states from the engine
            serviceJob = lifecycleScope.launch {
                launch {
                    engine.isRecording.collectLatest { recording ->
                        isRecordingState = recording
                    }
                }
                launch {
                    engine.audioLevelDb.collectLatest { db ->
                        audioLevelDbState = db
                    }
                }
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            isBound = false
            audioService = null
            isRecordingState = false
            serviceJob?.cancel()
        }
    }

    // Monitor headset connections
    private val headsetReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            updateHeadphonesState()
        }
    }

    // Permission launcher
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val recordAudioGranted = results[Manifest.permission.RECORD_AUDIO] ?: false
        val postNotificationGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            results[Manifest.permission.POST_NOTIFICATIONS] ?: false
        } else {
            true
        }

        if (recordAudioGranted) {
            permissionsGranted = true
        } else {
            Toast.makeText(
                this,
                "Se requiere permiso de micrófono para amplificar el sonido ambiente.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        checkPermissions()
        updateHeadphonesState()

        // Register headset plug receiver
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_HEADSET_PLUG)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                addAction("android.bluetooth.adapter.action.STATE_CHANGED")
                addAction("android.bluetooth.device.action.ACL_CONNECTED")
                addAction("android.bluetooth.device.action.ACL_DISCONNECTED")
            }
        }
        registerReceiver(headsetReceiver, filter)

        // Bind to service if it's already running
        val intent = Intent(this, AudioProcessingService::class.java)
        bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)

        setContent {
            VKAudifonosTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    if (permissionsGranted) {
                        MainScreen(
                            onItemClick = {},
                            isRecording = isRecordingState,
                            audioLevelDb = audioLevelDbState,
                            masterGain = masterGainState,
                            voiceClarity = voiceClarityState,
                            noiseReduction = noiseReductionState,
                            isAecEnabled = aecEnabledState,
                            isNsEnabled = nsEnabledState,
                            isHeadphonesConnected = isHeadphonesConnectedState,
                            onToggleService = { toggleAudioService() },
                            onGainChange = { val1 ->
                                masterGainState = val1
                                audioService?.getAudioEngine()?.let {
                                    it.masterGain = val1
                                    it.updateDspParameters()
                                }
                            },
                            onVoiceClarityChange = { val2 ->
                                voiceClarityState = val2
                                audioService?.getAudioEngine()?.let {
                                    it.voiceClarity = val2
                                    it.updateDspParameters()
                                }
                            },
                            onNoiseReductionChange = { val3 ->
                                noiseReductionState = val3
                                audioService?.getAudioEngine()?.let {
                                    it.noiseReduction = val3
                                    it.updateDspParameters()
                                }
                            },
                            onAecToggle = { aec ->
                                aecEnabledState = aec
                                audioService?.getAudioEngine()?.let {
                                    it.isAecEnabled = aec
                                }
                                // Restart engine to apply system effect changes
                                if (isRecordingState) {
                                    restartAudioEngine()
                                }
                            },
                            onNsToggle = { ns ->
                                nsEnabledState = ns
                                audioService?.getAudioEngine()?.let {
                                    it.isNsEnabled = ns
                                }
                                // Restart engine to apply system effect changes
                                if (isRecordingState) {
                                    restartAudioEngine()
                                }
                            }
                        )
                    } else {
                        PermissionPlaceholderScreen {
                            val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                perms.add(Manifest.permission.POST_NOTIFICATIONS)
                            }
                            requestPermissionLauncher.launch(perms.toTypedArray())
                        }
                    }
                }
            }
        }
    }

    private fun checkPermissions() {
        val micPermission = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
        permissionsGranted = micPermission == PackageManager.PERMISSION_GRANTED
    }

    private fun toggleAudioService() {
        if (!isHeadphonesConnectedState && !isRecordingState) {
            // Warn but let them start if they explicitly want to (or show a Toast)
            Toast.makeText(
                this,
                "Se recomienda conectar auriculares para evitar acoples.",
                Toast.LENGTH_LONG
            ).show()
        }

        val intent = Intent(this, AudioProcessingService::class.java)
        if (isRecordingState) {
            intent.action = AudioProcessingService.ACTION_STOP
            startService(intent)
        } else {
            intent.action = AudioProcessingService.ACTION_START
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        }
    }

    private fun restartAudioEngine() {
        audioService?.getAudioEngine()?.let {
            it.stop()
            it.start()
        }
    }

    private fun updateHeadphonesState() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        var connected = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            for (device in devices) {
                if (device.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                    device.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                    device.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                    device.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                    device.type == AudioDeviceInfo.TYPE_USB_HEADSET
                ) {
                    connected = true
                    break
                }
            }
        } else {
            @Suppress("DEPRECATION")
            connected = audioManager.isWiredHeadsetOn || audioManager.isBluetoothA2dpOn
        }
        isHeadphonesConnectedState = connected

        // Safety feature: stop amplification if headphones are unplugged
        if (!connected && isRecordingState) {
            toggleAudioService()
            Toast.makeText(
                this,
                "Amplificación pausada automáticamente al desconectar auriculares.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    override fun onResume() {
        super.onResume();
        updateHeadphonesState()
    }

    override fun onDestroy() {
        unregisterReceiver(headsetReceiver)
        if (isBound) {
            unbindService(serviceConnection)
            isBound = false
        }
        serviceJob?.cancel()
        super.onDestroy()
    }
}

@Composable
fun PermissionPlaceholderScreen(onRequestPermissions: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF0F0C20), Color(0xFF1E1435))
                )
            )
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "VK AUDÍFONOS",
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            Text(
                text = "Para poder escuchar y mejorar las voces del entorno en tus audífonos, necesitamos acceso al micrófono del teléfono.",
                color = Color.LightGray.copy(alpha = 0.8f),
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
                lineHeight = 22.sp,
                modifier = Modifier.padding(bottom = 32.dp)
            )
            Button(
                onClick = onRequestPermissions,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00F2FE)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                Text(
                    text = "Otorgar Permisos",
                    color = Color(0xFF0F0C20),
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }
        }
    }
}
