# 🚀 EXACT COMMANDS FOR DAUGHTER'S LAPTOP SETUP

## ⚡ Quick Copy-Paste Commands

---

## STEP 1️⃣: Download Docker Desktop

**URL to open in browser:**
```
https://www.docker.com/products/docker-desktop/
```

**After installation, verify in Command Prompt (Win+R → cmd):**
```cmd
docker --version
```
Expected output: `Docker version 24.x.x, build ...`

---

## STEP 2️⃣: Download MyTimeManager Code

### Method A: Direct ZIP Download (Easiest)

**URL to open in browser:**
```
https://github.com/biswalmanoj310/mytimemanager
```

**Then:**
1. Click green **"<> Code"** button
2. Click **"Download ZIP"**
3. Save to **Downloads** folder
4. Extract to **Desktop**
5. Rename folder from `mytimemanager-main` to `mytimemanager`

**Final location:** `C:\Users\[HER_NAME]\Desktop\mytimemanager\`

### Method B: Git Clone (If Git installed)

**Open Command Prompt (Win+R → cmd), then run:**
```cmd
cd Desktop
git clone https://github.com/biswalmanoj310/mytimemanager.git
cd mytimemanager
```

---

## STEP 3️⃣: Start MyTimeManager

**Navigate to project folder:**
```cmd
cd Desktop\mytimemanager
```

**Start the app (FIRST TIME - takes 5-10 minutes):**
```cmd
start-docker.bat
```

**Or right-click `start-docker.bat` → "Run as administrator"**

**Wait for this message:**
```
==========================================
🎉 MyTimeManager is running!
==========================================

Access the app at:
➜  http://localhost:3000
```

**Open browser to:**
```
http://localhost:3000
```

---

## 📂 File Locations (Exact Paths)

### Project folder:
```
C:\Users\[HER_NAME]\Desktop\mytimemanager\
```

### Database (DO NOT DELETE):
```
C:\Users\[HER_NAME]\Desktop\mytimemanager\backend\database\mytimemanager.db
```

### Backups folder:
```
C:\Users\[HER_NAME]\Desktop\mytimemanager\backend\database\backups\
```

### Scripts you'll use:
```
C:\Users\[HER_NAME]\Desktop\mytimemanager\start-docker.bat
C:\Users\[HER_NAME]\Desktop\mytimemanager\stop-docker.bat
C:\Users\[HER_NAME]\Desktop\mytimemanager\backup-now.bat
C:\Users\[HER_NAME]\Desktop\mytimemanager\restore-backup.bat
```

---

## 🔄 Daily Usage Commands

### Start app:
```cmd
cd Desktop\mytimemanager
start-docker.bat
```
**Then open browser:** http://localhost:3000

### Stop app:
```cmd
cd Desktop\mytimemanager
stop-docker.bat
```

### Manual backup:
```cmd
cd Desktop\mytimemanager
backup-now.bat
```

### Restore from backup:
```cmd
cd Desktop\mytimemanager
restore-backup.bat
```

---

## 🛡️ Automatic Backups (Already Working!)

**No commands needed!**
- Backups run automatically at 2:00 AM every night
- Stored in: `Desktop\mytimemanager\backend\database\backups\`
- Old backups deleted after 30 days automatically
- Format: `mytimemanager_backup_YYYYMMDD_HHMMSS.db.gz`

---

## 🔍 Troubleshooting Commands

### Check Docker is running:
```cmd
docker ps
```
Expected: Should list 2 containers (backend + frontend)

### Check Docker Desktop status:
```cmd
cd Desktop\mytimemanager
check-setup.bat
```

### Restart Docker containers:
```cmd
cd Desktop\mytimemanager
stop-docker.bat
timeout /t 5
start-docker.bat
```

### View backend logs:
```cmd
docker logs mytimemanager-backend
```

### View frontend logs:
```cmd
docker logs mytimemanager-frontend
```

### Check backup logs:
```cmd
docker exec mytimemanager-backend cat /var/log/backup.log
```

### Force rebuild (if app won't start):
```cmd
cd Desktop\mytimemanager
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 📊 Verification Commands (After Setup)

### Verify all files downloaded:
```cmd
cd Desktop\mytimemanager
dir
```
Should see: `start-docker.bat`, `backend`, `frontend`, `README.md`, etc.

### Verify Docker images exist:
```cmd
docker images
```
Should see: `mytimemanager-backend` and `mytimemanager-frontend`

### Verify containers running:
```cmd
docker ps
```
Should see 2 containers with status "Up"

### Verify app accessible:
```cmd
curl http://localhost:8000/api/health
```
Expected: `{"status":"healthy"}`

