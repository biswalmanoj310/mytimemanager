"""
Wish / Dream Board API Routes
RESTful endpoints for managing wishes

Philosophy: Low pressure, high inspiration
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import date

from app.database.config import get_db
from app.services.wish_service import WishService


router = APIRouter(prefix="/api/wishes", tags=["wishes"])


# ============================================================================
# PYDANTIC MODELS (Request/Response schemas)
# ============================================================================

class WishCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None  # travel, financial, personal, career, health, relationship, learning, lifestyle
    dream_type: Optional[str] = None  # experience, acquisition, achievement, transformation
    estimated_timeframe: Optional[str] = None  # someday, 1-2 years, 2-5 years, 5+ years
    estimated_cost: Optional[float] = None
    priority: Optional[str] = 'low'  # low, medium, high, burning_desire
    why_important: Optional[str] = None
    emotional_impact: Optional[str] = None
    life_area: Optional[str] = None
    image_url: Optional[str] = None
    inspiration_notes: Optional[str] = None
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    is_private: Optional[bool] = False
    tags: Optional[List[str]] = None


class WishUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    dream_type: Optional[str] = None
    estimated_timeframe: Optional[str] = None
    estimated_cost: Optional[float] = None
    priority: Optional[str] = None
    why_important: Optional[str] = None
    emotional_impact: Optional[str] = None
    life_area: Optional[str] = None
    image_url: Optional[str] = None
    inspiration_notes: Optional[str] = None
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    status: Optional[str] = None
    is_private: Optional[bool] = None
    tags: Optional[List[str]] = None


class ReflectionCreate(BaseModel):
    reflection_text: str
    mood: Optional[str] = None
    clarity_score: Optional[int] = None


class ExplorationStepCreate(BaseModel):
    step_title: str
    step_description: Optional[str] = None
    step_type: Optional[str] = None  # research, save_money, learn_skill, explore, connect


class ExplorationStepComplete(BaseModel):
    notes: Optional[str] = None


class InspirationCreate(BaseModel):
    inspiration_type: Optional[str] = None  # article, video, photo, quote, story, person
    title: Optional[str] = None
    url: Optional[str] = None
    content_text: Optional[str] = None
    source: Optional[str] = None


class ConvertToGoalRequest(BaseModel):
    goal_id: int


# ============================================================================
# WISH CRUD ENDPOINTS
# ============================================================================

@router.post("/", status_code=201)
def create_wish(wish_data: WishCreate, db: Session = Depends(get_db)):
    """
    Create a new wish
    
    No pressure - just capture the dream!
    """
    try:
        wish = WishService.create_wish(db, wish_data.model_dump())
        return wish
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
def get_wishes(
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    include_archived: bool = Query(False, description="Include archived wishes"),
    db: Session = Depends(get_db)
):
    """
    Get all wishes with optional filtering
    
    Query params:
    - status: dreaming, exploring, planning, ready_to_commit, converted, archived
    - category: travel, financial, personal, career, health, relationship, learning, lifestyle
    - include_archived: Include archived wishes (default: false)
    """
    wishes = WishService.get_all_wishes(
        db,
        status=status,
        category=category,
        include_archived=include_archived
    )
    return wishes


@router.get("/{wish_id}")
def get_wish(wish_id: int, db: Session = Depends(get_db)):
    """Get a specific wish by ID"""
    wish = WishService.get_wish(db, wish_id)
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    return wish


@router.put("/{wish_id}")
def update_wish(wish_id: int, updates: WishUpdate, db: Session = Depends(get_db)):
    """Update a wish"""
    # Filter out None values
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    wish = WishService.update_wish(db, wish_id, update_data)
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    return wish


@router.delete("/{wish_id}/archive")
def archive_wish(wish_id: int, db: Session = Depends(get_db)):
    """
    Archive a wish (soft delete)
    
    Use this when you've moved on from the wish, but want to keep the record
    """
    success = WishService.archive_wish(db, wish_id)
    if not success:
        raise HTTPException(status_code=404, detail="Wish not found")
    return {"message": "Wish archived successfully"}


@router.delete("/{wish_id}")
def delete_wish(wish_id: int, db: Session = Depends(get_db)):
    """
    Permanently delete a wish
    
    Use with caution - this cannot be undone!
    """
    success = WishService.delete_wish(db, wish_id)
    if not success:
        raise HTTPException(status_code=404, detail="Wish not found")
    return {"message": "Wish deleted successfully"}


@router.post("/{wish_id}/convert-to-goal")
def convert_to_goal(
    wish_id: int,
    request: ConvertToGoalRequest,
    db: Session = Depends(get_db)
):
    """
    Mark a wish as converted to a committed life goal
    
    This celebrates the transition from dream to committed action!
    """
    wish = WishService.convert_to_goal(db, wish_id, request.goal_id)
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    return wish


# ============================================================================
# REFLECTIONS ENDPOINTS
# ============================================================================

@router.post("/{wish_id}/reflections", status_code=201)
def add_reflection(
    wish_id: int,
    reflection_data: ReflectionCreate,
    db: Session = Depends(get_db)
):
    """
    Add a journal reflection about the wish
    
    Track your thoughts, feelings, and clarity over time
    """
    try:
        reflection = WishService.add_reflection(
            db,
            wish_id,
            reflection_data.reflection_text,
            reflection_data.mood,
            reflection_data.clarity_score
        )
        return reflection
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{wish_id}/reflections")
def get_reflections(wish_id: int, db: Session = Depends(get_db)):
    """Get all reflections for a wish"""
    reflections = WishService.get_reflections(db, wish_id)
    return reflections


# ============================================================================
# EXPLORATION STEPS ENDPOINTS
# ============================================================================

@router.post("/{wish_id}/steps", status_code=201)
def add_exploration_step(
    wish_id: int,
    step_data: ExplorationStepCreate,
    db: Session = Depends(get_db)
):
    """
    Add a small exploration step toward the wish
    
    Examples: "Research flights to Japan", "Open savings account", "Watch YouTube videos about piano"
    """
    try:
        step = WishService.add_exploration_step(
            db,
            wish_id,
            step_data.step_title,
            step_data.step_description,
            step_data.step_type
        )
        return step
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/steps/{step_id}/complete")
def complete_exploration_step(
    step_id: int,
    completion_data: ExplorationStepComplete,
    db: Session = Depends(get_db)
):
    """Mark an exploration step as complete"""
    step = WishService.complete_exploration_step(db, step_id, completion_data.notes)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    return step


@router.get("/{wish_id}/steps")
def get_exploration_steps(wish_id: int, db: Session = Depends(get_db)):
    """Get all exploration steps for a wish"""
    steps = WishService.get_exploration_steps(db, wish_id)
    return steps


# ============================================================================
# INSPIRATIONS ENDPOINTS
# ============================================================================

@router.post("/{wish_id}/inspirations", status_code=201)
def add_inspiration(
    wish_id: int,
    inspiration_data: InspirationCreate,
    db: Session = Depends(get_db)
):
    """
    Add inspiring content related to the wish
    
    Collect articles, videos, photos, quotes that fuel your dream
    """
    try:
        inspiration = WishService.add_inspiration(
            db,
            wish_id,
            inspiration_data.model_dump()
        )
        return inspiration
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{wish_id}/inspirations")
def get_inspirations(wish_id: int, db: Session = Depends(get_db)):
    """Get all inspirations for a wish"""
    inspirations = WishService.get_inspirations(db, wish_id)
    return inspirations


# ============================================================================
# STATISTICS ENDPOINT
# ============================================================================

@router.get("/{wish_id}/stats")
def get_wish_statistics(wish_id: int, db: Session = Depends(get_db)):
    """
    Get statistics and insights for a wish
    
    Returns:
    - Days dreaming
    - Reflection count
    - Exploration progress
    - Average clarity score
    """
    stats = WishService.get_wish_statistics(db, wish_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Wish not found")
    return stats
