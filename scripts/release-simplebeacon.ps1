param(
	[switch]$PrepareOnly,
	[switch]$PushTag,
	[switch]$SkipCliTests,
	[switch]$SkipCliGate,
	[switch]$SkipDashboardBuild
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

function Invoke-Step {
	param(
		[Parameter(Mandatory = $true)][string]$Title,
		[Parameter(Mandatory = $true)][string]$Command
	)

	Write-Host "`n==> $Title" -ForegroundColor Cyan
	Write-Host "    $Command" -ForegroundColor DarkGray
	Invoke-Expression $Command
	if ($LASTEXITCODE -ne 0) {
		throw "Step failed: $Title"
	}
}

if (-not $SkipCliTests) {
	Invoke-Step -Title 'CLI tests (packages/simplebeacon-cli)' -Command 'npm test --workspace packages/simplebeacon-cli'
}

if (-not $SkipCliGate) {
	Invoke-Step -Title 'CLI staging gate smoke' -Command 'Push-Location "packages/simplebeacon-cli"; node bin/simplebeacon.js scan --path . --gate --offline; Pop-Location'
	Invoke-Step -Title 'CLI staging gate report' -Command 'Push-Location "packages/simplebeacon-cli"; node bin/simplebeacon.js scan --path . --gate --offline --format json --output .simplebeacon/report.json; Pop-Location'
}

if (-not $SkipDashboardBuild) {
	Invoke-Step -Title 'Dashboard production build (coming-soon/public/dashboard)' -Command 'Push-Location "coming-soon/public/dashboard"; npm run build; Pop-Location'
}

if ($PrepareOnly) {
	Write-Host "`nGates are green. Prepare-only mode complete (no tag created)." -ForegroundColor Green
	exit 0
}

$pkg = Get-Content 'packages/simplebeacon-cli/package.json' -Raw | ConvertFrom-Json
$version = [string]$pkg.version
if ([string]::IsNullOrWhiteSpace($version)) {
	throw 'Unable to determine version from packages/simplebeacon-cli/package.json'
}

$tagName = "simplebeacon-v$version"

& git rev-parse --verify --quiet "refs/tags/$tagName" *> $null
if ($LASTEXITCODE -eq 0) {
	throw "Tag already exists: $tagName"
}

Invoke-Step -Title "Create release tag $tagName" -Command "git tag -a $tagName -m 'simplebeacon $version'"

if ($PushTag) {
	Invoke-Step -Title "Push tag $tagName" -Command "git push origin $tagName"
}

Write-Host "`nRelease automation completed." -ForegroundColor Green
Write-Host "Tag created: $tagName"
if (-not $PushTag) {
	Write-Host "Push with: git push origin $tagName"
}
