"""
Challenge Service - Handle time-bound personal challenges (7-30 days)
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict
from app.models.models import Challenge, ChallengeEntry
from app.utils.timezone_utils import get_local_now

# Fields that may be explicitly cleared (set to NULL) through an update
NULLABLE_UPDATE_FIELDS = {
    'description', 'target_days', 'target_count', 'target_value', 'unit', 'reward', 'why_reason',
    'daily_target', 'required_days', 'pillar_id', 'category_id', 'sub_category_id', 'linked_task_id', 'goal_id', 'project_id',
}


def _today() -> date:
    """Today's date in local time (see timezone_utils - never use date.today() directly)"""
    return get_local_now().date()


def _minutes_per_unit(unit: Optional[str]) -> Optional[int]:
    """Minutes in one unit of a time-based challenge (None when the unit is not time)"""
    u = (unit or '').strip().lower()
    if u in ('h', 'hr', 'hrs', 'hour', 'hours'):
        return 60
    if u in ('m', 'min', 'mins', 'minute', 'minutes'):
        return 1
    return None


# More than this per day, every day, is not a plan - flag it instead of showing "on track"
MAX_REALISTIC_MINUTES_PER_DAY = 8 * 60


def _minutes_factor(unit: Optional[str]) -> float:
    """Daily-tab time is stored in minutes; a challenge counted in hours needs minutes / 60"""
    if unit and unit.strip().lower() in ('h', 'hr', 'hrs', 'hour', 'hours'):
        return 1 / 60
    return 1.0


def _entry_value(challenge: Challenge, entry: Optional[ChallengeEntry]) -> float:
    """The number a day contributes: count, amount (e.g. minutes) or 1 for a done day"""
    if not entry:
        return 0
    if challenge.challenge_type == 'count_based':
        return entry.count_value or 0
    if challenge.challenge_type == 'accumulation':
        return entry.numeric_value or 0.0
    return 1 if entry.is_completed else 0


def _is_hit(challenge: Challenge, entry: ChallengeEntry) -> bool:
    """Does this day count? In daily-minimum mode only when the value reaches the minimum"""
    if challenge.daily_target:
        return _entry_value(challenge, entry) >= challenge.daily_target - 1e-9
    return bool(entry.is_completed)


def _days_required(challenge: Challenge) -> int:
    total = max(1, (challenge.end_date - challenge.start_date).days + 1)
    return min(challenge.required_days or total, total)


def _as_date(value) -> date:
    """Normalise date / datetime / 'YYYY-MM-DD' strings (SQLite func.date returns strings) to date"""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.strptime(str(value)[:10], '%Y-%m-%d').date()


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
        daily_target=challenge_data.get('daily_target'),
        required_days=challenge_data.get('required_days'),
        difficulty=challenge_data.get('difficulty', 'medium'),
        reward=challenge_data.get('reward'),
        why_reason=challenge_data.get('why_reason'),
        pillar_id=challenge_data.get('pillar_id'),
        category_id=challenge_data.get('category_id'),
        sub_category_id=challenge_data.get('sub_category_id'),
        linked_task_id=challenge_data.get('linked_task_id'),
        goal_id=challenge_data.get('goal_id'),
        project_id=challenge_data.get('project_id'),
        auto_sync=bool(challenge_data.get('auto_sync', False) and challenge_data.get('linked_task_id')),
        can_graduate_to_habit=challenge_data.get('can_graduate_to_habit', False),
        status='active',
        is_active=True
    )
    
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    
    # Pull in any history already logged against the linked task
    if challenge.auto_sync:
        recalculate_challenge(db, challenge)
    
    return challenge


