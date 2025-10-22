"""
Tests for Goal Management API
Comprehensive tests for goal CRUD operations, time-based tracking, and statistics
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
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_goals.db"
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
    
    # Create test pillar
    pillar = Pillar(
        name="Hard Work",
        description="Professional development and career",
        allocated_hours=8.0,
        icon="💼"
    )
    db.add(pillar)
    db.commit()
    db.refresh(pillar)
    
    # Create test category
    category = Category(
        name="Professional Development",
        description="Learning and skill development",
        pillar_id=pillar.id,
        allocated_hours=4.0
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    
    # Create test sub-category
    sub_category = SubCategory(
        name="Python Programming",
        description="Python skills",
        category_id=category.id,
        allocated_hours=2.0
    )
    db.add(sub_category)
    db.commit()
    db.refresh(sub_category)
    
    # Store IDs before closing session
    test_data = {
        "pillar_id": pillar.id,
        "category_id": category.id,
        "sub_category_id": sub_category.id
    }
    
    db.close()
    
    yield test_data


def test_create_goal_basic(setup_test_data):
    """Test creating a basic goal"""
    test_data = setup_test_data
    
    goal_data = {
        "name": "Master FastAPI",
        "description": "Become proficient in FastAPI framework",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "goal_time_period": "month",
        "allocated_hours": 20.0,
        "why_reason": "To build better APIs"
    }
    
    response = client.post("/api/goals/", json=goal_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["name"] == "Master FastAPI"
    assert data["goal_time_period"] == "month"
    assert data["allocated_hours"] == 20.0
    assert data["spent_hours"] == 0.0
    assert data["is_active"] is True
    assert data["is_completed"] is False


def test_create_goal_with_sub_category(setup_test_data):
    """Test creating a goal with sub-category"""
    test_data = setup_test_data
    
    goal_data = {
        "name": "Python Advanced Topics",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "sub_category_id": test_data["sub_category_id"],
        "goal_time_period": "quarter",
        "allocated_hours": 40.0
    }
    
    response = client.post("/api/goals/", json=goal_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["sub_category_id"] == test_data["sub_category_id"]
    assert data["goal_time_period"] == "quarter"


def test_create_goal_with_dates(setup_test_data):
    """Test creating a goal with start and end dates"""
    test_data = setup_test_data
    
    start_date = datetime.now()
    end_date = start_date + timedelta(days=30)
    
    goal_data = {
        "name": "30-Day Challenge",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "goal_time_period": "month",
        "allocated_hours": 15.0,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat()
    }
    
    response = client.post("/api/goals/", json=goal_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["start_date"] is not None
    assert data["end_date"] is not None


def test_create_goal_invalid_pillar(setup_test_data):
    """Test creating goal with non-existent pillar"""
    test_data = setup_test_data
    
    goal_data = {
        "name": "Invalid Goal",
        "pillar_id": 9999,
        "category_id": test_data["category_id"],
        "goal_time_period": "week",
        "allocated_hours": 10.0
    }
    
    response = client.post("/api/goals/", json=goal_data)
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


def test_create_goal_category_pillar_mismatch(setup_test_data):
    """Test creating goal where category doesn't belong to pillar"""
    test_data = setup_test_data
    
    # Create another pillar
    db = TestingSessionLocal()
    pillar2 = Pillar(name="Calmness", allocated_hours=8.0)
    db.add(pillar2)
    db.commit()
    db.refresh(pillar2)
    pillar2_id = pillar2.id
    db.close()
    
    goal_data = {
        "name": "Mismatched Goal",
        "pillar_id": pillar2_id,
        "category_id": test_data["category_id"],  # Belongs to Hard Work
        "goal_time_period": "month",
        "allocated_hours": 10.0
    }
    
    response = client.post("/api/goals/", json=goal_data)
    assert response.status_code == 400
    assert "does not belong" in response.json()["detail"].lower()


