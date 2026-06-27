# VSCE Publish Script for SimpleBeacon AI Slop Cop
# Run this after registering the 'simplebeacon' publisher on marketplace.visualstudio.com/manage
# and creating an Azure DevOps Personal Access Token with Marketplace (Publish) scope.

$ErrorActionPreference = "Stop"
$extDir = "simplebeacon-vscode-merged"
$vsix = "simplebeacon-3.0.309.vsix"

# 1. Ensure latest VSIX is built
if (-not (Test-Path "$extDir\$vsix")) {
    Write-Host "VSIX not found. Building..."
    Push-Location $extDir
    npm run package:vsix
    Pop-Location
}

# 2. Install vsce if missing
if (-not (Get-Command vsce -ErrorAction SilentlyContinue)) {
    npm install -g @vscode/vsce
}

# 3. Login (one-time per PAT lifecycle)
# vsce login simplebeacon

# 4. Publish
Write-Host "Publishing $vsix to marketplace..."
vsce publish --packagePath "$extDir\$vsix" --target win32-x64 linux-x64 darwin-x64

Write-Host "Done. Verify at: https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop"
