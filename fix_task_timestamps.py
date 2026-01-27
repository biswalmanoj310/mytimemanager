#!/usr/bin/env python3
"""
Fix task created_at timestamps that were stored in UTC instead of local time.
This script converts UTC timestamps back to local time.
"""

import sqlite3
from datetime import datetime, timedelta
import os

# Database path
db_path = os.path.join(os.path.dirname(__file__), 'backend', 'database', 'mytimemanager.db')

def fix_timestamps():
    """
    Fix created_at timestamps for tasks.
    Windows laptop is PST (UTC-8), so we need to subtract 8 hours from stored UTC times.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Get all tasks with their current created_at timestamps
        cursor.execute("""
            SELECT id, name, created_at 
            FROM tasks 
            WHERE created_at IS NOT NULL
            ORDER BY id
        """)
        
        tasks = cursor.fetchall()
        print(f"Found {len(tasks)} tasks to check")
        print()
        
        # For Windows laptop in PST (UTC-8), subtract 8 hours
        # This converts "2026-01-27 05:54:47" (UTC) back to "2026-01-26 21:54:47" (PST)
        timezone_offset_hours = 8
        
        for task_id, task_name, created_at_str in tasks:
            if created_at_str:
                # Parse the timestamp
                created_at_utc = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                
                # Convert to local time by subtracting offset
                created_at_local = created_at_utc - timedelta(hours=timezone_offset_hours)
                
                # Update the database
                cursor.execute("""
                    UPDATE tasks 
                    SET created_at = ? 
                    WHERE id = ?
                """, (created_at_local.strftime('%Y-%m-%d %H:%M:%S'), task_id))
                
                print(f"✓ Task {task_id} ({task_name}):")
                print(f"  UTC:   {created_at_utc.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"  Local: {created_at_local.strftime('%Y-%m-%d %H:%M:%S')}")
                print()
        
        conn.commit()
        print(f"✅ Fixed timestamps for {len(tasks)} tasks")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("=== Fixing Task Timestamps ===")
    print()
    
    # Backup reminder
    print("⚠️  IMPORTANT: Make sure you have a backup of your database!")
    print(f"   Database: {db_path}")
    print()
    
    response = input("Continue with timestamp fix? (yes/no): ")
    if response.lower() == 'yes':
        fix_timestamps()
    else:
        print("Cancelled.")
