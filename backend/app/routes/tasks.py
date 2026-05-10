"""
Task Routes - API endpoints for task management
Comprehensive CRUD operations with filtering and statistics
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
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
        
        # Capture old allocated_minutes before update to detect changes
        old_task = TaskService.get_task(db, task_id)
        old_allocated = old_task.allocated_minutes if old_task else None
        old_task_type = old_task.task_type if old_task else None
        old_freq = old_task.follow_up_frequency if old_task else None

        updated_task = TaskService.update_task(db, task_id, task)
        
        print(f"After update - due_date in DB: {updated_task.due_date}")
        print(f"=== END DEBUG ===")

        # Recalculate daily summaries if anything affecting daily TIME allocation changed
        allocation_changed = (
            updated_task.follow_up_frequency == 'daily' and
            (updated_task.task_type or '').upper() == 'TIME' and
            (
                (task.allocated_minutes is not None and task.allocated_minutes != old_allocated) or
                (task.task_type is not None and (task.task_type or '').upper() != (old_task_type or '').upper()) or
                (task.follow_up_frequency is not None and task.follow_up_frequency != old_freq)
            )
        ) or (
            # Also recalc if the task WAS a daily TIME task before and changed to something else
            old_freq == 'daily' and (old_task_type or '').upper() == 'TIME' and
            (
                (task.follow_up_frequency is not None and task.follow_up_frequency != 'daily') or
                (task.task_type is not None and (task.task_type or '').upper() != 'TIME')
            )
        )
        if allocation_changed:
            from app.services.daily_time_service import update_daily_summary
            from datetime import timedelta
            active_start = date(2025, 11, 1)
            today = date.today()
            recalc_start = max(active_start, today - timedelta(days=60))
            current = recalc_start
            while current <= today:
                try:
                    update_daily_summary(db, current)
                except Exception:
                    pass
                current += timedelta(days=1)

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


@router.get("/{task_id}/references")
def get_task_references(task_id: int, db: Session = Depends(get_db)):
    """
    Get all places where this task is referenced:
    habits, challenges linked to it, and which other tabs are monitoring it.
    Used to warn the user before completing/deleting/NA-ing a daily task.
    """
    from app.models.models import Habit, Challenge, WeeklyTaskStatus, MonthlyTaskStatus, YearlyTaskStatus

    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task with id {task_id} not found")

    # Habits linked to this task
    linked_habits = db.query(Habit).filter(
        Habit.linked_task_id == task_id,
        Habit.is_active == True
    ).all()

    # Challenges linked to this task
    linked_challenges = db.query(Challenge).filter(
        Challenge.linked_task_id == task_id,
        Challenge.is_active == True
    ).all()

    # Tabs monitoring this task
    monitoring_tabs = []
    if db.query(WeeklyTaskStatus).filter(WeeklyTaskStatus.task_id == task_id).first():
        monitoring_tabs.append("Weekly")
    if db.query(MonthlyTaskStatus).filter(MonthlyTaskStatus.task_id == task_id).first():
        monitoring_tabs.append("Monthly")
    if db.query(YearlyTaskStatus).filter(YearlyTaskStatus.task_id == task_id).first():
        monitoring_tabs.append("Yearly")

    return {
        "task_id": task_id,
        "task_name": task.name,
        "habits": [
            {
                "id": h.id,
                "name": h.name,
                "habit_type": h.habit_type,
                "target_frequency": h.target_frequency,
                "pillar_name": h.pillar.name if h.pillar else None,
                "category_name": h.category.name if h.category else None,
            }
            for h in linked_habits
        ],
        "challenges": [
            {
                "id": c.id,
                "name": c.name,
                "status": c.status,
                "pillar_name": c.pillar.name if c.pillar else None,
            }
            for c in linked_challenges
        ],
        "monitoring_tabs": monitoring_tabs,
        "has_references": bool(linked_habits or linked_challenges or monitoring_tabs),
    }


@router.post("/{task_id}/complete", response_model=TaskResponse)
def mark_task_completed(task_id: int, db: Session = Depends(get_db)):
    """
    Mark a task as completed
    Sets is_completed to True and records completion timestamp
    """
    try:
        completed_task = TaskService.mark_task_completed(db, task_id)

        # Recalculate daily summaries for past 60 days when a daily TIME task is completed.
        # Completing a task removes it from total_allocated; summaries must be refreshed so
        # that total_spent is also recalculated without the completed task's entries,
        # keeping the two figures consistent and preventing false "Incomplete Day" alerts.
        if (
            completed_task.follow_up_frequency == 'daily' and
            (completed_task.task_type or '').upper() == 'TIME' and
            not (completed_task.is_daily_one_time)
        ):
            from app.services.daily_time_service import update_daily_summary
            from datetime import timedelta
            active_start = date(2025, 11, 1)
            today = date.today()
            recalc_start = max(active_start, today - timedelta(days=60))
            current = recalc_start
            while current <= today:
                try:
                    update_daily_summary(db, current)
                except Exception:
                    pass
                current += timedelta(days=1)

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
    Soft delete a task (marks as inactive, preserves historical data)
    Historical time entries remain intact with snapshot data
    Use POST /tasks/{task_id}/restore to restore a deleted task
    """
    from app.services.task_deletion_service import TaskDeletionService
    from app.services.daily_time_service import update_daily_summary
    from datetime import timedelta

    task = TaskDeletionService.soft_delete_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task with id {task_id} not found")

    # Recalculate recent daily summaries so is_complete flags stay accurate
    # after the task list changes (covers up to 60 past days).
    active_start = date(2025, 11, 1)
    today = date.today()
    recalc_start = max(active_start, today - timedelta(days=60))
    current = recalc_start
    while current <= today:
        try:
            update_daily_summary(db, current)
        except Exception:
            pass
        current += timedelta(days=1)

    return None


@router.get("/{task_id}/monitoring-tabs")
def get_task_monitoring_tabs(task_id: int, db: Session = Depends(get_db)):
    """
    Check which tabs (weekly, monthly, yearly) are monitoring this task.
    Returns a list of tab names that have status entries for this task.
    Used to warn users before deleting a monitored task.
    """
    from app.models.models import WeeklyTaskStatus, MonthlyTaskStatus, YearlyTaskStatus

    monitoring_tabs = []

    if db.query(WeeklyTaskStatus).filter(WeeklyTaskStatus.task_id == task_id).first():
        monitoring_tabs.append("Weekly")

    if db.query(MonthlyTaskStatus).filter(MonthlyTaskStatus.task_id == task_id).first():
        monitoring_tabs.append("Monthly")

    if db.query(YearlyTaskStatus).filter(YearlyTaskStatus.task_id == task_id).first():
        monitoring_tabs.append("Yearly")

    return {"task_id": task_id, "monitoring_tabs": monitoring_tabs}


@router.post("/{task_id}/restore", status_code=200)
def restore_task(task_id: int, db: Session = Depends(get_db)):
    """
    Restore a soft-deleted task (reactivates task)
    Only works for tasks marked with deleted_at timestamp
    """
    from app.services.task_deletion_service import TaskDeletionService
    
    task = TaskDeletionService.restore_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task with id {task_id} not found or not deleted")
    
    return {"message": "Task restored successfully", "task_id": task_id}


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
