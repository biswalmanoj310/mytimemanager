"""
Service layer for Habit Tracking operations
Implements streak calculation, auto-sync from tasks, and habit management
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Tuple
from app.models.models import Habit, HabitEntry, HabitStreak, HabitSession, HabitPeriod, Task, DailyTimeEntry


class HabitService:
    """Service for managing habits and calculating streaks"""
    
    # ============================================
    # HABIT CRUD OPERATIONS
    # ============================================
    
    @staticmethod
    def create_habit(db: Session, habit_data: dict) -> Habit:
        """Create a new habit"""
        db_habit = Habit(**habit_data)
        db.add(db_habit)
        db.commit()
        db.refresh(db_habit)
        return db_habit
    
    @staticmethod
    def get_all_habits(db: Session, active_only: bool = True) -> List[Habit]:
        """Get all habits"""
        query = db.query(Habit)
        if active_only:
            query = query.filter(Habit.is_active == True)
        return query.order_by(Habit.created_at.desc()).all()
    
    @staticmethod
    def get_habit_by_id(db: Session, habit_id: int) -> Optional[Habit]:
        """Get habit by ID"""
        return db.query(Habit).filter(Habit.id == habit_id).first()
    
    @staticmethod
    def update_habit(db: Session, habit_id: int, update_data: dict) -> Optional[Habit]:
        """Update a habit"""
        db_habit = db.query(Habit).filter(Habit.id == habit_id).first()
        if not db_habit:
            return None
        
        for key, value in update_data.items():
            if hasattr(db_habit, key):
                setattr(db_habit, key, value)
        
        db_habit.updated_at = datetime.now()
        db.commit()
        db.refresh(db_habit)
        return db_habit
    
    @staticmethod
    def delete_habit(db: Session, habit_id: int) -> bool:
        """Delete a habit (soft delete by setting is_active=False)"""
        db_habit = db.query(Habit).filter(Habit.id == habit_id).first()
        if not db_habit:
            return False
        
        db_habit.is_active = False
        db_habit.updated_at = datetime.now()
        db.commit()
        return True
    
    # ============================================
    # HABIT ENTRY OPERATIONS
    # ============================================
    
    @staticmethod
    def mark_habit_entry(
        db: Session, 
        habit_id: int, 
        entry_date: date, 
        is_successful: bool,
        actual_value: Optional[int] = None,
        note: Optional[str] = None
    ) -> HabitEntry:
        """Mark a habit as done/not done for a specific date"""
        
        # Check if entry already exists
        existing_entry = db.query(HabitEntry).filter(
            and_(
                HabitEntry.habit_id == habit_id,
                func.date(HabitEntry.entry_date) == entry_date
            )
        ).first()
        
        if existing_entry:
            # Update existing entry
            existing_entry.is_successful = is_successful
            existing_entry.actual_value = actual_value
            existing_entry.note = note
            existing_entry.updated_at = datetime.now()
            db.commit()
            db.refresh(existing_entry)
            entry = existing_entry
        else:
            # Create new entry
            entry = HabitEntry(
                habit_id=habit_id,
                entry_date=datetime.combine(entry_date, datetime.min.time()),
                is_successful=is_successful,
                actual_value=actual_value,
                note=note
            )
            db.add(entry)
            db.commit()
            db.refresh(entry)
        
        # Recalculate streaks after marking entry
        HabitService.recalculate_streaks(db, habit_id)
        
        return entry
    
    @staticmethod
    def get_habit_entries(
        db: Session, 
        habit_id: int, 
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[HabitEntry]:
        """Get habit entries for a date range"""
        query = db.query(HabitEntry).filter(HabitEntry.habit_id == habit_id)
        
        if start_date:
            query = query.filter(HabitEntry.entry_date >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            query = query.filter(HabitEntry.entry_date <= datetime.combine(end_date, datetime.max.time()))
        
        return query.order_by(HabitEntry.entry_date.desc()).all()
    
    # ============================================
    # STREAK CALCULATION
    # ============================================
    
    @staticmethod
    def calculate_current_streak(db: Session, habit_id: int) -> int:
        """Calculate the current active streak for a habit"""
        today = date.today()
        
        # Get all entries in reverse chronological order
        entries = db.query(HabitEntry).filter(
            HabitEntry.habit_id == habit_id
        ).order_by(HabitEntry.entry_date.desc()).all()
        
        if not entries:
            return 0
        
        streak = 0
        current_date = today
        
        for entry in entries:
            entry_date = entry.entry_date.date() if isinstance(entry.entry_date, datetime) else entry.entry_date
            
            # Check if this entry is for the expected date
            if entry_date == current_date:
                if entry.is_successful:
                    streak += 1
                    current_date -= timedelta(days=1)
                else:
                    # Streak broken
                    break
            elif entry_date < current_date:
                # Gap in entries - streak broken
                break
        
        return streak
    
    @staticmethod
    def recalculate_streaks(db: Session, habit_id: int) -> None:
        """Recalculate all streaks for a habit and update streak records"""
        
        # Get all entries for this habit, ordered by date
        entries = db.query(HabitEntry).filter(
            HabitEntry.habit_id == habit_id
        ).order_by(HabitEntry.entry_date.asc()).all()
        
        if not entries:
            return
        
        # Calculate all streaks
        streaks = []
        current_streak_start = None
        current_streak_length = 0
        
        for i, entry in enumerate(entries):
            entry_date = entry.entry_date.date() if isinstance(entry.entry_date, datetime) else entry.entry_date
            
            if entry.is_successful:
                if current_streak_start is None:
                    # Start new streak
                    current_streak_start = entry_date
                    current_streak_length = 1
                else:
                    # Check if consecutive day
                    prev_entry_date = entries[i-1].entry_date.date() if isinstance(entries[i-1].entry_date, datetime) else entries[i-1].entry_date
                    if (entry_date - prev_entry_date).days == 1:
                        # Continue streak
                        current_streak_length += 1
                    else:
                        # Gap - save previous streak and start new one
                        if current_streak_length > 0:
                            streaks.append({
                                'start_date': current_streak_start,
                                'end_date': prev_entry_date,
                                'length': current_streak_length,
                                'is_active': False
                            })
                        current_streak_start = entry_date
                        current_streak_length = 1
            else:
                # Failed day - end current streak if exists
                if current_streak_length > 0:
                    prev_entry_date = entries[i-1].entry_date.date() if isinstance(entries[i-1].entry_date, datetime) else entries[i-1].entry_date
                    streaks.append({
                        'start_date': current_streak_start,
                        'end_date': prev_entry_date,
                        'length': current_streak_length,
                        'is_active': False
                    })
                    current_streak_start = None
                    current_streak_length = 0
        
        # Save final streak if exists
        if current_streak_length > 0:
            last_entry_date = entries[-1].entry_date.date() if isinstance(entries[-1].entry_date, datetime) else entries[-1].entry_date
            streaks.append({
                'start_date': current_streak_start,
                'end_date': last_entry_date,
                'length': current_streak_length,
                'is_active': (last_entry_date == date.today() or last_entry_date == date.today() - timedelta(days=1))
            })
        
        # Delete old streak records
        db.query(HabitStreak).filter(HabitStreak.habit_id == habit_id).delete()
        
        # Insert new streak records (top 10 longest)
        sorted_streaks = sorted(streaks, key=lambda x: x['length'], reverse=True)[:10]
        for streak_data in sorted_streaks:
            db_streak = HabitStreak(
                habit_id=habit_id,
                start_date=datetime.combine(streak_data['start_date'], datetime.min.time()),
                end_date=datetime.combine(streak_data['end_date'], datetime.max.time()),
                streak_length=streak_data['length'],
                is_active=streak_data['is_active']
            )
            db.add(db_streak)
        
        db.commit()
    
    @staticmethod
    def get_top_streaks(db: Session, habit_id: int, limit: int = 3) -> List[HabitStreak]:
        """Get top N longest streaks for a habit"""
        return db.query(HabitStreak).filter(
            HabitStreak.habit_id == habit_id
        ).order_by(desc(HabitStreak.streak_length)).limit(limit).all()
    
    # ============================================
    # AUTO-SYNC FROM TASKS
    # ============================================
    
    @staticmethod
    def auto_sync_from_task(
        db: Session,
        task_id: int,
        entry_date: date,
        actual_minutes: int
    ) -> List[HabitEntry]:
        """Auto-populate habit entries from linked task time entries"""
        
        # Find all habits linked to this task
        linked_habits = db.query(Habit).filter(
            and_(
                Habit.linked_task_id == task_id,
                Habit.is_active == True
            )
        ).all()
        
        created_entries = []
        
        for habit in linked_habits:
            # Determine if habit criteria was met
            is_successful = False
            
            if habit.habit_type == 'time_based' and habit.target_value:
                if habit.target_comparison == 'at_least':
                    is_successful = actual_minutes >= habit.target_value
                elif habit.target_comparison == 'at_most':
                    is_successful = actual_minutes <= habit.target_value
                elif habit.target_comparison == 'exactly':
                    is_successful = actual_minutes == habit.target_value
            
            # Create or update habit entry
            entry = HabitService.mark_habit_entry(
                db=db,
                habit_id=habit.id,
                entry_date=entry_date,
                is_successful=is_successful,
                actual_value=actual_minutes,
                note=f"Auto-synced from task (actual: {actual_minutes} min)"
            )
            created_entries.append(entry)
        
        return created_entries
    
    # ============================================
    # ANALYTICS & INSIGHTS
    # ============================================
    
    @staticmethod
    def get_habit_stats(db: Session, habit_id: int) -> Dict:
        """Get statistics for a habit"""
        habit = db.query(Habit).filter(Habit.id == habit_id).first()
        if not habit:
            return {}
        
        # Get all entries
        all_entries = db.query(HabitEntry).filter(HabitEntry.habit_id == habit_id).all()
        
        if not all_entries:
            return {
                'total_entries': 0,
                'successful_entries': 0,
                'success_rate': 0,
                'current_streak': 0,
                'longest_streak': 0
            }
        
        successful = len([e for e in all_entries if e.is_successful])
        total = len(all_entries)
        
        # Get current streak
        current_streak = HabitService.calculate_current_streak(db, habit_id)
        
        # Get longest streak
        top_streaks = HabitService.get_top_streaks(db, habit_id, limit=1)
        longest_streak = top_streaks[0].streak_length if top_streaks else 0
        
        return {
            'total_entries': total,
            'successful_entries': successful,
            'success_rate': round((successful / total) * 100, 1) if total > 0 else 0,
            'current_streak': current_streak,
            'longest_streak': longest_streak
        }
    
    # ============================================
    # WEEKLY/MONTHLY HABIT SESSION TRACKING
    # ============================================
    
    @staticmethod
    def get_period_bounds(period_type: str, reference_date: date = None) -> Tuple[date, date]:
        """Get start and end dates for a period (week or month)"""
        if reference_date is None:
            reference_date = date.today()
        
        if period_type == 'weekly':
            # Week starts on Monday (0), ends on Sunday (6)
            start = reference_date - timedelta(days=reference_date.weekday())
            end = start + timedelta(days=6)
        elif period_type == 'monthly':
            # Month starts on 1st, ends on last day
            start = reference_date.replace(day=1)
            # Get last day of month
            if reference_date.month == 12:
                end = date(reference_date.year + 1, 1, 1) - timedelta(days=1)
            else:
                end = date(reference_date.year, reference_date.month + 1, 1) - timedelta(days=1)
        else:
            raise ValueError(f"Invalid period_type: {period_type}")
        
        return start, end
    
    @staticmethod
    def get_or_create_period(db: Session, habit_id: int, period_type: str, reference_date: date = None) -> HabitPeriod:
        """Get or create a habit period for tracking"""
        if reference_date is None:
            reference_date = date.today()
        
        period_start, period_end = HabitService.get_period_bounds(period_type, reference_date)
        
        # Try to find existing period
        period = db.query(HabitPeriod).filter(
            and_(
                HabitPeriod.habit_id == habit_id,
                HabitPeriod.period_start == period_start
            )
        ).first()
        
        if not period:
            # Create new period
            habit = db.query(Habit).filter(Habit.id == habit_id).first()
            if not habit:
                raise ValueError(f"Habit {habit_id} not found")
            
            period = HabitPeriod(
                habit_id=habit_id,
                period_type=period_type,
                period_start=period_start,
                period_end=period_end,
                target_count=habit.target_count_per_period,
                aggregate_target=habit.aggregate_target,
                completed_count=0,
                aggregate_achieved=0,
                is_successful=False,
                success_percentage=0.0,
                quality_percentage=0.0
            )
            db.add(period)
            db.commit()
            db.refresh(period)
        
        return period
    
    @staticmethod
    def get_period_sessions(db: Session, habit_id: int, period_start: date) -> List[HabitSession]:
        """Get all sessions for a specific period"""
        return db.query(HabitSession).filter(
            and_(
                HabitSession.habit_id == habit_id,
                HabitSession.period_start == period_start
            )
        ).order_by(HabitSession.session_number).all()
    
    @staticmethod
    def initialize_period_sessions(db: Session, habit_id: int, period_type: str, reference_date: date = None):
        """Initialize empty session slots for a period"""
        habit = db.query(Habit).filter(Habit.id == habit_id).first()
        if not habit or not habit.target_count_per_period:
            return
        
        period_start, period_end = HabitService.get_period_bounds(period_type, reference_date)
        
        # Create session slots
        for session_num in range(1, habit.target_count_per_period + 1):
            existing = db.query(HabitSession).filter(
                and_(
                    HabitSession.habit_id == habit_id,
                    HabitSession.period_start == period_start,
                    HabitSession.session_number == session_num
                )
            ).first()
            
            if not existing:
                session = HabitSession(
                    habit_id=habit_id,
                    period_type=period_type,
                    period_start=period_start,
                    period_end=period_end,
                    session_number=session_num,
                    is_completed=False
                )
                db.add(session)
        
        db.commit()
    
    @staticmethod
    def mark_session_complete(db: Session, session_id: int, value: int = None, notes: str = None) -> HabitSession:
        """Mark a session as complete"""
        session = db.query(HabitSession).filter(HabitSession.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        habit = db.query(Habit).filter(Habit.id == session.habit_id).first()
        
        session.is_completed = True
        session.completed_at = datetime.now()
        session.value_achieved = value
        session.notes = notes
        
        # Check if meets target (for occurrence_with_value mode)
        if value is not None and habit.session_target_value:
            if habit.target_comparison == 'at_least':
                session.meets_target = value >= habit.session_target_value
            elif habit.target_comparison == 'at_most':
                session.meets_target = value <= habit.session_target_value
            elif habit.target_comparison == 'exactly':
                session.meets_target = value == habit.session_target_value
        
        db.commit()
        
        # Update period summary
        HabitService.update_period_summary(db, session.habit_id, session.period_start)
        
        db.refresh(session)
        return session
    
    @staticmethod
    def add_to_aggregate(db: Session, habit_id: int, value: int, entry_date: date = None):
        """Add value to aggregate habit (e.g., +50 pages read today)"""
        if entry_date is None:
            entry_date = date.today()
        
        habit = db.query(Habit).filter(Habit.id == habit_id).first()
        if not habit or habit.tracking_mode != 'aggregate':
            raise ValueError("Habit must be in aggregate tracking mode")
        
        # Get or create period
        period = HabitService.get_or_create_period(db, habit_id, habit.period_type, entry_date)
        
        # Add to aggregate
        period.aggregate_achieved += value
        
        # Update success metrics
        if period.aggregate_target and period.aggregate_target > 0:
            period.success_percentage = (period.aggregate_achieved / period.aggregate_target) * 100
            period.is_successful = period.aggregate_achieved >= period.aggregate_target
        
        db.commit()
        db.refresh(period)
        return period
    
    @staticmethod
    def update_period_summary(db: Session, habit_id: int, period_start: date):
        """Recalculate period summary based on sessions"""
        period = db.query(HabitPeriod).filter(
            and_(
                HabitPeriod.habit_id == habit_id,
                HabitPeriod.period_start == period_start
            )
        ).first()
        
        if not period:
            return
        
        sessions = HabitService.get_period_sessions(db, habit_id, period_start)
        
        # Count completed sessions
        completed_sessions = [s for s in sessions if s.is_completed]
        period.completed_count = len(completed_sessions)
        
        # Calculate success percentage
        if period.target_count and period.target_count > 0:
            period.success_percentage = (period.completed_count / period.target_count) * 100
            period.is_successful = period.completed_count >= period.target_count
        
        # Calculate quality percentage (for occurrence_with_value mode)
        sessions_with_target = [s for s in completed_sessions if s.meets_target is not None]
        if sessions_with_target:
            meets_target_count = len([s for s in sessions_with_target if s.meets_target])
            period.quality_percentage = (meets_target_count / len(sessions_with_target)) * 100
        
        db.commit()
        db.refresh(period)
        return period
    
    @staticmethod
    def get_current_period_stats(db: Session, habit_id: int) -> Dict:
        """Get stats for current period (week or month)"""
        habit = db.query(Habit).filter(Habit.id == habit_id).first()
        if not habit:
            return {}
        
        # Handle daily habits separately
        if habit.period_type == 'daily':
            return HabitService.get_habit_stats(db, habit_id)
        
        # Get current period
        period = HabitService.get_or_create_period(db, habit_id, habit.period_type)
        sessions = HabitService.get_period_sessions(db, habit_id, period.period_start)
        
        # Calculate days/time remaining
        today = date.today()
        days_remaining = (period.period_end - today).days + 1
        
        stats = {
            'period_start': period.period_start.isoformat(),
            'period_end': period.period_end.isoformat(),
            'period_type': period.period_type,
            'days_remaining': days_remaining,
            'tracking_mode': habit.tracking_mode,
        }
        
        if habit.tracking_mode in ['occurrence', 'occurrence_with_value']:
            stats.update({
                'target_count': period.target_count,
                'completed_count': period.completed_count,
                'success_percentage': period.success_percentage,
                'is_successful': period.is_successful,
                'sessions': [{
                    'id': s.id,
                    'session_number': s.session_number,
                    'is_completed': s.is_completed,
                    'completed_at': s.completed_at.isoformat() if s.completed_at else None,
                    'value_achieved': s.value_achieved,
                    'meets_target': s.meets_target,
                    'notes': s.notes
                } for s in sessions]
            })
            
            if habit.tracking_mode == 'occurrence_with_value':
                stats['quality_percentage'] = period.quality_percentage
                stats['session_target'] = habit.session_target_value
                stats['session_unit'] = habit.session_target_unit
        
        elif habit.tracking_mode == 'aggregate':
            stats.update({
                'aggregate_target': period.aggregate_target,
                'aggregate_achieved': period.aggregate_achieved,
                'success_percentage': period.success_percentage,
                'is_successful': period.is_successful,
                'unit': habit.session_target_unit,
                'remaining': period.aggregate_target - period.aggregate_achieved if period.aggregate_target else 0,
                'daily_pace_needed': ((period.aggregate_target - period.aggregate_achieved) / days_remaining) if (period.aggregate_target and days_remaining > 0) else 0
            })
        
        return stats
