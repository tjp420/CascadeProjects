param(
    [switch]$RunLighthouse,
    [switch]$CommitAndPush,
    [switch]$SkipDeploy,
    [string]$TargetUrl = 'https://simplebeacon.ai/',
    [string]$CommitMessage = 'chore: deploy coming-soon production update',
    [string[]]$GitPaths = @(
        'coming-soon/index.html',
        'coming-soon/pricing.html',
        'coming-soon/public/index.html',
        'coming-soon/public/pricing.html',
        'ai-platform/docs/outreach-cc-campaign.md',
        'CHANGELOG.md'
    )
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

function Get-EdgePath {
    $paths = @(
        'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
    )
    foreach ($p in $paths) {
        if (Test-Path $p) {
            return $p
        }
    }
    return $null
}

Invoke-Step -Title 'Build static production bundle (coming-soon/public)' -Command 'Push-Location "coming-soon"; npm run build; Pop-Location'
Invoke-Step -Title 'Run layout and PDF wiring audit' -Command 'Push-Location "coming-soon"; node --test test/lighthouse-pdf-audit.test.cjs; Pop-Location'

if ($RunLighthouse) {
    $edgePath = Get-EdgePath
    if (-not $edgePath) {
        throw 'Edge executable not found. Install Edge or provide CHROME_PATH before running with -RunLighthouse.'
    }

    $env:CHROME_PATH = $edgePath
    $dateTag = Get-Date -Format 'yyyy-MM-dd'
    $reportPath = ".simplebeacon/lighthouse-production-$dateTag.json"
    $summaryPath = ".simplebeacon/deployment-telemetry-coming-soon-$dateTag.json"

    Invoke-Step -Title "Lighthouse production audit ($TargetUrl)" -Command "npx --yes lighthouse $TargetUrl --output json --output-path $reportPath --quiet --chrome-flags='--headless=new --no-sandbox --disable-gpu'"

    $summary = node -e "const fs=require('fs');const p='$reportPath';const j=JSON.parse(fs.readFileSync(p,'utf8'));const c=j.categories||{};const out={generatedAt:new Date().toISOString(),requestedUrl:j.requestedUrl,finalDisplayedUrl:j.finalDisplayedUrl,fetchTime:j.fetchTime,scores:{performance:Math.round((c.performance?.score??0)*100),accessibility:Math.round((c.accessibility?.score??0)*100),bestPractices:Math.round((c['best-practices']?.score??0)*100),seo:Math.round((c.seo?.score??0)*100)}};process.stdout.write(JSON.stringify(out,null,2));"
    $summary | Set-Content -Path $summaryPath -Encoding UTF8
    Write-Host "Telemetry summary written: $summaryPath" -ForegroundColor Green
}

if ($CommitAndPush) {
    Invoke-Step -Title 'Stage deployment paths' -Command ("git add -- " + ($GitPaths -join ' '))

    $stagedCount = (& git diff --cached --name-only | Measure-Object -Line).Lines
    if ($stagedCount -eq 0) {
        Write-Host 'No staged changes found for configured deployment paths. Skipping commit/push.' -ForegroundColor Yellow
    } else {
        $commitCommand = 'git commit -m "' + $CommitMessage.Replace('"', '\"') + '"'
        Invoke-Step -Title 'Create deployment commit' -Command $commitCommand
        $branch = (& git branch --show-current).Trim()
        if ([string]::IsNullOrWhiteSpace($branch)) {
            throw 'Unable to determine current git branch for push.'
        }
        Invoke-Step -Title "Push commit to origin/$branch" -Command "git push origin $branch"
    }
}

if (-not $SkipDeploy) {
    Invoke-Step -Title 'Deploy to Cloudflare Pages' -Command 'Push-Location "coming-soon"; npm run deploy; Pop-Location'
}

Write-Host "`ncoming-soon deployment workflow completed." -ForegroundColor Green