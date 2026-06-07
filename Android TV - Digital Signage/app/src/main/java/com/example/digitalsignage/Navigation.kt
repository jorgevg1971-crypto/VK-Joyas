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
  val savedIp = prefs.getString("smb_ip", null)
  val savedShare = prefs.getString("smb_share", null)

  // Start directly on Player screen if server is configured, otherwise start at Setup
  val initialScreen = if (savedIp != null && savedShare != null) Player else Setup
  val backStack = rememberNavBackStack(initialScreen)

  NavDisplay(
    backStack = backStack,
    onBack = { backStack.removeLastOrNull() },
    entryProvider =
      entryProvider {
        entry<Setup> {
          SetupScreen(
            onSetupComplete = { ip, share, user, pass ->
              prefs.edit()
                .putString("smb_ip", ip)
                .putString("smb_share", share)
                .putString("smb_user", user)
                .putString("smb_pass", pass)
                .commit()
              // Remove setup from backstack and navigate to player
              backStack.removeLastOrNull()
              backStack.add(Player)
            }
          )
        }
        entry<Player> {
          PlayerScreen(
            onResetConfig = {
              prefs.edit()
                .remove("smb_ip")
                .remove("smb_share")
                .remove("smb_user")
                .remove("smb_pass")
                .commit()
              backStack.removeLastOrNull()
              backStack.add(Setup)
            }
          )
        }
      },
  )
}
