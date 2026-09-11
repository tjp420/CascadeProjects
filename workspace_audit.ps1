$root='C:\Users\user\CascadeProjects'
Write-Host "=== Precise Workspace File Audit ===`n"
Write-Host "Counting files (this may take a moment)...`n"
$total = (Get-ChildItem -Path $root -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "TotalFiles:$total`n"
Write-Host "Top-level directories by file count:`n"
$top = Get-ChildItem -Path $root -Directory -Force | ForEach-Object {
    $count = (Get-ChildItem -Path $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object).Count
    [PSCustomObject]@{Name=$_.Name; Count=$count}
}
$top | Sort-Object -Property Count -Descending | Select-Object -First 30 | ForEach-Object { Write-Host ("{0,8}  {1}" -f $_.Count, $_.Name) }
