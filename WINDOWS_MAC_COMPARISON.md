# 🖥️ Windows vs Mac Command Reference

## Quick Comparison Table

| **Action** | **Windows** | **Mac/Linux** |
|------------|-------------|---------------|
| **Open Terminal** | Win+R → `cmd` | Cmd+Space → "Terminal" |
| **Navigate to project** | `cd Desktop\mytimemanager` | `cd ~/Desktop/mytimemanager` |
| **Start app** | `start-docker.bat` | `./start-docker.sh` |
| **Stop app** | `stop-docker.bat` | `./stop-docker.sh` |
| **Manual backup** | `backup-now.bat` | `./backup-now.sh` |
| **Restore backup** | `restore-backup.bat` | `./restore-backup.sh` |
| **Check setup** | `check-setup.bat` | `docker ps` |
| **List files** | `dir` | `ls -la` |
| **Open browser** | `start http://localhost:3000` | `open http://localhost:3000` |
| **View logs** | `docker logs mytimemanager-backend` | `docker logs mytimemanager-backend` |
| **Kill port 3000** | `netstat -ano \| findstr :3000` | `lsof -ti:3000` then `kill -9 [PID]` |

---

## File Extensions

| **Windows** | **Mac/Linux** | **Purpose** |
|-------------|---------------|-------------|
| `.bat` | `.sh` | Script files |
| `\` | `/` | Path separator |
| `%USERPROFILE%` | `~` or `$HOME` | Home directory |
| `C:\Users\Name\` | `/Users/Name/` | User directory |

---

## Installation Commands

### Windows
```cmd
# Download Docker Desktop from browser
# https://www.docker.com/products/docker-desktop/

# Clone code
cd Desktop
git clone https://github.com/biswalmanoj310/mytimemanager.git

# Start app
cd mytimemanager
start-docker.bat
```

### Mac
```bash
# Download Docker Desktop from browser
# https://www.docker.com/products/docker-desktop/

# Clone code
cd ~/Desktop
git clone https://github.com/biswalmanoj310/mytimemanager.git

# Make scripts executable (Mac only!)
cd mytimemanager
chmod +x *.sh

# Start app
./start-docker.sh
```

---

## Daily Usage

### Windows
```cmd
REM Start app
cd Desktop\mytimemanager
start-docker.bat

REM Open browser manually or:
start http://localhost:3000

REM Stop app
stop-docker.bat
```

### Mac
```bash
# Start app
cd ~/Desktop/mytimemanager
./start-docker.sh

# Open browser manually or:
open http://localhost:3000

# Stop app
./stop-docker.sh
```

---

## Backup Commands

### Windows
```cmd
REM Manual backup
cd Desktop\mytimemanager
backup-now.bat

REM View backups
dir backend\database\backups

REM Restore backup
restore-backup.bat
```

### Mac
```bash
# Manual backup
cd ~/Desktop/mytimemanager
./backup-now.sh

# View backups
ls -lh backend/database/backups/

# Restore backup
./restore-backup.sh
```

---

## Troubleshooting

### Windows
```cmd
REM Check Docker status
docker ps

REM Restart containers
cd Desktop\mytimemanager
stop-docker.bat
timeout /t 5
start-docker.bat

REM View backend logs
docker logs mytimemanager-backend

REM View frontend logs
docker logs mytimemanager-frontend

REM Check what's on port 3000
netstat -ano | findstr :3000

REM Force rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Mac
```bash
# Check Docker status
docker ps

# Restart containers
cd ~/Desktop/mytimemanager
./stop-docker.sh
sleep 5
./start-docker.sh

# View backend logs
docker logs mytimemanager-backend

# View frontend logs
docker logs mytimemanager-frontend

# Check what's on port 3000
lsof -ti:3000

# Kill process on port 3000
kill -9 $(lsof -ti:3000)

# Force rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## Path Differences

### Windows Paths
```
C:\Users\[Username]\Desktop\mytimemanager\
C:\Users\[Username]\Desktop\mytimemanager\backend\database\mytimemanager.db
C:\Users\[Username]\Desktop\mytimemanager\backend\database\backups\
```

### Mac Paths
```
/Users/[username]/Desktop/mytimemanager/
/Users/[username]/Desktop/mytimemanager/backend/database/mytimemanager.db
/Users/[username]/Desktop/mytimemanager/backend/database/backups/

