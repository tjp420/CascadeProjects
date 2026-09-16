<#
Print-only git-filter-repo helper.

Does not rewrite this working tree. Does not push.
Inspect scripts/paths-to-remove.txt and scripts/replacements.txt first.
demo/demo-report.json must not appear in paths-to-remove.txt.

Usage (from repo root):
  .\scripts\rewrite-scan-artifact-history.ps1
#>

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ReplaceFile = Join-Path $PSScriptRoot "replacements.txt"
$PathsFile = Join-Path $PSScriptRoot "paths-to-remove.txt"

Write-Output "Repo root:        $RepoRoot"
Write-Output "paths-to-remove:  $PathsFile"
Write-Output "replacements:     $ReplaceFile"
Write-Output ""

if (-not (Test-Path $PathsFile)) {
    Write-Output "WARNING: $PathsFile is missing."
} else {
    $paths = Get-Content $PathsFile | Where-Object {
        $_.Trim() -ne "" -and -not $_.Trim().StartsWith("#")
    }
    Write-Output "Paths listed for invert-paths:"
    foreach ($p in $paths) {
        Write-Output "  $p"
        if ($p -match "demo-report\.json" -or $p -match "dashboard-report\.json") {
            throw "Refusing to print a rewrite that would drop the demo report fixture: $p"
        }
    }
}

if (-not (Test-Path $ReplaceFile)) {
    Write-Output "WARNING: $ReplaceFile is missing."
}

$cmd = @"
git filter-repo ``
  --invert-paths --paths-from-file `"$PathsFile`" ``
  --replace-text `"$ReplaceFile`"
"@

Write-Output ""
Write-Output "DRY-RUN COMMAND (review only; run on a verified mirror clone, never here):"
Write-Output $cmd
Write-Output ""
Write-Output "This script does not execute git-filter-repo. Follow scripts/rewrite-readme.md."
