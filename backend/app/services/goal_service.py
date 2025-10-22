"""
Goal Service - Business logic for goal management
Handles goal CRUD operations with time-based tracking
"""

from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.models.models import Goal, Pillar, Category, SubCategory, Task
from app.models.schemas import GoalCreate, GoalUpdate, GoalFilters


class GoalService:
    """Service for goal management operations"""

    @staticmethod
    def create_goal(db: Session, goal_data: GoalCreate) -> Goal:
        """
        Create a new goal with validation
        
        Args:
            db: Database session
            goal_data: Goal creation data
            
        Returns:
            Created Goal object
            
        Raises:
            ValueError: If validation fails
        """
        # Validate pillar exists
        pillar = db.query(Pillar).filter(Pillar.id == goal_data.pillar_id).first()
        if not pillar:
            raise ValueError(f"Pillar with id {goal_data.pillar_id} not found")
        
        # Validate category exists and belongs to pillar
        category = db.query(Category).filter(Category.id == goal_data.category_id).first()
        if not category:
            raise ValueError(f"Category with id {goal_data.category_id} not found")
        if category.pillar_id != goal_data.pillar_id:
            raise ValueError(f"Category {category.name} does not belong to pillar {pillar.name}")
        
        # Validate sub-category if provided
        if goal_data.sub_category_id:
            sub_category = db.query(SubCategory).filter(
                SubCategory.id == goal_data.sub_category_id
            ).first()
            if not sub_category:
                raise ValueError(f"Sub-category with id {goal_data.sub_category_id} not found")
            if sub_category.category_id != goal_data.category_id:
                raise ValueError(
                    f"Sub-category {sub_category.name} does not belong to category {category.name}"
                )
        
        # Create goal
        db_goal = Goal(
            name=goal_data.name,
            description=goal_data.description,
            pillar_id=goal_data.pillar_id,
            category_id=goal_data.category_id,
            sub_category_id=goal_data.sub_category_id,
            goal_time_period=goal_data.goal_time_period,
            allocated_hours=goal_data.allocated_hours,
            why_reason=goal_data.why_reason,
            start_date=goal_data.start_date,
            end_date=goal_data.end_date
        )
        
        db.add(db_goal)
        db.commit()
        db.refresh(db_goal)
        
        return db_goal

    @staticmethod
    def get_goal(db: Session, goal_id: int) -> Optional[Goal]:
        """Get a goal by ID with all relationships loaded"""
        return db.query(Goal).options(
            joinedload(Goal.pillar),
            joinedload(Goal.category),
            joinedload(Goal.sub_category),
            joinedload(Goal.tasks)
        ).filter(Goal.id == goal_id).first()

    @staticmethod
    def get_goals(
        db: Session,
        filters: Optional[GoalFilters] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Goal]:
        """
        Get all goals with optional filtering
        
        Args:
            db: Database session
            filters: Optional filters for goals
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of Goal objects
        """
        query = db.query(Goal).options(
            joinedload(Goal.pillar),
            joinedload(Goal.category),
            joinedload(Goal.sub_category)
        )
        
        if filters:
            if filters.pillar_id is not None:
                query = query.filter(Goal.pillar_id == filters.pillar_id)
            if filters.category_id is not None:
                query = query.filter(Goal.category_id == filters.category_id)
            if filters.sub_category_id is not None:
                query = query.filter(Goal.sub_category_id == filters.sub_category_id)
            if filters.goal_time_period is not None:
                query = query.filter(Goal.goal_time_period == filters.goal_time_period)
            if filters.is_active is not None:
                query = query.filter(Goal.is_active == filters.is_active)
            if filters.is_completed is not None:
                query = query.filter(Goal.is_completed == filters.is_completed)
        
        return query.order_by(Goal.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def update_goal(db: Session, goal_id: int, goal_data: GoalUpdate) -> Goal:
        """
        Update an existing goal
        
        Args:
            db: Database session
            goal_id: ID of goal to update
            goal_data: Updated goal data
            
        Returns:
            Updated Goal object
            
        Raises:
            ValueError: If goal not found or validation fails
        """
        db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
        if not db_goal:
            raise ValueError(f"Goal with id {goal_id} not found")
        
        # Validate pillar if changed
        if goal_data.pillar_id is not None and goal_data.pillar_id != db_goal.pillar_id:
            pillar = db.query(Pillar).filter(Pillar.id == goal_data.pillar_id).first()
            if not pillar:
                raise ValueError(f"Pillar with id {goal_data.pillar_id} not found")
        
        # Validate category if changed
        if goal_data.category_id is not None and goal_data.category_id != db_goal.category_id:
            category = db.query(Category).filter(Category.id == goal_data.category_id).first()
            if not category:
                raise ValueError(f"Category with id {goal_data.category_id} not found")
            
            # Check category belongs to pillar
            pillar_id = goal_data.pillar_id if goal_data.pillar_id is not None else db_goal.pillar_id
            if category.pillar_id != pillar_id:
                raise ValueError(f"Category does not belong to the specified pillar")
        
        # Validate sub-category if changed
        if goal_data.sub_category_id is not None and goal_data.sub_category_id != db_goal.sub_category_id:
            sub_category = db.query(SubCategory).filter(
                SubCategory.id == goal_data.sub_category_id
            ).first()
            if not sub_category:
                raise ValueError(f"Sub-category with id {goal_data.sub_category_id} not found")
            
            # Check sub-category belongs to category
            category_id = goal_data.category_id if goal_data.category_id is not None else db_goal.category_id
            if sub_category.category_id != category_id:
                raise ValueError(f"Sub-category does not belong to the specified category")
        
        # Update fields
        update_data = goal_data.model_dump(exclude_unset=True)
        
        # Handle completion
        if goal_data.is_completed is not None and goal_data.is_completed and not db_goal.is_completed:
            update_data['completed_at'] = datetime.now()
        
        for key, value in update_data.items():
            setattr(db_goal, key, value)
        
        db.commit()
        db.refresh(db_goal)
        
        return db_goal

    @staticmethod
    def delete_goal(db: Session, goal_id: int) -> bool:
        """
        Delete a goal
        
        Args:
            db: Database session
            goal_id: ID of goal to delete
            
        Returns:
            True if deleted, False if not found
        """
        db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
        if not db_goal:
            return False
        
        db.delete(db_goal)
        db.commit()
        return True

    @staticmethod
    def get_goal_with_stats(db: Session, goal_id: int) -> Optional[Dict[str, Any]]:
        """
        Get a goal with detailed statistics
        
        Args:
            db: Database session
            goal_id: ID of the goal
            
        Returns:
            Dictionary with goal data and statistics
        """
        goal = GoalService.get_goal(db, goal_id)
        if not goal:
            return None
        
        # Calculate progress percentage
        progress_percentage = 0.0
        if goal.allocated_hours > 0:
            progress_percentage = (goal.spent_hours / goal.allocated_hours) * 100
            progress_percentage = min(progress_percentage, 100.0)
        
        # Count linked tasks
        linked_tasks = db.query(Task).filter(Task.goal_id == goal_id).all()
        linked_tasks_count = len(linked_tasks)
        completed_tasks_count = sum(1 for task in linked_tasks if task.is_completed)
        
        # Calculate remaining hours
        remaining_hours = max(goal.allocated_hours - goal.spent_hours, 0.0)
        
        return {
            "id": goal.id,
            "name": goal.name,
            "description": goal.description,
            "pillar_id": goal.pillar_id,
            "pillar_name": goal.pillar.name if goal.pillar else None,
            "category_id": goal.category_id,
            "category_name": goal.category.name if goal.category else None,
            "sub_category_id": goal.sub_category_id,
            "sub_category_name": goal.sub_category.name if goal.sub_category else None,
            "goal_time_period": goal.goal_time_period,
            "allocated_hours": goal.allocated_hours,
            "spent_hours": goal.spent_hours,
            "why_reason": goal.why_reason,
            "start_date": goal.start_date,
            "end_date": goal.end_date,
            "is_active": goal.is_active,
            "is_completed": goal.is_completed,
            "completed_at": goal.completed_at,
            "created_at": goal.created_at,
            "updated_at": goal.updated_at,
            "progress_percentage": progress_percentage,
            "linked_tasks_count": linked_tasks_count,
            "completed_tasks_count": completed_tasks_count,
            "remaining_hours": remaining_hours
        }

    @staticmethod
    def mark_goal_completed(db: Session, goal_id: int) -> Goal:
        """
        Mark a goal as completed
        
        Args:
            db: Database session
            goal_id: ID of goal to mark as completed
            
        Returns:
            Updated Goal object
            
        Raises:
            ValueError: If goal not found
        """
        db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
        if not db_goal:
            raise ValueError(f"Goal with id {goal_id} not found")
        
        db_goal.is_completed = True
        db_goal.completed_at = datetime.now()
        
        db.commit()
        db.refresh(db_goal)
        
        return db_goal

    @staticmethod
    def update_goal_spent_hours(db: Session, goal_id: int) -> Goal:
        """
        Recalculate spent hours from linked tasks
        
        Args:
            db: Database session
            goal_id: ID of goal to update
            
        Returns:
            Updated Goal object
            
        Raises:
            ValueError: If goal not found
        """
        db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
        if not db_goal:
            raise ValueError(f"Goal with id {goal_id} not found")
        
        # Calculate total spent minutes from linked tasks
        linked_tasks = db.query(Task).filter(Task.goal_id == goal_id).all()
        total_spent_minutes = sum(task.spent_minutes for task in linked_tasks)
        
        # Convert to hours
        db_goal.spent_hours = total_spent_minutes / 60.0
        
        db.commit()
        db.refresh(db_goal)
        
        return db_goal

    @staticmethod
    def get_goals_by_time_period(
        db: Session,
        time_period: str,
        pillar_id: Optional[int] = None
    ) -> List[Goal]:
        """
        Get goals filtered by time period
        
        Args:
            db: Database session
            time_period: week, month, quarter, or year
            pillar_id: Optional pillar filter
            
        Returns:
            List of Goal objects
        """
        query = db.query(Goal).filter(Goal.goal_time_period == time_period)
        
        if pillar_id:
            query = query.filter(Goal.pillar_id == pillar_id)
        
        return query.order_by(Goal.created_at.desc()).all()
