# 🍎 EXACT COMMANDS FOR MAC SYSTEM

## ⚡ Quick Copy-Paste Commands (Mac/Linux)

---

## STEP 1️⃣: Install Docker Desktop (Mac)

**URL to open in browser:**
```
https://www.docker.com/products/docker-desktop/
```

**Choose:** Download for Mac (Intel chip or Apple silicon)

**After installation, verify in Terminal:**
```bash
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
4. Double-click ZIP to extract
5. Move folder to Desktop
6. Rename from `mytimemanager-main` to `mytimemanager`

**Final location:** `/Users/[YOUR_NAME]/Desktop/mytimemanager/`

### Method B: Git Clone (Recommended for Mac)

**Open Terminal (Cmd+Space, type "Terminal"), then run:**
```bash
cd ~/Desktop
git clone https://github.com/biswalmanoj310/mytimemanager.git
cd mytimemanager
```

---

## STEP 3️⃣: Start MyTimeManager

**Navigate to project folder:**
```bash
cd ~/Desktop/mytimemanager
```

**Make scripts executable (one-time only):**
```bash
chmod +x start-docker.sh stop-docker.sh backup-now.sh restore-backup.sh
```

**Start the app (FIRST TIME - takes 5-10 minutes):**
```bash
./start-docker.sh
```

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

## 📂 File Locations (Exact Paths - Mac)

### Project folder:
```
/Users/[YOUR_NAME]/Desktop/mytimemanager/
```
**Or use shortcut:** `~/Desktop/mytimemanager/`

### Database (DO NOT DELETE):
```
~/Desktop/mytimemanager/backend/database/mytimemanager.db
```

### Backups folder:
```
~/Desktop/mytimemanager/backend/database/backups/
```

### Scripts you'll use:
```bash
~/Desktop/mytimemanager/start-docker.sh      # Start app
~/Desktop/mytimemanager/stop-docker.sh       # Stop app
~/Desktop/mytimemanager/backup-now.sh        # Manual backup
~/Desktop/mytimemanager/restore-backup.sh    # Restore from backup
```

---

## 🔄 Daily Usage Commands (Mac)

### Start app:
```bash
cd ~/Desktop/mytimemanager
./start-docker.sh
```
**Then open browser:** http://localhost:3000

### Stop app:
```bash
cd ~/Desktop/mytimemanager
./stop-docker.sh
```

### Manual backup:
```bash
cd ~/Desktop/mytimemanager
./backup-now.sh
```

### Restore from backup:
```bash
cd ~/Desktop/mytimemanager
./restore-backup.sh
```

---

## 🛡️ Automatic Backups (Already Working!)

**No commands needed!**
- Backups run automatically at 2:00 AM every night
- Stored in: `~/Desktop/mytimemanager/backend/database/backups/`
- Old backups deleted after 30 days automatically
- Format: `mytimemanager_backup_YYYYMMDD_HHMMSS.db.gz`

---

## 🔍 Troubleshooting Commands (Mac)

### Check Docker is running:
```bash
docker ps
```
Expected: Should list 2 containers (backend + frontend)

### Restart Docker containers:
```bash
cd ~/Desktop/mytimemanager
./stop-docker.sh
sleep 5
./start-docker.sh
```

### View backend logs:
```bash
docker logs mytimemanager-backend
```

### View frontend logs:
```bash
docker logs mytimemanager-frontend
```

### Check backup logs:
```bash
docker exec mytimemanager-backend cat /var/log/backup.log
```

### Check cron is running (automatic backups):
```bash
docker exec mytimemanager-backend service cron status
```
Expected: `cron is running`

### Force rebuild (if app won't start):
```bash
cd ~/Desktop/mytimemanager
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### View real-time logs (useful for debugging):
```bash
cd ~/Desktop/mytimemanager
docker-compose logs -f
```
Press Ctrl+C to stop viewing logs

---

## 📊 Verification Commands (After Setup)

### Verify all files downloaded:
```bash
cd ~/Desktop/mytimemanager
ls -la
```
Should see: `start-docker.sh`, `backend/`, `frontend/`, `README.md`, etc.

### Verify scripts are executable:
```bash
ls -la *.sh
```
Should see: `-rwxr-xr-x` (the 'x' means executable)

### Verify Docker images exist:
```bash
docker images | grep mytimemanager
```
Should see: `mytimemanager-backend` and `mytimemanager-frontend`

### Verify containers running:
```bash
docker ps
```
Should see 2 containers with status "Up"

### Verify app accessible:
```bash
curl http://localhost:8000/api/health
```
Expected: `{"status":"healthy"}`

