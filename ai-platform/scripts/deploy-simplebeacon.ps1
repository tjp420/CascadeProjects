#Requires -Version 5.1
<#
.SYNOPSIS
    Simplebeacon Production Deployment Script
.DESCRIPTION
    Handles deployment to production environment with verification gates.
.NOTES
    Run from the project root directory.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

Write-Host "🚀 Starting Simplebeacon production deployment..." -ForegroundColor Cyan

# Verify environment
Write-Host "📋 Checking environment..." -ForegroundColor Yellow
if (-not (Test-Path '.env.production')) {
    Write-Host "❌ .env.production not found. Please configure production environment variables." -ForegroundColor Red
    exit 1
}

# Deploy Gate 1: Verify production deploy readiness
Write-Host "🛡️ Running deploy gate: production readiness verification..." -ForegroundColor Magenta
npm run verify:production-deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deploy gate failed: production readiness checks did not pass." -ForegroundColor Red
    Write-Host "   Fix the issues above before deploying." -ForegroundColor Red
    exit 1
}

# Deploy Gate 2: Verify v1-internal profile
Write-Host "🛡️ Running deploy gate: v1-internal profile verification..." -ForegroundColor Magenta
npm run verify:v1-internal-profile
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deploy gate failed: v1-internal profile checks did not pass." -ForegroundColor Red
    Write-Host "   Fix the issues above before deploying." -ForegroundColor Red
    exit 1
}

# Deploy Gate 3: Run smoke tests
Write-Host "🛡️ Running deploy gate: smoke tests..." -ForegroundColor Magenta
npm run smoke:test:production
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Smoke tests had warnings. Review before continuing." -ForegroundColor Yellow
    $confirm = Read-Host "Continue deploy despite smoke test warnings? (y/N)"
    if ($confirm -notin @('y', 'Y')) {
        Write-Host "❌ Deploy aborted." -ForegroundColor Red
        exit 1
    }
}

# Verify Docker Compose
Write-Host "🐳 Checking Docker Compose configuration..." -ForegroundColor Yellow
docker compose -f docker-compose.phase2.yml config > $null
Write-Host "✅ Docker Compose configuration valid" -ForegroundColor Green

# Build and start services
Write-Host "🔨 Building and starting services..." -ForegroundColor Yellow
docker compose -f docker-compose.phase2.yml up -d

# Wait for services to be ready
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Health checks
Write-Host "🏥 Running health checks..." -ForegroundColor Yellow
try {
    docker exec simplebeacon-postgres pg_isready -U simplebeacon_user > $null 2>&1
    Write-Host "✅ PostgreSQL ready" -ForegroundColor Green
} catch {
    Write-Host "⚠️ PostgreSQL may need more time" -ForegroundColor Yellow
}

try {
    docker exec simplebeacon-redis redis-cli ping > $null 2>&1
    Write-Host "✅ Redis ready" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Redis may need more time" -ForegroundColor Yellow
}

# Start application
Write-Host "🚀 Starting application..." -ForegroundColor Cyan
npm run start

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "🌐 Application should be available at: https://simplebeacon.ai" -ForegroundColor Cyan