### Verify backups folder exists:
```cmd
dir Desktop\mytimemanager\backend\database\backups
```
Should see at least one `.db.gz` file

---

## 🎯 Complete Setup Script (Copy All At Once)

**Save this as `setup.bat` and run it (AFTER downloading code):**

```batch
@echo off
echo ========================================
echo MyTimeManager Setup Verification
echo ========================================
echo.

echo [1/6] Checking Docker...
docker --version
if %errorlevel% neq 0 (
    echo ERROR: Docker not installed!
    echo Please install Docker Desktop first.
    pause
    exit /b 1
)
echo ✓ Docker found
echo.

echo [2/6] Checking Docker is running...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker Desktop is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo ✓ Docker is running
echo.

echo [3/6] Checking project folder...
if not exist "%cd%\start-docker.bat" (
    echo ERROR: Not in project folder!
    echo Please run this from Desktop\mytimemanager\
    pause
    exit /b 1
)
echo ✓ Project folder found
echo.

echo [4/6] Starting MyTimeManager...
call start-docker.bat
echo.

echo [5/6] Waiting for app to start...
timeout /t 30 /nobreak
echo.

echo [6/6] Opening app in browser...
start http://localhost:3000
echo.

echo ========================================
echo Setup complete! 🎉
echo ========================================
echo.
echo App is running at: http://localhost:3000
echo.
echo To stop: Double-click stop-docker.bat
echo To backup: Double-click backup-now.bat
echo.
pause
```

---

## 📋 Command Cheat Sheet (Print This!)

```
╔════════════════════════════════════════════════╗
║         MYTIMEMANAGER COMMANDS                 ║
╟────────────────────────────────────────────────╢
║ START:    cd Desktop\mytimemanager             ║
║           start-docker.bat                     ║
║                                                ║
║ OPEN:     Browser → http://localhost:3000     ║
║                                                ║
║ STOP:     cd Desktop\mytimemanager             ║
║           stop-docker.bat                      ║
║                                                ║
║ BACKUP:   cd Desktop\mytimemanager             ║
║           backup-now.bat                       ║
║                                                ║
║ RESTORE:  cd Desktop\mytimemanager             ║
║           restore-backup.bat                   ║
║                                                ║
║ CHECK:    cd Desktop\mytimemanager             ║
║           check-setup.bat                      ║
╟────────────────────────────────────────────────╢
║ TROUBLESHOOTING:                               ║
║                                                ║
║ 1. Check Docker Desktop is running (green)    ║
║ 2. Run: stop-docker.bat                        ║
║ 3. Wait 5 seconds                              ║
║ 4. Run: start-docker.bat                       ║
║ 5. Wait 30 seconds                             ║
║ 6. Open: http://localhost:3000                 ║
║                                                ║
║ If still broken: Call Dad! 📞                  ║
╚════════════════════════════════════════════════╝
```

---

## 💾 For Dad: Pre-Deployment Commands

### Push code to GitHub:
```bash
cd /Users/mbiswal/projects/mytimemanager
git add .
git commit -m "Add Docker deployment with automatic backups"
git push origin main
```

### Test Docker locally (Mac):
```bash
cd /Users/mbiswal/projects/mytimemanager
./stop-docker.sh
./start-docker.sh
# Open http://localhost:3000 and test
```

### Create sample data backup:
```bash
# After creating sample data in UI:
./backup-now.sh
ls -lh backend/database/backups/
```

### Copy to USB (if not using GitHub download):
```bash
# Insert USB drive
cp -r /Users/mbiswal/projects/mytimemanager /Volumes/[USB_NAME]/
```

---

## ✅ Success Criteria Checklist

**After running commands above, verify:**
- [ ] `docker --version` shows Docker 24+
- [ ] `docker ps` shows 2 running containers
- [ ] http://localhost:3000 loads the app
- [ ] http://localhost:8000/docs shows API documentation
- [ ] `backend\database\backups\` has at least 1 backup file
- [ ] Can create a task in the UI
- [ ] Can complete a task in the UI
- [ ] `backup-now.bat` creates new backup file
- [ ] `restore-backup.bat` lists available backups

**If all checked, deployment is SUCCESSFUL! 🎉**

---

## 📞 Help Contacts

**Dad's Phone:** [INSERT_YOUR_PHONE]
**Dad's Email:** [INSERT_YOUR_EMAIL]
**GitHub Issues:** https://github.com/biswalmanoj310/mytimemanager/issues

**Before calling:**
1. Try `stop-docker.bat` then `start-docker.bat`
2. Check Docker Desktop is running (green icon)
3. Take screenshot of any error
4. Have laptop ready for remote access (TeamViewer)

---

**Last Updated:** January 23, 2026
**Version:** 1.0 (Docker Deployment with Auto-Backups)

