"""
Service layer for Goal Projects - tracking dashboards for monitoring task performance within goals
"""
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.goal import GoalProject, GoalProjectTaskLink
from app.models.models import Task, DailyTimeEntry


def create_goal_project(
    db: Session,
    goal_id: int,
    name: str,
    description: Optional[str] = None
) -> GoalProject:
    """Create a new goal project"""
    goal_project = GoalProject(
        goal_id=goal_id,
        name=name,
        description=description
    )
    db.add(goal_project)
    db.commit()
    db.refresh(goal_project)
    return goal_project


def update_goal_project(
    db: Session,
    project_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None
) -> Optional[GoalProject]:
    """Update a goal project"""
    project = db.query(GoalProject).filter(GoalProject.id == project_id).first()
    if not project:
        return None
    
    if name is not None:
        project.name = name
    if description is not None:
        project.description = description
    
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return project


def delete_goal_project(db: Session, project_id: int) -> bool:
    """Delete a goal project and all its task links"""
    project = db.query(GoalProject).filter(GoalProject.id == project_id).first()
    if not project:
        return False
    
    db.delete(project)
    db.commit()
    return True


def add_task_to_project(
    db: Session,
    goal_project_id: int,
    task_id: int,
    task_type: str,
    track_start_date: date,
    track_end_date: date,
    expected_frequency_value: int,
    expected_frequency_unit: str,
    notes: Optional[str] = None
) -> GoalProjectTaskLink:
    """Link a task to a goal project with tracking parameters"""
    task_link = GoalProjectTaskLink(
        goal_project_id=goal_project_id,
        task_id=task_id,
        task_type=task_type,
        track_start_date=track_start_date,
        track_end_date=track_end_date,
        expected_frequency_value=expected_frequency_value,
        expected_frequency_unit=expected_frequency_unit,
        notes=notes,
        is_active=True
    )
    db.add(task_link)
    db.commit()
    db.refresh(task_link)
    return task_link


def update_task_link(
    db: Session,
    link_id: int,
    track_start_date: Optional[date] = None,
    track_end_date: Optional[date] = None,
    expected_frequency_value: Optional[int] = None,
    expected_frequency_unit: Optional[str] = None,
    is_active: Optional[bool] = None,
    notes: Optional[str] = None
) -> Optional[GoalProjectTaskLink]:
    """Update a task link"""
    link = db.query(GoalProjectTaskLink).filter(GoalProjectTaskLink.id == link_id).first()
    if not link:
        return None
    
    if track_start_date is not None:
        link.track_start_date = track_start_date
    if track_end_date is not None:
        link.track_end_date = track_end_date
    if expected_frequency_value is not None:
        link.expected_frequency_value = expected_frequency_value
    if expected_frequency_unit is not None:
        link.expected_frequency_unit = expected_frequency_unit
    if is_active is not None:
        link.is_active = is_active
    if notes is not None:
        link.notes = notes
    
    db.commit()
    db.refresh(link)
    return link


def remove_task_from_project(db: Session, link_id: int) -> bool:
    """Remove a task link from a goal project"""
    link = db.query(GoalProjectTaskLink).filter(GoalProjectTaskLink.id == link_id).first()
    if not link:
        return False
    
    db.delete(link)
    db.commit()
    return True


