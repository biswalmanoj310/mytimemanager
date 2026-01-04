"""
API routes for Important Tasks - Periodic check tasks
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import json

from app.database.config import get_db
from app.models.models import ImportantTask

router = APIRouter()


class ImportantTaskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    ideal_gap_days: int
    priority: int = 5
    parent_id: Optional[int] = None  # For creating sub-tasks


class ImportantTaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    ideal_gap_days: Optional[int] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    start_date: Optional[str] = None  # ISO format date string
    parent_id: Optional[int] = None  # For moving tasks to become sub-tasks


def calculate_status(task: ImportantTask) -> dict:
    """Calculate status (red/yellow/green) and days info"""
    now = datetime.now()
    
    # Use last_check_date if available, otherwise use start_date or created_at
    reference_date = task.last_check_date or task.start_date or task.created_at
    if not reference_date:
        return {
            "status": "red",
            "days_since_check": 0,
            "diff": -task.ideal_gap_days,
            "message": "No reference date"
        }
    
    days_since = (now - reference_date).days
    diff = task.ideal_gap_days - days_since  # Positive = still have time, Negative = overdue
    
    # Color coding: Green (Diff > 5), Gray (0 < Diff <= 5), Red (Diff < 0)
    if diff > 5:
        status = "green"
        message = f"{diff} days remaining"
    elif diff >= 0:
        status = "gray"
        message = f"{diff} days remaining (due soon)"
    else:
        status = "red"
        message = f"{abs(diff)} days overdue"
    
    return {
        "status": status,
        "days_since_check": days_since,
        "diff": diff,
        "message": message
    }


@router.get("/")
def get_all_important_tasks(
    status_filter: Optional[str] = None,  # red, yellow, green
    include_inactive: bool = True,  # Include completed tasks
    db: Session = Depends(get_db)
):
    """Get all important tasks with status"""
    query = db.query(ImportantTask)
    if not include_inactive:
        query = query.filter(ImportantTask.is_active == True)
    
    tasks = query.all()
    
    result = []
    for task in tasks:
        status_info = calculate_status(task)
        
        # Apply status filter if provided
        if status_filter and status_info["status"] != status_filter:
            continue
        
        result.append({
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "pillar_id": task.pillar_id,
            "pillar_name": task.pillar.name if task.pillar else None,
            "category_id": task.category_id,
            "category_name": task.category.name if task.category else None,
            "sub_category_id": task.sub_category_id,
            "ideal_gap_days": task.ideal_gap_days,
            "last_check_date": task.last_check_date.isoformat() if task.last_check_date else None,
            "start_date": task.start_date.isoformat() if task.start_date else None,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "priority": task.priority,
            "is_active": task.is_active,
            "parent_id": task.parent_id,
            **status_info
        })
    
    return result


@router.post("/")
def create_important_task(
    task: ImportantTaskCreate,
    db: Session = Depends(get_db)
):
    """Create new important task"""
    # Get current time with local timezone awareness
    local_tz = datetime.now().astimezone().tzinfo
    current_time = datetime.now(local_tz)
    
    db_task = ImportantTask(
        name=task.name,
        description=task.description,
        pillar_id=task.pillar_id,
        category_id=task.category_id,
        sub_category_id=task.sub_category_id,
        ideal_gap_days=task.ideal_gap_days,
        priority=task.priority,
        parent_id=task.parent_id,
        check_history="[]",
        start_date=current_time,  # Use timezone-aware local time
        created_at=current_time   # Use timezone-aware local time
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    return {"id": db_task.id, "message": "Important task created"}


@router.put("/{task_id}")
def update_important_task(
    task_id: int,
    task: ImportantTaskUpdate,
    db: Session = Depends(get_db)
):
    """Update important task"""
    db_task = db.query(ImportantTask).filter(ImportantTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.name is not None:
        db_task.name = task.name
    if task.description is not None:
        db_task.description = task.description
    if task.pillar_id is not None:
        db_task.pillar_id = task.pillar_id
    if task.category_id is not None:
        db_task.category_id = task.category_id
    if task.sub_category_id is not None:
        db_task.sub_category_id = task.sub_category_id
    if task.ideal_gap_days is not None:
        db_task.ideal_gap_days = task.ideal_gap_days
    if task.priority is not None:
        db_task.priority = task.priority
    if task.is_active is not None:
        db_task.is_active = task.is_active
    if task.start_date is not None:
        # Handle both ISO format with timezone and simple date format (YYYY-MM-DD)
        if 'T' in task.start_date:
            db_task.start_date = datetime.fromisoformat(task.start_date.replace('Z', '+00:00'))
        else:
            db_task.start_date = datetime.strptime(task.start_date, '%Y-%m-%d')
    if task.parent_id is not None:
        db_task.parent_id = task.parent_id
    
    db.commit()
    return {"message": "Task updated"}


class CheckTaskRequest(BaseModel):
    check_date: Optional[str] = None  # ISO format date string


@router.post("/{task_id}/check")
def mark_task_checked(
    task_id: int,
    request: CheckTaskRequest,
    db: Session = Depends(get_db)
):
    """Mark task as checked (completed for this cycle)"""
    db_task = db.query(ImportantTask).filter(ImportantTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Use provided date or current time
    if request.check_date:
        # Handle both ISO format with timezone and simple date format (YYYY-MM-DD)
        if 'T' in request.check_date:
            # ISO format with time
            check_time = datetime.fromisoformat(request.check_date.replace('Z', '+00:00'))
        else:
            # Simple date format (YYYY-MM-DD) - parse as local date at midnight
            check_time = datetime.strptime(request.check_date, '%Y-%m-%d')
    else:
        check_time = datetime.now()
    
    db_task.last_check_date = check_time
    
    # Update check history
    history = json.loads(db_task.check_history or "[]")
    history.append(check_time.isoformat())
    db_task.check_history = json.dumps(history[-10:])  # Keep last 10 checks
    
    db.commit()
    
    return {"message": "Task marked as checked", "last_check_date": check_time}


@router.delete("/{task_id}")
def delete_important_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    """Delete important task"""
    db_task = db.query(ImportantTask).filter(ImportantTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(db_task)
    db.commit()
    
    return {"message": "Task deleted"}


@router.get("/due-today")
def get_important_tasks_due_today(
    db: Session = Depends(get_db)
):
    """Get important tasks that are due today (overdue or due soon)"""
    query = db.query(ImportantTask).filter(ImportantTask.is_active == True)
    tasks = query.all()
    
    result = []
    for task in tasks:
        status_info = calculate_status(task)
        
        # Include red (overdue) and gray (due soon) tasks
        if status_info["status"] in ["red", "gray"]:
            result.append({
                "id": task.id,
                "name": task.name,
                "description": task.description,
                "pillar_id": task.pillar_id,
                "category_id": task.category_id,
                "sub_category_id": task.sub_category_id,
                "ideal_gap_days": task.ideal_gap_days,
                "last_check_date": task.last_check_date.isoformat() if task.last_check_date else None,
                "priority": task.priority,
                "is_active": task.is_active,
                "start_date": task.start_date.isoformat() if task.start_date else None,
                "parent_id": task.parent_id,
                "status": status_info["status"],
                "days_since_check": status_info["days_since_check"],
                "diff": status_info["diff"],
                "message": status_info["message"]
            })
    
    # Sort by priority (high to low) and then by diff (most overdue first)
    result.sort(key=lambda x: (-x["priority"], x["diff"]))
    
    return result
