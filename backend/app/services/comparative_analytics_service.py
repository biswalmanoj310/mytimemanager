"""
Comparative Analytics Service
Advanced analytics for comparing planned vs actual, goal progress trends, and pillar balance
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, Integer
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict
import calendar

from app.models.models import Pillar, Task, Goal, TimeEntry, Category, SubCategory


class ComparativeAnalyticsService:
    """Service for comparative analytics and advanced insights"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_planned_vs_actual_time(
        self,
        start_date: date,
        end_date: date,
        pillar_id: Optional[int] = None,
        period: str = "day"
    ) -> Dict[str, Any]:
        """
        Compare planned (allocated) time vs actual (spent) time
        
        Args:
            start_date: Start date for analysis
            end_date: End date for analysis
            pillar_id: Optional pillar filter
            period: Aggregation period (day, week, month)
        
        Returns:
            Dictionary with planned vs actual comparison
        """
        # Build query filters
        filters = [
            TimeEntry.entry_date >= start_date,
            TimeEntry.entry_date <= end_date
        ]
        
        if pillar_id:
            filters.append(Task.pillar_id == pillar_id)
        
        # Get actual time spent (from time entries)
        actual_time = self.db.query(
            func.date(TimeEntry.entry_date).label('date'),
            Task.pillar_id,
            func.sum(TimeEntry.duration_minutes).label('actual_minutes')
        ).join(Task).filter(*filters).group_by(
            func.date(TimeEntry.entry_date),
            Task.pillar_id
        ).all()
        
        # Get planned time (from tasks)
        task_filters = [
            Task.created_at >= start_date,
            Task.created_at <= end_date
        ]
        if pillar_id:
            task_filters.append(Task.pillar_id == pillar_id)
        
        planned_time = self.db.query(
            Task.pillar_id,
            func.sum(Task.allocated_minutes).label('planned_minutes')
        ).filter(*task_filters).group_by(Task.pillar_id).all()
        
        # Get pillar info
        pillars = {p.id: p for p in self.db.query(Pillar).all()}
        
        # Organize data by period
        actual_by_period = defaultdict(lambda: defaultdict(int))
        for entry in actual_time:
            period_key = self._get_period_key(entry.date, period)
            actual_by_period[period_key][entry.pillar_id] += entry.actual_minutes
        
        # Calculate planned by pillar
        planned_by_pillar = {p.pillar_id: p.planned_minutes for p in planned_time}
        
        # Build comparison data
        periods = []
        current = start_date
        while current <= end_date:
            period_key = self._get_period_key(current, period)
            
            if period_key not in [p['period'] for p in periods]:
                period_data = {
                    'period': period_key,
                    'start_date': current.isoformat(),
                    'pillars': []
                }
                
                for pid, pillar in pillars.items():
                    if pillar_id and pid != pillar_id:
                        continue
                    
                    actual_mins = actual_by_period.get(period_key, {}).get(pid, 0)
                    planned_mins = planned_by_pillar.get(pid, 0)
                    
                    period_data['pillars'].append({
                        'pillar_id': pid,
                        'pillar_name': pillar.name,
                        'pillar_icon': pillar.icon,
                        'pillar_color': pillar.color_code,
                        'planned_hours': round(planned_mins / 60, 2),
                        'actual_hours': round(actual_mins / 60, 2),
                        'variance_hours': round((actual_mins - planned_mins) / 60, 2),
                        'variance_percentage': round(
                            ((actual_mins - planned_mins) / planned_mins * 100) if planned_mins > 0 else 0,
                            1
                        ),
                        'efficiency': round((actual_mins / planned_mins * 100) if planned_mins > 0 else 0, 1)
                    })
                
                periods.append(period_data)
            
            # Move to next period
            if period == "day":
                current += timedelta(days=1)
            elif period == "week":
                current += timedelta(days=7)
            else:  # month
                if current.month == 12:
                    current = date(current.year + 1, 1, 1)
                else:
                    current = date(current.year, current.month + 1, 1)
        
        # Calculate overall summary
        total_planned = sum(planned_by_pillar.values())
        total_actual = sum(sum(p.values()) for p in actual_by_period.values())
        
        return {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'period': period,
            'periods': periods,
            'summary': {
                'total_planned_hours': round(total_planned / 60, 2),
                'total_actual_hours': round(total_actual / 60, 2),
                'total_variance_hours': round((total_actual - total_planned) / 60, 2),
                'overall_efficiency': round((total_actual / total_planned * 100) if total_planned > 0 else 0, 1)
            }
        }
    
    def get_goal_progress_trends(
        self,
        time_period: str = "month",
        pillar_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Analyze goal progress over time
        
        Args:
            time_period: Time period to analyze (week, month, quarter, year)
            pillar_id: Optional pillar filter
        
        Returns:
            Dictionary with goal progress trends
        """
        # Build query filters
        filters = [Goal.is_active == True]
        if pillar_id:
            filters.append(Goal.pillar_id == pillar_id)
        
        # Get all goals
        goals = self.db.query(Goal).filter(*filters).all()
        
        # Get pillars
        pillars = {p.id: p for p in self.db.query(Pillar).all()}
        
        # Analyze by time period
        trends = []
        
        for goal in goals:
            if not goal.start_date or not goal.end_date:
                continue
            
            # Calculate progress percentage
            progress_pct = round((goal.spent_hours / goal.allocated_hours * 100) if goal.allocated_hours > 0 else 0, 1)
            
            # Calculate expected progress based on time elapsed
            total_days = (goal.end_date.date() - goal.start_date.date()).days
            elapsed_days = (datetime.now().date() - goal.start_date.date()).days
            expected_progress = round((elapsed_days / total_days * 100) if total_days > 0 else 0, 1)
            
            # Calculate status
            if goal.is_completed:
                status = "completed"
            elif progress_pct >= expected_progress:
                status = "on_track"
            elif progress_pct >= expected_progress * 0.8:
                status = "at_risk"
            else:
                status = "behind"
            
            pillar = pillars.get(goal.pillar_id)
            
            trends.append({
                'goal_id': goal.id,
                'goal_name': goal.name,
                'pillar': {
                    'id': pillar.id,
                    'name': pillar.name,
                    'icon': pillar.icon,
                    'color': pillar.color_code
                } if pillar else None,
                'time_period': goal.goal_time_period,
                'start_date': goal.start_date.date().isoformat() if goal.start_date else None,
                'end_date': goal.end_date.date().isoformat() if goal.end_date else None,
                'allocated_hours': goal.allocated_hours,
                'spent_hours': goal.spent_hours,
                'progress_percentage': progress_pct,
                'expected_progress': expected_progress,
                'variance': round(progress_pct - expected_progress, 1),
                'status': status,
                'days_remaining': max((goal.end_date.date() - datetime.now().date()).days, 0) if goal.end_date else 0,
                'is_completed': goal.is_completed
            })
        
        # Sort by variance (most behind first)
        trends.sort(key=lambda x: x['variance'])
        
        # Calculate summary statistics
        total_goals = len(trends)
        completed = sum(1 for t in trends if t['is_completed'])
        on_track = sum(1 for t in trends if t['status'] == 'on_track' and not t['is_completed'])
        at_risk = sum(1 for t in trends if t['status'] == 'at_risk')
        behind = sum(1 for t in trends if t['status'] == 'behind')
        
        avg_progress = round(sum(t['progress_percentage'] for t in trends) / total_goals, 1) if total_goals > 0 else 0
        avg_variance = round(sum(t['variance'] for t in trends) / total_goals, 1) if total_goals > 0 else 0
        
        return {
            'time_period': time_period,
            'pillar_id': pillar_id,
            'goals': trends,
            'summary': {
                'total_goals': total_goals,
                'completed': completed,
                'on_track': on_track,
                'at_risk': at_risk,
                'behind': behind,
                'completion_rate': round((completed / total_goals * 100) if total_goals > 0 else 0, 1),
                'average_progress': avg_progress,
                'average_variance': avg_variance
            }
        }
    
    def get_pillar_balance_analysis(
        self,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """
        Analyze balance across the three pillars
        
        Args:
            start_date: Start date for analysis
            end_date: End date for analysis
        
        Returns:
            Dictionary with pillar balance analysis
        """
        # Get all pillars
        pillars = self.db.query(Pillar).all()
        
        # Get time spent per pillar
        time_spent = self.db.query(
            Task.pillar_id,
            func.sum(TimeEntry.duration_minutes).label('total_minutes')
        ).join(TimeEntry).filter(
            TimeEntry.entry_date >= start_date,
            TimeEntry.entry_date <= end_date
        ).group_by(Task.pillar_id).all()
        
        time_by_pillar = {t.pillar_id: t.total_minutes for t in time_spent}
        
        # Get goal progress per pillar
        goal_progress = self.db.query(
            Goal.pillar_id,
            func.count(Goal.id).label('total_goals'),
            func.sum(func.cast(Goal.is_completed, Integer)).label('completed_goals'),
            func.sum(Goal.allocated_hours).label('allocated_hours'),
            func.sum(Goal.spent_hours).label('spent_hours')
        ).filter(
            Goal.start_date >= start_date,
            Goal.end_date <= end_date
        ).group_by(Goal.pillar_id).all()
        
        goals_by_pillar = {
            g.pillar_id: {
                'total': g.total_goals,
                'completed': g.completed_goals or 0,
                'allocated_hours': g.allocated_hours or 0,
                'spent_hours': g.spent_hours or 0
            }
            for g in goal_progress
        }
        
        # Get task completion per pillar
        task_completion = self.db.query(
            Task.pillar_id,
            func.count(Task.id).label('total_tasks'),
            func.sum(func.cast(Task.is_completed, Integer)).label('completed_tasks')
        ).filter(
            Task.created_at >= start_date,
            Task.created_at <= end_date
        ).group_by(Task.pillar_id).all()
        
        tasks_by_pillar = {
            t.pillar_id: {
                'total': t.total_tasks,
                'completed': t.completed_tasks or 0
            }
            for t in task_completion
        }
        
        # Calculate balance metrics
        total_time = sum(time_by_pillar.values())
        ideal_time_per_pillar = total_time / 3 if total_time > 0 else 0
        
        pillar_data = []
        for pillar in pillars:
            time_mins = time_by_pillar.get(pillar.id, 0)
            time_hours = time_mins / 60
            
            goals = goals_by_pillar.get(pillar.id, {'total': 0, 'completed': 0, 'allocated_hours': 0, 'spent_hours': 0})
            tasks = tasks_by_pillar.get(pillar.id, {'total': 0, 'completed': 0})
            
            time_percentage = round((time_mins / total_time * 100) if total_time > 0 else 0, 1)
            ideal_percentage = 33.3
            balance_variance = round(time_percentage - ideal_percentage, 1)
            
            pillar_data.append({
                'pillar_id': pillar.id,
                'pillar_name': pillar.name,
                'pillar_icon': pillar.icon,
                'pillar_color': pillar.color_code,
                'allocated_hours': pillar.allocated_hours,
                'actual_hours': round(time_hours, 2),
                'time_percentage': time_percentage,
                'ideal_percentage': ideal_percentage,
                'balance_variance': balance_variance,
                'balance_status': self._get_balance_status(balance_variance),
                'goals': {
                    'total': goals['total'],
                    'completed': goals['completed'],
                    'completion_rate': round((goals['completed'] / goals['total'] * 100) if goals['total'] > 0 else 0, 1),
                    'allocated_hours': goals['allocated_hours'],
                    'spent_hours': goals['spent_hours']
                },
                'tasks': {
                    'total': tasks['total'],
                    'completed': tasks['completed'],
                    'completion_rate': round((tasks['completed'] / tasks['total'] * 100) if tasks['total'] > 0 else 0, 1)
                }
            })
        
        # Calculate balance score (100 = perfect balance, lower = more imbalanced)
        variance_sum = sum(abs(p['balance_variance']) for p in pillar_data)
        balance_score = max(100 - (variance_sum / 3), 0)
        
        # Determine most and least invested pillars
        pillar_data.sort(key=lambda x: x['actual_hours'], reverse=True)
        
        return {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'pillars': pillar_data,
            'balance_metrics': {
                'total_hours': round(total_time / 60, 2),
                'ideal_hours_per_pillar': round(ideal_time_per_pillar / 60, 2),
                'balance_score': round(balance_score, 1),
                'balance_status': self._get_overall_balance_status(balance_score),
                'most_invested': pillar_data[0]['pillar_name'] if pillar_data else None,
                'least_invested': pillar_data[-1]['pillar_name'] if pillar_data else None,
                'recommendations': self._get_balance_recommendations(pillar_data)
            }
        }
    
    def get_productivity_insights(
        self,
        start_date: date,
        end_date: date,
        pillar_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate productivity insights and recommendations
        
        Args:
            start_date: Start date for analysis
            end_date: End date for analysis
            pillar_id: Optional pillar filter
        
        Returns:
            Dictionary with productivity insights
        """
        filters = [
            TimeEntry.entry_date >= start_date,
            TimeEntry.entry_date <= end_date
        ]
        if pillar_id:
            filters.append(Task.pillar_id == pillar_id)
        
        # Get daily productivity patterns
        daily_data = self.db.query(
            func.extract('dow', TimeEntry.entry_date).label('day_of_week'),
            func.count(TimeEntry.id).label('entry_count'),
            func.sum(TimeEntry.duration_minutes).label('total_minutes'),
            func.avg(TimeEntry.duration_minutes).label('avg_minutes')
        ).join(Task).filter(*filters).group_by(
            func.extract('dow', TimeEntry.entry_date)
        ).all()
        
        # Get hourly productivity patterns
        hourly_data = self.db.query(
            func.extract('hour', TimeEntry.start_time).label('hour'),
            func.count(TimeEntry.id).label('entry_count'),
            func.sum(TimeEntry.duration_minutes).label('total_minutes')
        ).join(Task).filter(*filters).group_by(
            func.extract('hour', TimeEntry.start_time)
        ).all()
        
        # Build insights
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        
        daily_patterns = [
            {
                'day_of_week': int(d.day_of_week),
                'day_name': day_names[int(d.day_of_week)],
                'entry_count': d.entry_count,
                'total_hours': round(d.total_minutes / 60, 2),
                'average_session_minutes': round(d.avg_minutes, 1)
            }
            for d in daily_data
        ]
        
        hourly_patterns = [
            {
                'hour': int(h.hour),
                'time_label': f"{int(h.hour):02d}:00",
                'entry_count': h.entry_count,
                'total_hours': round(h.total_minutes / 60, 2)
            }
            for h in hourly_data
        ]
        
        # Find peak productivity times
        if daily_patterns:
            most_productive_day = max(daily_patterns, key=lambda x: x['total_hours'])
        else:
            most_productive_day = None
            
        if hourly_patterns:
            most_productive_hour = max(hourly_patterns, key=lambda x: x['total_hours'])
        else:
            most_productive_hour = None
        
        return {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'pillar_id': pillar_id,
            'daily_patterns': daily_patterns,
            'hourly_patterns': hourly_patterns,
            'insights': {
                'most_productive_day': most_productive_day,
                'most_productive_hour': most_productive_hour,
                'total_days_tracked': len(daily_patterns),
                'average_daily_hours': round(
                    sum(p['total_hours'] for p in daily_patterns) / len(daily_patterns), 2
                ) if daily_patterns else 0
            }
        }
    
    def _get_period_key(self, dt: date, period: str) -> str:
        """Get period key for grouping"""
        if period == "day":
            return dt.isoformat()
        elif period == "week":
            # Get Monday of the week
            monday = dt - timedelta(days=dt.weekday())
            return f"Week of {monday.isoformat()}"
        else:  # month
            return f"{dt.year}-{dt.month:02d}"
    
    def _get_balance_status(self, variance: float) -> str:
        """Determine balance status from variance"""
        if abs(variance) <= 5:
            return "balanced"
        elif abs(variance) <= 10:
            return "slightly_imbalanced"
        else:
            return "imbalanced"
    
    def _get_overall_balance_status(self, score: float) -> str:
        """Determine overall balance status from score"""
        if score >= 90:
            return "excellent"
        elif score >= 75:
            return "good"
        elif score >= 60:
            return "fair"
        else:
            return "needs_improvement"
    
    def _get_balance_recommendations(self, pillar_data: List[Dict]) -> List[str]:
        """Generate recommendations based on pillar balance"""
        recommendations = []
        
        if not pillar_data:
            return recommendations
        
        # Sort by actual hours
        sorted_pillars = sorted(pillar_data, key=lambda x: x['actual_hours'])
        
        least = sorted_pillars[0]
        most = sorted_pillars[-1]
        
        if abs(most['balance_variance']) > 10:
            recommendations.append(
                f"Consider reducing time spent on {most['pillar_name']} ({most['pillar_icon']}) "
                f"to improve balance (currently {most['balance_variance']:+.1f}% from ideal)"
            )
        
        if abs(least['balance_variance']) > 10:
            recommendations.append(
                f"Increase focus on {least['pillar_name']} ({least['pillar_icon']}) "
                f"to achieve better balance (currently {least['balance_variance']:+.1f}% from ideal)"
            )
        
        # Check for low completion rates
        for pillar in pillar_data:
            if pillar['tasks']['total'] > 0 and pillar['tasks']['completion_rate'] < 50:
                recommendations.append(
                    f"Task completion rate for {pillar['pillar_name']} is low ({pillar['tasks']['completion_rate']:.1f}%). "
                    "Consider breaking down tasks or adjusting priorities."
                )
        
        if not recommendations:
            recommendations.append("Great work! Your time is well-balanced across all three pillars.")
        
        return recommendations
