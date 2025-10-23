"""
Service layer for weekly task status (completion/NA per week)
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, date
from typing import List, Optional
from app.models.models import WeeklyTaskStatus
from app.models.schemas import WeeklyTaskStatusCreate, WeeklyTaskStatusResponse


def get_weekly_task_status(db: Session, task_id: int, week_start_date: date) -> Optional[WeeklyTaskStatus]:
    """Get status for a specific task and week"""
    return db.query(WeeklyTaskStatus).filter(
        and_(
            WeeklyTaskStatus.task_id == task_id,
            func.date(WeeklyTaskStatus.week_start_date) == week_start_date
        )
    ).first()


def get_week_statuses(db: Session, week_start_date: date) -> List[WeeklyTaskStatus]:
    """Get all task statuses for a specific week"""
    return db.query(WeeklyTaskStatus).filter(
        func.date(WeeklyTaskStatus.week_start_date) == week_start_date
    ).all()


def mark_task_complete_for_week(db: Session, task_id: int, week_start_date: date) -> WeeklyTaskStatus:
    """Mark a task as complete for a specific week"""
    existing = get_weekly_task_status(db, task_id, week_start_date)
    
    if existing:
        existing.is_completed = True
        existing.is_na = False
        existing.completed_at = datetime.utcnow()
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new_status = WeeklyTaskStatus(
            task_id=task_id,
            week_start_date=datetime.combine(week_start_date, datetime.min.time()),
            is_completed=True,
            is_na=False,
            completed_at=datetime.utcnow()
        )
        db.add(new_status)
        db.commit()
        db.refresh(new_status)
        return new_status


def mark_task_na_for_week(db: Session, task_id: int, week_start_date: date) -> WeeklyTaskStatus:
    """Mark a task as NA for a specific week"""
    existing = get_weekly_task_status(db, task_id, week_start_date)
    
    if existing:
        existing.is_completed = False
        existing.is_na = True
        existing.completed_at = None
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new_status = WeeklyTaskStatus(
            task_id=task_id,
            week_start_date=datetime.combine(week_start_date, datetime.min.time()),
            is_completed=False,
            is_na=True
        )
        db.add(new_status)
        db.commit()
        db.refresh(new_status)
        return new_status


def reset_task_status_for_week(db: Session, task_id: int, week_start_date: date) -> bool:
    """Reset/remove status for a task for a specific week"""
    existing = get_weekly_task_status(db, task_id, week_start_date)
    if existing:
        db.delete(existing)
        db.commit()
        return True
    return False


def has_task_been_completed_ever(db: Session, task_id: int) -> bool:
    """Check if a task has ever been marked completed or NA in any week"""
    status = db.query(WeeklyTaskStatus).filter(
        WeeklyTaskStatus.task_id == task_id,
        (WeeklyTaskStatus.is_completed == True) | (WeeklyTaskStatus.is_na == True)
    ).first()
    return status is not None
