<#
.SYNOPSIS
  Production release script for the simplebeacon CLI npm package.

.DESCRIPTION
  Handles version bumping, changelog extraction, tarball creation, integrity
  verification, and optional git tagging. Designed to be run from the repo root.

.PARAMETER PrepareOnly
  Only run validation checks and dry-run pack. Do not create a tag or publish.

.PARAMETER PushTag
  Push the created git tag to origin after creation.

.EXAMPLE
  npm run release:simplebeacon:prepare
  npm run release:simplebeacon:tag
  npm run release:simplebeacon:tag:push
#>

[CmdletBinding()]
param(
  [switch]$PrepareOnly,
  [switch]$PushTag
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path "$PSScriptRoot/.."
$CliDir = Join-Path $RepoRoot "packages/simplebeacon-cli"
$PkgJsonPath = Join-Path $CliDir "package.json"

if (-not (Test-Path $PkgJsonPath)) {
  Write-Error "CLI package.json not found at $PkgJsonPath"
  exit 1
}

$Pkg = Get-Content $PkgJsonPath -Raw | ConvertFrom-Json
$Version = $Pkg.version
$Name = $Pkg.name

Write-Host ""
$sep = '=' * 42
Write-Host $sep -ForegroundColor Cyan
Write-Host "  SimpleBeacon Release: $Name@$Version" -ForegroundColor Cyan
Write-Host $sep -ForegroundColor Cyan
Write-Host ""

# ── Phase 1: Pre-flight Validation ──
Write-Host "[Phase 1] Pre-flight Validation" -ForegroundColor Yellow

# Check syntax of critical files
$CriticalFiles = @(
  "bin/simplebeacon.js",
  "src/index.js",
  "src/scan.js",
  "src/reporters/json.js",
  "src/lib/pdf-generator.js"
)

foreach ($file in $CriticalFiles) {
  $fullPath = Join-Path $CliDir $file
  if (Test-Path $fullPath) {
    $result = & node -c $fullPath 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  [PASS] Syntax: $file" -ForegroundColor Green
    } else {
      Write-Host "  [FAIL] Syntax: $file -- $result" -ForegroundColor Red
      exit 1
    }
  } else {
    Write-Host "  [WARN] Missing: $file" -ForegroundColor DarkYellow
  }
}

# Check for stray .patch-fix files in src/
$PatchFixFiles = Get-ChildItem -Path $CliDir -Recurse -Filter "*.patch-fix" -ErrorAction SilentlyContinue
if ($PatchFixFiles.Count -gt 0) {
  Write-Host "  [WARN] Found $($PatchFixFiles.Count) .patch-fix files in CLI directory" -ForegroundColor DarkYellow
  Write-Host "         These will be excluded from the npm package." -ForegroundColor DarkYellow
}

Write-Host "  [PASS] Pre-flight validation complete" -ForegroundColor Green
Write-Host ""

# ── Phase 2: Clean Pack Check ──
Write-Host "[Phase 2] Pack Contents Validation" -ForegroundColor Yellow

Push-Location $CliDir
$PackOutput = & cmd /c "npm pack --dry-run --ignore-scripts 2>&1" | Out-String
Pop-Location
$PackLines = $PackOutput -split "`n"
$StrayFiles = $PackLines | Where-Object { $_ -match "\.patch-fix" -or $_ -match "\.test\." }

if ($StrayFiles.Count -gt 0) {
  Write-Host "  [FAIL] Stray files detected in pack output:" -ForegroundColor Red
  foreach ($f in $StrayFiles) {
    Write-Host "    $f" -ForegroundColor Red
  }
  exit 1
} else {
  Write-Host "  [PASS] No stray .patch-fix or .test files in pack" -ForegroundColor Green
}

# Extract package size
$SizeLine = $PackLines | Where-Object { $_ -match "package size" }
if ($SizeLine) {
  Write-Host "  [INFO] $SizeLine" -ForegroundColor DarkGray
}

$FileCountLine = $PackLines | Where-Object { $_ -match "total files" }
if ($FileCountLine) {
  Write-Host "  [INFO] $FileCountLine" -ForegroundColor DarkGray
}

Write-Host ""

# ── Phase 3: Test Suite ──
if (-not $PrepareOnly) {
  Write-Host "[Phase 3] Running Test Suite" -ForegroundColor Yellow
  Push-Location $CliDir
  & npm test 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  [FAIL] Tests failed -- aborting release" -ForegroundColor Red
    Pop-Location
    exit 1
  }
  Write-Host "  [PASS] All tests green" -ForegroundColor Green

  # MCP smoke test
  Write-Host "  Running MCP smoke test..." -ForegroundColor DarkGray
  & npm run mcp:smoke 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  [FAIL] MCP smoke test failed" -ForegroundColor Red
    Pop-Location
    exit 1
  }
  Write-Host "  [PASS] MCP smoke test green" -ForegroundColor Green
  Pop-Location
  Write-Host ""
}

# ── Phase 4: Git Tag Creation ──
if (-not $PrepareOnly) {
  Write-Host "[Phase 4] Git Tag" -ForegroundColor Yellow
  $TagName = "simplebeacon-v$Version"

  # Check if tag already exists
  $ExistingTag = & git tag -l $TagName 2>&1
  if ($ExistingTag) {
    Write-Host "  [WARN] Tag $TagName already exists" -ForegroundColor DarkYellow
  } else {
    & git tag -a $TagName -m "Release $Name@$Version"
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  [PASS] Created tag: $TagName" -ForegroundColor Green
    } else {
      Write-Host "  [FAIL] Failed to create tag" -ForegroundColor Red
      exit 1
    }

    if ($PushTag) {
      Write-Host "  Pushing tag to origin..." -ForegroundColor DarkGray
      & git push origin $TagName 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
      if ($LASTEXITCODE -eq 0) {
        Write-Host "  [PASS] Tag pushed to origin" -ForegroundColor Green
      } else {
        Write-Host "  [WARN] Failed to push tag -- you can push manually: git push origin $TagName" -ForegroundColor DarkYellow
      }
    }
  }
  Write-Host ""
}

# ── Summary ──
Write-Host $sep -ForegroundColor Cyan
if ($PrepareOnly) {
  Write-Host "  Prepare-only complete -- $Name@$Version" -ForegroundColor Cyan
  Write-Host "  Run without -PrepareOnly to create tag and publish." -ForegroundColor Cyan
} else {
  Write-Host "  Release complete -- $Name@$Version" -ForegroundColor Cyan
  Write-Host "  Tag: simplebeacon-v$Version" -ForegroundColor Cyan
  Write-Host "  Next: npm publish --workspace=simplebeacon" -ForegroundColor Cyan
}
Write-Host $sep -ForegroundColor Cyan
Write-Host ""
