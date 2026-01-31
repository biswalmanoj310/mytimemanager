"""
Dashboard Routes - API endpoints for goal and task dashboards
Comprehensive dashboard views with statistics and progress tracking
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from app.database.config import get_db
from app.models.models import Goal, Task, Pillar, Category, SubCategory, GoalTimePeriod, FollowUpFrequency
from app.models.goal import LifeGoal, GoalProject
from app.models.schemas import GoalResponse, TaskResponse

router = APIRouter()


@router.get("/goals/overview")
def get_goals_dashboard_overview(db: Session = Depends(get_db)):
    """
    Get comprehensive goals dashboard overview
    
    Returns:
    - Total goals count (includes LifeGoals, GoalProjects, and legacy Goals)
    - Goals by status (active, completed, pending)
    - Goals by time period (week, month, quarter, year)
    - Overall progress statistics
    - Top performing goals
    - Goals needing attention
    """
    # Get all goal types
    all_legacy_goals = db.query(Goal).all()
    all_life_goals = db.query(LifeGoal).all()
    all_goal_projects = db.query(GoalProject).all()
    
    # Calculate overall statistics (counting all goal types)
    total_goals = len(all_legacy_goals) + len(all_life_goals) + len(all_goal_projects)
    
    # For legacy goals statistics (these still use the old Goal model)
    active_goals = sum(1 for g in all_legacy_goals if g.is_active)
    completed_goals = sum(1 for g in all_legacy_goals if g.is_completed)
    
    # Add life goals to active/completed counts (LifeGoal uses is_achieved/is_archived, not status)
    active_goals += sum(1 for g in all_life_goals if not g.status in ['completed', 'abandoned'])
    completed_goals += sum(1 for g in all_life_goals if g.status == 'completed')
    
    # Goal projects are always active (they don't have a status/completion field)
    active_goals += len(all_goal_projects)
    
    pending_goals = total_goals - completed_goals
    
    # Calculate total hours (only legacy goals have this data)
    total_allocated_hours = sum(g.allocated_hours for g in all_legacy_goals)
    total_spent_hours = sum(g.spent_hours for g in all_legacy_goals)
    overall_progress = (total_spent_hours / total_allocated_hours * 100) if total_allocated_hours > 0 else 0
    
    # Group by time period (only legacy goals have this)
    by_time_period = {}
    for period in GoalTimePeriod:
        period_goals = [g for g in all_legacy_goals if g.goal_time_period == period]
        if period_goals:
            by_time_period[period.value] = {
                "count": len(period_goals),
                "active": sum(1 for g in period_goals if g.is_active),
                "completed": sum(1 for g in period_goals if g.is_completed),
                "allocated_hours": sum(g.allocated_hours for g in period_goals),
                "spent_hours": sum(g.spent_hours for g in period_goals),
                "progress": (sum(g.spent_hours for g in period_goals) / sum(g.allocated_hours for g in period_goals) * 100) if sum(g.allocated_hours for g in period_goals) > 0 else 0
            }
    
    # Group by pillar (only legacy goals have pillar_id)
    by_pillar = {}
    pillars = db.query(Pillar).all()
    for pillar in pillars:
        pillar_goals = [g for g in all_legacy_goals if g.pillar_id == pillar.id]
        if pillar_goals:
            by_pillar[pillar.name] = {
                "pillar_id": pillar.id,
                "count": len(pillar_goals),
                "active": sum(1 for g in pillar_goals if g.is_active),
                "completed": sum(1 for g in pillar_goals if g.is_completed),
                "allocated_hours": sum(g.allocated_hours for g in pillar_goals),
                "spent_hours": sum(g.spent_hours for g in pillar_goals),
                "progress": (sum(g.spent_hours for g in pillar_goals) / sum(g.allocated_hours for g in pillar_goals) * 100) if sum(g.allocated_hours for g in pillar_goals) > 0 else 0
            }
    
    # Top performing goals (highest progress percentage) - only legacy goals tracked in dashboard
    goals_with_progress = []
    for goal in all_legacy_goals:
        if goal.is_active and not goal.is_completed:
            progress = (goal.spent_hours / goal.allocated_hours * 100) if goal.allocated_hours > 0 else 0
            goals_with_progress.append({
                "id": goal.id,
                "name": goal.name,
                "progress": progress,
                "allocated_hours": goal.allocated_hours,
                "spent_hours": goal.spent_hours,
                "time_period": goal.goal_time_period
            })
    
    top_performing = sorted(goals_with_progress, key=lambda x: x["progress"], reverse=True)[:5]
    
    # Goals needing attention (lowest progress, active but not started much)
    needs_attention = [g for g in goals_with_progress if g["progress"] < 25][:5]
    
    # Recently completed goals (only legacy goals tracked in dashboard)
    recently_completed = sorted(
        [g for g in all_legacy_goals if g.is_completed and g.completed_at],
        key=lambda x: x.completed_at,
        reverse=True
    )[:5]
    
    recently_completed_data = [{
        "id": g.id,
        "name": g.name,
        "allocated_hours": g.allocated_hours,
        "spent_hours": g.spent_hours,
        "completed_at": g.completed_at,
        "time_period": g.goal_time_period
    } for g in recently_completed]
    
    return {
        "summary": {
            "total_goals": total_goals,
            "active_goals": active_goals,
            "completed_goals": completed_goals,
            "pending_goals": pending_goals,
            "total_allocated_hours": round(total_allocated_hours, 2),
            "total_spent_hours": round(total_spent_hours, 2),
            "overall_progress": round(overall_progress, 2),
            "completion_rate": round((completed_goals / total_goals * 100) if total_goals > 0 else 0, 2)
        },
        "by_time_period": by_time_period,
        "by_pillar": by_pillar,
        "top_performing": top_performing,
        "needs_attention": needs_attention,
        "recently_completed": recently_completed_data
    }


@router.get("/goals/filtered")
def get_filtered_goals_dashboard(
    pillar_id: Optional[int] = Query(None, description="Filter by pillar"),
    time_period: Optional[GoalTimePeriod] = Query(None, description="Filter by time period"),
    status: Optional[str] = Query(None, description="active, completed, or pending"),
    sort_by: Optional[str] = Query("created_at", description="Sort field: created_at, progress, name"),
    sort_order: Optional[str] = Query("desc", description="asc or desc"),
    db: Session = Depends(get_db)
):
    """
    Get filtered goals dashboard with advanced filtering and sorting
    
    Filters:
    - pillar_id: Filter by specific pillar
    - time_period: week, month, quarter, year
    - status: active, completed, pending
    - sort_by: created_at, progress, name, allocated_hours
    - sort_order: asc or desc
    """
    # Build query
    query = db.query(Goal)
    
    # Apply filters
    if pillar_id:
        query = query.filter(Goal.pillar_id == pillar_id)
    
    if time_period:
        query = query.filter(Goal.goal_time_period == time_period)
    
    if status == "active":
        query = query.filter(Goal.is_active == True, Goal.is_completed == False)
    elif status == "completed":
        query = query.filter(Goal.is_completed == True)
    elif status == "pending":
        query = query.filter(Goal.is_completed == False)
    
    # Get results
    goals = query.all()
    
    # Calculate progress for each goal
    goals_data = []
    for goal in goals:
        progress = (goal.spent_hours / goal.allocated_hours * 100) if goal.allocated_hours > 0 else 0
        remaining_hours = max(goal.allocated_hours - goal.spent_hours, 0)
        
        # Get linked tasks count
        tasks_count = db.query(Task).filter(Task.goal_id == goal.id).count()
        completed_tasks = db.query(Task).filter(
            Task.goal_id == goal.id,
            Task.is_completed == True
        ).count()
        
        goals_data.append({
            "id": goal.id,
            "name": goal.name,
            "description": goal.description,
            "pillar_id": goal.pillar_id,
            "pillar_name": goal.pillar.name if goal.pillar else None,
            "category_id": goal.category_id,
            "category_name": goal.category.name if goal.category else None,
            "sub_category_id": goal.sub_category_id,
            "sub_category_name": goal.sub_category.name if goal.sub_category else None,
            "goal_time_period": goal.goal_time_period,
            "allocated_hours": goal.allocated_hours,
            "spent_hours": goal.spent_hours,
            "progress": round(progress, 2),
            "remaining_hours": round(remaining_hours, 2),
            "is_active": goal.is_active,
            "is_completed": goal.is_completed,
            "completed_at": goal.completed_at,
            "created_at": goal.created_at,
            "start_date": goal.start_date,
            "end_date": goal.end_date,
            "why_reason": goal.why_reason,
            "linked_tasks_count": tasks_count,
            "completed_tasks_count": completed_tasks,
            "status_label": "Completed" if goal.is_completed else ("Active" if goal.is_active else "Inactive")
        })
    
    # Sort results
    if sort_by == "progress":
        goals_data.sort(key=lambda x: x["progress"], reverse=(sort_order == "desc"))
    elif sort_by == "name":
        goals_data.sort(key=lambda x: x["name"].lower(), reverse=(sort_order == "desc"))
    elif sort_by == "allocated_hours":
        goals_data.sort(key=lambda x: x["allocated_hours"], reverse=(sort_order == "desc"))
    else:  # created_at
        goals_data.sort(key=lambda x: x["created_at"], reverse=(sort_order == "desc"))
    
    # Calculate summary for filtered results
    summary = {
        "total_count": len(goals_data),
        "active_count": sum(1 for g in goals_data if g["is_active"] and not g["is_completed"]),
        "completed_count": sum(1 for g in goals_data if g["is_completed"]),
        "total_allocated": round(sum(g["allocated_hours"] for g in goals_data), 2),
        "total_spent": round(sum(g["spent_hours"] for g in goals_data), 2),
        "average_progress": round(sum(g["progress"] for g in goals_data) / len(goals_data), 2) if goals_data else 0
    }
    
    return {
        "summary": summary,
        "goals": goals_data
    }


@router.get("/goals/progress-matrix")
def get_goals_progress_matrix(db: Session = Depends(get_db)):
    """
    Get goals progress matrix showing all goals with their progress indicators
    
    Groups goals by pillar and shows:
    - Progress bars
    - Time remaining
    - Linked tasks status
    """
    pillars = db.query(Pillar).all()
    
    matrix = []
    for pillar in pillars:
        pillar_goals = db.query(Goal).filter(Goal.pillar_id == pillar.id).all()
        
        goals_data = []
        for goal in pillar_goals:
            progress = (goal.spent_hours / goal.allocated_hours * 100) if goal.allocated_hours > 0 else 0
            
            # Calculate progress indicator
            if goal.is_completed:
                status_indicator = "completed"
                status_color = "green"
            elif progress >= 75:
                status_indicator = "on_track"
                status_color = "blue"
            elif progress >= 50:
                status_indicator = "in_progress"
                status_color = "yellow"
            elif progress >= 25:
                status_indicator = "behind"
                status_color = "orange"
            else:
                status_indicator = "needs_attention"
                status_color = "red"
            
            # Get tasks status
            total_tasks = db.query(Task).filter(Task.goal_id == goal.id).count()
            completed_tasks = db.query(Task).filter(
                Task.goal_id == goal.id,
                Task.is_completed == True
            ).count()
            
            goals_data.append({
                "id": goal.id,
                "name": goal.name,
                "time_period": goal.goal_time_period,
                "progress": round(progress, 2),
                "status_indicator": status_indicator,
                "status_color": status_color,
                "allocated_hours": goal.allocated_hours,
                "spent_hours": goal.spent_hours,
                "remaining_hours": max(goal.allocated_hours - goal.spent_hours, 0),
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "tasks_progress": round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 2),
                "is_completed": goal.is_completed
            })
        
        if goals_data:
            matrix.append({
                "pillar_id": pillar.id,
                "pillar_name": pillar.name,
                "pillar_icon": pillar.icon,
                "total_goals": len(goals_data),
                "completed_goals": sum(1 for g in goals_data if g["is_completed"]),
                "goals": goals_data
            })
    
    return {
        "matrix": matrix,
        "legend": {
            "completed": {"label": "Completed", "color": "green", "description": "Goal achieved"},
            "on_track": {"label": "On Track", "color": "blue", "description": "75%+ progress"},
            "in_progress": {"label": "In Progress", "color": "yellow", "description": "50-74% progress"},
            "behind": {"label": "Behind Schedule", "color": "orange", "description": "25-49% progress"},
            "needs_attention": {"label": "Needs Attention", "color": "red", "description": "<25% progress"}
        }
    }


@router.get("/goals/timeline")
def get_goals_timeline(
    pillar_id: Optional[int] = Query(None, description="Filter by pillar"),
    db: Session = Depends(get_db)
):
    """
    Get goals timeline view showing start dates, end dates, and current progress
    
    Useful for visualizing goals on a timeline/gantt chart
    """
    query = db.query(Goal)
    
    if pillar_id:
        query = query.filter(Goal.pillar_id == pillar_id)
    
    goals = query.all()
    
    timeline_data = []
    for goal in goals:
        progress = (goal.spent_hours / goal.allocated_hours * 100) if goal.allocated_hours > 0 else 0
        
        timeline_data.append({
            "id": goal.id,
            "name": goal.name,
            "pillar_name": goal.pillar.name if goal.pillar else None,
            "category_name": goal.category.name if goal.category else None,
            "time_period": goal.goal_time_period,
            "start_date": goal.start_date,
            "end_date": goal.end_date,
            "created_at": goal.created_at,
            "progress": round(progress, 2),
            "is_completed": goal.is_completed,
            "completed_at": goal.completed_at,
            "allocated_hours": goal.allocated_hours,
            "spent_hours": goal.spent_hours,
            "days_since_start": (datetime.now() - goal.created_at).days if goal.created_at else 0,
            "has_deadline": goal.end_date is not None
        })
    
    # Sort by start date or created date
    timeline_data.sort(key=lambda x: x["start_date"] or x["created_at"])
    
    return {
        "timeline": timeline_data,
        "total_goals": len(timeline_data)
    }


@router.get("/tasks/overview")
def get_tasks_dashboard_overview(db: Session = Depends(get_db)):
    """
    Get comprehensive tasks dashboard overview
    
    Returns:
    - Total tasks count
    - Tasks by status
    - Tasks by frequency
    - Tasks by pillar
    - Upcoming tasks
    - Overdue tasks
    """
    all_tasks = db.query(Task).all()
    
    # Calculate overall statistics
    total_tasks = len(all_tasks)
    active_tasks = sum(1 for t in all_tasks if t.is_active)
    completed_tasks = sum(1 for t in all_tasks if t.is_completed)
    pending_tasks = sum(1 for t in all_tasks if not t.is_completed)
    
    # Calculate total time
    total_allocated_minutes = sum(t.allocated_minutes for t in all_tasks)
    total_spent_minutes = sum(t.spent_minutes for t in all_tasks)
    overall_progress = (total_spent_minutes / total_allocated_minutes * 100) if total_allocated_minutes > 0 else 0
    
    # Group by frequency
    by_frequency = {}
    for freq in FollowUpFrequency:
        freq_tasks = [t for t in all_tasks if t.follow_up_frequency == freq]
        if freq_tasks:
            by_frequency[freq.value] = {
                "count": len(freq_tasks),
                "active": sum(1 for t in freq_tasks if t.is_active),
                "completed": sum(1 for t in freq_tasks if t.is_completed)
            }
    
    # Group by pillar
    by_pillar = {}
    pillars = db.query(Pillar).all()
    for pillar in pillars:
        pillar_tasks = [t for t in all_tasks if t.pillar_id == pillar.id]
        if pillar_tasks:
            by_pillar[pillar.name] = {
                "pillar_id": pillar.id,
                "count": len(pillar_tasks),
                "active": sum(1 for t in pillar_tasks if t.is_active),
                "completed": sum(1 for t in pillar_tasks if t.is_completed),
                "total_minutes": sum(t.allocated_minutes for t in pillar_tasks)
            }
    
    # Tasks with goals
    tasks_with_goals = sum(1 for t in all_tasks if t.is_part_of_goal)
    
    return {
        "summary": {
            "total_tasks": total_tasks,
            "active_tasks": active_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "total_allocated_hours": round(total_allocated_minutes / 60, 2),
            "total_spent_hours": round(total_spent_minutes / 60, 2),
            "overall_progress": round(overall_progress, 2),
            "completion_rate": round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 2),
            "tasks_with_goals": tasks_with_goals
        },
        "by_frequency": by_frequency,
        "by_pillar": by_pillar
    }
