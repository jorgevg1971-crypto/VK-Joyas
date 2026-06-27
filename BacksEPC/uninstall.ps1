# Windows Service Uninstallation Script for ePC Backup Service
# IMPORTANT: Run this script in PowerShell as Administrator

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "=========================================================="
    Write-Warning "ERROR: Este script requiere PRIVILEGIOS DE ADMINISTRADOR."
    Write-Warning "Por favor, abre PowerShell como Administrador y ejecútalo de nuevo."
    Write-Warning "=========================================================="
    exit 1
}

$serviceName = "ePCBackupService"

Write-Host "Deteniendo y eliminando el servicio $serviceName..." -ForegroundColor Cyan

$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existingService) {
    if ($existingService.Status -eq "Running") {
        Write-Host "Deteniendo el servicio..." -ForegroundColor Yellow
        Stop-Service -Name $serviceName -Force
    }
    
    Write-Host "Eliminando el registro del servicio..." -ForegroundColor Yellow
    & sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 2
    
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "¡ePC Backup Service ha sido desinstalado correctamente!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Host "El servicio $serviceName no está instalado en este sistema." -ForegroundColor Yellow
}
