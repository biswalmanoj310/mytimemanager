"""
Migration: Add is_completed and completed_at columns to habits table
This allows habits to be manually marked as complete and moved to completed section
"""

import sqlite3
from datetime import datetime

# Path to your database
DB_PATH = "database/mytimemanager.db"

def run_migration():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Adding is_completed column to habits table...")
        cursor.execute("""
            ALTER TABLE habits 
            ADD COLUMN is_completed BOOLEAN DEFAULT 0 NOT NULL
        """)
        
        print("Adding completed_at column to habits table...")
        cursor.execute("""
            ALTER TABLE habits 
            ADD COLUMN completed_at TIMESTAMP NULL
        """)
        
        # Create index on is_completed for faster queries
        print("Creating index on is_completed...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_habits_is_completed 
            ON habits(is_completed)
        """)
        
        conn.commit()
        print("✅ Migration completed successfully!")
        print("   - Added is_completed column (default: False)")
        print("   - Added completed_at column (default: NULL)")
        print("   - Created index on is_completed")
        
    except sqlite3.Error as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Running migration: Add habit completion tracking")
    print("=" * 60)
    run_migration()
