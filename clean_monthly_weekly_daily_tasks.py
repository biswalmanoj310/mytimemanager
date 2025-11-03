#!/usr/bin/env python3
"""
Clean Monthly/Weekly Daily Tasks Script
Removes daily task references from monthly_time_entries and monthly_task_status tables
This allows starting fresh with monthly tracking for tasks that should be tracked monthly,
not just aggregating daily tasks.
"""

import sqlite3
import os
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "backend" / "database" / "mytimemanager.db"

def clean_daily_tasks_from_monthly():
    """Remove daily tasks from monthly tracking tables"""
    
    if not DB_PATH.exists():
        print(f"❌ Database not found at: {DB_PATH}")
        return False
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("🔍 Checking for daily tasks in monthly tracking...")
        
        # Count tasks to be deleted
        cursor.execute("""
            SELECT COUNT(*) FROM monthly_time_entries 
            WHERE task_id IN (SELECT id FROM tasks WHERE follow_up_frequency = 'daily')
        """)
        monthly_entries_count = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM monthly_task_status 
            WHERE task_id IN (SELECT id FROM tasks WHERE follow_up_frequency = 'daily')
        """)
        monthly_status_count = cursor.fetchone()[0]
        
        print(f"📊 Found {monthly_entries_count} monthly time entries for daily tasks")
        print(f"📊 Found {monthly_status_count} monthly task status records for daily tasks")
        
        if monthly_entries_count == 0 and monthly_status_count == 0:
            print("✅ No daily tasks found in monthly tracking. Nothing to clean!")
            conn.close()
            return True
        
        # Confirm deletion
        response = input(f"\n⚠️  This will delete {monthly_entries_count + monthly_status_count} records. Continue? (yes/no): ")
        if response.lower() != 'yes':
            print("❌ Operation cancelled")
            conn.close()
            return False
        
        print("\n🧹 Cleaning up...")
        
        # Delete from monthly_time_entries
        cursor.execute("""
            DELETE FROM monthly_time_entries 
            WHERE task_id IN (SELECT id FROM tasks WHERE follow_up_frequency = 'daily')
        """)
        deleted_entries = cursor.rowcount
        print(f"✅ Deleted {deleted_entries} records from monthly_time_entries")
        
        # Delete from monthly_task_status
        cursor.execute("""
            DELETE FROM monthly_task_status 
            WHERE task_id IN (SELECT id FROM tasks WHERE follow_up_frequency = 'daily')
        """)
        deleted_status = cursor.rowcount
        print(f"✅ Deleted {deleted_status} records from monthly_task_status")
        
        # Now clean weekly tables as well
        print("\n🔍 Checking for daily tasks in weekly tracking...")
        
        cursor.execute("""
            SELECT COUNT(*) FROM weekly_time_entries 
            WHERE task_id IN (SELECT id FROM tasks WHERE follow_up_frequency = 'daily')
        """)
        weekly_entries_count = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM weekly_task_status 
            WHERE task_id IN (SELECT id FROM tasks WHERE follow_up_frequency = 'daily')
        """)
        weekly_status_count = cursor.fetchone()[0]
        
        print(f"📊 Found {weekly_entries_count} weekly time entries for daily tasks")
        print(f"📊 Found {weekly_status_count} weekly task status records for daily tasks")
        
        if weekly_entries_count > 0 or weekly_status_count > 0:
            # Delete from weekly_time_entries
            cursor.execute("""
                DELETE FROM weekly_time_entries 
                WHERE task_id IN (SELECT id FROM tasks WHERE follow_up_frequency = 'daily')
            """)
            deleted_weekly_entries = cursor.rowcount
            print(f"✅ Deleted {deleted_weekly_entries} records from weekly_time_entries")
            
            # Delete from weekly_task_status
            cursor.execute("""
                DELETE FROM weekly_task_status 
                WHERE task_id IN (SELECT id FROM tasks WHERE follow_up_frequency = 'daily')
            """)
            deleted_weekly_status = cursor.rowcount
            print(f"✅ Deleted {deleted_weekly_status} records from weekly_task_status")
        
        # Commit changes
        conn.commit()
        
        print("\n✨ Cleanup complete!")
        print("📝 Summary:")
        print(f"   - Monthly time entries deleted: {deleted_entries}")
        print(f"   - Monthly task status deleted: {deleted_status}")
        print(f"   - Weekly time entries deleted: {deleted_weekly_entries if weekly_entries_count > 0 else 0}")
        print(f"   - Weekly task status deleted: {deleted_weekly_status if weekly_status_count > 0 else 0}")
        print(f"   - Total records deleted: {deleted_entries + deleted_status + (deleted_weekly_entries if weekly_entries_count > 0 else 0) + (deleted_weekly_status if weekly_status_count > 0 else 0)}")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("  Clean Monthly/Weekly Daily Tasks Script")
    print("=" * 60)
    print()
    print("This script removes daily task references from monthly and")
    print("weekly tracking tables, allowing you to start fresh with")
    print("monthly/weekly specific tasks.")
    print()
    
    success = clean_daily_tasks_from_monthly()
    
    if success:
        print("\n✅ Script completed successfully!")
        exit(0)
    else:
        print("\n❌ Script failed!")
        exit(1)
