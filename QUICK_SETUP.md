# MyTimeManager - Quick Setup Instructions

## 🚀 For Your Daughter's Windows Laptop

### Step 1: Install Docker Desktop (One-Time)
1. Download from: https://www.docker.com/products/docker-desktop
2. Run installer (requires admin rights)
3. Restart computer when prompted
4. Open Docker Desktop - wait for it to fully start
5. You'll see a whale icon in the system tray when ready

### Step 2: Get MyTimeManager Code

**Option A - Download from GitHub (Easiest):**
1. Go to: `https://github.com/YOUR_USERNAME/mytimemanager`
2. Click green "Code" button → "Download ZIP"
3. Right-click ZIP → "Extract All" → Choose Desktop
4. Open the extracted `mytimemanager` folder

**Option B - Use Git (If Git is installed):**
```bash
cd Desktop
git clone https://github.com/YOUR_USERNAME/mytimemanager.git
cd mytimemanager
```

### Step 3: Start MyTimeManager
1. **Double-click `start-docker.bat`**
2. Wait 2-3 minutes (first time downloads images)
3. Window shows "SUCCESS! MyTimeManager is running!"
4. Open browser: **http://localhost:3000**

### Step 4: Configure for Daughter
1. Click "My Day Design" in left sidebar
2. Go to "🏛️ Life Pillars" tab
3. Create her pillars (e.g., "School", "Play", "Family")
4. Go to "📁 Categories" tab  
5. Create categories under each pillar
6. Go to "⏰ Time Blocks" tab
7. Click "Use Template" → "School Day"
8. Click "Activate"
9. Go to "Daily" tab - now shows school-friendly time blocks!

### Step 5: Stop MyTimeManager
- **Double-click `stop-docker.bat`** when done

---

## 📊 Data Storage

All data saves to: `backend/database/mytimemanager.db`

**Automatic Backups (NEW!):**
- ✅ Daily backups at 2:00 AM
- ✅ 30-day retention
- ✅ Location: `backend\database\backups\`
- ✅ No action needed - runs automatically!

**Manual backup anytime:**
```batch
backup-now.bat
```

**To restore from backup:**
```batch
restore-backup.bat
```

**To backup manually:**
1. Stop app (run stop-docker.bat)
2. Copy `backend\database\mytimemanager.db` to USB/cloud
3. Restart app

**To share data between computers:**
1. Backup from computer 1
2. Copy to computer 2
3. Replace `backend\database\mytimemanager.db`

---

## 🔧 Troubleshooting

### "Docker is not installed"
- Install Docker Desktop
- Make sure it's running (whale icon in system tray)

### App doesn't open in browser
- Wait 30 seconds after "SUCCESS" message
- Manually open: http://localhost:3000

### Port already in use
- Another app is using port 8000
- In `docker-compose.yml`, change `"8000:8000"` to `"8001:8000"`

### Need fresh start
1. Stop app (stop-docker.bat)
2. Delete `backend\database\mytimemanager.db`
3. Start app (start-docker.bat) - creates new database

---

## 📱 Daily Usage

**Morning:**
1. Double-click `start-docker.bat`
2. Wait 30 seconds
3. Open http://localhost:3000
4. Track your time!

**Night:**
1. Close browser tab
2. Double-click `stop-docker.bat`

Your data is always saved automatically.

---

## 🎯 Features for Kids

1. **Time Blocks** - "School (8-3 PM)" instead of hourly
2. **AM/PM Format** - Kid-friendly time display
3. **Color Coding** - Each pillar has a color
4. **Simple UI** - Large buttons, clear labels
5. **Habits Tracker** - Build good habits with streaks
6. **Challenges** - 7-30 day experiments

---

## 👨‍👧 Parent Notes

- Data stays on the laptop (offline app)
- No account needed, no login required
- All data in one file (easy to backup)
- Docker keeps everything isolated (safe)
- Updates: Download new code, copy database file over

---

**Need Help?** Check `DOCKER_SETUP_GUIDE.md` for detailed instructions.
