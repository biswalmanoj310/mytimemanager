"""
Category service layer - Business logic for category operations
Includes validation for pillar time allocation constraints
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.models.models import Category, SubCategory, Pillar, Task, Goal, TimeEntry
from app.models.schemas import (
    CategoryCreate, CategoryUpdate, CategoryResponse, CategoryWithStats,
    TimeAllocationValidation
)


class CategoryService:
    """Service for category-related operations"""

    @staticmethod
    def get_all_categories(db: Session, pillar_id: Optional[int] = None) -> List[Category]:
        """
        Get all categories, optionally filtered by pillar
        
        Args:
            db: Database session
            pillar_id: Optional pillar ID to filter by
            
        Returns:
            List of categories
        """
        query = db.query(Category)
        if pillar_id:
            query = query.filter(Category.pillar_id == pillar_id)
        return query.all()

    @staticmethod
    def get_category_by_id(db: Session, category_id: int) -> Optional[Category]:
        """Get a category by ID"""
        return db.query(Category).filter(Category.id == category_id).first()

    @staticmethod
    def get_category_by_name(db: Session, name: str, pillar_id: int) -> Optional[Category]:
        """Get a category by name within a pillar"""
        return db.query(Category).filter(
            Category.name == name,
            Category.pillar_id == pillar_id
        ).first()

    @staticmethod
    def validate_category_allocation(
        db: Session,
        pillar_id: int,
        new_hours: float,
        exclude_category_id: Optional[int] = None
    ) -> TimeAllocationValidation:
        """
        Validate if adding/updating a category would exceed pillar's allocated hours
        
        Args:
            db: Database session
            pillar_id: ID of the pillar
            new_hours: Hours to allocate to the category
            exclude_category_id: ID of category being updated (to exclude from total)
            
        Returns:
            TimeAllocationValidation object
        """
        # Get pillar
        pillar = db.query(Pillar).filter(Pillar.id == pillar_id).first()
        if not pillar:
            return TimeAllocationValidation(
                is_valid=False,
                total_allocated=0.0,
                total_allowed=0.0,
                message=f"Pillar with ID {pillar_id} not found",
                details={}
            )
        
        # Calculate current total for this pillar's categories
        query = db.query(func.sum(Category.allocated_hours))\
            .filter(Category.pillar_id == pillar_id)
        
        if exclude_category_id:
            query = query.filter(Category.id != exclude_category_id)
        
        current_total = query.scalar() or 0.0
        new_total = current_total + new_hours
        
        is_valid = new_total <= pillar.allocated_hours
        
        return TimeAllocationValidation(
            is_valid=is_valid,
            total_allocated=new_total,
            total_allowed=pillar.allocated_hours,
            message=f"New total would be {new_total} hours for pillar '{pillar.name}'. Must not exceed {pillar.allocated_hours} hours." if not is_valid else "Allocation is valid.",
            details={
                "pillar_name": pillar.name,
                "pillar_allocated": pillar.allocated_hours,
                "current_total": current_total,
                "new_hours": new_hours,
                "new_total": new_total,
                "remaining": max(0, pillar.allocated_hours - new_total)
            }
        )

    @staticmethod
    def validate_pillar_categories_total(db: Session, pillar_id: int) -> TimeAllocationValidation:
        """
        Validate that all categories within a pillar sum to pillar's allocated hours
        
        Args:
            db: Database session
            pillar_id: ID of the pillar
            
        Returns:
            TimeAllocationValidation object
        """
        pillar = db.query(Pillar).filter(Pillar.id == pillar_id).first()
        if not pillar:
            return TimeAllocationValidation(
                is_valid=False,
                total_allocated=0.0,
                total_allowed=0.0,
                message=f"Pillar with ID {pillar_id} not found",
                details={}
            )
        
        total_allocated = db.query(func.sum(Category.allocated_hours))\
            .filter(Category.pillar_id == pillar_id)\
            .scalar() or 0.0
        
        is_valid = total_allocated == pillar.allocated_hours
        
        return TimeAllocationValidation(
            is_valid=is_valid,
            total_allocated=total_allocated,
            total_allowed=pillar.allocated_hours,
            message=f"Total category allocation is {total_allocated} hours. Should equal {pillar.allocated_hours} hours for pillar '{pillar.name}'." if not is_valid else f"Category allocation is valid for pillar '{pillar.name}'.",
            details={
                "pillar_name": pillar.name,
                "difference": pillar.allocated_hours - total_allocated,
                "remaining": max(0, pillar.allocated_hours - total_allocated)
            }
        )

    @staticmethod
    def create_category(db: Session, category: CategoryCreate) -> Category:
        """
        Create a new category with validation
        
        Args:
            db: Database session
            category: CategoryCreate schema
            
        Returns:
            Created Category object
            
        Raises:
            ValueError: If validation fails
        """
        # Validate pillar exists
        pillar = db.query(Pillar).filter(Pillar.id == category.pillar_id).first()
        if not pillar:
            raise ValueError(f"Pillar with ID {category.pillar_id} not found")
        
        # Validate unique name within pillar
        existing = CategoryService.get_category_by_name(db, category.name, category.pillar_id)
        if existing:
            raise ValueError(f"Category '{category.name}' already exists in pillar '{pillar.name}'")
        
        # Validate allocation
        validation = CategoryService.validate_category_allocation(
            db, category.pillar_id, category.allocated_hours
        )
        if not validation.is_valid:
            raise ValueError(validation.message)
        
        # Create category
        db_category = Category(**category.model_dump())
        db.add(db_category)
        db.commit()
        db.refresh(db_category)
        
        return db_category

    @staticmethod
    def update_category(db: Session, category_id: int, category_update: CategoryUpdate) -> Category:
        """
        Update a category with validation
        
        Args:
            db: Database session
            category_id: ID of category to update
            category_update: CategoryUpdate schema
            
        Returns:
            Updated Category object
            
        Raises:
            ValueError: If category not found or validation fails
        """
        db_category = CategoryService.get_category_by_id(db, category_id)
        if not db_category:
            raise ValueError(f"Category with ID {category_id} not found")
        
        # Get pillar_id (either from update or existing)
        pillar_id = category_update.pillar_id if category_update.pillar_id is not None else db_category.pillar_id
        
        # Validate name uniqueness if name is being updated
        if category_update.name and category_update.name != db_category.name:
            existing = CategoryService.get_category_by_name(db, category_update.name, pillar_id)
            if existing:
                pillar = db.query(Pillar).filter(Pillar.id == pillar_id).first()
                raise ValueError(f"Category '{category_update.name}' already exists in pillar '{pillar.name if pillar else 'Unknown'}'")
        
        # Validate allocation if being updated
        if category_update.allocated_hours is not None:
            validation = CategoryService.validate_category_allocation(
                db,
                pillar_id,
                category_update.allocated_hours,
                exclude_category_id=category_id
            )
            if not validation.is_valid:
                raise ValueError(validation.message)
        
        # Update fields
        update_data = category_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_category, field, value)
        
        db.commit()
        db.refresh(db_category)
        
        return db_category

    @staticmethod
    def delete_category(db: Session, category_id: int) -> bool:
        """
        Delete a category
        
        Args:
            db: Database session
            category_id: ID of category to delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If category not found or has dependencies
        """
        db_category = CategoryService.get_category_by_id(db, category_id)
        if not db_category:
            raise ValueError(f"Category with ID {category_id} not found")
        
        # Check for dependencies
        sub_category_count = db.query(SubCategory).filter(SubCategory.category_id == category_id).count()
        if sub_category_count > 0:
            raise ValueError(f"Cannot delete category. It has {sub_category_count} associated sub-categories. Delete sub-categories first.")
        
        task_count = db.query(Task).filter(Task.category_id == category_id).count()
        if task_count > 0:
            raise ValueError(f"Cannot delete category. It has {task_count} associated tasks.")
        
        db.delete(db_category)
        db.commit()
        
        return True

    @staticmethod
    def get_category_with_stats(db: Session, category_id: int) -> Optional[dict]:
        """
        Get category with statistics
        
        Args:
            db: Database session
            category_id: ID of category
            
        Returns:
            Dictionary with category data and statistics
        """
        category = CategoryService.get_category_by_id(db, category_id)
        if not category:
            return None
        
        # Get pillar name
        pillar_name = category.pillar.name if category.pillar else None
        
        # Count related entities
        total_sub_categories = db.query(SubCategory).filter(SubCategory.category_id == category_id).count()
        total_tasks = db.query(Task).filter(Task.category_id == category_id).count()
        
        # Calculate total spent time
        total_spent_minutes = db.query(func.sum(TimeEntry.duration_minutes))\
            .join(Task)\
            .filter(Task.category_id == category_id)\
            .scalar() or 0
        
        total_spent_hours = total_spent_minutes / 60.0
        
        return {
            **CategoryResponse.model_validate(category).model_dump(),
            "total_sub_categories": total_sub_categories,
            "total_tasks": total_tasks,
            "total_spent_hours": round(total_spent_hours, 2),
            "pillar_name": pillar_name
        }
