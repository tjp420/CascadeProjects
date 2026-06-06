# SimpleBeacon Pre-Commit Hook (PowerShell)
# Place this in .git/hooks/pre-commit.ps1 to run gate scan before each commit

Write-Host "[SimpleBeacon] Running pre-commit gate scan..." -ForegroundColor Cyan

# Run gate scan (fails if blocking issues found)
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
