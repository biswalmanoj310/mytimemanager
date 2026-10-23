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
from app.utils.timezone_utils import get_local_now
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
    reopen_challenge,
    graduate_to_habit,
    repeat_challenge,
    recalculate_challenge,
    refresh_active_challenges,
    build_challenge_metrics,
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
    daily_target: Optional[float] = Field(None, gt=0)  # "at least X per day" mode
    required_days: Optional[int] = Field(None, ge=1)  # days that must reach it (None = every day)
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
    daily_target: Optional[float] = Field(None, gt=0)
    required_days: Optional[int] = Field(None, ge=1)
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
    completion_date: Optional[datetime] = None
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
    count_value: Optional[int] = None  # None = keep the stored value
    numeric_value: Optional[float] = None
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
    status_indicator: str
    expected_percentage: float
    projected_percentage: Optional[float] = None
    daily_average: float = 0
    needed_per_day: float = 0
    todays_target: Optional[float] = None
    today_remaining: Optional[float] = None


class GraduateToHabitRequest(BaseModel):
    habit_name: Optional[str] = None
    habit_description: Optional[str] = None


def serialize_challenge(db: Session, challenge) -> dict:
    """Challenge fields + names of linked pillar/category/task/goal/project + live progress metrics"""
    from app.models.goal import LifeGoal
    
    # goal_id holds a Life Goal id (that is what the Add Challenge form links to)
    life_goal = db.query(LifeGoal).filter(LifeGoal.id == challenge.goal_id).first() if challenge.goal_id else None
    
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
        "daily_target": challenge.daily_target,
        "required_days": challenge.required_days,
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
        "goal_name": life_goal.name if life_goal else None,
        "project_name": challenge.project.name if challenge.project else None,
        **build_challenge_metrics(db, challenge),
    }


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
    refresh_active_challenges(db)
    challenges = get_all_challenges(db, status=status, pillar_id=pillar_id)
    return [serialize_challenge(db, challenge) for challenge in challenges]


@router.post("/sync")
def sync_challenges(db: Session = Depends(get_db)):
    """Recalculate all active challenges from the Daily tab / logged entries"""
    refresh_active_challenges(db)
    return {"success": True}


@router.get("/{challenge_id}")
def get_challenge(challenge_id: int, db: Session = Depends(get_db)):
    """Get challenge by ID"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail=f"Challenge {challenge_id} not found")
    if challenge.status == 'active':
        recalculate_challenge(db, challenge)
    return serialize_challenge(db, challenge)


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
        data = challenge.dict()
        if data['end_date'] < data['start_date']:
            raise ValueError("End date cannot be before the start date")
        days_total = (data['end_date'] - data['start_date']).days + 1
        counting = data['challenge_type'] != 'daily_streak'
        if data.get('daily_target') and not counting:
            data['daily_target'] = None  # a plain streak has no amount to reach
        if data.get('required_days') and (not data.get('daily_target') or data['required_days'] > days_total):
            if data.get('daily_target'):
                raise ValueError("Required days cannot exceed the challenge length")
            data['required_days'] = None
        if data['challenge_type'] == 'daily_streak' and not data.get('target_days'):
            data['target_days'] = days_total
        if data.get('daily_target'):
            # Total over the whole challenge is simply minimum x days (informational)
            total = data['daily_target'] * days_total
            if data['challenge_type'] == 'count_based':
                data['target_count'] = max(1, int(round(total)))
            else:
                data['target_value'] = total
        elif data['challenge_type'] == 'count_based' and not data.get('target_count'):
            raise ValueError("Count-based challenges need a target count")
        elif data['challenge_type'] == 'accumulation' and not data.get('target_value'):
            raise ValueError("Accumulation challenges need a target value")
        new_challenge = create_challenge(db, data)
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
    challenge = complete_challenge(db, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail=f"Challenge {challenge_id} not found")
    return challenge


@router.post("/{challenge_id}/abandon", response_model=ChallengeResponse)
def mark_abandoned(challenge_id: int, db: Session = Depends(get_db)):
    """
    Abandon a challenge
    
    Sets status to 'abandoned'. Challenge stays in history but won't show in active list.
    """
    challenge = abandon_challenge(db, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail=f"Challenge {challenge_id} not found")
    return challenge


@router.post("/{challenge_id}/reopen", response_model=ChallengeResponse)
def reopen_existing_challenge(challenge_id: int, db: Session = Depends(get_db)):
    """Bring an abandoned/failed/completed challenge back to active"""
    challenge = reopen_challenge(db, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail=f"Challenge {challenge_id} not found")
    return challenge


@router.post("/{challenge_id}/graduate", response_model=dict)
def graduate_challenge(
    challenge_id: int,
    graduate_request: GraduateToHabitRequest,
    db: Session = Depends(get_db)
):
    """
    Graduate a completed challenge to a permanent habit
    
    - Creates a daily habit carrying over the challenge's pillar, category, task link and "why"
    - Marks challenge as having graduated
    """
    try:
        result = graduate_to_habit(
            db,
            challenge_id,
            habit_name=graduate_request.habit_name,
            habit_description=graduate_request.habit_description
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail=f"Challenge {challenge_id} not found")
    return result


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
    from app.models.models import Challenge
    
    refresh_active_challenges(db)
    today = get_local_now().date()
    
    # Get all active challenges (not completed, failed, or abandoned)
    challenges = db.query(Challenge).filter(
        Challenge.is_active == True,
        Challenge.status == 'active',
        Challenge.start_date <= today,
        Challenge.end_date >= today
    ).all()
    
    return [serialize_challenge(db, challenge) for challenge in challenges]


@router.post("/{challenge_id}/log-today")
def log_challenge_today(
    challenge_id: int,
    is_completed: bool = True,
    value: Optional[float] = None,
    note: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Quick action to log today's challenge entry"""
    today = get_local_now().date()
    
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
