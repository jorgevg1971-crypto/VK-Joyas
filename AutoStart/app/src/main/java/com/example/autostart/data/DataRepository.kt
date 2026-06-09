package com.example.autostart.data

import android.content.Context
import android.content.Intent
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

data class AppInfo(
    val name: String,
    val packageName: String,
    val isTvApp: Boolean
)

interface DataRepository {
  fun getInstalledApps(context: Context): Flow<List<AppInfo>>
}

class DefaultDataRepository : DataRepository {
  override fun getInstalledApps(context: Context): Flow<List<AppInfo>> = flow {
    val pm = context.packageManager
    
    val tvIntent = Intent(Intent.ACTION_MAIN, null).apply {
        addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER)
    }
    val tvApps = pm.queryIntentActivities(tvIntent, 0)
    
    val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
        addCategory(Intent.CATEGORY_LAUNCHER)
    }
    val mobileApps = pm.queryIntentActivities(mainIntent, 0)
    
    val appMap = mutableMapOf<String, AppInfo>()
    
    for (resolveInfo in tvApps) {
        val packageName = resolveInfo.activityInfo.packageName
        val name = resolveInfo.loadLabel(pm).toString()
        appMap[packageName] = AppInfo(name, packageName, isTvApp = true)
    }
    
    for (resolveInfo in mobileApps) {
        val packageName = resolveInfo.activityInfo.packageName
        if (!appMap.containsKey(packageName)) {
            val name = resolveInfo.loadLabel(pm).toString()
            appMap[packageName] = AppInfo(name, packageName, isTvApp = false)
        }
    }
    
    val myPackage = context.packageName
    appMap.remove(myPackage)
    
    emit(appMap.values.sortedBy { it.name.lowercase() })
  }
}
