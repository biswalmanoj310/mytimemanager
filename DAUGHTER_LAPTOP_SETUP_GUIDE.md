# 🎯 MyTimeManager Setup Guide for Daughter's Laptop (Windows)

## Complete Step-by-Step Instructions

**Time Required:** 20-30 minutes  
**Difficulty:** Easy - just follow the steps!

---

## ✅ Pre-Requisites

- Windows 10 or Windows 11
- Administrator access on the laptop
- Internet connection
- GitHub account (optional - can download ZIP instead)

---

## 📥 Step 1: Install Docker Desktop (10 minutes)

### 1.1 Download Docker Desktop

1. Open web browser (Chrome/Edge/Firefox)
2. Go to: **https://www.docker.com/products/docker-desktop/**
3. Click the big blue button **"Download for Windows"**
4. Save file to Downloads folder (around 500 MB)

### 1.2 Install Docker Desktop

1. Open **Downloads** folder
2. Double-click **Docker Desktop Installer.exe**
3. When prompted, click **"Yes"** to allow changes
4. Installation window appears:
   - ✅ Check **"Use WSL 2 instead of Hyper-V"** (recommended)
   - ✅ Check **"Add shortcut to desktop"**
   - Click **"Ok"**
5. Wait for installation (5-10 minutes)
6. Click **"Close and restart"** when done
7. **Computer will restart** - this is normal!

### 1.3 Start Docker Desktop (After Restart)

1. After restart, Docker Desktop should auto-start
2. If not, double-click **"Docker Desktop"** icon on desktop
3. Accept the Docker Subscription Service Agreement
4. You'll see the Docker Desktop window
5. Wait for the message **"Docker Desktop is running"** (bottom left shows green)

### 1.4 Verify Docker is Working

1. Press **Windows Key + R**
2. Type: `cmd` and press **Enter**
3. In the command prompt, type:
   ```cmd
   docker --version
   ```
4. You should see something like: `Docker version 24.0.7, build xyz`
5. Type `exit` to close command prompt

**✅ Docker is installed!**

---

## 📦 Step 2: Download MyTimeManager Code (5 minutes)

### Option A: Download from GitHub (Easier - No Git Required)

1. Open web browser
2. Go to: **https://github.com/biswalmanoj310/mytimemanager**
3. Click the green **"<> Code"** button
4. Click **"Download ZIP"**
5. Save to **Downloads** folder
6. Open **Downloads** folder
7. Right-click **mytimemanager-main.zip**
8. Click **"Extract All..."**
9. Click **"Browse..."** and select **Desktop**
10. Click **"Extract"**
11. You'll now have a folder on Desktop: **mytimemanager-main**
12. **Rename** it to just **mytimemanager** (remove "-main")

### Option B: Clone with Git (If Git is installed)

1. Press **Windows Key + R**
2. Type: `cmd` and press **Enter**
3. Type these commands:
   ```cmd
   cd Desktop
   git clone https://github.com/biswalmanoj310/mytimemanager.git
   ```
4. Wait for download to complete
5. Type `exit` to close command prompt

**✅ Code is downloaded to Desktop\mytimemanager!**

---

## 🚀 Step 3: Start MyTimeManager (5 minutes)

### 3.1 Navigate to Project Folder

1. Open **Desktop** folder
2. You should see **mytimemanager** folder
3. Double-click to open it
4. You should see files like:
   - `start-docker.bat` ✅
   - `stop-docker.bat`
   - `backup-now.bat`
   - `README.md`
   - `frontend` folder
   - `backend` folder

### 3.2 First-Time Setup

1. Find **start-docker.bat** file
2. **Right-click** on it
3. Select **"Run as administrator"** (important!)
4. A black command window will appear

### 3.3 Wait for Setup to Complete

You'll see several messages:

