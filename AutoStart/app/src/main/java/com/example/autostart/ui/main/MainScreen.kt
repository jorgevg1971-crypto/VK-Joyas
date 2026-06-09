package com.example.autostart.ui.main

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation3.runtime.NavKey
import com.example.autostart.data.DefaultDataRepository

@Composable
fun MainScreen(
  onItemClick: (NavKey) -> Unit,
  modifier: Modifier = Modifier,
  viewModel: MainScreenViewModel? = null,
) {
  val context = LocalContext.current
  val lifecycleOwner = LocalLifecycleOwner.current
  
  val resolvedViewModel: MainScreenViewModel = viewModel ?: viewModel {
    val application = context.applicationContext as android.app.Application
    MainScreenViewModel(application, DefaultDataRepository())
  }
  
  val state by resolvedViewModel.uiState.collectAsStateWithLifecycle()

  // Refresh permission when activity resumes (e.g. returning from settings)
  DisposableEffect(lifecycleOwner) {
    val observer = LifecycleEventObserver { _, event ->
      if (event == Lifecycle.Event.ON_RESUME) {
        resolvedViewModel.refreshPermissionState()
      }
    }
    lifecycleOwner.lifecycle.addObserver(observer)
    onDispose {
      lifecycleOwner.lifecycle.removeObserver(observer)
    }
  }

  Box(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    if (state.isLoading) {
      Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
      }
    } else {
      Column(
        modifier = Modifier
          .fillMaxSize()
          .padding(horizontal = 24.dp)
      ) {
        // Title block
        Text(
          text = "AutoStart para Android TV",
          style = MaterialTheme.typography.headlineLarge.copy(
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground
          ),
          modifier = Modifier.padding(vertical = 16.dp)
        )

        // Configuration Section
        ConfigurationCard(
          isAutostartEnabled = state.isAutostartEnabled,
          onToggleAutostart = { resolvedViewModel.toggleAutostart(it) },
          hasOverlayPermission = state.hasOverlayPermission,
          onRequestPermission = {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
              val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}")
              )
              context.startActivity(intent)
            }
          }
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
          text = "Selecciona la aplicación a iniciar:",
          style = MaterialTheme.typography.titleMedium.copy(
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onBackground
          ),
          modifier = Modifier.padding(bottom = 8.dp)
        )

        // App List
        LazyColumn(
          modifier = Modifier.weight(1f),
          verticalArrangement = Arrangement.spacedBy(8.dp),
          contentPadding = PaddingValues(bottom = 24.dp)
        ) {
          // Add a "None" option to disable target package
          item {
            AppListItem(
              name = "Ninguna (Desactivado)",
              packageName = "",
              isSelected = state.selectedPackage.isNullOrEmpty(),
              isTvApp = true,
              onClick = { resolvedViewModel.selectPackage(null) }
            )
          }

          items(state.apps) { app ->
            AppListItem(
              name = app.name,
              packageName = app.packageName,
              isSelected = state.selectedPackage == app.packageName,
              isTvApp = app.isTvApp,
              onClick = { resolvedViewModel.selectPackage(app.packageName) }
            )
          }
        }
      }
    }
  }
}

