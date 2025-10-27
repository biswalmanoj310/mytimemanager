"""
Completed Tasks Route
API endpoints for viewing completed tasks across all task types
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Dict, Any
from app.database.config import get_db
from app.models.models import Task, ProjectTask

router = APIRouter(prefix="/api", tags=["completed"])


@router.get("/completed-tasks")
def get_completed_tasks(
    period: str = Query("today", regex="^(today|week|month|all)$"),
    db: Session = Depends(get_db)
):
    """
    Get all completed tasks across daily tasks, project tasks, and goal tasks
    Period can be: today, week, month, all
    """
    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    
    # Calculate date range based on period
    if period == "today":
        start_date = today_start
    elif period == "week":
        start_date = datetime.combine(today - timedelta(days=7), datetime.min.time())
    elif period == "month":
        start_date = datetime.combine(today - timedelta(days=30), datetime.min.time())
    else:  # all
        start_date = None
    
    completed_tasks = []
    
    # Get completed daily tasks
    daily_query = db.query(Task).filter(Task.is_completed == True)
    if start_date:
        daily_query = daily_query.filter(
            or_(
                Task.completed_at >= start_date,
                Task.updated_at >= start_date
            )
        )
    
    for task in daily_query.all():
        completed_tasks.append({
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "completed_at": task.completed_at or task.updated_at,
            "task_type": "daily",
            "category_name": task.category.name if task.category else None,
            "pillar_name": task.pillar.name if task.pillar else None,
            "priority": None,
            "due_date": None
        })
    
    # Get completed project tasks
    project_query = db.query(ProjectTask).filter(ProjectTask.is_completed == True)
    if start_date:
        project_query = project_query.filter(
            or_(
                ProjectTask.completed_at >= start_date,
                ProjectTask.updated_at >= start_date
            )
        )
    
    for task in project_query.all():
        completed_tasks.append({
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "completed_at": task.completed_at or task.updated_at,
            "task_type": "project",
            "project_name": task.project.name if task.project else None,
            "priority": task.priority,
            "due_date": task.due_date.date() if task.due_date else None
        })
    
    # Sort by completion date (most recent first)
    completed_tasks.sort(key=lambda x: x["completed_at"], reverse=True)
    
    # Calculate stats
    today_count = sum(1 for t in completed_tasks if t["completed_at"].date() == today)
    week_start = today - timedelta(days=7)
    week_count = sum(1 for t in completed_tasks if t["completed_at"].date() >= week_start)
    month_start = today - timedelta(days=30)
    month_count = sum(1 for t in completed_tasks if t["completed_at"].date() >= month_start)
    
    return {
        "tasks": completed_tasks,
        "stats": {
            "today": today_count,
            "week": week_count,
            "month": month_count,
            "all": len(completed_tasks)
        }
    }
