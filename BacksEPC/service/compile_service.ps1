# Script to compile the C# Windows Service Wrapper

$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    Write-Error "C# Compiler (csc.exe) not found at $cscPath"
    exit 1
}

$outputExe = Join-Path $PSScriptRoot "..\ePCBackupService.exe"
$sourceFile = Join-Path $PSScriptRoot "ServiceWrapper.cs"

Write-Host "Compiling Windows Service Wrapper..." -ForegroundColor Cyan

# Run compiler
& $cscPath /target:exe /out:"$outputExe" /r:System.ServiceProcess.dll /r:System.dll "$sourceFile"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Compilation successful! Executable created at: $outputExe" -ForegroundColor Green
} else {
    Write-Error "Compilation failed."
    exit 1
}
