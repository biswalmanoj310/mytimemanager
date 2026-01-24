# 🔄 Automatic Backup System Documentation

## Overview

MyTimeManager now includes automatic backup functionality in all deployment modes:
- **Docker**: Automatic daily backups at 2 AM
- **Manual**: On-demand backup scripts
- **Retention**: Keeps 30 days of backups automatically

---

## 🐳 Docker Mode (Automatic)

### How It Works

**Automatic Backups:**
- Runs daily at 2:00 AM inside the Docker container
- Creates compressed backup: `mytimemanager_backup_YYYYMMDD_HHMMSS.db.gz`
- Stores in: `backend/database/backups/`
- Automatically deletes backups older than 30 days
- Initial backup runs when container starts

**Backup Storage:**
```
backend/database/
├── mytimemanager.db           ← Active database
└── backups/
    ├── mytimemanager_backup_20260123_020000.db.gz
    ├── mytimemanager_backup_20260124_020000.db.gz
    └── mytimemanager_backup_20260125_020000.db.gz
```

### Manual Backup (Anytime)

**Windows:**
```batch
backup-now.bat
```

**Mac/Linux:**
```bash
./backup-now.sh
```

### View Backup Logs

**Check if backups are running:**
```bash
# View logs
docker-compose logs backend | grep -i backup

# Check backup directory
ls -lh backend/database/backups/

# Windows
dir backend\database\backups
```

### Restore from Backup

**Windows:**
1. Double-click `restore-backup.bat`
2. View list of available backups
3. Type `YES` to confirm
4. Enter backup filename
5. Database restored!

**Mac/Linux:**
```bash
./restore-backup.sh
# Follow prompts
```

**What happens during restore:**
- Current database backed up as `mytimemanager.db.before_restore`
- Selected backup decompressed and restored
- Safe rollback if restore fails

---

## 📅 Backup Schedule

### Automatic (Docker)
- **When:** Every day at 2:00 AM
- **Where:** `backend/database/backups/`
- **Format:** `mytimemanager_backup_YYYYMMDD_HHMMSS.db.gz`
- **Retention:** 30 days (older backups auto-deleted)
- **Size:** ~50-200 KB compressed (depends on usage)

### Manual Triggers
- App startup (initial backup)
- Running `backup-now.bat` or `backup-now.sh`
- Before major updates (recommended)
- Before database restore

---

## 🔧 Configuration

### Change Backup Time

Edit `Dockerfile.backend`:
```dockerfile
# Change "0 2" to your preferred hour (0-23)
RUN echo "0 2 * * * /usr/local/bin/backup-docker.sh >> /var/log/backup.log 2>&1"
```

Examples:
- `0 1 * * *` - 1:00 AM
- `0 3 * * *` - 3:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Midnight every Sunday

After changing, rebuild:
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### Change Retention Period

Edit `backup-docker.sh` or `backup-docker.bat`:
```bash
RETENTION_DAYS=30  # Change to 60, 90, etc.
```

### Disable Automatic Backups

Comment out cron line in `Dockerfile.backend`:
```dockerfile
# RUN echo "0 2 * * * /usr/local/bin/backup-docker.sh..."
```

---

## 💾 Backup Best Practices

### For Your Laptop (Dad)

**Daily (Automatic):**
- ✅ Docker handles it automatically

**Weekly (Manual - Extra Safety):**
```bash
# Create manual backup
./backup-now.sh

# Copy to external location
cp backend/database/backups/mytimemanager_backup_*.db.gz ~/Dropbox/MyTimeManager/
```

### For Daughter's Laptop

**Daily (Automatic):**
- ✅ Docker handles it automatically

**Monthly (Copy to Parent):**
1. Stop app: `stop-docker.bat`
2. Copy latest backup to USB drive:
   ```
   backend\database\backups\mytimemanager_backup_YYYYMMDD_*.db.gz
   ```
3. Give USB to parent for safekeeping
4. Start app: `start-docker.bat`

---

## 🔄 Sharing Backups Between Computers

### From Your Mac → Daughter's Windows Laptop

**Step 1 - On Your Mac:**
```bash
# Create backup
./backup-now.sh

# Copy to USB
cp backend/database/backups/mytimemanager_backup_20260123_*.db.gz /Volumes/USB/
```

