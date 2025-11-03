"""
Challenges API Routes
Time-bound personal challenges (7-30 day experiments)
"""
from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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
    can_graduate_to_habit: bool = False


class ChallengeCreate(ChallengeBase):
    pass


class ChallengeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    end_date: Optional[date] = None
    target_days: Optional[int] = None
    target_count: Optional[int] = None
    target_value: Optional[float] = None
    difficulty: Optional[str] = Field(None, pattern="^(easy|medium|hard)$")
    reward: Optional[str] = None
    why_reason: Optional[str] = None
    can_graduate_to_habit: Optional[bool] = None


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

@router.get("/", response_model=List[ChallengeResponse])
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
    return challenges


@router.get("/{challenge_id}", response_model=ChallengeResponse)
def get_challenge(challenge_id: int, db: Session = Depends(get_db)):
    """Get challenge by ID"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail=f"Challenge {challenge_id} not found")
    return challenge


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
        entry_data = entry.dict()
        new_entry = log_challenge_entry(db, challenge_id, entry_data)
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
