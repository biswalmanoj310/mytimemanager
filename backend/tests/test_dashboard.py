"""
Tests for Dashboard API
Comprehensive tests for goal and task dashboard endpoints
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

from app.main import app
from app.database.config import Base, get_db
from app.models.models import Pillar, Category, SubCategory, Goal, Task


# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_dashboard.db"
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
    """Set up test data before each test"""
    db = TestingSessionLocal()
    
    # Clear existing data
    db.query(Task).delete()
    db.query(Goal).delete()
    db.query(SubCategory).delete()
    db.query(Category).delete()
    db.query(Pillar).delete()
    
    # Create test pillars
    pillar1 = Pillar(name="Hard Work", allocated_hours=8.0, icon="💼")
    pillar2 = Pillar(name="Calmness", allocated_hours=8.0, icon="🧘")
    db.add_all([pillar1, pillar2])
    db.commit()
    db.refresh(pillar1)
    db.refresh(pillar2)
    
    # Create test categories
    category1 = Category(
        name="Professional Development",
        pillar_id=pillar1.id,
        allocated_hours=4.0
    )
    category2 = Category(
        name="Meditation",
        pillar_id=pillar2.id,
        allocated_hours=2.0
    )
    db.add_all([category1, category2])
    db.commit()
    db.refresh(category1)
    db.refresh(category2)
    
    # Create test goals with different statuses and progress
    goals_data = [
        {"name": "Master FastAPI", "pillar_id": pillar1.id, "category_id": category1.id,
         "time_period": "quarter", "allocated": 40.0, "spent": 30.0, "completed": False},
        {"name": "Learn Python Advanced", "pillar_id": pillar1.id, "category_id": category1.id,
         "time_period": "month", "allocated": 20.0, "spent": 5.0, "completed": False},
        {"name": "Complete Database Course", "pillar_id": pillar1.id, "category_id": category1.id,
         "time_period": "week", "allocated": 10.0, "spent": 10.0, "completed": True},
        {"name": "Daily Meditation Practice", "pillar_id": pillar2.id, "category_id": category2.id,
         "time_period": "year", "allocated": 100.0, "spent": 15.0, "completed": False}
    ]
    
    created_goals = []
    for g_data in goals_data:
        goal = Goal(
            name=g_data["name"],
            pillar_id=g_data["pillar_id"],
            category_id=g_data["category_id"],
            goal_time_period=g_data["time_period"],
            allocated_hours=g_data["allocated"],
            spent_hours=g_data["spent"],
            is_active=True,
            is_completed=g_data["completed"],
            completed_at=datetime.now() if g_data["completed"] else None
        )
        db.add(goal)
        db.commit()
        db.refresh(goal)
        created_goals.append(goal)
    
    # Create test tasks linked to goals
    task1 = Task(
        name="Study FastAPI Docs",
        pillar_id=pillar1.id,
        category_id=category1.id,
        goal_id=created_goals[0].id,
        allocated_minutes=120,
        spent_minutes=60,
        follow_up_frequency="weekly",
        is_part_of_goal=True,
        is_completed=False
    )
    task2 = Task(
        name="Build API Project",
        pillar_id=pillar1.id,
        category_id=category1.id,
        goal_id=created_goals[0].id,
        allocated_minutes=180,
        spent_minutes=180,
        follow_up_frequency="weekly",
        is_part_of_goal=True,
        is_completed=True,
        completed_at=datetime.now()
    )
    db.add_all([task1, task2])
    db.commit()
    
    # Store IDs before closing session
    test_data = {
        "pillar1_id": pillar1.id,
        "pillar2_id": pillar2.id,
        "category1_id": category1.id,
        "category2_id": category2.id,
        "goal_ids": [g.id for g in created_goals]
    }
    
    db.close()
    
    yield test_data


def test_goals_dashboard_overview(setup_test_data):
    """Test getting goals dashboard overview"""
    response = client.get("/api/dashboard/goals/overview")
    assert response.status_code == 200
    
    data = response.json()
    
    # Check summary
    assert "summary" in data
    summary = data["summary"]
    assert summary["total_goals"] == 4
    assert summary["active_goals"] == 4
    assert summary["completed_goals"] == 1
    assert summary["pending_goals"] == 3
    assert summary["total_allocated_hours"] == 170.0
    
    # Check by time period
    assert "by_time_period" in data
    assert "week" in data["by_time_period"]
    assert "month" in data["by_time_period"]
    assert "quarter" in data["by_time_period"]
    
    # Check by pillar
    assert "by_pillar" in data
    assert "Hard Work" in data["by_pillar"]
    assert "Calmness" in data["by_pillar"]
    
    # Check top performing
    assert "top_performing" in data
    assert len(data["top_performing"]) > 0
    
    # Check needs attention
    assert "needs_attention" in data
    
    # Check recently completed
    assert "recently_completed" in data
    assert len(data["recently_completed"]) == 1


def test_filtered_goals_dashboard(setup_test_data):
    """Test getting filtered goals dashboard"""
    test_data = setup_test_data
    
    # Test filter by pillar
    response = client.get(f"/api/dashboard/goals/filtered?pillar_id={test_data['pillar1_id']}")
    assert response.status_code == 200
    
    data = response.json()
    assert "summary" in data
    assert "goals" in data
    assert data["summary"]["total_count"] == 3  # 3 goals for Hard Work pillar
    
    # Verify all goals belong to correct pillar
    for goal in data["goals"]:
        assert goal["pillar_id"] == test_data["pillar1_id"]


def test_filtered_goals_by_time_period(setup_test_data):
    """Test filtering goals by time period"""
    response = client.get("/api/dashboard/goals/filtered?time_period=month")
    assert response.status_code == 200
    
    data = response.json()
    assert data["summary"]["total_count"] == 1
    assert data["goals"][0]["goal_time_period"] == "month"


def test_filtered_goals_by_status(setup_test_data):
    """Test filtering goals by status"""
    # Test completed goals
    response = client.get("/api/dashboard/goals/filtered?status=completed")
    assert response.status_code == 200
    
    data = response.json()
    assert data["summary"]["total_count"] == 1
    assert all(g["is_completed"] for g in data["goals"])
    
    # Test active goals
    response = client.get("/api/dashboard/goals/filtered?status=active")
    assert response.status_code == 200
    
    data = response.json()
    assert data["summary"]["total_count"] == 3
    assert all(g["is_active"] and not g["is_completed"] for g in data["goals"])


def test_filtered_goals_sorting(setup_test_data):
    """Test sorting goals"""
    # Sort by progress descending
    response = client.get("/api/dashboard/goals/filtered?sort_by=progress&sort_order=desc")
    assert response.status_code == 200
    
    data = response.json()
    goals = data["goals"]
    
    # Verify descending order
    for i in range(len(goals) - 1):
        assert goals[i]["progress"] >= goals[i + 1]["progress"]
    
    # Sort by name ascending
    response = client.get("/api/dashboard/goals/filtered?sort_by=name&sort_order=asc")
    assert response.status_code == 200
    
    data = response.json()
    goals = data["goals"]
    
    # Verify ascending order
    for i in range(len(goals) - 1):
        assert goals[i]["name"].lower() <= goals[i + 1]["name"].lower()


def test_goals_progress_matrix(setup_test_data):
    """Test getting goals progress matrix"""
    response = client.get("/api/dashboard/goals/progress-matrix")
    assert response.status_code == 200
    
    data = response.json()
    
    # Check matrix structure
    assert "matrix" in data
    assert "legend" in data
    
    matrix = data["matrix"]
    assert len(matrix) > 0
    
    # Check first pillar
    first_pillar = matrix[0]
    assert "pillar_id" in first_pillar
    assert "pillar_name" in first_pillar
    assert "total_goals" in first_pillar
    assert "goals" in first_pillar
    
    # Check goal data in matrix
    for goal in first_pillar["goals"]:
        assert "progress" in goal
        assert "status_indicator" in goal
        assert "status_color" in goal
        assert goal["status_indicator"] in ["completed", "on_track", "in_progress", "behind", "needs_attention"]
    
    # Check legend
    legend = data["legend"]
    assert "completed" in legend
    assert "on_track" in legend
    assert "needs_attention" in legend


def test_goals_timeline(setup_test_data):
    """Test getting goals timeline"""
    response = client.get("/api/dashboard/goals/timeline")
    assert response.status_code == 200
    
    data = response.json()
    
    assert "timeline" in data
    assert "total_goals" in data
    assert data["total_goals"] == 4
    
    # Check timeline data
    timeline = data["timeline"]
    for goal in timeline:
        assert "id" in goal
        assert "name" in goal
        assert "time_period" in goal
        assert "progress" in goal
        assert "is_completed" in goal
        assert "days_since_start" in goal


def test_goals_timeline_filtered_by_pillar(setup_test_data):
    """Test filtering goals timeline by pillar"""
    test_data = setup_test_data
    
    response = client.get(f"/api/dashboard/goals/timeline?pillar_id={test_data['pillar1_id']}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["total_goals"] == 3


def test_tasks_dashboard_overview(setup_test_data):
    """Test getting tasks dashboard overview"""
    response = client.get("/api/dashboard/tasks/overview")
    assert response.status_code == 200
    
    data = response.json()
    
    # Check summary
    assert "summary" in data
    summary = data["summary"]
    assert summary["total_tasks"] == 2
    assert summary["active_tasks"] == 2
    assert summary["completed_tasks"] == 1
    assert summary["pending_tasks"] == 1
    assert summary["tasks_with_goals"] == 2
    
    # Check by frequency
    assert "by_frequency" in data
    assert "weekly" in data["by_frequency"]
    assert data["by_frequency"]["weekly"]["count"] == 2
    
    # Check by pillar
    assert "by_pillar" in data
    assert "Hard Work" in data["by_pillar"]


def test_dashboard_with_no_data():
    """Test dashboard with empty database"""
    db = TestingSessionLocal()
    db.query(Task).delete()
    db.query(Goal).delete()
    db.query(SubCategory).delete()
    db.query(Category).delete()
    db.query(Pillar).delete()
    db.commit()
    db.close()
    
    response = client.get("/api/dashboard/goals/overview")
    assert response.status_code == 200
    
    data = response.json()
    assert data["summary"]["total_goals"] == 0
    assert data["summary"]["overall_progress"] == 0


def test_filtered_dashboard_combined_filters(setup_test_data):
    """Test dashboard with multiple filters combined"""
    test_data = setup_test_data
    
    response = client.get(
        f"/api/dashboard/goals/filtered?"
        f"pillar_id={test_data['pillar1_id']}&"
        f"status=active&"
        f"sort_by=progress&"
        f"sort_order=desc"
    )
    assert response.status_code == 200
    
    data = response.json()
    
    # Should have 2 active goals for Hard Work pillar (excluding completed one)
    assert data["summary"]["total_count"] == 2
    
    # Verify all are from correct pillar and active
    for goal in data["goals"]:
        assert goal["pillar_id"] == test_data["pillar1_id"]
        assert goal["is_active"]
        assert not goal["is_completed"]
    
    # Verify sorted by progress descending
    if len(data["goals"]) > 1:
        for i in range(len(data["goals"]) - 1):
            assert data["goals"][i]["progress"] >= data["goals"][i + 1]["progress"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