```
Checking Docker Desktop status...
✓ Docker Desktop is running

Starting MyTimeManager with Docker...
This is your first time running the app.
Creating Docker images (this will take a few minutes)...

Building backend...
Step 1/15 : FROM python:3.9-slim
...
✓ Backend image created

Building frontend...
Step 1/12 : FROM node:18-alpine
...
✓ Frontend image created

Starting containers...
✓ Backend started
✓ Frontend started

==========================================
🎉 MyTimeManager is running!
==========================================

Access the app at:
➜  http://localhost:3000

To stop the app, run: stop-docker.bat
==========================================
```

**First-time setup takes 5-10 minutes** (downloading and building)  
**Subsequent starts take only 10-30 seconds!**

### 3.4 Open the App

1. Open web browser (Chrome/Edge/Firefox)
2. Go to: **http://localhost:3000**
3. You should see the MyTimeManager app! 🎉

**✅ App is running!**

---

## 🎓 Step 4: First-Time Configuration (5 minutes)

### 4.1 Set Up Your Pillars

1. Click **"Settings"** (gear icon) or **"Admin"** tab
2. Set up your three 8-hour pillars:
   - **Hard Work** 💼 (School, Homework, Study)
   - **Calmness** 🧘 (Rest, Hobbies, Reading)
   - **Family** 👨‍👩‍👦 (Parents, Siblings, Pets)

### 4.2 Add Categories

For each pillar, add categories. For example:

**Hard Work:**
- School
- Homework
- Study
- Projects

**Calmness:**
- Exercise
- Reading
- Music
- Rest

**Family:**
- Parents
- Siblings
- Pets
- Chores

### 4.3 Set Up Time Blocks (Optional but Recommended)

1. Go to **"My Day Design"** tab
2. Click **"Time Blocks"** sub-tab
3. You'll see a **"School Day"** template already there
4. Click **"Activate"** to use it
5. This gives you a kid-friendly schedule with:
   - 🌅 Morning (6 AM - 12 PM)
   - ☀️ Afternoon (12 PM - 6 PM)
   - 🌙 Evening (6 PM - 12 AM)
   - 🌃 Night (12 AM - 6 AM)

### 4.4 Create Your First Task

1. Go to **"Daily"** tab
2. Click **"+ Add Task"**
3. Fill in:
   - **Title:** "Math homework"
   - **Pillar:** Hard Work
   - **Category:** Homework
   - **Allocated Time:** 60 minutes
4. Click **"Save"**

**✅ You're ready to use MyTimeManager!**

---

## 🔄 Daily Usage

### Starting the App

1. Go to **Desktop\mytimemanager** folder
2. Double-click **start-docker.bat**
3. Wait 10-30 seconds
4. Open browser to **http://localhost:3000**

### Stopping the App

1. Go to **Desktop\mytimemanager** folder
2. Double-click **stop-docker.bat**
3. Wait a few seconds
4. Done!

**Or:**
- Close the browser tab
- Docker will keep running in the background (uses minimal resources)
- Can leave it running all the time if you want!

---

## 🛡️ Automatic Backups (Already Working!)

### What Happens Automatically

- ✅ Backup runs at **2:00 AM every night**
- ✅ Backups saved in: `Desktop\mytimemanager\backend\database\backups\`
- ✅ Old backups auto-deleted after 30 days
- ✅ **You don't need to do anything!**

### Manual Backup (Before Making Big Changes)

1. Go to **Desktop\mytimemanager** folder
2. Double-click **backup-now.bat**
3. Wait a few seconds
4. Done! Backup saved

### If Something Goes Wrong (Dad Can Fix It)

1. Go to **Desktop\mytimemanager** folder
2. Double-click **restore-backup.bat**
3. Choose which backup to restore
4. Type **YES** to confirm
5. Done! Everything restored

---

## 📂 Folder Structure (What's What)

```
Desktop\
└── mytimemanager\
    ├── start-docker.bat          ← Start the app (double-click this!)
    ├── stop-docker.bat           ← Stop the app
    ├── backup-now.bat            ← Manual backup
    ├── restore-backup.bat        ← Restore from backup (if needed)
    ├── check-setup.bat           ← Check if Docker is working
    ├── frontend\                 ← App frontend (UI)
    ├── backend\                  ← App backend (API)
    │   └── database\
    │       ├── mytimemanager.db  ← Your data (DO NOT DELETE!)
    │       └── backups\          ← Automatic backups (safe to delete old ones)
    └── README.md                 ← Project information
