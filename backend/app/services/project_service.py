"""
Service layer for Projects and Project Tasks operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date
from typing import List, Optional, Dict
from app.models.models import Project, ProjectTask


# ============ Project CRUD Operations ============

def get_all_projects(db: Session, include_completed: bool = True) -> List[Project]:
    """Get all projects"""
    query = db.query(Project)
    if not include_completed:
        query = query.filter(Project.is_completed == False)
    return query.order_by(Project.created_at.desc()).all()


def get_project_by_id(db: Session, project_id: int) -> Optional[Project]:
    """Get project by ID"""
    return db.query(Project).filter(Project.id == project_id).first()


def create_project(
    db: Session,
    name: str,
    description: Optional[str] = None,
    pillar_id: Optional[int] = None,
    category_id: Optional[int] = None,
    goal_id: Optional[int] = None,  # Add goal_id parameter
    start_date: Optional[date] = None,
    target_completion_date: Optional[date] = None
) -> Project:
    """Create a new project, optionally linked to a life goal"""
    project = Project(
        name=name,
        description=description,
        pillar_id=pillar_id,
        category_id=category_id,
        goal_id=goal_id,  # Set goal_id
        start_date=datetime.combine(start_date, datetime.min.time()) if start_date else None,
        target_completion_date=datetime.combine(target_completion_date, datetime.min.time()) if target_completion_date else None,
        status="not_started"
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(
    db: Session,
    project_id: int,
    **kwargs
) -> Optional[Project]:
    """Update a project"""
    project = get_project_by_id(db, project_id)
    if not project:
        return None
    
    for key, value in kwargs.items():
        if hasattr(project, key):
            # Convert dates to datetime
            if key in ['start_date', 'target_completion_date'] and value and isinstance(value, date):
                value = datetime.combine(value, datetime.min.time())
            setattr(project, key, value)
    
    project.updated_at = datetime.now()
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: int) -> bool:
    """Delete a project and all its tasks"""
    project = get_project_by_id(db, project_id)
    if project:
        db.delete(project)
        db.commit()
        return True
    return False


def get_project_progress(db: Session, project_id: int) -> Dict:
    """Calculate project progress"""
    tasks = db.query(ProjectTask).filter(
        ProjectTask.project_id == project_id
    ).all()
    
    total_tasks = len(tasks)
    completed_tasks = sum(1 for task in tasks if task.is_completed)
    
    progress_percentage = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "progress_percentage": round(progress_percentage, 1)
    }


# ============ Project Task CRUD Operations ============

def get_project_tasks(db: Session, project_id: int, include_completed: bool = True) -> List[ProjectTask]:
    """Get all tasks for a project"""
    query = db.query(ProjectTask).filter(ProjectTask.project_id == project_id)
    if not include_completed:
        query = query.filter(ProjectTask.is_completed == False)
    return query.order_by(ProjectTask.order, ProjectTask.created_at).all()


def get_task_by_id(db: Session, task_id: int) -> Optional[ProjectTask]:
    """Get task by ID"""
    return db.query(ProjectTask).filter(ProjectTask.id == task_id).first()


def create_project_task(
    db: Session,
    project_id: int,
    name: str,
    parent_task_id: Optional[int] = None,
    description: Optional[str] = None,
    due_date: Optional[date] = None,
    priority: str = "medium",
    order: int = 0
) -> ProjectTask:
    """Create a new project task"""
    task = ProjectTask(
        project_id=project_id,
        parent_task_id=parent_task_id,
        name=name,
        description=description,
        due_date=datetime.combine(due_date, datetime.min.time()) if due_date else None,
        priority=priority,
        order=order
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_project_task(
    db: Session,
    task_id: int,
    **kwargs
) -> Optional[ProjectTask]:
    """Update a project task"""
    task = get_task_by_id(db, task_id)
    if not task:
        return None
    
    for key, value in kwargs.items():
        if hasattr(task, key):
            # Convert dates to datetime
            if key == 'due_date' and value and isinstance(value, date):
                value = datetime.combine(value, datetime.min.time())
            # Handle completion
            if key == 'is_completed' and value and not task.is_completed:
                task.completed_at = datetime.now()
            elif key == 'is_completed' and not value:
                task.completed_at = None
            setattr(task, key, value)
    
    task.updated_at = datetime.now()
    db.commit()
    db.refresh(task)
    
    # Auto-update project status
    _update_project_status(db, task.project_id)
    
    return task


def _update_project_status(db: Session, project_id: int):
    """Automatically update project status based on task completion"""
    project = get_project_by_id(db, project_id)
    if not project:
        return
    
    tasks = db.query(ProjectTask).filter(ProjectTask.project_id == project_id).all()
    
    if not tasks:
        return
    
    completed_count = sum(1 for t in tasks if t.is_completed)
    total_count = len(tasks)
    
    # Update status based on completion
    status_changed = False
    
    if completed_count == 0:
        # No tasks completed - keep as not_started (unless manually changed)
        if project.status == 'in_progress':
            project.status = 'not_started'
            status_changed = True
    elif completed_count > 0 and completed_count < total_count:
        # Some tasks completed - mark as in_progress (unless on_hold)
        if project.status == 'not_started' or project.status == 'completed':
            project.status = 'in_progress'
            status_changed = True
    elif completed_count == total_count and total_count > 0:
        # All tasks completed - mark as completed
        if not project.is_completed:
            project.status = 'completed'
            project.is_completed = True
            project.completed_at = datetime.now()
            status_changed = True
    
    if status_changed:
        project.updated_at = datetime.now()
    
    db.commit()


def delete_project_task(db: Session, task_id: int) -> bool:
    """Delete a project task and all its sub-tasks"""
    task = get_task_by_id(db, task_id)
    if task:
        db.delete(task)
        db.commit()
        return True
    return False


def get_tasks_due_today(db: Session) -> List[ProjectTask]:
    """Get all project tasks due today (including completed from today)"""
    from sqlalchemy import or_, cast, Date
    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    return db.query(ProjectTask).filter(
        and_(
            ProjectTask.due_date >= today_start,
            ProjectTask.due_date <= today_end,
            or_(
                # Not completed
                ProjectTask.is_completed == False,
                # Completed today - show until next day (compare dates)
                and_(
                    ProjectTask.is_completed == True,
                    cast(ProjectTask.updated_at, Date) >= today
                )
            )
        )
    ).order_by(ProjectTask.priority, ProjectTask.due_date).all()


def get_overdue_tasks(db: Session) -> List[ProjectTask]:
    """Get all overdue project tasks (including completed from today)"""
    from sqlalchemy import or_, cast, Date
    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    
    return db.query(ProjectTask).filter(
        and_(
            ProjectTask.due_date < today_start,
            or_(
                # Not completed
                ProjectTask.is_completed == False,
                # Completed today - show until next day (compare dates)
                and_(
                    ProjectTask.is_completed == True,
                    cast(ProjectTask.updated_at, Date) >= today
                )
            )
        )
    ).order_by(ProjectTask.due_date).all()


def get_upcoming_tasks(db: Session, days: int = 7) -> List[ProjectTask]:
    """Get tasks due in the next N days"""
    today = datetime.now().date()
    from datetime import timedelta
    end_date = today + timedelta(days=days)
    
    today_start = datetime.combine(today, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    
    return db.query(ProjectTask).filter(
        and_(
            ProjectTask.due_date >= today_start,
            ProjectTask.due_date <= end_datetime,
            ProjectTask.is_completed == False
        )
    ).order_by(ProjectTask.due_date).all()
