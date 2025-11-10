#!/usr/bin/env python3
"""
Script to find and mark old hidden tasks as inactive using direct SQL.

These are tasks that:
- Are marked as is_active=True in the database
- Have is_completed=True OR na_marked_at set to old dates
- Are NOT visible in the Daily tab UI
- Are causing inflated analytics allocations
"""

import sqlite3
from datetime import datetime, date

DATABASE_PATH = "./database/mytimemanager.db"

def find_hidden_tasks():
    """Find tasks that are marked active but completed/NA on old dates"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        today = date.today().isoformat()
        print(f"Today's date: {today}")
        print("=" * 80)
        
        # Find tasks that are:
        # 1. Marked as active (is_active=1)
        # 2. BUT either completed OR marked NA on dates before today
        # These tasks won't show in Daily tab but ARE counted in analytics
        
        query = """
        SELECT 
            t.id, 
            t.name, 
            c.name as category_name,
            t.allocated_minutes,
            t.is_active,
            t.is_completed,
            DATE(t.completed_at) as completed_date,
            DATE(t.na_marked_at) as na_marked_date,
            DATE(t.created_at) as created_date,
            DATE(t.updated_at) as updated_date
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.is_active = 1
        AND (
            (t.is_completed = 1 AND DATE(t.completed_at) < ?)
            OR (t.na_marked_at IS NOT NULL AND DATE(t.na_marked_at) < ?)
        )
        ORDER BY c.name, t.name
        """
        
        cursor.execute(query, (today, today))
        hidden_tasks = cursor.fetchall()
        
        print(f"\n🔍 FOUND HIDDEN TASKS: {len(hidden_tasks)}")
        
        if not hidden_tasks:
            print("\n✅ No hidden tasks found! Database is clean.")
            return []
        
        print(f"\n📋 DETAILED LIST ({len(hidden_tasks)} tasks):")
        print("=" * 80)
        
        total_minutes = 0
        for task in hidden_tasks:
            task_id, name, category, allocated, is_active, is_completed, completed_date, na_date, created, updated = task
            total_minutes += allocated or 0
            
            print(f"\nTask ID: {task_id}")
            print(f"  Name: {name}")
            print(f"  Category: {category or 'Unknown'}")
            print(f"  Allocated: {allocated} min")
            print(f"  is_active: {is_active}")
            print(f"  is_completed: {is_completed}")
            if completed_date:
                print(f"  completed_at: {completed_date}")
            if na_date:
                print(f"  na_marked_at: {na_date}")
            print(f"  created_at: {created}")
            print(f"  updated_at: {updated}")
        
        total_hours = total_minutes / 60
        print(f"\n📊 TOTAL ALLOCATED TIME IN HIDDEN TASKS: {total_minutes} min ({total_hours:.2f} hours)")
        print(f"   This is the amount being incorrectly added to analytics!")
        
        return hidden_tasks
        
    finally:
        conn.close()

def fix_hidden_tasks(hidden_tasks):
    """Mark hidden tasks as inactive"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        print("\n" + "=" * 80)
        print("🔧 FIXING HIDDEN TASKS")
        print("=" * 80)
        
        task_ids = [task[0] for task in hidden_tasks]
        
        for task_id, name, *_ in hidden_tasks:
            print(f"\nFixing: {name} (ID: {task_id})")
            print(f"  Setting is_active = 0")
            
            cursor.execute("UPDATE tasks SET is_active = 0 WHERE id = ?", (task_id,))
        
        conn.commit()
        print(f"\n✅ Successfully fixed {len(hidden_tasks)} hidden tasks!")
        print("   These tasks will no longer be counted in analytics.")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ ERROR: {e}")
        raise
    finally:
        conn.close()

def main():
    print("=" * 80)
    print("HIDDEN TASK FINDER & FIXER")
    print("=" * 80)
    print("\nThis script finds tasks that are:")
    print("  • Marked as active (is_active=1)")
    print("  • But completed or marked NA on dates BEFORE today")
    print("  • Hidden from Daily tab UI")
    print("  • Still being counted in Analytics (causing inflated allocations)")
    
    # Step 1: Find hidden tasks
    hidden_tasks = find_hidden_tasks()
    
    if not hidden_tasks:
        return
    
    # Step 2: Ask user for confirmation
    print("\n" + "=" * 80)
    print("PROPOSED FIX:")
    print("=" * 80)
    print(f"Mark all {len(hidden_tasks)} hidden tasks as is_active=0")
    print("This will exclude them from analytics calculations.")
    print("\n⚠️  This operation will modify the database!")
    
    response = input("\nDo you want to proceed? (yes/no): ").strip().lower()
    
    if response in ['yes', 'y']:
        fix_hidden_tasks(hidden_tasks)
        print("\n" + "=" * 80)
        print("✅ DONE!")
        print("=" * 80)
        print("\nNext steps:")
        print("1. Refresh your Analytics page")
        print("2. Verify that allocated hours now match Daily tab")
        print("3. Check that totals sum to 24 hours")
    else:
        print("\n❌ Operation cancelled. No changes made.")

if __name__ == "__main__":
    main()
