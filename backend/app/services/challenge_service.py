"""
Challenge Service - Handle time-bound personal challenges (7-30 days)
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict
from app.models.models import Challenge, ChallengeEntry


# ============ Challenge CRUD Operations ============

def get_all_challenges(db: Session, include_completed: bool = True, status: Optional[str] = None, pillar_id: Optional[int] = None) -> List[Challenge]:
    """Get all challenges, optionally filtered by status and pillar"""
    query = db.query(Challenge)
    
    if not include_completed:
        query = query.filter(Challenge.is_completed == False)
    
    if status:
        query = query.filter(Challenge.status == status)
    
    if pillar_id:
        query = query.filter(Challenge.pillar_id == pillar_id)
    
    return query.order_by(Challenge.start_date.desc()).all()


def get_active_challenges(db: Session) -> List[Challenge]:
    """Get only active challenges"""
    return get_all_challenges(db, status='active')


def get_challenge_by_id(db: Session, challenge_id: int) -> Optional[Challenge]:
    """Get challenge by ID"""
    return db.query(Challenge).filter(Challenge.id == challenge_id).first()


def create_challenge(db: Session, challenge_data: dict) -> Challenge:
    """Create a new challenge"""
    # Extract data from dict
    challenge = Challenge(
        name=challenge_data['name'],
        description=challenge_data.get('description'),
        challenge_type=challenge_data['challenge_type'],
        start_date=challenge_data['start_date'],
        end_date=challenge_data['end_date'],
        target_days=challenge_data.get('target_days'),
        target_count=challenge_data.get('target_count'),
        target_value=challenge_data.get('target_value'),
        unit=challenge_data.get('unit'),
        difficulty=challenge_data.get('difficulty', 'medium'),
        reward=challenge_data.get('reward'),
        why_reason=challenge_data.get('why_reason'),
        pillar_id=challenge_data.get('pillar_id'),
        can_graduate_to_habit=challenge_data.get('can_graduate_to_habit', False),
        status='active'
    )
    
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    
    return challenge


def update_challenge(
    db: Session,
    challenge_id: int,
    **kwargs
) -> Optional[Challenge]:
    """Update challenge fields"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return None
    
    for key, value in kwargs.items():
        if hasattr(challenge, key) and value is not None:
            setattr(challenge, key, value)
    
    challenge.updated_at = datetime.now()
    db.commit()
    db.refresh(challenge)
    
    return challenge


def delete_challenge(db: Session, challenge_id: int) -> bool:
    """Delete a challenge"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return False
    
    db.delete(challenge)
    db.commit()
    return True


# ============ Challenge Entry Operations ============

def get_challenge_entries(db: Session, challenge_id: int) -> List[ChallengeEntry]:
    """Get all entries for a challenge"""
    return db.query(ChallengeEntry).filter(
        ChallengeEntry.challenge_id == challenge_id
    ).order_by(ChallengeEntry.entry_date).all()


def get_entry_by_date(db: Session, challenge_id: int, entry_date: date) -> Optional[ChallengeEntry]:
    """Get specific entry for a challenge on a date"""
    return db.query(ChallengeEntry).filter(
        and_(
            ChallengeEntry.challenge_id == challenge_id,
            ChallengeEntry.entry_date == entry_date
        )
    ).first()


def log_challenge_entry(
    db: Session,
    challenge_id: int,
    entry_date: date,
    is_completed: bool = True,
    count_value: Optional[int] = None,
    numeric_value: Optional[float] = None,
    note: Optional[str] = None,
    mood: Optional[str] = None
) -> ChallengeEntry:
    """Log a challenge entry for a specific date"""
    # Check if entry already exists
    existing = get_entry_by_date(db, challenge_id, entry_date)
    
    if existing:
        # Update existing entry
        existing.is_completed = is_completed
        existing.count_value = count_value or existing.count_value
        existing.numeric_value = numeric_value or existing.numeric_value
        existing.note = note or existing.note
        existing.mood = mood or existing.mood
        entry = existing
    else:
        # Create new entry
        entry = ChallengeEntry(
            challenge_id=challenge_id,
            entry_date=entry_date,
            is_completed=is_completed,
            count_value=count_value or 0,
            numeric_value=numeric_value or 0.0,
            note=note,
            mood=mood
        )
        db.add(entry)
    
    db.commit()
    db.refresh(entry)
    
    # Update challenge progress
    update_challenge_progress(db, challenge_id)
    
    return entry


# ============ Challenge Progress Tracking ============

def update_challenge_progress(db: Session, challenge_id: int) -> None:
    """Recalculate and update challenge progress/streaks"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return
    
    entries = get_challenge_entries(db, challenge_id)
    completed_entries = [e for e in entries if e.is_completed]
    
    # Update completed days
    challenge.completed_days = len(completed_entries)
    
    # Calculate current streak (consecutive days from today backward)
    current_streak = calculate_current_streak(entries)
    challenge.current_streak = current_streak
    
    # Update longest streak if current is higher
    if current_streak > challenge.longest_streak:
        challenge.longest_streak = current_streak
    
    # For count-based challenges
    if challenge.challenge_type == 'count_based':
        challenge.current_count = sum(e.count_value or 0 for e in completed_entries)
    
    # For accumulation challenges
    if challenge.challenge_type == 'accumulation':
        challenge.current_value = sum(e.numeric_value or 0.0 for e in completed_entries)
    
    # Check if challenge is completed
    check_challenge_completion(db, challenge)
    
    challenge.updated_at = datetime.now()
    db.commit()


