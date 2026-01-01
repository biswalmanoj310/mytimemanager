"""
API routes for Life Goals management
Provides REST endpoints for goals, milestones, and task linking
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date

from app.database.config import get_db
from app.services import life_goal_service

router = APIRouter(prefix="/api/life-goals", tags=["life-goals"])


# Pydantic models for request/response
class LifeGoalCreate(BaseModel):
    name: str
    start_date: date
    target_date: date
    why_statements: List[str] = []
    parent_goal_id: Optional[int] = None
    category: Optional[str] = None
    priority: str = "medium"
    description: Optional[str] = None
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    linked_task_id: Optional[int] = None
    related_wish_id: Optional[int] = None


class LifeGoalUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    why_statements: Optional[List[str]] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    linked_task_id: Optional[int] = None
    related_wish_id: Optional[int] = None


class MilestoneCreate(BaseModel):
    name: str
    start_date: Optional[date] = None
    target_date: date
    description: Optional[str] = None
    metric: Optional[str] = None
    order: int = 0


class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    description: Optional[str] = None
    metric: Optional[str] = None
    is_completed: Optional[bool] = None
    order: Optional[int] = None


class TaskLinkCreate(BaseModel):
    task_id: int
    task_type: str
    time_allocated_hours: float = 0.0
    notes: Optional[str] = None
    link_start_date: Optional[date] = None  # When tracking starts for this link
    expected_frequency: Optional[str] = None  # daily, weekly, monthly


class GoalTaskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    priority: str = "medium"
    task_type: str = "time"  # 'time', 'count', 'boolean'
    target_value: Optional[int] = None  # For COUNT type
    unit: Optional[str] = None  # For COUNT type (e.g., 'courses', 'deals')
    allocated_minutes: Optional[int] = None  # For TIME type
    time_allocated_hours: float = 0.0  # Legacy support
    order: int = 0


class GoalTaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    priority: Optional[str] = None
    is_completed: Optional[bool] = None
    task_type: Optional[str] = None
    target_value: Optional[int] = None
    current_value: Optional[int] = None
    unit: Optional[str] = None
    allocated_minutes: Optional[int] = None
    time_allocated_hours: Optional[float] = None
    time_spent_hours: Optional[float] = None
    order: Optional[int] = None
    
    # Pillar/Category organization
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    
    # Follow-up
    follow_up_frequency: Optional[str] = None
    separately_followed: Optional[bool] = None
    is_daily_one_time: Optional[bool] = None
    
    # Project/Wish linkage
    project_id: Optional[int] = None
    related_wish_id: Optional[int] = None
    parent_task_id: Optional[int] = None
    
    # Motivation
    why_reason: Optional[str] = None
    additional_whys: Optional[str] = None
    
    # Status
    is_active: Optional[bool] = None


# Goal endpoints
@router.get("/")
def get_all_goals(include_completed: bool = False, db: Session = Depends(get_db)):
    """Get all life goals with stats"""
    import json
    from datetime import date as date_type
    
    goals = life_goal_service.get_all_life_goals(db, include_completed=include_completed)
    
    # Transform goals to include parsed why_statements, days_remaining, and milestone stats
    result = []
    for goal in goals:
        # Get stats for milestone counts
        stats = life_goal_service.calculate_goal_stats(db, goal.id)
        
        goal_dict = {
            "id": goal.id,
            "name": goal.name,
            "parent_goal_id": goal.parent_goal_id,
            "start_date": goal.start_date.isoformat() if goal.start_date else None,
            "target_date": goal.target_date.isoformat() if goal.target_date else None,
            "actual_completion_date": goal.actual_completion_date.isoformat() if goal.actual_completion_date else None,
            "status": goal.status,
            "category": goal.category,
            "priority": goal.priority,
            "why_statements": goal.why_statements if isinstance(goal.why_statements, list) else (json.loads(goal.why_statements) if goal.why_statements else []),
            "description": goal.description,
            "progress_percentage": goal.progress_percentage,
            "time_allocated_hours": goal.time_allocated_hours,
            "time_spent_hours": goal.time_spent_hours,
            "created_at": goal.created_at.isoformat() if goal.created_at else None,
            "updated_at": goal.updated_at.isoformat() if goal.updated_at else None,
            "pillar_id": goal.pillar_id,
            "pillar_name": goal.pillar.name if goal.pillar else None,
            "category_id": goal.category_id,
            "category_name": goal.category.name if goal.category else None,
            "sub_category_id": goal.sub_category_id,
            "sub_category_name": goal.sub_category.name if goal.sub_category else None,
            "linked_task_id": goal.linked_task_id,
            "linked_task_name": goal.linked_task.name if goal.linked_task else None,
            "related_wish_id": goal.related_wish_id,  # Link to dream/wish
            "stats": stats  # Include full stats with milestone breakdown
        }
        
        # Calculate days_remaining
        if goal.target_date:
            today = date_type.today()
            days_remaining = (goal.target_date - today).days
            goal_dict["days_remaining"] = days_remaining
        else:
            goal_dict["days_remaining"] = None
            
        result.append(goal_dict)
    
    return result


@router.get("/root")
def get_root_goals(db: Session = Depends(get_db)):
    """Get all root goals (no parent)"""
    goals = life_goal_service.get_root_goals(db)
    return goals


@router.get("/{goal_id}")
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    """Get a specific goal by ID"""
    import json
    from datetime import date as date_type
    
    goal = life_goal_service.get_life_goal_by_id(db, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Transform goal to include parsed why_statements and days_remaining
    goal_dict = {
        "id": goal.id,
        "name": goal.name,
        "parent_goal_id": goal.parent_goal_id,
        "start_date": goal.start_date.isoformat() if goal.start_date else None,
        "target_date": goal.target_date.isoformat() if goal.target_date else None,
        "actual_completion_date": goal.actual_completion_date.isoformat() if goal.actual_completion_date else None,
        "status": goal.status,
        "category": goal.category,
        "priority": goal.priority,
        "why_statements": goal.why_statements if isinstance(goal.why_statements, list) else (json.loads(goal.why_statements) if goal.why_statements else []),
        "description": goal.description,
        "progress_percentage": goal.progress_percentage,
        "time_allocated_hours": goal.time_allocated_hours,
        "time_spent_hours": goal.time_spent_hours,
        "created_at": goal.created_at.isoformat() if goal.created_at else None,
        "updated_at": goal.updated_at.isoformat() if goal.updated_at else None,
        "pillar_id": goal.pillar_id,
        "pillar_name": goal.pillar.name if goal.pillar else None,
        "category_id": goal.category_id,
        "category_name": goal.category.name if goal.category else None,
        "sub_category_id": goal.sub_category_id,
        "sub_category_name": goal.sub_category.name if goal.sub_category else None,
        "linked_task_id": goal.linked_task_id,
        "linked_task_name": goal.linked_task.name if goal.linked_task else None,
    }
    
    # Calculate days_remaining
    if goal.target_date:
        today = date_type.today()
        days_remaining = (goal.target_date - today).days
        goal_dict["days_remaining"] = days_remaining
    else:
        goal_dict["days_remaining"] = None
        
    return goal_dict


@router.get("/{goal_id}/sub-goals")
def get_sub_goals(goal_id: int, db: Session = Depends(get_db)):
    """Get all sub-goals of a parent goal"""
    sub_goals = life_goal_service.get_sub_goals(db, goal_id)
    return sub_goals


@router.get("/{goal_id}/stats")
def get_goal_stats(goal_id: int, db: Session = Depends(get_db)):
    """Get comprehensive statistics for a goal"""
    stats = life_goal_service.calculate_goal_stats(db, goal_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Goal not found")
    return stats


@router.post("/")
def create_goal(goal_data: LifeGoalCreate, db: Session = Depends(get_db)):
    """Create a new life goal"""
    goal = life_goal_service.create_life_goal(
        db,
        name=goal_data.name,
        start_date=goal_data.start_date,
        target_date=goal_data.target_date,
        why_statements=goal_data.why_statements,
        parent_goal_id=goal_data.parent_goal_id,
        category=goal_data.category,
        priority=goal_data.priority,
        description=goal_data.description,
        pillar_id=goal_data.pillar_id,
        category_id=goal_data.category_id,
        sub_category_id=goal_data.sub_category_id,
        linked_task_id=goal_data.linked_task_id,
        related_wish_id=goal_data.related_wish_id
    )
    return goal


@router.put("/{goal_id}")
def update_goal(goal_id: int, goal_data: LifeGoalUpdate, db: Session = Depends(get_db)):
    """Update a life goal"""
    update_dict = {k: v for k, v in goal_data.dict().items() if v is not None}
    goal = life_goal_service.update_life_goal(db, goal_id, **update_dict)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.delete("/{goal_id}")
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    """Delete a life goal"""
    success = life_goal_service.delete_life_goal(db, goal_id)
    if not success:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"message": "Goal deleted successfully"}


# Milestone endpoints
@router.get("/{goal_id}/milestones")
def get_milestones(goal_id: int, db: Session = Depends(get_db)):
    """Get all milestones for a goal"""
    milestones = life_goal_service.get_milestones_by_goal(db, goal_id)
    return milestones


@router.post("/{goal_id}/milestones")
def create_milestone(goal_id: int, milestone_data: MilestoneCreate, db: Session = Depends(get_db)):
    """Create a milestone for a goal"""
    milestone = life_goal_service.create_milestone(
        db,
        goal_id=goal_id,
        name=milestone_data.name,
        target_date=milestone_data.target_date,
        start_date=milestone_data.start_date,
        description=milestone_data.description,
        metric=milestone_data.metric,
        order=milestone_data.order
    )
    return milestone


@router.put("/milestones/{milestone_id}")
def update_milestone(milestone_id: int, milestone_data: MilestoneUpdate, db: Session = Depends(get_db)):
    """Update a milestone"""
    update_dict = {k: v for k, v in milestone_data.dict().items() if v is not None}
    milestone = life_goal_service.update_milestone(db, milestone_id, **update_dict)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return milestone


@router.delete("/milestones/{milestone_id}")
def delete_milestone(milestone_id: int, db: Session = Depends(get_db)):
    """Delete a milestone"""
    success = life_goal_service.delete_milestone(db, milestone_id)
    if not success:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return {"message": "Milestone deleted successfully"}


# Task linking endpoints
@router.get("/{goal_id}/linked-tasks")
def get_linked_tasks(goal_id: int, db: Session = Depends(get_db)):
    """Get all tasks linked to a goal with completion statistics - includes both linked tasks and regular tasks with goal_id"""
    from app.models.models import Task
    
    # Get tasks from LifeGoalTaskLink (old linking system)
    links = life_goal_service.get_linked_tasks(db, goal_id)
    
    # Enhance each link with completion statistics
    enhanced_links = []
    for link in links:
        link_dict = {
            "id": link.id,
            "goal_id": link.goal_id,
            "task_id": link.task_id,
            "task_type": link.task_type,
            "time_allocated_hours": link.time_allocated_hours,
            "notes": link.notes,
            "link_start_date": link.link_start_date.isoformat() if link.link_start_date else None,
            "expected_frequency": link.expected_frequency,
            "created_at": link.created_at.isoformat() if link.created_at else None,
            "task": {
                "id": link.task.id,
                "name": link.task.name,
                "pillar_name": link.task.pillar.name if link.task.pillar else None
            } if link.task else None
        }
        
        # Add completion statistics
        stats = life_goal_service.calculate_linked_task_completion(db, link)
        link_dict.update(stats)
        
        enhanced_links.append(link_dict)
    
    # Get regular tasks with goal_id set (new system with frequency support)
    regular_tasks = db.query(Task).filter(Task.goal_id == goal_id).all()
    for task in regular_tasks:
        # Create a similar structure for regular tasks
        task_dict = {
            "id": f"task_{task.id}",  # Prefix to distinguish from linked tasks
            "goal_id": goal_id,
            "task_id": task.id,
            "task_type": task.follow_up_frequency,  # Use frequency as task type
            "time_allocated_hours": task.allocated_minutes / 60 if task.allocated_minutes else 0,
            "notes": task.description or "",
            "link_start_date": task.created_at.isoformat() if task.created_at else None,
            "expected_frequency": task.follow_up_frequency,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "task": {
                "id": task.id,
                "name": task.name,
                "pillar_name": task.pillar.name if task.pillar else None
            },
            # Add basic stats for regular tasks
            "completion_count": 1 if task.is_completed else 0,
            "expected_count": 1,
            "completion_percentage": 100 if task.is_completed else 0,
            "days_tracked": 0,
            "recent_trend": 0
        }
        enhanced_links.append(task_dict)
    
    return enhanced_links


@router.post("/{goal_id}/link-task")
def link_task(goal_id: int, link_data: TaskLinkCreate, db: Session = Depends(get_db)):
    """Link an existing task to a goal"""
    link = life_goal_service.link_task_to_goal(
        db,
        goal_id=goal_id,
        task_id=link_data.task_id,
        task_type=link_data.task_type,
        time_allocated_hours=link_data.time_allocated_hours,
        notes=link_data.notes,
        link_start_date=link_data.link_start_date,
        expected_frequency=link_data.expected_frequency
    )
    return link


@router.delete("/task-links/{link_id}")
def unlink_task(link_id: int, db: Session = Depends(get_db)):
    """Remove a task link from a goal"""
    success = life_goal_service.unlink_task_from_goal(db, link_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task link not found")
    return {"message": "Task unlinked successfully"}


# Goal-specific task endpoints
@router.get("/{goal_id}/tasks")
def get_goal_tasks(goal_id: int, db: Session = Depends(get_db)):
    """Get all goal-specific tasks"""
    tasks = life_goal_service.get_goal_tasks(db, goal_id)
    return tasks


@router.post("/{goal_id}/tasks")
def create_goal_task(goal_id: int, task_data: GoalTaskCreate, db: Session = Depends(get_db)):
    """Create a task specific to a goal with support for TIME, COUNT, and BOOLEAN types"""
    task = life_goal_service.create_goal_task(
        db,
        goal_id=goal_id,
        name=task_data.name,
        description=task_data.description,
        start_date=task_data.start_date,
        due_date=task_data.due_date,
        priority=task_data.priority,
        task_type=task_data.task_type,
        target_value=task_data.target_value,
        unit=task_data.unit,
        allocated_minutes=task_data.allocated_minutes,
        time_allocated_hours=task_data.time_allocated_hours,
        order=task_data.order
    )
    return task


@router.put("/tasks/{task_id}")
def update_goal_task(task_id: int, task_data: GoalTaskUpdate, db: Session = Depends(get_db)):
    """Update a goal-specific task"""
    update_dict = {k: v for k, v in task_data.dict().items() if v is not None}
    task = life_goal_service.update_goal_task(db, task_id, **update_dict)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/tasks/{task_id}")
def delete_goal_task(task_id: int, db: Session = Depends(get_db)):
    """Delete a goal-specific task"""
    success = life_goal_service.delete_goal_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}


# Project linking endpoints (standalone projects)
@router.get("/{goal_id}/projects")
def get_goal_projects(goal_id: int, db: Session = Depends(get_db)):
    """Get all standalone projects linked to a goal"""
    projects = life_goal_service.get_goal_projects(db, goal_id)
    return projects


# Goal Projects endpoints (tracking dashboards within goals)
class GoalProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class GoalProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TaskLinkCreate(BaseModel):
    task_id: int
    task_type: str  # 'daily', 'weekly', 'monthly'
    track_start_date: date
    track_end_date: date
    expected_frequency_value: int
    expected_frequency_unit: str  # 'per_day', 'per_week', 'per_month'
    notes: Optional[str] = None


class TaskLinkUpdate(BaseModel):
    track_start_date: Optional[date] = None
    track_end_date: Optional[date] = None
    expected_frequency_value: Optional[int] = None
    expected_frequency_unit: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


@router.post("/{goal_id}/goal-projects")
def create_goal_project(goal_id: int, project_data: GoalProjectCreate, db: Session = Depends(get_db)):
    """Create a new goal project (tracking dashboard)"""
    from app.services import goal_project_service
    
    project = goal_project_service.create_goal_project(
        db,
        goal_id=goal_id,
        name=project_data.name,
        description=project_data.description
    )
    return project


@router.get("/{goal_id}/goal-projects")
def get_goal_projects_with_stats(goal_id: int, db: Session = Depends(get_db)):
    """Get all goal projects for a goal with performance stats"""
    from app.services import goal_project_service
    
    projects = goal_project_service.get_projects_for_goal(db, goal_id)
    return projects


@router.get("/goal-projects/{project_id}")
def get_goal_project_details(project_id: int, db: Session = Depends(get_db)):
    """Get a specific goal project with full performance statistics"""
    from app.services import goal_project_service
    
    project = goal_project_service.get_project_with_stats(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Goal project not found")
    return project


@router.put("/goal-projects/{project_id}")
def update_goal_project(project_id: int, project_data: GoalProjectUpdate, db: Session = Depends(get_db)):
    """Update a goal project"""
    from app.services import goal_project_service
    
    project = goal_project_service.update_goal_project(
        db,
        project_id=project_id,
        name=project_data.name,
        description=project_data.description
    )
    if not project:
        raise HTTPException(status_code=404, detail="Goal project not found")
    return project


@router.delete("/goal-projects/{project_id}")
def delete_goal_project(project_id: int, db: Session = Depends(get_db)):
    """Delete a goal project and all its task links"""
    from app.services import goal_project_service
    
    success = goal_project_service.delete_goal_project(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Goal project not found")
    return {"message": "Goal project deleted successfully"}


@router.post("/goal-projects/{project_id}/tasks")
def add_task_to_goal_project(project_id: int, task_data: TaskLinkCreate, db: Session = Depends(get_db)):
    """Link a task to a goal project with tracking parameters"""
    from app.services import goal_project_service
    
    task_link = goal_project_service.add_task_to_project(
        db,
        goal_project_id=project_id,
        task_id=task_data.task_id,
        task_type=task_data.task_type,
        track_start_date=task_data.track_start_date,
        track_end_date=task_data.track_end_date,
        expected_frequency_value=task_data.expected_frequency_value,
        expected_frequency_unit=task_data.expected_frequency_unit,
        notes=task_data.notes
    )
    return task_link


@router.put("/goal-project-tasks/{link_id}")
def update_task_link(link_id: int, link_data: TaskLinkUpdate, db: Session = Depends(get_db)):
    """Update a task link's tracking parameters"""
    from app.services import goal_project_service
    
    update_dict = {k: v for k, v in link_data.dict().items() if v is not None}
    task_link = goal_project_service.update_task_link(db, link_id, **update_dict)
    if not task_link:
        raise HTTPException(status_code=404, detail="Task link not found")
    return task_link


