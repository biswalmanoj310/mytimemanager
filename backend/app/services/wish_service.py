"""
Wish / Dream Board Service
Handles business logic for wish management

Philosophy:
- Wishes are pressure-free dreams
- They can stay wishes forever (no guilt)
- They can evolve into goals when ready
- Focus on exploration and inspiration
"""

from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import List, Optional, Dict
import json

from app.models.models import Wish, WishReflection, WishExplorationStep, WishInspiration


class WishService:
    """Service for managing wishes and dream board items"""

    @staticmethod
    def create_wish(db: Session, wish_data: dict) -> Wish:
        """
        Create a new wish
        
        Args:
            db: Database session
            wish_data: Dictionary with wish details
            
        Returns:
            Created Wish object
        """
        # Handle tags as JSON if provided as list
        if 'tags' in wish_data and isinstance(wish_data['tags'], list):
            wish_data['tags'] = json.dumps(wish_data['tags'])
        
        wish = Wish(**wish_data)
        db.add(wish)
        db.commit()
        db.refresh(wish)
        return wish

    @staticmethod
    def get_wish(db: Session, wish_id: int) -> Optional[Wish]:
        """Get a specific wish by ID"""
        return db.query(Wish).filter(Wish.id == wish_id).first()

    @staticmethod
    def get_all_wishes(
        db: Session,
        status: Optional[str] = None,
        category: Optional[str] = None,
        include_archived: bool = False
    ) -> List[Wish]:
        """
        Get all wishes with optional filtering
        
        Args:
            db: Database session
            status: Filter by status (dreaming, exploring, etc.)
            category: Filter by category (travel, financial, etc.)
            include_archived: Include archived wishes
            
        Returns:
            List of Wish objects
        """
        query = db.query(Wish)
        
        if not include_archived:
            query = query.filter(Wish.is_active == True)
        
        if status:
            query = query.filter(Wish.status == status)
        
        if category:
            query = query.filter(Wish.category == category)
        
        return query.order_by(
            Wish.priority.desc(),
            Wish.created_at.desc()
        ).all()

    @staticmethod
    def update_wish(db: Session, wish_id: int, updates: dict) -> Optional[Wish]:
        """
        Update a wish
        
        Args:
            db: Database session
            wish_id: ID of wish to update
            updates: Dictionary of fields to update
            
        Returns:
            Updated Wish object or None
        """
        wish = db.query(Wish).filter(Wish.id == wish_id).first()
        if not wish:
            return None
        
        # Handle tags conversion
        if 'tags' in updates and isinstance(updates['tags'], list):
            updates['tags'] = json.dumps(updates['tags'])
        
        for key, value in updates.items():
            if hasattr(wish, key):
                setattr(wish, key, value)
        
        wish.updated_at = datetime.now()
        db.commit()
        db.refresh(wish)
        return wish

    @staticmethod
    def archive_wish(db: Session, wish_id: int) -> bool:
        """
        Archive a wish (soft delete)
        
        Args:
            db: Database session
            wish_id: ID of wish to archive
            
        Returns:
            True if successful
        """
        wish = db.query(Wish).filter(Wish.id == wish_id).first()
        if not wish:
            return False
        
        wish.is_active = False
        wish.status = 'archived'
        wish.updated_at = datetime.now()
        db.commit()
        return True

    @staticmethod
    def delete_wish(db: Session, wish_id: int) -> bool:
        """
        Permanently delete a wish
        
        Args:
            db: Database session
            wish_id: ID of wish to delete
            
        Returns:
            True if successful
        """
        wish = db.query(Wish).filter(Wish.id == wish_id).first()
        if not wish:
            return False
        
        db.delete(wish)
        db.commit()
        return True

    @staticmethod
    def convert_to_goal(db: Session, wish_id: int, goal_id: int) -> Optional[Wish]:
        """
        Mark a wish as converted to a committed goal
        
        Args:
            db: Database session
            wish_id: ID of wish being converted
            goal_id: ID of the life goal it became
            
        Returns:
            Updated Wish object
        """
        wish = db.query(Wish).filter(Wish.id == wish_id).first()
        if not wish:
            return None
        
        wish.status = 'converted'
        wish.related_goal_id = goal_id
        wish.converted_to_goal_at = datetime.now()
        wish.updated_at = datetime.now()
        
        db.commit()
        db.refresh(wish)
        return wish

    # ============================================================================
    # REFLECTIONS
    # ============================================================================

    @staticmethod
    def add_reflection(
        db: Session,
        wish_id: int,
        reflection_text: str,
        mood: Optional[str] = None,
        clarity_score: Optional[int] = None
    ) -> WishReflection:
        """
        Add a journal reflection about a wish
        
        Args:
            db: Database session
            wish_id: ID of wish
            reflection_text: The reflection content
            mood: Current mood about the wish
            clarity_score: 1-10 clarity rating
            
        Returns:
            Created WishReflection object
        """
        reflection = WishReflection(
            wish_id=wish_id,
            reflection_date=date.today(),
            reflection_text=reflection_text,
            mood=mood,
            clarity_score=clarity_score
        )
        
        db.add(reflection)
        db.commit()
        db.refresh(reflection)
        return reflection

    @staticmethod
    def get_reflections(db: Session, wish_id: int) -> List[WishReflection]:
        """Get all reflections for a wish"""
        return db.query(WishReflection)\
            .filter(WishReflection.wish_id == wish_id)\
            .order_by(WishReflection.reflection_date.desc())\
            .all()

    # ============================================================================
    # EXPLORATION STEPS
    # ============================================================================

    @staticmethod
    def add_exploration_step(
        db: Session,
        wish_id: int,
        step_title: str,
        step_description: Optional[str] = None,
        step_type: Optional[str] = None
    ) -> WishExplorationStep:
        """
        Add a small exploration step toward the wish
        
        Args:
            db: Database session
            wish_id: ID of wish
            step_title: Title of exploration step
            step_description: Details
            step_type: Type (research, save_money, etc.)
            
        Returns:
            Created WishExplorationStep object
        """
        step = WishExplorationStep(
            wish_id=wish_id,
            step_title=step_title,
            step_description=step_description,
            step_type=step_type
        )
        
        db.add(step)
        db.commit()
        db.refresh(step)
        return step

    @staticmethod
    def complete_exploration_step(
        db: Session,
        step_id: int,
        notes: Optional[str] = None
    ) -> Optional[WishExplorationStep]:
        """
        Mark an exploration step as complete
        
        Args:
            db: Database session
            step_id: ID of step
            notes: Optional completion notes
            
        Returns:
            Updated WishExplorationStep object
        """
        step = db.query(WishExplorationStep)\
            .filter(WishExplorationStep.id == step_id)\
            .first()
        
        if not step:
            return None
        
        step.is_completed = True
        step.completed_at = datetime.now()
        if notes:
            step.notes = notes
        
        db.commit()
        db.refresh(step)
        return step

    @staticmethod
    def get_exploration_steps(db: Session, wish_id: int) -> List[WishExplorationStep]:
        """Get all exploration steps for a wish"""
        return db.query(WishExplorationStep)\
            .filter(WishExplorationStep.wish_id == wish_id)\
            .order_by(
                WishExplorationStep.is_completed.asc(),
                WishExplorationStep.created_at.desc()
            )\
            .all()

    # ============================================================================
    # INSPIRATIONS
    # ============================================================================

    @staticmethod
    def add_inspiration(
        db: Session,
        wish_id: int,
        inspiration_data: dict
    ) -> WishInspiration:
        """
        Add inspiring content related to a wish
        
        Args:
            db: Database session
            wish_id: ID of wish
            inspiration_data: Dict with type, title, url, content, source
            
        Returns:
            Created WishInspiration object
        """
        inspiration = WishInspiration(
            wish_id=wish_id,
            **inspiration_data
        )
        
        db.add(inspiration)
        db.commit()
        db.refresh(inspiration)
        return inspiration

    @staticmethod
    def get_inspirations(db: Session, wish_id: int) -> List[WishInspiration]:
        """Get all inspirations for a wish"""
        return db.query(WishInspiration)\
            .filter(WishInspiration.wish_id == wish_id)\
            .order_by(WishInspiration.created_at.desc())\
            .all()

    # ============================================================================
    # STATISTICS & INSIGHTS
    # ============================================================================

    @staticmethod
    def get_wish_statistics(db: Session, wish_id: int) -> Dict:
        """
        Get statistics and insights for a wish
        
        Returns:
            Dictionary with counts and insights
        """
        wish = db.query(Wish).filter(Wish.id == wish_id).first()
        if not wish:
            return {}
        
        reflections_count = db.query(WishReflection)\
            .filter(WishReflection.wish_id == wish_id)\
            .count()
        
        steps = db.query(WishExplorationStep)\
            .filter(WishExplorationStep.wish_id == wish_id)\
            .all()
        
        steps_total = len(steps)
        steps_completed = sum(1 for s in steps if s.is_completed)
        
        inspirations_count = db.query(WishInspiration)\
            .filter(WishInspiration.wish_id == wish_id)\
            .count()
        
        # Get average clarity score from reflections
        recent_reflections = db.query(WishReflection)\
            .filter(
                WishReflection.wish_id == wish_id,
                WishReflection.clarity_score.isnot(None)
            )\
            .order_by(WishReflection.reflection_date.desc())\
            .limit(5)\
            .all()
        
        avg_clarity = None
        if recent_reflections:
            avg_clarity = sum(r.clarity_score for r in recent_reflections) / len(recent_reflections)
        
        # Calculate days since creation
        days_dreaming = (datetime.now() - wish.created_at).days
        
        return {
            'wish_id': wish_id,
            'days_dreaming': days_dreaming,
            'reflections_count': reflections_count,
            'exploration_steps_total': steps_total,
            'exploration_steps_completed': steps_completed,
            'exploration_progress': (steps_completed / steps_total * 100) if steps_total > 0 else 0,
            'inspirations_count': inspirations_count,
            'average_clarity_score': round(avg_clarity, 1) if avg_clarity else None,
            'status': wish.status,
            'priority': wish.priority
        }
