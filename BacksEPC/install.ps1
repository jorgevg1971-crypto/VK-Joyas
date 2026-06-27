# Windows Service Installation Script for ePC Backup Service
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
$exePath = Join-Path $PSScriptRoot "ePCBackupService.exe"

# 1. Compile the service wrapper first to ensure we have the latest binary
Write-Host "1. Compilando el wrapper del servicio..." -ForegroundColor Cyan
& powershell.exe -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "service\compile_service.ps1")

if (-not (Test-Path $exePath)) {
    Write-Error "Error: No se encontró el ejecutable del servicio compilado en $exePath"
    exit 1
}

# 2. Check if the service already exists, and remove it
Write-Host "2. Verificando si existe una instalación previa..." -ForegroundColor Cyan
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Deteniendo y removiendo el servicio existente..." -ForegroundColor Yellow
    if ($existingService.Status -eq "Running") {
        Stop-Service -Name $serviceName -Force
    }
    # Delete using sc.exe for compatibility
    & sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 2
}

# 3. Create the new service
Write-Host "3. Creando el nuevo servicio de Windows..." -ForegroundColor Cyan
# Enclose path in quotes for spaces handling
$binaryPath = "`"$exePath`""

New-Service -Name $serviceName `
            -BinaryPathName $binaryPath `
            -DisplayName "ePC Backup Service" `
            -Description "Servicio automático de copias de seguridad incrementales y completas al NAS para ePC." `
            -StartupType Automatic

if ($?) {
    Write-Host "Servicio creado con éxito." -ForegroundColor Green
} else {
    Write-Error "Fallo al crear el servicio."
    exit 1
}

# 4. Start the service
Write-Host "4. Iniciando el servicio..." -ForegroundColor Cyan
Start-Service -Name $serviceName

$startedService = Get-Service -Name $serviceName
if ($startedService.Status -eq "Running") {
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "¡ePC Backup Service ha sido instalado e iniciado con éxito!" -ForegroundColor Green
    Write-Host "El servicio correrá automáticamente cuando Windows se inicie." -ForegroundColor Green
    Write-Host "Puedes acceder al panel de control desde tu navegador en:" -ForegroundColor Cyan
    Write-Host "---> http://localhost:8282" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Warning "El servicio se instaló pero no se pudo iniciar automáticamente. Por favor revisa los logs."
}
