# Packager script for ePC Backup
$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Creando instalador portable de ePC Backups..." -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$root = Get-Item $PSScriptRoot
$distName = "ePC_Backup_Distribution"
$distDir = Join-Path $root.FullName $distName
$zipFile = Join-Path $root.FullName "ePC_Backup_Instalador.zip"

# Clean previous builds
if (Test-Path $distDir) {
    Remove-Item $distDir -Recurse -Force
}
if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
}

# Create distribution folder
New-Item -ItemType Directory -Path $distDir | Out-Null

Write-Host "Copiando archivos del backend..." -ForegroundColor Gray
$backendDest = Join-Path $distDir "backend"
New-Item -ItemType Directory -Path $backendDest | Out-Null
Copy-Item (Join-Path $root.FullName "backend\*") -Destination $backendDest -Recurse -Exclude "data", "logs" -Force

# Recreate empty data folder in backend for structural consistency
New-Item -ItemType Directory -Path (Join-Path $backendDest "data") | Out-Null

Write-Host "Copiando compilados del frontend..." -ForegroundColor Gray
$frontendDest = Join-Path $distDir "frontend"
New-Item -ItemType Directory -Path $frontendDest | Out-Null
$frontendDistDest = Join-Path $frontendDest "dist"
New-Item -ItemType Directory -Path $frontendDistDest | Out-Null
Copy-Item (Join-Path $root.FullName "frontend\dist\*") -Destination $frontendDistDest -Recurse -Force

Write-Host "Copiando wrapper del servicio..." -ForegroundColor Gray
$serviceDest = Join-Path $distDir "service"
New-Item -ItemType Directory -Path $serviceDest | Out-Null
Copy-Item (Join-Path $root.FullName "service\*") -Destination $serviceDest -Recurse -Exclude "obj", "bin", "service.log" -Force

Write-Host "Copiando scripts de instalacion..." -ForegroundColor Gray
Copy-Item (Join-Path $root.FullName "install.ps1") -Destination $distDir
Copy-Item (Join-Path $root.FullName "uninstall.ps1") -Destination $distDir

# Compress to ZIP using native tar or Compress-Archive
Write-Host "Comprimiendo instalador..." -ForegroundColor Gray
if (Get-Command tar.exe -ErrorAction SilentlyContinue) {
    tar.exe -a -cf $zipFile -C $distDir .
} else {
    Compress-Archive -Path "$distDir\*" -DestinationPath $zipFile -Force
}

# Clean temporary folder
Remove-Item $distDir -Recurse -Force

Write-Host ""
Write-Host "¡Completado!" -ForegroundColor Green
Write-Host "Instalador empaquetado en: $zipFile" -ForegroundColor Green
Write-Host "Lleva este archivo ZIP a la otra máquina, descomprímelo y ejecuta install.ps1 como Administrador." -ForegroundColor Cyan
