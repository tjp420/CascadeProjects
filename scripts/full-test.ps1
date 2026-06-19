#!/usr/bin/env pwsh
<#
  One-command full integration test for SimpleBeacon extension.
  Run from project root or simplebeacon-vscode/.
#>
$ErrorActionPreference = 'Stop'

$EXTENSION_DIR = Join-Path $PSScriptRoot '..' 'simplebeacon-vscode'
if (-not (Test-Path $EXTENSION_DIR)) {
    $EXTENSION_DIR = $PSScriptRoot
}

Write-Host "=== SimpleBeacon Full Integration Test ===" -ForegroundColor Cyan
Write-Host "Extension dir: $EXTENSION_DIR" -ForegroundColor Gray

# 1. Compile
Write-Host "`n[1/4] Compiling TypeScript..." -ForegroundColor Yellow
Set-Location $EXTENSION_DIR
npm run compile | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "FAIL: TypeScript compilation failed"
    exit 1
}
Write-Host "PASS: Compiled successfully" -ForegroundColor Green

# 2. Verify scan finds full repo
Write-Host "`n[2/4] Verifying scan scope..." -ForegroundColor Yellow
$scanOutput = npx simplebeacon scan --full --gate --config .simplebeacon/config.json 2>&1
$filesMatch = $scanOutput | Select-String "Repository files:\s*([\d,]+)"
if (-not $filesMatch) {
    Write-Error "FAIL: Could not parse 'Repository files' from scan output"
    exit 1
}
$files = [int]($filesMatch.Matches[0].Groups[1].Value -replace ',','')
if ($files -lt 20000) {
    Write-Error "FAIL: Only $files files scanned (expected >= 20,000)"
    exit 1
}
Write-Host "PASS: $files files scanned" -ForegroundColor Green

# 3. Verify issues found
Write-Host "`n[3/4] Verifying findings..." -ForegroundColor Yellow
$totalIssues = 0
$issueMatches = $scanOutput | Select-String "(Critical|High|Medium|Low):\s*(\d+)"
foreach ($m in $issueMatches) {
    $totalIssues += [int]$m.Matches[0].Groups[2].Value
}
if ($totalIssues -lt 50) {
    Write-Error "FAIL: Only $totalIssues issues found (expected >= 50)"
    exit 1
}
Write-Host "PASS: $totalIssues issues detected" -ForegroundColor Green

# 4. Build VSIX
Write-Host "`n[4/4] Building VSIX..." -ForegroundColor Yellow
npx @vscode/vsce package --out simplebeacon-test.vsix | Out-Null
if (-not (Test-Path "simplebeacon-test.vsix")) {
    Write-Error "FAIL: VSIX build failed"
    exit 1
}
$size = (Get-Item "simplebeacon-test.vsix").Length / 1KB
Write-Host "PASS: simplebeacon-test.vsix built (${size:F1} KB)" -ForegroundColor Green

Write-Host "`n=== ALL TESTS PASSED ===" -ForegroundColor Green
Write-Host "Install: code --install-extension simplebeacon-test.vsix" -ForegroundColor Gray
