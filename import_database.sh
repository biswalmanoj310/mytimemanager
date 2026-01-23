#!/bin/bash

# Import Database from Another Instance
# Usage: ./import_database.sh [profile_name] [backup_file]
# Example: ./import_database.sh daughter ~/Downloads/daughter_backup.db.gz

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
DB_DIR="$PROJECT_ROOT/backend/database"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ $# -ne 2 ]; then
    echo "Usage: ./import_database.sh [profile_name] [backup_file]"
    echo ""
    echo "Example:"
    echo "  ./import_database.sh daughter ~/Downloads/daughter_backup_20260123.db.gz"
    echo ""
    echo "This will:"
    echo "  1. Extract the backup file"
    echo "  2. Save it as daughter_test.db"
    echo "  3. Keep YOUR production data safe"
    exit 1
fi

PROFILE=$1
BACKUP_FILE=$2

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ File not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}📥 Importing database for profile: $PROFILE${NC}"
echo ""

# Extract to test database
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "  Extracting compressed backup..."
    gunzip -c "$BACKUP_FILE" > "$DB_DIR/${PROFILE}_test.db"
else
    echo "  Copying database..."
    cp "$BACKUP_FILE" "$DB_DIR/${PROFILE}_test.db"
fi

echo -e "${GREEN}✅ Database imported successfully!${NC}"
echo ""
echo "Next steps:"
echo -e "  1. Switch to $PROFILE:  ${YELLOW}./switch_profile.sh $PROFILE${NC}"
echo -e "  2. Restart backend:     ${YELLOW}./start_backend.sh${NC}"
echo -e "  3. Test and fix bug"
echo -e "  4. Switch back to YOU:  ${YELLOW}./switch_profile.sh production${NC}"
