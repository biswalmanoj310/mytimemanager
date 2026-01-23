#!/bin/bash

# Database Sync Script
# Purpose: Copy database between environments for debugging
# Usage: ./sync_database.sh [pull|push|restore] [profile_name]

set -e  # Exit on error

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$HOME/mytimemanager_backups"
DB_PATH="$PROJECT_ROOT/backend/database/mytimemanager.db"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_usage() {
    echo "Usage: ./sync_database.sh [command] [profile]"
    echo ""
    echo "Commands:"
    echo "  backup [profile]     - Backup current database with profile name"
    echo "  restore [profile]    - Restore database from profile backup"
    echo "  list                 - List all profile backups"
    echo ""
    echo "Examples:"
    echo "  ./sync_database.sh backup daughter    - Backup daughter's database"
    echo "  ./sync_database.sh restore daughter   - Restore daughter's database for testing"
    echo "  ./sync_database.sh list                - List all backups"
}

backup_database() {
    local profile=$1
    
    if [ -z "$profile" ]; then
        echo -e "${RED}Error: Profile name required${NC}"
        print_usage
        exit 1
    fi
    
    mkdir -p "$BACKUP_DIR"
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/${profile}_backup_${timestamp}.db.gz"
    
    echo -e "${YELLOW}📦 Backing up database for profile: $profile${NC}"
    
    if [ ! -f "$DB_PATH" ]; then
        echo -e "${RED}Error: Database not found at $DB_PATH${NC}"
        exit 1
    fi
    
    gzip -c "$DB_PATH" > "$backup_file"
    
    echo -e "${GREEN}✅ Backup created: $backup_file${NC}"
    echo -e "${GREEN}   Size: $(du -h "$backup_file" | cut -f1)${NC}"
}

restore_database() {
    local profile=$1
    
    if [ -z "$profile" ]; then
        echo -e "${RED}Error: Profile name required${NC}"
        print_usage
        exit 1
    fi
    
    # Find latest backup for this profile
    local latest_backup=$(ls -t "$BACKUP_DIR/${profile}_backup_"*.db.gz 2>/dev/null | head -1)
    
    if [ -z "$latest_backup" ]; then
        echo -e "${RED}Error: No backup found for profile: $profile${NC}"
        echo "Available profiles:"
        list_profiles
        exit 1
    fi
    
    echo -e "${YELLOW}📥 Restoring database from: $(basename "$latest_backup")${NC}"
    
    # Backup current database first
    if [ -f "$DB_PATH" ]; then
        local safety_backup="$BACKUP_DIR/safety_backup_$(date +%Y%m%d_%H%M%S).db.gz"
        echo -e "${YELLOW}   Creating safety backup of current database...${NC}"
        gzip -c "$DB_PATH" > "$safety_backup"
        echo -e "${GREEN}   Safety backup: $safety_backup${NC}"
    fi
    
    # Restore
    gunzip -c "$latest_backup" > "$DB_PATH"
    
    echo -e "${GREEN}✅ Database restored from $profile backup${NC}"
    echo -e "${YELLOW}⚠️  Remember: This is $profile's data. Your original data is in safety backup.${NC}"
}

list_profiles() {
    echo -e "${YELLOW}📋 Available profile backups:${NC}"
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ]; then
        echo "No backups found."
        return
    fi
    
    # Group by profile
    for profile in $(ls "$BACKUP_DIR"/*_backup_*.db.gz 2>/dev/null | sed 's/.*\///;s/_backup_.*//' | sort -u); do
        local count=$(ls "$BACKUP_DIR/${profile}_backup_"*.db.gz 2>/dev/null | wc -l)
        local latest=$(ls -t "$BACKUP_DIR/${profile}_backup_"*.db.gz 2>/dev/null | head -1)
        local latest_date=$(echo "$latest" | sed 's/.*_backup_//;s/.db.gz//')
        
        echo -e "${GREEN}  👤 $profile${NC} - $count backups (latest: $latest_date)"
    done
    
    echo ""
}

# Main script
case "$1" in
    backup)
        backup_database "$2"
        ;;
    restore)
        restore_database "$2"
        ;;
    list)
        list_profiles
        ;;
    *)
        print_usage
        exit 1
        ;;
esac