### Verify backups folder exists:
```bash
ls -lh ~/Desktop/mytimemanager/backend/database/backups/
```
Should see at least one `.db.gz` file

### Check disk space used:
```bash
du -sh ~/Desktop/mytimemanager
```
Should be around 50-100 MB (plus Docker images ~800 MB)

---

## 🎯 Complete Setup Script (Mac)

**Save this as `setup.sh` and run it (AFTER downloading code):**

```bash
#!/bin/bash

echo "========================================"
echo "MyTimeManager Setup Verification (Mac)"
echo "========================================"
echo ""

echo "[1/7] Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ ERROR: Docker not installed!"
    echo "Please install Docker Desktop first:"
    echo "https://www.docker.com/products/docker-desktop/"
    exit 1
fi
echo "✓ Docker found: $(docker --version)"
echo ""

echo "[2/7] Checking Docker is running..."
if ! docker ps &> /dev/null; then
    echo "❌ ERROR: Docker Desktop is not running!"
    echo "Please start Docker Desktop and try again."
    exit 1
fi
echo "✓ Docker is running"
echo ""

echo "[3/7] Checking project folder..."
if [ ! -f "start-docker.sh" ]; then
    echo "❌ ERROR: Not in project folder!"
    echo "Please run this from ~/Desktop/mytimemanager/"
    echo "Current directory: $(pwd)"
    exit 1
fi
echo "✓ Project folder found: $(pwd)"
echo ""

echo "[4/7] Making scripts executable..."
chmod +x start-docker.sh stop-docker.sh backup-now.sh restore-backup.sh
echo "✓ Scripts are now executable"
echo ""

echo "[5/7] Starting MyTimeManager..."
./start-docker.sh
echo ""

echo "[6/7] Waiting for app to start..."
echo "This may take 5-10 minutes on first run..."
sleep 30
echo ""

echo "[7/7] Opening app in browser..."
open http://localhost:3000
echo ""

echo "========================================"
echo "Setup complete! 🎉"
echo "========================================"
echo ""
echo "App is running at: http://localhost:3000"
echo ""
echo "To stop:    ./stop-docker.sh"
echo "To backup:  ./backup-now.sh"
echo "To restore: ./restore-backup.sh"
echo ""
```

**To use this script:**
```bash
cd ~/Desktop/mytimemanager
chmod +x setup.sh
./setup.sh
```

---

## 📋 Command Cheat Sheet (Mac - Print This!)

```
╔════════════════════════════════════════════════╗
║       MYTIMEMANAGER COMMANDS (MAC)             ║
╟────────────────────────────────────────────────╢
║ OPEN TERMINAL: Cmd+Space → type "Terminal"    ║
║                                                ║
║ START:    cd ~/Desktop/mytimemanager           ║
║           ./start-docker.sh                    ║
║                                                ║
║ OPEN:     Browser → http://localhost:3000     ║
║           Or run: open http://localhost:3000   ║
║                                                ║
║ STOP:     cd ~/Desktop/mytimemanager           ║
║           ./stop-docker.sh                     ║
║                                                ║
║ BACKUP:   cd ~/Desktop/mytimemanager           ║
║           ./backup-now.sh                      ║
║                                                ║
║ RESTORE:  cd ~/Desktop/mytimemanager           ║
║           ./restore-backup.sh                  ║
╟────────────────────────────────────────────────╢
║ TROUBLESHOOTING:                               ║
║                                                ║
║ 1. Check Docker Desktop is running (whale)    ║
║ 2. Run: ./stop-docker.sh                       ║
║ 3. Wait 5 seconds                              ║
║ 4. Run: ./start-docker.sh                      ║
║ 5. Wait 30 seconds                             ║
║ 6. Open: http://localhost:3000                 ║
║                                                ║
║ View logs: docker-compose logs -f              ║
║ Check status: docker ps                        ║
╚════════════════════════════════════════════════╝
```

---

## 🆚 Windows vs Mac Command Comparison

