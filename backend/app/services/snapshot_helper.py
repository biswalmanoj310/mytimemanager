"""
Snapshot Helper Service
Provides reusable functions for populating snapshot data in time entries
Prevents code duplication across all time entry services
"""

from sqlalchemy.orm import Session
from app.models.models import Task
from typing import Dict, Optional


class SnapshotHelper:
    """Helper class for managing snapshot data in time entries"""
    
    @staticmethod
    def get_task_snapshots(db: Session, task_id: int) -> Dict[str, Optional[str]]:
        """
        Get snapshot data for a task (name, pillar, category)
        Returns a dictionary with snapshot column values
        
        Args:
            db: Database session
            task_id: ID of the task
            
        Returns:
            Dictionary with snapshot field names and values
        """
        task = db.query(Task).filter(Task.id == task_id).first()
        
        if not task:
            return {
                'task_name_snapshot': None,
                'pillar_id_snapshot': None,
                'pillar_name_snapshot': None,
                'category_id_snapshot': None,
                'category_name_snapshot': None
            }
        
        return {
            'task_name_snapshot': task.name,
            'pillar_id_snapshot': task.pillar_id,
            'pillar_name_snapshot': task.pillar.name if task.pillar else None,
            'category_id_snapshot': task.category_id,
            'category_name_snapshot': task.category.name if task.category else None
        }
    
    @staticmethod
    def add_snapshots_to_entry(entry_dict: Dict, db: Session, task_id: int) -> Dict:
        """
        Add snapshot fields to an entry dictionary before creating database object
        
        Args:
            entry_dict: Dictionary with entry fields
            db: Database session
            task_id: ID of the task
            
        Returns:
            Updated dictionary with snapshot fields added
        """
        snapshots = SnapshotHelper.get_task_snapshots(db, task_id)
        entry_dict.update(snapshots)
        return entry_dict
