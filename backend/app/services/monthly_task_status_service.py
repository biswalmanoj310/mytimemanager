"""
Service layer for monthly task status (completion/NA per month)
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, date
from typing import List, Optional
from app.models.models import MonthlyTaskStatus


def get_monthly_task_status(db: Session, task_id: int, month_start_date: date) -> Optional[MonthlyTaskStatus]:
    """Get status for a specific task and month"""
    return db.query(MonthlyTaskStatus).filter(
        and_(
            MonthlyTaskStatus.task_id == task_id,
            func.date(MonthlyTaskStatus.month_start_date) == month_start_date
        )
    ).first()


def get_month_statuses(db: Session, month_start_date: date) -> List[MonthlyTaskStatus]:
    """Get all task statuses for a specific month"""
    return db.query(MonthlyTaskStatus).filter(
        func.date(MonthlyTaskStatus.month_start_date) == month_start_date
    ).all()


def mark_task_complete_for_month(db: Session, task_id: int, month_start_date: date) -> MonthlyTaskStatus:
    """Mark a task as complete for a specific month"""
    existing = get_monthly_task_status(db, task_id, month_start_date)
    
    if existing:
        existing.is_completed = True
        existing.is_na = False
        existing.completed_at = datetime.utcnow()
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new_status = MonthlyTaskStatus(
            task_id=task_id,
            month_start_date=datetime.combine(month_start_date, datetime.min.time()),
            is_completed=True,
            is_na=False,
            completed_at=datetime.utcnow()
        )
        db.add(new_status)
        db.commit()
        db.refresh(new_status)
        return new_status


def mark_task_na_for_month(db: Session, task_id: int, month_start_date: date) -> MonthlyTaskStatus:
    """Mark a task as NA for a specific month"""
    existing = get_monthly_task_status(db, task_id, month_start_date)
    
    if existing:
        existing.is_completed = False
        existing.is_na = True
        existing.completed_at = None
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new_status = MonthlyTaskStatus(
            task_id=task_id,
            month_start_date=datetime.combine(month_start_date, datetime.min.time()),
            is_completed=False,
            is_na=True
        )
        db.add(new_status)
        db.commit()
        db.refresh(new_status)
        return new_status


def reset_task_status_for_month(db: Session, task_id: int, month_start_date: date) -> bool:
    """Reset/remove task status for a specific month"""
    result = db.query(MonthlyTaskStatus).filter(
        and_(
            MonthlyTaskStatus.task_id == task_id,
            func.date(MonthlyTaskStatus.month_start_date) == month_start_date
        )
    ).delete()
    db.commit()
    return result > 0


def create_task_status_for_month(db: Session, task_id: int, month_start_date: date) -> MonthlyTaskStatus:
    """Create a status entry for a task for a specific month (used when adding task to monthly tracking)"""
    existing = get_monthly_task_status(db, task_id, month_start_date)
    
    if existing:
        return existing
    
    new_status = MonthlyTaskStatus(
        task_id=task_id,
        month_start_date=datetime.combine(month_start_date, datetime.min.time()),
        is_completed=False,
        is_na=False
    )
    db.add(new_status)
    db.commit()
    db.refresh(new_status)
    return new_status
