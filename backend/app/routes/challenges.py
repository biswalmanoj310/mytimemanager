"""
Challenges API Routes
Time-bound personal challenges (7-30 day experiments)
"""
from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from pydantic import BaseModel, Field

from app.database.config import get_db
from app.services.challenge_service import (
    get_all_challenges,
    get_challenge_by_id,
    create_challenge,
    update_challenge,
    delete_challenge,
    log_challenge_entry,
    get_challenge_entries,
    get_challenge_stats,
    complete_challenge,
    abandon_challenge,
    graduate_to_habit,
    repeat_challenge
)

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


# ===== Pydantic Schemas =====

class ChallengeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    challenge_type: str = Field(..., pattern="^(daily_streak|count_based|accumulation)$")
    start_date: date
    end_date: date
    target_days: Optional[int] = None
    target_count: Optional[int] = None
    target_value: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=50)
    difficulty: Optional[str] = Field(None, pattern="^(easy|medium|hard)$")
    reward: Optional[str] = None
    why_reason: Optional[str] = None
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    linked_task_id: Optional[int] = None
    goal_id: Optional[int] = None
    project_id: Optional[int] = None
    auto_sync: bool = False  # Auto-sync progress from linked task
    can_graduate_to_habit: bool = False


class ChallengeCreate(ChallengeBase):
    pass


class ChallengeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    challenge_type: Optional[str] = Field(None, pattern="^(daily_streak|count_based|accumulation)$")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    target_days: Optional[int] = None
    target_count: Optional[int] = None
    target_value: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=50)
    difficulty: Optional[str] = Field(None, pattern="^(easy|medium|hard)$")
    reward: Optional[str] = None
    why_reason: Optional[str] = None
    pillar_id: Optional[int] = None
    can_graduate_to_habit: Optional[bool] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    linked_task_id: Optional[int] = None
    auto_sync: Optional[bool] = None  # Auto-sync progress from linked task
    goal_id: Optional[int] = None
    project_id: Optional[int] = None


class ChallengeResponse(ChallengeBase):
    id: int
    current_streak: int
    longest_streak: int
    completed_days: int
    current_count: int
    current_value: float
    status: str
    is_completed: bool
    completion_date: Optional[date] = None
    graduated_habit_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Pillar details for frontend display
    pillar_name: Optional[str] = None
    pillar_color: Optional[str] = None
    # Category details
    category_name: Optional[str] = None
    # Task details
    linked_task_name: Optional[str] = None
    # Goal details
    goal_name: Optional[str] = None
    # Project details
    project_name: Optional[str] = None

    class Config:
        from_attributes = True


class ChallengeEntryLog(BaseModel):
    entry_date: date
    is_completed: bool = False
    count_value: Optional[int] = 0
    numeric_value: Optional[float] = 0.0
    note: Optional[str] = None
    mood: Optional[str] = Field(None, pattern="^(great|good|okay|struggled)$")


class ChallengeEntryResponse(BaseModel):
    id: int
    challenge_id: int
    entry_date: date
    is_completed: bool
    count_value: int
    numeric_value: float
    note: Optional[str] = None
    mood: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChallengeStatsResponse(BaseModel):
    challenge_id: int
    challenge_name: str
    challenge_type: str
    status: str
    days_elapsed: int
    days_remaining: int
    total_days: int
    completed_days: int
    completion_rate: float
    current_streak: int
    longest_streak: int
    current_count: int
    target_count: Optional[int] = None
    current_value: float
    target_value: Optional[float] = None
    success_rate: float
    is_on_track: bool
    is_completed: bool


class GraduateToHabitRequest(BaseModel):
    habit_name: Optional[str] = None
    habit_description: Optional[str] = None


# ===== Endpoints =====

