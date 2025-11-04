#!/usr/bin/env python3
"""
Script to completely clean all weekly and monthly task data.
This removes:
1. All weekly_time_entries (time logged per day for each week)
2. All weekly_task_status (completed/NA status per week)
3. All monthly_time_entries (time logged per day for each month)
4. All monthly_task_status (completed/NA status per month)

Run this before re-adding tasks to weekly/monthly tabs to avoid ambiguity.
"""

import sqlite3
import os
from datetime import datetime

# Database path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(PROJECT_ROOT, "backend", "database", "mytimemanager.db")

def clean_weekly_monthly_data():
    """Remove all weekly and monthly data from the database."""
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at: {DB_PATH}")
        return
    
    print(f"🗄️  Using database: {DB_PATH}")
    print(f"⏰ Starting cleanup at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Get counts before deletion
        print("📊 Current data counts:")
        cursor.execute("SELECT COUNT(*) FROM weekly_time_entries")
        weekly_time_count = cursor.fetchone()[0]
        print(f"   - weekly_time_entries: {weekly_time_count}")
        
        cursor.execute("SELECT COUNT(*) FROM weekly_task_status")
        weekly_status_count = cursor.fetchone()[0]
        print(f"   - weekly_task_status: {weekly_status_count}")
        
        cursor.execute("SELECT COUNT(*) FROM monthly_time_entries")
        monthly_time_count = cursor.fetchone()[0]
        print(f"   - monthly_time_entries: {monthly_time_count}")
        
        cursor.execute("SELECT COUNT(*) FROM monthly_task_status")
        monthly_status_count = cursor.fetchone()[0]
        print(f"   - monthly_task_status: {monthly_status_count}")
        print()
        
        total_records = weekly_time_count + weekly_status_count + monthly_time_count + monthly_status_count
        
        if total_records == 0:
            print("✅ All tables are already empty. Nothing to clean.")
            return
        
        # Confirm deletion
        print(f"⚠️  WARNING: About to delete {total_records} records!")
        response = input("❓ Are you sure you want to proceed? (yes/no): ")
        
        if response.lower() != 'yes':
            print("❌ Cleanup cancelled.")
            return
        
        print()
        print("🧹 Cleaning up data...")
        
        # Delete all weekly time entries
        cursor.execute("DELETE FROM weekly_time_entries")
        print(f"   ✓ Deleted {weekly_time_count} records from weekly_time_entries")
        
        # Delete all weekly task status
        cursor.execute("DELETE FROM weekly_task_status")
        print(f"   ✓ Deleted {weekly_status_count} records from weekly_task_status")
        
        # Delete all monthly time entries
        cursor.execute("DELETE FROM monthly_time_entries")
        print(f"   ✓ Deleted {monthly_time_count} records from monthly_time_entries")
        
        # Delete all monthly task status
        cursor.execute("DELETE FROM monthly_task_status")
        print(f"   ✓ Deleted {monthly_status_count} records from monthly_task_status")
        
        # Commit the changes
        conn.commit()
        
        print()
        print("✅ Cleanup completed successfully!")
        print(f"📝 Total records deleted: {total_records}")
        print()
        print("💡 You can now add tasks to weekly/monthly tabs without any ambiguity.")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    clean_weekly_monthly_data()
