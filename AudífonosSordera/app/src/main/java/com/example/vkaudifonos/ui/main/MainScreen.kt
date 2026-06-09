package com.example.vkaudifonos.ui.main

import android.media.AudioDeviceInfo
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation3.runtime.NavKey
import com.example.vkaudifonos.audio.AudioEngine
import kotlin.math.max

// Gradient Colors for Premium Aesthetic
val DeepSpace = Color(0xFF0F0C20)
val DarkViolet = Color(0xFF1E1435)
val GlassBg = Color(0x22FFFFFF)
val GlassBorder = Color(0x33FFFFFF)
val NeonCyan = Color(0xFF00F2FE)
val NeonBlue = Color(0xFF4FACFE)
val NeonViolet = Color(0xFF9B51E0)
val SoftPink = Color(0xFFFF5E62)

@Composable
fun MainScreen(
    onItemClick: (NavKey) -> Unit,
    modifier: Modifier = Modifier,
    isRecording: Boolean,
    audioLevelDb: Float,
    masterGain: Float,
    voiceClarity: Float,
    noiseReduction: Float,
    isAecEnabled: Boolean,
    isNsEnabled: Boolean,
    isHeadphonesConnected: Boolean,
    onToggleService: () -> Unit,
    onGainChange: (Float) -> Unit,
    onVoiceClarityChange: (Float) -> Unit,
    onNoiseReductionChange: (Float) -> Unit,
    onAecToggle: (Boolean) -> Unit,
    onNsToggle: (Boolean) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(DeepSpace, DarkViolet, DeepSpace)
                )
            )
            .padding(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Header
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(top = 16.dp)
            ) {
                Text(
                    text = "VK AUDÍFONOS",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp
                )
                Text(
                    text = "Asistente de Voz y Audición",
                    color = Color.LightGray.copy(alpha = 0.7f),
                    fontSize = 14.sp
                )
            }

            // Headset connection warnings / alerts
            if (!isHeadphonesConnected) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = SoftPink.copy(alpha = 0.2f)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp)
                        .border(1.dp, SoftPink.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = "Alerta",
                            tint = SoftPink,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "¡Conecta auriculares! Si usas el altavoz interno se producirá un pitido molesto por retroalimentación.",
                            color = Color.White,
                            fontSize = 12.sp,
                            lineHeight = 16.sp
                        )
                    }
                }
            } else {
                Card(
                    colors = CardDefaults.cardColors(containerColor = NeonCyan.copy(alpha = 0.1f)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp)
                        .border(1.dp, NeonCyan.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = "Auriculares conectados",
                            tint = NeonCyan,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "Auriculares detectados de forma segura. Listo para amplificar.",
                            color = Color.White,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            // Glowing central power button & visualizer waves
            Box(
                modifier = Modifier
                    .size(260.dp)
                    .align(Alignment.CenterHorizontally),
                contentAlignment = Alignment.Center
            ) {
                // Outer pulsing rings based on audio decibels
                // Normalizing audioLevelDb: -100 is silent, 0 is max. Usually voice is in -50 to -10 range.
                val normalizedDb = remember(audioLevelDb) {
                    ((audioLevelDb + 80f) / 80f).coerceIn(0f, 1f)
                }

                val scaleAnimation by animateFloatAsState(
                    targetValue = if (isRecording) 1f + normalizedDb * 0.4f else 1.0f,
                    animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
                    label = "pulse"
                )

                // Outer decorative glass circle
                Box(
                    modifier = Modifier
                        .size(240.dp)
                        .drawBehind {
                            if (isRecording) {
                                drawCircle(
                                    brush = Brush.radialGradient(
                                        colors = listOf(NeonCyan.copy(alpha = 0.3f), Color.Transparent),
                                        radius = size.minDimension / 1.5f
                                    ),
                                    radius = (size.minDimension / 2f) * scaleAnimation
                                )
                            }
                        }
                )

                // Pulsing visualizer circles
                if (isRecording) {
                    val infiniteTransition = rememberInfiniteTransition(label = "rings")
                    val pulseRadius1 by infiniteTransition.animateFloat(
                        initialValue = 100f,
                        targetValue = 250f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(1500, easing = LinearEasing),
                            repeatMode = RepeatMode.Restart
                        ),
                        label = "ring1"
                    )
                    val pulseAlpha1 by infiniteTransition.animateFloat(
                        initialValue = 0.6f,
                        targetValue = 0.0f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(1500, easing = LinearEasing),
                            repeatMode = RepeatMode.Restart
                        ),
                        label = "alpha1"
                    )

                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .drawBehind {
                                drawCircle(
                                    color = NeonBlue.copy(alpha = pulseAlpha1),
                                    radius = pulseRadius1 * (1.0f + normalizedDb * 0.2f),
                                    style = Stroke(width = 2.dp.toPx())
                                )
                            }
                    )
                }

                // Inner Main Button
                val buttonGradient = if (isRecording) {
                    Brush.sweepGradient(colors = listOf(NeonCyan, NeonBlue, NeonViolet, NeonCyan))
                } else {
                    Brush.verticalGradient(colors = listOf(Color.Gray.copy(alpha = 0.3f), Color.DarkGray.copy(alpha = 0.5f)))
                }

                Box(
                    modifier = Modifier
                        .size(160.dp)
                        .shadow(
                            elevation = if (isRecording) 24.dp else 4.dp,
                            shape = CircleShape,
                            ambientColor = NeonCyan,
                            spotColor = NeonBlue
                        )
                        .clip(CircleShape)
                        .background(buttonGradient)
                        .border(
                            width = 2.dp,
                            color = if (isRecording) NeonCyan else GlassBorder,
                            shape = CircleShape
                        )
                        .clickable { onToggleService() },
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = if (isRecording) "Apagar" else "Encender",
                            tint = Color.White,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (isRecording) "ACTIVO" else "ENCENDER",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            letterSpacing = 1.sp
                        )
                    }
                }
            }

            // Glassmorphism Slider Panel
            Card(
                colors = CardDefaults.cardColors(containerColor = GlassBg),
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, GlassBorder, RoundedCornerShape(24.dp))
                    .padding(4.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // 1. Amplification Slider
                    SliderRow(
                        title = "Amplificación",
                        value = masterGain,
                        valueRange = 0.0f..3.0f,
                        icon = Icons.Default.Notifications,
                        color = NeonBlue,
                        onValueChange = onGainChange,
                        valueLabel = "${(masterGain * 100).toInt()}%"
                    )

                    Divider(color = GlassBorder, thickness = 0.5.dp)

                    // 2. Voice Clarity Slider
                    SliderRow(
                        title = "Claridad de Voz",
                        value = voiceClarity,
                        valueRange = 0.0f..1.0f,
                        icon = Icons.Default.Face,
                        color = NeonCyan,
                        onValueChange = onVoiceClarityChange,
                        valueLabel = when {
                            voiceClarity < 0.3f -> "Suave"
                            voiceClarity < 0.7f -> "Nítida"
                            else -> "Máxima"
                        }
                    )

                    Divider(color = GlassBorder, thickness = 0.5.dp)

                    // 3. Noise Reduction Slider
                    SliderRow(
                        title = "Filtro de Ruido",
                        value = noiseReduction,
                        valueRange = 0.0f..1.0f,
                        icon = Icons.Default.KeyboardArrowUp, // represent highpass/cut
                        color = NeonViolet,
                        onValueChange = onNoiseReductionChange,
                        valueLabel = when {
                            noiseReduction < 0.2f -> "Desactivado"
                            noiseReduction < 0.6f -> "Moderado"
                            else -> "Fuerte"
                        }
                    )
                }
            }

            // Bottom Section: System Settings / Toggles
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                // Eco Cancel toggle
                SystemToggle(
                    title = "Cancelación Eco",
                    checked = isAecEnabled,
                    onCheckedChange = onAecToggle
                )

                // Noise Suppress toggle
                SystemToggle(
                    title = "Supresión Ruido",
                    checked = isNsEnabled,
                    onCheckedChange = onNsToggle
                )
            }
        }
    }
}

@Composable
fun SliderRow(
    title: String,
    value: Float,
    valueRange: ClosedFloatingPointRange<Float>,
    icon: ImageVector,
    color: Color,
    onValueChange: (Float) -> Unit,
    valueLabel: String
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(text = title, color = Color.White, fontWeight = FontWeight.Medium, fontSize = 14.sp)
            }
            Text(text = valueLabel, color = color, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        }
        Spacer(modifier = Modifier.height(4.dp))
        Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = valueRange,
            colors = SliderDefaults.colors(
                thumbColor = color,
                activeTrackColor = color,
                inactiveTrackColor = Color.White.copy(alpha = 0.2f)
            ),
            modifier = Modifier.height(24.dp)
        )
    }
}

@Composable
fun SystemToggle(
    title: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(GlassBg)
            .border(0.5.dp, GlassBorder, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clickable { onCheckedChange(!checked) }
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = CheckboxDefaults.colors(
                checkedColor = NeonCyan,
                uncheckedColor = Color.LightGray.copy(alpha = 0.6f)
            ),
            modifier = Modifier.scale(0.85f)
        )
        Text(
            text = title,
            color = Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium
        )
    }
}
