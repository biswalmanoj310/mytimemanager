"""
API routes for Habit Tracking
Endpoints for managing habits, marking daily entries, and viewing streaks
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel

from app.database.config import get_db
from app.services.habit_service import HabitService


router = APIRouter(prefix="/api/habits", tags=["habits"])


# ============================================
# PYDANTIC SCHEMAS
# ============================================

class HabitCreate(BaseModel):
    name: str
    description: Optional[str] = None
    habit_type: str  # 'boolean', 'time_based', 'count_based'
    linked_task_id: Optional[int] = None
    target_frequency: str  # 'daily', 'weekly', 'monthly'
    target_value: Optional[int] = None
    target_comparison: str = 'at_least'  # 'at_least', 'at_most', 'exactly'
    is_positive: bool = True
    why_reason: Optional[str] = None
    start_date: date
    # Organization fields
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    # Association fields
    life_goal_id: Optional[int] = None
    wish_id: Optional[int] = None
    # New fields for weekly/monthly tracking
    period_type: Optional[str] = None  # 'daily', 'weekly', 'monthly'
    tracking_mode: Optional[str] = None  # 'occurrence', 'occurrence_with_value', 'aggregate', 'daily_streak'
    target_count_per_period: Optional[int] = None
    session_target_value: Optional[int] = None
    session_target_unit: Optional[str] = None
    aggregate_target: Optional[int] = None


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_value: Optional[int] = None
    target_comparison: Optional[str] = None
    why_reason: Optional[str] = None
    is_active: Optional[bool] = None
    end_date: Optional[date] = None
    # Organization fields
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    # Linked items
    linked_task_id: Optional[int] = None
    life_goal_id: Optional[int] = None
    wish_id: Optional[int] = None


class HabitEntryCreate(BaseModel):
    entry_date: date
    is_successful: bool
    actual_value: Optional[int] = None
    note: Optional[str] = None


class SessionCompleteRequest(BaseModel):
    value: Optional[int] = None
    notes: Optional[str] = None


class AggregateAddRequest(BaseModel):
    value: int
    entry_date: Optional[date] = None


# ============================================
# HABIT CRUD ENDPOINTS
# ============================================

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_habit(habit_data: HabitCreate, db: Session = Depends(get_db)):
    """Create a new habit"""
    try:
        habit = HabitService.create_habit(db, habit_data.dict())
        return {
            "id": habit.id,
            "name": habit.name,
            "description": habit.description,
            "pillar_id": habit.pillar_id,
            "pillar_name": habit.pillar.name if habit.pillar else None,
            "category_id": habit.category_id,
            "category_name": habit.category.name if habit.category else None,
            "habit_type": habit.habit_type,
            "linked_task_id": habit.linked_task_id,
            "target_frequency": habit.target_frequency,
            "target_value": habit.target_value,
            "target_comparison": habit.target_comparison,
            "is_positive": habit.is_positive,
            "why_reason": habit.why_reason,
            "start_date": habit.start_date.date() if habit.start_date else None,
            "end_date": habit.end_date.date() if habit.end_date else None,
            "is_active": habit.is_active,
            "created_at": habit.created_at
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
def get_all_habits(active_only: bool = True, db: Session = Depends(get_db)):
    """Get all habits"""
    habits = HabitService.get_all_habits(db, active_only=active_only)
    
    result = []
    for habit in habits:
        # Get current stats
        stats = HabitService.get_habit_stats(db, habit.id)
        
        result.append({
            "id": habit.id,
            "name": habit.name,
            "description": habit.description,
            "pillar_id": habit.pillar_id,
            "pillar_name": habit.pillar.name if habit.pillar else None,
            "pillar_color": habit.pillar.color_code if habit.pillar else None,
            "category_id": habit.category_id,
            "category_name": habit.category.name if habit.category else None,
            "sub_category_id": habit.sub_category_id,
            "sub_category_name": habit.sub_category.name if habit.sub_category else None,
            "habit_type": habit.habit_type,
            "linked_task_id": habit.linked_task_id,
            "linked_task_name": habit.linked_task.name if habit.linked_task else None,
            "life_goal_id": habit.life_goal_id,
            "life_goal_name": habit.life_goal.name if habit.life_goal else None,
            "wish_id": habit.wish_id,
            "wish_title": habit.wish.title if habit.wish else None,
            "target_frequency": habit.target_frequency,
            "target_value": habit.target_value,
            "target_comparison": habit.target_comparison,
            "is_positive": habit.is_positive,
            "why_reason": habit.why_reason,
            "start_date": habit.start_date.date() if habit.start_date else None,
            "end_date": habit.end_date.date() if habit.end_date else None,
            "is_active": habit.is_active,
            "created_at": habit.created_at,
            "stats": stats
        })
    
    return result


@router.get("/{habit_id}")
def get_habit(habit_id: int, db: Session = Depends(get_db)):
    """Get a specific habit by ID"""
    habit = HabitService.get_habit_by_id(db, habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    stats = HabitService.get_habit_stats(db, habit.id)
    
    return {
        "id": habit.id,
        "name": habit.name,
        "description": habit.description,
        "pillar_id": habit.pillar_id,
        "pillar_name": habit.pillar.name if habit.pillar else None,
        "category_id": habit.category_id,
        "category_name": habit.category.name if habit.category else None,
        "sub_category_id": habit.sub_category_id,
        "sub_category_name": habit.sub_category.name if habit.sub_category else None,
        "habit_type": habit.habit_type,
        "linked_task_id": habit.linked_task_id,
        "linked_task_name": habit.linked_task.name if habit.linked_task else None,
        "life_goal_id": habit.life_goal_id,
        "life_goal_name": habit.life_goal.name if habit.life_goal else None,
        "wish_id": habit.wish_id,
        "wish_title": habit.wish.title if habit.wish else None,
        "target_frequency": habit.target_frequency,
        "target_value": habit.target_value,
        "target_comparison": habit.target_comparison,
        "is_positive": habit.is_positive,
        "why_reason": habit.why_reason,
        "start_date": habit.start_date.date() if habit.start_date else None,
        "end_date": habit.end_date.date() if habit.end_date else None,
        "is_active": habit.is_active,
        "created_at": habit.created_at,
        "stats": stats
    }


@router.put("/{habit_id}")
def update_habit(habit_id: int, habit_data: HabitUpdate, db: Session = Depends(get_db)):
    """Update a habit"""
    update_dict = {k: v for k, v in habit_data.dict().items() if v is not None}
    habit = HabitService.update_habit(db, habit_id, update_dict)
    
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    # Return full habit data including pillar/category info
    return {
        "id": habit.id,
        "name": habit.name,
        "description": habit.description,
        "pillar_id": habit.pillar_id,
        "pillar_name": habit.pillar.name if habit.pillar else None,
        "category_id": habit.category_id,
        "category_name": habit.category.name if habit.category else None,
        "sub_category_id": habit.sub_category_id,
        "linked_task_id": habit.linked_task_id,
        "linked_task_name": habit.linked_task.name if habit.linked_task else None,
        "is_active": habit.is_active
    }


@router.delete("/{habit_id}")
def delete_habit(habit_id: int, db: Session = Depends(get_db)):
    """Delete (deactivate) a habit"""
    success = HabitService.delete_habit(db, habit_id)
    if not success:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    return {"message": "Habit deactivated successfully"}


# ============================================
# HABIT ENTRY ENDPOINTS
# ============================================

@router.post("/{habit_id}/entries")
def mark_habit_entry(habit_id: int, entry_data: HabitEntryCreate, db: Session = Depends(get_db)):
    """Mark a habit entry for a specific date"""
    try:
        entry = HabitService.mark_habit_entry(
            db=db,
            habit_id=habit_id,
            entry_date=entry_data.entry_date,
            is_successful=entry_data.is_successful,
            actual_value=entry_data.actual_value,
            note=entry_data.note
        )
        
        # Get updated stats
        stats = HabitService.get_habit_stats(db, habit_id)
        
        return {
            "id": entry.id,
            "habit_id": entry.habit_id,
            "entry_date": entry.entry_date.date() if entry.entry_date else None,
            "is_successful": entry.is_successful,
            "actual_value": entry.actual_value,
            "note": entry.note,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{habit_id}/entries")
def get_habit_entries(
    habit_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Get habit entries for a date range"""
    entries = HabitService.get_habit_entries(db, habit_id, start_date, end_date)
    
    return [
        {
            "id": entry.id,
            "habit_id": entry.habit_id,
            "entry_date": entry.entry_date.date() if entry.entry_date else None,
            "is_successful": entry.is_successful,
            "actual_value": entry.actual_value,
            "note": entry.note,
            "created_at": entry.created_at
        }
        for entry in entries
    ]


