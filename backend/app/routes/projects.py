"""
API routes for Projects and Project Tasks
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from typing import List, Optional
from pydantic import BaseModel

from app.database.config import get_db
from app.services import project_service


router = APIRouter(prefix="/api/projects", tags=["projects"])


# ============ Request/Response Models ============

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    goal_id: Optional[int] = None  # Link to Life Goal
    related_wish_id: Optional[int] = None  # Link to Dream/Wish
    start_date: Optional[date] = None
    target_completion_date: Optional[date] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    goal_id: Optional[int] = None  # Link to Life Goal
    related_wish_id: Optional[int] = None
    start_date: Optional[date] = None
    target_completion_date: Optional[date] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    is_completed: Optional[bool] = None


class ProjectTaskCreate(BaseModel):
    name: str
    parent_task_id: Optional[int] = None
    milestone_id: Optional[int] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    priority: str = "medium"
    order: int = 0


class ProjectTaskUpdate(BaseModel):
    name: Optional[str] = None
    parent_task_id: Optional[int] = None
    milestone_id: Optional[int] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    priority: Optional[str] = None
    priority_new: Optional[int] = None
    is_completed: Optional[bool] = None
    order: Optional[int] = None
    
    # Pillar/Category organization
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    
    # Task type and allocation
    task_type: Optional[str] = None
    allocated_minutes: Optional[int] = None
    target_value: Optional[int] = None
    unit: Optional[str] = None
    
    # Follow-up
    follow_up_frequency: Optional[str] = None
    separately_followed: Optional[bool] = None
    is_daily_one_time: Optional[bool] = None
    
    # Goal/Wish linkage
    goal_id: Optional[int] = None
    is_part_of_goal: Optional[bool] = None
    related_wish_id: Optional[int] = None
    
    # Motivation
    why_reason: Optional[str] = None
    additional_whys: Optional[str] = None
    
    # Status
    is_active: Optional[bool] = None


class MilestoneCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_date: date
    order: int = 0


class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_date: Optional[date] = None
    is_completed: Optional[bool] = None
    order: Optional[int] = None


# ============ Project Routes ============

@router.get("/")
def get_projects(
    include_completed: bool = True,
    db: Session = Depends(get_db)
):
    """Get all projects"""
    projects = project_service.get_all_projects(db, include_completed)
    
    # Add progress and milestones to each project
    result = []
    for project in projects:
        project_dict = {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "goal_id": project.goal_id,  # Add goal_id for goal linking
            "related_wish_id": project.related_wish_id,  # Add related_wish_id for dream linking
            "pillar_id": project.pillar_id,
            "category_id": project.category_id,
            "start_date": project.start_date.date() if project.start_date else None,
            "target_completion_date": project.target_completion_date.date() if project.target_completion_date else None,
            "status": project.status,
            "is_active": project.is_active,
            "is_completed": project.is_completed,
            "completed_at": project.completed_at,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "progress": project_service.get_project_progress(db, project.id),
            "milestone_progress": project_service.get_milestone_progress(db, project.id)
        }
        result.append(project_dict)
    
    return result


@router.get("/{project_id}")
def get_project(
    project_id: int,
    db: Session = Depends(get_db)
):
    """Get project by ID with tasks and milestones"""
    project = project_service.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    tasks = project_service.get_project_tasks(db, project_id)
    milestones = project_service.get_project_milestones(db, project_id)
    progress = project_service.get_project_progress(db, project_id)
    milestone_progress = project_service.get_milestone_progress(db, project_id)
    
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "pillar_id": project.pillar_id,
        "category_id": project.category_id,
        "related_wish_id": project.related_wish_id,
        "start_date": project.start_date.date() if project.start_date else None,
        "target_completion_date": project.target_completion_date.date() if project.target_completion_date else None,
        "status": project.status,
        "is_active": project.is_active,
        "is_completed": project.is_completed,
        "completed_at": project.completed_at,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "tasks": [
            {
                "id": task.id,
                "project_id": task.project_id,
                "parent_task_id": task.parent_task_id,
                "name": task.name,
                "description": task.description,
                "due_date": task.due_date.date() if task.due_date else None,
                "priority": task.priority,
                "is_completed": task.is_completed,
                "completed_at": task.completed_at,
                "order": task.order,
                "created_at": task.created_at,
                "updated_at": task.updated_at
            }
            for task in tasks
        ],
        "milestones": [
            {
                "id": milestone.id,
                "project_id": milestone.project_id,
                "name": milestone.name,
                "description": milestone.description,
                "target_date": milestone.target_date.isoformat() if milestone.target_date else None,
                "is_completed": milestone.is_completed,
                "completed_at": milestone.completed_at,
                "order": milestone.order,
                "created_at": milestone.created_at,
                "updated_at": milestone.updated_at
            }
            for milestone in milestones
        ],
        "progress": progress,
        "milestone_progress": milestone_progress
    }


@router.post("/")
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db)
):
    """Create a new project"""
    new_project = project_service.create_project(
        db,
        name=project.name,
        description=project.description,
        pillar_id=project.pillar_id,
        category_id=project.category_id,
        goal_id=project.goal_id,  # Pass goal_id to service
        related_wish_id=project.related_wish_id,  # Pass related_wish_id to service
        start_date=project.start_date,
        target_completion_date=project.target_completion_date
    )
    
    return {
        "id": new_project.id,
        "name": new_project.name,
        "description": new_project.description,
        "pillar_id": new_project.pillar_id,
        "category_id": new_project.category_id,
        "goal_id": new_project.goal_id,
        "related_wish_id": new_project.related_wish_id,
        "start_date": new_project.start_date.date() if new_project.start_date else None,
        "target_completion_date": new_project.target_completion_date.date() if new_project.target_completion_date else None,
        "status": new_project.status,
        "is_active": new_project.is_active,
        "is_completed": new_project.is_completed,
        "completed_at": new_project.completed_at,
        "created_at": new_project.created_at,
        "updated_at": new_project.updated_at
    }

@router.put("/{project_id}")
def update_project(
    project_id: int,
    project: ProjectUpdate,
    db: Session = Depends(get_db)
):
    """Update a project"""
    try:
        updated_project = project_service.update_project(
            db,
            project_id,
            **project.dict(exclude_unset=True)
        )
        
        if not updated_project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return {
            "id": updated_project.id,
            "name": updated_project.name,
            "description": updated_project.description,
            "pillar_id": updated_project.pillar_id,
            "category_id": updated_project.category_id,
            "goal_id": updated_project.goal_id,
            "start_date": updated_project.start_date.date() if updated_project.start_date else None,
            "target_completion_date": updated_project.target_completion_date.date() if updated_project.target_completion_date else None,
            "status": updated_project.status,
            "is_active": updated_project.is_active,
            "is_completed": updated_project.is_completed,
            "completed_at": updated_project.completed_at,
            "created_at": updated_project.created_at,
            "updated_at": updated_project.updated_at
        }
    except ValueError as e:
        # Handle validation errors (e.g., trying to complete project with pending tasks)
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db)
):
    """Delete a project"""
    success = project_service.delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted successfully"}


# ============ Project Task Routes ============

@router.get("/{project_id}/tasks")
def get_project_tasks(
    project_id: int,
    include_completed: bool = True,
    db: Session = Depends(get_db)
):
    """Get all tasks for a project - includes both ProjectTasks and regular Tasks"""
    tasks = project_service.get_project_tasks(db, project_id, include_completed)
    
    result = []
    for task in tasks:
        # Handle both ProjectTask and Task types
        task_dict = {
            "id": task.id,
            "project_id": task.project_id,
            "name": task.name,
            "description": task.description or "",
            "is_completed": task.is_completed,
            "completed_at": task.completed_at,
            "created_at": task.created_at,
            "updated_at": task.updated_at
        }
        
        # ProjectTask specific fields
        if hasattr(task, 'parent_task_id'):
            task_dict.update({
                "parent_task_id": task.parent_task_id,
                "milestone_id": getattr(task, 'milestone_id', None),
                "due_date": task.due_date.date() if task.due_date else None,
                "priority": task.priority if hasattr(task, 'priority') else None,
                "order": task.order if hasattr(task, 'order') else None,
            })
        
        # Regular Task specific fields (with frequency support)
        if hasattr(task, 'follow_up_frequency'):
            task_dict.update({
                "follow_up_frequency": task.follow_up_frequency,
                "allocated_minutes": getattr(task, 'allocated_minutes', 0),
                "task_type": getattr(task, 'task_type', 'time'),
                "pillar_id": getattr(task, 'pillar_id', None),
                "category_id": getattr(task, 'category_id', None),
                "goal_id": getattr(task, 'goal_id', None),
            })
        
        result.append(task_dict)
    
    return result


@router.post("/{project_id}/tasks")
def create_task(
    project_id: int,
    task: ProjectTaskCreate,
    db: Session = Depends(get_db)
):
    """Create a new task for a project"""
    # Verify project exists
    project = project_service.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    new_task = project_service.create_project_task(
        db,
        project_id=project_id,
        name=task.name,
        parent_task_id=task.parent_task_id,
        description=task.description,
        due_date=task.due_date,
        priority=task.priority,
        order=task.order
    )
    
    return {
        "id": new_task.id,
        "project_id": new_task.project_id,
        "parent_task_id": new_task.parent_task_id,
        "name": new_task.name,
        "description": new_task.description,
        "due_date": new_task.due_date.date() if new_task.due_date else None,
        "priority": new_task.priority,
        "is_completed": new_task.is_completed,
        "completed_at": new_task.completed_at,
        "order": new_task.order,
        "created_at": new_task.created_at,
        "updated_at": new_task.updated_at
    }


@router.put("/tasks/{task_id}")
def update_task(
    task_id: int,
    task: ProjectTaskUpdate,
    db: Session = Depends(get_db)
):
    """Update a project task"""
    updated_task = project_service.update_project_task(
        db,
        task_id,
        **task.dict(exclude_unset=True)
    )
    
    if not updated_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {
        "id": updated_task.id,
        "project_id": updated_task.project_id,
        "parent_task_id": updated_task.parent_task_id,
        "name": updated_task.name,
        "description": updated_task.description,
        "due_date": updated_task.due_date.date() if updated_task.due_date else None,
        "priority": updated_task.priority,
        "is_completed": updated_task.is_completed,
        "completed_at": updated_task.completed_at,
        "order": updated_task.order,
        "created_at": updated_task.created_at,
        "updated_at": updated_task.updated_at
    }


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    """Delete a project task"""
    success = project_service.delete_project_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}


# ============ Project Milestone Routes ============

@router.get("/{project_id}/milestones")
def get_milestones(
    project_id: int,
    db: Session = Depends(get_db)
):
    """Get all milestones for a project"""
    milestones = project_service.get_project_milestones(db, project_id)
    
    return [
        {
            "id": milestone.id,
            "project_id": milestone.project_id,
            "name": milestone.name,
            "description": milestone.description,
            "target_date": milestone.target_date.isoformat() if milestone.target_date else None,
            "is_completed": milestone.is_completed,
            "completed_at": milestone.completed_at,
            "order": milestone.order,
            "created_at": milestone.created_at,
            "updated_at": milestone.updated_at
        }
        for milestone in milestones
    ]


@router.post("/{project_id}/milestones")
def create_milestone(
    project_id: int,
    milestone: MilestoneCreate,
    db: Session = Depends(get_db)
):
    """Create a new milestone for a project"""
    # Verify project exists
    project = project_service.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    new_milestone = project_service.create_milestone(
        db,
        project_id=project_id,
        name=milestone.name,
        description=milestone.description,
        target_date=milestone.target_date,
        order=milestone.order
    )
    
    return {
        "id": new_milestone.id,
        "project_id": new_milestone.project_id,
        "name": new_milestone.name,
        "description": new_milestone.description,
        "target_date": new_milestone.target_date.isoformat() if new_milestone.target_date else None,
        "is_completed": new_milestone.is_completed,
        "completed_at": new_milestone.completed_at,
        "order": new_milestone.order,
        "created_at": new_milestone.created_at,
        "updated_at": new_milestone.updated_at
    }


@router.put("/milestones/{milestone_id}")
def update_milestone(
    milestone_id: int,
    milestone: MilestoneUpdate,
    db: Session = Depends(get_db)
):
    """Update a milestone"""
    updated_milestone = project_service.update_milestone(
        db,
        milestone_id,
        **milestone.dict(exclude_unset=True)
    )
    
    if not updated_milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    return {
        "id": updated_milestone.id,
        "project_id": updated_milestone.project_id,
        "name": updated_milestone.name,
        "description": updated_milestone.description,
        "target_date": updated_milestone.target_date.isoformat() if updated_milestone.target_date else None,
        "is_completed": updated_milestone.is_completed,
        "completed_at": updated_milestone.completed_at,
        "order": updated_milestone.order,
        "created_at": updated_milestone.created_at,
        "updated_at": updated_milestone.updated_at
    }


@router.delete("/milestones/{milestone_id}")
def delete_milestone(
    milestone_id: int,
    db: Session = Depends(get_db)
):
    """Delete a milestone"""
    success = project_service.delete_milestone(db, milestone_id)
    if not success:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return {"message": "Milestone deleted successfully"}


# ============ Special Routes ============

@router.get("/tasks/due-today")
def get_tasks_due_today(
    db: Session = Depends(get_db)
):
    """Get all tasks due today"""
    tasks = project_service.get_tasks_due_today(db)
    
    return [
        {
            "id": task.id,
            "project_id": task.project_id,
            "project_name": task.project.name if task.project else None,
            "parent_task_id": task.parent_task_id,
            "name": task.name,
            "description": task.description,
            "due_date": task.due_date.date() if task.due_date else None,
            "priority": task.priority_new if task.priority_new is not None else (2 if task.priority == "high" else 5 if task.priority == "medium" else 8),
            "allocated_minutes": task.allocated_minutes if task.allocated_minutes else 60,
            "is_completed": task.is_completed,
            "completed_at": task.completed_at,
            "order": task.order,
            "created_at": task.created_at,
            "updated_at": task.updated_at
        }
        for task in tasks
    ]


@router.get("/tasks/overdue")
def get_overdue_tasks(
    db: Session = Depends(get_db)
):
    """Get all overdue tasks"""
    tasks = project_service.get_overdue_tasks(db)
    
    return [
        {
            "id": task.id,
            "project_id": task.project_id,
            "project_name": task.project.name if task.project else None,
            "parent_task_id": task.parent_task_id,
            "name": task.name,
            "description": task.description,
            "due_date": task.due_date.date() if task.due_date else None,
            "priority": task.priority_new if task.priority_new is not None else (2 if task.priority == "high" else 5 if task.priority == "medium" else 8),
            "allocated_minutes": task.allocated_minutes if task.allocated_minutes else 60,
            "is_completed": task.is_completed,
            "completed_at": task.completed_at,
            "order": task.order,
            "created_at": task.created_at,
            "updated_at": task.updated_at
        }
        for task in tasks
    ]


@router.get("/tasks/upcoming")
def get_upcoming_tasks(
    days: int = 7,
    db: Session = Depends(get_db)
):
    """Get tasks due in the next N days"""
    tasks = project_service.get_upcoming_tasks(db, days)
    
    return [
        {
            "id": task.id,
            "project_id": task.project_id,
            "project_name": task.project.name if task.project else None,
            "parent_task_id": task.parent_task_id,
            "name": task.name,
            "description": task.description,
            "due_date": task.due_date.date() if task.due_date else None,
            "priority": task.priority,
            "is_completed": task.is_completed,
            "completed_at": task.completed_at,
            "order": task.order,
            "created_at": task.created_at,
            "updated_at": task.updated_at
        }
        for task in tasks
    ]

@router.get("/{project_id}/challenges")
def get_project_challenges(
    project_id: int,
    db: Session = Depends(get_db)
):
    """
    Get all challenges related to a project:
    - Challenges directly linked to this project
    - If project has a parent goal, also show challenges from that goal
    """
    from app.models.models import Challenge, Project, Goal
    
    # Get the project and its parent goal
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get direct challenges for this project
    direct_challenges = db.query(Challenge).filter(
        Challenge.project_id == project_id
    ).all()
    
    # Get parent goal challenges if project has a goal
    goal_challenges = []
    if project.goal_id:
        goal = db.query(Goal).filter(Goal.id == project.goal_id).first()
        challenges = db.query(Challenge).filter(
            Challenge.goal_id == project.goal_id
        ).all()
        for challenge in challenges:
            goal_challenges.append({
                "challenge": challenge,
                "goal_id": goal.id if goal else None,
                "goal_name": goal.name if goal else "Unknown Goal"
            })
    
    return {
        "project_id": project_id,
        "project_name": project.name,
        "goal_id": project.goal_id,
        "direct_challenges": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "challenge_type": c.challenge_type,
                "start_date": c.start_date,
                "end_date": c.end_date,
                "status": c.status,
                "linked_to": "project"
            }
            for c in direct_challenges
        ],
        "goal_challenges": [
            {
                "id": gc["challenge"].id,
                "name": gc["challenge"].name,
                "description": gc["challenge"].description,
                "challenge_type": gc["challenge"].challenge_type,
                "start_date": gc["challenge"].start_date,
                "end_date": gc["challenge"].end_date,
                "status": gc["challenge"].status,
                "linked_to": "goal",
                "goal_id": gc["goal_id"],
                "goal_name": gc["goal_name"]
            }
            for gc in goal_challenges
        ]
    }
