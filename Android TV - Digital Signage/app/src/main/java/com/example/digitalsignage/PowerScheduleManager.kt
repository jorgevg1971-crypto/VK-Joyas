package com.example.digitalsignage

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import java.util.Calendar

object PowerScheduleManager {
    private const val TAG = "PowerScheduleManager"
    private const val PREFS_NAME = "power_schedule_prefs"
    
    const val ACTION_TV_SLEEP = "com.example.digitalsignage.ACTION_TV_SLEEP"
    const val ACTION_TV_WAKEUP = "com.example.digitalsignage.ACTION_TV_WAKEUP"

    private var initialCheckDone = false

    fun updateSchedule(context: Context, schedule: PowerSchedule?) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        
        val oldEnabled = prefs.getBoolean("enabled", false)
        val oldOnTime = prefs.getString("on_time", "") ?: ""
        val oldOffTime = prefs.getString("off_time", "") ?: ""
        val oldDays = prefs.getString("days", "") ?: ""

        val newEnabled = schedule?.enabled ?: false
        val newOnTime = schedule?.on_time ?: ""
        val newOffTime = schedule?.off_time ?: ""
        val newDays = schedule?.days ?: "lun,mar,mie,jue,vie,sab,dom"

        val changed = oldEnabled != newEnabled || oldOnTime != newOnTime || oldOffTime != newOffTime || oldDays != newDays
        val shouldTrigger = changed || !initialCheckDone
        initialCheckDone = true

        if (schedule == null || !schedule.enabled || schedule.on_time.isNullOrEmpty() || schedule.off_time.isNullOrEmpty()) {
            Log.d(TAG, "Schedule is disabled or null. Canceling alarms.")
            prefs.edit().putBoolean("enabled", false).apply()
            cancelAlarms(context)
            return
        }

        Log.d(TAG, "Updating schedule: enabled=${schedule.enabled}, on=${schedule.on_time}, off=${schedule.off_time}, days=${schedule.days}")

        prefs.edit()
            .putBoolean("enabled", true)
            .putString("on_time", schedule.on_time)
            .putString("off_time", schedule.off_time)
            .putString("days", schedule.days ?: "lun,mar,mie,jue,vie,sab,dom")
            .apply()

        scheduleAlarms(context)

