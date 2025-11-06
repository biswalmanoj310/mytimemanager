#!/usr/bin/env python3
"""Direct database recalculation script"""

import sys
import os
from datetime import date, datetime, timedelta
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_path))

# Now import
from sqlalchemy import create_engine, and_, func
from sqlalchemy.orm import sessionmaker
from app.models.models import Task, DailyTimeEntry, DailySummary, DailyTaskStatus

# Database path
db_path = backend_path / 'database' / 'mytimemanager.db'
DATABASE_URL = f"sqlite:///{db_path}"

# Create engine
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def update_daily_summary(db, entry_date: date):
    """Calculate and update daily summary with global completion check"""
    
    # Get all daily tasks
    daily_tasks = db.query(Task).filter(
        and_(
            Task.follow_up_frequency == 'daily',
            Task.is_active == True
        )
    ).all()

    # Calculate total allocated
    total_allocated = 0
    for task in daily_tasks:
        # FIRST: Check if task was globally completed/NA before or on this date
        skip_task = False
        
        if task.is_completed and task.completed_at:
            completed_date = task.completed_at.date() if hasattr(task.completed_at, 'date') else task.completed_at
            if entry_date >= completed_date:
                skip_task = True
        
        if not task.is_active and task.na_marked_at:
            na_date = task.na_marked_at.date() if hasattr(task.na_marked_at, 'date') else task.na_marked_at
            if entry_date >= na_date:
                skip_task = True
        
        if skip_task:
            continue
        
        # SECOND: Check per-date status
        status = db.query(DailyTaskStatus).filter(
            and_(
                DailyTaskStatus.task_id == task.id,
                DailyTaskStatus.date == entry_date
            )
        ).first()
        
        if not status:
            total_allocated += task.allocated_minutes
        elif status.is_tracked and not status.is_completed and not status.is_na:
            total_allocated += task.allocated_minutes

    # Calculate total spent
    entries = db.query(DailyTimeEntry).filter(
        func.date(DailyTimeEntry.entry_date) == entry_date
    ).all()
    total_spent = sum(entry.minutes for entry in entries)

    # Check if day is complete
    is_complete = (total_allocated == total_spent) and total_spent > 0

    # Get or create daily summary
    summary = db.query(DailySummary).filter(
        func.date(DailySummary.entry_date) == entry_date
    ).first()

    if summary:
        summary.total_allocated = total_allocated
        summary.total_spent = total_spent
        summary.is_complete = is_complete
        summary.updated_at = datetime.now()
    else:
        summary = DailySummary(
            entry_date=datetime.combine(entry_date, datetime.min.time()),
            total_allocated=total_allocated,
            total_spent=total_spent,
            is_complete=is_complete
        )
        db.add(summary)
    
    db.commit()
    return summary

def main():
    """Recalculate all summaries for last 60 days"""
    db = SessionLocal()
    
    try:
        print("🔄 Recalculating daily summaries for last 60 days...")
        
        end_date = date.today()
        start_date = end_date - timedelta(days=60)
        
        current_date = start_date
        count = 0
        
        while current_date <= end_date:
            summary = update_daily_summary(db, current_date)
            print(f"✓ {current_date}: Allocated={summary.total_allocated}, Spent={summary.total_spent}, Complete={summary.is_complete}")
            count += 1
            current_date += timedelta(days=1)
        
        print(f"\n✅ Successfully recalculated {count} daily summaries!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
