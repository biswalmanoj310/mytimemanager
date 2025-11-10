#!/usr/bin/env python3
"""
Script to find and fix duplicate/old tasks with high allocations.

These tasks have been superseded by newer versions with lower allocations
but the old versions are still marked as active.
"""

import sqlite3
from datetime import datetime, date

DATABASE_PATH = "./database/mytimemanager.db"

def find_duplicate_tasks():
    """Find duplicate tasks where old versions have higher allocations"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        print("=" * 80)
        print("FINDING DUPLICATE/OLD TASKS")
        print("=" * 80)
        
        # Get all active tasks grouped by name and category
        query = """
        SELECT 
            t.id,
            t.name,
            c.name as category_name,
            t.allocated_minutes,
            DATE(t.created_at) as created_date,
            DATE(t.updated_at) as updated_date
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.is_active = 1 
        AND t.is_completed = 0 
        AND t.na_marked_at IS NULL
        AND t.allocated_minutes > 0
        ORDER BY c.name, t.name, t.created_at DESC
        """
        
        cursor.execute(query)
        all_tasks = cursor.fetchall()
        
        # Group by (name, category) to find duplicates
        task_groups = {}
        for task in all_tasks:
            task_id, name, category, allocated, created, updated = task
            key = (name, category)
            
            if key not in task_groups:
                task_groups[key] = []
            task_groups[key].append(task)
        
        # Find groups with duplicates (multiple tasks with same name+category)
        duplicates = {k: v for k, v in task_groups.items() if len(v) > 1}
        
        print(f"\n🔍 Found {len(duplicates)} task name+category combinations with duplicates:")
        print("=" * 80)
        
        tasks_to_fix = []
        
        for (name, category), versions in duplicates.items():
            print(f"\n📌 {category} / {name}")
            print(f"   {len(versions)} versions found:")
            
            # Sort by created_at (most recent first)
            versions_sorted = sorted(versions, key=lambda x: x[4], reverse=True)
            
            for i, task in enumerate(versions_sorted):
                task_id, _, _, allocated, created, updated = task
                is_current = "(CURRENT - KEEP)" if i == 0 else "(OLD - MARK INACTIVE)"
                print(f"   {i+1}. ID {task_id}: {allocated} min, created {created}, updated {updated} {is_current}")
                
                # Mark old versions (not the most recent) for fixing
                if i > 0:
                    tasks_to_fix.append(task)
        
        # Also check for tasks with unusually high allocations (> 120 min for daily tasks)
        print("\n" + "=" * 80)
        print("CHECKING FOR TASKS WITH UNUSUALLY HIGH ALLOCATIONS")
        print("=" * 80)
        
        high_allocation_query = """
        SELECT 
            t.id,
            t.name,
            c.name as category_name,
            t.allocated_minutes,
            t.follow_up_frequency,
            DATE(t.created_at) as created_date
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.is_active = 1 
        AND t.is_completed = 0 
        AND t.na_marked_at IS NULL
        AND t.follow_up_frequency = 'daily'
        AND t.allocated_minutes > 120
        ORDER BY t.allocated_minutes DESC
        """
        
        cursor.execute(high_allocation_query)
        high_alloc_tasks = cursor.fetchall()
        
        if high_alloc_tasks:
            print(f"\n⚠️  Found {len(high_alloc_tasks)} daily tasks with > 120 min allocation:")
            for task in high_alloc_tasks:
                task_id, name, category, allocated, freq, created = task
                print(f"   ID {task_id}: {category} / {name} = {allocated} min ({allocated/60:.1f} hours)")
                
                # Add to fix list if not already there
                if task not in tasks_to_fix:
                    # Check if this task is already in duplicates list
                    already_marked = any(t[0] == task_id for t in tasks_to_fix)
                    if not already_marked:
                        print(f"      ℹ️  This seems like an old task version - consider marking inactive")
        
        return tasks_to_fix
        
    finally:
        conn.close()

def fix_old_tasks(tasks_to_fix):
    """Mark old task versions as inactive"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        print("\n" + "=" * 80)
        print("🔧 FIXING OLD TASK VERSIONS")
        print("=" * 80)
        
        total_minutes = 0
        for task in tasks_to_fix:
            task_id, name, category, allocated, created, updated = task
            total_minutes += allocated
            
            print(f"\nMarking as inactive: {category} / {name}")
            print(f"  ID: {task_id}, Allocated: {allocated} min")
            
            cursor.execute("UPDATE tasks SET is_active = 0 WHERE id = ?", (task_id,))
        
        conn.commit()
        
        total_hours = total_minutes / 60
        print(f"\n✅ Successfully marked {len(tasks_to_fix)} old task versions as inactive!")
        print(f"📊 Total allocation freed: {total_minutes} min ({total_hours:.2f} hours)")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ ERROR: {e}")
        raise
    finally:
        conn.close()

def main():
    print("=" * 80)
    print("DUPLICATE/OLD TASK FINDER & FIXER")
    print("=" * 80)
    print("\nThis script finds:")
    print("  • Tasks with same name+category but multiple active versions")
    print("  • Keeps the most recent version (by created_at)")
    print("  • Marks old versions as inactive")
    
    # Find duplicate tasks
    tasks_to_fix = find_duplicate_tasks()
    
    if not tasks_to_fix:
        print("\n✅ No duplicate tasks found! All tasks have unique name+category combinations.")
        return
    
    # Ask for confirmation
    print("\n" + "=" * 80)
    print("PROPOSED FIX:")
    print("=" * 80)
    print(f"Mark {len(tasks_to_fix)} old task versions as is_active=0")
    print("This will keep only the most recent version of each task.")
    print("\n⚠️  This operation will modify the database!")
    
    response = input("\nDo you want to proceed? (yes/no): ").strip().lower()
    
    if response in ['yes', 'y']:
        fix_old_tasks(tasks_to_fix)
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