@Composable
fun ConfigurationCard(
  isAutostartEnabled: Boolean,
  onToggleAutostart: (Boolean) -> Unit,
  hasOverlayPermission: Boolean,
  onRequestPermission: () -> Unit
) {
  val rowInteractionSource = remember { MutableInteractionSource() }
  val isRowFocused by rowInteractionSource.collectIsFocusedAsState()

  val cardBgColor by animateColorAsState(
    targetValue = if (isRowFocused) {
      MaterialTheme.colorScheme.primaryContainer
    } else {
      MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    },
    label = "cardBgColor"
  )

  val cardBorderColor by animateColorAsState(
    targetValue = if (isRowFocused) {
      MaterialTheme.colorScheme.primary
    } else {
      Color.Transparent
    },
    label = "cardBorderColor"
  )

  val textColor = if (isRowFocused) {
    MaterialTheme.colorScheme.onPrimaryContainer
  } else {
    MaterialTheme.colorScheme.onSurfaceVariant
  }

  Card(
    modifier = Modifier
      .fillMaxWidth()
      .border(
        BorderStroke(
          width = if (isRowFocused) 2.5.dp else 0.dp,
          color = cardBorderColor
        ),
        shape = RoundedCornerShape(12.dp)
      ),
    colors = CardDefaults.cardColors(containerColor = cardBgColor)
  ) {
    Column(modifier = Modifier.padding(16.dp)) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
          .fillMaxWidth()
          .clickable(
            interactionSource = rowInteractionSource,
            indication = null
          ) {
            onToggleAutostart(!isAutostartEnabled)
          }
          .padding(8.dp)
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = "Auto-iniciar al encender",
            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
            color = textColor
          )
          Text(
            text = "Ejecutar automáticamente la aplicación seleccionada cuando la TV arranca",
            style = MaterialTheme.typography.bodyMedium,
            color = textColor.copy(alpha = 0.8f)
          )
        }
        
        Switch(
          checked = isAutostartEnabled,
          onCheckedChange = onToggleAutostart,
          modifier = Modifier.padding(start = 16.dp),
          interactionSource = rowInteractionSource
        )
      }

      if (!hasOverlayPermission) {
        Spacer(modifier = Modifier.height(12.dp))
        
        val buttonInteractionSource = remember { MutableInteractionSource() }
        val isBtnFocused by buttonInteractionSource.collectIsFocusedAsState()
        
        Surface(
          color = MaterialTheme.colorScheme.errorContainer,
          shape = RoundedCornerShape(8.dp),
          modifier = Modifier
            .fillMaxWidth()
            .border(
              BorderStroke(
                width = if (isBtnFocused) 2.5.dp else 0.dp,
                color = MaterialTheme.colorScheme.error
              ),
              shape = RoundedCornerShape(8.dp)
            )
        ) {
          Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              text = "⚠",
              fontSize = 24.sp,
              color = MaterialTheme.colorScheme.onErrorContainer,
              modifier = Modifier.padding(end = 12.dp)
            )
            
            Column(modifier = Modifier.weight(1f)) {
              Text(
                text = "Permiso Requerido",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onErrorContainer
              )
              Text(
                text = "Para iniciar aplicaciones en segundo plano en Android 10+, se necesita el permiso de 'Mostrar sobre otras aplicaciones'.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onErrorContainer
              )
            }
            
            Button(
              onClick = onRequestPermission,
              interactionSource = buttonInteractionSource,
              colors = ButtonDefaults.buttonColors(
                containerColor = if (isBtnFocused) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.error
              ),
              modifier = Modifier.padding(start = 8.dp)
            ) {
              Text(
                text = "Conceder",
                color = if (isBtnFocused) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.onError
              )
            }
          }
        }
      }
    }
  }
}

@Composable
fun AppListItem(
  name: String,
  packageName: String,
  isSelected: Boolean,
  isTvApp: Boolean,
  onClick: () -> Unit
) {
  val interactionSource = remember { MutableInteractionSource() }
  val isFocused by interactionSource.collectIsFocusedAsState()

  // Animate changes for smooth visual transitions on TV
  val scale by animateFloatAsState(
    targetValue = if (isFocused) 1.03f else 1.0f,
    label = "scale"
  )

  val containerColor by animateColorAsState(
    targetValue = if (isFocused) {
      MaterialTheme.colorScheme.primary
    } else if (isSelected) {
      MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
    } else {
      MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f)
    },
    label = "containerColor"
  )

  val contentColor = if (isFocused) {
    MaterialTheme.colorScheme.onPrimary
  } else {
    MaterialTheme.colorScheme.onSurface
  }

  val borderStroke = if (isFocused) {
    BorderStroke(2.5.dp, MaterialTheme.colorScheme.primaryContainer)
  } else {
    BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
  }

  Surface(
    onClick = onClick,
    interactionSource = interactionSource,
    shape = RoundedCornerShape(8.dp),
    color = containerColor,
    border = borderStroke,
    modifier = Modifier
      .fillMaxWidth()
      .height(68.dp)
      .scale(scale)
  ) {
    Row(
      modifier = Modifier
        .fillMaxSize()
        .padding(horizontal = 16.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.SpaceBetween
    ) {
      Column(modifier = Modifier.weight(1f)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Text(
            text = name,
            style = MaterialTheme.typography.bodyLarge.copy(
              fontWeight = if (isFocused || isSelected) FontWeight.Bold else FontWeight.Medium,
              fontSize = 18.sp
            ),
            color = contentColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
          
          if (!isTvApp) {
            Spacer(modifier = Modifier.width(8.dp))
            Surface(
              color = if (isFocused) MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.2f) else MaterialTheme.colorScheme.tertiaryContainer,
              shape = RoundedCornerShape(4.dp)
            ) {
              Text(
                text = "Móvil",
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                color = if (isFocused) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onTertiaryContainer
              )
            }
          }
        }
        if (packageName.isNotEmpty()) {
          Text(
            text = packageName,
            style = MaterialTheme.typography.bodySmall,
            color = contentColor.copy(alpha = 0.7f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
        }
      }
      
      if (isSelected) {
        Text(
          text = "✔",
          fontSize = 22.sp,
          fontWeight = FontWeight.Bold,
          color = if (isFocused) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.primary,
          modifier = Modifier.padding(start = 16.dp)
        )
      }
    }
  }
}
