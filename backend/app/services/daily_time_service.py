"""
Service layer for daily time entries and summaries
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict
from app.models.models import DailyTimeEntry, DailySummary, Task
from app.models.schemas import DailyTimeEntryCreate, DailySummaryResponse, IncompleteDayResponse


def get_daily_time_entries(db: Session, entry_date: date, task_id: Optional[int] = None) -> List[DailyTimeEntry]:
    """Get all time entries for a specific date"""
    query = db.query(DailyTimeEntry).filter(
        func.date(DailyTimeEntry.entry_date) == entry_date
    )
    if task_id:
        query = query.filter(DailyTimeEntry.task_id == task_id)
    return query.all()


def save_daily_time_entry(db: Session, entry_data: DailyTimeEntryCreate) -> DailyTimeEntry:
    """Save or update a daily time entry"""
    # Check if entry already exists
    existing = db.query(DailyTimeEntry).filter(
        and_(
            DailyTimeEntry.task_id == entry_data.task_id,
            func.date(DailyTimeEntry.entry_date) == entry_data.entry_date.date(),
            DailyTimeEntry.hour == entry_data.hour
        )
    ).first()

    if existing:
        # Update existing entry
        existing.minutes = entry_data.minutes
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new entry
        new_entry = DailyTimeEntry(
            task_id=entry_data.task_id,
            entry_date=entry_data.entry_date,
            hour=entry_data.hour,
            minutes=entry_data.minutes
        )
        db.add(new_entry)
        db.commit()
        db.refresh(new_entry)
        return new_entry


def bulk_save_daily_entries(db: Session, entry_date: date, entries: List[Dict]) -> bool:
    """Bulk save/update daily time entries for a specific date"""
    try:
        for entry in entries:
            task_id = entry.get('task_id')
            hour = entry.get('hour')
            minutes = entry.get('minutes', 0)

            if task_id is None or hour is None:
                continue

            # Check if entry exists
            existing = db.query(DailyTimeEntry).filter(
                and_(
                    DailyTimeEntry.task_id == task_id,
                    func.date(DailyTimeEntry.entry_date) == entry_date,
                    DailyTimeEntry.hour == hour
                )
            ).first()

            if existing:
                existing.minutes = minutes
                existing.updated_at = datetime.utcnow()
            else:
                new_entry = DailyTimeEntry(
                    task_id=task_id,
                    entry_date=datetime.combine(entry_date, datetime.min.time()),
                    hour=hour,
                    minutes=minutes
                )
                db.add(new_entry)

        db.commit()
        
        # Update daily summary
        update_daily_summary(db, entry_date)
        
        return True
    except Exception as e:
        db.rollback()
        raise e


def update_daily_summary(db: Session, entry_date: date) -> DailySummary:
    """Calculate and update daily summary"""
    # Get all daily tasks (follow_up_frequency = 'daily')
    daily_tasks = db.query(Task).filter(
        and_(
            Task.follow_up_frequency == 'daily',
            Task.is_active == True
        )
    ).all()

    # Calculate total allocated
    total_allocated = sum(task.allocated_minutes for task in daily_tasks)

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
        summary.updated_at = datetime.utcnow()
    else:
        summary = DailySummary(
            entry_date=datetime.combine(entry_date, datetime.min.time()),
            total_allocated=total_allocated,
            total_spent=total_spent,
            is_complete=is_complete
        )
        db.add(summary)

    db.commit()
    db.refresh(summary)
    return summary


def get_incomplete_days(db: Session, limit: int = 30) -> List[IncompleteDayResponse]:
    """Get list of incomplete days (where allocated != spent)"""
    summaries = db.query(DailySummary).filter(
        DailySummary.is_complete == False
    ).order_by(DailySummary.entry_date.desc()).limit(limit).all()

    result = []
    for summary in summaries:
        result.append(IncompleteDayResponse(
            entry_date=summary.entry_date,
            total_allocated=summary.total_allocated,
            total_spent=summary.total_spent,
            difference=abs(summary.total_allocated - summary.total_spent)
        ))

    return result


def get_daily_summary(db: Session, entry_date: date) -> Optional[DailySummary]:
    """Get summary for a specific date"""
    return db.query(DailySummary).filter(
        func.date(DailySummary.entry_date) == entry_date
    ).first()


def get_week_daily_aggregates(db: Session, week_start_date: date) -> Dict:
    """Get aggregated daily entries for a week (7 days)
    Returns: {task_id: {day_of_week: total_minutes}}
    where day_of_week is 0-6 (Sunday-Saturday)
    """
    result = {}
    
    for day_offset in range(7):
        current_date = date.fromordinal(week_start_date.toordinal() + day_offset)
        
        # Get all entries for this date
        entries = db.query(DailyTimeEntry).filter(
            func.date(DailyTimeEntry.entry_date) == current_date
        ).all()
        
        # Aggregate by task
        for entry in entries:
            task_id = entry.task_id
            if task_id not in result:
                result[task_id] = {}
            
            if day_offset not in result[task_id]:
                result[task_id][day_offset] = 0
            
            result[task_id][day_offset] += entry.minutes
    
    return result
