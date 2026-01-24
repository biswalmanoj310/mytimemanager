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
from app.models.models import Wish


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
        return wish.to_dict()
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
    - status: dreaming, exploring, ready, moved_to_goal, achieved, released
    - category: travel, financial, personal, career, health, relationship, learning, lifestyle
    - include_archived: Include archived wishes (default: false)
    """
    wishes = WishService.get_all_wishes(
        db,
        status=status,
        category=category,
        include_archived=include_archived
    )
    return [wish.to_dict() for wish in wishes]


@router.get("/{wish_id}")
def get_wish(wish_id: int, db: Session = Depends(get_db)):
    """Get a specific wish by ID"""
    wish = WishService.get_wish(db, wish_id)
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    return wish.to_dict()


@router.put("/{wish_id}")
def update_wish(wish_id: int, updates: WishUpdate, db: Session = Depends(get_db)):
    """Update a wish"""
    # Filter out None values
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    wish = WishService.update_wish(db, wish_id, update_data)
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    return wish.to_dict()


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
    return wish.to_dict()


@router.post("/{wish_id}/promote-to-goal", status_code=201)
def promote_to_goal(wish_id: int, db: Session = Depends(get_db)):
    """
    🚀 Promote a dream to a committed Life Goal
    
    This automatically:
    1. Creates a new Life Goal from the dream
    2. Sets start_date = today
    3. Updates dream status to 'moved_to_goal'
    4. Links the dream to the new goal
    
    Returns the newly created goal
    """
    import json
    try:
        goal = WishService.promote_dream_to_goal(db, wish_id)
        # Format goal as dictionary
        return {
            "id": goal.id,
            "name": goal.name,
            "parent_goal_id": goal.parent_goal_id,
            "start_date": goal.start_date.isoformat() if goal.start_date else None,
            "target_date": goal.target_date.isoformat() if goal.target_date else None,
            "actual_completion_date": goal.actual_completion_date.isoformat() if goal.actual_completion_date else None,
            "status": goal.status,
            "category": goal.category,
            "priority": goal.priority,
            "why_statements": json.loads(goal.why_statements) if goal.why_statements else [],
            "description": goal.description,
            "progress_percentage": goal.progress_percentage,
            "time_allocated_hours": goal.time_allocated_hours,
            "time_spent_hours": goal.time_spent_hours,
            "created_at": goal.created_at.isoformat() if goal.created_at else None,
            "updated_at": goal.updated_at.isoformat() if goal.updated_at else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{wish_id}/mark-achieved")
def mark_dream_achieved(
    wish_id: int,
    achievement_notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    ✨ Mark a dream as manifested/achieved
    
    Use this when a dream came true without formal goal tracking
    """
    wish = WishService.mark_achieved(db, wish_id, achievement_notes)
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    return wish.to_dict()


