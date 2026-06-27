# Build and package the SimpleBeacon VS Code: extension
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "=== Building SimpleBeacon Extension ===" -ForegroundColor Cyan

# Step 1: Compile TypeScript
Write-Host "[1/3] Compiling TypeScript..." -ForegroundColor Yellow
& npx tsc -p "$root" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScript compilation failed. Fix errors above and retry." -ForegroundColor Red
    exit 1
}
Write-Host "TypeScript compilation OK." -ForegroundColor Green

# Step 2: Syntax-check compiled output
Write-Host "[2/3] Checking compiled JS syntax..." -ForegroundColor Yellow
& node -c "$root\out\modernSidebarProvider.js" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Compiled JS has syntax errors." -ForegroundColor Red
    exit 1
}
Write-Host "Compiled JS syntax OK." -ForegroundColor Green

# Step 3: Build .vsix
Write-Host "[3/3] Building .vsix package..." -ForegroundColor Yellow
Push-Location $root
& npx @vscode/vsce package --out "$root\simplebeacon-$((Get-Content "$root\package.json" | ConvertFrom-Json).version).vsix" 2>&1
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "VSIX build failed." -ForegroundColor Red
    exit 1
}
Pop-Location

# Step 3b: Inject sidebar.html if vsce omitted it (untracked files are skipped by vsce)
$vsix = Get-ChildItem "$root\simplebeacon-*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($vsix -and (Test-Path "$root\sidebar.html")) {
    $tempDir = "$root\.vsix-patch-temp"
    if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    $zipPath = "$tempDir\package.zip"
    Copy-Item -Path $vsix.FullName -Destination $zipPath -Force
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
    $extensionDir = Join-Path $tempDir 'extension'
    if (Test-Path $extensionDir) {
        Copy-Item "$root\sidebar.html" -Destination $extensionDir -Force
        Remove-Item $vsix.FullName -Force
        Remove-Item $zipPath -Force
        Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
        Move-Item -Path $zipPath -Destination $vsix.FullName -Force
        Write-Host "Injected sidebar.html into VSIX." -ForegroundColor Green
    }
    Remove-Item $tempDir -Recurse -Force
}

# Show result
$vsix = Get-ChildItem "$root\simplebeacon-*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($vsix) {
    Write-Host "=== SUCCESS ===" -ForegroundColor Green
    Write-Host "Package: $($vsix.FullName)"
    Write-Host "Size: $([math]::Round($vsix.Length/1KB,2)) KB"
    Write-Host ""
    Write-Host "Next step: install in VS Code: (or Windsurf) via Extensions > Install from VSIX, then reload the window." -ForegroundColor Cyan
} else {
    Write-Host "VSIX file not found in releases/" -ForegroundColor Red
}
