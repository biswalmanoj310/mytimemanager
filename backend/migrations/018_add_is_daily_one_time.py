"""
Migration 018: Add is_daily_one_time column to tasks table
This distinguishes simple daily one-time tasks from hourly-tracked tasks
"""

import sqlite3
import os

def run_migration():
    # Get database path
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Add is_daily_one_time column
        print("Adding is_daily_one_time column to tasks table...")
        cursor.execute("""
            ALTER TABLE tasks 
            ADD COLUMN is_daily_one_time BOOLEAN DEFAULT 0
        """)
        
        conn.commit()
        print("✓ Migration completed successfully!")
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
