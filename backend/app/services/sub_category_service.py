"""
SubCategory service layer - Business logic for sub-category operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.models.models import SubCategory, Category, Pillar, Task, TimeEntry
from app.models.schemas import (
    SubCategoryCreate, SubCategoryUpdate, SubCategoryResponse, SubCategoryWithStats,
    TimeAllocationValidation
)


class SubCategoryService:
    """Service for sub-category-related operations"""

    @staticmethod
    def get_all_sub_categories(db: Session, category_id: Optional[int] = None) -> List[SubCategory]:
        """
        Get all sub-categories, optionally filtered by category
        
        Args:
            db: Database session
            category_id: Optional category ID to filter by
            
        Returns:
            List of sub-categories
        """
        query = db.query(SubCategory)
        if category_id:
            query = query.filter(SubCategory.category_id == category_id)
        return query.all()

    @staticmethod
    def get_sub_category_by_id(db: Session, sub_category_id: int) -> Optional[SubCategory]:
        """Get a sub-category by ID"""
        return db.query(SubCategory).filter(SubCategory.id == sub_category_id).first()

    @staticmethod
    def get_sub_category_by_name(db: Session, name: str, category_id: int) -> Optional[SubCategory]:
        """Get a sub-category by name within a category"""
        return db.query(SubCategory).filter(
            SubCategory.name == name,
            SubCategory.category_id == category_id
        ).first()

    @staticmethod
    def validate_sub_category_allocation(
        db: Session,
        category_id: int,
        new_hours: float,
        exclude_sub_category_id: Optional[int] = None
    ) -> TimeAllocationValidation:
        """
        Validate if adding/updating a sub-category would exceed category's allocated hours
        
        Args:
            db: Database session
            category_id: ID of the category
            new_hours: Hours to allocate to the sub-category
            exclude_sub_category_id: ID of sub-category being updated (to exclude from total)
            
        Returns:
            TimeAllocationValidation object
        """
        # Get category
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            return TimeAllocationValidation(
                is_valid=False,
                total_allocated=0.0,
                total_allowed=0.0,
                message=f"Category with ID {category_id} not found",
                details={}
            )
        
        # Calculate current total for this category's sub-categories
        query = db.query(func.sum(SubCategory.allocated_hours))\
            .filter(SubCategory.category_id == category_id)
        
        if exclude_sub_category_id:
            query = query.filter(SubCategory.id != exclude_sub_category_id)
        
        current_total = query.scalar() or 0.0
        new_total = current_total + new_hours
        
        is_valid = new_total <= category.allocated_hours
        
        return TimeAllocationValidation(
            is_valid=is_valid,
            total_allocated=new_total,
            total_allowed=category.allocated_hours,
            message=f"New total would be {new_total} hours for category '{category.name}'. Must not exceed {category.allocated_hours} hours." if not is_valid else "Allocation is valid.",
            details={
                "category_name": category.name,
                "category_allocated": category.allocated_hours,
                "current_total": current_total,
                "new_hours": new_hours,
                "new_total": new_total,
                "remaining": max(0, category.allocated_hours - new_total)
            }
        )

    @staticmethod
    def create_sub_category(db: Session, sub_category: SubCategoryCreate) -> SubCategory:
        """
        Create a new sub-category with validation
        
        Args:
            db: Database session
            sub_category: SubCategoryCreate schema
            
        Returns:
            Created SubCategory object
            
        Raises:
            ValueError: If validation fails
        """
        # Validate category exists
        category = db.query(Category).filter(Category.id == sub_category.category_id).first()
        if not category:
            raise ValueError(f"Category with ID {sub_category.category_id} not found")
        
        # Validate unique name within category
        existing = SubCategoryService.get_sub_category_by_name(db, sub_category.name, sub_category.category_id)
        if existing:
            raise ValueError(f"Sub-category '{sub_category.name}' already exists in category '{category.name}'")
        
        # Validate allocation
        validation = SubCategoryService.validate_sub_category_allocation(
            db, sub_category.category_id, sub_category.allocated_hours
        )
        if not validation.is_valid:
            raise ValueError(validation.message)
        
        # Create sub-category
        db_sub_category = SubCategory(**sub_category.model_dump())
        db.add(db_sub_category)
        db.commit()
        db.refresh(db_sub_category)
        
        return db_sub_category

    @staticmethod
    def update_sub_category(db: Session, sub_category_id: int, sub_category_update: SubCategoryUpdate) -> SubCategory:
        """
        Update a sub-category with validation
        
        Args:
            db: Database session
            sub_category_id: ID of sub-category to update
            sub_category_update: SubCategoryUpdate schema
            
        Returns:
            Updated SubCategory object
            
        Raises:
            ValueError: If sub-category not found or validation fails
        """
        db_sub_category = SubCategoryService.get_sub_category_by_id(db, sub_category_id)
        if not db_sub_category:
            raise ValueError(f"Sub-category with ID {sub_category_id} not found")
        
        # Get category_id (either from update or existing)
        category_id = sub_category_update.category_id if sub_category_update.category_id is not None else db_sub_category.category_id
        
        # Validate name uniqueness if name is being updated
        if sub_category_update.name and sub_category_update.name != db_sub_category.name:
            existing = SubCategoryService.get_sub_category_by_name(db, sub_category_update.name, category_id)
            if existing:
                category = db.query(Category).filter(Category.id == category_id).first()
                raise ValueError(f"Sub-category '{sub_category_update.name}' already exists in category '{category.name if category else 'Unknown'}'")
        
        # Validate allocation if being updated
        if sub_category_update.allocated_hours is not None:
            validation = SubCategoryService.validate_sub_category_allocation(
                db,
                category_id,
                sub_category_update.allocated_hours,
                exclude_sub_category_id=sub_category_id
            )
            if not validation.is_valid:
                raise ValueError(validation.message)
        
        # Update fields
        update_data = sub_category_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_sub_category, field, value)
        
        db.commit()
        db.refresh(db_sub_category)
        
        return db_sub_category

    @staticmethod
    def delete_sub_category(db: Session, sub_category_id: int) -> bool:
        """
        Delete a sub-category
        
        Args:
            db: Database session
            sub_category_id: ID of sub-category to delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If sub-category not found or has dependencies
        """
        db_sub_category = SubCategoryService.get_sub_category_by_id(db, sub_category_id)
        if not db_sub_category:
            raise ValueError(f"Sub-category with ID {sub_category_id} not found")
        
        # Check for dependencies
        task_count = db.query(Task).filter(Task.sub_category_id == sub_category_id).count()
        if task_count > 0:
            raise ValueError(f"Cannot delete sub-category. It has {task_count} associated tasks.")
        
        db.delete(db_sub_category)
        db.commit()
        
        return True

    @staticmethod
    def get_sub_category_with_stats(db: Session, sub_category_id: int) -> Optional[dict]:
        """
        Get sub-category with statistics
        
        Args:
            db: Database session
            sub_category_id: ID of sub-category
            
        Returns:
            Dictionary with sub-category data and statistics
        """
        sub_category = SubCategoryService.get_sub_category_by_id(db, sub_category_id)
        if not sub_category:
            return None
        
        # Get parent names
        category_name = sub_category.category.name if sub_category.category else None
        pillar_name = sub_category.category.pillar.name if sub_category.category and sub_category.category.pillar else None
        
        # Count related entities
        total_tasks = db.query(Task).filter(Task.sub_category_id == sub_category_id).count()
        
        # Calculate total spent time
        total_spent_minutes = db.query(func.sum(TimeEntry.duration_minutes))\
            .join(Task)\
            .filter(Task.sub_category_id == sub_category_id)\
            .scalar() or 0
        
        total_spent_hours = total_spent_minutes / 60.0
        
        return {
            **SubCategoryResponse.model_validate(sub_category).model_dump(),
            "total_tasks": total_tasks,
            "total_spent_hours": round(total_spent_hours, 2),
            "category_name": category_name,
            "pillar_name": pillar_name
        }
