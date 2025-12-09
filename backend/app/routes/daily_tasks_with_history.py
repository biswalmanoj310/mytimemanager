"""
API routes for daily tasks with completion history
Returns daily tasks with information about when they were last completed
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import date
from typing import List, Dict, Any
from app.database.config import get_db
from app.models.models import Task, DailyTaskStatus

router = APIRouter(prefix="/api/daily-tasks-history", tags=["daily-tasks-history"])


@router.get("/")
def get_daily_tasks_with_history(
    viewing_date: date = Query(..., description="Date being viewed in the UI"),
    db: Session = Depends(get_db)
):
    """
    Get all daily tasks with their completion history
    
    For each daily task, returns:
    - Task details
    - First completion date (if ever completed)
    - Whether task should be visible on the viewing_date
    
    Visibility rules:
    1. Task is visible ONLY if created_at <= viewing_date
    2. Task is NOT visible if it was completed on any date <= viewing_date
    """
    # Get all active daily tasks
    daily_tasks = db.query(Task).filter(
        and_(
            Task.follow_up_frequency == 'daily',
            Task.is_active == True
        )
    ).all()
    
    result = []
    
    for task in daily_tasks:
        # Check if task was created before or on the viewing date
        task_created_date = task.created_at.date() if task.created_at else None
        if task_created_date and task_created_date > viewing_date:
            # Task doesn't exist on this date yet
            continue
        
        # Check if task was EVER completed on or before the viewing date
        first_completion = db.query(DailyTaskStatus).filter(
            and_(
                DailyTaskStatus.task_id == task.id,
                DailyTaskStatus.is_completed == True,
                DailyTaskStatus.date <= viewing_date
            )
        ).order_by(DailyTaskStatus.date).first()
        
        if first_completion:
            # Task was completed on or before viewing date, so it shouldn't appear
            continue
        
        # Task should be visible - add to result
        task_data = {
            'id': task.id,
            'name': task.name,
            'created_at': task.created_at.isoformat() if task.created_at else None,
            'should_be_visible': True
        }
        result.append(task_data)
    
    return result


@router.get("/completion-dates")
def get_completion_dates_for_daily_tasks(
    db: Session = Depends(get_db)
) -> Dict[int, str]:
    """
    Get first completion date for each daily task
    Returns a map of task_id -> first_completion_date (ISO format)
    """
    # Get all daily tasks
    daily_tasks = db.query(Task.id).filter(
        and_(
            Task.follow_up_frequency == 'daily',
            Task.is_active == True
        )
    ).all()
    
    task_ids = [t[0] for t in daily_tasks]
    
    # For each task, find first completion date
    completion_map = {}
    
    for task_id in task_ids:
        first_completion = db.query(DailyTaskStatus).filter(
            and_(
                DailyTaskStatus.task_id == task_id,
                DailyTaskStatus.is_completed == True
            )
        ).order_by(DailyTaskStatus.date).first()
        
        if first_completion:
            completion_map[task_id] = first_completion.date.isoformat()
    
    return completion_map
