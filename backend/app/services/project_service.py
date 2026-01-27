"""
Service layer for Projects and Project Tasks operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict
from app.models.models import Project, ProjectTask, ProjectMilestone, Task


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
    related_wish_id: Optional[int] = None,  # Add related_wish_id parameter
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
        related_wish_id=related_wish_id,  # Set related_wish_id
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
    
    # IMPORTANT: Prevent completing project if there are pending tasks
    if 'is_completed' in kwargs and kwargs['is_completed']:
        progress = get_project_progress(db, project_id)
        if progress['pending_tasks'] > 0:
            raise ValueError(f"Cannot complete project: {progress['pending_tasks']} task(s) still pending. Complete all tasks first.")
    
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
    """Calculate project progress including overdue tasks"""
    from datetime import date as date_type
    
    tasks = db.query(ProjectTask).filter(
        ProjectTask.project_id == project_id
    ).all()
    
    total_tasks = len(tasks)
    completed_tasks = sum(1 for task in tasks if task.is_completed)
    
    # Calculate overdue tasks (incomplete tasks past their due date)
    today = date_type.today()
    overdue_tasks = sum(
        1 for task in tasks 
        if not task.is_completed 
        and task.due_date 
        and task.due_date.date() < today
    )
    
    progress_percentage = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": total_tasks - completed_tasks,
        "overdue_tasks": overdue_tasks,
        "progress_percentage": round(progress_percentage, 1)
    }


# ============ Project Task CRUD Operations ============

def get_project_tasks(db: Session, project_id: int, include_completed: bool = True) -> List:
    """Get all tasks for a project - includes both ProjectTasks and regular Tasks linked to this project"""
    # Get ProjectTask entries (old system)
    query = db.query(ProjectTask).filter(ProjectTask.project_id == project_id)
    if not include_completed:
        query = query.filter(ProjectTask.is_completed == False)
    project_tasks = query.order_by(ProjectTask.order, ProjectTask.created_at).all()
    
    # Get regular Task entries linked to this project (new system with frequency)
    task_query = db.query(Task).filter(Task.project_id == project_id)
    if not include_completed:
        task_query = task_query.filter(Task.is_completed == False)
    regular_tasks = task_query.order_by(Task.created_at).all()
    
    # Combine both lists
    return list(project_tasks) + list(regular_tasks)


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
    
    # IMPORTANT: If adding a pending task to a completed project, reopen the project
    project = get_project_by_id(db, project_id)
    if project and project.is_completed:
        project.is_completed = False
        project.completed_at = None
        project.status = "in_progress"  # Reset status when reopening
        project.updated_at = datetime.now()
        db.commit()
    
    return task


def update_project_task(
    db: Session,
    task_id: int,
    **kwargs
) -> Optional[ProjectTask]:
    """Update a project task - handles both ProjectTask and regular Task entries"""
    # Try to find the task in ProjectTask table first
    task = get_task_by_id(db, task_id)
    
    # If not found, try the regular Task table (for tasks with project_id)
    if not task:
        task = db.query(Task).filter(Task.id == task_id).first()
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
    
    # IMPORTANT: If marking task as incomplete and project is completed, reopen the project
    if 'is_completed' in kwargs and not kwargs['is_completed']:
        project = get_project_by_id(db, task.project_id)
        if project and project.is_completed:
            project.is_completed = False
            project.completed_at = None
            project.status = "in_progress"  # Reset status when reopening
            project.updated_at = datetime.now()
            db.commit()
    
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
        if project.status == 'not_started':
            project.status = 'in_progress'
            status_changed = True
        # If project was marked completed but still has pending tasks, revert status
        if project.is_completed:
            project.is_completed = False
            project.completed_at = None
            project.status = 'in_progress'
            status_changed = True
    elif completed_count == total_count and total_count > 0:
        # All tasks completed - update status to 'ready_for_completion' but DON'T auto-complete
        # Project must be manually marked as completed
        if project.status not in ['completed', 'on_hold'] and not project.is_completed:
            project.status = 'in_progress'  # Keep as in_progress, ready for manual completion
            status_changed = True
    
    if status_changed:
        project.updated_at = datetime.now()
    
    db.commit()
    
    # If project is linked to a goal, recalculate goal progress
    if project.goal_id:
        from app.services.life_goal_service import _recalculate_goal_progress
        _recalculate_goal_progress(db, project.goal_id)


def delete_project_task(db: Session, task_id: int) -> bool:
    """Delete a project task and all its sub-tasks - handles both ProjectTask and regular Task entries"""
    # Try to find the task in ProjectTask table first
    task = get_task_by_id(db, task_id)
    
    # If not found, try the regular Task table (for tasks with project_id)
    if not task:
        task = db.query(Task).filter(Task.id == task_id).first()
    
    if task:
        db.delete(task)
        db.commit()
        return True
    return False


def get_tasks_due_today(db: Session) -> List[ProjectTask]:
    """Get all project tasks due today (including completed today - visible until midnight)"""
    from sqlalchemy import or_
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
                # Completed today only (visible until midnight)
                and_(
                    ProjectTask.is_completed == True,
                    or_(
                        ProjectTask.completed_at >= today_start,
                        ProjectTask.updated_at >= today_start
                    )
                )
            )
        )
    ).order_by(ProjectTask.priority, ProjectTask.due_date).all()


def get_overdue_tasks(db: Session) -> List[ProjectTask]:
    """Get all overdue project tasks (including completed today - visible until midnight)"""
    from sqlalchemy import or_
    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    
    return db.query(ProjectTask).filter(
        and_(
            ProjectTask.due_date < today_start,
            or_(
                # Not completed
                ProjectTask.is_completed == False,
                # Completed today only (visible until midnight)
                and_(
                    ProjectTask.is_completed == True,
                    or_(
                        ProjectTask.completed_at >= today_start,
                        ProjectTask.updated_at >= today_start
                    )
                )
            )
        )
    ).order_by(ProjectTask.priority, ProjectTask.due_date).all()


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


# ============ Project Milestone Operations ============

def get_project_milestones(db: Session, project_id: int) -> List[ProjectMilestone]:
    """Get all milestones for a project"""
    return db.query(ProjectMilestone).filter(
        ProjectMilestone.project_id == project_id
    ).order_by(ProjectMilestone.order, ProjectMilestone.target_date).all()


def get_milestone_by_id(db: Session, milestone_id: int) -> Optional[ProjectMilestone]:
    """Get milestone by ID"""
    return db.query(ProjectMilestone).filter(ProjectMilestone.id == milestone_id).first()


def create_milestone(
    db: Session,
    project_id: int,
    name: str,
    target_date: date,
    description: Optional[str] = None,
    order: int = 0
) -> ProjectMilestone:
    """Create a new milestone"""
    milestone = ProjectMilestone(
        project_id=project_id,
        name=name,
        description=description,
        target_date=target_date,
        order=order,
        is_completed=False
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return milestone


def update_milestone(
    db: Session,
    milestone_id: int,
    **kwargs
) -> Optional[ProjectMilestone]:
    """Update a milestone"""
    milestone = get_milestone_by_id(db, milestone_id)
    if not milestone:
        return None
    
    # Handle completion
    if 'is_completed' in kwargs:
        if kwargs['is_completed'] and not milestone.is_completed:
            kwargs['completed_at'] = datetime.now()
        elif not kwargs['is_completed'] and milestone.is_completed:
            kwargs['completed_at'] = None
    
    for key, value in kwargs.items():
        if hasattr(milestone, key):
            setattr(milestone, key, value)
    
    db.commit()
    db.refresh(milestone)
    return milestone


def delete_milestone(db: Session, milestone_id: int) -> bool:
    """Delete a milestone"""
    milestone = get_milestone_by_id(db, milestone_id)
    if not milestone:
        return False
    db.delete(milestone)
    db.commit()
    return True


def get_milestone_progress(db: Session, project_id: int) -> Dict:
    """Get milestone progress for a project"""
    milestones = get_project_milestones(db, project_id)
    
    total = len(milestones)
    completed = sum(1 for m in milestones if m.is_completed)
    pending = total - completed
    
    # Count overdue milestones
    today = datetime.now().date()
    overdue = sum(1 for m in milestones if not m.is_completed and m.target_date < today)
    
    return {
        "total_milestones": total,
        "completed_milestones": completed,
        "pending_milestones": pending,
        "overdue_milestones": overdue,
        "progress_percentage": round((completed / total * 100) if total > 0 else 0, 1)
    }