```

**Important:**
- **DO NOT DELETE** the `backend\database` folder
- **DO NOT DELETE** `mytimemanager.db` file
- **DO NOT RENAME** the `mytimemanager` folder

---

## 🔧 Troubleshooting

### Problem: "Docker is not running"

**Solution:**
1. Open **Docker Desktop** from Start menu
2. Wait for green "Docker Desktop is running" message
3. Try **start-docker.bat** again

### Problem: "Port 3000 is already in use"

**Solution:**
1. Run **stop-docker.bat**
2. Wait 10 seconds
3. Run **start-docker.bat** again

### Problem: "Cannot connect to http://localhost:3000"

**Solution:**
1. Wait 1-2 minutes (app might still be starting)
2. Refresh browser page
3. If still not working, run **stop-docker.bat** then **start-docker.bat**

### Problem: App is slow or frozen

**Solution:**
1. Run **stop-docker.bat**
2. Restart Docker Desktop
3. Run **start-docker.bat**

### Problem: Lost all my data!

**Solution:**
1. Don't panic! Backups exist
2. Run **restore-backup.bat**
3. Choose yesterday's backup
4. Type **YES**
5. Data restored!

### Problem: Docker won't start after Windows update

**Solution:**
1. Restart computer
2. Open Docker Desktop
3. If still not working, uninstall and reinstall Docker Desktop

---

## 📞 Getting Help

### Before Calling Dad:

1. **Check Docker Desktop is running** (green icon in system tray)
2. **Try stop-docker.bat then start-docker.bat** (fixes 80% of issues)
3. **Check browser is at http://localhost:3000** (not https or different port)
4. **Try different browser** (Chrome usually works best)

### When Calling Dad:

Tell him:
- What were you trying to do?
- What error message do you see? (take a screenshot!)
- Did you try stop-docker.bat and start-docker.bat?
- Is Docker Desktop showing green "running" status?

### Dad's Remote Help

Dad can help remotely:
1. You give him TeamViewer/AnyDesk access
2. He can see your screen
3. He can run commands to fix issues
4. He can restore from backup if needed

---

## 🎉 Tips for Success

### Make It Easy

1. **Create Desktop shortcut:**
   - Right-click **start-docker.bat**
   - Select **"Create shortcut"**
   - Drag shortcut to Desktop
   - Rename to **"Start MyTimeManager"**
   - Now just double-click this every day!

2. **Browser bookmark:**
   - Open http://localhost:3000
   - Press **Ctrl + D** to bookmark
   - Name it **"MyTimeManager"**
   - Now it's in your bookmarks!

3. **Windows Startup (Optional):**
   - If you want app to start automatically when Windows starts:
   - Press **Windows Key + R**
   - Type: `shell:startup` and press Enter
   - Copy **start-docker.bat** into this folder
   - Now it auto-starts with Windows!

### Weekly Routine

**Every Sunday evening:**
1. Go to `Desktop\mytimemanager\backend\database\backups\`
2. Copy the latest backup file
3. Paste to USB drive or OneDrive folder
4. That's your weekly safety backup!

### Monthly Checkup

**First Sunday of each month:**
1. Run **backup-now.bat** (test manual backup)
2. Run **restore-backup.bat** (test restore works)
3. Check backups folder has files
4. Tell Dad it's all working!

---

## 📊 Expected Disk Space

| Item | Size | Notes |
|------|------|-------|
| Docker Desktop | ~2 GB | One-time installation |
| MyTimeManager Code | ~50 MB | Frontend + Backend |
| Docker Images | ~800 MB | Built on first run |
| Database | ~1 MB | Grows slowly over time |
| 30 Days Backups | ~15 MB | Auto-deleted after 30 days |
| **Total** | **~3 GB** | One-time setup |

**After setup, app uses:**
- Disk: ~1 GB (data + backups)
- RAM: ~500 MB when running
- CPU: Minimal (only when using app)

---

## 🎯 Quick Command Reference

| What You Want | Command |
|---------------|---------|
| Start app | Double-click `start-docker.bat` |
| Stop app | Double-click `stop-docker.bat` |
| Open app | Browser → http://localhost:3000 |
| Manual backup | Double-click `backup-now.bat` |
| Restore backup | Double-click `restore-backup.bat` |
| Check Docker | Double-click `check-setup.bat` |
| View backups | Open `backend\database\backups\` |

---

## ✅ Success Checklist

After setup, you should have:
- [x] Docker Desktop installed and running (green icon)
- [x] mytimemanager folder on Desktop
- [x] App starts with start-docker.bat
- [x] Browser opens to http://localhost:3000
- [x] Pillars and categories configured
- [x] First task created and completed
- [x] Desktop shortcut created for easy access
- [x] Browser bookmark saved
- [x] Backup folder has at least one backup
- [x] Dad's phone number saved for help 😊

---

## 🎓 Learning Curve

**Day 1:** "What is Docker?" → Just follow the steps!  
**Day 2:** "How do I start it?" → Double-click start-docker.bat!  
**Week 1:** "It's working!" → Creating tasks, tracking time  
**Month 1:** "This is easy!" → Daily habit, automatic backups  
**Month 3:** "Can't live without it!" → Part of daily routine

---

## 💝 Dad's Notes

**Dear [Daughter's Name],**

This app will help you organize your time and balance school, hobbies, and family. Here's what I want you to know:

1. **Don't worry about breaking it** - Everything auto-backs up, I can fix anything
2. **Experiment!** - Try different categories, time blocks, goals
3. **It's yours** - Customize it however you want
4. **Track honestly** - Don't fake the numbers, it's for YOUR benefit
5. **Call me anytime** - I'm always happy to help or improve it

The three pillars (Hard Work, Calmness, Family) are about **balance**. Each gets 8 hours per day. This helps you:
- Work hard on school (but not TOO hard)
- Take care of yourself (rest, hobbies)
- Spend time with family (that's us!)

You've got this! 💪

Love,  
Dad

---

## 🚀 You're All Set!

**Next Steps:**
1. ✅ Complete the setup above
2. ✅ Use the app for one week
3. ✅ Call Dad and tell him how it's going
4. ✅ Share ideas for improvements

**Remember:** I built this FOR YOU. It's meant to help, not stress you out. Use it your way!

---

## 📅 Setup Day Checklist

Print this and check off as you go:

```
SETUP DAY - [Date: _____________]

□ Downloaded Docker Desktop installer
□ Installed Docker Desktop
□ Restarted computer
□ Verified Docker is running (green icon)
□ Downloaded mytimemanager code
□ Extracted to Desktop
□ Ran start-docker.bat (as administrator)
□ Waited for "App is running" message
□ Opened http://localhost:3000 in browser
□ Configured three pillars
□ Added categories for each pillar
□ Activated "School Day" time blocks
□ Created first task
□ Completed first task
□ Created Desktop shortcut
□ Created browser bookmark
□ Checked backup folder exists
□ Ran backup-now.bat successfully
□ Called Dad to say "It works!" 📞

TOTAL TIME: _______ minutes
DIFFICULTY: □ Easy  □ Medium  □ Hard

NOTES:
_________________________________
_________________________________
_________________________________

Dad's signature: _______________
```

---

**Good luck! You've got this! 🎉**

If you need help, I'm just a phone call away! 📞