def update_challenge(
    db: Session,
    challenge_id: int,
    update_data: dict
) -> Optional[Challenge]:
    """Update challenge fields. Nullable fields can be cleared by sending an explicit null."""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return None
    
    for key, value in update_data.items():
        if not hasattr(challenge, key):
            continue
        if value is None and key not in NULLABLE_UPDATE_FIELDS:
            continue
        setattr(challenge, key, value)
    
    # Unlinking the task switches off auto-sync
    if not challenge.linked_task_id:
        challenge.auto_sync = False
    
    # Daily-minimum mode: keep the informational total in step with minimum x days
    if challenge.challenge_type == 'daily_streak':
        challenge.daily_target = None
    if not challenge.daily_target:
        challenge.required_days = None
    else:
        days_total = max(1, (challenge.end_date - challenge.start_date).days + 1)
        challenge.required_days = min(challenge.required_days, days_total) if challenge.required_days else None
        total = challenge.daily_target * days_total
        if challenge.challenge_type == 'count_based':
            challenge.target_count = max(1, int(round(total)))
        else:
            challenge.target_value = total
    
    # Extending the end date of a failed challenge gives it a second life
    if challenge.status == 'failed' and challenge.end_date >= _today():
        challenge.status = 'active'
    
    challenge.updated_at = get_local_now()
    db.commit()
    db.refresh(challenge)
    
    recalculate_challenge(db, challenge)
    
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

