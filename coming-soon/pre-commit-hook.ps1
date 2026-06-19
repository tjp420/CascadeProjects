# SimpleBeacon Pre-Commit Hook (PowerShell)
# Place this in .git/hooks/pre-commit.ps1 to run gate scan before each commit

Write-Host "[SimpleBeacon] Running pre-commit checks..." -ForegroundColor Cyan

# 1. Syntax check staged JS/CJS files
$staged = git diff --cached --name-only --diff-filter=ACM | Where-Object { $_ -match '\.(js|cjs)$' }
$hasSyntaxError = $false
foreach ($f in $staged) {
    if (Test-Path $f) {
        node -c $f 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[SimpleBeacon] Syntax error in $f" -ForegroundColor Red
            $hasSyntaxError = $true
        }
    }
}
if ($hasSyntaxError) {
    Write-Host "[SimpleBeacon] Commit blocked — fix syntax errors first." -ForegroundColor Red
    exit 1
}

# 2. Run gate scan (fails if blocking issues found)
try {
    npx simplebeacon scan --gate --format json --output .simplebeacon/pre-commit-report.json
    $EXIT_CODE = $LASTEXITCODE
} catch {
    Write-Host "[SimpleBeacon] npx not found or scan failed — skipping" -ForegroundColor Yellow
    exit 0
}

if ($EXIT_CODE -ne 0) {
    Write-Host "[SimpleBeacon] GATE FAILED — commit blocked." -ForegroundColor Red
    Write-Host "[SimpleBeacon] Run 'npx simplebeacon scan --gate' for details." -ForegroundColor Red
    exit 1
}

Write-Host "[SimpleBeacon] Gate passed — commit allowed." -ForegroundColor Green
exit 0
