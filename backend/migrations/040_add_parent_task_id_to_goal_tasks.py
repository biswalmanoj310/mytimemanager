#!/usr/bin/env python3
"""
Migration: Add parent_task_id to life_goal_tasks table
Enables hierarchical parent-child task structure for Goal Tasks
"""

import sqlite3
import os

def run_migration():
    # Get database path
    db_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), 
        'database', 
        'mytimemanager.db'
    )
    
    print(f"📁 Database path: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(life_goal_tasks)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'parent_task_id' in columns:
            print("⚠️  Column 'parent_task_id' already exists in life_goal_tasks table")
            return
        
        print("🔧 Adding parent_task_id column to life_goal_tasks table...")
        
        # Add parent_task_id column with foreign key constraint
        cursor.execute("""
            ALTER TABLE life_goal_tasks 
            ADD COLUMN parent_task_id INTEGER 
            REFERENCES life_goal_tasks(id) ON DELETE CASCADE
        """)
        
        # Create index for better query performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_life_goal_tasks_parent_task_id 
            ON life_goal_tasks(parent_task_id)
        """)
        
        conn.commit()
        print("✅ Successfully added parent_task_id column to life_goal_tasks table")
        print("✅ Created index on parent_task_id for better performance")
        
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("⚠️  Column already exists, skipping migration")
        else:
            print(f"❌ Migration failed: {e}")
            raise
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        raise
    finally:
        conn.close()
        print("🔒 Database connection closed")

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Running Migration: Add parent_task_id to life_goal_tasks")
    print("=" * 60)
    run_migration()
    print("=" * 60)
