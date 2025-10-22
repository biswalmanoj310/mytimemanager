"""
Analytics Service
Provides data aggregation and analysis for visualization dashboards
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, case
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from collections import defaultdict

from app.models.models import (
    Pillar, Category, SubCategory, Task, Goal, TimeEntry, 
    GoalTimePeriod, FollowUpFrequency
)


class AnalyticsService:
    """Service for analytics and visualization data"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_pillar_time_distribution(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get time distribution across pillars for pie/donut charts
        Shows allocated vs spent time per pillar
        """
        pillars = self.db.query(Pillar).all()
        
        # Build time entry query
        query = self.db.query(
            TimeEntry.task_id,
            func.sum(TimeEntry.duration_minutes).label('total_minutes')
        )
        
        if start_date:
            query = query.filter(func.date(TimeEntry.entry_date) >= start_date)
        if end_date:
            query = query.filter(func.date(TimeEntry.entry_date) <= end_date)
        
        time_by_task = query.group_by(TimeEntry.task_id).all()
        
        # Map to pillars
        task_pillar_map = {
            task.id: task.pillar_id 
            for task in self.db.query(Task).all()
        }
        
        pillar_data = []
        total_allocated = 0
        total_spent = 0
        
        for pillar in pillars:
            # Calculate spent time
            spent_minutes = sum(
                minutes for task_id, minutes in time_by_task
                if task_pillar_map.get(task_id) == pillar.id
            )
            spent_hours = spent_minutes / 60 if spent_minutes else 0
            
            allocated_hours = pillar.allocated_hours
            total_allocated += allocated_hours
            total_spent += spent_hours
            
            utilization = (spent_hours / allocated_hours * 100) if allocated_hours > 0 else 0
            
            pillar_data.append({
                "pillar_id": pillar.id,
                "pillar_name": pillar.name,
                "icon": pillar.icon,
                "color_code": pillar.color_code,
                "allocated_hours": allocated_hours,
                "spent_hours": round(spent_hours, 2),
                "utilization_percentage": round(utilization, 2),
                "remaining_hours": round(max(0, allocated_hours - spent_hours), 2)
            })
        
        return {
            "pillars": pillar_data,
            "total_allocated": round(total_allocated, 2),
            "total_spent": round(total_spent, 2),
            "overall_utilization": round((total_spent / total_allocated * 100) if total_allocated > 0 else 0, 2)
        }
    
    def get_category_breakdown(
        self,
        pillar_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get time breakdown by category for bar charts
        Optionally filter by pillar
        """
        query = self.db.query(Category)
        
        if pillar_id:
            query = query.filter(Category.pillar_id == pillar_id)
        
        categories = query.all()
        
        # Build time entry query
        time_query = self.db.query(
            TimeEntry.task_id,
            func.sum(TimeEntry.duration_minutes).label('total_minutes')
        )
        
        if start_date:
            time_query = time_query.filter(func.date(TimeEntry.entry_date) >= start_date)
        if end_date:
            time_query = time_query.filter(func.date(TimeEntry.entry_date) <= end_date)
        
        time_by_task = time_query.group_by(TimeEntry.task_id).all()
        
        # Map to categories
        task_category_map = {
            task.id: task.category_id
            for task in self.db.query(Task).all()
        }
        
        category_data = []
        
        for category in categories:
            # Calculate spent time
            spent_minutes = sum(
                minutes for task_id, minutes in time_by_task
                if task_category_map.get(task_id) == category.id
            )
            spent_hours = spent_minutes / 60 if spent_minutes else 0
            
            allocated_hours = category.allocated_hours
            utilization = (spent_hours / allocated_hours * 100) if allocated_hours > 0 else 0
            
            category_data.append({
                "category_id": category.id,
                "category_name": category.name,
                "pillar_name": category.pillar.name if category.pillar else None,
                "allocated_hours": allocated_hours,
                "spent_hours": round(spent_hours, 2),
                "utilization_percentage": round(utilization, 2),
                "remaining_hours": round(max(0, allocated_hours - spent_hours), 2)
            })
        
        # Sort by spent hours descending
        category_data.sort(key=lambda x: x['spent_hours'], reverse=True)
        
        return {
            "categories": category_data,
            "total_categories": len(category_data)
        }
    
    def get_time_trend(
        self,
        period: str = "day",  # day, week, month
        last_n: int = 30,
        pillar_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get time tracking trends for line charts
        Shows time spent over periods
        """
        # Calculate date range
        end_date = date.today()
        
        if period == "day":
            start_date = end_date - timedelta(days=last_n - 1)
            date_format = "%Y-%m-%d"
        elif period == "week":
            start_date = end_date - timedelta(weeks=last_n - 1)
            date_format = "%Y-W%W"
        else:  # month
            start_date = end_date - timedelta(days=last_n * 30)
            date_format = "%Y-%m"
        
        # Build query
        query = self.db.query(
            func.date(TimeEntry.entry_date).label('date'),
            func.sum(TimeEntry.duration_minutes).label('total_minutes')
        ).filter(
            func.date(TimeEntry.entry_date) >= start_date
        )
        
        # Filter by pillar if specified
        if pillar_id:
            query = query.join(Task).filter(Task.pillar_id == pillar_id)
        
        query = query.group_by(func.date(TimeEntry.entry_date))\
                    .order_by(func.date(TimeEntry.entry_date))
        
        results = query.all()
        
        # Create data points
        data_points = []
        current_date = start_date
        date_lookup = {str(r.date): r.total_minutes for r in results}
        
        while current_date <= end_date:
            minutes = date_lookup.get(str(current_date), 0)
            hours = minutes / 60 if minutes else 0
            
            data_points.append({
                "date": current_date.strftime(date_format),
                "hours": round(hours, 2),
                "minutes": minutes
            })
            
            if period == "day":
                current_date += timedelta(days=1)
            elif period == "week":
                current_date += timedelta(weeks=1)
            else:
                # Move to next month
                if current_date.month == 12:
                    current_date = current_date.replace(year=current_date.year + 1, month=1)
                else:
                    current_date = current_date.replace(month=current_date.month + 1)
        
        return {
            "period": period,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "data_points": data_points
        }
    
    def get_goal_progress_over_time(
        self,
        time_period: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get goal progress trends for stacked area charts
        Shows completed vs in-progress goals over time
        """
        query = self.db.query(Goal)
        
        if time_period:
            query = query.filter(Goal.goal_time_period == time_period)
        
        goals = query.all()
        
        # Group by status and time period
        status_data = {
            "completed": {"week": 0, "month": 0, "quarter": 0, "year": 0},
            "in_progress": {"week": 0, "month": 0, "quarter": 0, "year": 0},
            "not_started": {"week": 0, "month": 0, "quarter": 0, "year": 0}
        }
        
        for goal in goals:
            period = goal.goal_time_period
            
            if goal.is_completed:
                status = "completed"
            elif goal.spent_hours > 0:
                status = "in_progress"
            else:
                status = "not_started"
            
            status_data[status][period] += 1
        
        # Calculate progress percentages
        progress_by_period = []
        
        for period in ["week", "month", "quarter", "year"]:
            total = sum(status_data[status][period] for status in status_data)
            
            progress_by_period.append({
                "time_period": period,
                "completed": status_data["completed"][period],
                "in_progress": status_data["in_progress"][period],
                "not_started": status_data["not_started"][period],
                "total": total,
                "completion_rate": round(
                    (status_data["completed"][period] / total * 100) if total > 0 else 0,
                    2
                )
            })
        
        return {
            "progress_by_period": progress_by_period,
            "overall": {
                "completed": sum(status_data["completed"].values()),
                "in_progress": sum(status_data["in_progress"].values()),
                "not_started": sum(status_data["not_started"].values())
            }
        }
    
    def get_task_completion_rate(
        self,
        pillar_id: Optional[int] = None,
        category_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get task completion rates for gauge/progress charts
        """
        query = self.db.query(Task)
        
        if pillar_id:
            query = query.filter(Task.pillar_id == pillar_id)
        if category_id:
            query = query.filter(Task.category_id == category_id)
        
        tasks = query.all()
        
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.is_completed)
        active_tasks = sum(1 for t in tasks if t.is_active and not t.is_completed)
        
        # Calculate by frequency
        frequency_data = {}
        for freq in FollowUpFrequency:
            freq_tasks = [t for t in tasks if t.follow_up_frequency == freq.value]
            freq_completed = sum(1 for t in freq_tasks if t.is_completed)
            
            frequency_data[freq.value] = {
                "total": len(freq_tasks),
                "completed": freq_completed,
                "completion_rate": round(
                    (freq_completed / len(freq_tasks) * 100) if freq_tasks else 0,
                    2
                )
            }
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "active_tasks": active_tasks,
            "completion_rate": round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 2),
            "by_frequency": frequency_data
        }
    
    def get_heatmap_data(
        self,
        year: Optional[int] = None,
        pillar_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get daily activity heatmap data (like GitHub contributions)
        Shows intensity of time tracking per day
        """
        if not year:
            year = date.today().year
        
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        
        # Get all time entries for the year
        query = self.db.query(
            func.date(TimeEntry.entry_date).label('date'),
            func.sum(TimeEntry.duration_minutes).label('total_minutes')
        ).filter(
            and_(
                func.date(TimeEntry.entry_date) >= start_date,
                func.date(TimeEntry.entry_date) <= end_date
            )
        )
        
        if pillar_id:
            query = query.join(Task).filter(Task.pillar_id == pillar_id)
        
        query = query.group_by(func.date(TimeEntry.entry_date))
        
        results = query.all()
        
        # Create lookup
        date_data = {str(r.date): r.total_minutes for r in results}
        
        # Generate all days of year
        heatmap_data = []
        current_date = start_date
        max_minutes = max(date_data.values()) if date_data else 0
        
        while current_date <= end_date:
            minutes = date_data.get(str(current_date), 0)
            hours = minutes / 60 if minutes else 0
            
            # Calculate intensity (0-4 scale like GitHub)
            if minutes == 0:
                intensity = 0
            elif max_minutes > 0:
                ratio = minutes / max_minutes
                if ratio < 0.25:
                    intensity = 1
                elif ratio < 0.5:
                    intensity = 2
                elif ratio < 0.75:
                    intensity = 3
                else:
                    intensity = 4
            else:
                intensity = 0
            
            heatmap_data.append({
                "date": current_date.isoformat(),
                "day_of_week": current_date.strftime("%A"),
                "week_number": current_date.isocalendar()[1],
                "hours": round(hours, 2),
                "minutes": minutes,
                "intensity": intensity
            })
            
            current_date += timedelta(days=1)
        
        return {
            "year": year,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "heatmap_data": heatmap_data,
            "max_daily_hours": round(max_minutes / 60, 2) if max_minutes else 0
        }
    
    def get_comparative_analysis(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get comparative analysis: planned vs actual time
        """
        # Get pillars with their allocations
        pillars = self.db.query(Pillar).all()
        
        # Calculate days in range
        if not start_date:
            start_date = date.today() - timedelta(days=7)
        if not end_date:
            end_date = date.today()
        
        days_count = (end_date - start_date).days + 1
        
        # Get actual time spent
        query = self.db.query(
            Task.pillar_id,
            func.sum(TimeEntry.duration_minutes).label('total_minutes')
        ).join(TimeEntry).filter(
            and_(
                func.date(TimeEntry.entry_date) >= start_date,
                func.date(TimeEntry.entry_date) <= end_date
            )
        ).group_by(Task.pillar_id)
        
        actual_by_pillar = {r.pillar_id: r.total_minutes for r in query.all()}
        
        comparison_data = []
        
        for pillar in pillars:
            # Planned hours for the period
            planned_hours = pillar.allocated_hours * days_count
            
            # Actual hours
            actual_minutes = actual_by_pillar.get(pillar.id, 0)
            actual_hours = actual_minutes / 60
            
            # Variance
            variance = actual_hours - planned_hours
            variance_percentage = (variance / planned_hours * 100) if planned_hours > 0 else 0
            
            comparison_data.append({
                "pillar_id": pillar.id,
                "pillar_name": pillar.name,
                "icon": pillar.icon,
                "planned_hours": round(planned_hours, 2),
                "actual_hours": round(actual_hours, 2),
                "variance_hours": round(variance, 2),
                "variance_percentage": round(variance_percentage, 2),
                "status": "over" if variance > 0 else "under" if variance < 0 else "on_track"
            })
        
        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "days_count": days_count,
            "comparison": comparison_data
        }
    
    def get_productivity_metrics(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get overall productivity metrics for summary cards
        """
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()
        
        # Total time entries
        time_entries = self.db.query(TimeEntry).filter(
            and_(
                func.date(TimeEntry.entry_date) >= start_date,
                func.date(TimeEntry.entry_date) <= end_date
            )
        ).all()
        
        total_minutes = sum(e.duration_minutes for e in time_entries)
        total_hours = total_minutes / 60
        
        # Tasks completed in period
        completed_tasks = self.db.query(Task).filter(
            and_(
                Task.is_completed == True,
                Task.completed_at.isnot(None),
                func.date(Task.completed_at) >= start_date,
                func.date(Task.completed_at) <= end_date
            )
        ).count()
        
        # Goals completed in period
        completed_goals = self.db.query(Goal).filter(
            and_(
                Goal.is_completed == True,
                Goal.completed_at.isnot(None),
                func.date(Goal.completed_at) >= start_date,
                func.date(Goal.completed_at) <= end_date
            )
        ).count()
        
        # Active days (days with time entries)
        active_days = len(set(e.entry_date.date() for e in time_entries))
        
        # Average daily hours
        avg_daily_hours = total_hours / active_days if active_days > 0 else 0
        
        # Most productive day
        day_totals = defaultdict(int)
        for entry in time_entries:
            day_totals[entry.entry_date.date()] += entry.duration_minutes
        
        most_productive_day = None
        max_minutes = 0
        if day_totals:
            most_productive_day = max(day_totals, key=day_totals.get)
            max_minutes = day_totals[most_productive_day]
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days_count": (end_date - start_date).days + 1
            },
            "time_tracking": {
                "total_hours": round(total_hours, 2),
                "total_minutes": total_minutes,
                "total_entries": len(time_entries),
                "active_days": active_days,
                "avg_daily_hours": round(avg_daily_hours, 2)
            },
            "completions": {
                "tasks_completed": completed_tasks,
                "goals_completed": completed_goals
            },
            "highlights": {
                "most_productive_day": most_productive_day.isoformat() if most_productive_day else None,
                "most_productive_day_hours": round(max_minutes / 60, 2) if max_minutes else 0
            }
        }
