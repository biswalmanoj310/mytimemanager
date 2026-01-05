#!/bin/bash

# Setup automatic database backups for MyTimeManager
# This script sets up cron jobs to run backups twice daily

# Get the absolute path to the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$PROJECT_DIR/backup_database.sh"

# Ensure backup script is executable
chmod +x "$BACKUP_SCRIPT"

# Create temporary cron file
TEMP_CRON=$(mktemp)

# Get existing crontab (excluding mytimemanager backups)
crontab -l 2>/dev/null | grep -v "mytimemanager_backups" > "$TEMP_CRON"

# Add backup jobs
# 1. Daily backup at 12:00 PM (noon)
echo "0 12 * * * cd $PROJECT_DIR && $BACKUP_SCRIPT >> ~/mytimemanager_backups/backup_cron.log 2>&1" >> "$TEMP_CRON"

# 2. Daily backup at 2:00 AM (night backup)
echo "0 2 * * * cd $PROJECT_DIR && $BACKUP_SCRIPT >> ~/mytimemanager_backups/backup_cron.log 2>&1" >> "$TEMP_CRON"

# Install new crontab
crontab "$TEMP_CRON"

# Clean up
rm "$TEMP_CRON"

# Create backup directory and log file
mkdir -p ~/mytimemanager_backups
touch ~/mytimemanager_backups/backup_cron.log

echo "✅ Backup cron jobs installed successfully!"
echo ""
echo "📅 Scheduled backups:"
echo "   - 2:00 AM daily (night backup)"
echo "   - 12:00 PM daily (noon backup)"
echo ""
echo "📝 Backup logs: ~/mytimemanager_backups/backup_cron.log"
echo "💾 Backups location: ~/mytimemanager_backups/"
echo ""
echo "To view scheduled jobs: crontab -l"
echo "To remove backup jobs: crontab -l | grep -v mytimemanager_backups | crontab -"
