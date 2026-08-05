#!/usr/bin/env pwsh
# Repository Health Verification Script
# Runs the checks defined in .simplebeacon/qa/test_plan.md

$ErrorActionPreference = 'Stop'
$repoRoot = git rev-parse --show-toplevel
Set-Location $repoRoot

Write-Host "=== Repository Health Verification ===" -ForegroundColor Cyan

# 1. Check for re-appearing temp/junk files in git tracking
$tempPatterns = @(
  '.tmp-commit-*.txt',
  '.tmp-*.cjs',
  'tmp_*',
  'tmp-*',
  '*.err',
  'headers*.txt',
  'cli-scan-test.txt',
  'main_js.txt',
  'pr-302-body.txt',
  'test-output*.txt',
  'test-tokens.txt',
  'vsix-dirs*.txt'
)

$trackedTemp = git ls-files | Where-Object {
  $file = $_
  foreach ($p in $tempPatterns) { if ($file -like $p) { $true; return } }
}

if ($trackedTemp) {
  Write-Host "FAIL: tracked temp/junk files found:" -ForegroundColor Red
  $trackedTemp | ForEach-Object { Write-Host "  $_" }
  exit 1
} else {
  Write-Host "PASS: no tracked temp/junk files" -ForegroundColor Green
}

# 2. Verify duplicate build artifacts are absent
$duplicatePaths = @(
  'generated/procurement-kit-tmp/dependency-security-report.json',
  'generated/procurement-kit-tmp/verify-isolation.json',
  'generated/download/tmp/verify-isolation.json'
)

$foundDups = $duplicatePaths | Where-Object { Test-Path $_ }
if ($foundDups) {
  Write-Host "FAIL: duplicate build artifacts still present:" -ForegroundColor Red
  $foundDups | ForEach-Object { Write-Host "  $_" }
  exit 1
} else {
  Write-Host "PASS: no duplicate build artifacts" -ForegroundColor Green
}

# 3. SimpleBeacon gate scan (targeted, fast)
Write-Host "Running SimpleBeacon gate scan..." -ForegroundColor Cyan
npx simplebeacon scan --path ai-platform/server/lib/hsm-adapter --gate
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "=== All repository health checks passed ===" -ForegroundColor Green
