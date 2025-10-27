"""
Service layer for yearly time entries
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, date
from typing import List, Optional, Dict
from app.models.models import YearlyTimeEntry, Task


def get_yearly_time_entries(db: Session, year_start_date: date, task_id: Optional[int] = None) -> List[YearlyTimeEntry]:
    """Get all time entries for a specific year"""
    query = db.query(YearlyTimeEntry).filter(
        func.date(YearlyTimeEntry.year_start_date) == year_start_date
    )
    if task_id:
        query = query.filter(YearlyTimeEntry.task_id == task_id)
    return query.all()


def save_yearly_time_entry(db: Session, task_id: int, year_start_date: date, month: int, minutes: int) -> YearlyTimeEntry:
    """Save or update a yearly time entry"""
    # Check if entry already exists
    existing = db.query(YearlyTimeEntry).filter(
        and_(
            YearlyTimeEntry.task_id == task_id,
            func.date(YearlyTimeEntry.year_start_date) == year_start_date,
            YearlyTimeEntry.month == month
        )
    ).first()

    if existing:
        # Update existing entry
        existing.minutes = minutes
        existing.updated_at = datetime.now()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new entry
        new_entry = YearlyTimeEntry(
            task_id=task_id,
            year_start_date=datetime.combine(year_start_date, datetime.min.time()),
            month=month,
            minutes=minutes
        )
        db.add(new_entry)
        db.commit()
        db.refresh(new_entry)
        return new_entry


def bulk_save_yearly_entries(db: Session, year_start_date: date, entries: List[Dict]) -> bool:
    """Bulk save/update yearly time entries for a specific year"""
    try:
        for entry in entries:
            task_id = entry.get('task_id')
            month = entry.get('month')
            minutes = entry.get('minutes', 0)

            if task_id is None or month is None:
                continue

            # Delete entry if minutes is 0, otherwise save/update
            if minutes == 0:
                db.query(YearlyTimeEntry).filter(
                    and_(
                        YearlyTimeEntry.task_id == task_id,
                        func.date(YearlyTimeEntry.year_start_date) == year_start_date,
                        YearlyTimeEntry.month == month
                    )
                ).delete()
            else:
                save_yearly_time_entry(db, task_id, year_start_date, month, minutes)

        db.commit()
        return True
    except Exception as e:
        db.rollback()
        raise e


def delete_yearly_entry(db: Session, task_id: int, year_start_date: date, month: int) -> bool:
    """Delete a specific yearly time entry"""
    try:
        db.query(YearlyTimeEntry).filter(
            and_(
                YearlyTimeEntry.task_id == task_id,
                func.date(YearlyTimeEntry.year_start_date) == year_start_date,
                YearlyTimeEntry.month == month
            )
        ).delete()
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        raise e
