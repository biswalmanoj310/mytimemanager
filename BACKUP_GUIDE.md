# Database Backup System

## Overview
Automated daily backup system for Time Manager database with 60-day retention policy.

## Storage Requirements Estimate

### Database Size Estimation
- **Typical SQLite database size**: 5-50 MB (depends on usage)
- **Compressed backup size**: ~70-80% reduction (1-10 MB per backup)
- **60 days of backups**: 60-600 MB total storage

### Conservative Estimate
- Average compressed backup: **5 MB**
- 60 days retention: **300 MB total**
- **Recommendation**: Allocate 500 MB - 1 GB for backup storage

### Storage Location
Backups are stored in: `~/mytimemanager_backups/`

---

## Quick Start Commands

### 1. Start the Application
```bash
cd /Users/mbiswal/projects/mytimemanager
chmod +x start_app.sh
./start_app.sh
```

Or use the individual startup scripts:
```bash
# Start both (existing method)
./start_all.sh

# Or start separately
./start_backend.sh
./start_frontend.sh
```

### 2. Create Manual Backup
```bash
chmod +x backup_database.sh
./backup_database.sh
```

### 3. Restore from Backup
```bash
chmod +x restore_database.sh

# List available backups
./restore_database.sh

# Restore specific backup
./restore_database.sh ~/mytimemanager_backups/time_manager_backup_20250101_120000.db.gz
```

---

## Automated Daily Backups

### Setup on macOS (using cron)

1. **Open crontab editor:**
```bash
crontab -e
```

2. **Add this line to run backup daily at 2 AM:**
```bash
0 2 * * * cd /Users/mbiswal/projects/mytimemanager && ./backup_database.sh >> ~/mytimemanager_backups/backup_cron.log 2>&1
```

3. **Verify cron job:**
```bash
crontab -l
```

### Setup on macOS (using launchd - Recommended)

1. **Create a launch agent:**
```bash
nano ~/Library/LaunchAgents/com.timemanager.backup.plist
```

2. **Paste this content:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.timemanager.backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/mbiswal/projects/mytimemanager/backup_database.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/mbiswal/mytimemanager_backups/backup.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/mbiswal/mytimemanager_backups/backup_error.log</string>
</dict>
</plist>
```

3. **Load the launch agent:**
```bash
launchctl load ~/Library/LaunchAgents/com.timemanager.backup.plist
```

4. **Verify it's loaded:**
```bash
launchctl list | grep timemanager
```

5. **Test it immediately (optional):**
```bash
launchctl start com.timemanager.backup
```

---

## Backup Management

### View All Backups
```bash
ls -lh ~/mytimemanager_backups/*.db.gz
```

### Check Total Backup Storage
```bash
du -sh ~/mytimemanager_backups/
```

### View Backup Log
```bash
cat ~/mytimemanager_backups/backup_log.txt
```

### Manual Cleanup (delete backups older than 60 days)
```bash
find ~/mytimemanager_backups/ -name "time_manager_backup_*.db.gz" -type f -mtime +60 -delete
```

### Delete All Backups (USE WITH CAUTION!)
```bash
rm ~/mytimemanager_backups/time_manager_backup_*.db.gz
```

---

## Backup Features

✅ **Daily Automated Backups** - Run at 2 AM daily
✅ **Automatic Compression** - Saves ~70-80% storage space
✅ **60-Day Retention** - Old backups automatically deleted
✅ **Logging** - All backup operations logged
✅ **Safe Restoration** - Creates safety backup before restore
✅ **Easy Management** - Simple commands to manage backups

---

## Application URLs

After starting the application:
- **Frontend**: http://localhost:3003
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

---

## Troubleshooting

### Backup script fails
```bash
# Check if database exists
ls -lh backend/time_manager.db

# Check backup directory permissions
ls -ld ~/mytimemanager_backups/
```

### Check if automated backup is running
```bash
# For launchd
launchctl list | grep timemanager

# Check logs
tail -f ~/mytimemanager_backups/backup.log
```

### Restore fails
```bash
# Check backup file integrity
gunzip -t ~/mytimemanager_backups/time_manager_backup_*.db.gz

# Check file permissions
ls -l backend/time_manager.db
```

---

## Storage Monitoring

### Check current database size
```bash
du -h backend/time_manager.db
```

### Monitor backup growth
```bash
# Run this weekly to track storage usage
du -sh ~/mytimemanager_backups/
ls ~/mytimemanager_backups/*.db.gz | wc -l
```

### Expected Growth Pattern
- **Week 1**: ~35 MB (7 backups)
- **Month 1**: ~150 MB (30 backups)
- **Steady State (60 days)**: ~300 MB (60 backups)

---

## Best Practices

1. **Test restore regularly** - Verify backups work
2. **Monitor disk space** - Ensure adequate storage
3. **Review logs** - Check backup success/failures
4. **Keep 2-3 months of backups initially** - Until confident in system
5. **Store critical backups offsite** - Cloud storage or external drive

---

## Additional Backup Options

### Copy to External Drive
```bash
# Mount external drive, then:
rsync -av ~/mytimemanager_backups/ /Volumes/BackupDrive/timemanager_backups/
```

### Upload to Cloud (example with rclone)
```bash
# After setting up rclone
rclone copy ~/mytimemanager_backups/ remote:timemanager_backups/
```

---

## Support

For issues or questions:
1. Check logs: `~/mytimemanager_backups/backup_log.txt`
2. Review this README
3. Test backup/restore manually before automation
