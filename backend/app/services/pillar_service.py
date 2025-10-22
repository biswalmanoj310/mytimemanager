"""
Pillar service layer - Business logic for pillar operations
Includes validation for 24-hour constraint
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.models.models import Pillar, Category, Task, Goal, TimeEntry
from app.models.schemas import (
    PillarCreate, PillarUpdate, PillarResponse, PillarWithStats,
    TimeAllocationValidation, PillarStatistics
)


class PillarService:
    """Service for pillar-related operations"""

    @staticmethod
    def get_all_pillars(db: Session) -> List[Pillar]:
        """Get all pillars"""
        return db.query(Pillar).all()

    @staticmethod
    def get_pillar_by_id(db: Session, pillar_id: int) -> Optional[Pillar]:
        """Get a pillar by ID"""
        return db.query(Pillar).filter(Pillar.id == pillar_id).first()

    @staticmethod
    def get_pillar_by_name(db: Session, name: str) -> Optional[Pillar]:
        """Get a pillar by name"""
        return db.query(Pillar).filter(Pillar.name == name).first()

    @staticmethod
    def validate_total_allocation(db: Session, exclude_pillar_id: Optional[int] = None) -> TimeAllocationValidation:
        """
        Validate that total pillar allocation equals 24 hours
        
        Args:
            db: Database session
            exclude_pillar_id: ID of pillar to exclude from calculation (for updates)
            
        Returns:
            TimeAllocationValidation object with validation results
        """
        query = db.query(func.sum(Pillar.allocated_hours))
        
        if exclude_pillar_id:
            query = query.filter(Pillar.id != exclude_pillar_id)
        
        total_allocated = query.scalar() or 0.0
        
        is_valid = total_allocated == 24.0
        
        return TimeAllocationValidation(
            is_valid=is_valid,
            total_allocated=total_allocated,
            total_allowed=24.0,
            message=f"Total allocation is {total_allocated} hours. Must be exactly 24 hours." if not is_valid else "Total allocation is valid (24 hours).",
            details={
                "difference": 24.0 - total_allocated,
                "remaining": max(0, 24.0 - total_allocated)
            }
        )

    @staticmethod
    def validate_pillar_allocation(
        db: Session, 
        new_hours: float, 
        exclude_pillar_id: Optional[int] = None
    ) -> TimeAllocationValidation:
        """
        Validate if adding/updating a pillar with new_hours would maintain 24-hour constraint
        
        Args:
            db: Database session
            new_hours: Hours to allocate to the pillar
            exclude_pillar_id: ID of pillar being updated (to exclude from total)
            
        Returns:
            TimeAllocationValidation object
        """
        query = db.query(func.sum(Pillar.allocated_hours))
        
        if exclude_pillar_id:
            query = query.filter(Pillar.id != exclude_pillar_id)
        
        current_total = query.scalar() or 0.0
        new_total = current_total + new_hours
        
        is_valid = new_total <= 24.0
        
        return TimeAllocationValidation(
            is_valid=is_valid,
            total_allocated=new_total,
            total_allowed=24.0,
            message=f"New total would be {new_total} hours. Must not exceed 24 hours." if not is_valid else "Allocation is valid.",
            details={
                "current_total": current_total,
                "new_hours": new_hours,
                "new_total": new_total,
                "remaining": max(0, 24.0 - new_total)
            }
        )

    @staticmethod
    def create_pillar(db: Session, pillar: PillarCreate) -> Pillar:
        """
        Create a new pillar with validation
        
        Args:
            db: Database session
            pillar: PillarCreate schema
            
        Returns:
            Created Pillar object
            
        Raises:
            ValueError: If validation fails
        """
        # Validate unique name
        existing = PillarService.get_pillar_by_name(db, pillar.name)
        if existing:
            raise ValueError(f"Pillar with name '{pillar.name}' already exists")
        
        # Validate total allocation
        validation = PillarService.validate_pillar_allocation(db, pillar.allocated_hours)
        if not validation.is_valid:
            raise ValueError(validation.message)
        
        # Create pillar
        db_pillar = Pillar(**pillar.model_dump())
        db.add(db_pillar)
        db.commit()
        db.refresh(db_pillar)
        
        return db_pillar

    @staticmethod
    def update_pillar(db: Session, pillar_id: int, pillar_update: PillarUpdate) -> Pillar:
        """
        Update a pillar with validation
        
        Args:
            db: Database session
            pillar_id: ID of pillar to update
            pillar_update: PillarUpdate schema
            
        Returns:
            Updated Pillar object
            
        Raises:
            ValueError: If pillar not found or validation fails
        """
        db_pillar = PillarService.get_pillar_by_id(db, pillar_id)
        if not db_pillar:
            raise ValueError(f"Pillar with ID {pillar_id} not found")
        
        # Check name uniqueness if name is being updated
        if pillar_update.name and pillar_update.name != db_pillar.name:
            existing = PillarService.get_pillar_by_name(db, pillar_update.name)
            if existing:
                raise ValueError(f"Pillar with name '{pillar_update.name}' already exists")
        
        # Validate allocation if being updated
        if pillar_update.allocated_hours is not None:
            validation = PillarService.validate_pillar_allocation(
                db, 
                pillar_update.allocated_hours, 
                exclude_pillar_id=pillar_id
            )
            if not validation.is_valid:
                raise ValueError(validation.message)
        
        # Update fields
        update_data = pillar_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_pillar, field, value)
        
        db.commit()
        db.refresh(db_pillar)
        
        return db_pillar

    @staticmethod
    def delete_pillar(db: Session, pillar_id: int) -> bool:
        """
        Delete a pillar
        
        Args:
            db: Database session
            pillar_id: ID of pillar to delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If pillar not found or has dependencies
        """
        db_pillar = PillarService.get_pillar_by_id(db, pillar_id)
        if not db_pillar:
            raise ValueError(f"Pillar with ID {pillar_id} not found")
        
        # Check for dependencies
        category_count = db.query(Category).filter(Category.pillar_id == pillar_id).count()
        if category_count > 0:
            raise ValueError(f"Cannot delete pillar. It has {category_count} associated categories. Delete categories first.")
        
        db.delete(db_pillar)
        db.commit()
        
        return True

    @staticmethod
    def get_pillar_with_stats(db: Session, pillar_id: int) -> Optional[dict]:
        """
        Get pillar with statistics
        
        Args:
            db: Database session
            pillar_id: ID of pillar
            
        Returns:
            Dictionary with pillar data and statistics
        """
        pillar = PillarService.get_pillar_by_id(db, pillar_id)
        if not pillar:
            return None
        
        # Count related entities
        total_categories = db.query(Category).filter(Category.pillar_id == pillar_id).count()
        total_tasks = db.query(Task).filter(Task.pillar_id == pillar_id).count()
        total_goals = db.query(Goal).filter(Goal.pillar_id == pillar_id).count()
        
        # Calculate total spent time (from time entries)
        total_spent_minutes = db.query(func.sum(TimeEntry.duration_minutes))\
            .join(Task)\
            .filter(Task.pillar_id == pillar_id)\
            .scalar() or 0
        
        total_spent_hours = total_spent_minutes / 60.0
        
        return {
            **PillarResponse.model_validate(pillar).model_dump(),
            "total_categories": total_categories,
            "total_tasks": total_tasks,
            "total_goals": total_goals,
            "total_spent_hours": round(total_spent_hours, 2)
        }

    @staticmethod
    def get_pillar_statistics(db: Session, pillar_id: int) -> Optional[PillarStatistics]:
        """
        Get detailed statistics for a pillar
        
        Args:
            db: Database session
            pillar_id: ID of pillar
            
        Returns:
            PillarStatistics object
        """
        pillar = PillarService.get_pillar_by_id(db, pillar_id)
        if not pillar:
            return None
        
        stats_data = PillarService.get_pillar_with_stats(db, pillar_id)
        
        percentage_used = 0.0
        if pillar.allocated_hours > 0:
            percentage_used = (stats_data["total_spent_hours"] / pillar.allocated_hours) * 100
        
        return PillarStatistics(
            pillar_id=pillar.id,
            pillar_name=pillar.name,
            allocated_hours=pillar.allocated_hours,
            spent_hours=stats_data["total_spent_hours"],
            percentage_used=round(percentage_used, 2),
            total_categories=stats_data["total_categories"],
            total_tasks=stats_data["total_tasks"],
            total_goals=stats_data["total_goals"]
        )
