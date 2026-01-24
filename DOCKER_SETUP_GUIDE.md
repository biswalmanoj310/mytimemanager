# 🐳 MyTimeManager - Docker Deployment Guide

## Quick Start (For Your Daughter's Laptop)

### Prerequisites
1. **Install Docker Desktop** (one-time setup):
   - **Windows**: Download from [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
   - **Mac**: Download from [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
   - Install and restart computer if prompted
   - Open Docker Desktop and ensure it's running (whale icon in system tray)

### Step 1: Get the Code

#### Option A: Download ZIP (Easiest)
1. Go to GitHub: `https://github.com/YOUR_USERNAME/mytimemanager`
2. Click green "Code" button → "Download ZIP"
3. Extract ZIP to Desktop or Documents folder
4. Open the extracted folder

#### Option B: Using Git (If Git is installed)
```bash
git clone https://github.com/YOUR_USERNAME/mytimemanager.git
cd mytimemanager
```

### Step 2: Start the App

#### On Windows:
1. Double-click `start-docker.bat`
2. Wait 2-3 minutes for first-time setup
3. Browser will show the app at http://localhost:3000

#### On Mac/Linux:
```bash
chmod +x start-docker.sh stop-docker.sh
./start-docker.sh
```

### Step 3: Use the App
- Open browser: http://localhost:3000
- Your data saves automatically to `backend/database/mytimemanager.db`

### Step 4: Stop the App

#### On Windows:
- Double-click `stop-docker.bat`

#### On Mac/Linux:
```bash
./stop-docker.sh
```

---

## What Does Docker Do?

Docker packages the entire app (Python, Node.js, all dependencies) into containers that work identically on any computer. No need to install Python, Node.js, or any libraries manually!

**Benefits:**
- ✅ One command to start everything
- ✅ Works same on Windows, Mac, Linux
- ✅ No version conflicts or dependency issues
- ✅ Data persists between restarts
- ✅ Easy to update (just re-download and restart)

---

## Data Backup

Your database is stored at:
```
backend/database/mytimemanager.db
```

**To backup:**
1. Stop the app (run stop-docker.bat/sh)
2. Copy `backend/database/mytimemanager.db` to USB drive or cloud storage
3. Restart the app

**To restore:**
1. Stop the app
2. Replace `backend/database/mytimemanager.db` with your backup
3. Restart the app

---

## Sharing Data Between Computers

### On Your Computer (Dad's laptop):
```bash
# Backup your data
./backup_database.sh

# This creates: ~/mytimemanager_backups/mytimemanager_backup_YYYYMMDD_HHMMSS.db.gz
```

### On Daughter's Computer:
1. Copy the backup file to her computer
2. Stop Docker app (stop-docker.bat)
3. Replace `backend/database/mytimemanager.db` with the backup (unzip it first)
4. Start Docker app (start-docker.bat)

---

## Creating Separate Profiles

**Use Case**: Daughter has different pillars/categories than you

### Method 1: Separate Database Files (Recommended)
```bash
# On daughter's laptop, after first run:
1. Stop app (stop-docker.bat)
2. Rename backend/database/mytimemanager.db to mytimemanager_daughter.db
3. Start app (start-docker.bat) - creates fresh database
4. She configures her own pillars via "My Day Design"
```

### Method 2: Use Database Profiles Feature (Built-in)
1. Go to "My Day Design" → "Database Profiles" tab
2. Create test profile for her
3. She can switch between profiles anytime

---

## Troubleshooting

### "Docker is not installed"
- Install Docker Desktop from docker.com
- Restart computer
- Ensure Docker Desktop is running (check system tray)

### "Port 8000 is already in use"
- Another app is using port 8000
- Stop other app or edit `docker-compose.yml`:
  ```yaml
  ports:
    - "8001:8000"  # Change 8000 to 8001
  ```

### "Permission denied" (Mac/Linux)
```bash
chmod +x start-docker.sh stop-docker.sh
```

### App not loading in browser
1. Wait 30 seconds after "SUCCESS!" message
2. Check Docker Desktop → Containers tab (both should be green)
3. View logs: `docker-compose logs -f`

### Need to reset everything
```bash
# Stop and remove all containers/images
docker-compose down --volumes --rmi all

# Start fresh
./start-docker.sh  # or start-docker.bat on Windows
```

---

## Advanced: Updating the App

When you push updates to GitHub:

**On Daughter's Laptop:**
1. Stop app (stop-docker.bat)
2. Backup database (copy `backend/database/mytimemanager.db`)
3. Download new code ZIP and extract
4. Copy backed-up database into new folder
5. Start app (start-docker.bat)

---

## System Requirements

- **RAM**: 2GB minimum, 4GB recommended
- **Disk Space**: 500MB for Docker images + your data
- **OS**: Windows 10/11, macOS 10.15+, or Linux
- **Internet**: Only for initial Docker Desktop install

---

## Default Access URLs

- **Main App**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

---

## Support

If something doesn't work:
1. Check Docker Desktop is running
2. Run `docker-compose logs -f` to see error messages
3. Try stopping and restarting
4. Check GitHub Issues page
5. Contact Dad 😊

---

**Happy Time Tracking!** 🎯
