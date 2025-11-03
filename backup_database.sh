#!/bin/bash

# Daily Database Backup Script for Time Manager
# Keeps backups for 60 days, automatically deletes older backups

# Configuration
BACKUP_DIR="$HOME/mytimemanager_backups"
DB_PATH="./backend/database/mytimemanager.db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mytimemanager_backup_$DATE.db"
RETENTION_DAYS=60

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database file not found at $DB_PATH"
    exit 1
fi

# Create backup
echo "Creating backup: $BACKUP_FILE"
cp "$DB_PATH" "$BACKUP_FILE"

# Compress the backup to save space (optional but recommended)
echo "Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "✓ Backup created successfully: $(basename $BACKUP_FILE)"
    
    # Get backup size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "  Size: $BACKUP_SIZE"
else
    echo "✗ Backup failed!"
    exit 1
fi

# Delete backups older than RETENTION_DAYS
echo "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "mytimemanager_backup_*.db.gz" -type f -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "mytimemanager_backup_*.db.gz" -type f | wc -l)
echo "Total backups: $BACKUP_COUNT"

# Calculate total backup storage
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "Total backup storage: $TOTAL_SIZE"

# Optional: Log the backup operation
LOG_FILE="$BACKUP_DIR/backup_log.txt"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Backup created: $(basename $BACKUP_FILE) - Size: $BACKUP_SIZE - Total backups: $BACKUP_COUNT" >> "$LOG_FILE"

echo "Backup complete!"