def _task_minutes_by_date(
    db: Session,
    task_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> Dict[date, float]:
    """Total minutes logged per day for a task in the Daily tab (only days with time > 0)"""
    from app.models.models import DailyTimeEntry
    
    query = db.query(
        func.date(DailyTimeEntry.entry_date).label('entry_day'),
        func.sum(DailyTimeEntry.minutes).label('total_minutes')
    ).filter(
        DailyTimeEntry.task_id == task_id
    ).group_by(func.date(DailyTimeEntry.entry_date))
    
    if start_date:
        query = query.filter(func.date(DailyTimeEntry.entry_date) >= start_date.isoformat())
    if end_date:
        query = query.filter(func.date(DailyTimeEntry.entry_date) <= end_date.isoformat())
    
    return {
        _as_date(row.entry_day): float(row.total_minutes)
        for row in query.all()
        if row.total_minutes and row.total_minutes > 0
    }


def get_challenge_entries(db: Session, challenge_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[ChallengeEntry]:
    """
    Get all entries for a challenge
    For auto-synced challenges, the Daily tab is the source of truth: each day with time
    logged against the linked task is an entry. Manually logged notes/moods and manual
    "done" marks for the same day are merged in.
    """
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return []
    
    manual_query = db.query(ChallengeEntry).filter(ChallengeEntry.challenge_id == challenge_id)
    if start_date:
        manual_query = manual_query.filter(ChallengeEntry.entry_date >= start_date)
    if end_date:
        manual_query = manual_query.filter(ChallengeEntry.entry_date <= end_date)
    manual_entries = manual_query.order_by(ChallengeEntry.entry_date).all()
    
    if not (challenge.auto_sync and challenge.linked_task_id):
        return manual_entries
    
    factor = _minutes_factor(challenge.unit)
    minutes_by_date = {
        day: minutes * factor
        for day, minutes in _task_minutes_by_date(db, challenge.linked_task_id, start_date, end_date).items()
    }
    manual_by_date = {e.entry_date: e for e in manual_entries}
    
    entries = []
    for day in sorted(set(minutes_by_date) | set(manual_by_date)):
        minutes = minutes_by_date.get(day, 0.0)  # already in the challenge unit
        manual = manual_by_date.get(day)
        is_completed = minutes > 0  # the Daily tab alone decides whether a day counts
        if not is_completed and not (manual and (manual.note or manual.mood)):
            continue
        # Transient (never persisted) entry describing the synced day
        entries.append(ChallengeEntry(
            id=manual.id if manual else 0,
            challenge_id=challenge_id,
            entry_date=day,
            is_completed=is_completed,
            count_value=1 if is_completed else 0,
            numeric_value=minutes,
            note=manual.note if manual else None,
            mood=manual.mood if manual else None,
            created_at=manual.created_at if manual and manual.created_at else get_local_now()
        ))
    
    return entries


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
        # Update existing entry - None means "leave as is", so 0 / False / '' are valid values
        existing.is_completed = is_completed
        if count_value is not None:
            existing.count_value = count_value
        if numeric_value is not None:
            existing.numeric_value = numeric_value
        if note is not None:
            existing.note = note or None
        if mood is not None:
            existing.mood = mood
        entry = existing
    else:
        # Create new entry with snapshots
        from app.services.snapshot_helper import SnapshotHelper
        snapshots = SnapshotHelper.get_challenge_snapshots(db, challenge_id)
        
        entry = ChallengeEntry(
            challenge_id=challenge_id,
            entry_date=entry_date,
            is_completed=is_completed,
            count_value=count_value or 0,
            numeric_value=numeric_value or 0.0,
            note=note,
            mood=mood,
            **snapshots  # Populate snapshot columns
        )
        db.add(entry)
    
    db.commit()
    db.refresh(entry)
    
    # Update challenge progress
    challenge = get_challenge_by_id(db, challenge_id)
    if challenge:
        recalculate_challenge(db, challenge)
    
    return entry


# ============ Challenge Progress Tracking ============

def recalculate_challenge(db: Session, challenge: Challenge) -> Challenge:
    """
    Rebuild all progress counters of a challenge from its source of truth
    (Daily tab time entries for auto-synced challenges, challenge_entries otherwise).
    Only days inside the challenge window count. Safe to call repeatedly.
    """
    entries = get_challenge_entries(db, challenge.id, challenge.start_date, challenge.end_date)
    done_dates = {_as_date(e.entry_date) for e in entries if _is_hit(challenge, e)}
    
    challenge.completed_days = len(done_dates)
    challenge.current_streak = calculate_current_streak(done_dates)
    challenge.longest_streak = calculate_longest_streak(done_dates)
    
    if challenge.challenge_type == 'count_based':
        if challenge.auto_sync and challenge.linked_task_id:
            challenge.current_count = len(done_dates)  # sessions = days with time logged
        else:
            challenge.current_count = sum(e.count_value or 0 for e in entries)
    elif challenge.challenge_type == 'accumulation':
        challenge.current_value = sum(e.numeric_value or 0.0 for e in entries)
    
    check_challenge_completion(db, challenge)
    db.commit()
    db.refresh(challenge)
    return challenge


def update_challenge_progress(db: Session, challenge_id: int) -> None:
    """Recalculate and update challenge progress/streaks"""
    challenge = get_challenge_by_id(db, challenge_id)
    if challenge:
        recalculate_challenge(db, challenge)


def refresh_active_challenges(db: Session) -> None:
    """
    Recalculate every active challenge. Picks up Daily tab changes made while no
    sync hook ran (e.g. edited/deleted entries) and closes challenges whose end date passed.
    """
    for challenge in db.query(Challenge).filter(Challenge.status == 'active').all():
        recalculate_challenge(db, challenge)


def calculate_current_streak(done_dates, today: Optional[date] = None) -> int:
    """
    Consecutive completed days ending today - or yesterday when today is not logged yet,
    so an unfinished day never zeroes the streak.
    """
    done = set(done_dates)
    day = today or _today()
    if day not in done:
        day -= timedelta(days=1)
    streak = 0
    while day in done:
        streak += 1
        day -= timedelta(days=1)
    return streak


def calculate_longest_streak(done_dates) -> int:
    """Longest run of consecutive completed days"""
    done = set(done_dates)
    longest = 0
    for day in done:
        if day - timedelta(days=1) in done:
            continue  # not the start of a run
        length = 1
        while day + timedelta(days=length) in done:
            length += 1
        longest = max(longest, length)
    return longest


def check_challenge_completion(db: Session, challenge: Challenge) -> None:
    """Close an active challenge: completed once the target is reached, failed once the end date passes"""
    if challenge.status != 'active':
        return  # manual completion / abandonment is never overridden
    
    target_reached = False
    if challenge.daily_target:
        # Daily-minimum mode: won by enough days reaching the minimum, not by the running total
        target_reached = challenge.completed_days >= _days_required(challenge)
    elif challenge.challenge_type == 'daily_streak':
        target_reached = bool(challenge.target_days and challenge.completed_days >= challenge.target_days)
    elif challenge.challenge_type == 'count_based':
        target_reached = bool(challenge.target_count and challenge.current_count >= challenge.target_count)
    elif challenge.challenge_type == 'accumulation':
        target_reached = bool(challenge.target_value and challenge.current_value >= challenge.target_value)
    
    if target_reached:
        challenge.status = 'completed'
        challenge.is_completed = True
        challenge.completion_date = get_local_now()
    elif _today() > challenge.end_date:
        challenge.status = 'failed'


# ============ Challenge Statistics ============

def _target_and_current(challenge: Challenge):
    """(target, current) progress numbers for the challenge type"""
    if challenge.daily_target:
        return _days_required(challenge), challenge.completed_days or 0
    if challenge.challenge_type == 'daily_streak':
        return challenge.target_days, challenge.completed_days or 0
    if challenge.challenge_type == 'count_based':
        return challenge.target_count, challenge.current_count or 0
    return challenge.target_value, challenge.current_value or 0.0


def build_challenge_metrics(db: Session, challenge: Challenge) -> Dict:
    """
    Everything the UI needs to describe where a challenge stands today.
    "On track" is judged on days fully behind us, so an unfinished today never counts against you.
    """
    today = _today()
    start, end = challenge.start_date, challenge.end_date
    days_total = max(1, (end - start).days + 1)
    is_open = challenge.status == 'active'
    
    days_elapsed = min(max((today - start).days + 1, 0), days_total)
    days_remaining = max(0, (end - max(today, start)).days) if today <= end else 0
    days_before_today = days_total if today > end else max(days_elapsed - 1, 0)
    
    entries = get_challenge_entries(db, challenge.id, start, end)
    by_date = {_as_date(e.entry_date): e for e in entries}
    today_entry = by_date.get(today)
    completed_today = bool(today_entry and _is_hit(challenge, today_entry))
    today_value = _entry_value(challenge, today_entry)
    
    daily_mode = bool(challenge.daily_target)
    is_counting = challenge.challenge_type != 'daily_streak'
    in_play = is_open and start <= today <= end
    target, current = _target_and_current(challenge)
    progress_pct = min(current / target * 100, 100) if target else 0
    expected_pct = days_before_today / days_total * 100
    
    days_required = _days_required(challenge)
    allowed_misses = days_total - days_required
    hits_before_today = sum(
        1 for day, e in by_date.items() if day < today and _is_hit(challenge, e)
    )
    missed_days = max(0, days_before_today - hits_before_today)
    
    if challenge.status != 'active':
        status_indicator = challenge.status
    elif today < start:
        status_indicator = 'not_started'
    else:
        status_indicator = None  # decided below, once today's quota is known
    
    total_so_far = (
        (challenge.current_count or 0) if challenge.challenge_type == 'count_based'
        else (challenge.current_value or 0.0)
    )
    
    todays_target = None
    today_remaining = None
    needed_per_day = 0
    pace_current, pace_target = (total_so_far, None) if daily_mode else (current, target)
    if daily_mode and is_counting and in_play:
        # Fixed minimum every day - no catch-up pressure when a day is missed
        todays_target = challenge.daily_target
        today_remaining = max(0, todays_target - today_value)
        needed_per_day = challenge.daily_target
    elif is_counting and target and in_play:
        # Today's quota = ideal daily share + whatever was missed before today
        ideal = target / days_total
        before_today = current - today_value
        deficit = max(0, ideal * days_before_today - before_today)
        todays_target = min(ideal + deficit, max(0, target - before_today))
        today_remaining = max(0, todays_target - today_value)
        needed_per_day = max(0, target - current) / (days_remaining + 1)
    
    # Projection uses finished days only - a half-done today would drag the pace down
    pace = (pace_current - today_value) / days_before_today if days_before_today else 0
    projected_pct = (
        (pace_current + pace * days_remaining) / pace_target * 100
    ) if pace_target and in_play and days_before_today >= 1 else None
    
    # How many days of work you are behind the ideal pace (today not counted against you)
    days_behind = max(0.0, (expected_pct - progress_pct) / 100 * days_total)
    behind_limit = min(3, max(2, 0.15 * days_total))
    
    # A time target that needs more than a working day, every day, cannot be met
    minutes_per_unit = _minutes_per_unit(challenge.unit) if is_counting else None
    unrealistic_pace = bool(
        in_play and minutes_per_unit and needed_per_day * minutes_per_unit > MAX_REALISTIC_MINUTES_PER_DAY
    )
    
    if status_indicator is None:
        if daily_mode:
            # Judged by missed days against the slack, not by pace
            if missed_days > allowed_misses:
                status_indicator = 'behind'
            elif missed_days > 0 and missed_days == allowed_misses:
                status_indicator = 'at_risk'
            else:
                status_indicator = 'on_track'
        elif days_behind > behind_limit:
            status_indicator = 'behind'
        elif days_behind > 1:
            status_indicator = 'at_risk'
        else:
            status_indicator = 'on_track'
        
        if unrealistic_pace:
            status_indicator = 'behind'
        elif status_indicator == 'on_track' and days_before_today == 0:
            # No finished day yet: on track only once today's own part is done
            today_done = (today_remaining <= 0) if today_remaining is not None else completed_today
            if not today_done:
                status_indicator = 'just_started'
    
    # Last 14 days (ending today, or the end date for finished challenges) for the mini tracker
    last_day = min(today, end)
    recent_days = []
    for offset in range(13, -1, -1):
        day = last_day - timedelta(days=offset)
        if day < start:
            continue
        entry = by_date.get(day)
        recent_days.append({
            "date": day.isoformat(),
            "value": _entry_value(challenge, entry),
            "completed": bool(entry and _is_hit(challenge, entry)),
        })
    
    return {
        "days_total": days_total,
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "has_started": today >= start,
        "target": target,
        "current": current,
        "progress_percentage": round(progress_pct, 1),
        "expected_percentage": round(expected_pct, 1),
        "status_indicator": status_indicator,
        "is_on_track": status_indicator in ('on_track', 'completed'),
        "completed_today": completed_today,
        "today_value": today_value if today_entry else None,
        "todays_target": round(todays_target, 1) if todays_target is not None else None,
        "today_remaining": round(today_remaining, 1) if today_remaining is not None else None,
        "needed_per_day": round(needed_per_day, 1),
        "days_behind": round(days_behind, 1) if not daily_mode else 0,
        "unrealistic_pace": unrealistic_pace,
        "daily_average": round(total_so_far / days_elapsed, 2) if is_counting and days_elapsed else 0,
        "days_required": days_required,
        "missed_days": missed_days,
        "allowed_misses": allowed_misses,
        "projected_percentage": round(projected_pct, 1) if projected_pct is not None else None,
        "success_rate": round((challenge.completed_days or 0) / days_elapsed * 100, 1) if days_elapsed else 0,
        "recent_days": recent_days,
    }


def get_challenge_stats(db: Session, challenge_id: int) -> Dict:
    """Detailed statistics for a challenge"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return {}
    
    metrics = build_challenge_metrics(db, challenge)
    return {
        "challenge_id": challenge.id,
        "challenge_name": challenge.name,
        "challenge_type": challenge.challenge_type,
        "status": challenge.status,
        "total_days": metrics["days_total"],
        "completed_days": challenge.completed_days or 0,
        "completion_rate": metrics["progress_percentage"],
        "current_streak": challenge.current_streak or 0,
        "longest_streak": challenge.longest_streak or 0,
        "current_count": challenge.current_count or 0,
        "target_count": challenge.target_count,
        "current_value": challenge.current_value or 0.0,
        "target_value": challenge.target_value,
        "is_completed": challenge.is_completed,
        **{k: v for k, v in metrics.items() if k not in ('days_total', 'recent_days')},
    }


# ============ Challenge Actions ============

def complete_challenge(db: Session, challenge_id: int) -> Optional[Challenge]:
    """Mark challenge as manually completed"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return None
    
    challenge.status = 'completed'
    challenge.is_completed = True
    challenge.completion_date = get_local_now()
    challenge.updated_at = get_local_now()
    
    db.commit()
    db.refresh(challenge)
    
    return challenge


def abandon_challenge(db: Session, challenge_id: int) -> Optional[Challenge]:
    """Mark challenge as abandoned"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return None
    
    challenge.status = 'abandoned'
    challenge.updated_at = get_local_now()
    
    db.commit()
    db.refresh(challenge)
    
    return challenge


def reopen_challenge(db: Session, challenge_id: int) -> Optional[Challenge]:
    """Bring an abandoned/failed/completed challenge back to active (end date is extended if already past)"""
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return None
    
    challenge.status = 'active'
    challenge.is_completed = False
    challenge.completion_date = None
    if challenge.end_date < _today():
        challenge.end_date = _today()
    challenge.updated_at = get_local_now()
    
    db.commit()
    return recalculate_challenge(db, challenge)


def graduate_to_habit(
    db: Session,
    challenge_id: int,
    habit_name: Optional[str] = None,
    habit_description: Optional[str] = None
) -> Optional[Dict]:
    """
    Turn a completed challenge into a permanent daily habit.
    Returns None if the challenge doesn't exist; raises ValueError if it isn't completed yet.
    """
    from app.services.habit_service import HabitService
    
    challenge = get_challenge_by_id(db, challenge_id)
    if not challenge:
        return None
    if not challenge.is_completed:
        raise ValueError("Only completed challenges can graduate to a habit")
    if challenge.graduated_habit_id:
        raise ValueError("This challenge has already graduated to a habit")
    
    days_total = max(1, (challenge.end_date - challenge.start_date).days + 1)
    habit_data = {
        'name': habit_name or challenge.name,
        'description': habit_description or f"Graduated from challenge: {challenge.name}",
        'pillar_id': challenge.pillar_id,
        'category_id': challenge.category_id,
        'sub_category_id': challenge.sub_category_id,
        'linked_task_id': challenge.linked_task_id,
        'target_frequency': 'daily',
        'is_positive': True,
        'why_reason': challenge.why_reason,
        'start_date': get_local_now(),
    }
    if challenge.challenge_type == 'daily_streak':
        habit_data['habit_type'] = 'boolean'
    else:
        synced = challenge.auto_sync and challenge.linked_task_id
        total = challenge.target_count if challenge.challenge_type == 'count_based' else challenge.target_value
        per_day = challenge.daily_target or ((total or 0) / days_total)
        if synced and _minutes_factor(challenge.unit) != 1.0:
            per_day *= 60  # habits track time in minutes
        habit_data['habit_type'] = 'time_based' if synced else 'count_based'
        habit_data['target_value'] = max(1, int(round(per_day)))
    
    habit = HabitService.create_habit(db, habit_data)
    
    challenge.graduated_habit_id = habit.id
    challenge.updated_at = get_local_now()
    db.commit()
    
    return {"challenge_id": challenge.id, "habit_id": habit.id, "habit_name": habit.name}


def repeat_challenge(db: Session, challenge_id: int, new_start_date: Optional[date] = None) -> Optional[Challenge]:
    """
    Create a new challenge by repeating a completed/failed one
    Copies all settings and links but resets progress and dates
    """
    original = get_challenge_by_id(db, challenge_id)
    if not original:
        return None
    
    if new_start_date is None:
        new_start_date = _today()
    
    original_duration = (original.end_date - original.start_date).days
    new_end_date = new_start_date + timedelta(days=original_duration)
    
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
        daily_target=original.daily_target,
        required_days=original.required_days,
        difficulty=original.difficulty,
        reward=original.reward,
        why_reason=original.why_reason,
        pillar_id=original.pillar_id,
        category_id=original.category_id,
        sub_category_id=original.sub_category_id,
        linked_task_id=original.linked_task_id,
        goal_id=original.goal_id,
        project_id=original.project_id,
        auto_sync=original.auto_sync,
        can_graduate_to_habit=original.can_graduate_to_habit,
        status='active',
        is_active=True,
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
    
    if repeated_challenge.auto_sync:
        recalculate_challenge(db, repeated_challenge)
    
    return repeated_challenge


# ============ Auto-Sync Functions ============

def sync_challenge_from_task(db: Session, task_id: int, entry_date: date) -> List[Challenge]:
    """
    Sync all auto-sync enabled challenges linked to this task
    Called when a task entry is created/updated
    "Synced" here means: the Daily tab is the source of truth, manual notes/moods are merged in.
    """
    challenges = db.query(Challenge).filter(
        Challenge.linked_task_id == task_id,
        Challenge.auto_sync == True,
        Challenge.status == 'active',
        Challenge.start_date <= entry_date,
        Challenge.end_date >= entry_date
    ).all()
    
    for challenge in challenges:
        recalculate_challenge(db, challenge)
    
    return challenges