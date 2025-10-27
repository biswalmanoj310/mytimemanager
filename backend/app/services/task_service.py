"""
Task Service - Business logic for task management
Handles task CRUD operations with validation
"""

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

from app.models.models import Task, Pillar, Category, SubCategory, Goal
from app.models.schemas import TaskCreate, TaskUpdate, TaskFilters


class TaskService:
    """Service for task management operations"""

    @staticmethod
    def create_task(db: Session, task_data: TaskCreate) -> Task:
        """
        Create a new task with validation
        
        Args:
            db: Database session
            task_data: Task creation data
            
        Returns:
            Created Task object
            
        Raises:
            ValueError: If validation fails
        """
        # Validate pillar exists
        pillar = db.query(Pillar).filter(Pillar.id == task_data.pillar_id).first()
        if not pillar:
            raise ValueError(f"Pillar with id {task_data.pillar_id} not found")
        
        # Validate category exists and belongs to pillar
        category = db.query(Category).filter(Category.id == task_data.category_id).first()
        if not category:
            raise ValueError(f"Category with id {task_data.category_id} not found")
        if category.pillar_id != task_data.pillar_id:
            raise ValueError(f"Category {category.name} does not belong to pillar {pillar.name}")
        
        # Validate sub-category if provided
        if task_data.sub_category_id:
            sub_category = db.query(SubCategory).filter(
                SubCategory.id == task_data.sub_category_id
            ).first()
            if not sub_category:
                raise ValueError(f"Sub-category with id {task_data.sub_category_id} not found")
            if sub_category.category_id != task_data.category_id:
                raise ValueError(
                    f"Sub-category {sub_category.name} does not belong to category {category.name}"
                )
        
        # Validate goal if provided
        if task_data.goal_id:
            goal = db.query(Goal).filter(Goal.id == task_data.goal_id).first()
            if not goal:
                raise ValueError(f"Goal with id {task_data.goal_id} not found")
            
            # Ensure goal belongs to the same hierarchy
            if goal.pillar_id != task_data.pillar_id:
                raise ValueError(f"Goal does not belong to the same pillar")
            if goal.category_id != task_data.category_id:
                raise ValueError(f"Goal does not belong to the same category")
        
        # Convert additional_whys list to JSON string for storage
        additional_whys_json = None
        if task_data.additional_whys:
            additional_whys_json = json.dumps(task_data.additional_whys)
        
        # Create task
        db_task = Task(
            name=task_data.name,
            description=task_data.description,
            pillar_id=task_data.pillar_id,
            category_id=task_data.category_id,
            sub_category_id=task_data.sub_category_id,
            task_type=task_data.task_type,
            allocated_minutes=task_data.allocated_minutes,
            target_value=task_data.target_value,
            unit=task_data.unit,
            follow_up_frequency=task_data.follow_up_frequency,
            separately_followed=task_data.separately_followed,
            goal_id=task_data.goal_id,
            is_part_of_goal=task_data.is_part_of_goal,
            why_reason=task_data.why_reason,
            additional_whys=additional_whys_json,
            due_date=task_data.due_date
        )
        
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
        
        return db_task

    @staticmethod
    def get_task(db: Session, task_id: int) -> Optional[Task]:
        """Get a task by ID with all relationships loaded"""
        return db.query(Task).options(
            joinedload(Task.pillar),
            joinedload(Task.category),
            joinedload(Task.sub_category),
            joinedload(Task.goal)
        ).filter(Task.id == task_id).first()

    @staticmethod
    def get_tasks(
        db: Session,
        filters: Optional[TaskFilters] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Task]:
        """
        Get all tasks with optional filtering
        
        Args:
            db: Database session
            filters: Optional filters for tasks
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of Task objects
        """
        query = db.query(Task).options(
            joinedload(Task.pillar),
            joinedload(Task.category),
            joinedload(Task.sub_category),
            joinedload(Task.goal)
        )
        
        if filters:
            if filters.pillar_id is not None:
                query = query.filter(Task.pillar_id == filters.pillar_id)
            if filters.category_id is not None:
                query = query.filter(Task.category_id == filters.category_id)
            if filters.sub_category_id is not None:
                query = query.filter(Task.sub_category_id == filters.sub_category_id)
            if filters.goal_id is not None:
                query = query.filter(Task.goal_id == filters.goal_id)
            if filters.follow_up_frequency is not None:
                query = query.filter(Task.follow_up_frequency == filters.follow_up_frequency)
            if filters.is_active is not None:
                query = query.filter(Task.is_active == filters.is_active)
            if filters.is_completed is not None:
                query = query.filter(Task.is_completed == filters.is_completed)
            if filters.is_part_of_goal is not None:
                query = query.filter(Task.is_part_of_goal == filters.is_part_of_goal)
        
        return query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def update_task(db: Session, task_id: int, task_data: TaskUpdate) -> Task:
        """
        Update an existing task
        
        Args:
            db: Database session
            task_id: ID of task to update
            task_data: Updated task data
            
        Returns:
            Updated Task object
            
        Raises:
            ValueError: If task not found or validation fails
        """
        db_task = db.query(Task).filter(Task.id == task_id).first()
        if not db_task:
            raise ValueError(f"Task with id {task_id} not found")
        
        # Validate pillar if changed
        if task_data.pillar_id is not None and task_data.pillar_id != db_task.pillar_id:
            pillar = db.query(Pillar).filter(Pillar.id == task_data.pillar_id).first()
            if not pillar:
                raise ValueError(f"Pillar with id {task_data.pillar_id} not found")
        
        # Validate category if changed
        if task_data.category_id is not None and task_data.category_id != db_task.category_id:
            category = db.query(Category).filter(Category.id == task_data.category_id).first()
            if not category:
                raise ValueError(f"Category with id {task_data.category_id} not found")
            
            # Check category belongs to pillar
            pillar_id = task_data.pillar_id if task_data.pillar_id is not None else db_task.pillar_id
            if category.pillar_id != pillar_id:
                raise ValueError(f"Category does not belong to the specified pillar")
        
        # Validate sub-category if changed
        if task_data.sub_category_id is not None and task_data.sub_category_id != db_task.sub_category_id:
            sub_category = db.query(SubCategory).filter(
                SubCategory.id == task_data.sub_category_id
            ).first()
            if not sub_category:
                raise ValueError(f"Sub-category with id {task_data.sub_category_id} not found")
            
            # Check sub-category belongs to category
            category_id = task_data.category_id if task_data.category_id is not None else db_task.category_id
            if sub_category.category_id != category_id:
                raise ValueError(f"Sub-category does not belong to the specified category")
        
        # Validate goal if changed
        if task_data.goal_id is not None and task_data.goal_id != db_task.goal_id:
            goal = db.query(Goal).filter(Goal.id == task_data.goal_id).first()
            if not goal:
                raise ValueError(f"Goal with id {task_data.goal_id} not found")
            
            # Ensure goal belongs to the same hierarchy
            pillar_id = task_data.pillar_id if task_data.pillar_id is not None else db_task.pillar_id
            category_id = task_data.category_id if task_data.category_id is not None else db_task.category_id
            
            if goal.pillar_id != pillar_id:
                raise ValueError(f"Goal does not belong to the same pillar")
            if goal.category_id != category_id:
                raise ValueError(f"Goal does not belong to the same category")
        
        # Update fields
        update_data = task_data.model_dump(exclude_unset=True)
        
        # Handle additional_whys conversion to JSON
        if 'additional_whys' in update_data and update_data['additional_whys'] is not None:
            update_data['additional_whys'] = json.dumps(update_data['additional_whys'])
        
        # Handle completion
        if task_data.is_completed is not None and task_data.is_completed and not db_task.is_completed:
            # Store current date at midnight to avoid timezone comparison issues
            now = datetime.now()
            update_data['completed_at'] = datetime(now.year, now.month, now.day)
        
        # Handle NA marking - set timestamp when task is marked as inactive
        if task_data.is_active is not None and not task_data.is_active and db_task.is_active:
            # Store current date at midnight to avoid timezone comparison issues
            now = datetime.now()
            update_data['na_marked_at'] = datetime(now.year, now.month, now.day)
        
        # If task is reactivated, clear the NA timestamp
        if task_data.is_active is not None and task_data.is_active and not db_task.is_active:
            update_data['na_marked_at'] = None
        
        for key, value in update_data.items():
            setattr(db_task, key, value)
        
        db.commit()
        db.refresh(db_task)
        
        return db_task

    @staticmethod
    def delete_task(db: Session, task_id: int) -> bool:
        """
        Delete a task
        
        Args:
            db: Database session
            task_id: ID of task to delete
            
        Returns:
            True if deleted, False if not found
        """
        db_task = db.query(Task).filter(Task.id == task_id).first()
        if not db_task:
            return False
        
        db.delete(db_task)
        db.commit()
        return True

    @staticmethod
    def get_task_with_stats(db: Session, task_id: int) -> Optional[Dict[str, Any]]:
        """
        Get a task with detailed statistics
        
        Args:
            db: Database session
            task_id: ID of the task
            
        Returns:
            Dictionary with task data and statistics
        """
        task = TaskService.get_task(db, task_id)
        if not task:
            return None
        
        # Calculate completion percentage
        completion_percentage = 0.0
        if task.allocated_minutes > 0:
            completion_percentage = (task.spent_minutes / task.allocated_minutes) * 100
            completion_percentage = min(completion_percentage, 100.0)
        
        # Parse additional_whys from JSON
        additional_whys = []
        if task.additional_whys:
            try:
                additional_whys = json.loads(task.additional_whys)
            except json.JSONDecodeError:
                additional_whys = []
        
        # Count time entries
        from app.models.models import TimeEntry
        time_entries_count = db.query(TimeEntry).filter(TimeEntry.task_id == task_id).count()
        
        return {
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "pillar_id": task.pillar_id,
            "pillar_name": task.pillar.name if task.pillar else None,
            "category_id": task.category_id,
            "category_name": task.category.name if task.category else None,
            "sub_category_id": task.sub_category_id,
            "sub_category_name": task.sub_category.name if task.sub_category else None,
            "allocated_minutes": task.allocated_minutes,
            "spent_minutes": task.spent_minutes,
            "follow_up_frequency": task.follow_up_frequency,
            "separately_followed": task.separately_followed,
            "goal_id": task.goal_id,
            "goal_name": task.goal.name if task.goal else None,
            "is_part_of_goal": task.is_part_of_goal,
            "why_reason": task.why_reason,
            "additional_whys": additional_whys,
            "due_date": task.due_date,
            "is_active": task.is_active,
            "is_completed": task.is_completed,
            "completed_at": task.completed_at,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
            "completion_percentage": completion_percentage,
            "time_entries_count": time_entries_count
        }

    @staticmethod
    def mark_task_completed(db: Session, task_id: int) -> Task:
        """
        Mark a task as completed
        
        Args:
            db: Database session
            task_id: ID of task to mark as completed
            
        Returns:
            Updated Task object
            
        Raises:
            ValueError: If task not found
        """
        db_task = db.query(Task).filter(Task.id == task_id).first()
        if not db_task:
            raise ValueError(f"Task with id {task_id} not found")
        
        db_task.is_completed = True
        # Store current date at midnight to avoid timezone comparison issues
        now = datetime.now()
        db_task.completed_at = datetime(now.year, now.month, now.day)
        
        db.commit()
        db.refresh(db_task)
        
        return db_task
