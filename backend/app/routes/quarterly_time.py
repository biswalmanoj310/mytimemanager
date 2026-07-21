"""
API routes for quarterly task status.
Fully independent from yearly_task_status — tasks can be monitored in
quarterly without being in yearly and vice versa.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime
from typing import Optional

from app.database.config import get_db

router = APIRouter(prefix="/api/quarterly-time", tags=["quarterly-time"])


@router.get("/status/{year_start_date}")
def get_quarterly_task_statuses(
    year_start_date: date,
    db: Session = Depends(get_db)
):
    """Get all quarterly task statuses for a specific year."""
    from app.models.models import QuarterlyTaskStatus
    statuses = db.query(QuarterlyTaskStatus).filter(
        func.date(QuarterlyTaskStatus.year_start_date) == year_start_date
    ).all()
    return statuses


@router.post("/status/{task_id}/{year_start_date}")
def create_or_update_quarterly_status(
    task_id: int,
    year_start_date: date,
    status_data: dict,
    db: Session = Depends(get_db)
):
    """Create or update quarterly monitoring status for a task."""
    from app.models.models import QuarterlyTaskStatus

    existing = db.query(QuarterlyTaskStatus).filter(
        QuarterlyTaskStatus.task_id == task_id,
        func.date(QuarterlyTaskStatus.year_start_date) == year_start_date
    ).first()

    if existing:
        existing.is_completed = status_data.get('is_completed', existing.is_completed)
        existing.is_na = status_data.get('is_na', existing.is_na)
        if existing.is_completed:
            existing.completed_at = datetime.utcnow()
        else:
            existing.completed_at = None
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new_status = QuarterlyTaskStatus(
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
def delete_quarterly_status(
    task_id: int,
    year_start_date: date,
    db: Session = Depends(get_db)
):
    """Remove a task from quarterly monitoring (keeps it in yearly if present there)."""
    from app.models.models import QuarterlyTaskStatus

    status = db.query(QuarterlyTaskStatus).filter(
        QuarterlyTaskStatus.task_id == task_id,
        func.date(QuarterlyTaskStatus.year_start_date) == year_start_date
    ).first()

    if not status:
        raise HTTPException(status_code=404, detail="Quarterly status not found")

    db.delete(status)
    db.commit()
    return {"success": True}
