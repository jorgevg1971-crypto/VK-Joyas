package com.example.autostart

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d("BootReceiver", "Received intent action: $action")
        
        if (action == Intent.ACTION_BOOT_COMPLETED || 
            action == "android.intent.action.QUICKBOOT_POWERON" || 
            action == "com.htc.intent.action.QUICKBOOT_POWERON") {
            
            val sharedPreferences = context.getSharedPreferences("autostart_prefs", Context.MODE_PRIVATE)
            val isEnabled = sharedPreferences.getBoolean("enabled", false)
            val targetPackage = sharedPreferences.getString("target_package", null)
            
            Log.d("BootReceiver", "AutoStart config - Enabled: $isEnabled, Package: $targetPackage")
            
            if (isEnabled && !targetPackage.isNullOrEmpty()) {
                try {
                    val launchIntent = context.packageManager.getLaunchIntentForPackage(targetPackage)
                    if (launchIntent != null) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(launchIntent)
                        Log.d("BootReceiver", "Successfully started activity for $targetPackage")
                    } else {
                        Log.e("BootReceiver", "Launch intent is null for package: $targetPackage")
                    }
                } catch (e: Exception) {
                    Log.e("BootReceiver", "Error starting package: $targetPackage", e)
                }
            }
        }
    }
}
