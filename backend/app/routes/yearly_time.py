"""
API routes for yearly time entries and status
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List, Optional
from app.database.config import get_db
from app.services.yearly_time_service import (
    get_yearly_time_entries,
    bulk_save_yearly_entries
)

router = APIRouter(prefix="/api/yearly-time", tags=["yearly-time"])


@router.get("/entries/{year_start_date}")
def get_yearly_entries(
    year_start_date: date,
    task_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all time entries for a specific year"""
    entries = get_yearly_time_entries(db, year_start_date, task_id)
    return entries


@router.post("/entries/bulk")
def bulk_save_entries(
    bulk_data: dict,
    db: Session = Depends(get_db)
):
    """Bulk save time entries for a specific year"""
    try:
        year_start_date_str = bulk_data.get('year_start_date')
        if isinstance(year_start_date_str, str):
            year_start_date = datetime.fromisoformat(year_start_date_str.replace('Z', '+00:00')).date()
        else:
            year_start_date = year_start_date_str.date() if hasattr(year_start_date_str, 'date') else year_start_date_str
        
        entries = bulk_data.get('entries', [])
        success = bulk_save_yearly_entries(db, year_start_date, entries)
        return {"success": success, "message": "Entries saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Yearly Task Status Routes

@router.get("/status/{year_start_date}")
def get_year_task_statuses(
    year_start_date: date,
    db: Session = Depends(get_db)
):
    """Get all task completion statuses for a specific year"""
    from app.models.models import YearlyTaskStatus
    
    statuses = db.query(YearlyTaskStatus).filter(
        func.date(YearlyTaskStatus.year_start_date) == year_start_date
    ).all()
    return statuses


@router.post("/status/{task_id}/{year_start_date}")
def create_or_update_task_status(
    task_id: int,
    year_start_date: date,
    status_data: dict,
    db: Session = Depends(get_db)
):
    """Create or update a task status for a specific year"""
    from app.models.models import YearlyTaskStatus
    
    # Check if status already exists
    existing = db.query(YearlyTaskStatus).filter(
        YearlyTaskStatus.task_id == task_id,
        func.date(YearlyTaskStatus.year_start_date) == year_start_date
    ).first()
    
    if existing:
        # Update existing
        existing.is_completed = status_data.get('is_completed', False)
        existing.is_na = status_data.get('is_na', False)
        if existing.is_completed:
            existing.completed_at = datetime.utcnow()
        else:
            existing.completed_at = None
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new
        new_status = YearlyTaskStatus(
            task_id=task_id,
            year_start_date=datetime.combine(year_start_date, datetime.min.time()),
            is_completed=status_data.get('is_completed', False),
            is_na=status_data.get('is_na', False),
            completed_at=datetime.utcnow() if status_data.get('is_completed', False) else None
        )
        db.add(new_status)
        db.commit()
        db.refresh(new_status)
        return new_status


@router.delete("/status/{task_id}/{year_start_date}")
def delete_task_status(
    task_id: int,
    year_start_date: date,
    db: Session = Depends(get_db)
):
    """Delete a task status for a specific year"""
    from app.models.models import YearlyTaskStatus
    
    result = db.query(YearlyTaskStatus).filter(
        YearlyTaskStatus.task_id == task_id,
        func.date(YearlyTaskStatus.year_start_date) == year_start_date
    ).delete()
    db.commit()
    
    if result == 0:
        raise HTTPException(status_code=404, detail="Status not found")
    
    return {"success": True}


@router.get("/aggregates/{year_start_date}")
def get_year_aggregates_from_all_tabs(
    year_start_date: date,
    db: Session = Depends(get_db)
):
    """Get aggregated data from daily, weekly, and monthly tabs for a year
    Returns: {task_id: {month: total_minutes}}
    where month is 1-12 for Jan-Dec
    """
    from app.models.models import DailyTimeEntry, WeeklyTimeEntry, MonthlyTimeEntry
    from calendar import monthrange
    from datetime import timedelta
    
    result = {}
    year = year_start_date.year
    
    # 1. Aggregate DAILY data by month
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)
    
    daily_entries = db.query(DailyTimeEntry).filter(
        DailyTimeEntry.entry_date >= year_start,
        DailyTimeEntry.entry_date <= year_end
    ).all()
    
    for entry in daily_entries:
        task_id = entry.task_id
        month = entry.entry_date.month  # 1-12
        
        if task_id not in result:
            result[task_id] = {}
        if month not in result[task_id]:
            result[task_id][month] = 0
        
        result[task_id][month] += entry.minutes
    
    # 2. Aggregate WEEKLY data by month
    # We need to find all weeks that overlap with this year
    weekly_entries = db.query(WeeklyTimeEntry).filter(
        WeeklyTimeEntry.week_start_date >= year_start,
        WeeklyTimeEntry.week_start_date <= year_end
    ).all()
    
    for entry in weekly_entries:
        task_id = entry.task_id
        week_start = entry.week_start_date
        day = entry.day_of_week  # 0-6 for Mon-Sun
        
        # Calculate the actual date for this day
        actual_date = week_start + timedelta(days=day)
        
        # Only count if the date falls within the year
        if actual_date.year == year:
            month = actual_date.month
            
            if task_id not in result:
                result[task_id] = {}
            if month not in result[task_id]:
                result[task_id][month] = 0
            
            result[task_id][month] += entry.minutes
    
    # 3. Aggregate MONTHLY data
    for month in range(1, 13):
        current_month_start = date(year, month, 1)
        
        monthly_entries = db.query(MonthlyTimeEntry).filter(
            func.date(MonthlyTimeEntry.month_start_date) == current_month_start
        ).all()
        
        for entry in monthly_entries:
            task_id = entry.task_id
            
            if task_id not in result:
                result[task_id] = {}
            if month not in result[task_id]:
                result[task_id][month] = 0
            
            result[task_id][month] += entry.minutes
    
    return result