| Task | Windows | Mac |
|------|---------|-----|
| **Open Terminal** | Win+R → cmd | Cmd+Space → Terminal |
| **Navigate** | `cd Desktop\mytimemanager` | `cd ~/Desktop/mytimemanager` |
| **Start app** | `start-docker.bat` | `./start-docker.sh` |
| **Stop app** | `stop-docker.bat` | `./stop-docker.sh` |
| **Backup** | `backup-now.bat` | `./backup-now.sh` |
| **Restore** | `restore-backup.bat` | `./restore-backup.sh` |
| **List files** | `dir` | `ls` or `ls -la` |
| **Open URL** | `start http://...` | `open http://...` |
| **Path separator** | `\` (backslash) | `/` (forward slash) |
| **Home directory** | `%USERPROFILE%` | `~` or `$HOME` |
| **Make executable** | Not needed | `chmod +x script.sh` |

---

## 🍎 Mac-Specific Tips

### 1. Creating Desktop Shortcut (Mac)

**Option A: Alias (Recommended)**
```bash
# Add to ~/.zshrc or ~/.bash_profile
echo 'alias mytimemanager="cd ~/Desktop/mytimemanager && ./start-docker.sh"' >> ~/.zshrc
source ~/.zshrc

# Now just type anywhere:
mytimemanager
```

**Option B: Automator App**
1. Open **Automator** (Cmd+Space, type "Automator")
2. Choose **"Application"**
3. Add **"Run Shell Script"** action
4. Paste:
   ```bash
   cd ~/Desktop/mytimemanager
   ./start-docker.sh
   open http://localhost:3000
   ```
5. Save as **"MyTimeManager.app"** on Desktop
6. Double-click to start!

### 2. Auto-Start on Login (Optional)

```bash
# Create launch agent
mkdir -p ~/Library/LaunchAgents

cat > ~/Library/LaunchAgents/com.mytimemanager.app.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.mytimemanager.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd ~/Desktop/mytimemanager && ./start-docker.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF

# Load it
launchctl load ~/Library/LaunchAgents/com.mytimemanager.app.plist
```

**To disable auto-start:**
```bash
launchctl unload ~/Library/LaunchAgents/com.mytimemanager.app.plist
rm ~/Library/LaunchAgents/com.mytimemanager.app.plist
```

### 3. Keyboard Shortcuts

Add to **~/.zshrc** or **~/.bash_profile**:
```bash
# MyTimeManager shortcuts
alias mts='cd ~/Desktop/mytimemanager && ./start-docker.sh'  # Start
alias mte='cd ~/Desktop/mytimemanager && ./stop-docker.sh'   # End/Stop
alias mtb='cd ~/Desktop/mytimemanager && ./backup-now.sh'    # Backup
alias mtr='cd ~/Desktop/mytimemanager && ./restore-backup.sh' # Restore
alias mto='open http://localhost:3000'                        # Open
alias mtl='cd ~/Desktop/mytimemanager && docker-compose logs -f' # Logs
```

Then just type: `mts` to start, `mto` to open, `mte` to stop!

### 4. Menu Bar Quick Launch (Using BitBar or SwiftBar)

Install **SwiftBar**: https://swiftbar.app/

Create script: `~/.config/swiftbar/mytimemanager.1h.sh`
```bash
#!/bin/bash
# <bitbar.title>MyTimeManager</bitbar.title>

echo "⏰"
echo "---"
if docker ps | grep -q mytimemanager; then
  echo "✅ Running | color=green"
  echo "Open App | bash='open http://localhost:3000'"
  echo "Stop | bash='cd ~/Desktop/mytimemanager && ./stop-docker.sh' terminal=false"
else
  echo "⏹ Stopped | color=red"
  echo "Start | bash='cd ~/Desktop/mytimemanager && ./start-docker.sh' terminal=true"
fi
echo "---"
echo "Backup Now | bash='cd ~/Desktop/mytimemanager && ./backup-now.sh' terminal=true"
echo "View Logs | bash='docker logs mytimemanager-backend' terminal=true"
```

Now you have menu bar control! 🎛️

---

## 🔧 Mac-Specific Troubleshooting

### Issue: "Permission denied" when running .sh files

**Solution:**
```bash
cd ~/Desktop/mytimemanager
chmod +x *.sh
```

### Issue: "zsh: command not found: docker"

**Solution:**
```bash
# Docker Desktop not in PATH. Add to ~/.zshrc:
echo 'export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Issue: Docker uses too much CPU/RAM on Mac

**Solution:**
1. Open **Docker Desktop** → **Settings** → **Resources**
2. Reduce CPUs to 2-3
3. Reduce Memory to 2-4 GB
4. Click **Apply & Restart**

### Issue: Port 3000 already in use on Mac

**Solution:**
```bash
# Find process using port 3000
lsof -ti:3000

# Kill it
kill -9 $(lsof -ti:3000)

# Or kill port 8000 too if needed
kill -9 $(lsof -ti:8000)

# Then restart
./start-docker.sh
```

### Issue: M1/M2 Mac compatibility

**Solution:**
Docker automatically handles this, but if you have issues:
```bash
# Force platform in docker-compose.yml
# Add to each service:
platform: linux/amd64
```

