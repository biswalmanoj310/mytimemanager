#!/usr/bin/env python3
"""
Script to find and mark old hidden tasks as inactive.

These are tasks that:
- Are marked as is_active=True in the database
- Have is_completed=True OR na_marked_at set to old dates
- Are NOT visible in the Daily tab UI
- Are causing inflated analytics allocations
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add backend to path
backend_path = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_path))

from sqlalchemy import create_engine, and_, or_
from sqlalchemy.orm import sessionmaker
# Import only what we need
from app.models import Task, Category
# Import Base to ensure all models are registered
from app.models.models import Base

DATABASE_URL = "sqlite:///./database/mytimemanager.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def find_hidden_tasks():
    """Find tasks that are marked active but completed/NA on old dates"""
    db = SessionLocal()
    
    try:
        today = datetime.now().date()
        print(f"Today's date: {today}")
        print("=" * 80)
        
        # Find tasks that are:
        # 1. Marked as active (is_active=True)
        # 2. BUT either completed OR marked NA on dates before today
        # These tasks won't show in Daily tab but ARE counted in analytics
        
        hidden_completed = db.query(Task).filter(
            and_(
                Task.is_active == True,
                Task.is_completed == True,
                Task.completed_at < today
            )
        ).all()
        
        hidden_na = db.query(Task).filter(
            and_(
                Task.is_active == True,
                Task.na_marked_at != None,
                Task.na_marked_at < today
            )
        ).all()
        
        print(f"\n🔍 FOUND HIDDEN TASKS:")
        print(f"   - Tasks marked active but completed before today: {len(hidden_completed)}")
        print(f"   - Tasks marked active but NA before today: {len(hidden_na)}")
        
        all_hidden = hidden_completed + hidden_na
        
        if not all_hidden:
            print("\n✅ No hidden tasks found! Database is clean.")
            return []
        
        print(f"\n📋 DETAILED LIST ({len(all_hidden)} tasks):")
        print("=" * 80)
        
        for task in all_hidden:
            category = db.query(Category).filter(Category.id == task.category_id).first()
            category_name = category.name if category else "Unknown"
            
            print(f"\nTask ID: {task.id}")
            print(f"  Name: {task.name}")
            print(f"  Category: {category_name}")
            print(f"  Allocated: {task.allocated_minutes} min")
            print(f"  is_active: {task.is_active}")
            print(f"  is_completed: {task.is_completed}")
            if task.completed_at:
                print(f"  completed_at: {task.completed_at.date()}")
            if task.na_marked_at:
                print(f"  na_marked_at: {task.na_marked_at.date()}")
            print(f"  created_at: {task.created_at.date() if task.created_at else 'N/A'}")
            print(f"  updated_at: {task.updated_at.date() if task.updated_at else 'N/A'}")
        
        return all_hidden
        
    finally:
        db.close()

def fix_hidden_tasks(hidden_tasks):
    """Mark hidden tasks as inactive"""
    db = SessionLocal()
    
    try:
        print("\n" + "=" * 80)
        print("🔧 FIXING HIDDEN TASKS")
        print("=" * 80)
        
        for task in hidden_tasks:
            print(f"\nFixing: {task.name} (ID: {task.id})")
            print(f"  Setting is_active = False")
            
            # Mark as inactive - this will exclude it from analytics
            task.is_active = False
            
        db.commit()
        print(f"\n✅ Successfully fixed {len(hidden_tasks)} hidden tasks!")
        print("   These tasks will no longer be counted in analytics.")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ ERROR: {e}")
        raise
    finally:
        db.close()

def main():
    print("=" * 80)
    print("HIDDEN TASK FINDER & FIXER")
    print("=" * 80)
    print("\nThis script finds tasks that are:")
    print("  • Marked as active (is_active=True)")
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
    print(f"Mark all {len(hidden_tasks)} hidden tasks as is_active=False")
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
