# SimpleBeacon Workspace Sanitizer for coming-soon project (PowerShell)
Write-Host "[SimpleBeacon] Purging workspace debris for coming-soon project..." -ForegroundColor Cyan

# 1. Clear out local extension testing artifacts and tmp tracks safely
if (Test-Path -Path ".\.vscode-test" -PathType Container) {
    Write-Host "Wiping temporary VS Code extension build artifacts: .\.vscode-test"
    Remove-Item -Recurse -Force ".\.vscode-test"
}

# Locate and flush out stray runtime temporary files from the active path root
Get-ChildItem -Path "." -Filter "tmp-*.js" -Recurse -File -Depth 1 | ForEach-Object {
    Write-Host "Removing temporary file: $($_.FullName)"
    Remove-Item -Force $_.FullName
}

# 2. Append immutable Git filters to local mapping layers
Write-Host "Updating .gitignore policies..." -ForegroundColor Cyan
$gitignoreAdditions = @"

# SimpleBeacon Local Workspace Guards
.simplebeacon/
.vscode-test/
tmp-*.js
*.log
"@
Add-Content -Path ".gitignore" -Value $gitignoreAdditions -Encoding UTF8

# 3. Fire the schema recalculation engine across the active download file path
$REAL_REPORT = "c:/Users/Trevor/.windsurf-next/extensions/simplebeacon.simplebeacon-3.0.309/downloads/1782588232913-report.json"
if (Test-Path -Path $REAL_REPORT -PathType Leaf) {
    $outputPath = "$REAL_REPORT-filtered.json"
    node -e "require('./FilterAndRecalculate.js').filterAndRecalculate('$REAL_REPORT', '$outputPath')"
} else {
    Write-Host "⚠️ Targeted download report file not found on disk. Re-check file path." -ForegroundColor Yellow
}

Write-Host "✔ Workspace stabilization complete." -ForegroundColor Green
