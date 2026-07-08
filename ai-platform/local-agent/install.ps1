# SimpleBeacon Local Agent Windows Installer
# Installs the agent to %LOCALAPPDATA%\SimpleBeaconLocalAgent, creates a Start Menu
# shortcut, adds it to the current user's startup folder, and starts the agent.

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\SimpleBeaconLocalAgent"
)

$ErrorActionPreference = "Stop"

$sourceDir = $PSScriptRoot
if (-not $sourceDir) {
    $sourceDir = (Get-Location).Path
}

$startMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\SimpleBeacon"
$startupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$agentBat = Join-Path $InstallDir "start-agent.bat"
$agentExe = Join-Path $InstallDir "agent.cjs"

function Ensure-Dir($dir) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

function Create-Shortcut($target, $shortcutPath, $arguments = "", $description = "") {
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $target
    if ($arguments) { $shortcut.Arguments = $arguments }
    if ($description) { $shortcut.Description = $description }
    $shortcut.WorkingDirectory = $InstallDir
    $shortcut.Save()
}

Write-Host "Installing SimpleBeacon Local Agent to $InstallDir..."

Ensure-Dir $InstallDir

$items = @(
    "agent.cjs",
    "package.json",
    "README.md",
    "start-agent.bat",
    "start-agent.sh",
    "uninstall.ps1",
    "uninstall-windows.bat",
    "node_modules",
    "packages",
    ".simplebeacon"
)

foreach ($item in $items) {
    $src = Join-Path $sourceDir $item
    $dst = Join-Path $InstallDir $item
    if (-not (Test-Path $src)) {
        Write-Warning "Source item not found, skipping: $src"
        continue
    }
    if (Test-Path $dst) {
        Remove-Item -Recurse -Force $dst
    }
    if ((Get-Item $src).PSIsContainer) {
        Copy-Item -Recurse -Force $src $dst
    } else {
        Copy-Item -Force $src $dst
    }
}

$uninstallBat = Join-Path $InstallDir "uninstall-windows.bat"

# Start Menu shortcut.
Ensure-Dir $startMenuDir
Create-Shortcut `
    -target $agentBat `
    -shortcutPath "$startMenuDir\SimpleBeacon Local Agent.lnk" `
    -description "Start the SimpleBeacon local scan agent"

# Uninstall shortcut.
Create-Shortcut `
    -target $uninstallBat `
    -shortcutPath "$startMenuDir\Uninstall SimpleBeacon Local Agent.lnk" `
    -description "Remove the SimpleBeacon local scan agent"

# Startup shortcut so the agent runs on login.
Create-Shortcut `
    -target $agentBat `
    -shortcutPath "$startupDir\SimpleBeacon Local Agent.lnk" `
    -description "Start the SimpleBeacon local scan agent on login"

Write-Host "Starting SimpleBeacon Local Agent..."
Start-Process -FilePath $agentBat -WorkingDirectory $InstallDir

Write-Host ""
Write-Host "Installation complete." -ForegroundColor Green
Write-Host "The agent is running on http://127.0.0.1:55432"
Write-Host "You can now open the dashboard and enter a local path to scan."

Read-Host "Press Enter to close"
