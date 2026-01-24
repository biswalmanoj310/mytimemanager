#!/bin/bash
# Restore Database from Backup (Mac/Linux)

echo "========================================"
echo " MyTimeManager Database Restore"
echo "========================================"
echo ""

BACKUP_DIR="backend/database/backups"
DB_FILE="backend/database/mytimemanager.db"

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "No backups found in $BACKUP_DIR"
    exit 1
fi

# List available backups
echo "Available backups:"
echo ""
ls -lht "$BACKUP_DIR"/mytimemanager_backup_*.db* 2>/dev/null | head -20

if [ $? -ne 0 ]; then
    echo "No backup files found!"
    exit 1
fi

echo ""
echo "WARNING: This will replace your current database!"
echo "Current database will be backed up as mytimemanager.db.before_restore"
echo ""
read -p "Type YES to continue: " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
read -p "Enter backup filename (from list above): " BACKUP_FILE

if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_DIR/$BACKUP_FILE"
    exit 1
fi

# Stop Docker if running
echo "Stopping MyTimeManager..."
docker-compose down >/dev/null 2>&1

# Backup current database
if [ -f "$DB_FILE" ]; then
    echo "Backing up current database..."
    cp "$DB_FILE" "${DB_FILE}.before_restore"
fi

# Check if backup is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "Decompressing and restoring from backup..."
    gunzip -c "$BACKUP_DIR/$BACKUP_FILE" > "$DB_FILE"
else
    echo "Restoring from backup..."
    cp "$BACKUP_DIR/$BACKUP_FILE" "$DB_FILE"
fi

if [ -f "$DB_FILE" ]; then
    echo ""
    echo "========================================"
    echo " Restore completed successfully!"
    echo "========================================"
    echo ""
    echo "Database restored from: $BACKUP_FILE"
    echo "Previous database saved as: mytimemanager.db.before_restore"
    echo ""
    echo "You can now start the app with ./start-docker.sh"
else
    echo ""
    echo "ERROR: Restore failed!"
    if [ -f "${DB_FILE}.before_restore" ]; then
        echo "Restoring previous database..."
        cp "${DB_FILE}.before_restore" "$DB_FILE"
    fi
fi

echo ""
