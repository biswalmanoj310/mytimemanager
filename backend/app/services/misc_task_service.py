"""
Service layer for Misc Tasks and Misc Task Items operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict
from app.models.models import MiscTaskGroup, MiscTaskItem


# ============ Misc Task Group CRUD Operations ============

def get_all_misc_task_groups(db: Session, include_completed: bool = True) -> List[MiscTaskGroup]:
    """Get all misc task groups"""
    query = db.query(MiscTaskGroup)
    if not include_completed:
        query = query.filter(MiscTaskGroup.is_completed == False)
    return query.order_by(MiscTaskGroup.created_at.desc()).all()


def get_misc_task_group_by_id(db: Session, group_id: int) -> Optional[MiscTaskGroup]:
    """Get misc task group by ID"""
    return db.query(MiscTaskGroup).filter(MiscTaskGroup.id == group_id).first()


def create_misc_task_group(db: Session, data: Dict) -> MiscTaskGroup:
    """Create a new misc task group"""
    # Convert due_date if provided
    if 'due_date' in data and data['due_date']:
        if isinstance(data['due_date'], date) and not isinstance(data['due_date'], datetime):
            data['due_date'] = datetime.combine(data['due_date'], datetime.min.time())
    
    group = MiscTaskGroup(**data)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def update_misc_task_group(db: Session, group_id: int, data: Dict) -> Optional[MiscTaskGroup]:
    """Update a misc task group"""
    group = get_misc_task_group_by_id(db, group_id)
    if not group:
        return None
    
    for key, value in data.items():
        if hasattr(group, key):
            # Convert dates to datetime
            if key == 'due_date' and value and isinstance(value, date):
                value = datetime.combine(value, datetime.min.time())
            setattr(group, key, value)
    
    group.updated_at = datetime.now()
    db.commit()
    db.refresh(group)
    return group


def delete_misc_task_group(db: Session, group_id: int) -> bool:
    """Delete a misc task group and all its tasks"""
    group = get_misc_task_group_by_id(db, group_id)
    if group:
        db.delete(group)
        db.commit()
        return True
    return False


def get_misc_task_group_progress(db: Session, group_id: int) -> Dict:
    """Calculate misc task group progress"""
    tasks = db.query(MiscTaskItem).filter(
        MiscTaskItem.group_id == group_id
    ).all()
    
    total_tasks = len(tasks)
    completed_tasks = sum(1 for task in tasks if task.is_completed)
    
    progress_percentage = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "progress_percentage": round(progress_percentage, 1)
    }


# ============ Misc Task Item CRUD Operations ============

def get_misc_task_items(db: Session, group_id: int) -> List[MiscTaskItem]:
    """Get all tasks for a misc task group"""
    return db.query(MiscTaskItem).filter(
        MiscTaskItem.group_id == group_id
    ).order_by(MiscTaskItem.order, MiscTaskItem.created_at).all()


def get_misc_task_item_by_id(db: Session, task_id: int) -> Optional[MiscTaskItem]:
    """Get misc task item by ID"""
    return db.query(MiscTaskItem).filter(MiscTaskItem.id == task_id).first()


def create_misc_task_item(db: Session, group_id: int, data: Dict) -> MiscTaskItem:
    """Create a new misc task item"""
    # Convert due_date if provided
    if 'due_date' in data and data['due_date']:
        if isinstance(data['due_date'], date) and not isinstance(data['due_date'], datetime):
            data['due_date'] = datetime.combine(data['due_date'], datetime.min.time())
    
    task = MiscTaskItem(group_id=group_id, **data)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_misc_task_item(db: Session, task_id: int, data: Dict) -> Optional[MiscTaskItem]:
    """Update a misc task item"""
    task = get_misc_task_item_by_id(db, task_id)
    if not task:
        return None
    
    for key, value in data.items():
        if hasattr(task, key):
            # Convert dates to datetime
            if key == 'due_date' and value and isinstance(value, date):
                value = datetime.combine(value, datetime.min.time())
            # Handle completion
            if key == 'is_completed' and value and not task.is_completed:
                task.completed_at = datetime.now()
            setattr(task, key, value)
    
    task.updated_at = datetime.now()
    db.commit()
    db.refresh(task)
    return task


def delete_misc_task_item(db: Session, task_id: int) -> bool:
    """Delete a misc task item"""
    task = get_misc_task_item_by_id(db, task_id)
    if task:
        db.delete(task)
        db.commit()
        return True
    return False


# ============ Query Operations ============

def get_misc_tasks_due_today(db: Session) -> List[MiscTaskItem]:
    """Get all misc task items due today"""
    today = datetime.now().date()
    start_of_day = datetime.combine(today, datetime.min.time())
    end_of_day = datetime.combine(today, datetime.max.time())
    
    return db.query(MiscTaskItem).filter(
        and_(
            MiscTaskItem.due_date >= start_of_day,
            MiscTaskItem.due_date <= end_of_day,
            MiscTaskItem.is_completed == False
        )
    ).all()


def get_overdue_misc_tasks(db: Session) -> List[MiscTaskItem]:
    """Get all overdue misc task items"""
    now = datetime.now()
    
    return db.query(MiscTaskItem).filter(
        and_(
            MiscTaskItem.due_date < now,
            MiscTaskItem.is_completed == False
        )
    ).order_by(MiscTaskItem.due_date).all()


def get_misc_task_hierarchy(db: Session, group_id: int) -> List[Dict]:
    """Get hierarchical structure of tasks for a misc task group"""
    all_tasks = get_misc_task_items(db, group_id)
    
    # Build a dictionary of tasks by ID
    tasks_dict = {task.id: task for task in all_tasks}
    
    # Build hierarchy
    root_tasks = []
    for task in all_tasks:
        if task.parent_task_id is None:
            root_tasks.append(task)
    
    return root_tasks
