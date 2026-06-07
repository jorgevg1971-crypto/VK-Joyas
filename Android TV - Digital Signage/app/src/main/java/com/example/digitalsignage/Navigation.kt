package com.example.digitalsignage

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.example.digitalsignage.ui.player.PlayerScreen
import com.example.digitalsignage.ui.setup.SetupScreen

@Composable
fun MainNavigation() {
  val context = LocalContext.current
  val prefs = context.getSharedPreferences("digitalsignage_prefs", Context.MODE_PRIVATE)
  val savedFolder = prefs.getString("selected_folder", null)

  // Start directly on Player screen if folder is configured, otherwise start at Setup
  val initialScreen = if (savedFolder != null) Player else Setup
  val backStack = rememberNavBackStack(initialScreen)

  NavDisplay(
    backStack = backStack,
    onBack = { backStack.removeLastOrNull() },
    entryProvider =
      entryProvider {
        entry<Setup> {
          SetupScreen(
            onFolderSelected = { folder ->
              prefs.edit().putString("selected_folder", folder).commit()
              // Remove setup from backstack and navigate to player
              backStack.removeLastOrNull()
              backStack.add(Player)
            }
          )
        }
        entry<Player> {
          PlayerScreen(
            onResetConfig = {
              prefs.edit().remove("selected_folder").commit()
              backStack.removeLastOrNull()
              backStack.add(Setup)
            }
          )
        }
      },
  )
}
