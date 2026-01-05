"""
Task Routes - API endpoints for task management
Comprehensive CRUD operations with filtering and statistics
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from app.database.config import get_db
from app.models.schemas import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskWithStats,
    TaskFilters
)
from app.services.task_service import TaskService
from app.models.models import FollowUpFrequency

router = APIRouter()


@router.post("/", response_model=TaskResponse, status_code=201)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """
    Create a new task with comprehensive validation
    
    Required fields:
    - name: Task name
    - pillar_id: Must belong to an existing pillar
    - category_id: Must belong to the specified pillar
    - allocated_minutes: Time in minutes
    - follow_up_frequency: today/weekly/monthly/quarterly/yearly/one_time
    
    Optional fields:
    - sub_category_id: Must belong to the specified category
    - goal_id: Must belong to the same pillar and category
    - why_reason: Why this task is important
    - additional_whys: Array of additional reasons
    - separately_followed: No time bound (boolean)
    - due_date: When the task is due
    """
    try:
        db_task = TaskService.create_task(db, task)
        
        # Note: If task is one_time (Important Task), it should be created 
        # through the /api/important-tasks/ endpoint instead
        # The old one_time_tasks table has been replaced with important_tasks
        
        # Parse additional_whys from JSON string for response
        task_dict = TaskResponse.model_validate(db_task).model_dump()
        if db_task.additional_whys:
            try:
                task_dict['additional_whys'] = json.loads(db_task.additional_whys)
            except json.JSONDecodeError:
                task_dict['additional_whys'] = []
        
        return task_dict
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/", response_model=List[TaskResponse])
def get_tasks(
    pillar_id: Optional[int] = Query(None, description="Filter by pillar ID"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    sub_category_id: Optional[int] = Query(None, description="Filter by sub-category ID"),
    goal_id: Optional[int] = Query(None, description="Filter by goal ID"),
    follow_up_frequency: Optional[FollowUpFrequency] = Query(None, description="Filter by frequency"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    is_completed: Optional[bool] = Query(None, description="Filter by completion status"),
    is_part_of_goal: Optional[bool] = Query(None, description="Filter by goal linkage"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100000, ge=1, le=1000000, description="Maximum records to return"),
    db: Session = Depends(get_db)
):
    """
    Get all tasks with optional filtering
    
    Supports filtering by:
    - pillar_id: Get tasks for a specific pillar
    - category_id: Get tasks for a specific category
    - sub_category_id: Get tasks for a specific sub-category
    - goal_id: Get tasks linked to a specific goal
    - follow_up_frequency: Get tasks by frequency
    - is_active: Get active/inactive tasks
    - is_completed: Get completed/pending tasks
    - is_part_of_goal: Get tasks that are part of goals
    """
    try:
        filters = TaskFilters(
            pillar_id=pillar_id,
            category_id=category_id,
            sub_category_id=sub_category_id,
            goal_id=goal_id,
            follow_up_frequency=follow_up_frequency,
            is_active=is_active,
            is_completed=is_completed,
            is_part_of_goal=is_part_of_goal
        )
        
        tasks = TaskService.get_tasks(db, filters=filters, skip=skip, limit=limit)
        
        # Parse additional_whys and add related names for all tasks
        result = []
        for task in tasks:
            task_dict = TaskResponse.model_validate(task).model_dump()
            if task.additional_whys:
                try:
                    task_dict['additional_whys'] = json.loads(task.additional_whys)
                except json.JSONDecodeError:
                    task_dict['additional_whys'] = []
            
            # Add pillar, category, and subcategory names
            if task.pillar:
                task_dict['pillar_name'] = task.pillar.name
            if task.category:
                task_dict['category_name'] = task.category.name
            if task.sub_category:
                task_dict['sub_category_name'] = task.sub_category.name
            
            result.append(task_dict)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """
    Get a specific task by ID
    """
    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task with id {task_id} not found")
    
    # Parse additional_whys from JSON string
    task_dict = TaskResponse.model_validate(task).model_dump()
    if task.additional_whys:
        try:
            task_dict['additional_whys'] = json.loads(task.additional_whys)
        except json.JSONDecodeError:
            task_dict['additional_whys'] = []
    
    return task_dict


@router.get("/{task_id}/stats", response_model=TaskWithStats)
def get_task_with_stats(task_id: int, db: Session = Depends(get_db)):
    """
    Get a task with detailed statistics including:
    - Completion percentage
    - Time entries count
    - Full hierarchy (pillar, category, sub-category names)
    - Goal information
    """
    task_stats = TaskService.get_task_with_stats(db, task_id)
    if not task_stats:
        raise HTTPException(status_code=404, detail=f"Task with id {task_id} not found")
    
    return task_stats


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task: TaskUpdate, db: Session = Depends(get_db)):
    """
    Update an existing task
    
    All fields are optional - only provided fields will be updated
    Validates hierarchy (pillar > category > sub-category > goal)
    """
    try:
        print(f"\n=== UPDATE TASK DEBUG ===")
        print(f"Task ID: {task_id}")
        print(f"Request data: {task.model_dump(exclude_unset=True)}")
        if task.due_date:
            print(f"Due date received: {task.due_date} (type: {type(task.due_date)})")
        
        updated_task = TaskService.update_task(db, task_id, task)
        
        print(f"After update - due_date in DB: {updated_task.due_date}")
        print(f"=== END DEBUG ===\n")
        
        # Parse additional_whys from JSON string
        task_dict = TaskResponse.model_validate(updated_task).model_dump()
        if updated_task.additional_whys:
            try:
                task_dict['additional_whys'] = json.loads(updated_task.additional_whys)
            except json.JSONDecodeError:
                task_dict['additional_whys'] = []
        
        return task_dict
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{task_id}/complete", response_model=TaskResponse)
def mark_task_completed(task_id: int, db: Session = Depends(get_db)):
    """
    Mark a task as completed
    Sets is_completed to True and records completion timestamp
    """
    try:
        completed_task = TaskService.mark_task_completed(db, task_id)
        
        # Parse additional_whys from JSON string
        task_dict = TaskResponse.model_validate(completed_task).model_dump()
        if completed_task.additional_whys:
            try:
                task_dict['additional_whys'] = json.loads(completed_task.additional_whys)
            except json.JSONDecodeError:
                task_dict['additional_whys'] = []
        
        return task_dict
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """
    Delete a task
    This will also delete all associated time entries (cascade)
    """
    success = TaskService.delete_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Task with id {task_id} not found")
    
    return None


@router.get("/by-pillar/{pillar_id}/summary")
def get_tasks_summary_by_pillar(pillar_id: int, db: Session = Depends(get_db)):
    """
    Get summary statistics for all tasks in a pillar
    Returns counts by status, frequency, and completion
    """
    filters = TaskFilters(pillar_id=pillar_id)
    tasks = TaskService.get_tasks(db, filters=filters, limit=10000)
    
    summary = {
        "pillar_id": pillar_id,
        "total_tasks": len(tasks),
        "active_tasks": sum(1 for t in tasks if t.is_active),
        "completed_tasks": sum(1 for t in tasks if t.is_completed),
        "pending_tasks": sum(1 for t in tasks if not t.is_completed),
        "total_allocated_minutes": sum(t.allocated_minutes for t in tasks),
        "total_spent_minutes": sum(t.spent_minutes for t in tasks),
        "by_frequency": {},
        "tasks_with_goals": sum(1 for t in tasks if t.is_part_of_goal)
    }
    
    # Count by frequency
    for freq in FollowUpFrequency:
        count = sum(1 for t in tasks if t.follow_up_frequency == freq)
        if count > 0:
            summary["by_frequency"][freq.value] = count
    
    return summary


@router.get("/by-category/{category_id}/summary")
def get_tasks_summary_by_category(category_id: int, db: Session = Depends(get_db)):
    """
    Get summary statistics for all tasks in a category
    Returns counts by status, frequency, and completion
    """
    filters = TaskFilters(category_id=category_id)
    tasks = TaskService.get_tasks(db, filters=filters, limit=10000)
    
    summary = {
        "category_id": category_id,
        "total_tasks": len(tasks),
        "active_tasks": sum(1 for t in tasks if t.is_active),
        "completed_tasks": sum(1 for t in tasks if t.is_completed),
        "pending_tasks": sum(1 for t in tasks if not t.is_completed),
        "total_allocated_minutes": sum(t.allocated_minutes for t in tasks),
        "total_spent_minutes": sum(t.spent_minutes for t in tasks),
        "by_frequency": {},
        "tasks_with_goals": sum(1 for t in tasks if t.is_part_of_goal)
    }
    
    # Count by frequency
    for freq in FollowUpFrequency:
        count = sum(1 for t in tasks if t.follow_up_frequency == freq)
        if count > 0:
            summary["by_frequency"][freq.value] = count
    
    return summary