@router.delete("/goal-project-tasks/{link_id}")
def remove_task_from_goal_project(link_id: int, db: Session = Depends(get_db)):
    """Remove a task from a goal project"""
    from app.services import goal_project_service
    
    success = goal_project_service.remove_task_from_project(db, link_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task link not found")
    return {"message": "Task removed from goal project successfully"}


@router.get("/tasks/{task_id}/goal-projects")
def get_goal_projects_for_task(task_id: int, db: Session = Depends(get_db)):
    """Get all goal projects that include a specific task (for Tasks page display)"""
    from app.services import goal_project_service
    
    projects = goal_project_service.get_projects_for_task(db, task_id)
    return projects


@router.get("/goal-tasks/due-today")
def get_goal_tasks_due_today(db: Session = Depends(get_db)):
    """Get all goal tasks that are due today (including completed from today - visible until midnight)"""
    from app.models.goal import LifeGoalTask, LifeGoal
    from datetime import date, datetime, timedelta
    from sqlalchemy import or_, and_, cast, Date
    
    today = date.today()
    
    # Get tasks due today - include completed if completed today only
    tasks = db.query(LifeGoalTask).join(
        LifeGoal, LifeGoalTask.goal_id == LifeGoal.id
    ).filter(
        LifeGoalTask.due_date == today
    ).filter(
        or_(
            # Not completed
            LifeGoalTask.is_completed == False,
            # Completed today only - show until midnight
            and_(
                LifeGoalTask.is_completed == True, 
                cast(LifeGoalTask.updated_at, Date) >= today
            )
        )
    ).all()
    
    # Add goal name to each task
    result = []
    for task in tasks:
        task_dict = {
            "id": task.id,
            "goal_id": task.goal_id,
            "goal_name": task.goal.name if task.goal else None,
            "name": task.name,
            "description": task.description,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "priority": task.priority,
            "is_completed": task.is_completed,
            "task_type": task.task_type,
            "target_value": task.target_value,
            "current_value": task.current_value,
            "unit": task.unit,
            "updated_at": task.updated_at.isoformat() if task.updated_at else None
        }
        result.append(task_dict)
    
    return result


@router.get("/goal-tasks/overdue")
def get_goal_tasks_overdue(db: Session = Depends(get_db)):
    """Get all goal tasks that are overdue (including completed from today - visible until midnight)"""
    from app.models.goal import LifeGoalTask, LifeGoal
    from datetime import date, timedelta
    from sqlalchemy import or_, and_, cast, Date
    
    today = date.today()
    
    tasks = db.query(LifeGoalTask).join(
        LifeGoal, LifeGoalTask.goal_id == LifeGoal.id
    ).filter(
        LifeGoalTask.due_date < today
    ).filter(
        or_(
            # Not completed
            LifeGoalTask.is_completed == False,
            # Completed today only - show until midnight
            and_(
                LifeGoalTask.is_completed == True,
                cast(LifeGoalTask.updated_at, Date) >= today
            )
        )
    ).all()
    
    # Add goal name to each task
    result = []
    for task in tasks:
        task_dict = {
            "id": task.id,
            "goal_id": task.goal_id,
            "goal_name": task.goal.name if task.goal else None,
            "name": task.name,
            "description": task.description,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "priority": task.priority,
            "is_completed": task.is_completed,
            "task_type": task.task_type,
            "target_value": task.target_value,
            "current_value": task.current_value,
            "unit": task.unit,
            "updated_at": task.updated_at.isoformat() if task.updated_at else None
        }
        result.append(task_dict)
    
    return result

@router.get("/{goal_id}/challenges")
def get_goal_challenges(
    goal_id: int,
    db: Session = Depends(get_db)
):
    """
    Get all challenges related to a goal:
    - Direct challenges linked to this goal
    - Challenges linked to projects under this goal
    """
    from app.models.models import Challenge, Project
    
    # Get direct challenges for this goal
    direct_challenges = db.query(Challenge).filter(
        Challenge.goal_id == goal_id
    ).all()
    
    # Get challenges from projects under this goal
    projects = db.query(Project).filter(
        Project.goal_id == goal_id
    ).all()
    
    project_challenges = []
    for project in projects:
        challenges = db.query(Challenge).filter(
            Challenge.project_id == project.id
        ).all()
        for challenge in challenges:
            project_challenges.append({
                "challenge": challenge,
                "project_id": project.id,
                "project_name": project.name
            })
    
    return {
        "goal_id": goal_id,
        "direct_challenges": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "challenge_type": c.challenge_type,
                "start_date": c.start_date,
                "end_date": c.end_date,
                "status": c.status,
                "linked_to": "goal"
            }
            for c in direct_challenges
        ],
        "project_challenges": [
            {
                "id": pc["challenge"].id,
                "name": pc["challenge"].name,
                "description": pc["challenge"].description,
                "challenge_type": pc["challenge"].challenge_type,
                "start_date": pc["challenge"].start_date,
                "end_date": pc["challenge"].end_date,
                "status": pc["challenge"].status,
                "linked_to": "project",
                "project_id": pc["project_id"],
                "project_name": pc["project_name"]
            }
            for pc in project_challenges
        ]
    }
