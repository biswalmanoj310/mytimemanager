"""
Migration: Add 'project_task' to follow_up_frequency enum
This migration is safe to run - it only adds a new enum value, doesn't modify existing data
"""
import sqlite3
import os

def run_migration():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # SQLite doesn't enforce enum constraints, so this is informational
        # The new enum value is already defined in the backend model
        print("✓ Migration 021: project_task frequency type added to backend enum")
        print("  No database schema changes needed (SQLite stores as text)")
        print("  Existing tasks remain unchanged")
        print("  New tasks can now use follow_up_frequency='project_task'")
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
