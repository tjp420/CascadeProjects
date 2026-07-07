# SimpleBeacon Local Agent Windows Uninstaller

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\SimpleBeaconLocalAgent"
)

$ErrorActionPreference = "Stop"

$startMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\SimpleBeacon"
$startupShortcut = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\SimpleBeacon Local Agent.lnk"

# Kill any running agent.cjs node processes under the install directory.
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='node.exe'" | ForEach-Object {
    $cmd = $_.CommandLine
    if ($cmd -and $cmd -like "*$InstallDir*") {
        Write-Host "Stopping agent process ($($_.ProcessId))..."
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

if (Test-Path $InstallDir) {
    Write-Host "Removing $InstallDir..."
    Remove-Item -Recurse -Force $InstallDir
}

if (Test-Path $startupShortcut) {
    Write-Host "Removing startup shortcut..."
    Remove-Item -Force $startupShortcut
}

if (Test-Path $startMenuDir) {
    Write-Host "Removing Start Menu folder..."
    Remove-Item -Recurse -Force $startMenuDir
}

Write-Host "Uninstallation complete." -ForegroundColor Green
Read-Host "Press Enter to close"
