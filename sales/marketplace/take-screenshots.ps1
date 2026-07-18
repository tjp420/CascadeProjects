#requires -Version 5.1
param(
    [string]$SampleDir = "$env:TEMP\simplebeacon-screenshot-sample",
    [string]$OutDir = "$PSScriptRoot\raw-screenshots"
)

$ErrorActionPreference = 'Stop'

function Find-VSCode {
    $cmd = Get-Command code -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code:\bin\code.cmd",
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code:\bin\code.exe",
        "$env:ProgramFiles\Microsoft VS Code:\bin\code.cmd",
        "$env:ProgramFiles\Microsoft VS Code:\bin\code.exe",
        "${env:ProgramFiles(x86)}\Microsoft VS Code:\bin\code.cmd"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

# Clean/create sample project
if (Test-Path $SampleDir) { Remove-Item -Recurse -Force $SampleDir }
New-Item -ItemType Directory -Path $SampleDir -Force | Out-Null

$sampleJs = @'
// Sample AI slop for screenshots
const API_KEY = "sk-1234567890abcdef";
console.log("Debug: starting scan");

function getAccuracy() {
    return "99.9% accuracy guaranteed by our AI";
}

// TODO: implement error handling
// FIXME: remove hardcoded key before release
fetch("https://api.example.com/data")
'@
Set-Content -Path "$SampleDir\sample.js" -Value $sampleJs -Encoding UTF8

$samplePy = @'
import os
API_KEY = "sk-1234567890abcdef"
print("Debug: starting scan")

# TODO: implement error handling
def accuracy():
    return "99.9% accuracy guaranteed by our AI"
'@
Set-Content -Path "$SampleDir\sample.py" -Value $samplePy -Encoding UTF8

# Create output dir
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

# Launch VS Code:
$codePath = Find-VSCode
if (-not $codePath) {
    Write-Host "VS Code: CLI ('code') not found. Open VS Code: manually at: $SampleDir" -ForegroundColor Yellow
} else {
    Write-Host "Opening VS Code: at $codePath with $SampleDir"
    Start-Process -FilePath $codePath -ArgumentList "`"$SampleDir`""
    Start-Sleep -Seconds 3
}

# Instructions for each screenshot
$instructions = @(
    "1: MAIN SIDEBAR`nOpen the AI Slop Cop sidebar and run 'Simplebeacon: Scan Entire Workspace'. Wait for results.",
    "2: FINDINGS LIST`nClick an issue count to expand findings, then click one finding for details.",
    "3: SETTINGS`nOpen Settings (Ctrl+,), search 'simplebeacon', scroll to scan location / token / exclusions.",
    "4: FULL SCAN`nIn the sidebar, check 'Full scan' and run 'Simplebeacon: Scan Entire Workspace' again.",
    "5: EXPORT REPORT`nRun a scan, click 'Export Report as JSON', open the exported file."
)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function Capture-Screen($path) {
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
    Write-Host "Saved $path" -ForegroundColor Green
}

for ($i = 0; $i -lt 5; $i++) {
    $n = $i + 1
    Write-Host "`n=== Screenshot $n ===" -ForegroundColor Cyan
    Write-Host $instructions[$i]
    Write-Host "Position VS Code: and press Enter to capture (Q to quit)..."
    $key = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    if ($key.Character -eq 'Q' -or $key.Character -eq 'q') {
        Write-Host "Quitting." -ForegroundColor Yellow
        break
    }
    $outFile = Join-Path $OutDir "screenshot${n}_raw.png"
    Capture-Screen $outFile
}

Write-Host "`nDone. Raw screenshots are in $OutDir" -ForegroundColor Green
Write-Host "Next: crop each to 1280x800 and save as simplebeacon-vscode-merged/resources/screenshots/screenshot1.png ... screenshot5.png" -ForegroundColor Green
