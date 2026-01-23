"""
Soft Delete Service for Tasks
Implements safe task deletion that preserves historical data integrity
Instead of hard deleting tasks, marks them as deleted with timestamp
"""

from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from app.models.models import Task


class TaskDeletionService:
    """Service for safely deleting/archiving tasks"""
    
    @staticmethod
    def soft_delete_task(db: Session, task_id: int) -> Optional[Task]:
        """
        Soft delete a task - marks as inactive and sets deleted_at timestamp
        Historical time entries remain intact with their snapshot data
        
        Args:
            db: Database session
            task_id: ID of task to delete
            
        Returns:
            Updated task or None if not found
        """
        task = db.query(Task).filter(Task.id == task_id).first()
        
        if not task:
            return None
        
        # Mark as inactive and set deletion timestamp
        task.is_active = False
        task.deleted_at = datetime.now()
        task.updated_at = datetime.now()
        
        db.commit()
        db.refresh(task)
        
        return task
    
    @staticmethod
    def restore_task(db: Session, task_id: int) -> Optional[Task]:
        """
        Restore a soft-deleted task
        
        Args:
            db: Database session
            task_id: ID of task to restore
            
        Returns:
            Restored task or None if not found
        """
        task = db.query(Task).filter(Task.id == task_id).first()
        
        if not task:
            return None
        
        # Restore task
        task.is_active = True
        task.deleted_at = None
        task.updated_at = datetime.now()
        
        db.commit()
        db.refresh(task)
        
        return task
    
    @staticmethod
    def permanently_delete_task(db: Session, task_id: int) -> bool:
        """
        PERMANENTLY delete a task and all associated data
        WARNING: This is irreversible! Use with extreme caution!
        Only use this for cleaning up test data or correcting mistakes
        
        Args:
            db: Database session
            task_id: ID of task to permanently delete
            
        Returns:
            True if deleted, False if not found
        """
        task = db.query(Task).filter(Task.id == task_id).first()
        
        if not task:
            return False
        
        # CASCADE DELETE will remove:
        # - daily_time_entries
        # - weekly_time_entries  
        # - monthly_time_entries
        # - yearly_time_entries
        # - weekly_task_status
        # - monthly_task_status
        # - yearly_task_status
        # - daily_task_status (if exists)
        
        db.delete(task)
        db.commit()
        
        return True
    
    @staticmethod
    def get_deleted_tasks(db: Session, include_completed: bool = False):
        """
        Get all soft-deleted tasks
        
        Args:
            db: Database session
            include_completed: Whether to include completed tasks
            
        Returns:
            List of deleted tasks
        """
        query = db.query(Task).filter(
            Task.is_active == False,
            Task.deleted_at.isnot(None)
        )
        
        if not include_completed:
            query = query.filter(Task.is_completed == False)
        
        return query.order_by(Task.deleted_at.desc()).all()
