# Database Information - MyTimeManager

## 📂 Database Location

**Active Database:**
```
/Users/mbiswal/projects/mytimemanager/backend/database/mytimemanager.db
```

**Relative Path from Project Root:**
```
./backend/database/mytimemanager.db
```

## 🔧 Database Configuration

- **Type:** SQLite
- **Configuration File:** `backend/app/database/config.py`
- **Environment Variable:** `DATABASE_URL` (defaults to above path)
- **Size:** ~816 KB (as of Nov 9, 2025)
- **Last Modified:** Nov 9, 2025 08:05

## 💾 Backup Information

### Automatic Backups
- **Backup Script:** `backup_database.sh` (in project root)
- **Backup Location:** `~/mytimemanager_backups/`
- **Backup Format:** `mytimemanager_backup_YYYYMMDD_HHMMSS.db.gz` (compressed)
- **Retention Period:** 60 days
- **Backup Log:** `~/mytimemanager_backups/backup_log.txt`

### Manual Backup Commands
```bash
# Quick backup
./backup_database.sh

# Manual backup (from project root)
cp backend/database/mytimemanager.db ~/mytimemanager_backups/manual_backup_$(date +%Y%m%d_%H%M%S).db

# Restore from backup
cp ~/mytimemanager_backups/mytimemanager_backup_YYYYMMDD_HHMMSS.db backend/database/mytimemanager.db
```

## 🗃️ Database Schema

### Main Tables
- **pillars** - Life areas (e.g., Career, Health, Relationships)
- **categories** - Sub-areas under pillars
- **sub_categories** - Fine-grained categories
- **goals** - Time-based goals with allocated hours
- **life_goals** - Long-term aspirational goals
- **projects** - Structured task containers with dependencies
- **tasks** - Individual tasks (daily/weekly/monthly/today/project)
- **habits** - Ongoing behavioral patterns
- **challenges** - Time-bound experiments (7-30 days)
- **wishes** - Dreams and aspirations
- **time_entries** - Actual time tracking records

### Challenge Table Structure (Updated)
```sql
CREATE TABLE challenges (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    challenge_type TEXT NOT NULL,  -- daily_streak, count_based, accumulation
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Tracking fields
    target_days INTEGER,
    target_count INTEGER,
    target_value REAL,
    unit TEXT,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    completed_days INTEGER DEFAULT 0,
    current_count INTEGER DEFAULT 0,
    current_value REAL DEFAULT 0.0,
    
    -- Status
    status TEXT DEFAULT 'active',
    is_completed BOOLEAN DEFAULT 0,
    completion_date DATETIME,
    
    -- Links
    pillar_id INTEGER REFERENCES pillars(id),
    category_id INTEGER REFERENCES categories(id),
    sub_category_id INTEGER REFERENCES sub_categories(id),
    linked_task_id INTEGER REFERENCES tasks(id),
    goal_id INTEGER REFERENCES goals(id),  -- NEW
    project_id INTEGER REFERENCES projects(id),  -- NEW
    
    -- Metadata
    difficulty TEXT,
    reward TEXT,
    why_reason TEXT,
    can_graduate_to_habit BOOLEAN DEFAULT 0,
    graduated_habit_id INTEGER REFERENCES habits(id),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);
```

## 🔄 Running Migrations

### General Process
1. **Always backup first:**
   ```bash
   ./backup_database.sh
   ```

2. **Run migration:**
   ```bash
   cd backend
   python migrations/migration_script_name.py
   ```

3. **Verify migration:**
   ```bash
   sqlite3 database/mytimemanager.db "PRAGMA table_info(table_name);"
   ```

### Recent Migrations
- `add_goal_project_to_challenges.py` - Adds goal_id and project_id to challenges

## 🛠️ Database Access

### Using SQLite CLI
```bash
# Open database
sqlite3 backend/database/mytimemanager.db

# Useful commands
.tables                          # List all tables
.schema table_name              # Show table structure
SELECT * FROM challenges;       # Query data
.quit                          # Exit
```

### Using Python
```python
from app.database.config import get_db

# In FastAPI endpoint
def some_endpoint(db: Session = Depends(get_db)):
    # Use db here
    pass
```

## ⚠️ Important Notes

1. **Production Data:** This database contains real user data - always backup before migrations
2. **Git Ignore:** Database files are in `.gitignore` - never commit the `.db` file
3. **Multi-Database:** Multiple `.db` files exist in backend folder, but only `backend/database/mytimemanager.db` is active
4. **Migration Safety:** All migrations should check if columns/tables exist before adding them
5. **Backup Before Changes:** Always run `./backup_database.sh` before schema changes

## 📊 Database Statistics

**Current Data (approximate):**
- Active challenges with progress tracking
- Multiple goals and projects
- Daily/Weekly/Monthly tasks
- Habits with streak tracking
- Time entries with actual hours
- Pillar and category hierarchies

## 🔍 Common Queries

### Check if challenge columns exist
```sql
PRAGMA table_info(challenges);
```

### Count active challenges
```sql
SELECT COUNT(*) FROM challenges WHERE status = 'active' AND is_active = 1;
```

### View challenge links
```sql
SELECT 
    c.name as challenge_name,
    p.name as pillar_name,
    cat.name as category_name,
    g.name as goal_name,
    pr.name as project_name
FROM challenges c
LEFT JOIN pillars p ON c.pillar_id = p.id
LEFT JOIN categories cat ON c.category_id = cat.id
LEFT JOIN goals g ON c.goal_id = g.id
LEFT JOIN projects pr ON c.project_id = pr.id
WHERE c.is_active = 1;
```

## 📝 Maintenance Tips

1. **Regular Backups:** Run `./backup_database.sh` daily
2. **Check Size:** Monitor database growth: `du -h backend/database/mytimemanager.db`
3. **Clean Old Data:** Archive completed challenges/tasks periodically
4. **Vacuum Database:** Optimize space: `sqlite3 backend/database/mytimemanager.db "VACUUM;"`
5. **Verify Integrity:** Check for corruption: `sqlite3 backend/database/mytimemanager.db "PRAGMA integrity_check;"`

---

**Last Updated:** November 9, 2025
**Maintained by:** Claude Sonnet 4.5 (AI Assistant)