        if (shouldTrigger) {
            if (shouldSleepNow(context)) {
                Log.d(TAG, "Immediate trigger: current time requires SLEEP. Sending sleep broadcast.")
                val intent = Intent(context, PowerScheduleReceiver::class.java).apply {
                    action = ACTION_TV_SLEEP
                }
                context.sendBroadcast(intent)
            } else {
                Log.d(TAG, "Immediate trigger: current time requires WAKEUP. Sending wakeup broadcast.")
                val intent = Intent(context, PowerScheduleReceiver::class.java).apply {
                    action = ACTION_TV_WAKEUP
                }
                context.sendBroadcast(intent)
            }
        }
    }

    fun restoreAlarms(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean("enabled", false)
        if (enabled) {
            Log.d(TAG, "Restoring active power schedule alarms.")
            scheduleAlarms(context)
        } else {
            Log.d(TAG, "No active schedule to restore.")
        }
    }

    fun shouldSleepNow(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean("enabled", false)
        if (!enabled) return false

        val onTimeStr = prefs.getString("on_time", "") ?: ""
        val offTimeStr = prefs.getString("off_time", "") ?: ""
        val daysStr = prefs.getString("days", "lun,mar,mie,jue,vie,sab,dom") ?: "lun,mar,mie,jue,vie,sab,dom"

        val nextWakeup = calculateNextTime(onTimeStr, daysStr) ?: return false
        val nextSleep = calculateNextTime(offTimeStr, daysStr) ?: return false

        return nextWakeup.before(nextSleep)
    }

    private fun scheduleAlarms(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean("enabled", false)
        if (!enabled) return

        val onTimeStr = prefs.getString("on_time", "") ?: ""
        val offTimeStr = prefs.getString("off_time", "") ?: ""
        val daysStr = prefs.getString("days", "lun,mar,mie,jue,vie,sab,dom") ?: "lun,mar,mie,jue,vie,sab,dom"

        val nextWakeup = calculateNextTime(onTimeStr, daysStr)
        val nextSleep = calculateNextTime(offTimeStr, daysStr)

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        // Schedule WAKEUP
        if (nextWakeup != null) {
            val intent = Intent(context, PowerScheduleReceiver::class.java).apply {
                action = ACTION_TV_WAKEUP
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                1001,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pendingIntent) // cancel previous
            
            Log.d(TAG, "Scheduling WAKEUP alarm at: ${nextWakeup.time}")
            scheduleSingleAlarm(alarmManager, nextWakeup.timeInMillis, pendingIntent)
        }

        // Schedule SLEEP
        if (nextSleep != null) {
            val intent = Intent(context, PowerScheduleReceiver::class.java).apply {
                action = ACTION_TV_SLEEP
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                1002,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pendingIntent) // cancel previous

            Log.d(TAG, "Scheduling SLEEP alarm at: ${nextSleep.time}")
            scheduleSingleAlarm(alarmManager, nextSleep.timeInMillis, pendingIntent)
        }
    }

    private fun scheduleSingleAlarm(alarmManager: AlarmManager, triggerAtMillis: Long, pendingIntent: PendingIntent) {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                Log.w(TAG, "Cannot schedule exact alarms. Using setAndAllowWhileIdle.")
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            } else {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            }
        } catch (se: SecurityException) {
            Log.e(TAG, "SecurityException while setting exact alarm. Falling back to setAndAllowWhileIdle.", se)
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis,
                pendingIntent
            )
        }
    }

    private fun cancelAlarms(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        
        val wakeupIntent = Intent(context, PowerScheduleReceiver::class.java).apply { action = ACTION_TV_WAKEUP }
        val wakeupPending = PendingIntent.getBroadcast(context, 1001, wakeupIntent, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)
        if (wakeupPending != null) {
            alarmManager.cancel(wakeupPending)
            wakeupPending.cancel()
        }

        val sleepIntent = Intent(context, PowerScheduleReceiver::class.java).apply { action = ACTION_TV_SLEEP }
        val sleepPending = PendingIntent.getBroadcast(context, 1002, sleepIntent, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)
        if (sleepPending != null) {
            alarmManager.cancel(sleepPending)
            sleepPending.cancel()
        }
        Log.d(TAG, "All power schedule alarms canceled.")
    }

    private fun calculateNextTime(timeStr: String, daysStr: String): Calendar? {
        val parts = timeStr.split(":")
        if (parts.size != 2) return null
        val hour = parts[0].toIntOrNull() ?: return null
        val minute = parts[1].toIntOrNull() ?: return null

        val activeDays = daysStr.split(",").map { it.trim().lowercase() }
        val now = Calendar.getInstance()

        // Check the next 7 days (including today) to find the closest match
        for (i in 0..7) {
            val candidate = Calendar.getInstance().apply {
                add(Calendar.DAY_OF_YEAR, i)
                set(Calendar.HOUR_OF_DAY, hour)
                set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            // If it's today and the time has already passed, skip today
            if (i == 0 && candidate.before(now)) {
                continue
            }

            val dayOfWeek = candidate.get(Calendar.DAY_OF_WEEK)
            val dayName = getDayNameFromCalendar(dayOfWeek)

            if (activeDays.contains(dayName)) {
                return candidate
            }
        }
        return null
    }

    private fun getDayNameFromCalendar(dayOfWeek: Int): String {
        return when (dayOfWeek) {
            Calendar.SUNDAY -> "dom"
            Calendar.MONDAY -> "lun"
            Calendar.TUESDAY -> "mar"
            Calendar.WEDNESDAY -> "mie"
            Calendar.THURSDAY -> "jue"
            Calendar.FRIDAY -> "vie"
            Calendar.SATURDAY -> "sab"
            else -> "lun"
        }
    }
}