# Or using shortcuts:
~/Desktop/mytimemanager/
~/Desktop/mytimemanager/backend/database/mytimemanager.db
~/Desktop/mytimemanager/backend/database/backups/
```

---

## Special Mac Requirements

### Make Scripts Executable (Mac Only)
```bash
cd ~/Desktop/mytimemanager
chmod +x start-docker.sh stop-docker.sh backup-now.sh restore-backup.sh
```

**Windows doesn't need this** - `.bat` files are executable by default.

---

## Both Systems (Same Commands)

These Docker commands work identically on both:

```bash
# Check Docker version
docker --version

# List containers
docker ps

# List all containers (including stopped)
docker ps -a

# View logs
docker logs mytimemanager-backend
docker logs mytimemanager-frontend

# Execute command in container
docker exec mytimemanager-backend service cron status

# View backup logs
docker exec mytimemanager-backend cat /var/log/backup.log

# List Docker images
docker images

# Stop all containers
docker-compose down

# Rebuild containers
docker-compose build

# Start containers
docker-compose up -d

# View live logs
docker-compose logs -f
```

---

## URLs (Same on Both)

- **App:** http://localhost:3000
- **API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **GitHub:** https://github.com/biswalmanoj310/mytimemanager

---

## Automatic Backups (Same on Both)

| Feature | Details |
|---------|---------|
| **Schedule** | 2:00 AM daily (inside Docker container) |
| **Location** | `backend/database/backups/` |
| **Format** | `mytimemanager_backup_YYYYMMDD_HHMMSS.db.gz` |
| **Retention** | 30 days (auto-delete older) |
| **Compression** | gzip (reduces size by ~80-90%) |
| **Initial backup** | On container startup |

---

## Quick Setup Script Comparison

### Windows (setup.bat)
```batch
@echo off
cd Desktop\mytimemanager
start-docker.bat
timeout /t 30
start http://localhost:3000
```

### Mac (setup.sh)
```bash
#!/bin/bash
cd ~/Desktop/mytimemanager
chmod +x *.sh
./start-docker.sh
sleep 30
open http://localhost:3000
```

---

## Desktop Shortcuts

### Windows
1. Right-click `start-docker.bat`
2. "Create shortcut"
3. Move shortcut to Desktop
4. Rename to "Start MyTimeManager"
5. Double-click to run!

### Mac
**Option 1: Alias**
```bash
echo 'alias mytimemanager="cd ~/Desktop/mytimemanager && ./start-docker.sh"' >> ~/.zshrc
source ~/.zshrc
```

**Option 2: Automator App**
1. Open Automator
2. Create Application
3. Add "Run Shell Script"
4. Paste: `cd ~/Desktop/mytimemanager && ./start-docker.sh`
5. Save as "MyTimeManager.app" on Desktop

---

## Key Takeaways

✅ **Same Docker commands** on both systems
✅ **Same URLs** (localhost:3000, localhost:8000)
✅ **Same backup system** (automatic + manual)
✅ **Different scripts** (.bat vs .sh)
✅ **Different paths** (backslash vs forward slash)
✅ **Mac needs chmod +x** for scripts

**Bottom line:** The app works identically on both systems, just use the appropriate script files!

---

## Which Guide to Use?

| **You Have** | **Use This Guide** |
|--------------|-------------------|
| Windows laptop | [EXACT_COMMANDS.md](EXACT_COMMANDS.md) |
| Mac computer | [MAC_SETUP_COMMANDS.md](MAC_SETUP_COMMANDS.md) |
| Both systems | This file! |
| Teaching someone | [DAUGHTER_LAPTOP_SETUP_GUIDE.md](DAUGHTER_LAPTOP_SETUP_GUIDE.md) (Windows) or [MAC_SETUP_COMMANDS.md](MAC_SETUP_COMMANDS.md) (Mac) |
| Deployment prep | [DAD_DEPLOYMENT_CHECKLIST.md](DAD_DEPLOYMENT_CHECKLIST.md) |
| Backup details | [AUTOMATIC_BACKUP_GUIDE.md](AUTOMATIC_BACKUP_GUIDE.md) |

