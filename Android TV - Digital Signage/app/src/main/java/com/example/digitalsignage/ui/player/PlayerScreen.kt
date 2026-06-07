package com.example.digitalsignage.ui.player

import android.content.Context
import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.*
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.rememberAsyncImagePainter
import com.example.digitalsignage.ActivePlaylistItem
import com.example.digitalsignage.SMBHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File

@Composable
fun PlayerScreen(onResetConfig: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    val prefs = remember { context.getSharedPreferences("digitalsignage_prefs", Context.MODE_PRIVATE) }
    val ip = remember { prefs.getString("smb_ip", "") ?: "" }
    val share = remember { prefs.getString("smb_share", "") ?: "" }
    val user = remember { prefs.getString("smb_user", "") ?: "" }
    val pass = remember { prefs.getString("smb_pass", "") ?: "" }

    val playlist = remember { mutableStateListOf<ActivePlaylistItem>() }
    var currentIndex by remember { mutableIntStateOf(0) }
    val currentFile = if (playlist.isNotEmpty() && currentIndex in playlist.indices) playlist[currentIndex] else null

    var isLoading by remember { mutableStateOf(true) }
    var statusMessage by remember { mutableStateOf("Iniciando...") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            repeatMode = Player.REPEAT_MODE_OFF
            playWhenReady = true
        }
    }

    DisposableEffect(exoPlayer) {
        onDispose {
            exoPlayer.release()
        }
    }

    // Listener to automatically go to the next item when a video ends
    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    if (playlist.size > 1) {
                        currentIndex = (currentIndex + 1) % playlist.size
                    } else if (playlist.size == 1) {
                        // Loop the single video
                        exoPlayer.seekTo(0)
                        exoPlayer.play()
                    }
                }
            }
        }
        exoPlayer.addListener(listener)
        onDispose {
            exoPlayer.removeListener(listener)
        }
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> exoPlayer.pause()
                Lifecycle.Event.ON_RESUME -> {
                    if (currentFile != null && currentFile.isVideo) {
                        exoPlayer.play()
                    }
                }
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    // Background sync loop to verify files from SMB share
    LaunchedEffect(ip, share) {
        val cacheDir = File(context.cacheDir, "media_cache")
        if (!cacheDir.exists()) {
            cacheDir.mkdirs()
        }

        while (true) {
            errorMessage = null
            withContext(Dispatchers.IO) {
                try {
                    val downloadedList = SMBHelper.syncAndGetMediaFiles(ip, share, user, pass, cacheDir) { status ->
                        statusMessage = status
                    }
                    withContext(Dispatchers.Main) {
                        if (downloadedList.isNotEmpty()) {
                            val listChanged = playlist.size != downloadedList.size ||
                                    playlist.zip(downloadedList).any { (a, b) ->
                                        a.file.absolutePath != b.file.absolutePath || 
                                        a.file.length() != b.file.length() ||
                                        a.durationSeconds != b.durationSeconds ||
                                        a.isVideo != b.isVideo
                                    }
                            
                            if (listChanged) {
                                Log.d("PlayerScreen", "Playlist updated with ${downloadedList.size} files.")
                                playlist.clear()
                                playlist.addAll(downloadedList)
                                currentIndex = 0
                            }
                        } else {
                            if (playlist.isEmpty()) {
                                errorMessage = "No se encontraron archivos en la carpeta de red."
                            }
                        }
                        isLoading = false
                    }
                } catch (e: Exception) {
                    Log.e("PlayerScreen", "Error updating playlist from network share", e)
                    withContext(Dispatchers.Main) {
                        if (playlist.isEmpty()) {
                            errorMessage = e.message ?: "Error de red desconocido."
                        }
                        isLoading = false
                    }
                }
            }
            delay(60000)
        }
    }

    // Media element transition trigger (videos use Player.Listener, images use this delay)
    LaunchedEffect(currentFile, playlist.size) {
        if (currentFile != null && !currentFile.isVideo && playlist.size > 1) {
            delay(currentFile.durationSeconds * 1000L)
            currentIndex = (currentIndex + 1) % playlist.size
        }
    }

    // Handle media player setup when currentFile changes
    LaunchedEffect(currentFile) {
        if (currentFile != null) {
            if (currentFile.isVideo) {
                exoPlayer.setMediaItem(MediaItem.fromUri(currentFile.file.absolutePath))
                exoPlayer.prepare()
                exoPlayer.play()
            } else {
                exoPlayer.stop()
            }
        }
    }

    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    BackHandler {
        onResetConfig()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .focusRequester(focusRequester)
            .focusable()
            .onKeyEvent { keyEvent ->
                if (keyEvent.type == KeyEventType.KeyUp) {
                    when (keyEvent.key) {
                        Key.Back, Key.DirectionCenter, Key.Enter, Key.Escape -> {
                            Toast.makeText(context, "Regresando a configuración", Toast.LENGTH_SHORT).show()
                            onResetConfig()
                            true
                        }
                        else -> false
                    }
                } else {
                    false
                }
            },
        contentAlignment = Alignment.Center
    ) {
        if (isLoading) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp)
            ) {
                CircularProgressIndicator(color = Color(0xFFE50914))
                Spacer(modifier = Modifier.height(20.dp))
                Text(statusMessage, color = Color.White, fontSize = 20.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Origen: \\\\$ip\\$share", color = Color.Gray, fontSize = 14.sp)
            }
        } else if (errorMessage != null && playlist.isEmpty()) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp)
            ) {
                Text("Error de Conexión", color = Color(0xFFE50914), fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(16.dp))
                Text(errorMessage!!, color = Color.LightGray, fontSize = 18.sp)
                Spacer(modifier = Modifier.height(32.dp))
                Text("Presione el botón BACK o CENTER para cambiar de origen.", color = Color.Gray, fontSize = 14.sp)
            }
        } else {
            currentFile?.let { activeItem ->
                Box(modifier = Modifier.fillMaxSize()) {
                    if (activeItem.isVideo) {
                        AndroidView(
                            factory = { ctx ->
                                PlayerView(ctx).apply {
                                    player = exoPlayer
                                    useController = false
                                    layoutParams = FrameLayout.LayoutParams(
                                        ViewGroup.LayoutParams.MATCH_PARENT,
                                        ViewGroup.LayoutParams.MATCH_PARENT
                                    )
                                }
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Image(
                            painter = rememberAsyncImagePainter(activeItem.file),
                            contentDescription = "Signage Image",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    }

                    if (playlist.size > 1) {
                        Text(
                            text = "${currentIndex + 1}/${playlist.size}",
                            color = Color.White.copy(alpha = 0.6f),
                            fontSize = 14.sp,
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .padding(16.dp)
                                .background(Color.Black.copy(alpha = 0.4f), shape = androidx.compose.foundation.shape.CircleShape)
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                }
            }
        }
    }
}
