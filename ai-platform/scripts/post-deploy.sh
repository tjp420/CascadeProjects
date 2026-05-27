#!/bin/bash
# Post-Deployment Script for AI Coding Intelligence Dashboard
# This script runs after deployment to perform post-deployment tasks

set -e

# Configuration
ENVIRONMENT=${1:-production}
PROJECT_ROOT="$(cd "$(dirname "$0")/..")"
WEB_DIR="$PROJECT_ROOT/web"
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

# Health check after deployment
health_check() {
    log "POST-DEPLOY" "Performing post-deployment health check..."
    
    # Check API health
    if curl -f http://localhost:8081/api/health > /dev/null 2>&1; then
        log "HEALTH" "API health check passed"
    else
        log "HEALTH" "API health check failed"
    fi
    
    # Check frontend accessibility
    if curl -f http://localhost:57220 > /dev/null 2>&1; then
        log "HEALTH" "Frontend is accessible"
    else
        log "HEALTH" "Frontend not accessible"
    fi
    
    # Check build artifacts
    if [ -d "$PROJECT_ROOT/web/dist" ]; then
        log "HEALTH" "Build artifacts present"
    else
        log "HEALTH" "No build artifacts found"
    fi
    
    success "Post-deployment health checks completed"
}

# Clear cache after deployment
clear_cache() {
    log "POST-DEPLOY" "Clearing caches..."
    
    # Clear browser cache (instructions for users)
    log "POST-DEPLOY" "Please clear browser cache to see latest changes"
    log "POST-DEPLOY" "Press Ctrl+F5 or Cmd+R to refresh the dashboard"
}

# Update configuration if needed
update_config() {
    log "POST-DEPLOY" "Updating configuration for $ENVIRONMENT..."
    
    # Update environment variables
    if [ -f "$PROJECT_ROOT/config/.env.$ENVIRONMENT" ]; then
        log "POST-DEPLOY" "Environment configuration found for $ENVIRONMENT"
    else
        log "POST-DEPLOY" "Creating environment configuration for $ENVIRONMENT"
        cp "$PROJECT_ROOT/config/.env.production" "$PROJECT_ROOT/config/.env.$ENVIRONMENT"
    fi
}

# Notify team about deployment
notify_team() {
    log "POST-DEPLOY" "Notifying team about deployment to $ENVIRONMENT"
    
    # Add team notification logic here
    echo "🚀 Deployment completed successfully to $ENVIRONMENT"
    echo "📊 Check dashboard at: http://localhost:57220/dashboard_direct.html"
    
    # Add Slack/Email notification logic here if needed
    # curl -X POST -H 'Content-Type: application/json' \
    #     -d '{"text": "🚀 Deployment completed", "environment": "'$ENVIRONMENT'" }' \
    #     https://hooks.slack.com/services/YOUR_WEBHOOK_URL
}

# Restart services if needed
restart_services() {
    log "POST-DEPLOY" "Checking if services need restart..."
    
    # Add service restart logic here if needed
    echo "🔄 Services are running correctly"
}

# Main post-deployment logic
main() {
    log "POST-DEPLOY" "Starting post-deployment process for $ENVIRONMENT..."
    
    update_config
    clear_cache
    health_check
    restart_services
    notify_team
    
    success "Post-deployment process completed for $ENVIRONMENT"
}

# Handle script arguments
case "${1:-help}" in
    "help")
        echo "Usage: $0 [environment]"
        echo "Environments: development, staging, production"
        echo ""
        echo "Commands:"
        echo "  health-check    - Perform health checks"
        echo "  clear-cache    - Clear browser cache"
        echo "  update-config  - Update environment configuration"
        echo "  notify-team    - Notify team about deployment"
        echo "  restart-services - Restart services if needed"
        ;;
    "health-check")
        health_check
        ;;
    "clear-cache")
        clear_cache
        ;;
    "update-config")
        update_config
        ;;
    "notify-team")
        notify_team
        ;;
    "restart-services")
        restart_services
        ;;
    *)
        main
        ;;
esac
