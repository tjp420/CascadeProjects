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
    try {
        $tempDir = "$root\.vsix-patch-temp"
        if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
        New-Item -ItemType Directory -Path $tempDir | Out-Null
        $extensionDir = "$tempDir\extension"
        $scriptPath = "$tempDir\repackage-vsix.js"

        # Extract the VSIX and inject sidebar.html
        & tar -xf $vsix.FullName -C $tempDir
        Copy-Item "$root\sidebar.html" -Destination $extensionDir -Force

        # Write a small Node helper to repackage with jszip (yauzl-compatible)
        @"
const JSZip = require('jszip');
const fs = require('fs');
(async () => {
  try {
    const zip = await JSZip.loadAsync(fs.readFileSync(process.argv[2]));
    const source = fs.readFileSync(process.argv[3]);
    zip.file('extension/sidebar.html', source);
    const output = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    fs.writeFileSync(process.argv[2], output);
    console.log('Injected sidebar.html into VSIX.');
  } catch (err) {
    console.error('Failed to inject sidebar.html:', err.message);
    process.exit(1);
  }
})();
"@ | Out-File -FilePath $scriptPath -Encoding UTF8

        # Run from the project directory so 'jszip' resolves
        Push-Location $root
        & node $scriptPath $vsix.FullName "$root\sidebar.html"
        $result = $LASTEXITCODE
        Pop-Location
        if ($result -ne 0) { exit 1 }
        Remove-Item $tempDir -Recurse -Force
    } catch {
        Write-Host "Failed to inject sidebar.html: $_" -ForegroundColor Red
        exit 1
    }
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