**Step 2 - On Her Windows Laptop:**
1. Insert USB
2. Copy backup file to: `Desktop\mytimemanager\backend\database\backups\`
3. Run `restore-backup.bat`
4. Select the copied backup file
5. Type `YES` to restore

### Cloud Sync (Optional)

**Automatic cloud backup using Dropbox/OneDrive:**

**Windows:**
```batch
REM Add to backup-now.bat after backup completes
copy backend\database\backups\mytimemanager_backup_*.db.gz "%USERPROFILE%\Dropbox\MyTimeManager\" /Y
```

**Mac:**
```bash
# Add to backup-now.sh after backup completes
cp backend/database/backups/mytimemanager_backup_*.db.gz ~/Dropbox/MyTimeManager/
```

---

## 🛠️ Troubleshooting

### Backups Not Running

**Check cron is active in container:**
```bash
docker exec mytimemanager-backend service cron status
```

**Check backup logs:**
```bash
docker exec mytimemanager-backend cat /var/log/backup.log
```

**Manual test:**
```bash
docker exec mytimemanager-backend /usr/local/bin/backup-docker.sh
```

### Backup Directory Full

**Find large/old backups:**
```bash
# Mac/Linux
du -sh backend/database/backups/*

# Windows
dir backend\database\backups /s
```

**Manually clean up:**
```bash
# Delete backups older than 60 days
find backend/database/backups/ -name "*.db.gz" -mtime +60 -delete
```

### Restore Failed

**If database is corrupted after restore:**
```bash
# Stop app
./stop-docker.sh  # or stop-docker.bat

# Restore the safety backup
mv backend/database/mytimemanager.db.before_restore backend/database/mytimemanager.db

# Start app
./start-docker.sh  # or start-docker.bat
```

### Not Enough Disk Space

**Check disk usage:**
```bash
# Mac/Linux
df -h backend/database/

# Windows
dir backend\database /s
```

**Reduce retention period** (see Configuration above)

**Move old backups to external storage:**
```bash
# Mac/Linux
mv backend/database/backups/*.db.gz /Volumes/External/MyTimeManager_Backups/

# Windows
move backend\database\backups\*.db.gz E:\MyTimeManager_Backups\
```

---

## 📊 Backup Statistics

**Typical sizes:**
- Empty database: ~50 KB compressed
- 1 month usage: ~100 KB compressed
- 1 year usage: ~500 KB compressed
- With habits/goals: ~1 MB compressed

**Storage calculation:**
- 30 backups × 200 KB = 6 MB (negligible)
- Even with 1 year retention: ~100 MB (acceptable)

---

## 🔐 Security Notes

**Backups contain sensitive data:**
- Task descriptions
- Time tracking information
- Personal goals and habits
- Wish list items

**Recommendations:**
1. Keep backup directory secure (not public)
2. Encrypt external backups if storing in cloud
3. Use password-protected archives for transfers
4. Don't share backups publicly

**Encryption (optional):**
```bash
# Encrypt backup with password
gpg -c backend/database/backups/mytimemanager_backup_20260123_020000.db.gz

# Creates: mytimemanager_backup_20260123_020000.db.gz.gpg

# Decrypt later:
gpg -d mytimemanager_backup_20260123_020000.db.gz.gpg > restored.db
```

---

## 📝 Backup Checklist

### Daily (Automatic)
- [x] Docker cron runs at 2 AM
- [x] Backup created and compressed
- [x] Old backups cleaned up

### Weekly (Manual - Recommended)
- [ ] Run `backup-now.bat` or `backup-now.sh`
- [ ] Verify backup exists in `backend/database/backups/`
- [ ] Copy one backup to external location

### Monthly (Important)
- [ ] Test restore process with recent backup
- [ ] Copy backups to USB or cloud storage
- [ ] Verify backups can be decompressed
- [ ] Clean up very old backups from external storage

### Before Major Changes
- [ ] Run manual backup
- [ ] Copy to safe location
- [ ] Note what changes you're making
- [ ] Keep backup until changes verified

---

## 🆘 Emergency Recovery

**If database is completely lost:**

1. **Stop app:**
   ```bash
   ./stop-docker.sh  # or stop-docker.bat
   ```

2. **Find latest backup:**
   ```bash
   # Mac/Linux
   ls -lt backend/database/backups/ | head

   # Windows
   dir backend\database\backups /O-D
   ```

3. **Restore:**
   ```bash
   ./restore-backup.sh  # or restore-backup.bat
   ```

4. **Verify:**
   - Start app
   - Check recent tasks exist
   - Verify time entries are present

5. **If all backups lost:**
   - App will create fresh database
   - Start over with configuration
   - Contact support if USB/cloud backup exists

---

## 📞 Support

**Backup issues?**
1. Check logs: `docker-compose logs backend`
2. Verify disk space: `df -h` or `dir`
3. Test manual backup: `./backup-now.sh`
4. Check retention settings
5. Verify cron is running in container

**Need help restoring?**
1. Locate backup file
2. Run restore script
3. Follow prompts carefully
4. If fails, check `mytimemanager.db.before_restore` exists

---

**Your data is now automatically protected!** 🛡️
