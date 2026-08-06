param(
  [string]$AlertmanagerUrl = "http://localhost:9093",
  [string]$Instance = "local-test",
  [string]$AlertName = "SimpleBeaconTestAlert",
  [string]$Severity = "critical"
)

$alertObj = @{
  labels = @{
    alertname = $AlertName
    instance = $Instance
    severity = $Severity
    service = "simplebeacon-scan"
  }
  annotations = @{
    summary = "Test alert: SimpleBeacon resource pressure simulation"
    description = "This is a test alert generated to validate Alertmanager templates and routing."
    runbook = "https://example.com/runbooks/simplebeacon-scan-resource-guard"
  }
  startsAt = (Get-Date).ToString("o")
}

# Ensure the body is a JSON array of alerts as required by Alertmanager v2
$payload = "[" + (ConvertTo-Json $alertObj -Depth 6) + "]"

Write-Host "Posting test alert to $AlertmanagerUrl/api/v2/alerts"
$tmp = Join-Path $env:TEMP "simplebeacon_alert.json"
Set-Content -Path $tmp -Value $payload -Encoding UTF8

# Prefer curl.exe for raw binary POST to avoid PowerShell re-serialization differences
if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
  $curlArgs = @(
    '-sS',
    '-X', 'POST',
    "$AlertmanagerUrl/api/v2/alerts",
    '-H', 'Content-Type: application/json',
    '--data-binary', "@$tmp"
  )
  try {
    $out = & curl.exe @curlArgs 2>&1
    Write-Host "Response:`n$out"
  } catch {
    Write-Host "Failed to send test alert via curl: $_"
    exit 2
  }
} else {
  try {
    $resp = Invoke-RestMethod -Method Post -Uri "$AlertmanagerUrl/api/v2/alerts" -Body $payload -ContentType 'application/json'
    Write-Host "Response:`n" ($resp | ConvertTo-Json -Depth 4)
  } catch {
    Write-Host "Failed to send test alert via Invoke-RestMethod: $_"
    exit 2
  }
}
