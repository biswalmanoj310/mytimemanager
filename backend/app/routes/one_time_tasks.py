"""
API routes for one-time tasks
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from typing import List, Optional
from app.database.config import get_db
from app.services.one_time_task_service import (
    get_all_one_time_tasks,
    get_one_time_task_by_task_id,
    create_one_time_task,
    update_one_time_task,
    delete_one_time_task
)

router = APIRouter(prefix="/api/one-time-tasks", tags=["one-time-tasks"])


@router.get("/")
def get_all_tasks(db: Session = Depends(get_db)):
    """Get all one-time tasks"""
    tasks = get_all_one_time_tasks(db)
    return tasks


@router.get("/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db)):
    """Get one-time task by task ID"""
    task = get_one_time_task_by_task_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="One-time task not found")
    return task


@router.post("/")
def create_task(
    task_data: dict,
    db: Session = Depends(get_db)
):
    """Create a new one-time task entry"""
    task_id = task_data.get('task_id')
    start_date_str = task_data.get('start_date')
    target_gap = task_data.get('target_gap')
    updated_date_str = task_data.get('updated_date')
    
    if not task_id or not start_date_str:
        raise HTTPException(status_code=400, detail="task_id and start_date are required")
    
    # Parse dates
    start_date = date.fromisoformat(start_date_str.split('T')[0])
    updated_date = date.fromisoformat(updated_date_str.split('T')[0]) if updated_date_str else None
    
    task = create_one_time_task(db, task_id, start_date, target_gap, updated_date)
    return task


@router.put("/{task_id}")
def update_task(
    task_id: int,
    task_data: dict,
    db: Session = Depends(get_db)
):
    """Update an existing one-time task"""
    start_date_str = task_data.get('start_date')
    target_gap = task_data.get('target_gap')
    updated_date_str = task_data.get('updated_date')
    
    # Parse dates if provided
    start_date = date.fromisoformat(start_date_str.split('T')[0]) if start_date_str else None
    updated_date = date.fromisoformat(updated_date_str.split('T')[0]) if updated_date_str else None
    
    task = update_one_time_task(db, task_id, start_date, target_gap, updated_date)
    if not task:
        raise HTTPException(status_code=404, detail="One-time task not found")
    return task


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete a one-time task entry"""
    success = delete_one_time_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="One-time task not found")
    return {"success": True}
