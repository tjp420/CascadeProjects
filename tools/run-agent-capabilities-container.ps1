param(
  [string]$ImageName = 'simplebeacon-agent-capabilities',
  [string]$ContainerName = 'agent-capabilities',
  [int]$HostPort = 3007,
  [int]$ContainerPort = 3007,
  [string]$Token = 'supersecret',
  [string]$CertDir = "$PSScriptRoot\..\certs"
)

$certDirFull = Resolve-Path -Path $CertDir
Write-Host "Using cert dir: $certDirFull"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker not found. Please install/start Docker and re-run."
  exit 2
}

Write-Host "Building Docker image $ImageName..."
docker build -f tools/Dockerfile.agent-capabilities -t $ImageName .

if (-not (Test-Path (Join-Path $certDirFull 'cert.pem')) -or -not (Test-Path (Join-Path $certDirFull 'key.pem'))) {
  Write-Host "Generating self-signed certs into $certDirFull using temporary OpenSSL container..."
  docker run --rm -v "$($certDirFull):/out" frapsoft/openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /out/key.pem -out /out/cert.pem -subj "/CN=localhost"
}

Write-Host "Removing existing container (if any)..."
docker rm -f $ContainerName 2>$null | Out-Null

Write-Host "Starting container $ContainerName..."
docker run -d --name $ContainerName -p $HostPort`:$ContainerPort `
  -v "$($certDirFull):/etc/simplebeacon/tls:ro" `
  -e AGENT_CAPABILITIES_PORT=$ContainerPort `
  -e METRICS_AUTH_TOKEN=$Token `
  -e AGENT_CAPABILITIES_TLS_CERT=/etc/simplebeacon/tls/cert.pem `
  -e AGENT_CAPABILITIES_TLS_KEY=/etc/simplebeacon/tls/key.pem `
  $ImageName

Write-Host "Waiting for HTTPS metrics endpoint to become healthy (https://localhost:$HostPort/metrics)..."
# Exponential backoff readiness check
$max = [int](${env:MAX_ATTEMPTS} -or 8)
$attempt = 0
$delay = 1
while ($attempt -lt $max) {
  try {
    $resp = Invoke-WebRequest -Uri "https://localhost:$HostPort/metrics" -Method Head -Headers @{ Authorization = "Bearer $Token" } -UseBasicParsing -SkipCertificateCheck -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
      Write-Host "Endpoint is healthy."
      Write-Host "Query: curl -k -H \"Authorization: Bearer $Token\" https://localhost:$HostPort/metrics?format=prometheus"
      exit 0
    }
  } catch { }
  Write-Host "Attempt $($attempt+1)/$max: endpoint not ready. Retrying in ${delay}s..."
  Start-Sleep -Seconds $delay
  $attempt++
  $delay = [Math]::Min($delay * 2, 30)
}

Write-Error "Timed out waiting for healthy endpoint after $max attempts. See container logs:"
docker logs -n 200 $ContainerName
exit 3
