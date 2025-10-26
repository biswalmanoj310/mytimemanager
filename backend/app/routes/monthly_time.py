"""
API routes for monthly time entries and status
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List, Optional
from app.database.config import get_db
from app.services.monthly_time_service import (
    get_monthly_time_entries,
    bulk_save_monthly_entries
)
from app.services.monthly_task_status_service import (
    get_month_statuses,
    mark_task_complete_for_month,
    mark_task_na_for_month,
    reset_task_status_for_month
)

router = APIRouter(prefix="/api/monthly-time", tags=["monthly-time"])


@router.get("/entries/{month_start_date}")
def get_monthly_entries(
    month_start_date: date,
    task_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all time entries for a specific month"""
    entries = get_monthly_time_entries(db, month_start_date, task_id)
    return entries


@router.get("/entries/year/{year_start_date}")
def get_year_monthly_aggregates(
    year_start_date: date,
    db: Session = Depends(get_db)
):
    """Get aggregated monthly entries for a year
    Returns: {task_id: {month: total_minutes}}
    where month is 1-12 for Jan-Dec
    """
    from app.models.models import MonthlyTimeEntry
    from calendar import monthrange
    
    result = {}
    year = year_start_date.year
    
    # Iterate through all 12 months
    for month in range(1, 13):
        # Get the number of days in this month
        days_in_month = monthrange(year, month)[1]
        
        # Create month start date
        current_month_start = date(year, month, 1)
        
        # Get all entries for this month
        entries = db.query(MonthlyTimeEntry).filter(
            func.date(MonthlyTimeEntry.month_start_date) == current_month_start
        ).all()
        
        # Aggregate by task for this month
        for entry in entries:
            task_id = entry.task_id
            if task_id not in result:
                result[task_id] = {}
            
            if month not in result[task_id]:
                result[task_id][month] = 0
            
            result[task_id][month] += entry.minutes
    
    return result


@router.post("/entries/bulk/")
def bulk_save_entries(
    bulk_data: dict,
    db: Session = Depends(get_db)
):
    """Bulk save time entries for a specific month"""
    try:
        month_start_date_str = bulk_data.get('month_start_date')
        if isinstance(month_start_date_str, str):
            month_start_date = datetime.fromisoformat(month_start_date_str.replace('Z', '+00:00')).date()
        else:
            month_start_date = month_start_date_str.date() if hasattr(month_start_date_str, 'date') else month_start_date_str
        
        entries = bulk_data.get('entries', [])
        success = bulk_save_monthly_entries(db, month_start_date, entries)
        return {"success": success, "message": "Entries saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Monthly Task Status Routes

@router.get("/status/{month_start_date}")
def get_month_task_statuses(
    month_start_date: date,
    db: Session = Depends(get_db)
):
    """Get all task completion statuses for a specific month"""
    statuses = get_month_statuses(db, month_start_date)
    return statuses


@router.post("/status/{task_id}/complete")
def mark_task_complete(
    task_id: int,
    month_start_date: date = Query(...),
    db: Session = Depends(get_db)
):
    """Mark a task as complete for a specific month"""
    status = mark_task_complete_for_month(db, task_id, month_start_date)
    return status


@router.post("/status/{task_id}/na")
def mark_task_na(
    task_id: int,
    month_start_date: date = Query(...),
    db: Session = Depends(get_db)
):
    """Mark a task as NA for a specific month"""
    status = mark_task_na_for_month(db, task_id, month_start_date)
    return status


@router.delete("/status/{task_id}/reset")
def reset_task_status(
    task_id: int,
    month_start_date: date,
    db: Session = Depends(get_db)
):
    """Reset/remove task status for a specific month"""
    success = reset_task_status_for_month(db, task_id, month_start_date)
    if not success:
        raise HTTPException(status_code=404, detail="Status not found")
    return {"success": True}


@router.post("/status/{task_id}/{month_start_date}")
def create_or_update_task_status(
    task_id: int,
    month_start_date: date,
    status_data: dict,
    db: Session = Depends(get_db)
):
    """Create or update a task status for a specific month"""
    from app.models.models import MonthlyTaskStatus
    
    # Check if status already exists
    existing = db.query(MonthlyTaskStatus).filter(
        MonthlyTaskStatus.task_id == task_id,
        func.date(MonthlyTaskStatus.month_start_date) == month_start_date
    ).first()
    
    if existing:
        # Update existing
        existing.is_completed = status_data.get('is_completed', existing.is_completed)
        existing.is_na = status_data.get('is_na', existing.is_na)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new
        new_status = MonthlyTaskStatus(
            task_id=task_id,
            month_start_date=datetime.combine(month_start_date, datetime.min.time()),
            is_completed=status_data.get('is_completed', False),
            is_na=status_data.get('is_na', False)
        )
        db.add(new_status)
        db.commit()
        db.refresh(new_status)
        return new_status
