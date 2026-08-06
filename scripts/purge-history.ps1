# Purge-history: Automated Git history purge & remediation script
# Usage: .\purge-history.ps1 -RepoUrl 'https://github.com/your-org/your-repo.git' [-DryRun]
param (
    [switch]$DryRun = $true,
    [Parameter(Mandatory=$true)][string]$RepoUrl,
    [string]$WorkDir = "C:\Users\user\CascadeProjects"
)

$ErrorActionPreference = 'Stop'

Write-Output "🛡️ [SimpleBeacon] Starting Git history purge utility..."

# Default file paths to remove from history
$PathsToScrub = @(
    'cascade-integration/coming-soon/trello-board-ai_agent.json',
    'ai-platform/monitoring/prometheus-agentic-scrape.yml',
    'coming-soon/__audit-free-test.cjs'
)

$MirrorDir = Join-Path $WorkDir 'CascadeProjects-HistoryMirror.git'

# 1. Environment checks
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error '❌ Git CLI is not installed or missing from system PATH.'
}
if (-not (Get-Command pip -ErrorAction SilentlyContinue)) {
    Write-Warning '⚠️ pip CLI not found. git-filter-repo installation checks may fail.'
}

# 2. Prepare mirror
if (Test-Path $MirrorDir) {
    Write-Warning "🧹 Existing mirror found at $MirrorDir — removing it to ensure a fresh clone."
    Remove-Item $MirrorDir -Recurse -Force
}

New-Item -ItemType Directory -Path $WorkDir -ErrorAction SilentlyContinue | Out-Null
Set-Location $WorkDir

Write-Output "📥 Creating fresh local mirror clone from $RepoUrl into $MirrorDir..."
$mirrorName = Split-Path $MirrorDir -Leaf
git clone --mirror $RepoUrl $mirrorName
Set-Location (Join-Path $WorkDir $mirrorName)

# 3. Ensure git-filter-repo
$gfrAvailable = $false
try {
    if (Get-Command git-filter-repo -ErrorAction SilentlyContinue) { $gfrAvailable = $true }
    else {
        $pyCheck = & python -c "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('git_filter_repo') else 1)" 2>$null
        if ($LASTEXITCODE -eq 0) { $gfrAvailable = $true }
    }
} catch { $gfrAvailable = $false }

if (-not $gfrAvailable) {
    Write-Warning "⚠️ git-filter-repo not found. Attempting to install via pip --user."
    try { pip install --user git-filter-repo; $gfrAvailable = $true; Write-Output '✅ git-filter-repo installed.' } catch { Write-Error '❌ Could not install git-filter-repo automatically.' }
}

# 4. Build and run filter-repo
$FilterArgs = @('--invert-paths')
foreach ($p in $PathsToScrub) { $FilterArgs += '--path'; $FilterArgs += $p }

Write-Output "⚡ Rewriting Git DAG history (this may take some time)..."
if ($gfrAvailable) {
    try {
        if (Get-Command git-filter-repo -ErrorAction SilentlyContinue) { & git-filter-repo @FilterArgs }
        else { & git filter-repo @FilterArgs }
    } catch { Write-Error "❌ git-filter-repo execution failed: $_" }
} else { Write-Error '❌ Aborting: git-filter-repo not available.' }

# 5. Post-rewrite verification
Write-Output "`n📊 Running post-rewrite verification checks..."
$verificationPassed = $true
foreach ($p in $PathsToScrub) {
    $found = git log --all --pretty=format:'%H' --name-only | Select-String -Pattern ([Regex]::Escape($p)) -SimpleMatch
    if ($found) { Write-Warning "❌ CRITICAL: Path still found: $p"; $verificationPassed = $false } else { Write-Output "✅ Erased from history: $p" }
}

# Heuristic scan example
Write-Output "`n🔎 Running heuristic secret pattern scans..."
$awsFound = $false
try { git grep -I --line-number -e 'AKIA[0-9A-Z]\{16\}' || $null; if ($LASTEXITCODE -eq 0) { $awsFound = $true } } catch {}
if ($awsFound) { Write-Warning '❌ AWS-like keys found.'; $verificationPassed = $false } else { Write-Output '✅ AWS-like key scan: no findings.' }

# 6. Push gate
if ($DryRun) {
    Write-Warning "`n📢 DRY-RUN: skipping remote force-push. Review verification output."
    Write-Output "To push cleaned history: .\purge-history.ps1 -RepoUrl '$RepoUrl' -DryRun:$false"
} else {
    if (-not $verificationPassed) { Write-Error '❌ Verification failed: aborting force-push.' }
    Write-Output "`n🚀 Force-pushing sanitized history to origin..."
    git push origin --force --all
    git push origin --force --tags
    Write-Output '🎉 Cleaned history pushed.'
}

Write-Output "`n---`nSummary: VerificationPassed=$verificationPassed; DryRun=$DryRun"
