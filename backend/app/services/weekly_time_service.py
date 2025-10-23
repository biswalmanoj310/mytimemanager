"""
Service layer for weekly time entries and summaries
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict
from app.models.models import WeeklyTimeEntry, WeeklySummary, Task
from app.models.schemas import WeeklyTimeEntryCreate, WeeklySummaryResponse, IncompleteWeekResponse


def get_weekly_time_entries(db: Session, week_start_date: date, task_id: Optional[int] = None) -> List[WeeklyTimeEntry]:
    """Get all time entries for a specific week"""
    query = db.query(WeeklyTimeEntry).filter(
        func.date(WeeklyTimeEntry.week_start_date) == week_start_date
    )
    if task_id:
        query = query.filter(WeeklyTimeEntry.task_id == task_id)
    return query.all()


def save_weekly_time_entry(db: Session, entry_data: WeeklyTimeEntryCreate) -> WeeklyTimeEntry:
    """Save or update a weekly time entry"""
    # Check if entry already exists
    existing = db.query(WeeklyTimeEntry).filter(
        and_(
            WeeklyTimeEntry.task_id == entry_data.task_id,
            func.date(WeeklyTimeEntry.week_start_date) == entry_data.week_start_date.date(),
            WeeklyTimeEntry.day_of_week == entry_data.day_of_week
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
        new_entry = WeeklyTimeEntry(
            task_id=entry_data.task_id,
            week_start_date=entry_data.week_start_date,
            day_of_week=entry_data.day_of_week,
            minutes=entry_data.minutes
        )
        db.add(new_entry)
        db.commit()
        db.refresh(new_entry)
        return new_entry


def bulk_save_weekly_entries(db: Session, week_start_date: date, entries: List[Dict]) -> bool:
    """Bulk save/update weekly time entries for a specific week"""
    try:
        for entry in entries:
            task_id = entry.get('task_id')
            day_of_week = entry.get('day_of_week')
            minutes = entry.get('minutes', 0)

            if task_id is None or day_of_week is None:
                continue

            # Check if entry exists
            existing = db.query(WeeklyTimeEntry).filter(
                and_(
                    WeeklyTimeEntry.task_id == task_id,
                    func.date(WeeklyTimeEntry.week_start_date) == week_start_date,
                    WeeklyTimeEntry.day_of_week == day_of_week
                )
            ).first()

            if existing:
                existing.minutes = minutes
                existing.updated_at = datetime.utcnow()
            else:
                new_entry = WeeklyTimeEntry(
                    task_id=task_id,
                    week_start_date=datetime.combine(week_start_date, datetime.min.time()),
                    day_of_week=day_of_week,
                    minutes=minutes
                )
                db.add(new_entry)

        db.commit()
        
        # Update weekly summary
        update_weekly_summary(db, week_start_date)
        
        return True
    except Exception as e:
        db.rollback()
        raise e


def update_weekly_summary(db: Session, week_start_date: date) -> WeeklySummary:
    """Calculate and update weekly summary"""
    # Get all weekly tasks (follow_up_frequency = 'weekly')
    weekly_tasks = db.query(Task).filter(
        and_(
            Task.follow_up_frequency == 'weekly',
            Task.is_active == True
        )
    ).all()

    # Calculate total allocated (weekly tasks allocated for entire week)
    total_allocated = sum(task.allocated_minutes for task in weekly_tasks)

    # Calculate total spent
    entries = db.query(WeeklyTimeEntry).filter(
        func.date(WeeklyTimeEntry.week_start_date) == week_start_date
    ).all()
    total_spent = sum(entry.minutes for entry in entries)

    # Check if week is complete
    is_complete = (total_allocated == total_spent) and total_spent > 0

    # Get or create weekly summary
    summary = db.query(WeeklySummary).filter(
        func.date(WeeklySummary.week_start_date) == week_start_date
    ).first()

    if summary:
        summary.total_allocated = total_allocated
        summary.total_spent = total_spent
        summary.is_complete = is_complete
        summary.updated_at = datetime.utcnow()
    else:
        summary = WeeklySummary(
            week_start_date=datetime.combine(week_start_date, datetime.min.time()),
            total_allocated=total_allocated,
            total_spent=total_spent,
            is_complete=is_complete
        )
        db.add(summary)

    db.commit()
    db.refresh(summary)
    return summary


def get_incomplete_weeks(db: Session, limit: int = 12) -> List[IncompleteWeekResponse]:
    """Get list of incomplete weeks (where allocated != spent)"""
    summaries = db.query(WeeklySummary).filter(
        WeeklySummary.is_complete == False
    ).order_by(WeeklySummary.week_start_date.desc()).limit(limit).all()

    result = []
    for summary in summaries:
        result.append(IncompleteWeekResponse(
            week_start_date=summary.week_start_date,
            total_allocated=summary.total_allocated,
            total_spent=summary.total_spent,
            difference=abs(summary.total_allocated - summary.total_spent)
        ))

    return result


def get_weekly_summary(db: Session, week_start_date: date) -> Optional[WeeklySummary]:
    """Get summary for a specific week"""
    return db.query(WeeklySummary).filter(
        func.date(WeeklySummary.week_start_date) == week_start_date
    ).first()