### Issue: Backup script says "command not found: gzip"

**Solution:**
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# gzip should already be installed on Mac, but if not:
brew install gzip
```

---

## 📦 Additional Mac Tools

### Install Homebrew (Package Manager - Recommended)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Install Git (if not already installed)
```bash
brew install git
```

### Install Docker Desktop (via Homebrew)
```bash
brew install --cask docker
```

### Install helpful tools
```bash
brew install jq          # JSON parsing (for API testing)
brew install wget        # File downloading
brew install tree        # Directory visualization
brew install watch       # Monitor command output
```

---

## ✅ Mac Setup Checklist

**Initial Setup:**
- [ ] Docker Desktop installed
- [ ] Code downloaded to `~/Desktop/mytimemanager`
- [ ] Scripts made executable: `chmod +x *.sh`
- [ ] Tested: `./start-docker.sh` works
- [ ] Tested: `./backup-now.sh` creates backup
- [ ] Tested: `./restore-backup.sh` lists backups
- [ ] Browser opens http://localhost:3000
- [ ] Can create and complete tasks

**Optional Enhancements:**
- [ ] Created terminal aliases (`mts`, `mto`, etc.)
- [ ] Created Desktop shortcut (Automator app)
- [ ] Added to auto-start (LaunchAgent)
- [ ] Installed SwiftBar menu control
- [ ] Set up weekly backup reminder
- [ ] Configured Docker resource limits

**Verification:**
- [ ] `docker ps` shows 2 containers
- [ ] `ls ~/Desktop/mytimemanager/backend/database/backups/` shows backups
- [ ] `docker exec mytimemanager-backend service cron status` says "running"
- [ ] App accessible at http://localhost:3000
- [ ] API docs at http://localhost:8000/docs

---

## 🚀 Quick Start for Mac Users

**Copy-paste this entire block into Terminal:**

```bash
# Navigate to Desktop
cd ~/Desktop

# Clone repository
git clone https://github.com/biswalmanoj310/mytimemanager.git

# Enter directory
cd mytimemanager

# Make scripts executable
chmod +x *.sh

# Start app
./start-docker.sh

# Wait for startup message, then open browser
sleep 30
open http://localhost:3000

# Show success message
echo ""
echo "=========================================="
echo "🎉 MyTimeManager is ready!"
echo "=========================================="
echo ""
echo "App: http://localhost:3000"
echo "API: http://localhost:8000/docs"
echo ""
echo "Commands:"
echo "  Stop:    ./stop-docker.sh"
echo "  Backup:  ./backup-now.sh"
echo "  Restore: ./restore-backup.sh"
echo ""
```

---

## 📱 Sharing Database Between Mac and Windows

If you want to use the same data on both Mac and Windows:

### Option 1: Cloud Sync (Dropbox/OneDrive)

**On Mac:**
```bash
# Move database to cloud folder
mv ~/Desktop/mytimemanager/backend/database ~/Dropbox/mytimemanager-data
ln -s ~/Dropbox/mytimemanager-data ~/Desktop/mytimemanager/backend/database
```

**On Windows:**
```cmd
mklink /D "C:\Users\[NAME]\Desktop\mytimemanager\backend\database" "C:\Users\[NAME]\Dropbox\mytimemanager-data"
```

### Option 2: Manual Backup Transfer

**Export from Mac:**
```bash
cd ~/Desktop/mytimemanager
./backup-now.sh
cp backend/database/backups/mytimemanager_backup_*.db.gz ~/Desktop/
```

**Import to Windows:**
```cmd
cd Desktop\mytimemanager
copy ..\mytimemanager_backup_*.db.gz backend\database\backups\
restore-backup.bat
```

### Option 3: USB Drive

```bash
# Mac: Copy database
cp ~/Desktop/mytimemanager/backend/database/mytimemanager.db /Volumes/USB_DRIVE/

# Windows: Copy database
copy "D:\mytimemanager.db" "Desktop\mytimemanager\backend\database\mytimemanager.db"
```

---

**Last Updated:** January 23, 2026  
**Version:** 1.0 (Docker Deployment - Mac Edition)

**Questions?** Check the main guides:
- [DAUGHTER_LAPTOP_SETUP_GUIDE.md](DAUGHTER_LAPTOP_SETUP_GUIDE.md) - General setup
- [EXACT_COMMANDS.md](EXACT_COMMANDS.md) - Windows commands
- [AUTOMATIC_BACKUP_GUIDE.md](AUTOMATIC_BACKUP_GUIDE.md) - Backup system details

