<#
.SYNOPSIS
  Production release script for the simplebeacon VS Code extension.

.DESCRIPTION
  Handles version bumping, VSIX packaging, integrity verification, and
  optional git tagging. Designed to be run from the repo root.

.PARAMETER PrepareOnly
  Only run validation checks and dry-run package. Do not create a tag or publish.

.PARAMETER PushTag
  Push the created git tag to origin after creation.

.PARAMETER BumpVersion
  Semver level to bump: patch, minor, or major. If omitted, uses current version.

.EXAMPLE
  npm run release:vscode:prepare
  npm run release:vscode:tag
  npm run release:vscode:tag:push
#>

[CmdletBinding()]
param(
  [switch]$PrepareOnly,
  [switch]$PushTag,
  [ValidateSet('patch', 'minor', 'major')]
  [string]$BumpVersion
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path "$PSScriptRoot/.."
$ExtDir = Join-Path $RepoRoot "simplebeacon-vscode-merged"
$PkgJsonPath = Join-Path $ExtDir "package.json"

if (-not (Test-Path $PkgJsonPath)) {
  Write-Error "Extension package.json not found at $PkgJsonPath"
  exit 1
}

$Pkg = Get-Content $PkgJsonPath -Raw | ConvertFrom-Json
$Version = $Pkg.version
$Name = $Pkg.name
$Publisher = $Pkg.publisher

Write-Host ""
$sep = '=' * 42
Write-Host $sep -ForegroundColor Cyan
Write-Host "  SimpleBeacon VS Code Release: $Publisher.$Name@$Version" -ForegroundColor Cyan
Write-Host $sep -ForegroundColor Cyan
Write-Host ""

# -- Phase 1: Version Bump (optional) --
if ($BumpVersion) {
  Write-Host "[Phase 1] Version Bump: $BumpVersion" -ForegroundColor Yellow
  $parts = $Version.Split('.')
  switch ($BumpVersion) {
    'patch' { $parts[2] = [int]$parts[2] + 1 }
    'minor' { $parts[1] = [int]$parts[1] + 1; $parts[2] = '0' }
    'major' { $parts[0] = [int]$parts[0] + 1; $parts[1] = '0'; $parts[2] = '0' }
  }
  $NewVersion = $parts -join '.'
  $Pkg.version = $NewVersion
  $Pkg | ConvertTo-Json -Depth 20 | Set-Content $PkgJsonPath -Encoding UTF8
  $Version = $NewVersion
  Write-Host "  [PASS] Version bumped to $Version" -ForegroundColor Green
  Write-Host ""
}

# -- Phase 2: Pre-flight Validation --
Write-Host "[Phase 2] Pre-flight Validation" -ForegroundColor Yellow

# Check that critical source files compile
Push-Location $ExtDir
& npm run compile 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
if ($LASTEXITCODE -ne 0) {
  Write-Host "  [FAIL] Extension compilation failed" -ForegroundColor Red
  Pop-Location
  exit 1
}
Write-Host "  [PASS] Extension compiles cleanly" -ForegroundColor Green

# Sync dashboard web assets
& npm run sync:dashboard-web 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
if ($LASTEXITCODE -ne 0) {
  Write-Host "  [WARN] Dashboard web sync had issues" -ForegroundColor DarkYellow
} else {
  Write-Host "  [PASS] Dashboard web assets synced" -ForegroundColor Green
}

# Check for required fields in package.json
if (-not $Pkg.publisher) {
  Write-Host "  [FAIL] Missing 'publisher' field in package.json" -ForegroundColor Red
  Pop-Location
  exit 1
}
if (-not $Pkg.repository) {
  Write-Host "  [FAIL] Missing 'repository' field in package.json" -ForegroundColor Red
  Pop-Location
  exit 1
}
Write-Host "  [PASS] Required metadata fields present" -ForegroundColor Green
Write-Host ""

# -- Phase 3: VSIX Packaging --
Write-Host "[Phase 3] VSIX Packaging" -ForegroundColor Yellow

if (-not $PrepareOnly) {
  & npx @vscode/vsce package --no-yarn --no-dependencies 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  [FAIL] VSIX packaging failed" -ForegroundColor Red
    Pop-Location
    exit 1
  }

  $VsixFiles = Get-ChildItem -Path $ExtDir -Filter "*.vsix" -ErrorAction SilentlyContinue
  if ($VsixFiles.Count -gt 0) {
    $Latest = $VsixFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $SizeKB = [math]::Round($Latest.Length / 1024, 1)
    Write-Host "  [PASS] VSIX created: $($Latest.Name) ($SizeKB KB)" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] No VSIX file found after packaging" -ForegroundColor Red
    Pop-Location
    exit 1
  }
} else {
  Write-Host "  [SKIP] VSIX packaging skipped (prepare-only mode)" -ForegroundColor DarkGray
}
Pop-Location
Write-Host ""

# -- Phase 4: Git Tag Creation --
if (-not $PrepareOnly) {
  Write-Host "[Phase 4] Git Tag" -ForegroundColor Yellow
  $TagName = "vscode-v$Version"

  $ExistingTag = & git tag -l $TagName 2>&1
  if ($ExistingTag) {
    Write-Host "  [WARN] Tag $TagName already exists" -ForegroundColor DarkYellow
  } else {
    & git tag -a $TagName -m "Release $Publisher.$Name@$Version"
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

# -- Summary --
Write-Host $sep -ForegroundColor Cyan
if ($PrepareOnly) {
  Write-Host "  Prepare-only complete -- $Publisher.$Name@$Version" -ForegroundColor Cyan
  Write-Host "  Run without -PrepareOnly to package VSIX and create tag." -ForegroundColor Cyan
} else {
  Write-Host "  Release complete -- $Publisher.$Name@$Version" -ForegroundColor Cyan
  Write-Host "  Tag: vscode-v$Version" -ForegroundColor Cyan
  Write-Host "  Next: push tag to trigger GitHub Actions publish" -ForegroundColor Cyan
}
Write-Host $sep -ForegroundColor Cyan
Write-Host ""
