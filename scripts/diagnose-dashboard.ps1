param()
# Use a non-conflicting function name; 'h' is a built-in alias for Get-History
function Write-Header { param($t) "`n==== $t ===="; }
Write-Host (Write-Header "Environment") -ForegroundColor Cyan
Write-Host "PORT=$env:PORT  NODE_ENV=$env:NODE_ENV"

Write-Host (Write-Header "Netstat (listening for :54800)") -ForegroundColor Cyan
netstat -ano | Select-String ":54800" | ForEach-Object { $_.ToString() }

Write-Host (Write-Header "Get-NetTCPConnection -LocalPort 54800") -ForegroundColor Cyan
try { Get-NetTCPConnection -LocalPort 54800 -ErrorAction Stop | Format-Table -AutoSize } catch { Write-Host "No NetTCPConnection entry" }

Write-Host (Write-Header "Test-NetConnection 127.0.0.1:54800") -ForegroundColor Cyan
try { Test-NetConnection -ComputerName 127.0.0.1 -Port 54800 -InformationLevel Detailed } catch { Write-Host "Test-NetConnection failed" }

$tcp = $null
try { $tcp = Get-NetTCPConnection -LocalPort 54800 -ErrorAction SilentlyContinue } catch {}
if ($tcp) {
  $pid = $tcp.OwningProcess
  Write-Host (Write-Header "Process owning port 54800 (PID $pid)") -ForegroundColor Cyan
  try { Get-Process -Id $pid | Format-List * } catch { Write-Host "Get-Process failed for PID $pid" }
  Write-Host (H "tasklist for PID $pid") -ForegroundColor Cyan
  tasklist /FI "PID eq $pid"
} else {
  Write-Host (Write-Header "No process found for port 54800") -ForegroundColor Yellow
}

Write-Host (Write-Header "HTTP fetch /analyze") -ForegroundColor Cyan
try {
  $url = 'http://127.0.0.1:54800/simplebeacon-dashboard/#/analyze'
  $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
  Write-Host "StatusCode: $($resp.StatusCode)"
  $body = $resp.Content
  Write-Host "Body length: $($body.Length)"
  $snippet = $body.Substring(0,[Math]::Min(800,$body.Length))
  Write-Host "Body snippet:`n$snippet"
} catch {
  Write-Host "HTTP request failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host (Write-Header "Firewall rules mentioning 54800") -ForegroundColor Cyan
try { netsh advfirewall firewall show rule name=all | Select-String "54800" | ForEach-Object { $_.ToString() } } catch { Write-Host "netsh query failed" }

Write-Host (Write-Header "Hosts file excerpt (127.0.0.1 / localhost)") -ForegroundColor Cyan
try { Get-Content "$env:windir\System32\drivers\etc\hosts" | Select-String "127.0.0.1|localhost" -SimpleMatch } catch { Write-Host "Cannot read hosts file (permissions?)" }

Write-Host (Write-Header "WSL status (if installed)") -ForegroundColor Cyan
try {
  wsl -l -v 2>$null | Out-String | Write-Host
  $wip = wsl hostname -I 2>$null
  if ($wip) { Write-Host "WSL IP(s): $wip" }
} catch {}

Write-Host (Write-Header "Summary / Guidance") -ForegroundColor Cyan
Write-Host "If port 54800 is LISTENING, note the PID and verify process logs. If not listening, start the server and watch the terminal for bind errors. Run this script as Administrator for full firewall info."
