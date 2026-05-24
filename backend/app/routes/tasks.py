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

# ---------------------------------------------------------------------------
# Allocation History Helpers
# ---------------------------------------------------------------------------

def _manage_task_allocation_history(db: Session, task_id: int, new_allocated: int, old_allocated: int = None):
    """
    Create / update TaskAllocationHistory when a daily TIME task's allocated_minutes changes.

    - old_allocated=None  → new task; create an open-ended entry from today.
    - old_allocated!=None → allocation changed; close the current open entry
      (preserving the old value for past dates) and open a new one from today.
      If no history exists yet (pre-fix deployment), a catch-up entry is created
      from the app's active start date to yesterday using the OLD value so that
      past summaries recalculate correctly.
    """
    from app.models.models import TaskAllocationHistory
    from datetime import timedelta
    today = date.today()
    yesterday = today - timedelta(days=1)
    active_start = date(2025, 11, 1)

    open_entries = db.query(TaskAllocationHistory).filter(
        TaskAllocationHistory.task_id == task_id,
        TaskAllocationHistory.effective_to == None
    ).all()

    if open_entries:
        # Close existing open entries
        for entry in open_entries:
            # Guard: effective_to must not be before effective_from
            entry.effective_to = max(entry.effective_from, yesterday)
    elif old_allocated is not None:
        # No history exists yet – create a catch-up entry with the OLD value
        # so recalculating past summaries returns historically accurate figures.
        catch_up = TaskAllocationHistory(
            task_id=task_id,
            allocated_minutes=old_allocated,
            effective_from=active_start,
            effective_to=yesterday,
        )
        db.add(catch_up)

    # Create new open-ended entry from today
    db.add(TaskAllocationHistory(
        task_id=task_id,
        allocated_minutes=new_allocated,
        effective_from=today,
        effective_to=None,
    ))


def _close_task_allocation_history(db: Session, task_id: int):
    """Close open allocation history entries when a task is completed or deleted."""
    from app.models.models import TaskAllocationHistory
    from datetime import timedelta
    yesterday = date.today() - timedelta(days=1)

    open_entries = db.query(TaskAllocationHistory).filter(
        TaskAllocationHistory.task_id == task_id,
        TaskAllocationHistory.effective_to == None
    ).all()
    for entry in open_entries:
        entry.effective_to = max(entry.effective_from, yesterday)


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

        # Create initial allocation history for new daily TIME tasks
        if (
            db_task.follow_up_frequency == 'daily' and
            (db_task.task_type or '').upper() == 'TIME' and
            not db_task.is_daily_one_time
        ):
            _manage_task_allocation_history(db, db_task.id, db_task.allocated_minutes, old_allocated=None)
            db.commit()

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
            still_daily_time = (
                updated_task.follow_up_frequency == 'daily' and
                (updated_task.task_type or '').upper() == 'TIME' and
                not updated_task.is_daily_one_time
            )

            if still_daily_time and (task.allocated_minutes is not None and task.allocated_minutes != old_allocated):
                # Only allocated_minutes changed – manage history so past summaries
                # keep their historically accurate allocated figure.
                _manage_task_allocation_history(db, task_id, updated_task.allocated_minutes, old_allocated=old_allocated)
            else:
                # Task left the daily TIME category (or type/freq changed) – close history.
                _close_task_allocation_history(db, task_id)

            db.commit()

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
            # Close allocation history so past summaries (via history) correctly
            # exclude this task's allocated_minutes from tomorrow onwards.
            _close_task_allocation_history(db, completed_task.id)
            db.commit()

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

    # Close allocation history so past summaries keep the task's historical
    # allocation while today onwards correctly reflects its removal.
    if (
        task.follow_up_frequency == 'daily' and
        (task.task_type or '').upper() == 'TIME' and
        not task.is_daily_one_time
    ):
        _close_task_allocation_history(db, task.id)
        db.commit()

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


# ---------------------------------------------------------------------------
# Allocation History Repair Endpoints
# ---------------------------------------------------------------------------

from pydantic import BaseModel as _BaseModel

class AllocationHistoryEntry(_BaseModel):
    allocated_minutes: int
    effective_from: date
    effective_to: Optional[date] = None


@router.get("/{task_id}/allocation-history")
def get_allocation_history(task_id: int, db: Session = Depends(get_db)):
    """
    Get the allocation history for a task.
    Shows the allocated_minutes that were in effect on each date range.
    """
    from app.models.models import TaskAllocationHistory
    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    records = db.query(TaskAllocationHistory).filter(
        TaskAllocationHistory.task_id == task_id
    ).order_by(TaskAllocationHistory.effective_from).all()

    return {
        "task_id": task_id,
        "task_name": task.name,
        "history": [
            {
                "id": r.id,
                "allocated_minutes": r.allocated_minutes,
                "effective_from": str(r.effective_from),
                "effective_to": str(r.effective_to) if r.effective_to else None,
            }
            for r in records
        ]
    }


@router.put("/{task_id}/allocation-history")
def set_allocation_history(
    task_id: int,
    entries: List[AllocationHistoryEntry],
    db: Session = Depends(get_db)
):
    """
    Replace the full allocation history for a task and recalculate past summaries.

    Use this to fix historical allocations that were corrupted by a retroactive
    change.  Supply the complete history from the oldest entry to the current one.
    Example body:
      [
        {"allocated_minutes": 390, "effective_from": "2025-11-01", "effective_to": "2026-05-23"},
        {"allocated_minutes": 360, "effective_from": "2026-05-24", "effective_to": null}
      ]
    """
    from app.models.models import TaskAllocationHistory
    from app.services.daily_time_service import update_daily_summary
    from datetime import timedelta

    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    # Delete existing history for this task
    db.query(TaskAllocationHistory).filter(TaskAllocationHistory.task_id == task_id).delete()

    # Insert new history
    for entry in entries:
        db.add(TaskAllocationHistory(
            task_id=task_id,
            allocated_minutes=entry.allocated_minutes,
            effective_from=entry.effective_from,
            effective_to=entry.effective_to,
        ))
    db.commit()

    # Recalculate all past summaries (they will now use the corrected history)
    active_start = date(2025, 11, 1)
    today = date.today()
    recalc_start = max(active_start, today - timedelta(days=180))  # up to 6 months
    current = recalc_start
    count = 0
    while current <= today:
        try:
            update_daily_summary(db, current)
            count += 1
        except Exception:
            pass
        current += timedelta(days=1)

    return {
        "message": f"Allocation history updated and {count} daily summaries recalculated.",
        "task_id": task_id,
        "entries_set": len(entries),
    }


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
