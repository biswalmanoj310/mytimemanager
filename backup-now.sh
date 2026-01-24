#!/bin/bash
# Manual Backup Trigger for Mac/Linux
# Run this anytime to create an immediate backup

echo "========================================"
echo " MyTimeManager Manual Backup"
echo "========================================"
echo ""

# Check if app is running
if docker ps | grep -q mytimemanager-backend; then
    echo "Running backup inside Docker container..."
    docker exec mytimemanager-backend /usr/local/bin/backup-docker.sh
else
    echo "App is not running. Starting backup locally..."
    
    # Use local backup script
    BACKUP_DIR="backend/database/backups"
    DB_FILE="backend/database/mytimemanager.db"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    
    mkdir -p "$BACKUP_DIR"
    
    if [ -f "$DB_FILE" ]; then
        cp "$DB_FILE" "$BACKUP_DIR/mytimemanager_backup_${TIMESTAMP}.db"
        gzip "$BACKUP_DIR/mytimemanager_backup_${TIMESTAMP}.db"
        echo "Backup created: $BACKUP_DIR/mytimemanager_backup_${TIMESTAMP}.db.gz"
    else
        echo "Database file not found!"
        exit 1
    fi
fi

echo ""
echo "Backup completed!"
echo ""
echo "Backups are stored in:"
echo "  backend/database/backups/"
echo ""
