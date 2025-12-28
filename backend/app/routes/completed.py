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
    period: str = Query("today", regex="^(today|week|month|year|all|custom)$"),
    start_date_str: str = Query(None),
    end_date_str: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get all completed tasks across daily tasks, project tasks, and goal tasks
    Period can be: today, week, month, year, all, custom
    For custom period, provide start_date and end_date in YYYY-MM-DD format
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
    elif period == "year":
        start_date = datetime.combine(today - timedelta(days=365), datetime.min.time())
    elif period == "custom" and start_date_str:
        start_date = datetime.combine(datetime.strptime(start_date_str, "%Y-%m-%d").date(), datetime.min.time())
    else:  # all
        start_date = None
    
    # Handle end date for custom range
    end_date = None
    if period == "custom" and end_date_str:
        end_date = datetime.combine(datetime.strptime(end_date_str, "%Y-%m-%d").date(), datetime.max.time())
    
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
    if end_date:
        daily_query = daily_query.filter(
            or_(
                Task.completed_at <= end_date,
                Task.updated_at <= end_date
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
    if end_date:
        project_query = project_query.filter(
            or_(
                ProjectTask.completed_at <= end_date,
                ProjectTask.updated_at <= end_date
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
    
    # Calculate stats from ALL completed tasks (not just filtered ones)
    # Get all completed tasks without date filters for stats calculation
    all_daily = db.query(Task).filter(Task.is_completed == True).all()
    all_project = db.query(ProjectTask).filter(ProjectTask.is_completed == True).all()
    
    all_completed = []
    for task in all_daily:
        all_completed.append({
            "completed_at": task.completed_at or task.updated_at
        })
    for task in all_project:
        all_completed.append({
            "completed_at": task.completed_at or task.updated_at
        })
    
    # Calculate each stat independently
    today_count = sum(1 for t in all_completed if t["completed_at"].date() == today)
    week_start = today - timedelta(days=7)
    week_count = sum(1 for t in all_completed if t["completed_at"].date() >= week_start)
    month_start = today - timedelta(days=30)
    month_count = sum(1 for t in all_completed if t["completed_at"].date() >= month_start)
    year_start = today - timedelta(days=365)
    year_count = sum(1 for t in all_completed if t["completed_at"].date() >= year_start)
    all_count = len(all_completed)
    
    return {
        "tasks": completed_tasks,
        "stats": {
            "today": today_count,
            "week": week_count,
            "month": month_count,
            "year": year_count,
            "all": all_count
        }
    }
