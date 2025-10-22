"""
Time Entry API Routes
Endpoints for time tracking with 30-minute slot validation
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime

from app.database.config import get_db
from app.models.schemas import (
    TimeEntryCreate, 
    TimeEntryUpdate, 
    TimeEntryResponse,
    TimeEntryWithDetails
)
from app.services.time_entry_service import TimeEntryService


router = APIRouter()


def get_time_entry_service(db: Session = Depends(get_db)) -> TimeEntryService:
    """Dependency to get TimeEntryService instance"""
    return TimeEntryService(db)


@router.post("/", response_model=TimeEntryResponse, status_code=status.HTTP_201_CREATED)
def create_time_entry(
    entry: TimeEntryCreate,
    service: TimeEntryService = Depends(get_time_entry_service)
):
    """
    Create a new time entry
    
    - **task_id**: ID of the task to track time for
    - **start_time**: Start time of the entry
    - **end_time**: End time of the entry (must be 30-minute increments)
    - **entry_date**: Date of entry (defaults to start_time date)
    - **notes**: Optional notes about the time entry
    
    Duration is automatically calculated and must be in 30-minute increments.
    Validates that time slots don't overlap with existing entries.
    """
    return service.create_time_entry(entry)


@router.get("/", response_model=List[TimeEntryResponse])
def get_time_entries(
    task_id: Optional[int] = Query(None, gt=0),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: TimeEntryService = Depends(get_time_entry_service)
):
    """
    Get time entries with optional filters
    
    - **task_id**: Filter by task ID
    - **start_date**: Filter entries on or after this date
    - **end_date**: Filter entries on or before this date
    - **skip**: Number of records to skip
    - **limit**: Maximum number of records to return
    """
    return service.get_time_entries(
        task_id=task_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit
    )


@router.get("/{entry_id}", response_model=TimeEntryResponse)
def get_time_entry(
    entry_id: int,
    service: TimeEntryService = Depends(get_time_entry_service)
):
    """
    Get a specific time entry by ID
    
    - **entry_id**: ID of the time entry
    """
    return service.get_time_entry(entry_id)


@router.put("/{entry_id}", response_model=TimeEntryResponse)
def update_time_entry(
    entry_id: int,
    entry: TimeEntryUpdate,
    service: TimeEntryService = Depends(get_time_entry_service)
):
    """
    Update a time entry
    
    - **entry_id**: ID of the time entry to update
    
    Can update task_id, start_time, end_time, entry_date, or notes.
    Duration is recalculated if times change.
    Validates 30-minute increments and checks for overlaps.
    """
    return service.update_time_entry(entry_id, entry)


@router.delete("/{entry_id}")
def delete_time_entry(
    entry_id: int,
    service: TimeEntryService = Depends(get_time_entry_service)
):
    """
    Delete a time entry
    
    - **entry_id**: ID of the time entry to delete
    
    Also updates the associated task's spent_minutes.
    """
    return service.delete_time_entry(entry_id)


@router.get("/grid/daily")
def get_daily_grid(
    target_date: date = Query(..., description="Date to get grid for"),
    service: TimeEntryService = Depends(get_time_entry_service)
):
    """
    Get daily time grid with 30-minute slots
    
    - **target_date**: Date to get the grid for
    
    Returns all 48 slots (00:00-23:30) with occupancy status.
    Each occupied slot shows the task, pillar, and category information.
    """
    return service.get_daily_grid(target_date)


@router.get("/summary/week")
def get_week_summary(
    start_date: date = Query(..., description="Start date of the week (Monday)"),
    service: TimeEntryService = Depends(get_time_entry_service)
):
    """
    Get weekly time tracking summary
    
    - **start_date**: Start date of the week
    
    Returns summary grouped by pillar and by day.
    Shows total hours and entry counts.
    """
    return service.get_week_summary(start_date)


@router.get("/statistics/overview")
def get_statistics(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    service: TimeEntryService = Depends(get_time_entry_service)
):
    """
    Get comprehensive time tracking statistics
    
    - **start_date**: Optional start date for filtering
    - **end_date**: Optional end date for filtering
    
    Returns statistics grouped by pillar, category, and task.
    Includes total time, entry counts, and averages.
    """
    return service.get_statistics(start_date=start_date, end_date=end_date)
