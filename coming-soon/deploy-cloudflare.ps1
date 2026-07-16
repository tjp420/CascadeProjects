# Deploy SimpleBeacon marketing site to Cloudflare Pages
# Prerequisites: install Wrangler and run `wrangler login` once
# Usage: .\deploy-cloudflare.ps1

param(
  [string]$ProjectName = "simplebeacon",
  [string]$Branch = "main",
  [string]$Directory = "public"
)

$ErrorActionPreference = "Stop"

# Node 24 on Windows can hit ENOBUFS when opening many parallel HTTPS sockets (Happy Eyeballs).
# Prefer IPv4 first so fetch/wrangler can reach api.cloudflare.com reliably.
$env:NODE_OPTIONS = "--dns-result-order=ipv4first"

$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -ge 23) {
  Write-Host "Warning: Node $nodeMajor detected. If deploy still fails, install Node 20 LTS from https://nodejs.org/" -ForegroundColor Yellow
}

$wrangler = Get-Command npx -ErrorAction SilentlyContinue
if (-not $wrangler) {
  Write-Host "npx not found. Install Node.js from https://nodejs.org/" -ForegroundColor Red
  exit 1
}

Write-Host "Deploying SimpleBeacon site from ./$Directory to Cloudflare Pages..." -ForegroundColor Cyan
Write-Host "NODE_OPTIONS=$env:NODE_OPTIONS" -ForegroundColor DarkGray

$maxAttempts = 3
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  if ($attempt -gt 1) {
    Write-Host "Retry $attempt/$maxAttempts after fetch failure..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
  }
  try {
    npx wrangler pages deploy $Directory --project-name=$ProjectName --branch=$Branch --commit-dirty=true
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Done. If this is a new project, add your custom domain in the Cloudflare Pages dashboard." -ForegroundColor Green
      exit 0
    }
  } catch {
    Write-Host $_.Exception.Message -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Deploy failed after $maxAttempts attempts (Windows ENOBUFS / fetch failed)." -ForegroundColor Red
Write-Host "Try: close other apps, reboot, then run this script again." -ForegroundColor Yellow
Write-Host "Or upload manually: Cloudflare Dashboard -> Workers & Pages -> simplebeacon -> Create deployment -> Upload assets -> select the 'public' folder." -ForegroundColor Yellow
exit 1
