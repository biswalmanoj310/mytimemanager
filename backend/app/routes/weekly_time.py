"""
API routes for weekly time entries and summaries
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import List, Optional
from app.database.config import get_db
from app.services import weekly_time_service
from app.models.schemas import (
    WeeklyTimeEntryCreate,
    WeeklyTimeEntryBulkCreate,
    WeeklyTimeEntryResponse,
    WeeklySummaryResponse,
    IncompleteWeekResponse
)

router = APIRouter(prefix="/api/weekly-time", tags=["weekly-time"])


@router.get("/entries/{week_start_date}", response_model=List[WeeklyTimeEntryResponse])
def get_weekly_entries(
    week_start_date: date,
    task_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all time entries for a specific week"""
    entries = weekly_time_service.get_weekly_time_entries(db, week_start_date, task_id)
    return entries


@router.post("/entries/", response_model=WeeklyTimeEntryResponse)
def save_entry(
    entry: WeeklyTimeEntryCreate,
    db: Session = Depends(get_db)
):
    """Save or update a single time entry"""
    return weekly_time_service.save_weekly_time_entry(db, entry)


@router.post("/entries/bulk/")
def bulk_save_entries(
    bulk_data: WeeklyTimeEntryBulkCreate,
    db: Session = Depends(get_db)
):
    """Bulk save time entries for a specific week"""
    try:
        # Convert datetime to date
        week_start_date = bulk_data.week_start_date.date() if hasattr(bulk_data.week_start_date, 'date') else bulk_data.week_start_date
        success = weekly_time_service.bulk_save_weekly_entries(db, week_start_date, bulk_data.entries)
        return {"success": success, "message": "Entries saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/summary/{week_start_date}", response_model=Optional[WeeklySummaryResponse])
def get_summary(
    week_start_date: date,
    db: Session = Depends(get_db)
):
    """Get summary for a specific week"""
    summary = weekly_time_service.get_weekly_summary(db, week_start_date)
    if not summary:
        # Calculate and create summary if it doesn't exist
        summary = weekly_time_service.update_weekly_summary(db, week_start_date)
    return summary


@router.get("/incomplete-weeks/", response_model=List[IncompleteWeekResponse])
def get_incomplete_weeks(
    limit: int = Query(default=12, ge=1, le=52),
    db: Session = Depends(get_db)
):
    """Get list of incomplete weeks where allocated time != spent time"""
    return weekly_time_service.get_incomplete_weeks(db, limit)


@router.put("/summary/{week_start_date}/recalculate")
def recalculate_summary(
    week_start_date: date,
    db: Session = Depends(get_db)
):
    """Recalculate and update summary for a specific week"""
    summary = weekly_time_service.update_weekly_summary(db, week_start_date)
    return summary


# Weekly Task Status Routes
from app.services import weekly_task_status_service


@router.get("/status/completed-tasks")
def get_completed_task_ids(db: Session = Depends(get_db)):
    """Get IDs of all tasks that have ever been marked completed or NA in any week"""
    from app.models.models import WeeklyTaskStatus
    completed_statuses = db.query(WeeklyTaskStatus.task_id).filter(
        (WeeklyTaskStatus.is_completed == True) | (WeeklyTaskStatus.is_na == True)
    ).distinct().all()
    return [status.task_id for status in completed_statuses]


@router.get("/status/{week_start_date}")
def get_week_task_statuses(
    week_start_date: date,
    db: Session = Depends(get_db)
):
    """Get all task completion statuses for a specific week"""
    statuses = weekly_task_status_service.get_week_statuses(db, week_start_date)
    return statuses


@router.post("/status/{task_id}/complete")
def mark_task_complete(
    task_id: int,
    week_start_date: date,
    db: Session = Depends(get_db)
):
    """Mark a task as complete for a specific week"""
    status = weekly_task_status_service.mark_task_complete_for_week(db, task_id, week_start_date)
    return status


@router.post("/status/{task_id}/na")
def mark_task_na(
    task_id: int,
    week_start_date: date,
    db: Session = Depends(get_db)
):
    """Mark a task as NA for a specific week"""
    status = weekly_task_status_service.mark_task_na_for_week(db, task_id, week_start_date)
    return status


@router.delete("/status/{task_id}/reset")
def reset_task_status(
    task_id: int,
    week_start_date: date,
    db: Session = Depends(get_db)
):
    """Reset/remove task status for a specific week"""
    success = weekly_task_status_service.reset_task_status_for_week(db, task_id, week_start_date)
    if not success:
        raise HTTPException(status_code=404, detail="Status not found")
    return {"success": True}
