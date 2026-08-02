Set-Location 'C:\Users\user\CascadeProjects'
$matches = git grep -n -E 'TODO|FIXME' -- . --exclude-dir=node_modules --exclude-dir=.simplebeacon --exclude-dir=generated --exclude-dir=dist --exclude-dir=public --exclude-dir=assets 2>$null
if (-not $matches) { Write-Output "TotalMatches: 0"; exit 0 }
$tot = ($matches | Measure-Object -Line).Lines
Write-Output "TotalMatches: $tot"
$files = @()
foreach ($m in $matches) {
  $parts = $m -split ':'
  if ($parts.Length -ge 1) { $files += $parts[0] }
}
$files | Group-Object | Sort-Object Count -Descending | Select-Object -First 20 | ForEach-Object { "{0} {1}" -f $_.Count, $_.Name }
