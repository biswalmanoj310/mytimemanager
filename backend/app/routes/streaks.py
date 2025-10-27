"""
Streak tracking endpoints for gamification
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import date, timedelta
from typing import Dict, Any

from app.database.config import get_db
from app.models.models import DailyTimeEntry

router = APIRouter(prefix="/api/streaks", tags=["streaks"])


@router.get("/current")
def get_current_streaks(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Calculate current tracking streaks
    Returns consecutive days with time entries
    """
    today = date.today()
    
    # Get all unique dates with entries
    dates_with_entries = db.query(
        func.date(DailyTimeEntry.entry_date).label('entry_date')
    ).distinct().order_by(
        func.date(DailyTimeEntry.entry_date).desc()
    ).all()
    
    if not dates_with_entries:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "last_tracked_date": None,
            "streak_status": "inactive"
        }
    
    # Convert to list of dates
    tracked_dates = [row[0] for row in dates_with_entries]
    
    # Calculate current streak
    current_streak = 0
    check_date = today
    
    while check_date in tracked_dates:
        current_streak += 1
        check_date = check_date - timedelta(days=1)
    
    # Calculate longest streak
    longest_streak = 0
    temp_streak = 1
    
    for i in range(1, len(tracked_dates)):
        if tracked_dates[i-1] - tracked_dates[i] == timedelta(days=1):
            temp_streak += 1
            longest_streak = max(longest_streak, temp_streak)
        else:
            temp_streak = 1
    
    longest_streak = max(longest_streak, temp_streak, current_streak)
    
    # Determine status
    last_tracked = tracked_dates[0] if tracked_dates else None
    if today in tracked_dates:
        status = "active"
    elif (today - timedelta(days=1)) in tracked_dates:
        status = "at_risk"
    else:
        status = "broken"
    
    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "last_tracked_date": last_tracked.isoformat() if last_tracked else None,
        "streak_status": status,
        "total_tracked_days": len(tracked_dates)
    }


@router.get("/badges")
def get_earned_badges(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Calculate earned badges based on achievements
    """
    streaks = get_current_streaks(db)
    
    badges = []
    
    # Streak badges
    if streaks["current_streak"] >= 3:
        badges.append({
            "id": "streak_3",
            "name": "🔥 3-Day Streak",
            "description": "Tracked time for 3 consecutive days"
        })
    
    if streaks["current_streak"] >= 7:
        badges.append({
            "id": "streak_7",
            "name": "⭐ Week Warrior",
            "description": "Tracked time for 7 consecutive days"
        })
    
    if streaks["current_streak"] >= 30:
        badges.append({
            "id": "streak_30",
            "name": "👑 Month Master",
            "description": "Tracked time for 30 consecutive days"
        })
    
    if streaks["longest_streak"] >= 100:
        badges.append({
            "id": "streak_100",
            "name": "💎 Century Champion",
            "description": "Achieved 100-day streak"
        })
    
    # Total days badges
    if streaks["total_tracked_days"] >= 10:
        badges.append({
            "id": "total_10",
            "name": "🌟 Getting Started",
            "description": "Tracked 10 total days"
        })
    
    if streaks["total_tracked_days"] >= 50:
        badges.append({
            "id": "total_50",
            "name": "🚀 Committed",
            "description": "Tracked 50 total days"
        })
    
    return {
        "badges": badges,
        "total_earned": len(badges)
    }
