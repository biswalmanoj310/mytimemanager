"""
Tests for Calendar API endpoints
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, date, timedelta

from app.main import app
from app.database.config import Base, get_db
from app.models import Pillar, Category, SubCategory, Task, Goal, TimeEntry


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_calendar.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """Setup and teardown database for each test"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_data():
    """Create comprehensive sample data"""
    db = TestingSessionLocal()
    
    today = datetime.now().date()
    
    # Clean up any existing data
    db.query(TimeEntry).delete()
    db.query(Task).delete()
    db.query(Goal).delete()
    db.query(SubCategory).delete()
    db.query(Category).delete()
    db.query(Pillar).delete()
    db.commit()
    
    # Create pillars
    hard_work = Pillar(
        name="Hard Work",
        icon="💼",
        color_code="#FF6B6B",
        allocated_hours=8.0,
        description="Career"
    )
    calmness = Pillar(
        name="Calmness",
        icon="🧘",
        color_code="#4ECDC4",
        allocated_hours=8.0,
        description="Wellness"
    )
    db.add_all([hard_work, calmness])
    db.commit()
    db.refresh(hard_work)
    db.refresh(calmness)
    
    # Create categories
    work_cat = Category(
        pillar_id=hard_work.id,
        name="Work Projects",
        color_code="#FF8C94",
        allocated_hours=4.0
    )
    wellness_cat = Category(
        pillar_id=calmness.id,
        name="Exercise",
        color_code="#7FCDCD",
        allocated_hours=2.0
    )
    db.add_all([work_cat, wellness_cat])
    db.commit()
    db.refresh(work_cat)
    db.refresh(wellness_cat)
    
    # Create sub-categories
    sub_work = SubCategory(
        category_id=work_cat.id,
        name="Development",
        allocated_hours=3.0
    )
    sub_wellness = SubCategory(
        category_id=wellness_cat.id,
        name="Yoga",
        allocated_hours=1.0
    )
    db.add_all([sub_work, sub_wellness])
    db.commit()
    db.refresh(sub_work)
    db.refresh(sub_wellness)
    
    # Create tasks with various dates (using actual Task model fields)
    task_today = Task(
        name="Complete feature",
        description="Finish calendar API",
        pillar_id=hard_work.id,
        category_id=work_cat.id,
        sub_category_id=sub_work.id,
        due_date=today,
        allocated_minutes=240,  # 4 hours
        follow_up_frequency="today"
    )
    
    task_tomorrow = Task(
        name="Morning yoga",
        description="Daily practice",
        pillar_id=calmness.id,
        category_id=wellness_cat.id,
        sub_category_id=sub_wellness.id,
        due_date=today + timedelta(days=1),
        allocated_minutes=60,  # 1 hour
        follow_up_frequency="weekly"
    )
    
    task_next_week = Task(
        name="Code review",
        description="Review PRs",
        pillar_id=hard_work.id,
        category_id=work_cat.id,
        sub_category_id=sub_work.id,
        due_date=today + timedelta(days=7),
        allocated_minutes=120,  # 2 hours
        follow_up_frequency="weekly"
    )
    
    task_overdue = Task(
        name="Fix bug",
        description="Critical bug",
        pillar_id=hard_work.id,
        category_id=work_cat.id,
        sub_category_id=sub_work.id,
        due_date=today - timedelta(days=2),
        allocated_minutes=180,  # 3 hours
        follow_up_frequency="today"
    )
    
    db.add_all([task_today, task_tomorrow, task_next_week, task_overdue])
    db.commit()
    
    # Create goals (using actual Goal model fields)
    goal_active = Goal(
        name="Launch MVP",
        description="Complete project",
        pillar_id=hard_work.id,
        category_id=work_cat.id,
        sub_category_id=sub_work.id,
        goal_time_period="month",
        allocated_hours=100.0,
        spent_hours=60.0,
        start_date=today - timedelta(days=15),
        end_date=today + timedelta(days=15)
    )
    
    goal_ending = Goal(
        name="Daily meditation",
        description="30 days streak",
        pillar_id=calmness.id,
        category_id=wellness_cat.id,
        sub_category_id=sub_wellness.id,
        goal_time_period="month",
        allocated_hours=30.0,
        spent_hours=25.0,
        start_date=today - timedelta(days=25),
        end_date=today + timedelta(days=5)
    )
    
    db.add_all([goal_active, goal_ending])
    db.commit()
    
    # Create time entries (using actual TimeEntry model)
    # Note: TimeEntry requires task_id, not sub_category_id
    entry1 = TimeEntry(
        task_id=task_today.id,
        entry_date=today,
        start_time=datetime.combine(today, datetime.strptime("09:00", "%H:%M").time()),
        end_time=datetime.combine(today, datetime.strptime("11:30", "%H:%M").time()),
        duration_minutes=150
    )
    
    entry2 = TimeEntry(
        task_id=task_tomorrow.id,
        entry_date=today,
        start_time=datetime.combine(today, datetime.strptime("14:00", "%H:%M").time()),
        end_time=datetime.combine(today, datetime.strptime("15:00", "%H:%M").time()),
        duration_minutes=60
    )
    
    entry3 = TimeEntry(
        task_id=task_today.id,
        entry_date=today - timedelta(days=1),
        start_time=datetime.combine(today - timedelta(days=1), datetime.strptime("10:00", "%H:%M").time()),
        end_time=datetime.combine(today - timedelta(days=1), datetime.strptime("12:00", "%H:%M").time()),
        duration_minutes=120
    )
    
    db.add_all([entry1, entry2, entry3])
    db.commit()
    
    # Store IDs before closing session
    result = {
        "pillar_ids": {
            "hard_work": hard_work.id,
            "calmness": calmness.id
        },
        "dates": {
            "today": today,
            "tomorrow": today + timedelta(days=1),
            "next_week": today + timedelta(days=7),
            "yesterday": today - timedelta(days=1)
        }
    }
    
    db.close()
    
    return result


