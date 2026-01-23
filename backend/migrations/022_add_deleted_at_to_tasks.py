"""
Migration 022: Add deleted_at column to tasks table
Purpose: Enable soft-delete functionality for tasks
Date: 2026-01-23
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    
    print(f"📊 Migration 022: Adding deleted_at column to tasks table...")
    print(f"📂 Database: {db_path}")
    print(f"🕐 Started at: {datetime.now()}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # ========================================
        # STEP 1: Add deleted_at column to tasks
        # ========================================
        print("\n1️⃣  Adding deleted_at column to tasks table...")
        
        try:
            cursor.execute("ALTER TABLE tasks ADD COLUMN deleted_at DATETIME")
            print("   ✓ Added deleted_at column")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print("   ⚠ deleted_at column already exists, skipping...")
            else:
                raise
        
        # ========================================
        # STEP 2: Mark existing inactive tasks as deleted (optional)
        # ========================================
        print("\n2️⃣  Checking for inactive tasks...")
        
        cursor.execute("SELECT COUNT(*) FROM tasks WHERE is_active = 0 AND deleted_at IS NULL")
        inactive_count = cursor.fetchone()[0]
        
        if inactive_count > 0:
            print(f"   ℹ Found {inactive_count} inactive tasks without deleted_at timestamp")
            print(f"   ⚠ Not auto-setting deleted_at for these (they may be manually inactivated)")
            print(f"   → Use TaskDeletionService.soft_delete_task() for proper deletion")
        else:
            print("   ✓ No inactive tasks found")
        
        # ========================================
        # STEP 3: Verify schema
        # ========================================
        print("\n3️⃣  Verifying schema...")
        
        cursor.execute("PRAGMA table_info(tasks)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'deleted_at' in column_names:
            print("   ✓ deleted_at column exists in tasks table")
        else:
            raise Exception("deleted_at column not found after migration!")
        
        # Commit changes
        conn.commit()
        
        print(f"\n✅ Migration 022 completed successfully!")
        print(f"🕐 Finished at: {datetime.now()}")
        print(f"\n📝 Summary:")
        print(f"   - Added deleted_at column to tasks table")
        print(f"   - Soft-delete functionality now enabled")
        print(f"   - Use TaskDeletionService.soft_delete_task() instead of hard delete")
        print(f"   - Historical time entries remain intact with snapshot data")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {str(e)}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
