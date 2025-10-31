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

Next steps on new laptop:
- Clone repository from GitHub
- Copy mytimemanager.db to backend/database/
- Run setup script or follow manual setup
- Verify all data is present

EOL

echo "✅ Migration info created"

echo ""
echo "📋 Step 5: Checking Git status..."
cd "$PROJECT_DIR"
if git rev-parse --git-dir > /dev/null 2>&1; then
    CURRENT_COMMIT=$(git rev-parse HEAD)
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    
    echo "   Current branch: $CURRENT_BRANCH"
    echo "   Latest commit: $CURRENT_COMMIT"
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo ""
        echo "⚠️  Warning: You have uncommitted changes!"
        echo "   Consider running:"
        echo "   git add ."
        echo "   git commit -m 'Changes before migration'"
        echo "   git push origin main"
    else
        echo "   ✅ No uncommitted changes"
    fi
    
    # Save git info
    echo "" >> "$BACKUP_DIR/MIGRATION_INFO.txt"
    echo "Git Information:" >> "$BACKUP_DIR/MIGRATION_INFO.txt"
    echo "Branch: $CURRENT_BRANCH" >> "$BACKUP_DIR/MIGRATION_INFO.txt"
    echo "Commit: $CURRENT_COMMIT" >> "$BACKUP_DIR/MIGRATION_INFO.txt"
else
    echo "   ⚠️  Not a git repository"
fi

echo ""
echo "🎉 Backup Complete!"
echo "📂 Location: $BACKUP_DIR"
echo ""
echo "📋 Backup contents:"
ls -lh "$BACKUP_DIR"

echo ""
echo "✅ Next steps:"
echo "1. Copy '$BACKUP_DIR' to USB/Cloud storage"
echo "2. Transfer to your new laptop"
echo "3. On new laptop, follow MIGRATION_GUIDE.md"
echo ""
echo "💡 Quick tip: You can also push to GitHub first:"
echo "   cd $PROJECT_DIR"
echo "   git push origin main"
echo ""

# Open backup folder
open "$BACKUP_DIR"
