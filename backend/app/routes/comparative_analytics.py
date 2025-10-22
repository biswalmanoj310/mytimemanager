"""
Comparative Analytics Routes
RESTful API endpoints for advanced comparative analytics
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import Optional

from app.database.config import get_db
from app.services.comparative_analytics_service import ComparativeAnalyticsService

router = APIRouter(prefix="/api/comparative-analytics", tags=["comparative-analytics"])


@router.get("/planned-vs-actual")
async def get_planned_vs_actual_time(
    start_date: Optional[date] = Query(None, description="Start date for analysis"),
    end_date: Optional[date] = Query(None, description="End date for analysis"),
    pillar_id: Optional[int] = Query(None, description="Filter by pillar ID"),
    period: str = Query("day", description="Aggregation period (day, week, month)"),
    db: Session = Depends(get_db)
):
    """
    Compare planned (allocated) time vs actual (spent) time
    
    Provides detailed comparison of time allocation vs actual time spent,
    helping identify planning accuracy and time management effectiveness.
    """
    # Default to last 30 days if not specified
    if not end_date:
        end_date = datetime.now().date()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    # Validate period
    if period not in ["day", "week", "month"]:
        raise HTTPException(status_code=400, detail="Period must be 'day', 'week', or 'month'")
    
    # Validate date range
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    service = ComparativeAnalyticsService(db)
    return service.get_planned_vs_actual_time(start_date, end_date, pillar_id, period)


@router.get("/goal-progress-trends")
async def get_goal_progress_trends(
    time_period: str = Query("month", description="Time period filter (week, month, quarter, year)"),
    pillar_id: Optional[int] = Query(None, description="Filter by pillar ID"),
    db: Session = Depends(get_db)
):
    """
    Analyze goal progress over time
    
    Tracks goal completion trends, identifies at-risk goals,
    and provides insights into goal achievement patterns.
    """
    # Validate time period
    if time_period not in ["week", "month", "quarter", "year"]:
        raise HTTPException(
            status_code=400,
            detail="Time period must be 'week', 'month', 'quarter', or 'year'"
        )
    
    service = ComparativeAnalyticsService(db)
    return service.get_goal_progress_trends(time_period, pillar_id)


@router.get("/pillar-balance")
async def get_pillar_balance_analysis(
    start_date: Optional[date] = Query(None, description="Start date for analysis"),
    end_date: Optional[date] = Query(None, description="End date for analysis"),
    db: Session = Depends(get_db)
):
    """
    Analyze balance across the three pillars
    
    Evaluates whether time is being distributed equally across
    Hard Work, Calmness, and Family pillars (ideal: 8 hours each).
    Provides recommendations for improving balance.
    """
    # Default to last 30 days if not specified
    if not end_date:
        end_date = datetime.now().date()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    # Validate date range
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    service = ComparativeAnalyticsService(db)
    return service.get_pillar_balance_analysis(start_date, end_date)


@router.get("/productivity-insights")
async def get_productivity_insights(
    start_date: Optional[date] = Query(None, description="Start date for analysis"),
    end_date: Optional[date] = Query(None, description="End date for analysis"),
    pillar_id: Optional[int] = Query(None, description="Filter by pillar ID"),
    db: Session = Depends(get_db)
):
    """
    Generate productivity insights and patterns
    
    Identifies peak productivity times by day of week and hour of day,
    helping optimize work schedules and time allocation.
    """
    # Default to last 30 days if not specified
    if not end_date:
        end_date = datetime.now().date()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    # Validate date range
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    service = ComparativeAnalyticsService(db)
    return service.get_productivity_insights(start_date, end_date, pillar_id)


@router.get("/efficiency-metrics")
async def get_efficiency_metrics(
    start_date: Optional[date] = Query(None, description="Start date for analysis"),
    end_date: Optional[date] = Query(None, description="End date for analysis"),
    db: Session = Depends(get_db)
):
    """
    Calculate overall efficiency metrics
    
    Combines multiple data points to provide a comprehensive view
    of time management efficiency and effectiveness.
    """
    # Default to last 30 days if not specified
    if not end_date:
        end_date = datetime.now().date()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    # Validate date range
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    service = ComparativeAnalyticsService(db)
    
    # Get data from multiple endpoints
    planned_vs_actual = service.get_planned_vs_actual_time(start_date, end_date, None, "day")
    goal_trends = service.get_goal_progress_trends("month", None)
    pillar_balance = service.get_pillar_balance_analysis(start_date, end_date)
    productivity = service.get_productivity_insights(start_date, end_date, None)
    
    # Calculate composite efficiency score
    efficiency_score = 0
    factors = []
    
    # Factor 1: Planning accuracy (40% weight)
    if planned_vs_actual['summary']['overall_efficiency']:
        planning_score = min(planned_vs_actual['summary']['overall_efficiency'], 100)
        efficiency_score += planning_score * 0.4
        factors.append({
            'name': 'Planning Accuracy',
            'score': planning_score,
            'weight': 40,
            'description': 'How well actual time matches planned time'
        })
    
    # Factor 2: Goal completion rate (30% weight)
    if goal_trends['summary']['completion_rate']:
        goal_score = goal_trends['summary']['completion_rate']
        efficiency_score += goal_score * 0.3
        factors.append({
            'name': 'Goal Achievement',
            'score': goal_score,
            'weight': 30,
            'description': 'Percentage of goals completed on time'
        })
    
    # Factor 3: Pillar balance (30% weight)
    balance_score = pillar_balance['balance_metrics']['balance_score']
    efficiency_score += balance_score * 0.3
    factors.append({
        'name': 'Work-Life Balance',
        'score': balance_score,
        'weight': 30,
        'description': 'Balance across Hard Work, Calmness, and Family'
    })
    
    return {
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'overall_efficiency_score': round(efficiency_score, 1),
        'efficiency_rating': _get_efficiency_rating(efficiency_score),
        'factors': factors,
        'details': {
            'planned_vs_actual': planned_vs_actual['summary'],
            'goal_progress': goal_trends['summary'],
            'pillar_balance': pillar_balance['balance_metrics'],
            'productivity_patterns': productivity['insights']
        },
        'recommendations': _get_efficiency_recommendations(
            efficiency_score,
            planned_vs_actual,
            goal_trends,
            pillar_balance
        )
    }


def _get_efficiency_rating(score: float) -> str:
    """Get efficiency rating from score"""
    if score >= 90:
        return "Excellent"
    elif score >= 80:
        return "Very Good"
    elif score >= 70:
        return "Good"
    elif score >= 60:
        return "Fair"
    else:
        return "Needs Improvement"


def _get_efficiency_recommendations(
    score: float,
    planned_vs_actual: dict,
    goal_trends: dict,
    pillar_balance: dict
) -> list:
    """Generate recommendations based on efficiency metrics"""
    recommendations = []
    
    # Planning accuracy recommendations
    planning_eff = planned_vs_actual['summary']['overall_efficiency']
    if planning_eff < 80:
        recommendations.append({
            'category': 'Planning',
            'priority': 'high' if planning_eff < 60 else 'medium',
            'message': 'Review your time estimates. Actual time differs significantly from planned time.',
            'action': 'Consider tracking time more closely and adjusting estimates based on historical data.'
        })
    
    # Goal completion recommendations
    completion_rate = goal_trends['summary']['completion_rate']
    if completion_rate < 70:
        recommendations.append({
            'category': 'Goals',
            'priority': 'high' if completion_rate < 50 else 'medium',
            'message': f"Goal completion rate is {completion_rate:.1f}%. Many goals are not being achieved.",
            'action': 'Break down large goals into smaller milestones and review progress weekly.'
        })
    
    # Balance recommendations
    balance_recommendations = pillar_balance['balance_metrics'].get('recommendations', [])
    for rec in balance_recommendations[:2]:  # Take top 2 recommendations
        recommendations.append({
            'category': 'Balance',
            'priority': 'medium',
            'message': rec,
            'action': 'Adjust your schedule to allocate more balanced time across all three pillars.'
        })
    
    if not recommendations:
        recommendations.append({
            'category': 'Overall',
            'priority': 'low',
            'message': 'Great work! Your time management is highly efficient.',
            'action': 'Keep up the good work and continue monitoring your progress.'
        })
    
    return recommendations