def calculate_current_streak(entries: List[ChallengeEntry]) -> int:
    """Calculate current consecutive streak ending today"""
    if not entries:
        return 0
    
    # Sort by date descending
    sorted_entries = sorted(entries, key=lambda e: e.entry_date, reverse=True)
    
    today = date.today()
    streak = 0
    check_date = today
    
    for entry in sorted_entries:
        if entry.entry_date == check_date and entry.is_completed:
            streak += 1
            check_date -= timedelta(days=1)
        elif entry.entry_date < check_date:
            # Gap in streak
            break
    
    return streak


def check_challenge_completion(db: Session, challenge: Challenge) -> None:
    """Check if challenge should be marked as completed"""
    is_complete = False
    
    if challenge.challenge_type == 'daily_streak':
        # Check if target days reached
        if challenge.target_days and challenge.completed_days >= challenge.target_days:
            is_complete = True
    
    elif challenge.challenge_type == 'count_based':
        # Check if target count reached
        if challenge.target_count and challenge.current_count >= challenge.target_count:
            is_complete = True
    
    elif challenge.challenge_type == 'accumulation':
        # Check if target value reached
        if challenge.target_value and challenge.current_value >= challenge.target_value:
            is_complete = True
    
    # Also check if end date passed
    if date.today() > challenge.end_date:
        if is_complete:
            challenge.status = 'completed'
            challenge.is_completed = True
            challenge.completion_date = datetime.now()
        else:
            challenge.status = 'failed'
    elif is_complete:
        challenge.status = 'completed'
        challenge.is_completed = True
        challenge.completion_date = datetime.now()


# ============ Challenge Statistics ============

