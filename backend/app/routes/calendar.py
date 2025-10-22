"""
Calendar API Routes
Endpoints for daily, weekly, and monthly calendar views
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from app.database.config import get_db
from app.services.calendar_service import CalendarService


router = APIRouter()


def get_calendar_service(db: Session = Depends(get_db)) -> CalendarService:
    """Dependency to get CalendarService instance"""
    return CalendarService(db)


@router.get("/daily")
def get_daily_calendar(
    target_date: date = Query(..., description="Date for daily view"),
    pillar_id: Optional[int] = Query(None, gt=0, description="Filter by pillar"),
    service: CalendarService = Depends(get_calendar_service)
):
    """
    Get daily calendar view
    
    Shows all events for a specific day:
    - Time entries with start/end times
    - Tasks due on this day or with daily frequency
    - Active goals for context
    
    - **target_date**: The date to view
    - **pillar_id**: Optional filter by pillar
    
    Returns detailed event list with timing, pillar info, and daily summary.
    """
    return service.get_daily_view(target_date, pillar_id)


@router.get("/weekly")
def get_weekly_calendar(
    start_date: date = Query(..., description="Start date of week (typically Monday)"),
    pillar_id: Optional[int] = Query(None, gt=0, description="Filter by pillar"),
    service: CalendarService = Depends(get_calendar_service)
):
    """
    Get weekly calendar view
    
    Shows 7-day week starting from start_date:
    - Day-by-day breakdown
    - Time entries and tasks per day
    - Daily and weekly summaries
    
    - **start_date**: First day of the week
    - **pillar_id**: Optional filter by pillar
    
    Returns array of days with events and weekly totals.
    """
    return service.get_weekly_view(start_date, pillar_id)


@router.get("/monthly")
def get_monthly_calendar(
    year: int = Query(..., ge=2020, le=2100, description="Year"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    pillar_id: Optional[int] = Query(None, gt=0, description="Filter by pillar"),
    service: CalendarService = Depends(get_calendar_service)
):
    """
    Get monthly calendar view
    
    Shows entire month with all days:
    - Day-by-day event counts
    - Weekend indicators
    - Today marker
    - Monthly goals
    
    - **year**: Year to view
    - **month**: Month to view (1-12)
    - **pillar_id**: Optional filter by pillar
    
    Returns all days in month with event indicators and monthly summary.
    """
    return service.get_monthly_view(year, month, pillar_id)


@router.get("/upcoming")
def get_upcoming_events(
    days_ahead: int = Query(7, ge=1, le=90, description="Number of days to look ahead"),
    pillar_id: Optional[int] = Query(None, gt=0, description="Filter by pillar"),
    service: CalendarService = Depends(get_calendar_service)
):
    """
    Get upcoming events
    
    Shows upcoming tasks and goals for next N days:
    - Tasks with due dates
    - Goals ending soon
    - Urgency indicators (overdue, today, upcoming)
    - Sorted by days until due
    
    - **days_ahead**: How many days to look ahead (1-90)
    - **pillar_id**: Optional filter by pillar
    
    Returns sorted list of upcoming events with urgency status.
    """
    return service.get_upcoming_events(days_ahead, pillar_id)
