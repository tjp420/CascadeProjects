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
