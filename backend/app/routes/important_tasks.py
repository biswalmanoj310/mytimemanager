"""
API routes for Important Tasks - Periodic check tasks
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
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


class ImportantTaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ideal_gap_days: Optional[int] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


def calculate_status(task: ImportantTask) -> dict:
    """Calculate status (red/yellow/green) and days info"""
    if not task.last_check_date:
        return {
            "status": "red",
            "days_since_check": None,
            "days_overdue": None,
            "message": "Never checked"
        }
    
    now = datetime.now()
    days_since = (now - task.last_check_date).days
    days_overdue = days_since - task.ideal_gap_days
    
    if days_overdue > 0:
        status = "red"
        message = f"{days_overdue} days overdue"
    elif days_overdue > -5:  # Within 5 days of due
        status = "yellow"
        message = f"Due in {abs(days_overdue)} days"
    else:
        status = "green"
        message = f"{abs(days_overdue)} days until due"
    
    return {
        "status": status,
        "days_since_check": days_since,
        "days_overdue": days_overdue if days_overdue > 0 else 0,
        "days_until_due": abs(days_overdue) if days_overdue < 0 else 0,
        "message": message
    }


@router.get("/")
def get_all_important_tasks(
    status_filter: Optional[str] = None,  # red, yellow, green
    db: Session = Depends(get_db)
):
    """Get all important tasks with status"""
    tasks = db.query(ImportantTask).filter(ImportantTask.is_active == True).all()
    
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
    db_task = ImportantTask(
        name=task.name,
        description=task.description,
        pillar_id=task.pillar_id,
        category_id=task.category_id,
        sub_category_id=task.sub_category_id,
        ideal_gap_days=task.ideal_gap_days,
        priority=task.priority,
        check_history="[]"
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
    if task.ideal_gap_days is not None:
        db_task.ideal_gap_days = task.ideal_gap_days
    if task.priority is not None:
        db_task.priority = task.priority
    if task.is_active is not None:
        db_task.is_active = task.is_active
    
    db.commit()
    return {"message": "Task updated"}


@router.post("/{task_id}/check")
def mark_task_checked(
    task_id: int,
    db: Session = Depends(get_db)
):
    """Mark task as checked (completed for this cycle)"""
    db_task = db.query(ImportantTask).filter(ImportantTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    now = datetime.now()
    db_task.last_check_date = now
    
    # Update check history
    history = json.loads(db_task.check_history or "[]")
    history.append(now.isoformat())
    db_task.check_history = json.dumps(history[-10:])  # Keep last 10 checks
    
    db.commit()
    
    return {"message": "Task marked as checked", "last_check_date": now}


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
