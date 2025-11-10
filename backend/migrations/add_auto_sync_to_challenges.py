"""
Migration: Add auto_sync column to challenges table
Date: 2025-11-09
Description: Add auto_sync boolean flag to enable automatic syncing of challenge progress from linked tasks
"""

import sqlite3
import os
from datetime import datetime

def get_db_path():
    """Get the database path"""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(backend_dir, 'database', 'mytimemanager.db')
    return db_path

def backup_database():
    """Create a backup before migration"""
    db_path = get_db_path()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = f"{db_path}.backup_{timestamp}"
    
    import shutil
    shutil.copy2(db_path, backup_path)
    print(f"✅ Database backed up to: {backup_path}")
    return backup_path

def apply_migration():
    """Apply the migration"""
    db_path = get_db_path()
    
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(challenges)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'auto_sync' in columns:
            print("⚠️  Column 'auto_sync' already exists in challenges table")
            return
        
        print("Adding 'auto_sync' column to challenges table...")
        
        # Add auto_sync column
        cursor.execute("""
            ALTER TABLE challenges 
            ADD COLUMN auto_sync BOOLEAN DEFAULT 0
        """)
        
        print("✅ Added auto_sync column (default: False)")
        
        # Create index for faster queries on challenges with auto_sync enabled
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_challenges_auto_sync 
            ON challenges(auto_sync, linked_task_id) 
            WHERE auto_sync = 1 AND linked_task_id IS NOT NULL
        """)
        
        print("✅ Created index on auto_sync + linked_task_id")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
        # Verify the change
        cursor.execute("PRAGMA table_info(challenges)")
        columns = cursor.fetchall()
        auto_sync_col = [col for col in columns if col[1] == 'auto_sync']
        
        if auto_sync_col:
            print(f"\n✅ Verification: auto_sync column added at position {auto_sync_col[0][0]}")
            print(f"   Type: {auto_sync_col[0][2]}, Not Null: {auto_sync_col[0][3]}, Default: {auto_sync_col[0][4]}")
        
    except sqlite3.Error as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Migration: Add auto_sync to challenges")
    print("=" * 60)
    
    # Backup first
    backup_path = backup_database()
    
    # Apply migration
    try:
        apply_migration()
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
    except Exception as e:
        print("\n" + "=" * 60)
        print(f"❌ Migration failed: {e}")
        print(f"You can restore from backup: {backup_path}")
        print("=" * 60)
        raise