# ============================================
# STREAK ENDPOINTS
# ============================================

@router.get("/{habit_id}/current-streak")
def get_current_streak(habit_id: int, db: Session = Depends(get_db)):
    """Get the current active streak for a habit"""
    streak = HabitService.calculate_current_streak(db, habit_id)
    return {"current_streak": streak}


@router.get("/{habit_id}/top-streaks")
def get_top_streaks(habit_id: int, limit: int = 3, db: Session = Depends(get_db)):
    """Get top N longest streaks for a habit"""
    streaks = HabitService.get_top_streaks(db, habit_id, limit=limit)
    
    return [
        {
            "id": streak.id,
            "start_date": streak.start_date.date() if streak.start_date else None,
            "end_date": streak.end_date.date() if streak.end_date else None,
            "streak_length": streak.streak_length,
            "is_active": streak.is_active
        }
        for streak in streaks
    ]


@router.post("/{habit_id}/recalculate-streaks")
def recalculate_streaks(habit_id: int, db: Session = Depends(get_db)):
    """Manually trigger streak recalculation"""
    HabitService.recalculate_streaks(db, habit_id)
    return {"message": "Streaks recalculated successfully"}


# ============================================
# STATISTICS ENDPOINTS
# ============================================

@router.get("/{habit_id}/stats")
def get_habit_statistics(habit_id: int, db: Session = Depends(get_db)):
    """Get statistics for a habit"""
    stats = HabitService.get_habit_stats(db, habit_id)
    return stats


