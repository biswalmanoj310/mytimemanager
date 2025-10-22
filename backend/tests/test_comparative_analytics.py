"""
Tests for Comparative Analytics API endpoints
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, date, timedelta

from app.main import app
from app.database.config import Base, get_db
from app.models.models import Pillar, Category, Task, Goal, TimeEntry, FollowUpFrequency, GoalTimePeriod


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_comparative_analytics.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


# Override the database dependency
app.dependency_overrides[get_db] = override_get_db

# Create test client
client = TestClient(app)


# Setup and teardown
@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """Create tables before each test and drop after"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    """Get database session for tests"""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def sample_comparative_data(db_session: Session):
    """Create sample data for comparative analytics tests"""
    # Create pillars
    hard_work = Pillar(
        name="Hard Work",
        icon="💼",
        color_code="#3B82F6",
        allocated_hours=8
    )
    calmness = Pillar(
        name="Calmness",
        icon="🧘",
        color_code="#10B981",
        allocated_hours=8
    )
    family = Pillar(
        name="Family",
        icon="👨‍👩‍👦",
        color_code="#F59E0B",
        allocated_hours=8
    )
    db_session.add_all([hard_work, calmness, family])
    db_session.commit()
    
    # Create categories
    work_cat = Category(name="Work Projects", pillar_id=hard_work.id)
    meditation_cat = Category(name="Meditation", pillar_id=calmness.id)
    family_cat = Category(name="Family Time", pillar_id=family.id)
    db_session.add_all([work_cat, meditation_cat, family_cat])
    db_session.commit()
    
    # Create tasks with varying allocated times
    today = date.today()
    
    # Hard Work tasks - 10 hours allocated
    task1 = Task(
        name="Project Planning",
        pillar_id=hard_work.id,
        category_id=work_cat.id,
        allocated_minutes=300,  # 5 hours
        follow_up_frequency=FollowUpFrequency.TODAY,
        is_completed=True,
        created_at=today - timedelta(days=5)
    )
    task2 = Task(
        name="Development",
        pillar_id=hard_work.id,
        category_id=work_cat.id,
        allocated_minutes=300,  # 5 hours
        follow_up_frequency=FollowUpFrequency.TODAY,
        is_completed=False,
        created_at=today - timedelta(days=5)
    )
    
    # Calmness tasks - 4 hours allocated
    task3 = Task(
        name="Morning Meditation",
        pillar_id=calmness.id,
        category_id=meditation_cat.id,
        allocated_minutes=120,  # 2 hours
        follow_up_frequency=FollowUpFrequency.TODAY,
        is_completed=True,
        created_at=today - timedelta(days=5)
    )
    task4 = Task(
        name="Evening Yoga",
        pillar_id=calmness.id,
        category_id=meditation_cat.id,
        allocated_minutes=120,  # 2 hours
        follow_up_frequency=FollowUpFrequency.TODAY,
        is_completed=True,
        created_at=today - timedelta(days=5)
    )
    
    # Family tasks - 6 hours allocated
    task5 = Task(
        name="Family Dinner",
        pillar_id=family.id,
        category_id=family_cat.id,
        allocated_minutes=180,  # 3 hours
        follow_up_frequency=FollowUpFrequency.TODAY,
        is_completed=True,
        created_at=today - timedelta(days=5)
    )
    task6 = Task(
        name="Weekend Outing",
        pillar_id=family.id,
        category_id=family_cat.id,
        allocated_minutes=180,  # 3 hours
        follow_up_frequency=FollowUpFrequency.WEEKLY,
        is_completed=False,
        created_at=today - timedelta(days=5)
    )
    
    db_session.add_all([task1, task2, task3, task4, task5, task6])
    db_session.commit()
    
    # Create time entries (actual time spent)
    # Hard Work - 12 hours actual (over allocated)
    entry1 = TimeEntry(
        task_id=task1.id,
        entry_date=today - timedelta(days=3),
        start_time=datetime.combine(today - timedelta(days=3), datetime.strptime("09:00", "%H:%M").time()),
        duration_minutes=360,  # 6 hours
        notes="Extra time needed"
    )
    entry2 = TimeEntry(
        task_id=task2.id,
        entry_date=today - timedelta(days=2),
        start_time=datetime.combine(today - timedelta(days=2), datetime.strptime("09:00", "%H:%M").time()),
        duration_minutes=360,  # 6 hours
        notes="Development work"
    )
    
    # Calmness - 3 hours actual (under allocated)
    entry3 = TimeEntry(
        task_id=task3.id,
        entry_date=today - timedelta(days=3),
        start_time=datetime.combine(today - timedelta(days=3), datetime.strptime("06:00", "%H:%M").time()),
        duration_minutes=90,  # 1.5 hours
        notes="Morning session"
    )
    entry4 = TimeEntry(
        task_id=task4.id,
        entry_date=today - timedelta(days=2),
        start_time=datetime.combine(today - timedelta(days=2), datetime.strptime("18:00", "%H:%M").time()),
        duration_minutes=90,  # 1.5 hours
        notes="Evening session"
    )
    
    # Family - 5 hours actual (close to allocated)
    entry5 = TimeEntry(
        task_id=task5.id,
        entry_date=today - timedelta(days=1),
        start_time=datetime.combine(today - timedelta(days=1), datetime.strptime("18:00", "%H:%M").time()),
        duration_minutes=180,  # 3 hours
        notes="Family dinner"
    )
    entry6 = TimeEntry(
        task_id=task6.id,
        entry_date=today,
        start_time=datetime.combine(today, datetime.strptime("10:00", "%H:%M").time()),
        duration_minutes=120,  # 2 hours
        notes="Partial outing"
    )
    
    db_session.add_all([entry1, entry2, entry3, entry4, entry5, entry6])
    db_session.commit()
    
    # Create goals
    goal1 = Goal(
        name="Complete Project Phase 1",
        pillar_id=hard_work.id,
        goal_time_period=GoalTimePeriod.MONTH,
        allocated_hours=40,
        spent_hours=35,
        start_date=today - timedelta(days=20),
        end_date=today + timedelta(days=10),
        is_completed=False,
        is_active=True
    )
    
    goal2 = Goal(
        name="Daily Meditation Practice",
        pillar_id=calmness.id,
        goal_time_period=GoalTimePeriod.WEEK,
        allocated_hours=7,
        spent_hours=8,
        start_date=today - timedelta(days=5),
        end_date=today + timedelta(days=2),
        is_completed=True,
        is_active=True
    )
    
    goal3 = Goal(
        name="Family Vacation Planning",
        pillar_id=family.id,
        goal_time_period=GoalTimePeriod.MONTH,
        allocated_hours=20,
        spent_hours=5,
        start_date=today - timedelta(days=25),
        end_date=today + timedelta(days=5),
        is_completed=False,
        is_active=True
    )
    
    db_session.add_all([goal1, goal2, goal3])
    db_session.commit()
    
    return {
        'pillars': [hard_work, calmness, family],
        'tasks': [task1, task2, task3, task4, task5, task6],
        'time_entries': [entry1, entry2, entry3, entry4, entry5, entry6],
        'goals': [goal1, goal2, goal3]
    }


class TestPlannedVsActual:
    """Test planned vs actual time comparison endpoint"""
    
    def test_get_planned_vs_actual_default_params(self, sample_comparative_data):
        """Test with default parameters (last 30 days)"""
        response = client.get("/api/comparative-analytics/planned-vs-actual")
        assert response.status_code == 200
        
        data = response.json()
        assert 'start_date' in data
        assert 'end_date' in data
        assert 'period' in data
        assert data['period'] == 'day'
        assert 'periods' in data
        assert 'summary' in data
        
        summary = data['summary']
        assert 'total_planned_hours' in summary
        assert 'total_actual_hours' in summary
        assert 'total_variance_hours' in summary
        assert 'overall_efficiency' in summary
    
    def test_get_planned_vs_actual_with_date_range(self, sample_comparative_data):
        """Test with specific date range"""
        today = date.today()
        start = today - timedelta(days=7)
        
        response = client.get(
            f"/api/comparative-analytics/planned-vs-actual"
            f"?start_date={start.isoformat()}&end_date={today.isoformat()}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data['start_date'] == start.isoformat()
        assert data['end_date'] == today.isoformat()
    
    def test_get_planned_vs_actual_by_pillar(self, sample_comparative_data):
        """Test filtered by specific pillar"""
        pillar_id = sample_comparative_data['pillars'][0].id
        
        response = client.get(
            f"/api/comparative-analytics/planned-vs-actual?pillar_id={pillar_id}"
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify only requested pillar is included
        for period in data['periods']:
            for pillar_data in period['pillars']:
                assert pillar_data['pillar_id'] == pillar_id
    
    def test_get_planned_vs_actual_weekly_period(self, sample_comparative_data):
        """Test with weekly aggregation"""
        response = client.get(
            "/api/comparative-analytics/planned-vs-actual?period=week"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data['period'] == 'week'
    
    def test_get_planned_vs_actual_invalid_period(self):
        """Test with invalid period"""
        response = client.get(
            "/api/comparative-analytics/planned-vs-actual?period=invalid"
        )
        assert response.status_code == 400
    
    def test_get_planned_vs_actual_invalid_date_range(self):
        """Test with invalid date range (start > end)"""
        today = date.today()
        response = client.get(
            f"/api/comparative-analytics/planned-vs-actual"
            f"?start_date={today.isoformat()}&end_date={(today - timedelta(days=1)).isoformat()}"
        )
        assert response.status_code == 400


class TestGoalProgressTrends:
    """Test goal progress trends endpoint"""
    
    def test_get_goal_progress_default(self, sample_comparative_data):
        """Test with default parameters"""
        response = client.get("/api/comparative-analytics/goal-progress-trends")
        assert response.status_code == 200
        
        data = response.json()
        assert 'time_period' in data
        assert data['time_period'] == 'month'
        assert 'goals' in data
        assert 'summary' in data
        
        summary = data['summary']
        assert 'total_goals' in summary
        assert 'completed' in summary
        assert 'on_track' in summary
        assert 'at_risk' in summary
        assert 'behind' in summary
        assert 'completion_rate' in summary
        assert 'average_progress' in summary
    
    def test_get_goal_progress_with_goals(self, sample_comparative_data):
        """Test with actual goals data"""
        response = client.get("/api/comparative-analytics/goal-progress-trends")
        assert response.status_code == 200
        
        data = response.json()
        goals = data['goals']
        
        assert len(goals) > 0
        for goal in goals:
            assert 'goal_id' in goal
            assert 'goal_name' in goal
            assert 'pillar' in goal
            assert 'progress_percentage' in goal
            assert 'expected_progress' in goal
            assert 'variance' in goal
            assert 'status' in goal
            assert goal['status'] in ['completed', 'on_track', 'at_risk', 'behind']
    
    def test_get_goal_progress_by_pillar(self, sample_comparative_data):
        """Test filtered by pillar"""
        pillar_id = sample_comparative_data['pillars'][0].id
        
        response = client.get(
            f"/api/comparative-analytics/goal-progress-trends?pillar_id={pillar_id}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data['pillar_id'] == pillar_id
    
    def test_get_goal_progress_invalid_period(self):
        """Test with invalid time period"""
        response = client.get(
            "/api/comparative-analytics/goal-progress-trends?time_period=invalid"
        )
        assert response.status_code == 400


class TestPillarBalance:
    """Test pillar balance analysis endpoint"""
    
    def test_get_pillar_balance_default(self, sample_comparative_data):
        """Test with default parameters"""
        response = client.get("/api/comparative-analytics/pillar-balance")
        assert response.status_code == 200
        
        data = response.json()
        assert 'start_date' in data
        assert 'end_date' in data
        assert 'pillars' in data
        assert 'balance_metrics' in data
        
        metrics = data['balance_metrics']
        assert 'total_hours' in metrics
        assert 'ideal_hours_per_pillar' in metrics
        assert 'balance_score' in metrics
        assert 'balance_status' in metrics
        assert 'recommendations' in metrics
    
    def test_get_pillar_balance_pillar_data(self, sample_comparative_data):
        """Test pillar-specific data"""
        response = client.get("/api/comparative-analytics/pillar-balance")
        assert response.status_code == 200
        
        data = response.json()
        pillars = data['pillars']
        
        assert len(pillars) == 3  # Hard Work, Calmness, Family
        
        for pillar in pillars:
            assert 'pillar_id' in pillar
            assert 'pillar_name' in pillar
            assert 'pillar_icon' in pillar
            assert 'pillar_color' in pillar
            assert 'actual_hours' in pillar
            assert 'time_percentage' in pillar
            assert 'ideal_percentage' in pillar
            assert pillar['ideal_percentage'] == 33.3
            assert 'balance_variance' in pillar
            assert 'balance_status' in pillar
            assert 'goals' in pillar
            assert 'tasks' in pillar
    
    def test_get_pillar_balance_with_date_range(self, sample_comparative_data):
        """Test with specific date range"""
        today = date.today()
        start = today - timedelta(days=14)
        
        response = client.get(
            f"/api/comparative-analytics/pillar-balance"
            f"?start_date={start.isoformat()}&end_date={today.isoformat()}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data['start_date'] == start.isoformat()
        assert data['end_date'] == today.isoformat()


class TestProductivityInsights:
    """Test productivity insights endpoint"""
    
    def test_get_productivity_insights_default(self, sample_comparative_data):
        """Test with default parameters"""
        response = client.get("/api/comparative-analytics/productivity-insights")
        assert response.status_code == 200
        
        data = response.json()
        assert 'start_date' in data
        assert 'end_date' in data
        assert 'daily_patterns' in data
        assert 'hourly_patterns' in data
        assert 'insights' in data
    
    def test_get_productivity_insights_patterns(self, sample_comparative_data):
        """Test productivity patterns data"""
        response = client.get("/api/comparative-analytics/productivity-insights")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check daily patterns
        if data['daily_patterns']:
            for pattern in data['daily_patterns']:
                assert 'day_of_week' in pattern
                assert 'day_name' in pattern
                assert 'entry_count' in pattern
                assert 'total_hours' in pattern
                assert 'average_session_minutes' in pattern
        
        # Check hourly patterns
        if data['hourly_patterns']:
            for pattern in data['hourly_patterns']:
                assert 'hour' in pattern
                assert 'time_label' in pattern
                assert 'entry_count' in pattern
                assert 'total_hours' in pattern


class TestEfficiencyMetrics:
    """Test efficiency metrics endpoint"""
    
    def test_get_efficiency_metrics_default(self, sample_comparative_data):
        """Test with default parameters"""
        response = client.get("/api/comparative-analytics/efficiency-metrics")
        assert response.status_code == 200
        
        data = response.json()
        assert 'start_date' in data
        assert 'end_date' in data
        assert 'overall_efficiency_score' in data
        assert 'efficiency_rating' in data
        assert 'factors' in data
        assert 'details' in data
        assert 'recommendations' in data
    
    def test_get_efficiency_metrics_factors(self, sample_comparative_data):
        """Test efficiency factors"""
        response = client.get("/api/comparative-analytics/efficiency-metrics")
        assert response.status_code == 200
        
        data = response.json()
        factors = data['factors']
        
        # Should have 3 factors: planning accuracy, goal achievement, work-life balance
        assert len(factors) >= 2
        
        for factor in factors:
            assert 'name' in factor
            assert 'score' in factor
            assert 'weight' in factor
            assert 'description' in factor
    
    def test_get_efficiency_metrics_details(self, sample_comparative_data):
        """Test detailed metrics"""
        response = client.get("/api/comparative-analytics/efficiency-metrics")
        assert response.status_code == 200
        
        data = response.json()
        details = data['details']
        
        assert 'planned_vs_actual' in details
        assert 'goal_progress' in details
        assert 'pillar_balance' in details
        assert 'productivity_patterns' in details
    
    def test_get_efficiency_metrics_recommendations(self, sample_comparative_data):
        """Test recommendations generation"""
        response = client.get("/api/comparative-analytics/efficiency-metrics")
        assert response.status_code == 200
        
        data = response.json()
        recommendations = data['recommendations']
        
        assert isinstance(recommendations, list)
        assert len(recommendations) > 0
        
        for rec in recommendations:
            assert 'category' in rec
            assert 'priority' in rec
            assert 'message' in rec
            assert 'action' in rec


class TestComparativeAnalyticsIntegration:
    """Integration tests for comparative analytics"""
    
    def test_full_analytics_workflow(self, sample_comparative_data):
        """Test complete analytics workflow"""
        # 1. Check planned vs actual
        response1 = client.get("/api/comparative-analytics/planned-vs-actual")
        assert response1.status_code == 200
        
        # 2. Check goal progress
        response2 = client.get("/api/comparative-analytics/goal-progress-trends")
        assert response2.status_code == 200
        
        # 3. Check pillar balance
        response3 = client.get("/api/comparative-analytics/pillar-balance")
        assert response3.status_code == 200
        
        # 4. Check productivity insights
        response4 = client.get("/api/comparative-analytics/productivity-insights")
        assert response4.status_code == 200
        
        # 5. Get comprehensive efficiency metrics
        response5 = client.get("/api/comparative-analytics/efficiency-metrics")
        assert response5.status_code == 200
        
        # Verify all data is consistent
        data5 = response5.json()
        assert data5['overall_efficiency_score'] >= 0
        assert data5['overall_efficiency_score'] <= 100
    
    def test_comparative_analytics_with_no_data(self):
        """Test endpoints with no data"""
        # Should not crash, just return empty/zero values
        response = client.get("/api/comparative-analytics/planned-vs-actual")
        assert response.status_code == 200
        
        response = client.get("/api/comparative-analytics/goal-progress-trends")
        assert response.status_code == 200
        
        response = client.get("/api/comparative-analytics/pillar-balance")
        assert response.status_code == 200
