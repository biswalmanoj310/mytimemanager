"""
Migration: Phase 1 - Add unified fields to existing tables (NON-BREAKING)
- Add priority INTEGER to project_tasks (convert high=2, medium=5, low=8)
- Add allocated_minutes INTEGER to project_tasks
- Add priority INTEGER to goal_tasks  
- Add allocated_minutes INTEGER to goal_tasks
- Add task_type TEXT to tasks table
"""

import sqlite3
import sys
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent.parent / "database" / "mytimemanager.db"

def migrate():
    db_path = str(DB_PATH)
    print(f"Connecting to database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 1. Add priority INTEGER to project_tasks
        print("\n1. Adding priority INTEGER column to project_tasks...")
        try:
            cursor.execute("ALTER TABLE project_tasks ADD COLUMN priority_new INTEGER")
            print("   ✓ Added priority_new column")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print("   ⚠ Column already exists, skipping")
            else:
                raise
        
        # Convert string priority to integer
        print("   Converting priority values (high=2, medium=5, low=8)...")
        cursor.execute("""
            UPDATE project_tasks 
            SET priority_new = CASE 
                WHEN priority = 'high' THEN 2
                WHEN priority = 'medium' THEN 5
                WHEN priority = 'low' THEN 8
                ELSE 5
            END
            WHERE priority_new IS NULL
        """)
        print(f"   ✓ Converted {cursor.rowcount} project task priorities")
        
        # 2. Add allocated_minutes to project_tasks
        print("\n2. Adding allocated_minutes to project_tasks...")
        try:
            cursor.execute("ALTER TABLE project_tasks ADD COLUMN allocated_minutes INTEGER DEFAULT 60")
            print("   ✓ Added allocated_minutes column (default 60 min)")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print("   ⚠ Column already exists, skipping")
            else:
                raise
        
        # 3. Check if goal_tasks table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='goal_tasks'")
        if cursor.fetchone():
            print("\n3. Adding priority INTEGER column to goal_tasks...")
            try:
                cursor.execute("ALTER TABLE goal_tasks ADD COLUMN priority INTEGER DEFAULT 5")
                print("   ✓ Added priority column (default 5)")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    print("   ⚠ Column already exists, skipping")
                else:
                    raise
            
            print("\n4. Adding allocated_minutes to goal_tasks...")
            try:
                cursor.execute("ALTER TABLE goal_tasks ADD COLUMN allocated_minutes INTEGER DEFAULT 60")
                print("   ✓ Added allocated_minutes column (default 60 min)")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    print("   ⚠ Column already exists, skipping")
                else:
                    raise
        else:
            print("\n3-4. ⚠ goal_tasks table not found, skipping")
        
        # 5. Add task_type to tasks table
        print("\n5. Adding task_type to tasks table...")
        try:
            cursor.execute("ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'regular'")
            print("   ✓ Added task_type column")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print("   ⚠ Column already exists, skipping")
            else:
                raise
        
        # Update existing tasks to have task_type = 'regular'
        cursor.execute("UPDATE tasks SET task_type = 'regular' WHERE task_type IS NULL")
        print(f"   ✓ Set task_type for {cursor.rowcount} existing tasks")
        
        conn.commit()
        print("\n✅ Phase 1 migration completed successfully!")
        
        # Summary
        cursor.execute("SELECT COUNT(*) FROM project_tasks")
        project_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM tasks")
        task_count = cursor.fetchone()[0]
        
        print(f"\n📊 Summary:")
        print(f"   - {project_count} project tasks now have integer priority + allocated_minutes")
        print(f"   - {task_count} regular tasks now have task_type field")
        print(f"   - All changes are non-breaking (old columns still exist)")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Phase 1: Add Unified Fields (Non-Breaking Migration)")
    print("=" * 60)
    migrate()
