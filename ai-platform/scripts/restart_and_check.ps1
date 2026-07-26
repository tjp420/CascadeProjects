# restart_and_check.ps1
# Robust restart & probe for simplebeacon server

Write-Output "Stopping existing background job and node processes..."
Get-Job -Name simplebeacon-server -State Running -ErrorAction SilentlyContinue | ForEach-Object { Stop-Job -Id $_.Id -Force -ErrorAction SilentlyContinue }
Get-Job -Name simplebeacon-server -ErrorAction SilentlyContinue | ForEach-Object { Remove-Job -Id $_.Id -Force -ErrorAction SilentlyContinue }
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }

Set-Location 'C:\Users\Trevor\CascadeProjects\ai-platform'
$env:NODE_ENV='development'
$env:ENABLE_EXTERNAL_APIS='true'
$env:SIMPLEBEACON_DEV_STUBS='true'

if (Test-Path server-startup-output.txt) { Remove-Item server-startup-output.txt -ErrorAction SilentlyContinue }

Write-Output "Starting server as background job 'simplebeacon-server'..."
$script = {
  Set-Location 'C:\\Users\\Trevor\\CascadeProjects\\ai-platform'
  $env:NODE_ENV='development'
  $env:ENABLE_EXTERNAL_APIS='true'
  $env:SIMPLEBEACON_DEV_STUBS='true'
  node server/index.cjs *>&1 | Out-File -FilePath server-startup-output.txt -Encoding utf8 -Append
}
Start-Job -Name simplebeacon-server -ScriptBlock $script | Out-Null

Write-Output "Waiting for server to become responsive (up to 30s)..."
$base = 'http://127.0.0.1:58000'
$ready = $false
for ($i=0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = curl.exe -sS ($base + '/api/quality/overview') 2>$null
    if ($r -and $r.Trim().Length -gt 0) { $ready = $true; break }
  } catch {}
}

Write-Output "--- /api/quality/overview ---"
try { curl.exe -sS ($base + '/api/quality/overview') | python -m json.tool } catch { curl.exe -sS ($base + '/api/quality/overview') }
Write-Output "--- /api/simplebeacon/report ---"
try { curl.exe -sS ($base + '/api/simplebeacon/report') | python -m json.tool } catch { curl.exe -sS ($base + '/api/simplebeacon/report') }

Write-Output "--- server-startup-output tail ---"
Get-Content server-startup-output.txt -Tail 200 -ErrorAction SilentlyContinue
