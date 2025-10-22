"""
Goal Routes - API endpoints for goal management
Time-based goal tracking with progress monitoring
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.config import get_db
from app.models.schemas import (
    GoalCreate,
    GoalUpdate,
    GoalResponse,
    GoalWithStats,
    GoalFilters
)
from app.services.goal_service import GoalService
from app.models.models import GoalTimePeriod

router = APIRouter()


@router.post("/", response_model=GoalResponse, status_code=201)
def create_goal(goal: GoalCreate, db: Session = Depends(get_db)):
    """
    Create a new goal with time-based tracking
    
    Required fields:
    - name: Goal name
    - pillar_id: Must belong to an existing pillar
    - category_id: Must belong to the specified pillar
    - goal_time_period: week/month/quarter/year
    - allocated_hours: Total hours for this goal
    
    Optional fields:
    - sub_category_id: Must belong to the specified category
    - why_reason: Why this goal is important
    - start_date: When to start working on this goal
    - end_date: Target completion date
    """
    try:
        db_goal = GoalService.create_goal(db, goal)
        return db_goal
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/", response_model=List[GoalResponse])
def get_goals(
    pillar_id: Optional[int] = Query(None, description="Filter by pillar ID"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    sub_category_id: Optional[int] = Query(None, description="Filter by sub-category ID"),
    goal_time_period: Optional[GoalTimePeriod] = Query(None, description="Filter by time period"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    is_completed: Optional[bool] = Query(None, description="Filter by completion status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    db: Session = Depends(get_db)
):
    """
    Get all goals with optional filtering
    
    Supports filtering by:
    - pillar_id: Get goals for a specific pillar
    - category_id: Get goals for a specific category
    - sub_category_id: Get goals for a specific sub-category
    - goal_time_period: Filter by week/month/quarter/year
    - is_active: Get active/inactive goals
    - is_completed: Get completed/pending goals
    """
    try:
        filters = GoalFilters(
            pillar_id=pillar_id,
            category_id=category_id,
            sub_category_id=sub_category_id,
            goal_time_period=goal_time_period,
            is_active=is_active,
            is_completed=is_completed
        )
        
        goals = GoalService.get_goals(db, filters=filters, skip=skip, limit=limit)
        return goals
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{goal_id}", response_model=GoalResponse)
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    """
    Get a specific goal by ID
    """
    goal = GoalService.get_goal(db, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail=f"Goal with id {goal_id} not found")
    
    return goal


@router.get("/{goal_id}/stats", response_model=GoalWithStats)
def get_goal_with_stats(goal_id: int, db: Session = Depends(get_db)):
    """
    Get a goal with detailed statistics including:
    - Progress percentage (spent vs allocated hours)
    - Linked tasks count
    - Completed tasks count
    - Remaining hours
    - Full hierarchy (pillar, category, sub-category names)
    """
    goal_stats = GoalService.get_goal_with_stats(db, goal_id)
    if not goal_stats:
        raise HTTPException(status_code=404, detail=f"Goal with id {goal_id} not found")
    
    return goal_stats


@router.put("/{goal_id}", response_model=GoalResponse)
def update_goal(goal_id: int, goal: GoalUpdate, db: Session = Depends(get_db)):
    """
    Update an existing goal
    
    All fields are optional - only provided fields will be updated
    Validates hierarchy (pillar > category > sub-category)
    """
    try:
        updated_goal = GoalService.update_goal(db, goal_id, goal)
        return updated_goal
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{goal_id}/complete", response_model=GoalResponse)
def mark_goal_completed(goal_id: int, db: Session = Depends(get_db)):
    """
    Mark a goal as completed
    Sets is_completed to True and records completion timestamp
    """
    try:
        completed_goal = GoalService.mark_goal_completed(db, goal_id)
        return completed_goal
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{goal_id}/recalculate", response_model=GoalResponse)
def recalculate_goal_progress(goal_id: int, db: Session = Depends(get_db)):
    """
    Recalculate spent hours from all linked tasks
    Updates the goal's spent_hours based on actual task time
    """
    try:
        updated_goal = GoalService.update_goal_spent_hours(db, goal_id)
        return updated_goal
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    """
    Delete a goal
    This will set goal_id to NULL for all associated tasks (not cascade delete)
    """
    success = GoalService.delete_goal(db, goal_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Goal with id {goal_id} not found")
    
    return None


@router.get("/by-period/{time_period}")
def get_goals_by_period(
    time_period: GoalTimePeriod,
    pillar_id: Optional[int] = Query(None, description="Filter by pillar ID"),
    db: Session = Depends(get_db)
):
    """
    Get all goals for a specific time period
    
    Time periods: week, month, quarter, year
    Optionally filter by pillar
    """
    try:
        goals = GoalService.get_goals_by_time_period(db, time_period, pillar_id)
        
        # Calculate summary statistics
        total_goals = len(goals)
        active_goals = sum(1 for g in goals if g.is_active)
        completed_goals = sum(1 for g in goals if g.is_completed)
        total_allocated = sum(g.allocated_hours for g in goals)
        total_spent = sum(g.spent_hours for g in goals)
        
        return {
            "time_period": time_period,
            "pillar_id": pillar_id,
            "total_goals": total_goals,
            "active_goals": active_goals,
            "completed_goals": completed_goals,
            "pending_goals": total_goals - completed_goals,
            "total_allocated_hours": total_allocated,
            "total_spent_hours": total_spent,
            "progress_percentage": (total_spent / total_allocated * 100) if total_allocated > 0 else 0,
            "goals": [GoalResponse.model_validate(g) for g in goals]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/by-pillar/{pillar_id}/summary")
def get_goals_summary_by_pillar(pillar_id: int, db: Session = Depends(get_db)):
    """
    Get summary statistics for all goals in a pillar
    Returns counts by status and time period
    """
    filters = GoalFilters(pillar_id=pillar_id)
    goals = GoalService.get_goals(db, filters=filters, limit=10000)
    
    summary = {
        "pillar_id": pillar_id,
        "total_goals": len(goals),
        "active_goals": sum(1 for g in goals if g.is_active),
        "completed_goals": sum(1 for g in goals if g.is_completed),
        "pending_goals": sum(1 for g in goals if not g.is_completed),
        "total_allocated_hours": sum(g.allocated_hours for g in goals),
        "total_spent_hours": sum(g.spent_hours for g in goals),
        "by_time_period": {}
    }
    
    # Count by time period
    for period in GoalTimePeriod:
        count = sum(1 for g in goals if g.goal_time_period == period)
        if count > 0:
            summary["by_time_period"][period.value] = count
    
    return summary


@router.get("/by-category/{category_id}/summary")
def get_goals_summary_by_category(category_id: int, db: Session = Depends(get_db)):
    """
    Get summary statistics for all goals in a category
    Returns counts by status and time period
    """
    filters = GoalFilters(category_id=category_id)
    goals = GoalService.get_goals(db, filters=filters, limit=10000)
    
    summary = {
        "category_id": category_id,
        "total_goals": len(goals),
        "active_goals": sum(1 for g in goals if g.is_active),
        "completed_goals": sum(1 for g in goals if g.is_completed),
        "pending_goals": sum(1 for g in goals if not g.is_completed),
        "total_allocated_hours": sum(g.allocated_hours for g in goals),
        "total_spent_hours": sum(g.spent_hours for g in goals),
        "by_time_period": {}
    }
    
    # Count by time period
    for period in GoalTimePeriod:
        count = sum(1 for g in goals if g.goal_time_period == period)
        if count > 0:
            summary["by_time_period"][period.value] = count
    
    return summary
