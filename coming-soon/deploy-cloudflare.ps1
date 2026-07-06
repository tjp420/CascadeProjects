# Deploy SimpleBeacon marketing site to Cloudflare Pages
# Prerequisites: install Wrangler and run `wrangler login` once
# Usage: .\deploy-cloudflare.ps1

param(
  [string]$ProjectName = "simplebeacon",
  [string]$Branch = "main",
  [string]$Directory = "public"
)

$ErrorActionPreference = "Stop"

$wrangler = Get-Command wrangler -ErrorAction SilentlyContinue
if (-not $wrangler) {
  Write-Host "Wrangler not found. Install with: npm install -g wrangler" -ForegroundColor Red
  exit 1
}

Write-Host "Deploying SimpleBeacon site from ./$Directory to Cloudflare Pages..." -ForegroundColor Cyan

# Direct upload (good for first deploy)
wrangler pages deploy $Directory --project-name=$ProjectName --branch=$Branch

Write-Host "Done. If this is a new project, add your custom domain in the Cloudflare Pages dashboard." -ForegroundColor Green
