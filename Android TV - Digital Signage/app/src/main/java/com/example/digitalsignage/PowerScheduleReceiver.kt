package com.example.digitalsignage

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log
import dadb.Dadb
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class PowerScheduleReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "PowerScheduleReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        Log.d(TAG, "Received action: $action")

        if (action == Intent.ACTION_BOOT_COMPLETED) {
            PowerScheduleManager.restoreAlarms(context)
            return
        }

        val pendingResult = goAsync()
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "DigitalSignage:PowerScheduleWakeLock"
        )
        wakeLock.acquire(15000) // Acquire lock for up to 15 seconds to execute ADB commands

        CoroutineScope(Dispatchers.IO).launch {
            try {
                when (action) {
                    PowerScheduleManager.ACTION_TV_SLEEP -> {
                        Log.d(TAG, "Executing TV SLEEP action...")
                        val ok = executeAdbCommand(context, "input keyevent KEYCODE_SLEEP")
                        if (ok) {
                            showToast(context, "Apagado programado: comando SLEEP enviado.")
                        } else {
                            showToast(context, "Error: No se pudo apagar. ¿ADB local/inalámbrico activo?")
                        }
                    }
                    PowerScheduleManager.ACTION_TV_WAKEUP -> {
                        Log.d(TAG, "Executing TV WAKEUP action...")
                        val ok = executeAdbCommand(context, "input keyevent KEYCODE_WAKEUP")
                        if (ok) {
                            showToast(context, "Encendido programado: comando WAKEUP enviado.")
                        } else {
                            showToast(context, "Error: No se pudo encender. ¿ADB local/inalámbrico activo?")
                        }
                        
                        // Wait 1.5 seconds and send KEYCODE_DPAD_RIGHT to wake up screen on older devices (e.g. Xiaomi Stick on Samsung TV)
                        delay(1500)
                        Log.d(TAG, "Sending KEYCODE_DPAD_RIGHT to ensure TV screen wakes up...")
                        executeAdbCommand(context, "input keyevent KEYCODE_DPAD_RIGHT")
                        
                        // Launch MainActivity to bring signage back to front
                        launchMainActivity(context)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error executing action $action", e)
            } finally {
                if (wakeLock.isHeld) {
                    wakeLock.release()
                }
                // Reschedule next alarms
                PowerScheduleManager.restoreAlarms(context)
                pendingResult.finish()
            }
        }
    }

    private fun showToast(context: Context, msg: String) {
        try {
            android.os.Handler(context.mainLooper).post {
                android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_LONG).show()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show toast", e)
        }
    }

    private fun executeAdbCommand(context: Context, cmd: String): Boolean {
        try {
            System.setProperty("user.home", context.filesDir.absolutePath)
            Log.d(TAG, "Connecting to localhost:5555 via DADB...")
            Dadb.create("localhost", 5555).use { dadb ->
                Log.d(TAG, "Executing shell: $cmd")
                val response = dadb.shell(cmd)
                Log.d(TAG, "DADB response: exitCode=${response.exitCode}, output=${response.allOutput}")
                return response.exitCode == 0
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to run ADB command '$cmd' on localhost:5555. Check if network debugging is enabled in Developer Options.", e)
            return false
        }
    }

    private fun launchMainActivity(context: Context) {
        try {
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            if (launchIntent != null) {
                Log.d(TAG, "Launching MainActivity...")
                context.startActivity(launchIntent)
            } else {
                Log.e(TAG, "Launch intent for package ${context.packageName} is null!")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error launching MainActivity", e)
        }
    }
}