def calculate_task_performance(db: Session, task_link: GoalProjectTaskLink) -> Dict:
    """
    Calculate task performance based on actual completions vs expected frequency
    
    Returns:
        {
            'actual_count': int,
            'expected_count': int,
            'completion_percentage': float,
            'status': 'green' | 'yellow' | 'red',
            'completion_dates': List[date]
        }
    """
    # Get task completions within the tracking period
    time_entries = db.query(DailyTimeEntry).filter(
        and_(
            DailyTimeEntry.task_id == task_link.task_id,
            DailyTimeEntry.entry_date >= task_link.track_start_date,
            DailyTimeEntry.entry_date <= task_link.track_end_date,
            DailyTimeEntry.completed == True
        )
    ).all()
    
    actual_count = len(time_entries)
    completion_dates = [entry.entry_date for entry in time_entries]
    
    # Calculate expected count based on frequency unit
    days_in_period = (task_link.track_end_date - task_link.track_start_date).days + 1
    
    if task_link.expected_frequency_unit == 'per_day':
        expected_count = task_link.expected_frequency_value * days_in_period
    elif task_link.expected_frequency_unit == 'per_week':
        weeks_in_period = days_in_period / 7.0
        expected_count = int(task_link.expected_frequency_value * weeks_in_period)
    elif task_link.expected_frequency_unit == 'per_month':
        months_in_period = days_in_period / 30.0
        expected_count = int(task_link.expected_frequency_value * months_in_period)
    else:
        expected_count = 0
    
    # Calculate percentage
    if expected_count > 0:
        completion_percentage = (actual_count / expected_count) * 100
    else:
        completion_percentage = 0
    
    # Determine status
    if completion_percentage >= 80:
        status = 'green'
    elif completion_percentage >= 60:
        status = 'yellow'
    else:
        status = 'red'
    
    return {
        'actual_count': actual_count,
        'expected_count': expected_count,
        'completion_percentage': round(completion_percentage, 1),
        'status': status,
        'completion_dates': completion_dates
    }


def calculate_project_health(db: Session, project_id: int) -> Dict:
    """
    Calculate overall project health based on all linked tasks
    
    Returns:
        {
            'status': 'green' | 'yellow' | 'red',
            'task_performances': List[Dict],
            'overall_percentage': float
        }
    """
    project = db.query(GoalProject).filter(GoalProject.id == project_id).first()
    if not project:
        return {
            'status': 'red',
            'task_performances': [],
            'overall_percentage': 0
        }
    
    task_performances = []
    total_percentage = 0
    worst_status = 'green'
    
    for task_link in project.task_links:
        if not task_link.is_active:
            continue
        
        performance = calculate_task_performance(db, task_link)
        task_performances.append({
            'task_link_id': task_link.id,
            'task_id': task_link.task_id,
            'task_name': task_link.task.name if task_link.task else 'Unknown',
            'task_type': task_link.task_type,
            **performance
        })
        
        total_percentage += performance['completion_percentage']
        
        # Determine worst status (red > yellow > green)
        if performance['status'] == 'red':
            worst_status = 'red'
        elif performance['status'] == 'yellow' and worst_status != 'red':
            worst_status = 'yellow'
    
    overall_percentage = total_percentage / len(task_performances) if task_performances else 0
    
    return {
        'status': worst_status,
        'task_performances': task_performances,
        'overall_percentage': round(overall_percentage, 1)
    }


def get_project_with_stats(db: Session, project_id: int) -> Optional[Dict]:
    """Get goal project with full performance statistics"""
    project = db.query(GoalProject).filter(GoalProject.id == project_id).first()
    if not project:
        return None
    
    health = calculate_project_health(db, project_id)
    
    return {
        'id': project.id,
        'goal_id': project.goal_id,
        'name': project.name,
        'description': project.description,
        'created_at': project.created_at,
        'updated_at': project.updated_at,
        'status': health['status'],
        'overall_percentage': health['overall_percentage'],
        'task_performances': health['task_performances']
    }


def get_projects_for_goal(db: Session, goal_id: int) -> List[Dict]:
    """Get all goal projects for a specific goal with stats"""
    projects = db.query(GoalProject).filter(GoalProject.goal_id == goal_id).all()
    
    projects_with_stats = []
    for project in projects:
        project_data = get_project_with_stats(db, project.id)
        if project_data:
            projects_with_stats.append(project_data)
    
    return projects_with_stats


def get_projects_for_task(db: Session, task_id: int) -> List[Dict]:
    """Get all goal projects that include a specific task (for Tasks page display)"""
    task_links = db.query(GoalProjectTaskLink).filter(
        GoalProjectTaskLink.task_id == task_id
    ).all()
    
    projects = []
    for link in task_links:
        project = link.goal_project
        if project:
            performance = calculate_task_performance(db, link)
            projects.append({
                'id': project.id,
                'goal_id': project.goal_id,
                'goal_name': project.goal.name if project.goal else 'Unknown',
                'project_name': project.name,
                'track_start_date': link.track_start_date,
                'track_end_date': link.track_end_date,
                'expected_frequency_value': link.expected_frequency_value,
                'expected_frequency_unit': link.expected_frequency_unit,
                **performance
            })
    
    return projects
