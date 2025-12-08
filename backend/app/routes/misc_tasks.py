"""
API routes for Misc Tasks (One-time tasks with hierarchy)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, field_validator

from app.database.config import get_db
from app.services import misc_task_service


router = APIRouter(prefix="/api/misc-tasks", tags=["misc_tasks"])


# ============ Request/Response Models ============

class MiscTaskGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    goal_id: Optional[int] = None  # Link to Life Goal
    due_date: Optional[datetime] = None
    
    @field_validator('due_date', mode='before')
    @classmethod
    def parse_due_date(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            # If date-only string (YYYY-MM-DD), append time
            if len(v) == 10 and 'T' not in v:
                return datetime.fromisoformat(f"{v}T00:00:00")
            return datetime.fromisoformat(v.replace('Z', '+00:00'))
        return v


class MiscTaskGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    due_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    is_completed: Optional[bool] = None
    
    @field_validator('due_date', mode='before')
    @classmethod
    def parse_due_date(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            if len(v) == 10 and 'T' not in v:
                return datetime.fromisoformat(f"{v}T00:00:00")
            return datetime.fromisoformat(v.replace('Z', '+00:00'))
        return v


class MiscTaskItemCreate(BaseModel):
    name: str
    parent_task_id: Optional[int] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str = "medium"
    order: int = 0
    
    @field_validator('due_date', mode='before')
    @classmethod
    def parse_due_date(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            if len(v) == 10 and 'T' not in v:
                return datetime.fromisoformat(f"{v}T00:00:00")
            return datetime.fromisoformat(v.replace('Z', '+00:00'))
        return v


class MiscTaskItemUpdate(BaseModel):
    name: Optional[str] = None
    parent_task_id: Optional[int] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = None
    is_completed: Optional[bool] = None
    order: Optional[int] = None
    
    @field_validator('due_date', mode='before')
    @classmethod
    def parse_due_date(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            if len(v) == 10 and 'T' not in v:
                return datetime.fromisoformat(f"{v}T00:00:00")
            return datetime.fromisoformat(v.replace('Z', '+00:00'))
        return v


# ============ Misc Task Group Routes ============

@router.get("/")
async def get_misc_task_groups(db: Session = Depends(get_db)):
    """Get all misc task groups"""
    return misc_task_service.get_all_misc_task_groups(db)


@router.post("/")
async def create_misc_task_group(
    group: MiscTaskGroupCreate,
    db: Session = Depends(get_db)
):
    """Create a new misc task group"""
    return misc_task_service.create_misc_task_group(db, group.dict())


@router.put("/{group_id}")
async def update_misc_task_group(
    group_id: int,
    group: MiscTaskGroupUpdate,
    db: Session = Depends(get_db)
):
    """Update a misc task group"""
    update_data = {k: v for k, v in group.dict().items() if v is not None}
    return misc_task_service.update_misc_task_group(db, group_id, update_data)


@router.delete("/{group_id}")
async def delete_misc_task_group(
    group_id: int,
    db: Session = Depends(get_db)
):
    """Delete a misc task group and all its tasks"""
    misc_task_service.delete_misc_task_group(db, group_id)
    return {"message": "Misc task group deleted successfully"}


# ============ Misc Task Item Routes ============

@router.get("/{group_id}/tasks")
async def get_misc_task_items(
    group_id: int,
    db: Session = Depends(get_db)
):
    """Get all tasks for a specific misc task group"""
    return misc_task_service.get_misc_task_items(db, group_id)


@router.post("/{group_id}/tasks")
async def create_misc_task_item(
    group_id: int,
    task: MiscTaskItemCreate,
    db: Session = Depends(get_db)
):
    """Create a new task item under a misc task group"""
    return misc_task_service.create_misc_task_item(db, group_id, task.dict())


@router.put("/tasks/{task_id}")
async def update_misc_task_item(
    task_id: int,
    task: MiscTaskItemUpdate,
    db: Session = Depends(get_db)
):
    """Update a misc task item"""
    update_data = {k: v for k, v in task.dict().items() if v is not None}
    return misc_task_service.update_misc_task_item(db, task_id, update_data)


@router.delete("/tasks/{task_id}")
async def delete_misc_task_item(
    task_id: int,
    db: Session = Depends(get_db)
):
    """Delete a misc task item"""
    misc_task_service.delete_misc_task_item(db, task_id)
    return {"message": "Misc task item deleted successfully"}


# ============ Additional Endpoints ============

@router.get("/tasks/due-today")
async def get_misc_tasks_due_today(db: Session = Depends(get_db)):
    """Get misc tasks due today"""
    return misc_task_service.get_misc_tasks_due_today(db)


@router.get("/tasks/overdue")
async def get_overdue_misc_tasks(db: Session = Depends(get_db)):
    """Get overdue misc tasks"""
    return misc_task_service.get_overdue_misc_tasks(db)