def get_challenge_stats(db: Session, challenge_id: int) -> Dict:
    """Get detailed statistics for a challenge"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return {}
    
    entries = get_challenge_entries(db, challenge_id)
    completed_entries = [e for e in entries if e.is_completed]
    
    # Calculate days elapsed
    today = date.today()
    start = challenge.start_date
    end = challenge.end_date
    
    days_elapsed = max(0, (today - start).days + 1) if today >= start else 0
    days_remaining = max(0, (end - today).days) if today <= end else 0
    total_duration = (end - start).days + 1
    
    # Calculate success rate
    success_rate = (len(completed_entries) / days_elapsed * 100) if days_elapsed > 0 else 0
    
    # Expected progress
    expected_progress = (days_elapsed / total_duration * 100) if total_duration > 0 else 0
    
    # Actual progress
    if challenge.challenge_type == 'daily_streak':
        actual_progress = (challenge.completed_days / challenge.target_days * 100) if challenge.target_days else 0
    elif challenge.challenge_type == 'count_based':
        actual_progress = (challenge.current_count / challenge.target_count * 100) if challenge.target_count else 0
    else:  # accumulation
        actual_progress = (challenge.current_value / challenge.target_value * 100) if challenge.target_value else 0
    
    return {
        "challenge_id": challenge.id,
        "name": challenge.name,
        "status": challenge.status,
        "challenge_type": challenge.challenge_type,
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "total_duration": total_duration,
        "completed_days": challenge.completed_days,
        "current_streak": challenge.current_streak,
        "longest_streak": challenge.longest_streak,
        "success_rate": round(success_rate, 1),
        "expected_progress": round(expected_progress, 1),
        "actual_progress": round(actual_progress, 1),
        "is_on_track": actual_progress >= expected_progress - 10,  # Allow 10% tolerance
        "total_entries": len(entries),
        "completed_entries": len(completed_entries)
    }


# ============ Challenge Actions ============

def complete_challenge(db: Session, challenge_id: int) -> Optional[Challenge]:
    """Mark challenge as manually completed"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return None
    
    challenge.status = 'completed'
    challenge.is_completed = True
    challenge.completion_date = datetime.now()
    challenge.updated_at = datetime.now()
    
    db.commit()
    db.refresh(challenge)
    
    return challenge


def abandon_challenge(db: Session, challenge_id: int) -> Optional[Challenge]:
    """Mark challenge as abandoned"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return None
    
    challenge.status = 'abandoned'
    challenge.updated_at = datetime.now()
    
    db.commit()
    db.refresh(challenge)
    
    return challenge


def graduate_to_habit(db: Session, challenge_id: int, habit_data: Dict) -> Optional[Challenge]:
    """
    Convert a successful challenge into a permanent habit
    This creates a new habit based on challenge parameters
    """
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge or not challenge.is_completed:
        return None
    
    # Import habit creation here to avoid circular imports
    from app.services import habit_service
    
    # Create habit based on challenge type
    habit = habit_service.create_habit(
        db=db,
        name=habit_data.get('name', challenge.name),
        description=habit_data.get('description', f"Graduated from challenge: {challenge.name}"),
        habit_type=habit_data.get('habit_type', 'boolean'),
        target_frequency=habit_data.get('target_frequency', 'daily'),
        is_positive=habit_data.get('is_positive', True),
        why_reason=challenge.why_reason,
        start_date=date.today(),
        linked_task_id=habit_data.get('linked_task_id'),
        pillar_id=challenge.pillar_id
    )
    
    # Link back to challenge
    challenge.graduated_habit_id = habit.id
    challenge.updated_at = datetime.now()
    
    db.commit()
    db.refresh(challenge)
    
    return challenge


def repeat_challenge(db: Session, challenge_id: int, new_start_date: Optional[date] = None) -> Optional[Challenge]:
    """
    Create a new challenge by repeating a completed/failed one
    Copies all settings but resets progress and dates
    """
    original = get_challenge_by_id(db, challenge_id)
    if not original:
        return None
    
    # Calculate new dates
    if new_start_date is None:
        new_start_date = date.today()
    
    # Calculate duration from original challenge
    original_duration = (original.end_date - original.start_date).days
    new_end_date = new_start_date + timedelta(days=original_duration)
    
    # Create new challenge with same settings but fresh progress
    repeated_challenge = Challenge(
        name=original.name + " (Repeated)",
        description=original.description,
        challenge_type=original.challenge_type,
        start_date=new_start_date,
        end_date=new_end_date,
        target_days=original.target_days,
        target_count=original.target_count,
        target_value=original.target_value,
        unit=original.unit,
        difficulty=original.difficulty,
        reward=original.reward,
        why_reason=original.why_reason,
        pillar_id=original.pillar_id,
        can_graduate_to_habit=original.can_graduate_to_habit,
        status='active',
        current_streak=0,
        longest_streak=0,
        completed_days=0,
        current_count=0,
        current_value=0.0,
        is_completed=False,
        completion_date=None
    )
    
    db.add(repeated_challenge)
    db.commit()
    db.refresh(repeated_challenge)
    
    return repeated_challenge
