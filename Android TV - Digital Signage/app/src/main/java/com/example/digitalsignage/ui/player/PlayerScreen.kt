package com.example.digitalsignage.ui.player

import android.content.Context
import android.util.Log
import android.view.ViewGroup
import android.view.LayoutInflater
import android.widget.FrameLayout
import android.widget.Toast
import android.net.Uri
import com.example.digitalsignage.R
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.graphicsLayer
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
    val ip = prefs.getString("smb_ip", "") ?: ""
    val share = prefs.getString("smb_share", "") ?: ""
    val user = prefs.getString("smb_user", "") ?: ""
    val pass = prefs.getString("smb_pass", "") ?: ""

    val playlist = remember { mutableStateListOf<ActivePlaylistItem>() }
    var currentIndex by remember { mutableIntStateOf(0) }
    val currentFile = if (playlist.isNotEmpty() && currentIndex in playlist.indices) playlist[currentIndex] else null

    var isLoading by remember { mutableStateOf(true) }
    var statusMessage by remember { mutableStateOf("Iniciando...") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var playerErrorDetail by remember { mutableStateOf<String?>(null) }

    val exoPlayer = remember {
        val renderersFactory = androidx.media3.exoplayer.DefaultRenderersFactory(context).apply {
            setExtensionRendererMode(androidx.media3.exoplayer.DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)
        }
        ExoPlayer.Builder(context, renderersFactory).build().apply {
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
                    // Loop the video internally while it is the active item
                    exoPlayer.seekTo(0)
                    exoPlayer.play()
                }
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                Log.e("PlayerScreen", "ExoPlayer error: ${error.message}", error)
                val causeMsg = error.cause?.message ?: "Sin causa"
                val deepCauseMsg = error.cause?.cause?.message ?: "Sin detalle"
                playerErrorDetail = "${error.message}\nCausa: $causeMsg\nDetalle: $deepCauseMsg"
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
                                        a.layout != b.layout ||
                                        a.mainFile?.absolutePath != b.mainFile?.absolutePath ||
                                        a.mainFile?.length() != b.mainFile?.length() ||
                                        a.sidebarFile?.absolutePath != b.sidebarFile?.absolutePath ||
                                        a.sidebarFile?.length() != b.sidebarFile?.length() ||
                                        a.tickerText != b.tickerText ||
                                        a.durationSeconds != b.durationSeconds ||
                                        a.isVideo != b.isVideo ||
                                        a.zoomPercent != b.zoomPercent ||
                                        a.sidebarZoomPercent != b.sidebarZoomPercent
                                    }
                            
                            if (listChanged) {
                                Log.d("PlayerScreen", "Playlist updated with ${downloadedList.size} files.")
                                val prevPath = currentFile?.mainFile?.absolutePath
                                playlist.clear()
                                playlist.addAll(downloadedList)
                                
                                val newIndex = if (prevPath != null) {
                                    playlist.indexOfFirst { it.mainFile?.absolutePath == prevPath }.coerceAtLeast(0)
                                } else {
                                    0
                                }
                                currentIndex = newIndex
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

    // Media element transition trigger (both images and videos use this duration delay)
    LaunchedEffect(currentFile, playlist.size) {
        if (currentFile != null && playlist.size > 1) {
            delay(currentFile.durationSeconds * 1000L)
            currentIndex = (currentIndex + 1) % playlist.size
        }
    }

    LaunchedEffect(playerErrorDetail) {
        if (playerErrorDetail != null) {
            delay(8000)
            playerErrorDetail = null
            if (playlist.size > 1) {
                currentIndex = (currentIndex + 1) % playlist.size
            }
        }
    }

    val currentVideoPath = if (currentFile != null && currentFile.isVideo) currentFile.mainFile?.absolutePath else null

    // Handle media player setup when currentVideoPath changes
    LaunchedEffect(currentVideoPath) {
        if (currentVideoPath != null) {
            val file = currentFile?.mainFile
            if (file != null) {
                try {
                    val uri = Uri.fromFile(file)
                    val currentMediaUri = exoPlayer.currentMediaItem?.localConfiguration?.uri
                    if (currentMediaUri == uri) {
                        Log.d("PlayerScreen", "Video URI is already loaded: $uri. Skipping reload.")
                        return@LaunchedEffect
                    }
                    
                    playerErrorDetail = null
                    Log.d("PlayerScreen", "Loading video from URI: $uri")
                    Toast.makeText(context, "Cargando video: ${file.name}", Toast.LENGTH_SHORT).show()
                    
                    exoPlayer.stop()
                    exoPlayer.clearMediaItems()
                    exoPlayer.setMediaItem(MediaItem.fromUri(uri))
                    delay(600) // Delay to let Compose attach surface and view stabilize
                    exoPlayer.prepare()
                    exoPlayer.play()
                } catch (e: Exception) {
                    Log.e("PlayerScreen", "Error setting up video playback", e)
                    Toast.makeText(context, "Error setup video: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        } else {
            if (exoPlayer.currentMediaItem != null) {
                exoPlayer.stop()
                exoPlayer.clearMediaItems()
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
                    DigitalSignageLayout(activeItem = activeItem, exoPlayer = exoPlayer)

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

                    playerErrorDetail?.let { errorText ->
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(Color.Black.copy(alpha = 0.9f))
                                .padding(32.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "Error de Video Detectado",
                                    color = Color(0xFFE50914),
                                    fontSize = 24.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(
                                    text = errorText,
                                    color = Color.White,
                                    fontSize = 18.sp,
                                    lineHeight = 24.sp
                                )
                                Spacer(modifier = Modifier.height(32.dp))
                                Text(
                                    text = "Saltando al siguiente elemento en unos segundos...",
                                    color = Color.Gray,
                                    fontSize = 14.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MainMediaView(
    activeItem: ActivePlaylistItem,
    exoPlayer: ExoPlayer,
    modifier: Modifier = Modifier
) {
    val file = activeItem.mainFile
    val scale = activeItem.zoomPercent / 100f

    if (file != null) {
        if (activeItem.isVideo) {
            AndroidView(
                factory = { ctx ->
                    val view = LayoutInflater.from(ctx).inflate(R.layout.player_view_texture, null) as PlayerView
                    view.apply {
                        player = exoPlayer
                        useController = false
                        resizeMode = androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT
                        layoutParams = FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    }
                },
                update = { view ->
                    view.player = exoPlayer
                    // Read layout to trigger update and force remeasurement when layout transitions occur
                    val layout = activeItem.layout
                    Log.d("PlayerScreen", "AndroidView update: layout=$layout")
                    view.resizeMode = androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT
                    view.requestLayout()
                    for (i in 0 until view.childCount) {
                        view.getChildAt(i).requestLayout()
                    }
                },
                modifier = modifier.fillMaxSize()
            )
        } else {
            Image(
                painter = rememberAsyncImagePainter(file),
                contentDescription = "Signage Image",
                modifier = modifier.fillMaxSize().clipToBounds(),
                contentScale = getCustomScale(ContentScale.Fit, scale)
            )
        }
    } else {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color.DarkGray),
            contentAlignment = Alignment.Center
        ) {
            Text("Sin archivo principal", color = Color.White)
        }
    }
}

@Composable
fun SidebarView(
    activeItem: ActivePlaylistItem,
    modifier: Modifier = Modifier
) {
    val file = activeItem.sidebarFile
    val scale = activeItem.sidebarZoomPercent / 100f

    if (file != null) {
        Image(
            painter = rememberAsyncImagePainter(file),
            contentDescription = "Sidebar Image",
            modifier = modifier.fillMaxSize().clipToBounds(),
            contentScale = getCustomScale(ContentScale.Crop, scale)
        )
    } else {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color(0xFF1E1E24)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "VK JOYAS",
                color = Color.White.copy(alpha = 0.4f),
                fontWeight = FontWeight.Bold,
                fontSize = 24.sp
            )
        }
    }
}

private fun getCustomScale(baseScale: ContentScale, zoomFactor: Float): ContentScale {
    return object : ContentScale {
        override fun computeScaleFactor(
            srcSize: androidx.compose.ui.geometry.Size,
            dstSize: androidx.compose.ui.geometry.Size
        ): androidx.compose.ui.layout.ScaleFactor {
            val base = baseScale.computeScaleFactor(srcSize, dstSize)
            return androidx.compose.ui.layout.ScaleFactor(
                scaleX = base.scaleX * zoomFactor,
                scaleY = base.scaleY * zoomFactor
            )
        }
    }
}

@Composable
fun TickerView(
    text: String,
    modifier: Modifier = Modifier
) {
    if (text.isEmpty()) return

    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .height(55.dp)
            .background(Color(0xFF16161D))
            .border(1.dp, Color.White.copy(alpha = 0.1f))
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        val density = androidx.compose.ui.platform.LocalDensity.current
        val containerWidthPx = with(density) { maxWidth.toPx() }
        var textWidthPx by remember(text) { mutableFloatStateOf(0f) }
        
        val translationX = remember { androidx.compose.animation.core.Animatable(containerWidthPx) }

        LaunchedEffect(text, containerWidthPx, textWidthPx) {
            if (textWidthPx > 0f && containerWidthPx > 0f) {
                while (true) {
                    translationX.snapTo(containerWidthPx)
                    val duration = ((containerWidthPx + textWidthPx) * 8).toLong().coerceAtLeast(3000L)
                    translationX.animateTo(
                        targetValue = -textWidthPx,
                        animationSpec = androidx.compose.animation.core.tween(
                            durationMillis = duration.toInt(),
                            easing = androidx.compose.animation.core.LinearEasing
                        )
                    )
                }
            }
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .clipToBounds()
        ) {
            Text(
                text = text,
                color = Color.White,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                softWrap = false,
                onTextLayout = { textLayoutResult ->
                    textWidthPx = textLayoutResult.size.width.toFloat()
                },
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .wrapContentWidth(align = Alignment.Start, unbounded = true)
                    .graphicsLayer(translationX = translationX.value)
            )
        }
    }
}

@Composable
fun DigitalSignageLayout(
    activeItem: ActivePlaylistItem,
    exoPlayer: ExoPlayer,
    modifier: Modifier = Modifier
) {
    val hasSidebar = activeItem.layout == "split_sidebar" || activeItem.layout == "three_regions"
    val hasTicker = activeItem.layout == "split_ticker" || activeItem.layout == "three_regions"

    Column(modifier = modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            MainMediaView(
                activeItem = activeItem,
                exoPlayer = exoPlayer,
                modifier = Modifier.weight(if (hasSidebar) 0.7f else 1f)
            )
            if (hasSidebar) {
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .weight(0.3f)
                        .border(1.dp, Color.White.copy(alpha = 0.1f))
                ) {
                    SidebarView(activeItem = activeItem)
                }
            }
        }
        if (hasTicker) {
            TickerView(text = activeItem.tickerText)
        }
    }
}
