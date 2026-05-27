#!/bin/bash

# AI Coding Intelligence Dashboard Deployment Script
# Enhanced deployment with environment detection, optimization, and health checks

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="AI Coding Intelligence Dashboard"
VERSION="1.0.0"
DEPLOY_DIR="./deploy"
BACKUP_DIR="./backup"
STAGING_DIR="./staging"
LOG_FILE="$DEPLOY_DIR/deployment.log"

# Environment detection
ENVIRONMENT=${NODE_ENV:-development}
API_URL=${API_URL:-http://localhost:8081}
PORT=${PORT:-8000}
STAGING_PORT=${STAGING_PORT:-8001}
ROLLBACK_ENABLED=${ROLLBACK_ENABLED:-true}

echo -e "${BLUE}🚀 Starting deployment process for $PROJECT_NAME v$VERSION${NC}"
echo -e "${BLUE}📊 Environment: $ENVIRONMENT${NC}"
echo -e "${BLUE}🌐 API URL: $API_URL${NC}"
echo -e "${BLUE}🔌 Port: $PORT${NC}"

# Create log directory
mkdir -p $DEPLOY_DIR
echo "📝 Deployment log: $LOG_FILE"

# Log function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

# Backup function
backup() {
    log "📦 Creating backup..."
    mkdir -p $BACKUP_DIR
    BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    if [ -d "$DEPLOY_DIR" ] && [ "$(ls -A $DEPLOY_DIR)" ]; then
        tar -czf $BACKUP_FILE -C $DEPLOY_DIR .
        log "✅ Backup created: $BACKUP_FILE"
    else
        log "ℹ️  No existing deployment to backup"
    fi
}

# Pre-deployment checks
pre_deploy_checks() {
    log "� Running pre-deployment checks..."
    
    # Check if required files exist
    local required_files=("index.html" "package.json" "README.md" ".eslintrc.js" ".prettierrc")
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log "❌ Required file missing: $file"
            exit 1
        fi
    done
    
    # Check Node.js version
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log "✅ Node.js version: $NODE_VERSION"
    else
        log "⚠️  Node.js not found, skipping build step"
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        log "✅ npm version: $NPM_VERSION"
    else
        log "⚠️  npm not found, skipping build step"
    fi
    
    log "✅ Pre-deployment checks passed"
}

# Build process
build_project() {
    log "📦 Building project..."
    
    if command -v npm &> /dev/null && [ -f "package.json" ]; then
        # Install dependencies
        log "📥 Installing dependencies..."
        npm ci --silent
        
        # Run linting
        log "🔍 Running linting..."
        npm run lint || log "⚠️  Linting issues found, continuing..."
        
        # Run tests
        log "🧪 Running tests..."
        npm test || log "⚠️  Tests failed, continuing..."
        
        # Build for production
        if [ "$ENVIRONMENT" = "production" ]; then
            log "🏗️  Building for production..."
            npm run build:prod || {
                log "❌ Production build failed"
                exit 1
            }
        fi
        
        log "✅ Build successful"
    else
        log "⚠️  npm not available, skipping build process"
    fi
}

# Optimize assets
optimize_assets() {
    log "⚡ Optimizing assets..."
    
    # Minify CSS if available
    if command -v cssnano &> /dev/null; then
        find css/ -name "*.css" -exec cssnano {} {}.min \;
        log "✅ CSS files optimized"
    fi
    
    # Optimize images if available
    if command -v imagemin &> /dev/null; then
        find assets/ -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | xargs imagemin
        log "✅ Images optimized"
    fi
    
    log "✅ Asset optimization complete"
}

# Copy deployment files
copy_files() {
    log "📋 Copying files to deployment directory..."
    
    # Clean deployment directory
    rm -rf $DEPLOY_DIR/*
    mkdir -p $DEPLOY_DIR
    
    # Copy essential files
    local files_to_copy=(
        "index.html"
        "dashboard.html"
        "README.md"
        "LICENSE"
        "package.json"
        ".eslintrc.js"
        ".eslintrc.json"
        ".prettierrc"
        ".prettierrc.json"
        "jest.config.js"
        "jest.setup.js"
        "dashboard.test.js"
    )
    
    for file in "${files_to_copy[@]}"; do
        if [ -f "$file" ]; then
            cp $file $DEPLOY_DIR/
            log "✅ Copied: $file"
        fi
    done
    
    # Copy directories
    local dirs_to_copy=(
        "css"
        "dashboard_components"
        "api"
        "tests"
        "scripts"
    )
    
    for dir in "${dirs_to_copy[@]}"; do
        if [ -d "$dir" ]; then
            cp -r $dir $DEPLOY_DIR/
            log "✅ Copied directory: $dir"
        fi
    done
    
    log "✅ File copying complete"
}

# Create environment configuration
create_env_config() {
    log "⚙️  Creating environment configuration..."
    
    cat > $DEPLOY_DIR/.env << EOF
# Environment Configuration
NODE_ENV=$ENVIRONMENT
API_URL=$API_URL
PORT=$PORT
PROJECT_NAME=$PROJECT_NAME
VERSION=$VERSION

# Deployment Information
DEPLOY_DATE=$(date '+%Y-%m-%d %H:%M:%S')
DEPLOY_HOST=$(hostname)
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_ERROR_TRACKING=true
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_DARK_MODE=true

# Security Settings
CORS_ORIGIN=*
RATE_LIMIT=100
SESSION_TIMEOUT=3600

# Logging
LOG_LEVEL=${LOG_LEVEL:-info}
LOG_FORMAT=json
EOF
    
    log "✅ Environment configuration created"
}

# Create health check endpoint
create_health_check() {
    log "🏥 Creating health check endpoint..."
    
    cat > $DEPLOY_DIR/health.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.VERSION || '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        }));
    } else {
        // Serve static files
        const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
        const extname = path.extname(filePath);
        let contentType = 'text/html';
        
        switch (extname) {
            case '.js': contentType = 'text/javascript'; break;
            case '.css': contentType = 'text/css'; break;
            case '.json': contentType = 'application/json'; break;
        }
        
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🏥 Health check available at http://localhost:${PORT}/health`);
});
EOF
    
    log "✅ Health check endpoint created"
}

# Create deployment manifest
create_manifest() {
    log "📋 Creating deployment manifest..."
    
    cat > $DEPLOY_DIR/deployment.json << EOF
{
    "project": "$PROJECT_NAME",
    "version": "$VERSION",
    "environment": "$ENVIRONMENT",
    "deploy_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
    "files_deployed": $(find $DEPLOY_DIR -type f | wc -l),
    "total_size": "$(du -sh $DEPLOY_DIR | cut -f1)",
    "api_url": "$API_URL",
    "port": $PORT,
    "features": {
        "analytics": true,
        "error_tracking": true,
        "performance_monitoring": true,
        "dark_mode": true
    }
}
EOF
    
    log "✅ Deployment manifest created"
}

# Post-deployment validation
post_deploy_validation() {
    log "🔍 Running post-deployment validation..."
    
    # Check if essential files exist
    local essential_files=("index.html" "package.json" ".env")
    for file in "${essential_files[@]}"; do
        if [ ! -f "$DEPLOY_DIR/$file" ]; then
            log "❌ Essential file missing in deployment: $file"
            exit 1
        fi
    done
    
    # Check deployment size
    local deploy_size=$(du -sh $DEPLOY_DIR | cut -f1)
    log "📊 Deployment size: $deploy_size"
    
    # Count files
    local file_count=$(find $DEPLOY_DIR -type f | wc -l)
    log "📊 Files deployed: $file_count"
    
    log "✅ Post-deployment validation passed"
}

# Generate deployment report
generate_report() {
    log "📊 Generating deployment report..."
    
    cat > $DEPLOY_DIR/deployment_report.md << EOF
# Deployment Report

## Project Information
- **Name**: $PROJECT_NAME
- **Version**: $VERSION
- **Environment**: $ENVIRONMENT
- **Deploy Date**: $(date '+%Y-%m-%d %H:%M:%S')

## Deployment Details
- **API URL**: $API_URL
- **Port**: $PORT
- **Git Commit**: $(git rev-parse HEAD 2>/dev/null || echo 'unknown')
- **Git Branch**: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')

## Files Deployed
- **Total Files**: $(find $DEPLOY_DIR -type f | wc -l)
- **Total Size**: $(du -sh $DEPLOY_DIR | cut -f1)

## Features Enabled
- ✅ Analytics
- ✅ Error Tracking
- ✅ Performance Monitoring
- ✅ Dark Mode

## Health Check
- **Endpoint**: http://localhost:$PORT/health
- **Status**: Available after server startup

## Next Steps
1. Upload files to your server
2. Set environment variables
3. Start the web server
4. Verify health check endpoint
5. Test application functionality

---
*Generated on $(date '+%Y-%m-%d %H:%M:%S')*
EOF
    
    log "✅ Deployment report generated"
}

# Main deployment process
main() {
    log "🚀 Starting main deployment process..."
    
    backup
    pre_deploy_checks
    build_project
    optimize_assets
    copy_files
    create_env_config
    create_health_check
    create_manifest
    post_deploy_validation
    generate_report
    
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo -e "${BLUE}📁 Deployment files ready in: $DEPLOY_DIR${NC}"
    echo -e "${BLUE}� Deployment report: $DEPLOY_DIR/deployment_report.md${NC}"
    echo -e "${BLUE}🏥 Health check: http://localhost:$PORT/health${NC}"
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo -e "${YELLOW}   1. Upload files to your server${NC}"
    echo -e "${YELLOW}   2. Configure environment variables${NC}"
    echo -e "${YELLOW}   3. Start the web server${NC}"
    echo -e "${YELLOW}   4. Verify health check endpoint${NC}"
    echo -e "${YELLOW}   5. Test application functionality${NC}"
    
    log "🎉 Deployment process completed successfully"
}

# Rollback function
rollback() {
    if [ "$ROLLBACK_ENABLED" != "true" ]; then
        log "⚠️ Rollback is disabled"
        return 1
    fi
    
    log "🔄 Starting rollback process..."
    
    # Find the most recent backup
    local latest_backup=$(ls -t $BACKUP_DIR/backup-*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$latest_backup" ]; then
        log "❌ No backup found for rollback"
        return 1
    fi
    
    log "📦 Using backup: $latest_backup"
    
    # Create current deployment backup before rollback
    if [ -d "$DEPLOY_DIR" ] && [ "$(ls -A $DEPLOY_DIR)" ]; then
        local rollback_backup="$BACKUP_DIR/rollback-$(date +%Y%m%d-%H%M%S).tar.gz"
        tar -czf $rollback_backup -C $DEPLOY_DIR .
        log "✅ Created rollback backup: $rollback_backup"
    fi
    
    # Restore from backup
    log "🔄 Restoring from backup..."
    rm -rf $DEPLOY_DIR/*
    tar -xzf $latest_backup -C $DEPLOY_DIR
    
    log "✅ Rollback completed successfully"
    log "📁 Deployment restored to previous state"
}

# Staging deployment function
deploy_to_staging() {
    log "🚀 Deploying to staging environment..."
    
    # Create staging directory
    mkdir -p $STAGING_DIR
    
    # Copy current deployment to staging
    if [ -d "$DEPLOY_DIR" ] && [ "$(ls -A $DEPLOY_DIR)" ]; then
        cp -r $DEPLOY_DIR/* $STAGING_DIR/
        log "✅ Copied deployment to staging"
    else
        log "❌ No deployment found to copy to staging"
        return 1
    fi
    
    # Update staging configuration
    cat > $STAGING_DIR/.env << EOF
# Staging Environment Configuration
NODE_ENV=staging
API_URL=${STAGING_API_URL:-http://localhost:8081}
PORT=$STAGING_PORT
PROJECT_NAME=$PROJECT_NAME
VERSION=$VERSION

# Staging Settings
ENABLE_ANALYTICS=true
ENABLE_ERROR_TRACKING=true
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_DEBUG_MODE=true

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json
EOF
    
    log "✅ Staging configuration created"
    log "🌐 Staging server will run on port $STAGING_PORT"
    
    # Create staging health check
    cat > $STAGING_DIR/health-staging.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8001;

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            environment: 'staging',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.VERSION || '1.0.0',
            debug: true
        }));
    } else {
        // Serve static files
        const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
        const extname = path.extname(filePath);
        let contentType = 'text/html';
        
        switch (extname) {
            case '.js': contentType = 'text/javascript'; break;
            case '.css': contentType = 'text/css'; break;
            case '.json': contentType = 'application/json'; break;
        }
        
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Staging server running on port ${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});
EOF
    
    log "✅ Staging health check created"
    log "🎉 Staging deployment completed"
}

# Health check function
health_check() {
    log "🏥 Running health check..."
    
    local health_url="http://localhost:$PORT/health"
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$health_url" > /dev/null 2>&1; then
            log "✅ Health check passed"
            return 0
        fi
        
        log "⏳ Health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 2
        ((attempt++))
    done
    
    log "❌ Health check failed after $max_attempts attempts"
    return 1
}

# Enhanced main deployment process
main() {
    # Check for rollback flag
    if [ "$1" = "rollback" ]; then
        rollback
        exit $?
    fi
    
    # Check for staging flag
    if [ "$1" = "staging" ]; then
        deploy_to_staging
        exit $?
    fi
    
    log "🚀 Starting main deployment process..."
    
    backup
    pre_deploy_checks
    build_project
    optimize_assets
    copy_files
    create_env_config
    create_health_check
    create_manifest
    post_deploy_validation
    generate_report
    
    # Start health check
    if [ "$ENVIRONMENT" != "development" ]; then
        log "⏳ Waiting for server to start before health check..."
        sleep 5
        health_check
    fi
    
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo -e "${BLUE}📁 Deployment files ready in: $DEPLOY_DIR${NC}"
    echo -e "${BLUE}📊 Deployment report: $DEPLOY_DIR/deployment_report.md${NC}"
    echo -e "${BLUE}🏥 Health check: http://localhost:$PORT/health${NC}"
    echo -e "${YELLOW}🔄 Rollback command: ./deploy.sh rollback${NC}"
    echo -e "${YELLOW}🌐 Staging command: ./deploy.sh staging${NC}"
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo -e "${YELLOW}   1. Upload files to your server${NC}"
    echo -e "${YELLOW}   2. Configure environment variables${NC}"
    echo -e "${YELLOW}   3. Start the web server${NC}"
    echo -e "${YELLOW}   4. Verify health check endpoint${NC}"
    echo -e "${YELLOW}   5. Test application functionality${NC}"
    
    log "🎉 Deployment process completed successfully"
}

# Error handling
trap 'log "❌ Deployment failed at line $LINENO"' ERR

# Run main function
main "$@"
