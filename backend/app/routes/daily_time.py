"""
API routes for daily time entries and summaries
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import List, Optional
from app.database.config import get_db
from app.services import daily_time_service
from app.models.schemas import (
    DailyTimeEntryCreate,
    DailyTimeEntryBulkCreate,
    DailyTimeEntryResponse,
    DailySummaryResponse,
    IncompleteDayResponse
)

router = APIRouter(prefix="/api/daily-time", tags=["daily-time"])


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
