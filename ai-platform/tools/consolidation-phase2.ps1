# Phase 2 cleanup — src/web mirror + status markdown
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (Test-Path 'src\web') {
    Remove-Item -Recurse -Force 'src\web'
    Write-Host 'Removed src/web'
}

$removed = 0
$patterns = @('*_COMPLETE.md', '*_REPORT.md', 'GGUF*.md', '*_MIGRATION_COMPLETE.md', '*_INTEGRATION_COMPLETE.md')
foreach ($dir in @($root, (Join-Path $root 'docs'), (Join-Path $root 'docs\reports'))) {
    if (-not (Test-Path $dir)) { continue }
    foreach ($pattern in $patterns) {
        Get-ChildItem -Path $dir -Filter $pattern -File -ErrorAction SilentlyContinue | ForEach-Object {
            Remove-Item -Force $_.FullName
            $removed++
        }
    }
}
Write-Host "Removed $removed Cascade status markdown files"
