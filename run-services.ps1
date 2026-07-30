$ErrorActionPreference = 'Continue'
Set-Location 'C:\Users\Trevor\CascadeProjects\ai-platform'
Remove-Item 'server-startup-output.txt','server-startup-error.txt','proxy.log','proxy.err' -Force -ErrorAction SilentlyContinue
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
$env:NODE_ENV = 'development'
$env:ENABLE_EXTERNAL_APIS = 'true'
$env:SIMPLEBEACON_DEV_STUBS = 'true'
Start-Process -FilePath 'node' -ArgumentList 'server/index.cjs' -WorkingDirectory (Get-Location) -RedirectStandardOutput 'server-startup-output.txt' -RedirectStandardError 'server-startup-error.txt' -NoNewWindow | Out-Null
Set-Location 'C:\Users\Trevor\CascadeProjects'
$env:PROXY_DEBUG = '1'
$env:PORTS = '54358'
$env:TARGET = 'http://127.0.0.1:58000'
Start-Process -FilePath 'node' -ArgumentList 'ai-platform/scripts/proxy_local_bridge.cjs' -WorkingDirectory (Get-Location) -RedirectStandardOutput 'proxy.log' -RedirectStandardError 'proxy.err' -NoNewWindow | Out-Null
for ($i = 0; $i -lt 20; $i++) {
  try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:58000/api/simplebeacon/report' -TimeoutSec 5
    Write-Output ('STATUS=' + $response.StatusCode)
    $response.Content | python -m json.tool | Select-Object -First 120
    break
  } catch {
    Write-Output ('TRY ' + $i + ': ' + $_.Exception.Message)
  }
}