@router.get("/")
def list_challenges(
    status: Optional[str] = None,
    pillar_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    List all challenges with optional filtering
    
    - **status**: Filter by status (active, completed, failed, abandoned)
    - **pillar_id**: Filter by pillar
    """
    challenges = get_all_challenges(db, status=status, pillar_id=pillar_id)
    
    # Manually construct response with pillar details
    result = []
    for challenge in challenges:
        challenge_dict = {
            "id": challenge.id,
            "name": challenge.name,
            "description": challenge.description,
            "challenge_type": challenge.challenge_type,
            "start_date": challenge.start_date,
            "end_date": challenge.end_date,
            "target_days": challenge.target_days,
            "target_count": challenge.target_count,
            "target_value": challenge.target_value,
            "unit": challenge.unit,
            "difficulty": challenge.difficulty,
            "reward": challenge.reward,
            "why_reason": challenge.why_reason,
            "pillar_id": challenge.pillar_id,
            "category_id": challenge.category_id,
            "sub_category_id": challenge.sub_category_id,
            "linked_task_id": challenge.linked_task_id,
            "goal_id": challenge.goal_id,
            "project_id": challenge.project_id,
            "auto_sync": challenge.auto_sync,
            "can_graduate_to_habit": challenge.can_graduate_to_habit,
            "current_streak": challenge.current_streak,
            "longest_streak": challenge.longest_streak,
            "completed_days": challenge.completed_days,
            "current_count": challenge.current_count,
            "current_value": challenge.current_value,
            "status": challenge.status,
            "is_completed": challenge.is_completed,
            "completion_date": challenge.completion_date,
            "graduated_habit_id": challenge.graduated_habit_id,
            "created_at": challenge.created_at,
            "updated_at": challenge.updated_at,
            "pillar_name": challenge.pillar.name if challenge.pillar else None,
            "pillar_color": challenge.pillar.color_code if challenge.pillar else None,
            "category_name": challenge.category.name if challenge.category else None,
            "sub_category_name": challenge.sub_category.name if challenge.sub_category else None,
            "linked_task_name": challenge.linked_task.name if challenge.linked_task else None,
            "goal_name": challenge.goal.name if challenge.goal else None,
            "project_name": challenge.project.name if challenge.project else None,
        }
        result.append(challenge_dict)
    
    return result


@router.get("/{challenge_id}")
def get_challenge(challenge_id: int, db: Session = Depends(get_db)):
    """Get challenge by ID"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail=f"Challenge {challenge_id} not found")
    
    # Include pillar details
    return {
        "id": challenge.id,
        "name": challenge.name,
        "description": challenge.description,
        "challenge_type": challenge.challenge_type,
        "start_date": challenge.start_date,
        "end_date": challenge.end_date,
        "target_days": challenge.target_days,
        "target_count": challenge.target_count,
        "target_value": challenge.target_value,
        "unit": challenge.unit,
        "difficulty": challenge.difficulty,
        "reward": challenge.reward,
        "why_reason": challenge.why_reason,
        "pillar_id": challenge.pillar_id,
        "category_id": challenge.category_id,
        "sub_category_id": challenge.sub_category_id,
        "linked_task_id": challenge.linked_task_id,
        "goal_id": challenge.goal_id,
        "project_id": challenge.project_id,
        "auto_sync": challenge.auto_sync,
        "can_graduate_to_habit": challenge.can_graduate_to_habit,
        "current_streak": challenge.current_streak,
        "longest_streak": challenge.longest_streak,
        "completed_days": challenge.completed_days,
        "current_count": challenge.current_count,
        "current_value": challenge.current_value,
        "status": challenge.status,
        "is_completed": challenge.is_completed,
        "completion_date": challenge.completion_date,
        "graduated_habit_id": challenge.graduated_habit_id,
        "created_at": challenge.created_at,
        "updated_at": challenge.updated_at,
        "pillar_name": challenge.pillar.name if challenge.pillar else None,
        "pillar_color": challenge.pillar.color_code if challenge.pillar else None,
        "category_name": challenge.category.name if challenge.category else None,
        "sub_category_name": challenge.sub_category.name if challenge.sub_category else None,
        "linked_task_name": challenge.linked_task.name if challenge.linked_task else None,
        "goal_name": challenge.goal.name if challenge.goal else None,
        "project_name": challenge.project.name if challenge.project else None,
    }


@router.post("/", response_model=ChallengeResponse, status_code=201)
def create_new_challenge(challenge: ChallengeCreate, db: Session = Depends(get_db)):
    """
    Create a new challenge
    
    Required fields based on challenge_type:
    - **daily_streak**: target_days
    - **count_based**: target_count, unit
    - **accumulation**: target_value, unit
    """
    try:
        new_challenge = create_challenge(db, challenge.dict())
        return new_challenge
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{challenge_id}", response_model=ChallengeResponse)
def update_existing_challenge(
    challenge_id: int,
    challenge_update: ChallengeUpdate,
    db: Session = Depends(get_db)
):
    """Update challenge details"""
    challenge = update_challenge(db, challenge_id, challenge_update.dict(exclude_unset=True))
    if not challenge:
        raise HTTPException(status_code=404, detail=f"Challenge {challenge_id} not found")
    return challenge


@router.delete("/{challenge_id}", status_code=204)
def delete_existing_challenge(challenge_id: int, db: Session = Depends(get_db)):
    """Delete a challenge"""
    success = delete_challenge(db, challenge_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Challenge {challenge_id} not found")


@router.post("/{challenge_id}/log", response_model=ChallengeEntryResponse)
def log_entry(
    challenge_id: int,
    entry: ChallengeEntryLog,
    db: Session = Depends(get_db)
):
    """
    Log a daily entry for the challenge
    
    Creates or updates entry for the given date.
    Automatically updates challenge progress and streaks.
    """
    try:
        # Unpack the entry data to match function signature
        new_entry = log_challenge_entry(
            db=db,
            challenge_id=challenge_id,
            entry_date=entry.entry_date,
            is_completed=entry.is_completed,
            count_value=entry.count_value,
            numeric_value=entry.numeric_value,
            note=entry.note,
            mood=entry.mood
        )
        return new_entry
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{challenge_id}/entries", response_model=List[ChallengeEntryResponse])
def get_entries(
    challenge_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    Get all entries for a challenge
    
    - **start_date**: Filter entries from this date
    - **end_date**: Filter entries to this date
    """
    entries = get_challenge_entries(db, challenge_id, start_date, end_date)
    return entries


@router.get("/{challenge_id}/stats", response_model=ChallengeStatsResponse)
def get_stats(challenge_id: int, db: Session = Depends(get_db)):
    """
    Get detailed statistics for a challenge
    
    Includes:
    - Progress metrics (days, completion rate)
    - Streak information
    - Success rate and on-track status
    """
    stats = get_challenge_stats(db, challenge_id)
    if not stats:
        raise HTTPException(status_code=404, detail=f"Challenge {challenge_id} not found")
    return stats


@router.post("/{challenge_id}/complete", response_model=ChallengeResponse)
def mark_complete(challenge_id: int, db: Session = Depends(get_db)):
    """
    Mark challenge as completed
    
    Sets status to 'completed' and records completion date.
    """
    try:
        challenge = complete_challenge(db, challenge_id)
        return challenge
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{challenge_id}/abandon", response_model=ChallengeResponse)
def mark_abandoned(challenge_id: int, db: Session = Depends(get_db)):
    """
    Abandon a challenge
    
    Sets status to 'abandoned'. Challenge stays in history but won't show in active list.
    """
    try:
        challenge = abandon_challenge(db, challenge_id)
        return challenge
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{challenge_id}/graduate", response_model=dict)
def graduate_challenge(
    challenge_id: int,
    graduate_request: GraduateToHabitRequest,
    db: Session = Depends(get_db)
):
    """
    Graduate a completed challenge to a permanent habit
    
    - Creates a new habit linked to the challenge's pillar
    - Marks challenge as having graduated
    - Returns both challenge and new habit
    """
    try:
        result = graduate_to_habit(
            db,
            challenge_id,
            habit_name=graduate_request.habit_name,
            habit_description=graduate_request.habit_description
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{challenge_id}/repeat", response_model=ChallengeResponse, status_code=201)
def repeat_existing_challenge(
    challenge_id: int,
    new_start_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    Repeat a challenge with the same settings
    
    - Creates a new challenge with same name, type, and targets
    - Resets all progress counters to zero
    - Starts from today or specified date
    - Duration matches original challenge
    """
    from app.services.challenge_service import repeat_challenge
    
    repeated = repeat_challenge(db, challenge_id, new_start_date)
    if not repeated:
        raise HTTPException(status_code=404, detail=f"Challenge {challenge_id} not found")
    
    return repeated


@router.get("/today/active")
def get_todays_active_challenges(db: Session = Depends(get_db)):
    """Get all active challenges for today with progress and status"""
    from app.models.models import Challenge, ChallengeEntry
    
    today = datetime.now().date()
    
    # Get all active challenges (not completed, failed, or abandoned)
    challenges = db.query(Challenge).filter(
        Challenge.is_active == True,
        Challenge.status == 'active',
        Challenge.start_date <= today,
        Challenge.end_date >= today
    ).all()
    
    result = []
    for challenge in challenges:
        # Calculate days remaining
        days_total = (challenge.end_date - challenge.start_date).days + 1
        days_elapsed = (today - challenge.start_date).days + 1
        days_remaining = (challenge.end_date - today).days
        
        # Check if there's an entry for today
        today_entry = None
        today_value = None
        completed_today = False
        
        if challenge.auto_sync and challenge.linked_task_id:
            # For auto-synced challenges, fetch from daily_time_entries
            from app.models.models import DailyTimeEntry
            total_minutes = db.query(func.sum(DailyTimeEntry.minutes)).filter(
                DailyTimeEntry.task_id == challenge.linked_task_id,
                func.date(DailyTimeEntry.entry_date) == today
            ).scalar() or 0.0
            
            if total_minutes > 0:
                completed_today = True
                today_value = float(total_minutes)
        else:
            # For manual challenges, check challenge_entries
            today_entry = db.query(ChallengeEntry).filter(
                and_(
                    ChallengeEntry.challenge_id == challenge.id,
                    ChallengeEntry.entry_date == today
                )
            ).first()
            
            if today_entry:
                completed_today = today_entry.is_completed
                today_value = today_entry.numeric_value
        
        # Calculate progress percentage
        progress_pct = 0
        if challenge.challenge_type == 'daily_streak':
            progress_pct = (challenge.completed_days / challenge.target_days * 100) if challenge.target_days else 0
        elif challenge.challenge_type == 'count_based':
            progress_pct = (challenge.current_count / challenge.target_count * 100) if challenge.target_count else 0
        elif challenge.challenge_type == 'accumulation':
            progress_pct = (challenge.current_value / challenge.target_value * 100) if challenge.target_value else 0
        
        # Determine status color (on track, at risk, behind)
        expected_progress = (days_elapsed / days_total * 100)
        status_indicator = 'on_track'
        if progress_pct < expected_progress - 15:
            status_indicator = 'behind'
        elif progress_pct < expected_progress - 5:
            status_indicator = 'at_risk'
        
        # Get pillar color
        pillar_color = None
        if challenge.pillar:
            pillar_color = challenge.pillar.color_code
        
        # Calculate daily average for accumulation challenges
        daily_average = 0
        if challenge.challenge_type == 'accumulation' and days_elapsed > 0:
            daily_average = challenge.current_value / days_elapsed
        
        result.append({
            "id": challenge.id,
            "name": challenge.name,
            "description": challenge.description,
            "challenge_type": challenge.challenge_type,
            "pillar_id": challenge.pillar_id,
            "pillar_name": challenge.pillar.name if challenge.pillar else None,
            "pillar_color": pillar_color,
            "category_id": challenge.category_id,
            "category_name": challenge.category.name if challenge.category else None,
            "sub_category_name": challenge.sub_category.name if challenge.sub_category else None,
            "linked_task_name": challenge.linked_task.name if challenge.linked_task else None,
            "goal_id": challenge.goal_id,
            "goal_name": challenge.goal.name if challenge.goal else None,
            "project_id": challenge.project_id,
            "project_name": challenge.project.name if challenge.project else None,
            "start_date": challenge.start_date,
            "end_date": challenge.end_date,
            "days_total": days_total,
            "days_elapsed": days_elapsed,
            "days_remaining": days_remaining,
            "target_days": challenge.target_days,
            "target_count": challenge.target_count,
            "target_value": challenge.target_value,
            "unit": challenge.unit,
            "current_streak": challenge.current_streak,
            "completed_days": challenge.completed_days,
            "current_count": challenge.current_count,
            "current_value": challenge.current_value,
            "progress_percentage": round(progress_pct, 1),
            "status_indicator": status_indicator,
            "completed_today": completed_today,
            "today_value": today_value,
            "difficulty": challenge.difficulty,
            "reward": challenge.reward,
            # Daily average for accumulation challenges
            "daily_average": round(daily_average, 2)
        })
    
    return result


@router.post("/{challenge_id}/log-today")
def log_challenge_today(
    challenge_id: int,
    is_completed: bool = True,
    value: Optional[float] = None,
    note: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Quick action to log today's challenge entry"""
    from datetime import datetime
    
    today = datetime.now().date()
    
    try:
        entry = log_challenge_entry(
            db,
            challenge_id,
            today,
            is_completed=is_completed,
            count_value=int(value) if value and isinstance(value, (int, float)) else None,
            numeric_value=value,
            note=note
        )
        
        # Get updated challenge
        challenge = get_challenge_by_id(db, challenge_id)
        
        return {
            "success": True,
            "entry_date": entry.entry_date,
            "is_completed": entry.is_completed,
            "value": entry.numeric_value,
            "current_streak": challenge.current_streak,
            "current_count": challenge.current_count,
            "current_value": challenge.current_value
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
