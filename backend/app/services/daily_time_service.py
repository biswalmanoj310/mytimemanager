"""
Service layer for daily time entries and summaries
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict
from app.models.models import DailyTimeEntry, DailySummary, Task
from app.models.schemas import DailyTimeEntryCreate, DailySummaryResponse, IncompleteDayResponse


def get_daily_time_entries(db: Session, entry_date: date, task_id: Optional[int] = None) -> List[DailyTimeEntry]:
    """Get all time entries for a specific date"""
    query = db.query(DailyTimeEntry).filter(
        func.date(DailyTimeEntry.entry_date) == entry_date
    )
    if task_id:
        query = query.filter(DailyTimeEntry.task_id == task_id)
    return query.all()


def save_daily_time_entry(db: Session, entry_data: DailyTimeEntryCreate) -> DailyTimeEntry:
    """Save or update a daily time entry"""
    # Check if entry already exists
    existing = db.query(DailyTimeEntry).filter(
        and_(
            DailyTimeEntry.task_id == entry_data.task_id,
            func.date(DailyTimeEntry.entry_date) == entry_data.entry_date.date(),
            DailyTimeEntry.hour == entry_data.hour
        )
    ).first()

    if existing:
        # Update existing entry
        existing.minutes = entry_data.minutes
        existing.updated_at = datetime.now()
        db.commit()
        db.refresh(existing)
        
        # Trigger auto-sync for linked challenges
        from app.services.challenge_service import sync_challenge_from_task
        sync_challenge_from_task(db, entry_data.task_id, entry_data.entry_date.date())
        
        return existing
    else:
        # Create new entry
        new_entry = DailyTimeEntry(
            task_id=entry_data.task_id,
            entry_date=entry_data.entry_date,
            hour=entry_data.hour,
            minutes=entry_data.minutes
        )
        db.add(new_entry)
        db.commit()
        db.refresh(new_entry)
        
        # Trigger auto-sync for linked challenges
        from app.services.challenge_service import sync_challenge_from_task
        sync_challenge_from_task(db, entry_data.task_id, entry_data.entry_date.date())
        
        return new_entry


def bulk_save_daily_entries(db: Session, entry_date: date, entries: List[Dict]) -> bool:
    """Bulk save/update daily time entries for a specific date"""
    try:
        for entry in entries:
            task_id = entry.get('task_id')
            hour = entry.get('hour')
            minutes = entry.get('minutes', 0)

            if task_id is None or hour is None:
                continue

            # Check if entry exists
            existing = db.query(DailyTimeEntry).filter(
                and_(
                    DailyTimeEntry.task_id == task_id,
                    func.date(DailyTimeEntry.entry_date) == entry_date,
                    DailyTimeEntry.hour == hour
                )
            ).first()

            if minutes == 0:
                # Delete entry if minutes is 0
                if existing:
                    db.delete(existing)
            else:
                # Update or create entry
                if existing:
                    existing.minutes = minutes
                    existing.updated_at = datetime.now()
                else:
                    new_entry = DailyTimeEntry(
                        task_id=task_id,
                        entry_date=datetime.combine(entry_date, datetime.min.time()),
                        hour=hour,
                        minutes=minutes
                    )
                    db.add(new_entry)

        db.commit()
        
        # Update daily summary
        update_daily_summary(db, entry_date)
        
        # AUTO-SYNC: Update linked habits for each task
        import sys
        from app.services.habit_service import HabitService
        
        # Collect all tasks that were updated (including those set to 0)
        affected_task_ids = set()
        for entry in entries:
            task_id = entry.get('task_id')
            if task_id:
                affected_task_ids.add(task_id)
        
        print(f"🔄 HABIT SYNC: Affected tasks: {affected_task_ids}", flush=True)
        sys.stdout.flush()
        
        # Calculate total time per task for the ENTIRE day (not just from bulk update)
        # This ensures we get the accurate total even if only one hour was updated
        task_totals = {}
        for task_id in affected_task_ids:
            # Query all entries for this task on this date
            day_entries = db.query(DailyTimeEntry).filter(
                and_(
                    DailyTimeEntry.task_id == task_id,
                    func.date(DailyTimeEntry.entry_date) == entry_date
                )
            ).all()
            
            total_minutes = sum(e.minutes for e in day_entries)
            task_totals[task_id] = total_minutes
            print(f"🔄 HABIT SYNC: Task {task_id} total for {entry_date}: {total_minutes} minutes", flush=True)
            sys.stdout.flush()
        
        # Auto-sync habits for each task (including tasks now at 0 minutes)
        for task_id, total_minutes in task_totals.items():
            try:
                print(f"🔄 HABIT SYNC: Calling auto_sync_from_task for task {task_id} with {total_minutes} minutes", flush=True)
                sys.stdout.flush()
                result = HabitService.auto_sync_from_task(
                    db=db,
                    task_id=task_id,
                    entry_date=entry_date,
                    actual_minutes=total_minutes
                )
                print(f"✅ HABIT SYNC: Created/updated {len(result)} habit entries for task {task_id}", flush=True)
                sys.stdout.flush()
            except Exception as e:
                # Don't fail the whole operation if habit sync fails
                print(f"❌ Warning: Failed to auto-sync habits for task {task_id}: {e}")
        
        # Auto-sync challenges for each task
        from app.services.challenge_service import sync_challenge_from_task
        for task_id in task_totals.keys():
            try:
                sync_challenge_from_task(db=db, task_id=task_id, entry_date=entry_date)
            except Exception as e:
                # Don't fail the whole operation if challenge sync fails
                print(f"Warning: Failed to auto-sync challenges for task {task_id}: {e}")
        
        return True
    except Exception as e:
        db.rollback()
        raise e


def update_daily_summary(db: Session, entry_date: date) -> DailySummary:
    """Calculate and update daily summary"""
    from app.models.models import DailyTaskStatus
    
    # Get time-based tasks from Daily tab's ⏰Time-Based Tasks section ONLY
    # Excludes is_daily_one_time tasks (which appear in separate "Daily: One Time Tasks" section)
    # User ensures these tasks total 1440 minutes (24 hours)
    # Note: task_type can be 'TIME' or 'time' (case-insensitive in database)
    time_based_tasks = db.query(Task).filter(
        and_(
            Task.follow_up_frequency == 'daily',
            func.upper(Task.task_type) == 'TIME',  # Case-insensitive match
            Task.is_active == True,
            Task.is_completed == False,
            or_(Task.is_daily_one_time == False, Task.is_daily_one_time == None)
        )
    ).all()

    # Get all time entries for this date
    entries = db.query(DailyTimeEntry).filter(
        func.date(DailyTimeEntry.entry_date) == entry_date
    ).all()
    
    # Calculate total allocated
    # Since user ensures daily TIME tasks always total 1440 minutes (24 hours),
    # we sum ALL active daily TIME tasks as they represent what should be in the table
    total_allocated = sum(task.allocated_minutes for task in time_based_tasks)

    # Calculate total spent (using entries already fetched above)
    total_spent = sum(entry.minutes for entry in entries)

    # Check if day is complete
    # Day is complete if:
    # 1. Spent >= allocated (overspent is OK, means you did extra work)
    # 2. OR difference is within 5 minutes tolerance (small rounding errors)
    # 3. AND total_spent > 0 (not a zero day)
    difference = abs(total_allocated - total_spent)
    is_complete = (total_spent >= total_allocated or difference <= 5) and total_spent > 0

    # Get or create daily summary
    summary = db.query(DailySummary).filter(
        func.date(DailySummary.entry_date) == entry_date
    ).first()

    if summary:
        summary.total_allocated = total_allocated
        summary.total_spent = total_spent
        summary.is_complete = is_complete
        summary.updated_at = datetime.now()
    else:
        summary = DailySummary(
            entry_date=datetime.combine(entry_date, datetime.min.time()),
            total_allocated=total_allocated,
            total_spent=total_spent,
            is_complete=is_complete
        )
        db.add(summary)

    db.commit()
    db.refresh(summary)
    return summary


def get_incomplete_days(db: Session, limit: int = 30) -> List[IncompleteDayResponse]:
    """Get list of incomplete days (where allocated != spent)
    Shows incomplete days from Nov 1, 2025 onwards (active usage period)
    - Days with 0 spent = forgot to track (shown as incomplete)
    - Days before Nov 1, 2025 with 0 spent = test days (excluded)
    - Ignored days are excluded from this list
    Excludes today since the day is not yet over
    """
    today = date.today()
    active_start_date = date(2025, 11, 1)  # Start of active usage
    
    summaries = db.query(DailySummary).filter(
        and_(
            DailySummary.is_complete == False,
            DailySummary.is_ignored == False,  # Exclude ignored days
            func.date(DailySummary.entry_date) >= active_start_date,  # Only from Nov 1, 2025
            func.date(DailySummary.entry_date) < today  # Exclude today
        )
    ).order_by(DailySummary.entry_date.desc()).limit(limit).all()

    result = []
    for summary in summaries:
        result.append(IncompleteDayResponse(
            entry_date=summary.entry_date,
            total_allocated=summary.total_allocated,
            total_spent=summary.total_spent,
            difference=abs(summary.total_allocated - summary.total_spent)
        ))

    return result


def get_daily_summary(db: Session, entry_date: date) -> Optional[DailySummary]:
    """Get summary for a specific date"""
    return db.query(DailySummary).filter(
        func.date(DailySummary.entry_date) == entry_date
    ).first()


def get_week_daily_aggregates(db: Session, week_start_date: date) -> Dict:
    """Get aggregated daily entries for a week (7 days)
    Returns: {task_id: {day_of_week: total_minutes}}
    where day_of_week is 0-6 (Sunday-Saturday)
    """
    result = {}
    
    for day_offset in range(7):
        current_date = date.fromordinal(week_start_date.toordinal() + day_offset)
        
        # Get all entries for this date
        entries = db.query(DailyTimeEntry).filter(
            func.date(DailyTimeEntry.entry_date) == current_date
        ).all()
        
        # Aggregate by task
        for entry in entries:
            task_id = entry.task_id
            if task_id not in result:
                result[task_id] = {}
            
            if day_offset not in result[task_id]:
                result[task_id][day_offset] = 0
            
            result[task_id][day_offset] += entry.minutes
    
    return result


def get_month_daily_aggregates(db: Session, month_start_date: date) -> Dict:
    """Get aggregated daily entries for a month
    Returns: {task_id: {day_of_month: total_minutes}}
    where day_of_month is 1-31
    """
    result = {}
    
    # Calculate the number of days in the month
    year = month_start_date.year
    month = month_start_date.month
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    days_in_month = (next_month - month_start_date).days
    
    for day_of_month in range(1, days_in_month + 1):
        current_date = date(year, month, day_of_month)
        
        # Get all entries for this date
        entries = db.query(DailyTimeEntry).filter(
            func.date(DailyTimeEntry.entry_date) == current_date
        ).all()
        
        # Aggregate by task
        for entry in entries:
            task_id = entry.task_id
            if task_id not in result:
                result[task_id] = {}
            
            if day_of_month not in result[task_id]:
                result[task_id][day_of_month] = 0
            
            result[task_id][day_of_month] += entry.minutes
    
    return result


def ignore_day(db: Session, entry_date: date, reason: Optional[str] = None) -> Optional[DailySummary]:
    """Mark a day as ignored (travel, sick days, etc.)"""
    summary = db.query(DailySummary).filter(
        func.date(DailySummary.entry_date) == entry_date
    ).first()
    
    if summary:
        summary.is_ignored = True
        summary.ignore_reason = reason
        summary.ignored_at = datetime.now()
        db.commit()
        db.refresh(summary)
    
    return summary


def unignore_day(db: Session, entry_date: date) -> Optional[DailySummary]:
    """Remove ignore flag from a day"""
    summary = db.query(DailySummary).filter(
        func.date(DailySummary.entry_date) == entry_date
    ).first()
    
    if summary:
        summary.is_ignored = False
        summary.ignore_reason = None
        summary.ignored_at = None
        db.commit()
        db.refresh(summary)
    
    return summary


def get_ignored_days(db: Session, limit: int = 30):
    """Get list of ignored days"""
    from app.models.schemas import IgnoredDayResponse
    
    summaries = db.query(DailySummary).filter(
        DailySummary.is_ignored == True
    ).order_by(DailySummary.entry_date.desc()).limit(limit).all()
    
    result = []
    for summary in summaries:
        result.append(IgnoredDayResponse(
            entry_date=summary.entry_date,
            total_allocated=summary.total_allocated,
            total_spent=summary.total_spent,
            ignore_reason=summary.ignore_reason,
            ignored_at=summary.ignored_at
        ))
    
    return result