# ============================================
# WEEKLY/MONTHLY SESSION TRACKING ENDPOINTS
# ============================================

@router.get("/{habit_id}/current-period")
def get_current_period_stats(habit_id: int, db: Session = Depends(get_db)):
    """Get current period stats (week or month) including sessions"""
    try:
        stats = HabitService.get_current_period_stats(db, habit_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{habit_id}/initialize-period")
def initialize_period(habit_id: int, db: Session = Depends(get_db)):
    """Initialize session slots for current period"""
    try:
        habit = HabitService.get_habit_by_id(db, habit_id)
        if not habit:
            raise HTTPException(status_code=404, detail="Habit not found")
        
        if habit.period_type in ['weekly', 'monthly']:
            HabitService.initialize_period_sessions(db, habit_id, habit.period_type)
            return {"message": "Period initialized successfully"}
        else:
            raise HTTPException(status_code=400, detail="Habit is not weekly/monthly tracked")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/complete")
def mark_session_complete(
    session_id: int, 
    data: SessionCompleteRequest,
    db: Session = Depends(get_db)
):
    """Mark a session as complete"""
    try:
        session = HabitService.mark_session_complete(
            db, 
            session_id, 
            value=data.value,
            notes=data.notes
        )
        return {
            "id": session.id,
            "session_number": session.session_number,
            "is_completed": session.is_completed,
            "completed_at": session.completed_at,
            "value_achieved": session.value_achieved,
            "meets_target": session.meets_target,
            "notes": session.notes
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{habit_id}/add-aggregate")
def add_to_aggregate(
    habit_id: int,
    data: AggregateAddRequest,
    db: Session = Depends(get_db)
):
    """Add value to aggregate habit (e.g., +50 pages read today)"""
    try:
        period = HabitService.add_to_aggregate(
            db,
            habit_id,
            value=data.value,
            entry_date=data.entry_date
        )
        return {
            "period_start": period.period_start,
            "period_end": period.period_end,
            "aggregate_target": period.aggregate_target,
            "aggregate_achieved": period.aggregate_achieved,
            "success_percentage": period.success_percentage,
            "is_successful": period.is_successful
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/today/active")
def get_todays_active_habits(db: Session = Depends(get_db)):
    """Get all active habits for today with current status and monthly completion data"""
    from app.models.models import Habit, HabitEntry
    from datetime import timedelta
    
    today = datetime.now().date()
    first_day_of_month = today.replace(day=1)
    
    # Get all active habits
    habits = db.query(Habit).filter(
        Habit.is_active == True,
        Habit.start_date <= datetime.now()
    ).all()
    
    result = []
    for habit in habits:
        # Check if there's an entry for today
        today_entry = db.query(HabitEntry).filter(
            and_(
                HabitEntry.habit_id == habit.id,
                func.date(HabitEntry.entry_date) == today
            )
        ).first()
        
        # Get current streak
        stats = HabitService.get_habit_stats(db, habit.id)
        
        # Get monthly completion data (from first day of month to today)
        monthly_entries = db.query(HabitEntry).filter(
            and_(
                HabitEntry.habit_id == habit.id,
                func.date(HabitEntry.entry_date) >= first_day_of_month,
                func.date(HabitEntry.entry_date) <= today
            )
        ).all()
        
        # Create a map of completed dates
        completed_dates = {entry.entry_date.date() for entry in monthly_entries if entry.is_successful}
        
        # Calculate days from month start to today
        days_in_month_so_far = (today - first_day_of_month).days + 1
        
        # Build array of daily completion status for this month
        monthly_completion = []
        current_date = first_day_of_month
        while current_date <= today:
            # Check if this date is before habit start date
            if current_date < habit.start_date.date():
                monthly_completion.append(None)  # Not applicable
            else:
                monthly_completion.append(current_date in completed_dates)
            current_date += timedelta(days=1)
        
        # Calculate completion rate
        applicable_days = [d for d in monthly_completion if d is not None]
        completed_days = sum(1 for d in applicable_days if d)
        completion_rate = (completed_days / len(applicable_days) * 100) if applicable_days else 0
        
        # Get pillar color
        pillar_color = None
        if habit.pillar:
            pillar_color = habit.pillar.color_code
        
        result.append({
            "id": habit.id,
            "name": habit.name,
            "description": habit.description,
            "habit_type": habit.habit_type,
            "target_frequency": habit.target_frequency,
            "target_value": habit.target_value,
            "target_comparison": habit.target_comparison,
            "pillar_id": habit.pillar_id,
            "pillar_name": habit.pillar.name if habit.pillar else None,
            "pillar_color": pillar_color,
            "category_id": habit.category_id,
            "category_name": habit.category.name if habit.category else None,
            "is_positive": habit.is_positive,
            "current_streak": stats.get("current_streak", 0),
            "longest_streak": stats.get("longest_streak", 0),
            "completed_today": today_entry.is_successful if today_entry else False,
            "today_value": today_entry.actual_value if today_entry else None,
            "period_type": habit.period_type,
            "tracking_mode": habit.tracking_mode,
            "target_count_per_period": habit.target_count_per_period,
            "session_target_value": habit.session_target_value,
            "session_target_unit": habit.session_target_unit,
            "aggregate_target": habit.aggregate_target,
            # New monthly data
            "monthly_completion": monthly_completion,
            "completed_days_this_month": completed_days,
            "total_days_this_month": len(applicable_days),
            "completion_rate": round(completion_rate, 1)
        })
    
    return result


@router.post("/{habit_id}/mark-today")
def mark_habit_today(
    habit_id: int,
    is_successful: bool = True,
    actual_value: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Quick action to mark habit as done/not done for today"""
    from datetime import datetime
    
    today = datetime.now().date()
    
    try:
        entry = HabitService.mark_daily_entry(
            db,
            habit_id,
            today,
            is_successful,
            actual_value=actual_value
        )
        
        # Get updated stats
        stats = HabitService.get_habit_stats(db, habit_id)
        
        return {
            "success": True,
            "entry_date": entry.entry_date,
            "is_successful": entry.is_successful,
            "actual_value": entry.actual_value,
            "current_streak": stats.get("current_streak", 0)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
