#!/bin/bash
# Simplebeacon Production Deployment Script
# This script handles deployment to production environment

set -e

echo "🚀 Starting Simplebeacon production deployment..."

# Verify environment
echo "📋 Checking environment..."
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production not found. Please configure production environment variables."
    exit 1
fi

# Deploy Gate 1: Verify production deploy readiness
echo "🛡️ Running deploy gate: production readiness verification..."
npm run verify:production-deploy || {
    echo "❌ Deploy gate failed: production readiness checks did not pass."
    echo "   Fix the issues above before deploying."
    exit 1
}

# Deploy Gate 2: Verify v1-internal profile
echo "🛡️ Running deploy gate: v1-internal profile verification..."
npm run verify:v1-internal-profile || {
    echo "❌ Deploy gate failed: v1-internal profile checks did not pass."
    echo "   Fix the issues above before deploying."
    exit 1
}

# Deploy Gate 3: Run smoke tests
echo "🛡️ Running deploy gate: smoke tests..."
npm run smoke:test:production || {
    echo "⚠️ Smoke tests had warnings. Review before continuing."
    read -p "Continue deploy despite smoke test warnings? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "❌ Deploy aborted."
        exit 1
    fi
}

# Verify Docker Compose
echo "🐳 Checking Docker Compose configuration..."
docker compose -f docker-compose.phase2.yml config > /dev/null
echo "✅ Docker Compose configuration valid"

# Build and start services
echo "🔨 Building and starting services..."
docker compose -f docker-compose.phase2.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Health checks
echo "🏥 Running health checks..."
docker exec simplebeacon-postgres pg_isready -U simplebeacon_user > /dev/null 2>&1 && echo "✅ PostgreSQL ready" || echo "⚠️ PostgreSQL may need more time"
docker exec simplebeacon-redis redis-cli ping > /dev/null 2>&1 && echo "✅ Redis ready" || echo "⚠️ Redis may need more time"

# Start application
echo "🚀 Starting application..."
npm run start

echo "✅ Deployment complete!"
echo "🌐 Application should be available at: https://simplebeacon.ai"
