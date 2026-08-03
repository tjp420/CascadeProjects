$repo = 'tjp420/CascadeProjects'
$branch = 'feat/proof-tamper-audit-suppression'
$max = 60
$i = 0
while ($i -lt $max) {
  $i++
  $runs = gh run list --repo $repo --branch $branch --limit 100 --json databaseId,workflowName,status,conclusion,url,event 2>$null
  if (-not $runs) { Write-Output "no runs found (attempt $i), sleeping..."; Start-Sleep -Seconds 5; continue }
  $json = "[" + ($runs -join ',') + "]"
  $objs = ConvertFrom-Json $json
  $inprog = $objs | Where-Object { $_.status -ne 'completed' }
  if ($inprog.Count -eq 0) {
    Write-Output 'All runs completed:' 
    $objs | ForEach-Object { $c = $_.conclusion; if ($c -eq $null) { $c = '' }; Write-Output ($_.workflow + ' | status=' + $_.status + ' conclusion=' + $c + ' url=' + $_.url) }
    exit 0
  } else {
    Write-Output ("iteration " + $i + ": " + ($inprog.Count) + " runs in progress")
    $inprog | ForEach-Object { $c = $_.conclusion; if ($c -eq $null) { $c = '' }; Write-Output ("  " + $_.workflow + ' | status=' + $_.status + ' conclusion=' + $c + ' url=' + $_.url) }
    Start-Sleep -Seconds 10
  }
}
Write-Output 'timeout waiting for CI runs to finish'
exit 2
