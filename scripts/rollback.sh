#!/bin/bash
# Rollback Script for AI Coding Intelligence Dashboard
# This script rolls back to the previous deployment version

set -e

# Configuration
ENVIRONMENT=${1:-production}
PROJECT_ROOT="$(cd "$(dirname "$0")/..")"
WEB_DIR="$PROJECT_ROOT/web"
BACKUP_DIR="$PROJECT_ROOT/backups"
LOG_FILE="$PROJECT_ROOT/deploy.log"
MAX_BACKUPS=5

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

# Create backup before rollback
create_backup() {
    log "ROLLBACK" "Creating backup before rollback..."
    
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    CURRENT_BACKUP_DIR="$BACKUP_DIR/$BACKUP_NAME"
    
    mkdir -p "$CURRENT_BACKUP_DIR"
    
    # Backup current build
    if [ -d "$WEB_DIR/dist" ]; then
        cp -r "$WEB_DIR/dist" "$CURRENT_BACKUP_DIR/"
        log "ROLLBACK" "Current build backed up to $CURRENT_BACKUP_DIR"
    fi
    
    # Backup configuration
    if [ -f "$PROJECT_ROOT/config/.env.$ENVIRONMENT" ]; then
        cp "$PROJECT_ROOT/config/.env.$ENVIRONMENT" "$CURRENT_BACKUP_DIR/"
        log "ROLLBACK" "Configuration backed up to $CURRENT_BACKUP_DIR"
    fi
    
    success "Backup created: $BACKUP_NAME"
}

# List available backups
list_backups() {
    log "ROLLBACK" "Listing available backups..."
    
    if [ ! -d "$BACKUP_DIR" ]; then
        error_exit "No backup directory found"
    fi
    
    echo "Available backups:"
    ls -la "$BACKUP_DIR" | grep "^d" | tail -n $MAX_BACKUPS | awk '{print $NF}' | nl -n
}

# Rollback to previous version
rollback_to_previous() {
    log "ROLLBACK" "Starting rollback to previous version..."
    
    # Get the most recent backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR" | grep "^backup-" | head -n 1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        error_exit "No backup found for rollback"
    fi
    
    LATEST_BACKUP_DIR="$BACKUP_DIR/$LATEST_BACKUP"
    
    log "ROLLBACK" "Rolling back to backup: $LATEST_BACKUP"
    
    # Restore build
    if [ -d "$LATEST_BACKUP_DIR/dist" ]; then
        rm -rf "$WEB_DIR/dist"
        cp -r "$LATEST_BACKUP_DIR/dist" "$WEB_DIR/"
        log "ROLLBACK" "Build restored from $LATEST_BACKUP"
    fi
    
    # Restore configuration
    if [ -f "$LATEST_BACKUP_DIR/.env.$ENVIRONMENT" ]; then
        cp "$LATEST_BACKUP_DIR/.env.$ENVIRONMENT" "$PROJECT_ROOT/config/"
        log "ROLLBACK" "Configuration restored from $LATEST_BACKUP"
    fi
    
    success "Rollback completed to $LATEST_BACKUP"
}

# Rollback to specific backup
rollback_to_specific() {
    local backup_name=$1
    
    if [ -z "$backup_name" ]; then
        error_exit "Backup name required for specific rollback"
    fi
    
    local backup_dir="$BACKUP_DIR/$backup_name"
    
    if [ ! -d "$backup_dir" ]; then
        error_exit "Backup not found: $backup_name"
    fi
    
    log "ROLLBACK" "Rolling back to backup: $backup_name"
    
    # Restore build
    if [ -d "$backup_dir/dist" ]; then
        rm -rf "$WEB_DIR/dist"
        cp -r "$backup_dir/dist" "$WEB_DIR/"
        log "ROLLBACK" "Build restored from $backup_name"
    fi
    
    # Restore configuration
    if [ -f "$backup_dir/.env.$ENVIRONMENT" ]; then
        cp "$backup_dir/.env.$ENVIRONMENT" "$PROJECT_ROOT/config/"
        log "ROLLBACK" "Configuration restored from $backup_name"
    fi
    
    success "Rollback completed to $backup_name"
}

# Clean old backups
clean_old_backups() {
    log "ROLLBACK" "Cleaning old backups (keeping last $MAX_BACKUPS)..."
    
    cd "$BACKUP_DIR"
    BACKUP_COUNT=$(ls -1d backup-* 2>/dev/null | wc -l)
    
    if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
        OLD_BACKUPS=$(ls -1d backup-* 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)))
        for backup in $OLD_BACKUPS; do
            rm -rf "$backup"
            log "ROLLBACK" "Removed old backup: $backup"
        done
    fi
    
    success "Old backups cleaned up"
}

# Health check after rollback
health_check_after_rollback() {
    log "ROLLBACK" "Performing health check after rollback..."
    
    # Check API health
    if curl -f http://localhost:8081/api/health > /dev/null 2>&1; then
        log "ROLLBACK" "API health check passed"
    else
        log "ROLLBACK" "API health check failed"
    fi
    
    # Check frontend accessibility
    if curl -f http://localhost:57220 > /dev/null 2>&1; then
        log "ROLLBACK" "Frontend is accessible"
    else
        log "ROLLBACK" "Frontend not accessible"
    fi
    
    success "Post-rollback health checks completed"
}

# Notify team about rollback
notify_team_rollback() {
    log "ROLLBACK" "Notifying team about rollback to $ENVIRONMENT"
    
    echo "🔄 Rollback completed for $ENVIRONMENT"
    echo "📊 Check dashboard at: http://localhost:57220/dashboard_direct.html"
    echo "⚠️ Please verify all functionality is working correctly"
    
    # Add Slack/Email notification logic here if needed
    # curl -X POST -H 'Content-type: application/json' \
    #     --data '{"text":"🔄 Rollback completed", "environment":"'$ENVIRONMENT'"}' \
    #     https://hooks.slack.com/services/YOUR_WEBHOOK_URL
}

# Main rollback logic
main() {
    log "ROLLBACK" "Starting rollback process for $ENVIRONMENT..."
    
    create_backup
    rollback_to_previous
    clean_old_backups
    health_check_after_rollback
    notify_team_rollback
    
    success "Rollback process completed for $ENVIRONMENT"
}

# Handle script arguments
case "${1:-help}" in
    "help")
        echo "Usage: $0 [environment] [backup_name]"
        echo "Environments: development, staging, production"
        echo ""
        echo "Commands:"
        echo "  list            - List available backups"
        echo "  previous        - Rollback to previous version"
        echo "  specific <name>  - Rollback to specific backup"
        echo "  clean           - Clean old backups"
        echo "  health-check    - Perform health check after rollback"
        ;;
    "list")
        list_backups
        ;;
    "previous")
        create_backup
        rollback_to_previous
        ;;
    "specific")
        create_backup
        rollback_to_specific "$2"
        ;;
    "clean")
        clean_old_backups
        ;;
    "health-check")
        health_check_after_rollback
        ;;
    *)
        main
        ;;
esac