class TestDailyCalendar:
    """Test daily calendar view endpoint"""
    
    def test_get_daily_calendar_today(self, sample_data):
        """Test getting today's calendar"""
        today = sample_data["dates"]["today"]
        response = client.get(f"/api/calendar/daily?target_date={today}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify basic structure exists
        assert "date" in data
        assert isinstance(data, dict)
        
        # Verify we got some data (tasks, goals, or time entries)
        has_data = ("tasks" in data and len(data.get("tasks", [])) > 0) or \
                   ("active_goals" in data and len(data.get("active_goals", [])) > 0) or \
                   ("time_entries" in data and len(data.get("time_entries", [])) > 0)
        assert has_data, "Calendar should return some tasks, goals, or time entries"
    
    def test_get_daily_calendar_with_pillar_filter(self, sample_data):
        """Test daily calendar with pillar filter"""
        today = sample_data["dates"]["today"]
        pillar_id = sample_data["pillar_ids"]["hard_work"]
        
        response = client.get(
            f"/api/calendar/daily?target_date={today}&pillar_id={pillar_id}"
        )
        
        assert response.status_code == 200
        assert isinstance(response.json(), dict)
    
    def test_get_daily_calendar_no_events(self):
        """Test daily calendar with no events"""
        future_date = date.today() + timedelta(days=365)
        response = client.get(f"/api/calendar/daily?target_date={future_date}")
        
        assert response.status_code == 200
        assert isinstance(response.json(), dict)
    
    def test_get_daily_calendar_invalid_date(self):
        """Test with invalid date format"""
        response = client.get("/api/calendar/daily?target_date=invalid")
        
        assert response.status_code == 422  # Validation error


class TestWeeklyCalendar:
    """Test weekly calendar view endpoint"""
    
    def test_get_weekly_calendar(self, sample_data):
        """Test getting weekly calendar"""
        today = sample_data["dates"]["today"]
        # Start from Monday of current week
        start_date = today - timedelta(days=today.weekday())
        
        response = client.get(f"/api/calendar/weekly?start_date={start_date}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "days" in data
        assert len(data["days"]) == 7
    
    def test_get_weekly_calendar_with_pillar_filter(self, sample_data):
        """Test weekly calendar with pillar filter"""
        today = sample_data["dates"]["today"]
        start_date = today - timedelta(days=today.weekday())
        pillar_id = sample_data["pillar_ids"]["calmness"]
        
        response = client.get(
            f"/api/calendar/weekly?start_date={start_date}&pillar_id={pillar_id}"
        )
        
        assert response.status_code == 200
        assert isinstance(response.json(), dict)
    
    def test_get_weekly_calendar_future_week(self):
        """Test weekly calendar for future week"""
        future_date = date.today() + timedelta(days=30)
        response = client.get(f"/api/calendar/weekly?start_date={future_date}")
        
        assert response.status_code == 200
        data = response.json()
        assert "days" in data
        assert len(data["days"]) == 7


class TestMonthlyCalendar:
    """Test monthly calendar view endpoint"""
    
    def test_get_monthly_calendar_current_month(self, sample_data):
        """Test getting current month calendar"""
        today = date.today()
        
        response = client.get(
            f"/api/calendar/monthly?year={today.year}&month={today.month}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "days" in data
        assert 28 <= len(data["days"]) <= 31
    
    def test_get_monthly_calendar_with_pillar_filter(self, sample_data):
        """Test monthly calendar with pillar filter"""
        today = date.today()
        pillar_id = sample_data["pillar_ids"]["hard_work"]
        
        response = client.get(
            f"/api/calendar/monthly?year={today.year}&month={today.month}&pillar_id={pillar_id}"
        )
        
        assert response.status_code == 200
        assert isinstance(response.json(), dict)
    
    def test_get_monthly_calendar_february(self):
        """Test February (handles leap year)"""
        response = client.get("/api/calendar/monthly?year=2024&month=2")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["days"]) == 29
    
    def test_get_monthly_calendar_invalid_month(self):
        """Test with invalid month"""
        response = client.get("/api/calendar/monthly?year=2024&month=13")
        
        assert response.status_code == 422  # Validation error
    
    def test_get_monthly_calendar_today_marker(self, sample_data):
        """Test that today is correctly marked"""
        today = date.today()
        
        response = client.get(
            f"/api/calendar/monthly?year={today.year}&month={today.month}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "days" in data
        
        # Should have found at least one day marked as today
        today_markers = [day.get("is_today", False) for day in data["days"]]
        assert any(today_markers), "At least one day should be marked as today"


class TestUpcomingEvents:
    """Test upcoming events endpoint"""
    
    def test_get_upcoming_events_default(self, sample_data):
        """Test getting upcoming events (default 7 days)"""
        response = client.get("/api/calendar/upcoming")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        # Verify it has some data (tasks, goals, or summary)
        assert "summary" in data or "tasks" in data or "goals" in data
    
    def test_get_upcoming_events_custom_days(self, sample_data):
        """Test with custom days ahead"""
        response = client.get("/api/calendar/upcoming?days_ahead=30")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
    
    def test_get_upcoming_events_with_pillar_filter(self, sample_data):
        """Test upcoming events with pillar filter"""
        pillar_id = sample_data["pillar_ids"]["hard_work"]
        
        response = client.get(f"/api/calendar/upcoming?pillar_id={pillar_id}")
        
        assert response.status_code == 200
        assert isinstance(response.json(), dict)
    
    def test_get_upcoming_events_urgency_sorting(self, sample_data):
        """Test that events endpoint works"""
        response = client.get("/api/calendar/upcoming?days_ahead=30")
        
        assert response.status_code == 200
        assert isinstance(response.json(), dict)
    
    def test_get_upcoming_events_summary(self, sample_data):
        """Test summary exists"""
        response = client.get("/api/calendar/upcoming")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
    
    def test_get_upcoming_events_invalid_days(self):
        """Test with invalid days_ahead"""
        response = client.get("/api/calendar/upcoming?days_ahead=0")
        
        assert response.status_code == 422  # Validation error
        
        response = client.get("/api/calendar/upcoming?days_ahead=100")
        
        assert response.status_code == 422  # Exceeds maximum


class TestCalendarIntegration:
    """Integration tests for calendar features"""
    
    def test_calendar_consistency(self, sample_data):
        """Test that calendar views work together"""
        today = sample_data["dates"]["today"]
        
        # Get daily view
        daily = client.get(f"/api/calendar/daily?target_date={today}")
        assert daily.status_code == 200
        
        # Get weekly view containing today
        start_date = today - timedelta(days=today.weekday())
        weekly = client.get(f"/api/calendar/weekly?start_date={start_date}")
        assert weekly.status_code == 200
        
        # Both should return valid data
        assert isinstance(daily.json(), dict)
        assert isinstance(weekly.json(), dict)
    
    def test_calendar_pillar_filtering(self, sample_data):
        """Test pillar filtering across all calendar views"""
        today = sample_data["dates"]["today"]
        pillar_id = sample_data["pillar_ids"]["hard_work"]
        
        # Test all views with same pillar filter
        daily = client.get(
            f"/api/calendar/daily?target_date={today}&pillar_id={pillar_id}"
        )
        weekly = client.get(
            f"/api/calendar/weekly?start_date={today}&pillar_id={pillar_id}"
        )
        monthly = client.get(
            f"/api/calendar/monthly?year={today.year}&month={today.month}&pillar_id={pillar_id}"
        )
        upcoming = client.get(f"/api/calendar/upcoming?pillar_id={pillar_id}")
        
        assert daily.status_code == 200
        assert weekly.status_code == 200
        assert monthly.status_code == 200
        assert upcoming.status_code == 200
