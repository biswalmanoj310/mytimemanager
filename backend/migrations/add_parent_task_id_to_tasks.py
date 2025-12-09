"""
Migration: Add parent_task_id to tasks table
This enables hierarchical task relationships for subtasks
"""

import sqlite3
import os
import sys

# Add parent directory to path to import database config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.config import DATABASE_URL

def run_migration():
    # Extract database path from URL
    db_path = DATABASE_URL.replace('sqlite:///', '')
    
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(tasks)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'parent_task_id' in columns:
            print("✓ Column 'parent_task_id' already exists in tasks table")
            return
        
        print("Adding 'parent_task_id' column to tasks table...")
        
        # Add parent_task_id column
        cursor.execute("""
            ALTER TABLE tasks 
            ADD COLUMN parent_task_id INTEGER 
            REFERENCES tasks(id) ON DELETE CASCADE
        """)
        
        # Create index for performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id 
            ON tasks(parent_task_id)
        """)
        
        conn.commit()
        print("✓ Successfully added parent_task_id column and index")
        
        # Verify the change
        cursor.execute("PRAGMA table_info(tasks)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'parent_task_id' in columns:
            print("✓ Migration verified successfully")
        else:
            print("✗ Migration verification failed")
            
    except Exception as e:
        print(f"✗ Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Migration 018: Add parent_task_id to tasks table")
    print("=" * 60)
    run_migration()
    print("=" * 60)
    print("Migration complete!")
