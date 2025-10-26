"""
Service layer for one-time task operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime
from typing import List, Optional
from app.models.models import OneTimeTask


def get_all_one_time_tasks(db: Session) -> List[OneTimeTask]:
    """Get all one-time tasks"""
    return db.query(OneTimeTask).all()


def get_one_time_task_by_task_id(db: Session, task_id: int) -> Optional[OneTimeTask]:
    """Get one-time task by task ID"""
    return db.query(OneTimeTask).filter(OneTimeTask.task_id == task_id).first()


def create_one_time_task(
    db: Session,
    task_id: int,
    start_date: date,
    target_gap: Optional[int] = None,
    updated_date: Optional[date] = None
) -> OneTimeTask:
    """Create a new one-time task entry"""
    # Check if entry already exists for this task
    existing = get_one_time_task_by_task_id(db, task_id)
    if existing:
        # Update existing entry
        existing.start_date = datetime.combine(start_date, datetime.min.time())
        existing.target_gap = target_gap
        if updated_date:
            existing.updated_date = datetime.combine(updated_date, datetime.min.time())
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    
    # Create new entry
    one_time_task = OneTimeTask(
        task_id=task_id,
        start_date=datetime.combine(start_date, datetime.min.time()),
        target_gap=target_gap,
        updated_date=datetime.combine(updated_date, datetime.min.time()) if updated_date else None
    )
    db.add(one_time_task)
    db.commit()
    db.refresh(one_time_task)
    return one_time_task


def update_one_time_task(
    db: Session,
    task_id: int,
    start_date: Optional[date] = None,
    target_gap: Optional[int] = None,
    updated_date: Optional[date] = None
) -> Optional[OneTimeTask]:
    """Update an existing one-time task"""
    one_time_task = get_one_time_task_by_task_id(db, task_id)
    if not one_time_task:
        return None
    
    if start_date is not None:
        one_time_task.start_date = datetime.combine(start_date, datetime.min.time())
    if target_gap is not None:
        one_time_task.target_gap = target_gap
    if updated_date is not None:
        one_time_task.updated_date = datetime.combine(updated_date, datetime.min.time())
    
    one_time_task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(one_time_task)
    return one_time_task


def delete_one_time_task(db: Session, task_id: int) -> bool:
    """Delete a one-time task entry"""
    one_time_task = get_one_time_task_by_task_id(db, task_id)
    if one_time_task:
        db.delete(one_time_task)
        db.commit()
        return True
    return False
