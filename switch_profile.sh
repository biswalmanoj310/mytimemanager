#!/bin/bash

# Database Profile Manager
# Safely switch between your production data and test databases
# Usage: ./switch_profile.sh [profile_name]

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
DB_DIR="$PROJECT_ROOT/backend/database"
CURRENT_DB="$DB_DIR/mytimemanager.db"
PROFILE_FILE="$PROJECT_ROOT/.current_profile"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

show_current_profile() {
    if [ -f "$PROFILE_FILE" ]; then
        local profile=$(cat "$PROFILE_FILE")
        echo -e "${BLUE}📊 Current Profile: ${GREEN}$profile${NC}"
    else
        echo -e "${BLUE}📊 Current Profile: ${GREEN}production (YOU)${NC}"
    fi
    echo ""
}

list_profiles() {
    echo -e "${YELLOW}Available Profiles:${NC}"
    echo ""
    echo -e "  ${GREEN}production${NC}     - Your personal data (default)"
    
    for db in "$DB_DIR"/*_test.db; do
        if [ -f "$db" ]; then
            local name=$(basename "$db" _test.db)
            local size=$(du -h "$db" | cut -f1)
            echo -e "  ${GREEN}$name${NC}           - Test database ($size)"
        fi
    done
    
    echo ""
    echo "Usage: ./switch_profile.sh [profile_name]"
    echo "Example: ./switch_profile.sh daughter"
}

switch_profile() {
    local profile=$1
    
    if [ -z "$profile" ]; then
        show_current_profile
        list_profiles
        exit 0
    fi
    
    # Safety check: backup current before switch
    echo -e "${YELLOW}🔄 Switching to profile: $profile${NC}"
    
    if [ "$profile" = "production" ]; then
        # Switch back to production (your data)
        if [ -f "$DB_DIR/mytimemanager_production.db" ]; then
            cp "$DB_DIR/mytimemanager_production.db" "$CURRENT_DB"
            echo "production" > "$PROFILE_FILE"
            echo -e "${GREEN}✅ Switched to YOUR production data${NC}"
        else
            # First time - create backup
            cp "$CURRENT_DB" "$DB_DIR/mytimemanager_production.db"
            echo "production" > "$PROFILE_FILE"
            echo -e "${GREEN}✅ Created production backup and switched${NC}"
        fi
    else
        # Switch to test profile
        local test_db="$DB_DIR/${profile}_test.db"
        
        if [ ! -f "$test_db" ]; then
            echo -e "${RED}❌ Profile not found: $profile${NC}"
            echo ""
            echo "To create this profile, copy database:"
            echo "  cp /path/to/${profile}_backup.db $test_db"
            exit 1
        fi
        
        # Backup production first time
        if [ ! -f "$DB_DIR/mytimemanager_production.db" ]; then
            echo -e "${YELLOW}   Creating backup of YOUR production data...${NC}"
            cp "$CURRENT_DB" "$DB_DIR/mytimemanager_production.db"
        fi
        
        # Switch to test database
        cp "$test_db" "$CURRENT_DB"
        echo "$profile" > "$PROFILE_FILE"
        echo -e "${GREEN}✅ Switched to $profile test data${NC}"
        echo -e "${YELLOW}⚠️  Your production data is safe at: mytimemanager_production.db${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}💡 Restart backend to apply changes: ./start_backend.sh${NC}"
}

# Main
show_current_profile
switch_profile "$1"
