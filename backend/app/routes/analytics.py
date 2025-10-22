"""
Analytics API Routes
Endpoints for visualization dashboards and data analysis
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from app.database.config import get_db
from app.services.analytics_service import AnalyticsService


router = APIRouter()


def get_analytics_service(db: Session = Depends(get_db)) -> AnalyticsService:
    """Dependency to get AnalyticsService instance"""
    return AnalyticsService(db)


@router.get("/pillar-distribution")
def get_pillar_distribution(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get time distribution across pillars
    
    Perfect for: Pie charts, Donut charts
    
    - **start_date**: Optional start date for filtering
    - **end_date**: Optional end date for filtering
    
    Returns allocated vs spent hours per pillar with utilization percentages.
    """
    return service.get_pillar_time_distribution(start_date, end_date)


@router.get("/category-breakdown")
def get_category_breakdown(
    pillar_id: Optional[int] = Query(None, gt=0),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get time breakdown by category
    
    Perfect for: Bar charts, Horizontal bar charts
    
    - **pillar_id**: Optional filter by pillar
    - **start_date**: Optional start date for filtering
    - **end_date**: Optional end date for filtering
    
    Returns categories sorted by time spent with utilization data.
    """
    return service.get_category_breakdown(pillar_id, start_date, end_date)


@router.get("/time-trend")
def get_time_trend(
    period: str = Query("day", regex="^(day|week|month)$"),
    last_n: int = Query(30, ge=1, le=365),
    pillar_id: Optional[int] = Query(None, gt=0),
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get time tracking trends over periods
    
    Perfect for: Line charts, Area charts
    
    - **period**: Time period granularity (day, week, month)
    - **last_n**: Number of periods to include (e.g., last 30 days)
    - **pillar_id**: Optional filter by pillar
    
    Returns time spent data points over the specified periods.
    """
    return service.get_time_trend(period, last_n, pillar_id)


@router.get("/goal-progress")
def get_goal_progress(
    time_period: Optional[str] = Query(None, regex="^(week|month|quarter|year)$"),
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get goal progress trends
    
    Perfect for: Stacked area charts, Stacked bar charts
    
    - **time_period**: Optional filter by goal time period
    
    Returns goal counts by status (completed, in_progress, not_started) and time period.
    """
    return service.get_goal_progress_over_time(time_period)


@router.get("/task-completion")
def get_task_completion(
    pillar_id: Optional[int] = Query(None, gt=0),
    category_id: Optional[int] = Query(None, gt=0),
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get task completion rates
    
    Perfect for: Gauge charts, Progress bars, Radial charts
    
    - **pillar_id**: Optional filter by pillar
    - **category_id**: Optional filter by category
    
    Returns completion rates overall and by follow-up frequency.
    """
    return service.get_task_completion_rate(pillar_id, category_id)


@router.get("/heatmap")
def get_heatmap(
    year: Optional[int] = Query(None, ge=2020, le=2100),
    pillar_id: Optional[int] = Query(None, gt=0),
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get daily activity heatmap data
    
    Perfect for: Calendar heatmaps (GitHub contribution style)
    
    - **year**: Year for heatmap (defaults to current year)
    - **pillar_id**: Optional filter by pillar
    
    Returns daily time tracking intensity (0-4 scale) for entire year.
    """
    return service.get_heatmap_data(year, pillar_id)


@router.get("/comparative-analysis")
def get_comparative_analysis(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get planned vs actual time comparison
    
    Perfect for: Grouped bar charts, Comparison tables
    
    - **start_date**: Start date for analysis (defaults to 7 days ago)
    - **end_date**: End date for analysis (defaults to today)
    
    Returns planned vs actual hours per pillar with variance analysis.
    """
    return service.get_comparative_analysis(start_date, end_date)


@router.get("/productivity-metrics")
def get_productivity_metrics(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Get overall productivity metrics
    
    Perfect for: Summary cards, KPI dashboards
    
    - **start_date**: Start date for metrics (defaults to 30 days ago)
    - **end_date**: End date for metrics (defaults to today)
    
    Returns comprehensive productivity statistics including time tracking,
    completions, and highlights.
    """
    return service.get_productivity_metrics(start_date, end_date)
