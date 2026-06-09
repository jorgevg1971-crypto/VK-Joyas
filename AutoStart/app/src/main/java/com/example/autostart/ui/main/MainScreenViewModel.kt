package com.example.autostart.ui.main

import android.app.Application
import android.content.Context
import android.os.Build
import android.provider.Settings
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.autostart.data.AppInfo
import com.example.autostart.data.DataRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class MainScreenViewModel(
    application: Application,
    private val dataRepository: DataRepository
) : AndroidViewModel(application) {

    private val sharedPrefs = application.getSharedPreferences("autostart_prefs", Context.MODE_PRIVATE)

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    init {
        loadSettings()
        loadInstalledApps()
    }

    fun loadSettings() {
        val enabled = sharedPrefs.getBoolean("enabled", false)
        val selectedPackage = sharedPrefs.getString("target_package", null)
        val hasPermission = checkOverlayPermission()
        
        _uiState.update { 
            it.copy(
                isAutostartEnabled = enabled,
                selectedPackage = selectedPackage,
                hasOverlayPermission = hasPermission
            )
        }
    }

    private fun loadInstalledApps() {
        _uiState.update { it.copy(isLoading = true) }
        viewModelScope.launch {
            dataRepository.getInstalledApps(getApplication()).collect { appsList ->
                _uiState.update { 
                    it.copy(
                        apps = appsList,
                        isLoading = false
                    )
                }
            }
        }
    }

    fun toggleAutostart(enabled: Boolean) {
        sharedPrefs.edit().putBoolean("enabled", enabled).apply()
        _uiState.update { it.copy(isAutostartEnabled = enabled) }
    }

    fun selectPackage(packageName: String?) {
        sharedPrefs.edit().putString("target_package", packageName).apply()
        _uiState.update { it.copy(selectedPackage = packageName) }
    }

    fun checkOverlayPermission(): Boolean {
        val context = getApplication<Application>()
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }
    }

    fun refreshPermissionState() {
        val hasPermission = checkOverlayPermission()
        _uiState.update { it.copy(hasOverlayPermission = hasPermission) }
    }
}

data class MainUiState(
    val apps: List<AppInfo> = emptyList(),
    val selectedPackage: String? = null,
    val isAutostartEnabled: Boolean = false,
    val hasOverlayPermission: Boolean = true,
    val isLoading: Boolean = false
)
