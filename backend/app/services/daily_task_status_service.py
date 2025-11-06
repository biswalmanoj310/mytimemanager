"""
Service layer for daily task status operations
Handles completion, NA status, and tracking status for tasks on specific dates
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import date, datetime
from typing import List, Optional, Dict
from app.models.models import DailyTaskStatus, Task
from app.models.schemas import DailyTaskStatusCreate, DailyTaskStatusUpdate


def get_daily_task_status(db: Session, task_id: int, status_date: date) -> Optional[DailyTaskStatus]:
    """
    Get daily task status for a specific task and date
    """
    return db.query(DailyTaskStatus).filter(
        and_(
            DailyTaskStatus.task_id == task_id,
            DailyTaskStatus.date == status_date
        )
    ).first()


def get_daily_task_statuses_for_date(db: Session, status_date: date) -> List[DailyTaskStatus]:
    """
    Get all task statuses for a specific date
    """
    return db.query(DailyTaskStatus).filter(
        DailyTaskStatus.date == status_date
    ).all()


def get_daily_task_statuses_for_task(db: Session, task_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[DailyTaskStatus]:
    """
    Get all statuses for a specific task, optionally filtered by date range
    """
    query = db.query(DailyTaskStatus).filter(DailyTaskStatus.task_id == task_id)
    
    if start_date:
        query = query.filter(DailyTaskStatus.date >= start_date)
    if end_date:
        query = query.filter(DailyTaskStatus.date <= end_date)
    
    return query.order_by(DailyTaskStatus.date).all()


def create_or_update_daily_task_status(
    db: Session,
    task_id: int,
    status_date: date,
    is_completed: Optional[bool] = None,
    is_na: Optional[bool] = None,
    is_tracked: Optional[bool] = None
) -> DailyTaskStatus:
    """
    Create or update daily task status
    If status exists, update only provided fields
    If status doesn't exist, create with provided values
    """
    # Check if status exists
    status = get_daily_task_status(db, task_id, status_date)
    
    if status:
        # Update existing status
        if is_completed is not None:
            status.is_completed = is_completed
            if is_completed:
                status.is_na = False  # Can't be both completed and NA
        if is_na is not None:
            status.is_na = is_na
            if is_na:
                status.is_completed = False  # Can't be both NA and completed
        if is_tracked is not None:
            status.is_tracked = is_tracked
    else:
        # Create new status
        status = DailyTaskStatus(
            task_id=task_id,
            date=status_date,
            is_completed=is_completed if is_completed is not None else False,
            is_na=is_na if is_na is not None else False,
            is_tracked=is_tracked if is_tracked is not None else True
        )
        db.add(status)
    
    db.commit()
    db.refresh(status)
    return status


def mark_task_completed(db: Session, task_id: int, status_date: date) -> DailyTaskStatus:
    """
    Mark a task as completed on a specific date
    """
    return create_or_update_daily_task_status(db, task_id, status_date, is_completed=True, is_na=False)


def mark_task_na(db: Session, task_id: int, status_date: date) -> DailyTaskStatus:
    """
    Mark a task as N/A on a specific date
    """
    return create_or_update_daily_task_status(db, task_id, status_date, is_completed=False, is_na=True)


def mark_task_tracked(db: Session, task_id: int, status_date: date, is_tracked: bool = True) -> DailyTaskStatus:
    """
    Mark a task as tracked or not tracked on a specific date
    """
    return create_or_update_daily_task_status(db, task_id, status_date, is_tracked=is_tracked)


def remove_task_from_tracking(db: Session, task_id: int, status_date: date) -> DailyTaskStatus:
    """
    Remove a task from tracking on a specific date (marks is_tracked=False)
    """
    return mark_task_tracked(db, task_id, status_date, is_tracked=False)


def add_task_to_tracking(db: Session, task_id: int, status_date: date) -> DailyTaskStatus:
    """
    Add a task to tracking on a specific date (marks is_tracked=True)
    """
    return mark_task_tracked(db, task_id, status_date, is_tracked=True)


def get_tracked_tasks_for_date(db: Session, status_date: date) -> List[int]:
    """
    Get list of task IDs that are being tracked on a specific date
    Returns only tasks where is_tracked=True or no status exists (defaults to tracked)
    """
    statuses = get_daily_task_statuses_for_date(db, status_date)
    
    # Get explicitly untracked task IDs
    untracked_ids = {s.task_id for s in statuses if not s.is_tracked}
    
    # Get all active tasks
    all_active_tasks = db.query(Task.id).filter(Task.is_active == True).all()
    all_active_ids = {t[0] for t in all_active_tasks}
    
    # Tracked = Active tasks - Untracked tasks
    tracked_ids = all_active_ids - untracked_ids
    
    return list(tracked_ids)


def get_task_statuses_map(db: Session, status_date: date) -> Dict[int, DailyTaskStatus]:
    """
    Get a map of task_id -> DailyTaskStatus for a specific date
    """
    statuses = get_daily_task_statuses_for_date(db, status_date)
    return {s.task_id: s for s in statuses}


def bulk_update_task_tracking(db: Session, status_date: date, tracked_task_ids: List[int]) -> List[DailyTaskStatus]:
    """
    Bulk update which tasks are being tracked on a specific date
    Sets is_tracked=True for provided task IDs, is_tracked=False for all others
    """
    # Get all active tasks
    all_active_tasks = db.query(Task).filter(Task.is_active == True).all()
    all_active_ids = {t.id for t in all_active_tasks}
    
    tracked_set = set(tracked_task_ids)
    untracked_set = all_active_ids - tracked_set
    
    results = []
    
    # Mark tracked tasks
    for task_id in tracked_set:
        status = create_or_update_daily_task_status(db, task_id, status_date, is_tracked=True)
        results.append(status)
    
    # Mark untracked tasks
    for task_id in untracked_set:
        status = create_or_update_daily_task_status(db, task_id, status_date, is_tracked=False)
        results.append(status)
    
    return results


def delete_daily_task_status(db: Session, task_id: int, status_date: date) -> bool:
    """
    Delete daily task status for a specific task and date
    Returns True if deleted, False if not found
    """
    status = get_daily_task_status(db, task_id, status_date)
    if status:
        db.delete(status)
        db.commit()
        return True
    return False
