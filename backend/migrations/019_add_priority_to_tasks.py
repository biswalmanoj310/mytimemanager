"""
Migration: Add priority column to tasks table
Date: 2025-12-07
Description: Adds priority field (Integer 1-10) to tasks for priority management
"""

import sqlite3
import os

def run_migration():
    # Get database path
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    
    print(f"Connecting to database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Add priority column to tasks table
        print("Adding priority column to tasks table...")
        cursor.execute("""
            ALTER TABLE tasks 
            ADD COLUMN priority INTEGER DEFAULT 5
        """)
        
        conn.commit()
        print("✓ Migration completed successfully!")
        print("  - Added priority column (INTEGER, default 5)")
        
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("⚠ Column already exists, skipping...")
        else:
            raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