def test_get_all_goals(setup_test_data):
    """Test getting all goals"""
    test_data = setup_test_data
    
    # Create multiple goals
    for i in range(3):
        goal_data = {
            "name": f"Goal {i+1}",
            "pillar_id": test_data["pillar_id"],
            "category_id": test_data["category_id"],
            "goal_time_period": "month",
            "allocated_hours": 10.0 + (i * 5)
        }
        client.post("/api/goals/", json=goal_data)
    
    response = client.get("/api/goals/")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) >= 3


def test_get_goals_with_filters(setup_test_data):
    """Test getting goals with filtering"""
    test_data = setup_test_data
    
    # Create goals with different time periods
    periods = ["week", "month", "quarter", "year"]
    for period in periods:
        goal_data = {
            "name": f"Goal {period}",
            "pillar_id": test_data["pillar_id"],
            "category_id": test_data["category_id"],
            "goal_time_period": period,
            "allocated_hours": 10.0
        }
        client.post("/api/goals/", json=goal_data)
    
    # Filter by time period
    response = client.get("/api/goals/?goal_time_period=month")
    assert response.status_code == 200
    
    data = response.json()
    assert all(goal["goal_time_period"] == "month" for goal in data)


def test_get_goal_by_id(setup_test_data):
    """Test getting a specific goal by ID"""
    test_data = setup_test_data
    
    # Create goal
    goal_data = {
        "name": "Specific Goal",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "goal_time_period": "quarter",
        "allocated_hours": 30.0
    }
    
    create_response = client.post("/api/goals/", json=goal_data)
    goal_id = create_response.json()["id"]
    
    # Get goal
    response = client.get(f"/api/goals/{goal_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["name"] == "Specific Goal"
    assert data["allocated_hours"] == 30.0


def test_get_goal_with_stats(setup_test_data):
    """Test getting goal with statistics"""
    test_data = setup_test_data
    
    # Create goal
    goal_data = {
        "name": "Stats Goal",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "sub_category_id": test_data["sub_category_id"],
        "goal_time_period": "month",
        "allocated_hours": 20.0
    }
    
    create_response = client.post("/api/goals/", json=goal_data)
    goal_id = create_response.json()["id"]
    
    # Get stats
    response = client.get(f"/api/goals/{goal_id}/stats")
    assert response.status_code == 200
    
    data = response.json()
    assert data["pillar_name"] == "Hard Work"
    assert data["category_name"] == "Professional Development"
    assert data["sub_category_name"] == "Python Programming"
    assert data["progress_percentage"] == 0.0
    assert data["linked_tasks_count"] == 0
    assert data["remaining_hours"] == 20.0


def test_update_goal(setup_test_data):
    """Test updating a goal"""
    test_data = setup_test_data
    
    # Create goal
    goal_data = {
        "name": "Original Goal",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "goal_time_period": "month",
        "allocated_hours": 20.0
    }
    
    create_response = client.post("/api/goals/", json=goal_data)
    goal_id = create_response.json()["id"]
    
    # Update goal
    update_data = {
        "name": "Updated Goal",
        "allocated_hours": 30.0,
        "goal_time_period": "quarter"
    }
    
    response = client.put(f"/api/goals/{goal_id}", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["name"] == "Updated Goal"
    assert data["allocated_hours"] == 30.0
    assert data["goal_time_period"] == "quarter"


def test_mark_goal_completed(setup_test_data):
    """Test marking a goal as completed"""
    test_data = setup_test_data
    
    # Create goal
    goal_data = {
        "name": "Goal to Complete",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "goal_time_period": "week",
        "allocated_hours": 10.0
    }
    
    create_response = client.post("/api/goals/", json=goal_data)
    goal_id = create_response.json()["id"]
    
    # Mark completed
    response = client.post(f"/api/goals/{goal_id}/complete")
    assert response.status_code == 200
    
    data = response.json()
    assert data["is_completed"] is True
    assert data["completed_at"] is not None


def test_delete_goal(setup_test_data):
    """Test deleting a goal"""
    test_data = setup_test_data
    
    # Create goal
    goal_data = {
        "name": "Goal to Delete",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "goal_time_period": "month",
        "allocated_hours": 15.0
    }
    
    create_response = client.post("/api/goals/", json=goal_data)
    goal_id = create_response.json()["id"]
    
    # Delete goal
    response = client.delete(f"/api/goals/{goal_id}")
    assert response.status_code == 204
    
    # Verify deletion
    get_response = client.get(f"/api/goals/{goal_id}")
    assert get_response.status_code == 404


def test_get_goals_by_period(setup_test_data):
    """Test getting goals by time period"""
    test_data = setup_test_data
    
    # Create goals with different periods
    periods = ["week", "month", "quarter"]
    for period in periods:
        for i in range(2):
            goal_data = {
                "name": f"Goal {period} {i+1}",
                "pillar_id": test_data["pillar_id"],
                "category_id": test_data["category_id"],
                "goal_time_period": period,
                "allocated_hours": 10.0
            }
            client.post("/api/goals/", json=goal_data)
    
    response = client.get("/api/goals/by-period/month")
    assert response.status_code == 200
    
    data = response.json()
    assert data["time_period"] == "month"
    assert data["total_goals"] >= 2
    assert len(data["goals"]) >= 2


def test_get_goals_summary_by_pillar(setup_test_data):
    """Test getting goal summary for a pillar"""
    test_data = setup_test_data
    
    # Create goals with different periods
    periods = ["week", "month", "quarter", "year"]
    for period in periods:
        goal_data = {
            "name": f"Goal {period}",
            "pillar_id": test_data["pillar_id"],
            "category_id": test_data["category_id"],
            "goal_time_period": period,
            "allocated_hours": 10.0
        }
        client.post("/api/goals/", json=goal_data)
    
    response = client.get(f"/api/goals/by-pillar/{test_data['pillar_id']}/summary")
    assert response.status_code == 200
    
    data = response.json()
    assert data["pillar_id"] == test_data["pillar_id"]
    assert data["total_goals"] >= 4
    assert "by_time_period" in data
    assert len(data["by_time_period"]) >= 4


def test_get_goals_summary_by_category(setup_test_data):
    """Test getting goal summary for a category"""
    test_data = setup_test_data
    
    # Create goals
    for i in range(3):
        goal_data = {
            "name": f"Category Goal {i+1}",
            "pillar_id": test_data["pillar_id"],
            "category_id": test_data["category_id"],
            "goal_time_period": "month",
            "allocated_hours": 15.0 + (i * 5)
        }
        client.post("/api/goals/", json=goal_data)
    
    response = client.get(f"/api/goals/by-category/{test_data['category_id']}/summary")
    assert response.status_code == 200
    
    data = response.json()
    assert data["category_id"] == test_data["category_id"]
    assert data["total_goals"] >= 3


def test_goal_with_all_time_periods(setup_test_data):
    """Test creating goals with all time periods"""
    test_data = setup_test_data
    
    periods = ["week", "month", "quarter", "year"]
    
    for period in periods:
        goal_data = {
            "name": f"Goal {period}",
            "pillar_id": test_data["pillar_id"],
            "category_id": test_data["category_id"],
            "goal_time_period": period,
            "allocated_hours": 10.0
        }
        
        response = client.post("/api/goals/", json=goal_data)
        assert response.status_code == 201
        assert response.json()["goal_time_period"] == period


def test_recalculate_goal_progress(setup_test_data):
    """Test recalculating goal progress from tasks"""
    test_data = setup_test_data
    
    # Create goal
    goal_data = {
        "name": "Goal with Tasks",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "goal_time_period": "month",
        "allocated_hours": 20.0
    }
    
    create_response = client.post("/api/goals/", json=goal_data)
    goal_id = create_response.json()["id"]
    
    # Create tasks linked to this goal
    task_data = {
        "name": "Task 1",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "goal_id": goal_id,
        "allocated_minutes": 120,
        "follow_up_frequency": "weekly"
    }
    client.post("/api/tasks/", json=task_data)
    
    # Recalculate progress
    response = client.post(f"/api/goals/{goal_id}/recalculate")
    assert response.status_code == 200
    
    data = response.json()
    assert "spent_hours" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
