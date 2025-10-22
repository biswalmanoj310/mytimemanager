"""
Time Entry Service
Business logic for time tracking with 30-minute slot validation
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status

from app.models.models import TimeEntry, Task, Pillar, Category, SubCategory
from app.models.schemas import TimeEntryCreate, TimeEntryUpdate


class TimeEntryService:
    """Service for managing time entries with validation"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def validate_time_slot(self, start_time: datetime, end_time: datetime) -> int:
        """
        Validate that time slot is in 30-minute increments
        Returns duration in minutes
        """
        if end_time <= start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End time must be after start time"
            )
        
        duration = (end_time - start_time).total_seconds() / 60
        
        if duration <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duration must be positive"
            )
        
        # Must be in 30-minute increments
        if duration % 30 != 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duration must be in 30-minute increments (30, 60, 90, etc.)"
            )
        
        return int(duration)
    
    def check_time_overlap(
        self, 
        start_time: datetime, 
        end_time: datetime, 
        exclude_entry_id: Optional[int] = None
    ) -> bool:
        """
        Check if time slot overlaps with existing entries
        """
        query = self.db.query(TimeEntry).filter(
            and_(
                or_(
                    # New entry starts during existing entry
                    and_(
                        TimeEntry.start_time <= start_time,
                        TimeEntry.end_time > start_time
                    ),
                    # New entry ends during existing entry
                    and_(
                        TimeEntry.start_time < end_time,
                        TimeEntry.end_time >= end_time
                    ),
                    # New entry completely contains existing entry
                    and_(
                        TimeEntry.start_time >= start_time,
                        TimeEntry.end_time <= end_time
                    )
                )
            )
        )
        
        if exclude_entry_id:
            query = query.filter(TimeEntry.id != exclude_entry_id)
        
        return query.first() is not None
    
    def create_time_entry(self, entry_data: TimeEntryCreate) -> TimeEntry:
        """Create a new time entry with validation"""
        # Verify task exists
        task = self.db.query(Task).filter(Task.id == entry_data.task_id).first()
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task with id {entry_data.task_id} not found"
            )
        
        # Validate time slot
        duration = self.validate_time_slot(entry_data.start_time, entry_data.end_time)
        
        # Check for overlaps
        if self.check_time_overlap(entry_data.start_time, entry_data.end_time):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Time slot overlaps with existing entry"
            )
        
        # Create time entry
        db_entry = TimeEntry(
            task_id=entry_data.task_id,
            entry_date=entry_data.entry_date or entry_data.start_time.date(),
            start_time=entry_data.start_time,
            end_time=entry_data.end_time,
            duration_minutes=duration,
            notes=entry_data.notes
        )
        
        self.db.add(db_entry)
        
        # Update task spent time
        task.spent_minutes = (task.spent_minutes or 0) + duration
        
        # If task has a goal, update goal spent hours
        if task.goal_id and task.goal:
            task.goal.spent_hours = (task.goal.spent_hours or 0) + (duration / 60)
        
        self.db.commit()
        self.db.refresh(db_entry)
        
        return db_entry
    
    def get_time_entry(self, entry_id: int) -> TimeEntry:
        """Get a time entry by ID"""
        entry = self.db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Time entry with id {entry_id} not found"
            )
        return entry
    
    def get_time_entries(
        self,
        task_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[TimeEntry]:
        """Get time entries with optional filtering"""
        query = self.db.query(TimeEntry)
        
        if task_id:
            query = query.filter(TimeEntry.task_id == task_id)
        
        if start_date:
            query = query.filter(
                func.date(TimeEntry.entry_date) >= start_date
            )
        
        if end_date:
            query = query.filter(
                func.date(TimeEntry.entry_date) <= end_date
            )
        
        return query.order_by(TimeEntry.entry_date.desc(), TimeEntry.start_time.desc())\
                    .offset(skip).limit(limit).all()
    
    def update_time_entry(self, entry_id: int, entry_data: TimeEntryUpdate) -> TimeEntry:
        """Update a time entry"""
        db_entry = self.get_time_entry(entry_id)
        old_duration = db_entry.duration_minutes
        
        # Update fields if provided
        update_dict = entry_data.model_dump(exclude_unset=True)
        
        # If times are being updated, validate
        new_start = update_dict.get('start_time', db_entry.start_time)
        new_end = update_dict.get('end_time', db_entry.end_time)
        
        if new_start != db_entry.start_time or new_end != db_entry.end_time:
            duration = self.validate_time_slot(new_start, new_end)
            
            # Check for overlaps (excluding current entry)
            if self.check_time_overlap(new_start, new_end, exclude_entry_id=entry_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Time slot overlaps with existing entry"
                )
            
            update_dict['duration_minutes'] = duration
            
            # Update entry date if start time changed
            if 'entry_date' not in update_dict and new_start != db_entry.start_time:
                update_dict['entry_date'] = new_start.date()
        
        # Update task spent time if duration changed
        task = db_entry.task
        if 'duration_minutes' in update_dict and update_dict['duration_minutes'] != old_duration:
            new_duration = update_dict['duration_minutes']
            task.spent_minutes = (task.spent_minutes or 0) - old_duration + new_duration
            
            # Update goal if task has one
            if task.goal_id and task.goal:
                old_hours = old_duration / 60
                new_hours = new_duration / 60
                task.goal.spent_hours = (task.goal.spent_hours or 0) - old_hours + new_hours
        
        # Apply updates
        for key, value in update_dict.items():
            setattr(db_entry, key, value)
        
        self.db.commit()
        self.db.refresh(db_entry)
        
        return db_entry
    
    def delete_time_entry(self, entry_id: int) -> Dict[str, str]:
        """Delete a time entry"""
        db_entry = self.get_time_entry(entry_id)
        
        # Update task spent time
        task = db_entry.task
        task.spent_minutes = max(0, (task.spent_minutes or 0) - db_entry.duration_minutes)
        
        # Update goal if task has one
        if task.goal_id and task.goal:
            hours = db_entry.duration_minutes / 60
            task.goal.spent_hours = max(0, (task.goal.spent_hours or 0) - hours)
        
        self.db.delete(db_entry)
        self.db.commit()
        
        return {"message": "Time entry deleted successfully"}
    
    def get_daily_grid(self, target_date: date) -> Dict[str, Any]:
        """
        Get time entries for a specific day in grid format
        Returns 30-minute slots from 00:00 to 23:30
        """
        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time())
        
        # Get all entries for the day
        entries = self.db.query(TimeEntry).filter(
            func.date(TimeEntry.entry_date) == target_date
        ).order_by(TimeEntry.start_time).all()
        
        # Create 30-minute slots
        slots = []
        current_time = start_datetime
        
        while current_time < end_datetime:
            slot_end = current_time + timedelta(minutes=30)
            
            # Find entry for this slot
            slot_entry = None
            for entry in entries:
                if entry.start_time <= current_time < entry.end_time:
                    slot_entry = {
                        "entry_id": entry.id,
                        "task_id": entry.task_id,
                        "task_name": entry.task.name,
                        "pillar_name": entry.task.pillar.name if entry.task.pillar else None,
                        "category_name": entry.task.category.name if entry.task.category else None,
                        "notes": entry.notes
                    }
                    break
            
            slots.append({
                "time_slot": current_time.strftime("%H:%M"),
                "start_time": current_time.isoformat(),
                "end_time": slot_end.isoformat(),
                "is_occupied": slot_entry is not None,
                "entry": slot_entry
            })
            
            current_time = slot_end
        
        # Calculate summary
        total_minutes = sum(e.duration_minutes for e in entries)
        
        return {
            "date": target_date.isoformat(),
            "total_entries": len(entries),
            "total_minutes": total_minutes,
            "total_hours": round(total_minutes / 60, 2),
            "slots": slots
        }
    
    def get_week_summary(self, start_date: date) -> Dict[str, Any]:
        """Get summary of time entries for a week"""
        end_date = start_date + timedelta(days=6)
        
        entries = self.db.query(TimeEntry).filter(
            and_(
                func.date(TimeEntry.entry_date) >= start_date,
                func.date(TimeEntry.entry_date) <= end_date
            )
        ).all()
        
        # Group by pillar
        pillar_summary = {}
        for entry in entries:
            pillar_name = entry.task.pillar.name if entry.task.pillar else "Uncategorized"
            if pillar_name not in pillar_summary:
                pillar_summary[pillar_name] = {
                    "total_minutes": 0,
                    "total_hours": 0,
                    "entry_count": 0
                }
            
            pillar_summary[pillar_name]["total_minutes"] += entry.duration_minutes
            pillar_summary[pillar_name]["total_hours"] = round(
                pillar_summary[pillar_name]["total_minutes"] / 60, 2
            )
            pillar_summary[pillar_name]["entry_count"] += 1
        
        # Group by day
        daily_summary = {}
        current_date = start_date
        while current_date <= end_date:
            day_entries = [e for e in entries if e.entry_date.date() == current_date]
            daily_summary[current_date.isoformat()] = {
                "total_minutes": sum(e.duration_minutes for e in day_entries),
                "total_hours": round(sum(e.duration_minutes for e in day_entries) / 60, 2),
                "entry_count": len(day_entries)
            }
            current_date += timedelta(days=1)
        
        total_minutes = sum(e.duration_minutes for e in entries)
        
        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_entries": len(entries),
            "total_minutes": total_minutes,
            "total_hours": round(total_minutes / 60, 2),
            "by_pillar": pillar_summary,
            "by_day": daily_summary
        }
    
    def get_statistics(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Get comprehensive statistics for time entries"""
        query = self.db.query(TimeEntry)
        
        if start_date:
            query = query.filter(func.date(TimeEntry.entry_date) >= start_date)
        
        if end_date:
            query = query.filter(func.date(TimeEntry.entry_date) <= end_date)
        
        entries = query.all()
        
        if not entries:
            return {
                "total_entries": 0,
                "total_minutes": 0,
                "total_hours": 0,
                "by_pillar": {},
                "by_category": {},
                "by_task": {},
                "average_duration": 0
            }
        
        total_minutes = sum(e.duration_minutes for e in entries)
        
        # Group by pillar
        pillar_stats = {}
        for entry in entries:
            pillar_name = entry.task.pillar.name if entry.task.pillar else "Uncategorized"
            if pillar_name not in pillar_stats:
                pillar_stats[pillar_name] = {"minutes": 0, "count": 0}
            pillar_stats[pillar_name]["minutes"] += entry.duration_minutes
            pillar_stats[pillar_name]["count"] += 1
        
        # Group by category
        category_stats = {}
        for entry in entries:
            category_name = entry.task.category.name if entry.task.category else "Uncategorized"
            if category_name not in category_stats:
                category_stats[category_name] = {"minutes": 0, "count": 0}
            category_stats[category_name]["minutes"] += entry.duration_minutes
            category_stats[category_name]["count"] += 1
        
        # Group by task
        task_stats = {}
        for entry in entries:
            task_name = entry.task.name
            if task_name not in task_stats:
                task_stats[task_name] = {"minutes": 0, "count": 0}
            task_stats[task_name]["minutes"] += entry.duration_minutes
            task_stats[task_name]["count"] += 1
        
        # Add hours to each stat
        for stats in [pillar_stats, category_stats, task_stats]:
            for key in stats:
                stats[key]["hours"] = round(stats[key]["minutes"] / 60, 2)
        
        return {
            "total_entries": len(entries),
            "total_minutes": total_minutes,
            "total_hours": round(total_minutes / 60, 2),
            "by_pillar": pillar_stats,
            "by_category": category_stats,
            "by_task": task_stats,
            "average_duration": round(total_minutes / len(entries), 2) if entries else 0
        }
