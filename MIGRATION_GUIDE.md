# 🚀 MyTimeManager - Migration Guide to New Laptop

## 📋 Overview

This guide will help you migrate your MyTimeManager project to a new laptop, including:
- ✅ All your source code
- ✅ All your data (tasks, goals, habits, etc.)
- ✅ Development environment setup

---

## 🎯 Recommended Approach: **Git Clone + Data Copy**

**Why this approach?**
- ✅ Simple and straightforward
- ✅ Full control over your environment
- ✅ Easy to troubleshoot
- ✅ No Docker complexity for a development project
- ✅ Better for active development

**When to use Docker?**
- ❌ Not recommended for this project because:
  - You're actively developing (Docker adds complexity)
  - SQLite database is simple (doesn't need containerization)
  - Local development is faster and easier to debug

---

## 📦 PART 1: Prepare Current Laptop (Mac)

### Step 1: Ensure Latest Code is Pushed

```bash
cd /Users/mbiswal/projects/mytimemanager

# Check if you have uncommitted changes
git status

# If you have changes, commit them
git add .
git commit -m "Final changes before migration"

# Push everything to GitHub
git push origin main
```

### Step 2: Backup Your Database

Your data is stored in: `/Users/mbiswal/projects/mytimemanager/backend/database/mytimemanager.db`

**Manual Backup (Recommended):**
```bash
cd /Users/mbiswal/projects/mytimemanager/backend/database

# Create a backup with timestamp
cp mytimemanager.db mytimemanager_backup_$(date +%Y%m%d_%H%M%S).db

# Copy to a USB drive or cloud storage
cp mytimemanager.db ~/Desktop/mytimemanager_for_new_laptop.db
```

**Or use this script:**

Create a file: `backup_for_migration.sh`

```bash
#!/bin/bash

echo "🔄 MyTimeManager Migration Backup Script"
echo "========================================"

# Set paths
PROJECT_DIR="/Users/mbiswal/projects/mytimemanager"
DB_PATH="$PROJECT_DIR/backend/database/mytimemanager.db"
BACKUP_DIR="$HOME/Desktop/mytimemanager_migration_backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo ""
echo "📦 Step 1: Backing up database..."
if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$BACKUP_DIR/mytimemanager.db"
    echo "✅ Database backed up to: $BACKUP_DIR/mytimemanager.db"
else
    echo "❌ Error: Database not found at $DB_PATH"
    exit 1
fi

echo ""
echo "📊 Step 2: Checking database size..."
DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
echo "   Database size: $DB_SIZE"

echo ""
echo "🔍 Step 3: Counting your data..."
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT 'Tasks' as Table_Name, COUNT(*) as Count FROM tasks
UNION ALL
SELECT 'Daily Entries', COUNT(*) FROM daily_time_entries
UNION ALL
SELECT 'Life Goals', COUNT(*) FROM life_goals
UNION ALL
SELECT 'Habits', COUNT(*) FROM habits
UNION ALL
SELECT 'Projects', COUNT(*) FROM projects
UNION ALL
SELECT 'Wishes', COUNT(*) FROM wishes;
EOF

echo ""
echo "📝 Step 4: Creating migration notes..."
cat > "$BACKUP_DIR/MIGRATION_INFO.txt" <<EOL
MyTimeManager Migration Package
Created: $TIMESTAMP
From: $(hostname)
Database: mytimemanager.db
Database Size: $DB_SIZE

GitHub Repository: https://github.com/biswalmanoj310/mytimemanager
Branch: main

Instructions:
1. Copy this entire folder to your new laptop
2. Follow MIGRATION_GUIDE.md on the new laptop
3. Place mytimemanager.db in: backend/database/

EOL

echo "✅ Migration info created"

echo ""
echo "🎉 Backup Complete!"
echo "📂 Location: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Copy the backup folder to USB/Cloud"
echo "2. Transfer to your new laptop"
echo "3. Follow Part 2 of MIGRATION_GUIDE.md"
echo ""

# Open backup folder
open "$BACKUP_DIR"
```

**Run the backup script:**
```bash
cd /Users/mbiswal/projects/mytimemanager
chmod +x backup_for_migration.sh
./backup_for_migration.sh
```

### Step 3: Verify GitHub Sync

```bash
# Check GitHub has latest code
git log -1

# Note the commit hash - you'll verify this on new laptop
```

---

## 💻 PART 2: Setup New Laptop

### Prerequisites

**Install these on your new laptop:**

1. **Homebrew** (if macOS):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. **Git**:
```bash
brew install git
```

3. **Python 3.10+**:
```bash
brew install python@3.10
```

4. **Node.js 18+**:
```bash
brew install node
```

5. **Configure Git**:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## 🔧 PART 3: Clone and Setup Project

### Step 1: Clone Repository

```bash
# Navigate to where you want the project
cd ~/projects  # or wherever you prefer

# Clone from GitHub
git clone https://github.com/biswalmanoj310/mytimemanager.git

cd mytimemanager

# Verify you have the latest code
git log -1  # Should match the commit hash from old laptop
```

### Step 2: Copy Your Database

```bash
# Copy the database file you backed up
# If you copied it to Desktop:
cp ~/Desktop/mytimemanager_migration_backup/mytimemanager.db ./backend/database/

# Or if from USB:
cp /Volumes/YourUSB/mytimemanager.db ./backend/database/

# Verify the file exists
ls -lh ./backend/database/mytimemanager.db
```

### Step 3: Setup Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Verify database works
python3 -c "import sqlite3; conn = sqlite3.connect('database/mytimemanager.db'); print('✅ Database connected!'); print('Tasks:', conn.execute('SELECT COUNT(*) FROM tasks').fetchone()[0]); conn.close()"

# Start backend server
python3 -m uvicorn app.main:app --reload --port 8000
```

**Keep this terminal open** and test: http://localhost:8000/docs

### Step 4: Setup Frontend (New Terminal)

```bash
cd ~/projects/mytimemanager/frontend  # Adjust path as needed

# Install dependencies
npm install

# Start development server
npm run dev
```

**Keep this terminal open** and test: http://localhost:3003

---

## 🎯 PART 4: Quick Setup Script (New Laptop)

Create this script on your new laptop: `setup_new_laptop.sh`

```bash
#!/bin/bash

echo "🚀 MyTimeManager - New Laptop Setup"
echo "===================================="

# Configuration
PROJECT_NAME="mytimemanager"
GITHUB_REPO="https://github.com/biswalmanoj310/mytimemanager.git"
INSTALL_DIR="$HOME/projects"
BACKUP_DB_PATH="$HOME/Desktop/mytimemanager_migration_backup/mytimemanager.db"

echo ""
echo "📋 Setup Configuration:"
echo "  Project: $PROJECT_NAME"
echo "  Location: $INSTALL_DIR/$PROJECT_NAME"
echo "  Database: $BACKUP_DB_PATH"
echo ""

read -p "Continue with setup? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 1
fi

# Create projects directory
echo ""
echo "📁 Step 1: Creating project directory..."
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Clone repository
echo ""
echo "📦 Step 2: Cloning repository..."
if [ -d "$PROJECT_NAME" ]; then
    echo "⚠️  Project directory already exists. Skipping clone."
    cd "$PROJECT_NAME"
else
    git clone "$GITHUB_REPO"
    cd "$PROJECT_NAME"
    echo "✅ Repository cloned"
fi

# Copy database
echo ""
echo "💾 Step 3: Copying database..."
if [ -f "$BACKUP_DB_PATH" ]; then
    cp "$BACKUP_DB_PATH" "./backend/database/mytimemanager.db"
    echo "✅ Database copied"
else
    echo "⚠️  Database not found at $BACKUP_DB_PATH"
    echo "   You'll need to copy it manually later to:"
    echo "   $INSTALL_DIR/$PROJECT_NAME/backend/database/mytimemanager.db"
fi

# Setup Backend
echo ""
echo "🐍 Step 4: Setting up Python backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "   Creating virtual environment..."
    python3 -m venv venv
fi

echo "   Activating virtual environment..."
source venv/bin/activate

echo "   Installing Python dependencies..."
pip install -r requirements.txt

echo "✅ Backend setup complete"

# Setup Frontend
echo ""
echo "⚛️  Step 5: Setting up React frontend..."
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "   Installing Node dependencies..."
    npm install
else
    echo "   Dependencies already installed"
fi

echo "✅ Frontend setup complete"

# Verify database
echo ""
echo "🔍 Step 6: Verifying database..."
cd ..
python3 -c "
import sqlite3
import os

db_path = 'backend/database/mytimemanager.db'

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print('✅ Database connected successfully!')
    print('')
    print('📊 Your data:')
    
    tables = [
        ('Tasks', 'tasks'),
        ('Daily Entries', 'daily_time_entries'),
        ('Life Goals', 'life_goals'),
        ('Habits', 'habits'),
        ('Projects', 'projects'),
        ('Wishes', 'wishes')
    ]
    
    for name, table in tables:
        try:
            count = cursor.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
            print(f'   {name}: {count}')
        except:
            print(f'   {name}: Table not found')
    
    conn.close()
else:
    print('❌ Database not found!')
    print(f'   Expected location: {db_path}')
    print('   Please copy your database backup there.')
"

# Create start scripts
echo ""
echo "📝 Step 7: Creating start scripts..."

# Backend start script
cat > start_backend.sh <<'EOF'
#!/bin/bash
cd "$(dirname "$0")/backend"
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --port 8000
EOF
chmod +x start_backend.sh

# Frontend start script
cat > start_frontend.sh <<'EOF'
#!/bin/bash
cd "$(dirname "$0")/frontend"
npm run dev
EOF
chmod +x start_frontend.sh

# Combined start script
cat > start_all.sh <<'EOF'
#!/bin/bash
echo "🚀 Starting MyTimeManager..."
echo ""

# Start backend in background
echo "Starting backend server..."
cd "$(dirname "$0")/backend"
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

cd ..

# Wait a bit for backend to start
sleep 3

# Start frontend in background
echo "Starting frontend server..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

cd ..

echo ""
echo "🎉 MyTimeManager is running!"
echo ""
echo "📍 URLs:"
echo "   Frontend: http://localhost:3003"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "📋 Process IDs:"
echo "   Backend:  $BACKEND_PID"
echo "   Frontend: $FRONTEND_PID"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop watching (servers will keep running)"
echo ""

# Keep script running
wait
EOF
chmod +x start_all.sh

echo "✅ Start scripts created:"
echo "   ./start_backend.sh  - Start backend only"
echo "   ./start_frontend.sh - Start frontend only"
echo "   ./start_all.sh      - Start both servers"

# Final instructions
echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📂 Project location: $INSTALL_DIR/$PROJECT_NAME"
echo ""
echo "🚀 To start development:"
echo ""
echo "   cd $INSTALL_DIR/$PROJECT_NAME"
echo "   ./start_all.sh"
echo ""
echo "   Then open: http://localhost:3003"
echo ""
echo "📖 Or start servers separately:"
echo ""
echo "   Terminal 1: ./start_backend.sh"
echo "   Terminal 2: ./start_frontend.sh"
echo ""
echo "Happy coding! 🎨"
echo ""
```

**Save and run on new laptop:**
```bash
chmod +x setup_new_laptop.sh
./setup_new_laptop.sh
```

---

## ✅ PART 5: Verification Checklist

On your new laptop, verify everything works:

### 1. Check Backend
```bash
# Test API
curl http://localhost:8000/api/dashboard/goals/overview

# Should return JSON data
```

### 2. Check Frontend
- Open: http://localhost:3003
- Navigate to Tasks → Daily
- Verify you see your existing tasks
- Check data for a date you know you have entries for

### 3. Test Data Entry
- Go to Daily tab
- Select today's date
- Enter some test data
- Verify it saves (refresh page, data should persist)

### 4. Check All Tabs
- ✅ Tasks (Daily/Weekly)
- ✅ Life Goals (with Dream Board)
- ✅ Projects
- ✅ Misc Tasks
- ✅ Habits (if you created any)

---

## 🔄 PART 6: Development Workflow on New Laptop

### Daily Work

**Start servers:**
```bash
cd ~/projects/mytimemanager
./start_all.sh
```

**Or manually (more control):**

Terminal 1 - Backend:
```bash
cd ~/projects/mytimemanager/backend
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --port 8000
```

Terminal 2 - Frontend:
```bash
cd ~/projects/mytimemanager/frontend
npm run dev
```

### Making Changes

```bash
# Make your code changes

# Test locally

# Commit
git add .
git commit -m "Description of changes"

# Push to GitHub
git push origin main
```

### Syncing Between Laptops (If Needed)

**On old laptop (to get new changes):**
```bash
cd /Users/mbiswal/projects/mytimemanager
git pull origin main
```

**Note:** Database is NOT synced via Git. If you need to sync data:
- Option 1: Copy database file manually (USB/cloud)
- Option 2: Use database export/import scripts
- Option 3: Set up a shared database (more complex)

---

## 🐳 Docker Alternative (Not Recommended for You)

If you still want to try Docker (for reference):

**Pros:**
- Consistent environment
- Easy to share
- Production-ready

**Cons:**
- Slower development (rebuilds needed)
- More complex debugging
- Harder to access database directly
- Overkill for solo development project
- Learning curve

**My recommendation:** Stick with the Git clone approach. You're actively developing, so native setup is better.

---

## 🆘 Troubleshooting

### Backend won't start

```bash
# Check Python version
python3 --version  # Should be 3.10+

# Recreate virtual environment
cd backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend won't start

```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Database not found

```bash
# Check if database exists
ls -lh backend/database/mytimemanager.db

# If missing, copy from backup
cp ~/Desktop/mytimemanager_migration_backup/mytimemanager.db backend/database/
```

### Port already in use

```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Kill process on port 3003
lsof -ti:3003 | xargs kill -9
```

### Git authentication issues

```bash
# Use personal access token
# Go to GitHub → Settings → Developer settings → Personal access tokens
# Generate new token
# Use token as password when pushing
```

---

## 📊 Data Backup Strategy (Going Forward)

### Regular Backups

Create a backup script: `daily_backup.sh`

```bash
#!/bin/bash

BACKUP_DIR="$HOME/Dropbox/MyTimeManager_Backups"  # Or any cloud folder
DATE=$(date +%Y%m%d)
DB_PATH="$HOME/projects/mytimemanager/backend/database/mytimemanager.db"

mkdir -p "$BACKUP_DIR"

cp "$DB_PATH" "$BACKUP_DIR/mytimemanager_$DATE.db"

# Keep only last 30 days
find "$BACKUP_DIR" -name "mytimemanager_*.db" -mtime +30 -delete

echo "✅ Backup created: $BACKUP_DIR/mytimemanager_$DATE.db"
```

**Run daily:**
```bash
chmod +x daily_backup.sh

# Add to crontab (runs daily at 11 PM)
crontab -e
# Add this line:
# 0 23 * * * /Users/yourusername/projects/mytimemanager/daily_backup.sh
```

---

## 📝 Summary

**Recommended Migration Steps:**

1. ✅ **Old Laptop:** Run backup script
2. ✅ **Transfer:** Copy backup folder to new laptop (USB/Cloud)
3. ✅ **New Laptop:** Run setup script
4. ✅ **Verify:** Check all data is present
5. ✅ **Develop:** Continue work on new laptop

**Time Estimate:** 15-30 minutes (mostly install time)

**Approach:** Git Clone + Database Copy ✅ (Not Docker ❌)

---

## 🎯 Quick Reference Commands

**On old laptop (before migration):**
```bash
cd /Users/mbiswal/projects/mytimemanager
git push origin main
./backup_for_migration.sh
```

**On new laptop (after migration):**
```bash
cd ~/projects/mytimemanager
./setup_new_laptop.sh
./start_all.sh
```

---

## 📞 Need Help?

If you encounter issues:
1. Check the troubleshooting section
2. Verify all prerequisites are installed
3. Check logs in `backend.log` and `frontend.log`
4. Ensure database file exists and has correct permissions

---

**Good luck with your migration! 🚀**

*Last updated: October 30, 2025*
