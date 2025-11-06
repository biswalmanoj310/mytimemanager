"""
API routes for daily task status
Handles completion, NA status, and tracking status for tasks on specific dates
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import List, Optional
from app.database.config import get_db
from app.services import daily_task_status_service
from app.models.schemas import (
    DailyTaskStatusCreate,
    DailyTaskStatusUpdate,
    DailyTaskStatusResponse
)

router = APIRouter(prefix="/api/daily-task-status", tags=["daily-task-status"])


@router.get("/date/{status_date}", response_model=List[DailyTaskStatusResponse])
def get_statuses_for_date(
    status_date: date,
    db: Session = Depends(get_db)
):
    """Get all task statuses for a specific date"""
    return daily_task_status_service.get_daily_task_statuses_for_date(db, status_date)


@router.get("/{task_id}/{status_date}", response_model=Optional[DailyTaskStatusResponse])
def get_task_status(
    task_id: int,
    status_date: date,
    db: Session = Depends(get_db)
):
    """Get daily task status for a specific task and date"""
    status = daily_task_status_service.get_daily_task_status(db, task_id, status_date)
    return status


@router.get("/task/{task_id}", response_model=List[DailyTaskStatusResponse])
def get_statuses_for_task(
    task_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Get all statuses for a specific task, optionally filtered by date range"""
    return daily_task_status_service.get_daily_task_statuses_for_task(
        db, task_id, start_date, end_date
    )


@router.post("/", response_model=DailyTaskStatusResponse)
def create_or_update_status(
    status: DailyTaskStatusCreate,
    db: Session = Depends(get_db)
):
    """Create or update daily task status"""
    # Convert datetime to date
    status_date = status.date.date() if hasattr(status.date, 'date') else status.date
    
    return daily_task_status_service.create_or_update_daily_task_status(
        db=db,
        task_id=status.task_id,
        status_date=status_date,
        is_completed=status.is_completed,
        is_na=status.is_na,
        is_tracked=status.is_tracked
    )


@router.post("/{task_id}/complete", response_model=DailyTaskStatusResponse)
def mark_completed(
    task_id: int,
    status_date: date = Query(..., description="Date to mark task as completed"),
    db: Session = Depends(get_db)
):
    """Mark a task as completed on a specific date"""
    return daily_task_status_service.mark_task_completed(db, task_id, status_date)


@router.post("/{task_id}/na", response_model=DailyTaskStatusResponse)
def mark_na(
    task_id: int,
    status_date: date = Query(..., description="Date to mark task as N/A"),
    db: Session = Depends(get_db)
):
    """Mark a task as N/A on a specific date"""
    return daily_task_status_service.mark_task_na(db, task_id, status_date)


@router.post("/{task_id}/remove-from-tracking", response_model=DailyTaskStatusResponse)
def remove_from_tracking(
    task_id: int,
    status_date: date = Query(..., description="Date to remove task from tracking"),
    db: Session = Depends(get_db)
):
    """Remove a task from tracking on a specific date"""
    return daily_task_status_service.remove_task_from_tracking(db, task_id, status_date)


@router.post("/{task_id}/add-to-tracking", response_model=DailyTaskStatusResponse)
def add_to_tracking(
    task_id: int,
    status_date: date = Query(..., description="Date to add task to tracking"),
    db: Session = Depends(get_db)
):
    """Add a task to tracking on a specific date"""
    return daily_task_status_service.add_task_to_tracking(db, task_id, status_date)


@router.get("/tracked-tasks/{status_date}", response_model=List[int])
def get_tracked_tasks(
    status_date: date,
    db: Session = Depends(get_db)
):
    """Get list of task IDs that are being tracked on a specific date"""
    return daily_task_status_service.get_tracked_tasks_for_date(db, status_date)


@router.delete("/{task_id}/{status_date}")
def delete_status(
    task_id: int,
    status_date: date,
    db: Session = Depends(get_db)
):
    """Delete daily task status for a specific task and date"""
    success = daily_task_status_service.delete_daily_task_status(db, task_id, status_date)
    if not success:
        raise HTTPException(status_code=404, detail="Daily task status not found")
    return {"success": True, "message": "Daily task status deleted"}