@router.post("/{wish_id}/release")
def release_dream(
    wish_id: int,
    release_reason: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    🕊️ Release a dream with gratitude
    
    Let go peacefully when a dream no longer resonates
    """
    wish = WishService.release_dream(db, wish_id, release_reason)
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    return wish.to_dict()


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


@router.delete("/{wish_id}/reflections/{reflection_id}")
def delete_reflection(
    wish_id: int,
    reflection_id: int,
    db: Session = Depends(get_db)
):
    """Delete a reflection"""
    from app.models.models import WishReflection
    reflection = db.query(WishReflection).filter(
        WishReflection.id == reflection_id,
        WishReflection.wish_id == wish_id
    ).first()
    if not reflection:
        raise HTTPException(status_code=404, detail="Reflection not found")
    db.delete(reflection)
    db.commit()
    return {"message": "Reflection deleted successfully"}


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


@router.post("/steps/{step_id}/uncomplete")
def uncomplete_exploration_step(
    step_id: int,
    db: Session = Depends(get_db)
):
    """Mark an exploration step as incomplete (undo completion)"""
    step = WishService.uncomplete_exploration_step(db, step_id)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    return step


@router.get("/{wish_id}/steps")
def get_exploration_steps(wish_id: int, db: Session = Depends(get_db)):
    """Get all exploration steps for a wish"""
    steps = WishService.get_exploration_steps(db, wish_id)
    return steps


@router.put("/{wish_id}/steps/{step_id}")
def update_exploration_step(
    wish_id: int,
    step_id: int,
    step_data: dict,
    db: Session = Depends(get_db)
):
    """Update an exploration step"""
    from app.models.models import WishExplorationStep
    step = db.query(WishExplorationStep).filter(
        WishExplorationStep.id == step_id,
        WishExplorationStep.wish_id == wish_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    
    for key, value in step_data.items():
        if hasattr(step, key):
            setattr(step, key, value)
    
    db.commit()
    db.refresh(step)
    return step


@router.delete("/{wish_id}/steps/{step_id}")
def delete_exploration_step(
    wish_id: int,
    step_id: int,
    db: Session = Depends(get_db)
):
    """Delete an exploration step"""
    from app.models.models import WishExplorationStep
    step = db.query(WishExplorationStep).filter(
        WishExplorationStep.id == step_id,
        WishExplorationStep.wish_id == wish_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    db.delete(step)
    db.commit()
    return {"message": "Exploration step deleted successfully"}


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
# DREAM TASKS ENDPOINTS (parent-child hierarchical tasks for wishes)
# ============================================================================

class WishTaskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_task_id: Optional[int] = None
    due_date: Optional[date] = None
    priority: Optional[str] = 'medium'


class WishTaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_task_id: Optional[int] = None
    due_date: Optional[date] = None
    priority: Optional[str] = None
    is_completed: Optional[bool] = None
    order: Optional[int] = None


@router.post("/{wish_id}/tasks", status_code=201)
def create_dream_task(
    wish_id: int, 
    task_data: WishTaskCreate, 
    db: Session = Depends(get_db)
):
    """
    Create a new dream task for a wish
    Supports parent-child hierarchy like project tasks
    """
    # Verify wish exists
    wish = db.query(Wish).filter(Wish.id == wish_id).first()
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    
    # Create task
    from app.models.models import WishTask
    new_task = WishTask(
        wish_id=wish_id,
        name=task_data.name,
        description=task_data.description,
        parent_task_id=task_data.parent_task_id,
        due_date=task_data.due_date,
        priority=task_data.priority or 'medium'
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task.to_dict()


@router.get("/{wish_id}/tasks")
def get_dream_tasks(wish_id: int, db: Session = Depends(get_db)):
    """
    Get all dream tasks for a wish
    Returns tasks in hierarchical structure
    """
    # Verify wish exists
    wish = db.query(Wish).filter(Wish.id == wish_id).first()
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    
    from app.models.models import WishTask
    tasks = db.query(WishTask).filter(WishTask.wish_id == wish_id).order_by(WishTask.order).all()
    return [task.to_dict() for task in tasks]


@router.put("/{wish_id}/tasks/{task_id}")
def update_dream_task(
    wish_id: int,
    task_id: int,
    task_data: WishTaskUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a dream task
    """
    from app.models.models import WishTask
    task = db.query(WishTask).filter(
        WishTask.id == task_id,
        WishTask.wish_id == wish_id
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Dream task not found")
    
    # Update fields
    if task_data.name is not None:
        task.name = task_data.name
    if task_data.description is not None:
        task.description = task_data.description
    if task_data.parent_task_id is not None:
        task.parent_task_id = task_data.parent_task_id
    if task_data.due_date is not None:
        task.due_date = task_data.due_date
    if task_data.priority is not None:
        task.priority = task_data.priority
    if task_data.is_completed is not None:
        task.is_completed = task_data.is_completed
        if task_data.is_completed:
            from datetime import datetime
            task.completed_at = datetime.now()
        else:
            task.completed_at = None
    if task_data.order is not None:
        task.order = task_data.order
    
    db.commit()
    db.refresh(task)
    return task.to_dict()


@router.delete("/{wish_id}/tasks/{task_id}", status_code=204)
def delete_dream_task(wish_id: int, task_id: int, db: Session = Depends(get_db)):
    """
    Delete a dream task
    """
    from app.models.models import WishTask
    task = db.query(WishTask).filter(
        WishTask.id == task_id,
        WishTask.wish_id == wish_id
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Dream task not found")
    
    db.delete(task)
    db.commit()
    return None


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
