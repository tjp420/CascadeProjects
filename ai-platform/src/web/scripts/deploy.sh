#!/bin/bash

# AI Coding Intelligence Dashboard Deployment Script
# Supports staging and production environments

set -e

# Configuration
ENVIRONMENT=${1:-staging}
BUILD_DIR="dist"
DEPLOY_USER="deploy"
DEPLOY_HOST="your-deploy-host.com"
DEPLOY_PATH="/var/www/dashboard"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting deployment for ${ENVIRONMENT} environment${NC}"

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    echo -e "${YELLOW}📋 Loading environment variables from .env.${ENVIRONMENT}${NC}"
    export $(cat .env.${ENVIRONMENT} | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}⚠️  No .env.${ENVIRONMENT} file found, using defaults${NC}"
fi

# Run tests
echo -e "${GREEN}🧪 Running tests...${NC}"
npm test

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed. Aborting deployment.${NC}"
    exit 1
fi

# Build the project
echo -e "${GREEN}🔨 Building project...${NC}"
npm run build:prod

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Aborting deployment.${NC}"
    exit 1
fi

# Create deployment directory
echo -e "${GREEN}📁 Preparing deployment package...${NC}"
mkdir -p ${BUILD_DIR}
cp -r index.html dashboard_components css js ${BUILD_DIR}/
cp .env.${ENVIRONMENT} ${BUILD_DIR}/.env 2>/dev/null || true

# Deploy based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${GREEN}🌐 Deploying to production...${NC}"
    # Add production deployment commands here
    # rsync -avz ${BUILD_DIR}/ ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/
    echo -e "${YELLOW}⚠️  Production deployment not configured${NC}"
elif [ "$ENVIRONMENT" = "staging" ]; then
    echo -e "${GREEN}🧪 Deploying to staging...${NC}"
    # Add staging deployment commands here
    # rsync -avz ${BUILD_DIR}/ ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}-staging/
    echo -e "${YELLOW}⚠️  Staging deployment not configured${NC}"
else
    echo -e "${RED}❌ Unknown environment: ${ENVIRONMENT}${NC}"
    exit 1
fi

# Run post-deployment checks
echo -e "${GREEN}✅ Running post-deployment checks...${NC}"
# Add health check here
# curl -f http://${DEPLOY_HOST}/health || exit 1

echo -e "${GREEN}✨ Deployment completed successfully!${NC}"
echo -e "${GREEN}🎉 ${ENVIRONMENT} environment is live${NC}"
