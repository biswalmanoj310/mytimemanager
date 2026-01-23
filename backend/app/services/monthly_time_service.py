"""
Service layer for monthly time entries
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, date
from typing import List, Optional, Dict
from app.models.models import MonthlyTimeEntry, Taskfrom app.services.snapshot_helper import SnapshotHelper

def get_monthly_time_entries(db: Session, month_start_date: date, task_id: Optional[int] = None) -> List[MonthlyTimeEntry]:
    """Get all time entries for a specific month"""
    query = db.query(MonthlyTimeEntry).filter(
        func.date(MonthlyTimeEntry.month_start_date) == month_start_date
    )
    if task_id:
        query = query.filter(MonthlyTimeEntry.task_id == task_id)
    return query.all()


def save_monthly_time_entry(db: Session, task_id: int, month_start_date: date, day_of_month: int, minutes: int) -> MonthlyTimeEntry:
    """Save or update a monthly time entry"""
    # Check if entry already exists
    existing = db.query(MonthlyTimeEntry).filter(
        and_(
            MonthlyTimeEntry.task_id == task_id,
            func.date(MonthlyTimeEntry.month_start_date) == month_start_date,
            MonthlyTimeEntry.day_of_month == day_of_month
        )
    ).first()

    if existing:
        # Update existing entry
        existing.minutes = minutes
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Get snapshot data
        snapshots = SnapshotHelper.get_task_snapshots(db, task_id)
        
        # Create new entry with snapshots
        new_entry = MonthlyTimeEntry(
            task_id=task_id,
            month_start_date=datetime.combine(month_start_date, datetime.min.time()),
            day_of_month=day_of_month,
            minutes=minutes,
            **snapshots
        )
        db.add(new_entry)
        db.commit()
        db.refresh(new_entry)
        return new_entry


def bulk_save_monthly_entries(db: Session, month_start_date: date, entries: List[Dict]) -> bool:
    """Bulk save/update monthly time entries for a specific month"""
    try:
        for entry in entries:
            task_id = entry.get('task_id')
            day_of_month = entry.get('day_of_month')
            minutes = entry.get('minutes', 0)

            if task_id is None or day_of_month is None:
                continue

            # Delete entry if minutes is 0, otherwise save/update
            if minutes == 0:
                db.query(MonthlyTimeEntry).filter(
                    and_(
                        MonthlyTimeEntry.task_id == task_id,
                        func.date(MonthlyTimeEntry.month_start_date) == month_start_date,
                        MonthlyTimeEntry.day_of_month == day_of_month
                    )
                ).delete()
            else:
                save_monthly_time_entry(db, task_id, month_start_date, day_of_month, minutes)

        db.commit()
        return True
    except Exception as e:
        db.rollback()
        raise e


def delete_monthly_entry(db: Session, task_id: int, month_start_date: date, day_of_month: int) -> bool:
    """Delete a specific monthly time entry"""
    result = db.query(MonthlyTimeEntry).filter(
        and_(
            MonthlyTimeEntry.task_id == task_id,
            func.date(MonthlyTimeEntry.month_start_date) == month_start_date,
            MonthlyTimeEntry.day_of_month == day_of_month
        )
    ).delete()
    db.commit()
    return result > 0
