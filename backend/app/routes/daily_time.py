"""
API routes for daily time entries and summaries
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List, Optional
from app.database.config import get_db
from app.services import daily_time_service
from app.utils.datetime_utils import get_local_date
from app.models.schemas import (
    DailyTimeEntryCreate,
    DailyTimeEntryBulkCreate,
    DailyTimeEntryResponse,
    DailySummaryResponse,
    IncompleteDayResponse,
    IgnoreDayRequest,
    IgnoredDayResponse
)

router = APIRouter(prefix="/api/daily-time", tags=["daily-time"])


@router.get("/", response_model=List[DailyTimeEntryResponse])
def get_daily_time_entries(
    date: Optional[date] = Query(None, description="Specific date for entries"),
    start_date: Optional[date] = Query(None, description="Start date for date range"),
    end_date: Optional[date] = Query(None, description="End date for date range"),
    task_id: Optional[int] = Query(None, description="Filter by specific task"),
    db: Session = Depends(get_db)
):
    """
    Get daily time entries - supports single date, date range, or all entries
    
    - If date is provided: returns entries for that specific date
    - If start_date and end_date are provided: returns entries in that range
    - If start_date only: returns entries from that date onwards
    - If end_date only: returns entries up to that date
    - If no parameters: returns all entries (use with caution)
    """
    from app.models.models import DailyTimeEntry, Task
    
    query = db.query(DailyTimeEntry).join(Task, DailyTimeEntry.task_id == Task.id)
    
    if date:
        # Single date query
        query = query.filter(func.date(DailyTimeEntry.entry_date) == date)
    else:
        # Date range query
        if start_date:
            query = query.filter(func.date(DailyTimeEntry.entry_date) >= start_date)
        if end_date:
            query = query.filter(func.date(DailyTimeEntry.entry_date) <= end_date)
    
    if task_id:
        query = query.filter(DailyTimeEntry.task_id == task_id)
    
    entries = query.all()
    
    return [
        DailyTimeEntryResponse(
            id=entry.id,
            task_id=entry.task_id,
            entry_date=entry.entry_date,
            hour=entry.hour,
            minutes=entry.minutes,
            created_at=entry.created_at,
            updated_at=entry.updated_at
        )
        for entry in entries
    ]


@router.get("/entries/{entry_date}", response_model=List[DailyTimeEntryResponse])
def get_daily_entries(
    entry_date: date,
    task_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all time entries for a specific date"""
    entries = daily_time_service.get_daily_time_entries(db, entry_date, task_id)
    return entries


@router.post("/entries/", response_model=DailyTimeEntryResponse)
def save_entry(
    entry: DailyTimeEntryCreate,
    db: Session = Depends(get_db)
):
    """Save or update a single time entry"""
    return daily_time_service.save_daily_time_entry(db, entry)


@router.post("/entries/bulk/")
def bulk_save_entries(
    bulk_data: DailyTimeEntryBulkCreate,
    db: Session = Depends(get_db)
):
    """Bulk save time entries for a specific date"""
    try:
        # Convert datetime to date
        entry_date = bulk_data.entry_date.date() if hasattr(bulk_data.entry_date, 'date') else bulk_data.entry_date
        success = daily_time_service.bulk_save_daily_entries(db, entry_date, bulk_data.entries)
        return {"success": success, "message": "Entries saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/summary/{entry_date}", response_model=Optional[DailySummaryResponse])
def get_summary(
    entry_date: date,
    db: Session = Depends(get_db)
):
    """Get summary for a specific date"""
    summary = daily_time_service.get_daily_summary(db, entry_date)
    if not summary:
        # Calculate and create summary if it doesn't exist
        summary = daily_time_service.update_daily_summary(db, entry_date)
    return summary


@router.get("/incomplete-days/", response_model=List[IncompleteDayResponse])
def get_incomplete_days(
    limit: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """Get list of incomplete days where allocated time != spent time"""
    return daily_time_service.get_incomplete_days(db, limit)


@router.put("/summary/{entry_date}/recalculate")
def recalculate_summary(
    entry_date: date,
    db: Session = Depends(get_db)
):
    """Recalculate and update summary for a specific date"""
    summary = daily_time_service.update_daily_summary(db, entry_date)
    return summary


@router.post("/summaries/recalculate-all")
def recalculate_all_summaries(
    limit: int = Query(default=365, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Recalculate all daily summaries (useful after schema changes)"""
    from app.models.models import DailySummary
    
    # Get all summary dates
    summaries = db.query(DailySummary).order_by(DailySummary.entry_date).limit(limit).all()
    
    recalculated = 0
    for summary in summaries:
        entry_date = summary.entry_date.date() if hasattr(summary.entry_date, 'date') else summary.entry_date
        daily_time_service.update_daily_summary(db, entry_date)
        recalculated += 1
    
    return {
        "success": True,
        "recalculated": recalculated,
        "message": f"Successfully recalculated {recalculated} daily summaries"
    }


@router.get("/entries/week/{week_start_date}")
def get_week_daily_entries(
    week_start_date: date,
    db: Session = Depends(get_db)
):
    """Get aggregated daily entries for a week (7 days starting from week_start_date)"""
    return daily_time_service.get_week_daily_aggregates(db, week_start_date)


@router.get("/entries/month/{month_start_date}")
def get_month_daily_entries(
    month_start_date: date,
    db: Session = Depends(get_db)
):
    """Get aggregated daily entries for a month (all days in the month starting from month_start_date)"""
    return daily_time_service.get_month_daily_aggregates(db, month_start_date)


@router.get("/today")
def get_today_date():
    """Get today's date in server's local timezone"""
    return {
        "date": get_local_date().isoformat(),
        "datetime": datetime.now().isoformat()
    }


@router.post("/ignore/{entry_date}")
def ignore_day(
    entry_date: date,
    request: IgnoreDayRequest,
    db: Session = Depends(get_db)
):
    """Mark a day as ignored (travel, sick days, etc.)"""
    summary = daily_time_service.ignore_day(db, entry_date, request.reason)
    if not summary:
        raise HTTPException(status_code=404, detail="Day summary not found")
    return {"success": True, "message": "Day marked as ignored", "entry_date": entry_date}


@router.post("/unignore/{entry_date}")
def unignore_day(
    entry_date: date,
    db: Session = Depends(get_db)
):
    """Remove ignore flag from a day"""
    summary = daily_time_service.unignore_day(db, entry_date)
    if not summary:
        raise HTTPException(status_code=404, detail="Day summary not found")
    return {"success": True, "message": "Day unignored", "entry_date": entry_date}


@router.get("/ignored-days/", response_model=List[IgnoredDayResponse])
def get_ignored_days(
    limit: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """Get list of ignored days"""
    return daily_time_service.get_ignored_days(db, limit)
