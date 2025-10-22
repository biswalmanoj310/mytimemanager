"""
Calendar Service
Provides calendar views (daily, weekly, monthly) with tasks, goals, and time entries
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from calendar import monthrange, day_name

from app.models.models import Task, Goal, TimeEntry, Pillar, Category


class CalendarService:
    """Service for calendar views and event aggregation"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_daily_view(
        self,
        target_date: date,
        pillar_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get daily calendar view with all events
        Shows tasks, goals, and time entries for a specific day
        """
        # Get time entries for the day
        time_query = self.db.query(TimeEntry).filter(
            func.date(TimeEntry.entry_date) == target_date
        )
        
        if pillar_id:
            time_query = time_query.join(Task).filter(Task.pillar_id == pillar_id)
        
        time_entries = time_query.order_by(TimeEntry.start_time).all()
        
        # Get tasks due on this day or with TODAY frequency
        task_query = self.db.query(Task).filter(
            and_(
                Task.is_active == True,
                or_(
                    func.date(Task.due_date) == target_date,
                    Task.follow_up_frequency == "today"
                )
            )
        )
        
        if pillar_id:
            task_query = task_query.filter(Task.pillar_id == pillar_id)
        
        tasks = task_query.all()
        
        # Get goals that are active
        goal_query = self.db.query(Goal).filter(
            and_(
                Goal.is_active == True,
                Goal.is_completed == False
            )
        )
        
        if pillar_id:
            goal_query = goal_query.filter(Goal.pillar_id == pillar_id)
        
        goals = goal_query.all()
        
        # Format events
        events = []
        
        # Add time entries as events
        for entry in time_entries:
            events.append({
                "type": "time_entry",
                "id": entry.id,
                "title": entry.task.name if entry.task else "Unknown Task",
                "start_time": entry.start_time.isoformat(),
                "end_time": entry.end_time.isoformat(),
                "duration_minutes": entry.duration_minutes,
                "pillar": {
                    "id": entry.task.pillar_id if entry.task else None,
                    "name": entry.task.pillar.name if entry.task and entry.task.pillar else None,
                    "icon": entry.task.pillar.icon if entry.task and entry.task.pillar else None,
                    "color": entry.task.pillar.color_code if entry.task and entry.task.pillar else None
                },
                "category": entry.task.category.name if entry.task and entry.task.category else None,
                "notes": entry.notes
            })
        
        # Add tasks as events
        for task in tasks:
            events.append({
                "type": "task",
                "id": task.id,
                "title": task.name,
                "due_date": task.due_date.isoformat() if task.due_date else None,
                "frequency": task.follow_up_frequency,
                "is_completed": task.is_completed,
                "pillar": {
                    "id": task.pillar_id,
                    "name": task.pillar.name if task.pillar else None,
                    "icon": task.pillar.icon if task.pillar else None,
                    "color": task.pillar.color_code if task.pillar else None
                },
                "category": task.category.name if task.category else None,
                "allocated_minutes": task.allocated_minutes,
                "spent_minutes": task.spent_minutes
            })
        
        # Add goals as background info
        goal_summary = []
        for goal in goals:
            goal_summary.append({
                "id": goal.id,
                "name": goal.name,
                "time_period": goal.goal_time_period,
                "progress": round((goal.spent_hours / goal.allocated_hours * 100) if goal.allocated_hours > 0 else 0, 2),
                "pillar": {
                    "id": goal.pillar_id,
                    "name": goal.pillar.name if goal.pillar else None,
                    "icon": goal.pillar.icon if goal.pillar else None
                }
            })
        
        # Calculate summary
        total_time_minutes = sum(e.duration_minutes for e in time_entries)
        
        return {
            "date": target_date.isoformat(),
            "day_of_week": target_date.strftime("%A"),
            "events": events,
            "active_goals": goal_summary,
            "summary": {
                "total_time_entries": len(time_entries),
                "total_time_minutes": total_time_minutes,
                "total_time_hours": round(total_time_minutes / 60, 2),
                "total_tasks": len(tasks),
                "completed_tasks": sum(1 for t in tasks if t.is_completed),
                "active_goals": len(goals)
            }
        }
    
    def get_weekly_view(
        self,
        start_date: date,
        pillar_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get weekly calendar view (7 days starting from start_date)
        Groups events by day
        """
        end_date = start_date + timedelta(days=6)
        
        # Get all time entries for the week
        time_query = self.db.query(TimeEntry).filter(
            and_(
                func.date(TimeEntry.entry_date) >= start_date,
                func.date(TimeEntry.entry_date) <= end_date
            )
        )
        
        if pillar_id:
            time_query = time_query.join(Task).filter(Task.pillar_id == pillar_id)
        
        time_entries = time_query.order_by(TimeEntry.entry_date, TimeEntry.start_time).all()
        
        # Get tasks due this week
        task_query = self.db.query(Task).filter(
            and_(
                Task.is_active == True,
                or_(
                    and_(
                        Task.due_date.isnot(None),
                        func.date(Task.due_date) >= start_date,
                        func.date(Task.due_date) <= end_date
                    ),
                    Task.follow_up_frequency.in_(["today", "weekly"])
                )
            )
        )
        
        if pillar_id:
            task_query = task_query.filter(Task.pillar_id == pillar_id)
        
        tasks = task_query.all()
        
        # Group by day
        days = []
        current_date = start_date
        
        while current_date <= end_date:
            # Filter entries for this day
            day_entries = [e for e in time_entries if e.entry_date.date() == current_date]
            day_tasks = [t for t in tasks if (t.due_date and t.due_date.date() == current_date) or t.follow_up_frequency in ["today", "weekly"]]
            
            day_time_minutes = sum(e.duration_minutes for e in day_entries)
            
            days.append({
                "date": current_date.isoformat(),
                "day_of_week": current_date.strftime("%A"),
                "is_today": current_date == date.today(),
                "time_entries_count": len(day_entries),
                "tasks_count": len(day_tasks),
                "total_minutes": day_time_minutes,
                "total_hours": round(day_time_minutes / 60, 2),
                "events": [
                    {
                        "type": "time_entry",
                        "id": e.id,
                        "title": e.task.name if e.task else "Unknown",
                        "start_time": e.start_time.strftime("%H:%M"),
                        "duration_minutes": e.duration_minutes,
                        "pillar_name": e.task.pillar.name if e.task and e.task.pillar else None,
                        "pillar_icon": e.task.pillar.icon if e.task and e.task.pillar else None
                    }
                    for e in day_entries
                ] + [
                    {
                        "type": "task",
                        "id": t.id,
                        "title": t.name,
                        "is_completed": t.is_completed,
                        "pillar_name": t.pillar.name if t.pillar else None,
                        "pillar_icon": t.pillar.icon if t.pillar else None
                    }
                    for t in day_tasks
                ]
            })
            
            current_date += timedelta(days=1)
        
        # Weekly summary
        total_minutes = sum(e.duration_minutes for e in time_entries)
        
        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "week_number": start_date.isocalendar()[1],
            "days": days,
            "summary": {
                "total_time_entries": len(time_entries),
                "total_time_minutes": total_minutes,
                "total_time_hours": round(total_minutes / 60, 2),
                "total_tasks": len(tasks),
                "completed_tasks": sum(1 for t in tasks if t.is_completed),
                "active_days": len([d for d in days if d["time_entries_count"] > 0])
            }
        }
    
    def get_monthly_view(
        self,
        year: int,
        month: int,
        pillar_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get monthly calendar view
        Shows all days in month with event counts
        """
        # Get first and last day of month
        first_day = date(year, month, 1)
        last_day = date(year, month, monthrange(year, month)[1])
        
        # Get all time entries for the month
        time_query = self.db.query(TimeEntry).filter(
            and_(
                func.date(TimeEntry.entry_date) >= first_day,
                func.date(TimeEntry.entry_date) <= last_day
            )
        )
        
        if pillar_id:
            time_query = time_query.join(Task).filter(Task.pillar_id == pillar_id)
        
        time_entries = time_query.all()
        
        # Get tasks due this month
        task_query = self.db.query(Task).filter(
            and_(
                Task.is_active == True,
                Task.due_date.isnot(None),
                func.date(Task.due_date) >= first_day,
                func.date(Task.due_date) <= last_day
            )
        )
        
        if pillar_id:
            task_query = task_query.filter(Task.pillar_id == pillar_id)
        
        tasks = task_query.all()
        
        # Get goals for this month
        goal_query = self.db.query(Goal).filter(
            and_(
                Goal.is_active == True,
                Goal.goal_time_period.in_(["week", "month"])
            )
        )
        
        if pillar_id:
            goal_query = goal_query.filter(Goal.pillar_id == pillar_id)
        
        goals = goal_query.all()
        
        # Create day-by-day breakdown
        days = []
        current_date = first_day
        
        # Group data by date
        entries_by_date = {}
        for entry in time_entries:
            entry_date = entry.entry_date.date()
            if entry_date not in entries_by_date:
                entries_by_date[entry_date] = []
            entries_by_date[entry_date].append(entry)
        
        tasks_by_date = {}
        for task in tasks:
            if task.due_date:
                task_date = task.due_date.date()
                if task_date not in tasks_by_date:
                    tasks_by_date[task_date] = []
                tasks_by_date[task_date].append(task)
        
        while current_date <= last_day:
            day_entries = entries_by_date.get(current_date, [])
            day_tasks = tasks_by_date.get(current_date, [])
            
            day_minutes = sum(e.duration_minutes for e in day_entries)
            
            days.append({
                "date": current_date.isoformat(),
                "day": current_date.day,
                "day_of_week": current_date.strftime("%A"),
                "is_today": current_date == date.today(),
                "is_weekend": current_date.weekday() >= 5,
                "time_entries_count": len(day_entries),
                "tasks_count": len(day_tasks),
                "total_minutes": day_minutes,
                "total_hours": round(day_minutes / 60, 2),
                "has_events": len(day_entries) > 0 or len(day_tasks) > 0
            })
            
            current_date += timedelta(days=1)
        
        # Monthly summary
        total_minutes = sum(e.duration_minutes for e in time_entries)
        
        # Goals summary
        goals_summary = []
        for goal in goals:
            goals_summary.append({
                "id": goal.id,
                "name": goal.name,
                "time_period": goal.goal_time_period,
                "progress": round((goal.spent_hours / goal.allocated_hours * 100) if goal.allocated_hours > 0 else 0, 2),
                "is_completed": goal.is_completed
            })
        
        return {
            "year": year,
            "month": month,
            "month_name": first_day.strftime("%B"),
            "first_day": first_day.isoformat(),
            "last_day": last_day.isoformat(),
            "days": days,
            "goals": goals_summary,
            "summary": {
                "total_time_entries": len(time_entries),
                "total_time_minutes": total_minutes,
                "total_time_hours": round(total_minutes / 60, 2),
                "total_tasks": len(tasks),
                "completed_tasks": sum(1 for t in tasks if t.is_completed),
                "active_days": len([d for d in days if d["has_events"]]),
                "active_goals": len(goals),
                "completed_goals": sum(1 for g in goals if g.is_completed)
            }
        }
    
    def get_upcoming_events(
        self,
        days_ahead: int = 7,
        pillar_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get upcoming events (tasks and goals) for next N days
        """
        today = date.today()
        end_date = today + timedelta(days=days_ahead)
        
        # Get upcoming tasks
        task_query = self.db.query(Task).filter(
            and_(
                Task.is_active == True,
                Task.is_completed == False,
                or_(
                    and_(
                        Task.due_date.isnot(None),
                        func.date(Task.due_date) >= today,
                        func.date(Task.due_date) <= end_date
                    ),
                    Task.follow_up_frequency.in_(["today", "weekly"])
                )
            )
        ).order_by(Task.due_date)
        
        if pillar_id:
            task_query = task_query.filter(Task.pillar_id == pillar_id)
        
        tasks = task_query.all()
        
        # Get active goals ending soon
        goal_query = self.db.query(Goal).filter(
            and_(
                Goal.is_active == True,
                Goal.is_completed == False,
                or_(
                    and_(
                        Goal.end_date.isnot(None),
                        func.date(Goal.end_date) >= today,
                        func.date(Goal.end_date) <= end_date
                    ),
                    Goal.goal_time_period.in_(["week", "month"])
                )
            )
        ).order_by(Goal.end_date)
        
        if pillar_id:
            goal_query = goal_query.filter(Goal.pillar_id == pillar_id)
        
        goals = goal_query.all()
        
        # Format events
        upcoming = []
        
        for task in tasks:
            days_until = (task.due_date.date() - today).days if task.due_date else None
            
            upcoming.append({
                "type": "task",
                "id": task.id,
                "title": task.name,
                "due_date": task.due_date.isoformat() if task.due_date else None,
                "days_until": days_until,
                "frequency": task.follow_up_frequency,
                "pillar": {
                    "id": task.pillar_id,
                    "name": task.pillar.name if task.pillar else None,
                    "icon": task.pillar.icon if task.pillar else None
                },
                "category": task.category.name if task.category else None,
                "urgency": "overdue" if days_until and days_until < 0 else "today" if days_until == 0 else "upcoming"
            })
        
        for goal in goals:
            days_until = (goal.end_date.date() - today).days if goal.end_date else None
            
            upcoming.append({
                "type": "goal",
                "id": goal.id,
                "title": goal.name,
                "end_date": goal.end_date.isoformat() if goal.end_date else None,
                "days_until": days_until,
                "time_period": goal.goal_time_period,
                "progress": round((goal.spent_hours / goal.allocated_hours * 100) if goal.allocated_hours > 0 else 0, 2),
                "pillar": {
                    "id": goal.pillar_id,
                    "name": goal.pillar.name if goal.pillar else None,
                    "icon": goal.pillar.icon if goal.pillar else None
                }
            })
        
        # Sort by days until
        upcoming.sort(key=lambda x: (x.get("days_until") or 999, x["type"]))
        
        return {
            "start_date": today.isoformat(),
            "end_date": end_date.isoformat(),
            "days_ahead": days_ahead,
            "upcoming_events": upcoming,
            "summary": {
                "total_tasks": len([e for e in upcoming if e["type"] == "task"]),
                "total_goals": len([e for e in upcoming if e["type"] == "goal"]),
                "overdue_tasks": len([e for e in upcoming if e["type"] == "task" and e.get("urgency") == "overdue"]),
                "today_tasks": len([e for e in upcoming if e["type"] == "task" and e.get("urgency") == "today"])
            }
        }
