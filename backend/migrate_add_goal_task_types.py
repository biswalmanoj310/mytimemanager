"""
Migration: Add task type support to life_goal_tasks
Adds: task_type, target_value, unit, allocated_minutes fields
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database.config import get_db

def migrate():
    db = next(get_db())
    
    try:
        print("Adding task type support to life_goal_tasks table...")
        
        # Add new columns to life_goal_tasks
        migrations = [
            "ALTER TABLE life_goal_tasks ADD COLUMN task_type VARCHAR DEFAULT 'time'",
            "ALTER TABLE life_goal_tasks ADD COLUMN target_value INTEGER",
            "ALTER TABLE life_goal_tasks ADD COLUMN current_value INTEGER DEFAULT 0",
            "ALTER TABLE life_goal_tasks ADD COLUMN unit VARCHAR",
            "ALTER TABLE life_goal_tasks ADD COLUMN allocated_minutes INTEGER"
        ]
        
        for migration in migrations:
            try:
                db.execute(text(migration))
                print(f"✅ Executed: {migration}")
            except Exception as e:
                if "duplicate column name" in str(e).lower():
                    print(f"⚠️  Column already exists, skipping: {migration}")
                else:
                    raise
        
        db.commit()
        print("\n✅ Migration completed successfully!")
        print("\nGoal tasks now support:")
        print("  - TIME: Track hours/minutes (default)")
        print("  - COUNT: Track numbers (e.g., 'Complete 5 courses')")
        print("  - BOOLEAN: Yes/No completion (e.g., 'Get certified')")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
