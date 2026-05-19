#!/bin/bash
# Deployment Script for AI Coding Intelligence Dashboard
# Usage: ./scripts/deploy.sh [environment]

set -e

# Configuration
ENVIRONMENT=${1:-production}
PROJECT_ROOT="$(cd "$(dirname "$0")/..")"
WEB_DIR="$PROJECT_ROOT/web"
BUILD_DIR="$WEB_DIR/dist"
LOG_FILE="$PROJECT_ROOT/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S' [$ENVIRONMENT] $1: $2" >> "$LOG_FILE"
    echo -e "${GREEN}[$ENVIRONMENT] $1: $2${NC}"
}

# Error handling
error_exit() {
    echo -e "${RED}ERROR: $1${NC}"
    log "ERROR" "$1"
    exit 1
}

# Success message
success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
    log "SUCCESS" "$1"
}

# Check if directories exist
check_directories() {
    if [ ! -d "$PROJECT_ROOT" ]; then
        error_exit "Project root directory not found: $PROJECT_ROOT"
    fi
    
    if [ ! -d "$WEB_DIR" ]; then
        error_exit "Web directory not found: $WEB_DIR"
    fi
}

# Build the application
build_application() {
    log "BUILD" "Starting build process..."
    
    cd "$WEB_DIR"
    
    # Install dependencies
    if [ ! -d "node_modules" ]; then
        log "BUILD" "Installing dependencies..."
        npm install
    fi
    
    # Run linting
    log "BUILD" "Running linting..."
    npm run lint || error_exit "Linting failed"
    
    # Run tests
    log "BUILD" "Running tests..."
    npm test || error_exit "Tests failed"
    
    # Build the application
    log "BUILD" "Building application..."
    npm run build || error_exit "Build failed"
    
    success "Build completed successfully"
}

# Deploy to specified environment
deploy_application() {
    log "DEPLOY" "Starting deployment to $ENVIRONMENT..."
    
    # Check if build directory exists
    if [ ! -d "$BUILD_DIR" ]; then
        error_exit "Build directory not found: $BUILD_DIR. Run build first."
    fi
    
    # Simulate deployment (add actual deployment logic here)
    log "DEPLOY" "Deploying files from $BUILD_DIR..."
    
    # Add actual deployment commands here
    # Example: rsync -avz "$BUILD_DIR/" user@server:/path/to/app
    # Example: scp -r "$BUILD_DIR/" user@server:/path/to/app
    
    success "Deployment to $ENVIRONMENT completed"
}

# Health check after deployment
health_check() {
    log "HEALTH" "Performing health check..."
    
    # Add health check logic here
    # Example: curl -f http://localhost:8081/api/health
    # Example: curl -f http://your-domain.com/api/health
    
    success "Health check passed"
}

# Rollback function
rollback() {
    log "ROLLBACK" "Starting rollback..."
    
    # Add rollback logic here
    # Example: git reset --hard HEAD~1
    # Example: restore from backup
    
    success "Rollback completed"
}

# Main deployment logic
main() {
    log "DEPLOYMENT" "Starting deployment process for $ENVIRONMENT"
    
    check_directories
    build_application
    deploy_application
    health_check
    
    log "DEPLOYMENT" "Deployment process completed successfully"
}

# Handle script arguments
case "${1:-help}" in
    "help")
        echo "Usage: $0 [environment]"
        echo "Environments: development, staging, production"
        echo ""
        echo "Commands:"
        echo "  build    - Build the application only"
        echo "  deploy   - Deploy the application (default: production)"
        echo "  rollback - Rollback to previous version"
        echo "  health   - Perform health check"
        ;;
    "build")
        check_directories
        build_application
        ;;
    "rollback")
        rollback
        ;;
    "health")
        health_check
        ;;
    *)
        main
        ;;
esac
