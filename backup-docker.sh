#!/bin/bash
# Automatic Backup Script for MyTimeManager
# This script creates timestamped backups of the database

# Configuration
BACKUP_DIR="/app/database/backups"
DB_FILE="/app/database/mytimemanager.db"
RETENTION_DAYS=30  # Keep backups for 30 days

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/mytimemanager_backup_${TIMESTAMP}.db"

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    echo "Database file not found: $DB_FILE"
    exit 1
fi

# Create backup
echo "[$(date)] Creating backup: $BACKUP_FILE"
cp "$DB_FILE" "$BACKUP_FILE"

# Compress backup
echo "[$(date)] Compressing backup..."
gzip "$BACKUP_FILE"

# Check if backup was successful
if [ -f "${BACKUP_FILE}.gz" ]; then
    echo "[$(date)] Backup created successfully: ${BACKUP_FILE}.gz"
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
    echo "[$(date)] Backup size: $BACKUP_SIZE"
else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi

# Clean up old backups (older than RETENTION_DAYS)
echo "[$(date)] Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "mytimemanager_backup_*.db.gz" -type f -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/mytimemanager_backup_*.db.gz 2>/dev/null | wc -l)
echo "[$(date)] Total backups: $BACKUP_COUNT"

echo "[$(date)] Backup completed successfully!"
