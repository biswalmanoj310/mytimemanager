#!/usr/bin/env python3
"""
Clean up weekly/monthly status entries for tasks that were not being monitored.
"""

import sqlite3
from datetime import datetime

def main():
    conn = sqlite3.connect('backend/database/mytimemanager.db')
    cursor = conn.cursor()
    
    # Find Interview tasks
    cursor.execute("SELECT id, name FROM tasks WHERE name LIKE '%Interview%' OR name LIKE '%interview%'")
    tasks = cursor.fetchall()
    
    print("=== Tasks Found ===")
    for task in tasks:
        print(f"  ID {task[0]}: {task[1]}")
    
    if not tasks:
        print("No interview tasks found!")
        conn.close()
        return
    
    task_ids = [t[0] for t in tasks]
    placeholders = ','.join('?' * len(task_ids))
    
    # Check weekly status entries
    print("\n=== Weekly Status Entries ===")
    cursor.execute(f"SELECT task_id, week_start_date, is_completed, is_na FROM weekly_task_status WHERE task_id IN ({placeholders})", task_ids)
    weekly = cursor.fetchall()
    
    if weekly:
        for w in weekly:
            print(f"  Task {w[0]}, Week {w[1]}: is_completed={w[2]}, is_na={w[3]}")
        
        # Ask to delete
        print(f"\nFound {len(weekly)} weekly status entries")
        response = input("Delete these weekly entries? (yes/no): ").strip().lower()
        if response == 'yes':
            cursor.execute(f"DELETE FROM weekly_task_status WHERE task_id IN ({placeholders})", task_ids)
            print(f"✓ Deleted {len(weekly)} weekly status entries")
    else:
        print("  No weekly status entries found")
    
    # Check monthly status entries
    print("\n=== Monthly Status Entries ===")
    cursor.execute(f"SELECT task_id, month_start_date, is_completed, is_na FROM monthly_task_status WHERE task_id IN ({placeholders})", task_ids)
    monthly = cursor.fetchall()
    
    if monthly:
        for m in monthly:
            print(f"  Task {m[0]}, Month {m[1]}: is_completed={m[2]}, is_na={m[3]}")
        
        # Ask to delete
        print(f"\nFound {len(monthly)} monthly status entries")
        response = input("Delete these monthly entries? (yes/no): ").strip().lower()
        if response == 'yes':
            cursor.execute(f"DELETE FROM monthly_task_status WHERE task_id IN ({placeholders})", task_ids)
            print(f"✓ Deleted {len(monthly)} monthly status entries")
    else:
        print("  No monthly status entries found")
    
    # Commit changes
    conn.commit()
    conn.close()
    
    print("\n✓ Cleanup complete! Refresh your browser to see the changes.")

if __name__ == "__main__":
    main()
