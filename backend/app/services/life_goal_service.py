"""
Service layer for Life Goals management
Handles business logic for goals, milestones, and task linking
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.goal import LifeGoal, LifeGoalMilestone, LifeGoalTaskLink, LifeGoalTask
from app.models.models import Task, TimeEntry
from typing import List, Optional, Dict
from datetime import date, datetime, timedelta
import json


def calculate_linked_task_completion(
    db: Session,
    task_link: LifeGoalTaskLink
) -> Dict:
    """
    Calculate completion statistics for a linked task
    Returns: dict with completion_count, expected_count, completion_percentage, recent_trend
    """
    if not task_link.link_start_date:
        return {
            "completion_count": 0,
            "expected_count": 0,
            "completion_percentage": 0.0,
            "recent_trend": 0.0,
            "days_tracked": 0,
            "last_completed": None
        }
    
    # Get the task
    task = db.query(Task).filter(Task.id == task_link.task_id).first()
    if not task:
        return {
            "completion_count": 0,
            "expected_count": 0,
            "completion_percentage": 0.0,
            "recent_trend": 0.0,
            "days_tracked": 0,
            "last_completed": None
        }
    
    # Calculate date range
    start_date = task_link.link_start_date
    end_date = date.today()
    days_tracked = (end_date - start_date).days + 1
    
    # Get time entries for this task within the date range
    time_entries = db.query(TimeEntry).filter(
        and_(
            TimeEntry.task_id == task_link.task_id,
            TimeEntry.entry_date >= start_date,
            TimeEntry.entry_date <= end_date
        )
    ).all()
    
    # Count unique days where task was completed
    completed_dates = set(entry.entry_date.date() for entry in time_entries if entry.entry_date)
    completion_count = len(completed_dates)
    
    # Calculate expected count based on frequency
    frequency = task_link.expected_frequency or 'daily'
    if frequency == 'daily':
        expected_count = days_tracked
    elif frequency == 'weekly':
        expected_count = days_tracked // 7
    elif frequency == 'monthly':
        # Approximate months
        expected_count = days_tracked // 30
    else:
        expected_count = days_tracked  # Default to daily
    
    # Calculate completion percentage
    completion_percentage = (completion_count / expected_count * 100) if expected_count > 0 else 0.0
    
    # Calculate recent trend (last 30 days)
    thirty_days_ago = end_date - timedelta(days=30)
    recent_start = max(start_date, thirty_days_ago)
    recent_days = (end_date - recent_start).days + 1
    
    recent_completed = sum(1 for d in completed_dates if d >= recent_start)
    
    if frequency == 'daily':
        recent_expected = recent_days
    elif frequency == 'weekly':
        recent_expected = recent_days // 7
    elif frequency == 'monthly':
        recent_expected = 1  # At most 1 in 30 days
    else:
        recent_expected = recent_days
    
    recent_trend = (recent_completed / recent_expected * 100) if recent_expected > 0 else 0.0
    
    # Find last completed date
    last_completed = max(completed_dates) if completed_dates else None
    
    return {
        "completion_count": completion_count,
        "expected_count": expected_count,
        "completion_percentage": round(completion_percentage, 1),
        "recent_trend": round(recent_trend, 1),
        "days_tracked": days_tracked,
        "last_completed": last_completed.isoformat() if last_completed else None
    }


def create_life_goal(
    db: Session,
    name: str,
    start_date: date,
    target_date: date,
    why_statements: List[str],
    parent_goal_id: Optional[int] = None,
    category: Optional[str] = None,
    priority: str = "medium",
    description: Optional[str] = None,
    pillar_id: Optional[int] = None,
    category_id: Optional[int] = None,
    sub_category_id: Optional[int] = None,
    linked_task_id: Optional[int] = None,
    related_wish_id: Optional[int] = None
) -> LifeGoal:
    """Create a new life goal"""
    goal = LifeGoal(
        name=name,
        parent_goal_id=parent_goal_id,
        start_date=start_date,
        target_date=target_date,
        category=category,
        priority=priority,
        why_statements=json.dumps(why_statements) if isinstance(why_statements, list) else why_statements,
        description=description,
        status='not_started',
        progress_percentage=0.0,
        created_at=date.today(),
        pillar_id=pillar_id,
        category_id=category_id,
        sub_category_id=sub_category_id,
        linked_task_id=linked_task_id,
        related_wish_id=related_wish_id
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def get_all_life_goals(db: Session, include_completed: bool = False) -> List[LifeGoal]:
    """Get all life goals, optionally including completed ones"""
    query = db.query(LifeGoal)
    if not include_completed:
        query = query.filter(LifeGoal.status != 'completed')
    return query.order_by(LifeGoal.created_at.desc()).all()


def get_life_goal_by_id(db: Session, goal_id: int) -> Optional[LifeGoal]:
    """Get a specific life goal by ID"""
    return db.query(LifeGoal).filter(LifeGoal.id == goal_id).first()


def get_root_goals(db: Session) -> List[LifeGoal]:
    """Get all root goals (no parent)"""
    return db.query(LifeGoal).filter(LifeGoal.parent_goal_id.is_(None)).all()


def get_sub_goals(db: Session, parent_goal_id: int) -> List[LifeGoal]:
    """Get all sub-goals of a parent goal"""
    return db.query(LifeGoal).filter(LifeGoal.parent_goal_id == parent_goal_id).all()


def update_life_goal(db: Session, goal_id: int, **kwargs) -> Optional[LifeGoal]:
    """Update a life goal"""
    goal = db.query(LifeGoal).filter(LifeGoal.id == goal_id).first()
    if not goal:
        return None
    
    for key, value in kwargs.items():
        if hasattr(goal, key):
            if key == 'why_statements' and isinstance(value, list):
                value = json.dumps(value)
            setattr(goal, key, value)
    
    goal.updated_at = date.today()
    db.commit()
    db.refresh(goal)
    return goal


def delete_life_goal(db: Session, goal_id: int) -> bool:
    """Delete a life goal and all its related data"""
    goal = db.query(LifeGoal).filter(LifeGoal.id == goal_id).first()
    if not goal:
        return False
    
    db.delete(goal)
    db.commit()
    return True


# Milestone functions
def create_milestone(
    db: Session,
    goal_id: int,
    name: str,
    target_date: date,
    start_date: Optional[date] = None,
    description: Optional[str] = None,
    metric: Optional[str] = None,
    order: int = 0
) -> LifeGoalMilestone:
    """Create a milestone for a goal"""
    milestone = LifeGoalMilestone(
        goal_id=goal_id,
        name=name,
        start_date=start_date,
        target_date=target_date,
        description=description,
        metric=metric,
        order=order,
        is_completed=False,
        created_at=date.today()
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    
    # Recalculate goal progress
    _recalculate_goal_progress(db, goal_id)
    
    return milestone

def get_milestones_by_goal(db: Session, goal_id: int) -> List[LifeGoalMilestone]:
    """Get all milestones for a goal"""
    return db.query(LifeGoalMilestone).filter(
        LifeGoalMilestone.goal_id == goal_id
    ).order_by(LifeGoalMilestone.order, LifeGoalMilestone.target_date).all()


def update_milestone(db: Session, milestone_id: int, **kwargs) -> Optional[LifeGoalMilestone]:
    """Update a milestone"""
    milestone = db.query(LifeGoalMilestone).filter(LifeGoalMilestone.id == milestone_id).first()
    if not milestone:
        return None
    
    for key, value in kwargs.items():
        if hasattr(milestone, key):
            setattr(milestone, key, value)
    
    # If marking as completed, set completion date
    if kwargs.get('is_completed') and not milestone.actual_completion_date:
        milestone.actual_completion_date = date.today()
    
    db.commit()
    db.refresh(milestone)
    
    # Recalculate goal progress
    _recalculate_goal_progress(db, milestone.goal_id)
    
    return milestone


def delete_milestone(db: Session, milestone_id: int) -> bool:
    """Delete a milestone"""
    milestone = db.query(LifeGoalMilestone).filter(LifeGoalMilestone.id == milestone_id).first()
    if not milestone:
        return False
    
    goal_id = milestone.goal_id
    db.delete(milestone)
    db.commit()
    
    # Recalculate goal progress
    _recalculate_goal_progress(db, goal_id)
    
    return True


# Task linking functions
def link_task_to_goal(
    db: Session,
    goal_id: int,
    task_id: int,
    task_type: str,
    time_allocated_hours: float = 0.0,
    notes: Optional[str] = None,
    link_start_date: Optional[date] = None,
    expected_frequency: Optional[str] = None
) -> LifeGoalTaskLink:
    """Link an existing task to a goal with tracking start date"""
    # Default link_start_date to today if not provided
    if link_start_date is None:
        link_start_date = date.today()
    
    link = LifeGoalTaskLink(
        goal_id=goal_id,
        task_id=task_id,
        task_type=task_type,
        time_allocated_hours=time_allocated_hours,
        notes=notes,
        link_start_date=link_start_date,
        expected_frequency=expected_frequency or task_type,  # Default to task_type
        created_at=date.today()
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    
    # Recalculate goal progress
    _recalculate_goal_progress(db, goal_id)
    
    return link


def get_linked_tasks(db: Session, goal_id: int) -> List[LifeGoalTaskLink]:
    """Get all tasks linked to a goal"""
    return db.query(LifeGoalTaskLink).filter(LifeGoalTaskLink.goal_id == goal_id).all()


def unlink_task_from_goal(db: Session, link_id: int) -> bool:
    """Remove a task link from a goal"""
    link = db.query(LifeGoalTaskLink).filter(LifeGoalTaskLink.id == link_id).first()
    if not link:
        return False
    
    goal_id = link.goal_id
    db.delete(link)
    db.commit()
    
    # Recalculate goal progress
    _recalculate_goal_progress(db, goal_id)
    
    return True


# Goal-specific task functions
def create_goal_task(
    db: Session,
    goal_id: int,
    name: str,
    description: Optional[str] = None,
    start_date: Optional[date] = None,
    due_date: Optional[date] = None,
    priority: str = "medium",
    task_type: str = "time",
    target_value: Optional[int] = None,
    unit: Optional[str] = None,
    allocated_minutes: Optional[int] = None,
    time_allocated_hours: float = 0.0,
    order: int = 0
) -> LifeGoalTask:
    """
    Create a task specific to a goal
    
    Supports three task types:
    - TIME: Track hours/minutes (allocated_minutes or time_allocated_hours)
    - COUNT: Track numbers (target_value + unit, e.g., "5 courses")
    - BOOLEAN: Yes/No completion (no additional params needed)
    """
    task = LifeGoalTask(
        goal_id=goal_id,
        name=name,
        description=description,
        start_date=start_date,
        due_date=due_date,
        priority=priority,
        task_type=task_type,
        target_value=target_value,
        current_value=0,
        unit=unit,
        allocated_minutes=allocated_minutes,
        time_allocated_hours=time_allocated_hours,
        order=order,
        is_completed=False,
        created_at=date.today()
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # Recalculate goal progress
    _recalculate_goal_progress(db, goal_id)
    
    return task


def get_goal_tasks(db: Session, goal_id: int) -> List[LifeGoalTask]:
    """Get all goal-specific tasks"""
    return db.query(LifeGoalTask).filter(
        LifeGoalTask.goal_id == goal_id
    ).order_by(LifeGoalTask.order, LifeGoalTask.created_at).all()


def update_goal_task(db: Session, task_id: int, **kwargs) -> Optional[LifeGoalTask]:
    """Update a goal-specific task"""
    task = db.query(LifeGoalTask).filter(LifeGoalTask.id == task_id).first()
    if not task:
        return None
    
    for key, value in kwargs.items():
        if hasattr(task, key):
            setattr(task, key, value)
    
    # If marking as completed, set completion date
    if kwargs.get('is_completed') and not task.completed_at:
        task.completed_at = date.today()
    
    task.updated_at = date.today()
    db.commit()
    db.refresh(task)
    
    # Recalculate goal progress
    _recalculate_goal_progress(db, task.goal_id)
    
    return task


def delete_goal_task(db: Session, task_id: int) -> bool:
    """Delete a goal-specific task"""
    task = db.query(LifeGoalTask).filter(LifeGoalTask.id == task_id).first()
    if not task:
        return False
    
    goal_id = task.goal_id
    db.delete(task)
    db.commit()
    
    # Recalculate goal progress
    _recalculate_goal_progress(db, goal_id)
    
    return True


# Progress calculation
def _recalculate_goal_progress(db: Session, goal_id: int):
    """Recalculate goal progress based on milestones, tasks, and project milestones"""
    goal = db.query(LifeGoal).filter(LifeGoal.id == goal_id).first()
    if not goal:
        return
    
    # Get goal milestones
    goal_milestones = db.query(LifeGoalMilestone).filter(LifeGoalMilestone.goal_id == goal_id).all()
    goal_milestone_progress = 0.0
    if goal_milestones:
        completed_milestones = sum(1 for m in goal_milestones if m.is_completed)
        goal_milestone_progress = (completed_milestones / len(goal_milestones)) * 100
    
    # Get project milestones from linked projects
    from app.models.models import Project, ProjectMilestone
    linked_projects = db.query(Project).filter(Project.goal_id == goal_id).all()
    project_milestones = []
    for project in linked_projects:
        milestones = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == project.id).all()
        project_milestones.extend(milestones)
    
    project_milestone_progress = 0.0
    if project_milestones:
        completed_project_milestones = sum(1 for m in project_milestones if m.is_completed)
        project_milestone_progress = (completed_project_milestones / len(project_milestones)) * 100
    
    # Get goal-specific tasks
    goal_tasks = db.query(LifeGoalTask).filter(LifeGoalTask.goal_id == goal_id).all()
    task_progress = 0.0
    if goal_tasks:
        completed_tasks = sum(1 for t in goal_tasks if t.is_completed)
        task_progress = (completed_tasks / len(goal_tasks)) * 100
    
    # Get project tasks from linked projects
    from app.models.models import ProjectTask
    project_tasks = []
    for project in linked_projects:
        tasks = db.query(ProjectTask).filter(ProjectTask.project_id == project.id).all()
        project_tasks.extend(tasks)
    
    project_task_progress = 0.0
    if project_tasks:
        completed_project_tasks = sum(1 for t in project_tasks if t.is_completed)
        project_task_progress = (completed_project_tasks / len(project_tasks)) * 100
    
    # Calculate weighted average (goal milestones = 30%, project milestones = 25%, goal tasks = 20%, project tasks = 25%)
    total_progress = 0.0
    weight_sum = 0.0
    
    if goal_milestones:
        total_progress += goal_milestone_progress * 0.3
        weight_sum += 0.3
    
    if project_milestones:
        total_progress += project_milestone_progress * 0.25
        weight_sum += 0.25
    
    if goal_tasks:
        total_progress += task_progress * 0.2
        weight_sum += 0.2
    
    if project_tasks:
        total_progress += project_task_progress * 0.25
        weight_sum += 0.25
    
    # Normalize to actual weights present
    if weight_sum > 0:
        total_progress = total_progress / weight_sum
    
    # Update goal progress
    goal.progress_percentage = round(total_progress, 2)
    
    # Update status based on progress and dates
    today = date.today()
    days_remaining = (goal.target_date - today).days if goal.target_date >= today else 0
    days_total = (goal.target_date - goal.start_date).days if goal.target_date >= goal.start_date else 1
    expected_progress = ((days_total - days_remaining) / days_total) * 100 if days_total > 0 else 0
    
    if goal.progress_percentage >= 100:
        goal.status = 'completed'
        if not goal.actual_completion_date:
            goal.actual_completion_date = today
    elif goal.progress_percentage == 0:
        # Check if any project has completed tasks or active work
        has_project_activity = False
        for project in linked_projects:
            project_task_count = db.query(ProjectTask).filter(ProjectTask.project_id == project.id).count()
            if project_task_count > 0:
                completed_count = db.query(ProjectTask).filter(
                    ProjectTask.project_id == project.id,
                    ProjectTask.is_completed == True
                ).count()
                if completed_count > 0:
                    has_project_activity = True
                    break
        
        # If there's project activity, consider it in progress, otherwise not started
        if has_project_activity:
            goal.status = 'on_track'
        else:
            goal.status = 'not_started'
    elif goal.progress_percentage >= expected_progress - 10:
        goal.status = 'on_track'
    elif goal.progress_percentage >= expected_progress - 25:
        goal.status = 'at_risk'
    else:
        goal.status = 'behind'
    
    goal.updated_at = today
    db.commit()


def calculate_goal_stats(db: Session, goal_id: int) -> Dict:
    """Calculate comprehensive stats for a goal"""
    goal = db.query(LifeGoal).filter(LifeGoal.id == goal_id).first()
    if not goal:
        return {}
    
    # Get goal milestones
    goal_milestones = db.query(LifeGoalMilestone).filter(LifeGoalMilestone.goal_id == goal_id).all()
    
    # Get project milestones from linked projects
    from app.models.models import Project, ProjectMilestone
    linked_projects = db.query(Project).filter(Project.goal_id == goal_id).all()
    project_milestones = []
    for project in linked_projects:
        milestones = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == project.id).all()
        project_milestones.extend(milestones)
    
    goal_tasks = db.query(LifeGoalTask).filter(LifeGoalTask.goal_id == goal_id).all()
    linked_tasks = db.query(LifeGoalTaskLink).filter(LifeGoalTaskLink.goal_id == goal_id).all()
    
    # Get all project tasks (including subtasks) from linked projects
    from app.models.models import Project, ProjectTask
    linked_projects = db.query(Project).filter(Project.goal_id == goal_id).all()
    
    def count_project_tasks_recursive(project_id):
        """Count all tasks and subtasks in a project"""
        all_tasks = db.query(ProjectTask).filter(ProjectTask.project_id == project_id).all()
        total = len(all_tasks)
        completed = sum(1 for t in all_tasks if t.is_completed)
        return total, completed
    
    total_project_tasks = 0
    completed_project_tasks = 0
    for project in linked_projects:
        total, completed = count_project_tasks_recursive(project.id)
        total_project_tasks += total
        completed_project_tasks += completed
    
    today = date.today()
    days_remaining = (goal.target_date - today).days if goal.target_date >= today else 0
    days_total = (goal.target_date - goal.start_date).days if goal.target_date >= goal.start_date else 1
    days_elapsed = days_total - days_remaining
    
    return {
        "goal_id": goal_id,
        "progress_percentage": goal.progress_percentage,
        "status": goal.status,
        "days_remaining": days_remaining,
        "days_elapsed": days_elapsed,
        "days_total": days_total,
        "milestones": {
            "goal_milestones": {
                "total": len(goal_milestones),
                "completed": sum(1 for m in goal_milestones if m.is_completed),
                "remaining": sum(1 for m in goal_milestones if not m.is_completed)
            },
            "project_milestones": {
                "total": len(project_milestones),
                "completed": sum(1 for m in project_milestones if m.is_completed),
                "remaining": sum(1 for m in project_milestones if not m.is_completed)
            },
            "total": len(goal_milestones) + len(project_milestones),
            "completed": sum(1 for m in goal_milestones if m.is_completed) + sum(1 for m in project_milestones if m.is_completed),
            "remaining": sum(1 for m in goal_milestones if not m.is_completed) + sum(1 for m in project_milestones if not m.is_completed)
        },
        "goal_tasks": {
            "total": len(goal_tasks),
            "completed": sum(1 for t in goal_tasks if t.is_completed),
            "remaining": sum(1 for t in goal_tasks if not t.is_completed)
        },
        "project_tasks": {
            "total": total_project_tasks,
            "completed": completed_project_tasks,
            "remaining": total_project_tasks - completed_project_tasks
        },
        "all_tasks": {
            "total": len(goal_tasks) + total_project_tasks,
            "completed": sum(1 for t in goal_tasks if t.is_completed) + completed_project_tasks,
            "remaining": len(goal_tasks) - sum(1 for t in goal_tasks if t.is_completed) + (total_project_tasks - completed_project_tasks)
        },
        "linked_tasks": {
            "total": len(linked_tasks)
        },
        "time": {
            "allocated_hours": goal.time_allocated_hours,
            "spent_hours": goal.time_spent_hours,
            "remaining_hours": goal.time_allocated_hours - goal.time_spent_hours
        }
    }


def get_goal_projects(db: Session, goal_id: int) -> List[Dict]:
    """Get all projects linked to a goal with progress information"""
    from app.models.models import Project, ProjectTask
    
    projects = db.query(Project).filter(Project.goal_id == goal_id).all()
    
    result = []
    for project in projects:
        # Calculate project completion
        total_tasks = len(project.tasks)
        completed_tasks = sum(1 for task in project.tasks if task.is_completed)
        completion_percentage = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        result.append({
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "start_date": project.start_date.isoformat() if project.start_date else None,
            "target_completion_date": project.target_completion_date.isoformat() if project.target_completion_date else None,
            "is_completed": project.is_completed,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "completion_percentage": round(completion_percentage, 1),
            "pillar_name": project.pillar.name if project.pillar else None,
            "category_name": project.category.name if project.category else None
        })
    
    return result
