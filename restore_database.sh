#!/bin/bash

# Restore Database from Backup
# Usage: ./restore_database.sh [backup_file]

BACKUP_DIR="$HOME/mytimemanager_backups"
DB_PATH="./backend/database/mytimemanager.db"

# If no argument provided, show available backups
if [ -z "$1" ]; then
    echo "Available backups:"
    echo "=================="
    ls -lh "$BACKUP_DIR"/mytimemanager_backup_*.db.gz 2>/dev/null | awk '{print $9, "(" $5 ")", $6, $7, $8}'
    echo ""
    echo "Usage: ./restore_database.sh <backup_file>"
    echo "Example: ./restore_database.sh $BACKUP_DIR/mytimemanager_backup_20250101_120000.db.gz"
    exit 0
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Confirm restoration
echo "WARNING: This will replace the current database!"
echo "Current database: $DB_PATH"
echo "Restore from: $BACKUP_FILE"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restoration cancelled."
    exit 0
fi

# Create a safety backup of current database
SAFETY_BACKUP="${DB_PATH}.before_restore_$(date +%Y%m%d_%H%M%S)"
echo "Creating safety backup of current database..."
cp "$DB_PATH" "$SAFETY_BACKUP"
echo "✓ Safety backup created: $SAFETY_BACKUP"

# Restore from backup
echo "Restoring database..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    # Decompress and restore
    gunzip -c "$BACKUP_FILE" > "$DB_PATH"
else
    # Direct copy
    cp "$BACKUP_FILE" "$DB_PATH"
fi

if [ $? -eq 0 ]; then
    echo "✓ Database restored successfully!"
    echo "  Safety backup available at: $SAFETY_BACKUP"
else
    echo "✗ Restoration failed!"
    echo "  Original database preserved."
    exit 1
fi
