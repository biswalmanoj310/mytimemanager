"""
Tests for Analytics API
Comprehensive tests for visualization dashboard endpoints
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, date, timedelta

from app.main import app
from app.database.config import Base, get_db
from app.models.models import Pillar, Category, Task, Goal, TimeEntry


# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_analytics.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)


def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(scope="function")
def setup_test_data():
    """Set up comprehensive test data"""
    db = TestingSessionLocal()
    
    # Clear existing data
    db.query(TimeEntry).delete()
    db.query(Task).delete()
    db.query(Goal).delete()
    db.query(Category).delete()
    db.query(Pillar).delete()
    
    # Create pillars
    pillar1 = Pillar(name="Hard Work", allocated_hours=8.0, icon="💼", color_code="#FF5733")
    pillar2 = Pillar(name="Calmness", allocated_hours=8.0, icon="🧘", color_code="#33FF57")
    pillar3 = Pillar(name="Family", allocated_hours=8.0, icon="👨‍👩‍👦", color_code="#3357FF")
    db.add_all([pillar1, pillar2, pillar3])
    db.commit()
    db.refresh(pillar1)
    db.refresh(pillar2)
    db.refresh(pillar3)
    
    # Create categories
    cat1 = Category(name="Professional Dev", pillar_id=pillar1.id, allocated_hours=4.0)
    cat2 = Category(name="Meditation", pillar_id=pillar2.id, allocated_hours=2.0)
    cat3 = Category(name="Quality Time", pillar_id=pillar3.id, allocated_hours=3.0)
    db.add_all([cat1, cat2, cat3])
    db.commit()
    db.refresh(cat1)
    db.refresh(cat2)
    db.refresh(cat3)
    
    # Create tasks
    task1 = Task(
        name="Study FastAPI", pillar_id=pillar1.id, category_id=cat1.id,
        allocated_minutes=120, spent_minutes=60, follow_up_frequency="weekly",
        is_completed=False
    )
    task2 = Task(
        name="Morning Meditation", pillar_id=pillar2.id, category_id=cat2.id,
        allocated_minutes=30, spent_minutes=30, follow_up_frequency="today",
        is_completed=True, completed_at=datetime.now()
    )
    task3 = Task(
        name="Family Dinner", pillar_id=pillar3.id, category_id=cat3.id,
        allocated_minutes=60, spent_minutes=0, follow_up_frequency="today",
        is_completed=False
    )
    db.add_all([task1, task2, task3])
    db.commit()
    db.refresh(task1)
    db.refresh(task2)
    db.refresh(task3)
    
    # Create goals
    goal1 = Goal(
        name="Master FastAPI", pillar_id=pillar1.id, category_id=cat1.id,
        goal_time_period="month", allocated_hours=20.0, spent_hours=10.0,
        is_completed=False
    )
    goal2 = Goal(
        name="Daily Meditation Habit", pillar_id=pillar2.id, category_id=cat2.id,
        goal_time_period="week", allocated_hours=3.5, spent_hours=3.5,
        is_completed=True, completed_at=datetime.now()
    )
    db.add_all([goal1, goal2])
    db.commit()
    
    # Create time entries over several days
    today = date.today()
    
    for i in range(7):
        entry_date = today - timedelta(days=i)
        start_time = datetime.combine(entry_date, datetime.min.time().replace(hour=9))
        end_time = start_time + timedelta(minutes=60)
        
        entry = TimeEntry(
            task_id=task1.id,
            entry_date=start_time,
            start_time=start_time,
            end_time=end_time,
            duration_minutes=60
        )
        db.add(entry)
    
    # Add meditation entries
    for i in range(5):
        entry_date = today - timedelta(days=i)
        start_time = datetime.combine(entry_date, datetime.min.time().replace(hour=6))
        end_time = start_time + timedelta(minutes=30)
        
        entry = TimeEntry(
            task_id=task2.id,
            entry_date=start_time,
            start_time=start_time,
            end_time=end_time,
            duration_minutes=30
        )
        db.add(entry)
    
    db.commit()
    
    # Store IDs
    test_data = {
        "pillar1_id": pillar1.id,
        "pillar2_id": pillar2.id,
        "pillar3_id": pillar3.id,
        "cat1_id": cat1.id,
        "task1_id": task1.id,
        "task2_id": task2.id
    }
    
    db.close()
    
    yield test_data


def test_pillar_distribution(setup_test_data):
    """Test getting pillar time distribution"""
    response = client.get("/api/analytics/pillar-distribution")
    assert response.status_code == 200
    
    data = response.json()
    assert "pillars" in data
    assert "total_allocated" in data
    assert "total_spent" in data
    assert "overall_utilization" in data
    
    # Should have 3 pillars
    assert len(data["pillars"]) == 3
    
    # Check first pillar structure
    pillar = data["pillars"][0]
    assert "pillar_id" in pillar
    assert "pillar_name" in pillar
    assert "allocated_hours" in pillar
    assert "spent_hours" in pillar
    assert "utilization_percentage" in pillar
    assert "remaining_hours" in pillar


def test_pillar_distribution_with_date_range(setup_test_data):
    """Test pillar distribution with date filtering"""
    today = date.today()
    start_date = today - timedelta(days=3)
    
    response = client.get(
        f"/api/analytics/pillar-distribution?start_date={start_date.isoformat()}&end_date={today.isoformat()}"
    )
    assert response.status_code == 200
    
    data = response.json()
    assert "pillars" in data
    # Should have less time than without filtering
    assert data["total_spent"] > 0


def test_category_breakdown(setup_test_data):
    """Test getting category breakdown"""
    response = client.get("/api/analytics/category-breakdown")
    assert response.status_code == 200
    
    data = response.json()
    assert "categories" in data
    assert "total_categories" in data
    
    # Should have 3 categories
    assert len(data["categories"]) == 3
    
    # Check category structure
    category = data["categories"][0]
    assert "category_id" in category
    assert "category_name" in category
    assert "pillar_name" in category
    assert "allocated_hours" in category
    assert "spent_hours" in category
    assert "utilization_percentage" in category


def test_category_breakdown_by_pillar(setup_test_data):
    """Test filtering category breakdown by pillar"""
    test_data = setup_test_data
    
    response = client.get(f"/api/analytics/category-breakdown?pillar_id={test_data['pillar1_id']}")
    assert response.status_code == 200
    
    data = response.json()
    # Should only have categories from pillar 1
    assert len(data["categories"]) >= 1
    
    for category in data["categories"]:
        assert category["pillar_name"] == "Hard Work"


def test_time_trend_daily(setup_test_data):
    """Test getting daily time trend"""
    response = client.get("/api/analytics/time-trend?period=day&last_n=7")
    assert response.status_code == 200
    
    data = response.json()
    assert data["period"] == "day"
    assert "start_date" in data
    assert "end_date" in data
    assert "data_points" in data
    
    # Should have 7 data points
    assert len(data["data_points"]) == 7
    
    # Check data point structure
    point = data["data_points"][0]
    assert "date" in point
    assert "hours" in point
    assert "minutes" in point


def test_time_trend_weekly(setup_test_data):
    """Test getting weekly time trend"""
    response = client.get("/api/analytics/time-trend?period=week&last_n=4")
    assert response.status_code == 200
    
    data = response.json()
    assert data["period"] == "week"
    assert len(data["data_points"]) == 4


def test_time_trend_monthly(setup_test_data):
    """Test getting monthly time trend"""
    response = client.get("/api/analytics/time-trend?period=month&last_n=3")
    assert response.status_code == 200
    
    data = response.json()
    assert data["period"] == "month"


def test_time_trend_with_pillar_filter(setup_test_data):
    """Test time trend filtered by pillar"""
    test_data = setup_test_data
    
    response = client.get(
        f"/api/analytics/time-trend?period=day&last_n=7&pillar_id={test_data['pillar1_id']}"
    )
    assert response.status_code == 200
    
    data = response.json()
    assert "data_points" in data


def test_goal_progress(setup_test_data):
    """Test getting goal progress trends"""
    response = client.get("/api/analytics/goal-progress")
    assert response.status_code == 200
    
    data = response.json()
    assert "progress_by_period" in data
    assert "overall" in data
    
    # Should have data for all time periods
    assert len(data["progress_by_period"]) == 4  # week, month, quarter, year
    
    # Check period structure
    period_data = data["progress_by_period"][0]
    assert "time_period" in period_data
    assert "completed" in period_data
    assert "in_progress" in period_data
    assert "not_started" in period_data
    assert "completion_rate" in period_data


def test_goal_progress_filtered(setup_test_data):
    """Test goal progress filtered by time period"""
    response = client.get("/api/analytics/goal-progress?time_period=week")
    assert response.status_code == 200
    
    data = response.json()
    assert "progress_by_period" in data


def test_task_completion(setup_test_data):
    """Test getting task completion rates"""
    response = client.get("/api/analytics/task-completion")
    assert response.status_code == 200
    
    data = response.json()
    assert "total_tasks" in data
    assert "completed_tasks" in data
    assert "active_tasks" in data
    assert "completion_rate" in data
    assert "by_frequency" in data
    
    # Check frequency breakdown
    assert "today" in data["by_frequency"]
    assert "weekly" in data["by_frequency"]
    
    # Check frequency structure
    freq_data = data["by_frequency"]["today"]
    assert "total" in freq_data
    assert "completed" in freq_data
    assert "completion_rate" in freq_data


def test_task_completion_by_pillar(setup_test_data):
    """Test task completion filtered by pillar"""
    test_data = setup_test_data
    
    response = client.get(f"/api/analytics/task-completion?pillar_id={test_data['pillar1_id']}")
    assert response.status_code == 200
    
    data = response.json()
    assert "completion_rate" in data


def test_heatmap(setup_test_data):
    """Test getting heatmap data"""
    current_year = date.today().year
    
    response = client.get(f"/api/analytics/heatmap?year={current_year}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["year"] == current_year
    assert "start_date" in data
    assert "end_date" in data
    assert "heatmap_data" in data
    assert "max_daily_hours" in data
    
    # Should have 365 or 366 days
    assert len(data["heatmap_data"]) >= 365
    
    # Check heatmap point structure
    point = data["heatmap_data"][0]
    assert "date" in point
    assert "day_of_week" in point
    assert "week_number" in point
    assert "hours" in point
    assert "minutes" in point
    assert "intensity" in point
    assert 0 <= point["intensity"] <= 4


def test_heatmap_with_pillar_filter(setup_test_data):
    """Test heatmap filtered by pillar"""
    test_data = setup_test_data
    current_year = date.today().year
    
    response = client.get(
        f"/api/analytics/heatmap?year={current_year}&pillar_id={test_data['pillar1_id']}"
    )
    assert response.status_code == 200
    
    data = response.json()
    assert "heatmap_data" in data


def test_comparative_analysis(setup_test_data):
    """Test planned vs actual comparison"""
    response = client.get("/api/analytics/comparative-analysis")
    assert response.status_code == 200
    
    data = response.json()
    assert "start_date" in data
    assert "end_date" in data
    assert "days_count" in data
    assert "comparison" in data
    
    # Should have 3 pillars
    assert len(data["comparison"]) == 3
    
    # Check comparison structure
    comparison = data["comparison"][0]
    assert "pillar_id" in comparison
    assert "pillar_name" in comparison
    assert "planned_hours" in comparison
    assert "actual_hours" in comparison
    assert "variance_hours" in comparison
    assert "variance_percentage" in comparison
    assert "status" in comparison
    assert comparison["status"] in ["over", "under", "on_track"]


def test_comparative_analysis_with_dates(setup_test_data):
    """Test comparative analysis with date range"""
    today = date.today()
    start_date = today - timedelta(days=7)
    
    response = client.get(
        f"/api/analytics/comparative-analysis?start_date={start_date.isoformat()}&end_date={today.isoformat()}"
    )
    assert response.status_code == 200
    
    data = response.json()
    assert data["days_count"] == 8  # inclusive


def test_productivity_metrics(setup_test_data):
    """Test getting productivity metrics"""
    response = client.get("/api/analytics/productivity-metrics")
    assert response.status_code == 200
    
    data = response.json()
    assert "period" in data
    assert "time_tracking" in data
    assert "completions" in data
    assert "highlights" in data
    
    # Check period structure
    period = data["period"]
    assert "start_date" in period
    assert "end_date" in period
    assert "days_count" in period
    
    # Check time tracking
    time_tracking = data["time_tracking"]
    assert "total_hours" in time_tracking
    assert "total_minutes" in time_tracking
    assert "total_entries" in time_tracking
    assert "active_days" in time_tracking
    assert "avg_daily_hours" in time_tracking
    
    # Check completions
    completions = data["completions"]
    assert "tasks_completed" in completions
    assert "goals_completed" in completions
    
    # Check highlights
    highlights = data["highlights"]
    assert "most_productive_day" in highlights
    assert "most_productive_day_hours" in highlights


def test_productivity_metrics_custom_range(setup_test_data):
    """Test productivity metrics with custom date range"""
    today = date.today()
    start_date = today - timedelta(days=14)
    
    response = client.get(
        f"/api/analytics/productivity-metrics?start_date={start_date.isoformat()}&end_date={today.isoformat()}"
    )
    assert response.status_code == 200
    
    data = response.json()
    assert data["period"]["days_count"] == 15


def test_analytics_with_no_data():
    """Test analytics endpoints with empty database"""
    db = TestingSessionLocal()
    db.query(TimeEntry).delete()
    db.query(Task).delete()
    db.query(Goal).delete()
    db.query(Category).delete()
    db.query(Pillar).delete()
    db.commit()
    db.close()
    
    response = client.get("/api/analytics/pillar-distribution")
    assert response.status_code == 200
    
    data = response.json()
    assert data["pillars"] == []
    assert data["total_allocated"] == 0
    assert data["total_spent"] == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
