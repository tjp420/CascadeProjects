param(
    [string]$BaseUrl = 'https://simplebeacon.ai',
    [string]$Origin = 'https://simplebeacon.ai',
    [switch]$SkipDeploy,
    [switch]$SkipValidation
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerRoot = Split-Path -Parent $scriptDir
Set-Location $workerRoot

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

Invoke-Step -Title 'Wrangler version' -Command 'npx wrangler --version'
Invoke-Step -Title 'Cloudflare auth check' -Command 'npx wrangler whoami'
Invoke-Step -Title 'Worker secret names (presence check only)' -Command 'npx wrangler secret list'
Invoke-Step -Title 'KV namespace inventory' -Command 'npx wrangler kv namespace list'

if (-not $SkipDeploy) {
    Invoke-Step -Title 'Deploy worker' -Command 'npx wrangler deploy'
}

if (-not $SkipValidation) {
    if ([string]::IsNullOrWhiteSpace($env:STRIPE_WEBHOOK_SECRET)) {
        Write-Host "`n[warn] STRIPE_WEBHOOK_SECRET is not set in this shell; skipping webhook validators." -ForegroundColor Yellow
        Write-Host "       Export it locally, then run validate scripts manually:" -ForegroundColor Yellow
        Write-Host "       npm run validate:webhook -- --base $BaseUrl --origin $Origin" -ForegroundColor Yellow
        Write-Host "       npm run validate:webhook:negative -- --base $BaseUrl --origin $Origin" -ForegroundColor Yellow
    } else {
        Invoke-Step -Title 'Validate webhook (positive)' -Command "npm run validate:webhook -- --base $BaseUrl --origin $Origin"
        Invoke-Step -Title 'Validate webhook (negative)' -Command "npm run validate:webhook:negative -- --base $BaseUrl --origin $Origin"
    }
}

Write-Host "`nRunbook non-secret launcher completed." -ForegroundColor Green
