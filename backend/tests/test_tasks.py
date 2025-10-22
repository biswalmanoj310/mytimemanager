"""
Tests for Task Management API
Comprehensive tests for task CRUD operations, validation, and statistics
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

from app.main import app
from app.database.config import Base, get_db
from app.models.models import Pillar, Category, SubCategory, Goal


# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_tasks.db"
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
    
    # Create test goal
    goal = Goal(
        name="Master FastAPI",
        description="Become proficient in FastAPI",
        pillar_id=pillar.id,
        category_id=category.id,
        sub_category_id=sub_category.id,
        goal_time_period="month",
        allocated_hours=20.0,
        why_reason="To build better APIs"
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    
    # Store IDs before closing session
    test_data = {
        "pillar_id": pillar.id,
        "category_id": category.id,
        "sub_category_id": sub_category.id,
        "goal_id": goal.id
    }
    
    db.close()
    
    yield test_data


def test_create_task_basic(setup_test_data):
    """Test creating a basic task"""
    test_data = setup_test_data
    
    task_data = {
        "name": "Build REST API",
        "description": "Create a comprehensive REST API",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "allocated_minutes": 120,
        "follow_up_frequency": "weekly",
        "why_reason": "To improve backend skills"
    }
    
    response = client.post("/api/tasks/", json=task_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["name"] == "Build REST API"
    assert data["allocated_minutes"] == 120
    assert data["follow_up_frequency"] == "weekly"
    assert data["is_active"] is True
    assert data["is_completed"] is False


def test_create_task_with_sub_category(setup_test_data):
    """Test creating a task with sub-category"""
    test_data = setup_test_data
    
    task_data = {
        "name": "Write Unit Tests",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "sub_category_id": test_data["sub_category_id"],
        "allocated_minutes": 90,
        "follow_up_frequency": "today"
    }
    
    response = client.post("/api/tasks/", json=task_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["sub_category_id"] == test_data["sub_category_id"]


def test_create_task_with_goal(setup_test_data):
    """Test creating a task linked to a goal"""
    test_data = setup_test_data
    
    task_data = {
        "name": "Study FastAPI Documentation",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "sub_category_id": test_data["sub_category_id"],
        "goal_id": test_data["goal_id"],
        "is_part_of_goal": True,
        "allocated_minutes": 60,
        "follow_up_frequency": "today",  # Changed from "daily" to "today"
        "why_reason": "To master FastAPI",
        "additional_whys": ["Better job prospects", "Higher salary"]
    }
    
    response = client.post("/api/tasks/", json=task_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["goal_id"] == test_data["goal_id"]
    assert data["is_part_of_goal"] is True
    assert data["additional_whys"] == ["Better job prospects", "Higher salary"]


def test_create_task_invalid_pillar(setup_test_data):
    """Test creating task with non-existent pillar"""
    test_data = setup_test_data
    
    task_data = {
        "name": "Invalid Task",
        "pillar_id": 9999,
        "category_id": test_data["category_id"],
        "allocated_minutes": 60,
        "follow_up_frequency": "weekly"
    }
    
    response = client.post("/api/tasks/", json=task_data)
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


def test_create_task_category_pillar_mismatch(setup_test_data):
    """Test creating task where category doesn't belong to pillar"""
    test_data = setup_test_data
    
    # Create another pillar
    db = TestingSessionLocal()
    pillar2 = Pillar(name="Calmness", allocated_hours=8.0)
    db.add(pillar2)
    db.commit()
    db.refresh(pillar2)
    db.close()
    
    task_data = {
        "name": "Mismatched Task",
        "pillar_id": pillar2.id,
        "category_id": test_data["category_id"],  # Belongs to Hard Work
        "allocated_minutes": 60,
        "follow_up_frequency": "weekly"
    }
    
    response = client.post("/api/tasks/", json=task_data)
    assert response.status_code == 400
    assert "does not belong" in response.json()["detail"].lower()


def test_get_all_tasks(setup_test_data):
    """Test getting all tasks"""
    test_data = setup_test_data
    
    # Create multiple tasks
    for i in range(3):
        task_data = {
            "name": f"Task {i+1}",
            "pillar_id": test_data["pillar_id"],
            "category_id": test_data["category_id"],
            "allocated_minutes": 60,
            "follow_up_frequency": "weekly"
        }
        client.post("/api/tasks/", json=task_data)
    
    response = client.get("/api/tasks/")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) >= 3


def test_get_tasks_with_filters(setup_test_data):
    """Test getting tasks with filtering"""
    test_data = setup_test_data
    
    # Create tasks with different frequencies
    frequencies = ["today", "weekly", "monthly"]
    for freq in frequencies:
        task_data = {
            "name": f"Task {freq}",
            "pillar_id": test_data["pillar_id"],
            "category_id": test_data["category_id"],
            "allocated_minutes": 60,
            "follow_up_frequency": freq
        }
        client.post("/api/tasks/", json=task_data)
    
    # Filter by frequency
    response = client.get("/api/tasks/?follow_up_frequency=weekly")
    assert response.status_code == 200
    
    data = response.json()
    assert all(task["follow_up_frequency"] == "weekly" for task in data)


def test_get_task_by_id(setup_test_data):
    """Test getting a specific task by ID"""
    test_data = setup_test_data
    
    # Create task
    task_data = {
        "name": "Specific Task",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "allocated_minutes": 90,
        "follow_up_frequency": "monthly"
    }
    
    create_response = client.post("/api/tasks/", json=task_data)
    task_id = create_response.json()["id"]
    
    # Get task
    response = client.get(f"/api/tasks/{task_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["name"] == "Specific Task"
    assert data["allocated_minutes"] == 90


def test_get_task_with_stats(setup_test_data):
    """Test getting task with statistics"""
    test_data = setup_test_data
    
    # Create task
    task_data = {
        "name": "Stats Task",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "sub_category_id": test_data["sub_category_id"],
        "goal_id": test_data["goal_id"],
        "allocated_minutes": 120,
        "follow_up_frequency": "weekly"
    }
    
    create_response = client.post("/api/tasks/", json=task_data)
    task_id = create_response.json()["id"]
    
    # Get stats
    response = client.get(f"/api/tasks/{task_id}/stats")
    assert response.status_code == 200
    
    data = response.json()
    assert data["pillar_name"] == "Hard Work"
    assert data["category_name"] == "Professional Development"
    assert data["sub_category_name"] == "Python Programming"
    assert data["goal_name"] == "Master FastAPI"
    assert data["completion_percentage"] == 0.0


def test_update_task(setup_test_data):
    """Test updating a task"""
    test_data = setup_test_data
    
    # Create task
    task_data = {
        "name": "Original Task",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "allocated_minutes": 60,
        "follow_up_frequency": "weekly"
    }
    
    create_response = client.post("/api/tasks/", json=task_data)
    task_id = create_response.json()["id"]
    
    # Update task
    update_data = {
        "name": "Updated Task",
        "allocated_minutes": 90,
        "follow_up_frequency": "monthly"
    }
    
    response = client.put(f"/api/tasks/{task_id}", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["name"] == "Updated Task"
    assert data["allocated_minutes"] == 90
    assert data["follow_up_frequency"] == "monthly"


def test_mark_task_completed(setup_test_data):
    """Test marking a task as completed"""
    test_data = setup_test_data
    
    # Create task
    task_data = {
        "name": "Task to Complete",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "allocated_minutes": 60,
        "follow_up_frequency": "one_time"
    }
    
    create_response = client.post("/api/tasks/", json=task_data)
    task_id = create_response.json()["id"]
    
    # Mark completed
    response = client.post(f"/api/tasks/{task_id}/complete")
    assert response.status_code == 200
    
    data = response.json()
    assert data["is_completed"] is True
    assert data["completed_at"] is not None


def test_delete_task(setup_test_data):
    """Test deleting a task"""
    test_data = setup_test_data
    
    # Create task
    task_data = {
        "name": "Task to Delete",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "allocated_minutes": 60,
        "follow_up_frequency": "weekly"
    }
    
    create_response = client.post("/api/tasks/", json=task_data)
    task_id = create_response.json()["id"]
    
    # Delete task
    response = client.delete(f"/api/tasks/{task_id}")
    assert response.status_code == 204
    
    # Verify deletion
    get_response = client.get(f"/api/tasks/{task_id}")
    assert get_response.status_code == 404


def test_get_tasks_summary_by_pillar(setup_test_data):
    """Test getting task summary for a pillar"""
    test_data = setup_test_data
    
    # Create tasks with different frequencies
    frequencies = ["today", "weekly", "monthly", "quarterly"]
    for freq in frequencies:
        task_data = {
            "name": f"Task {freq}",
            "pillar_id": test_data["pillar_id"],
            "category_id": test_data["category_id"],
            "allocated_minutes": 60,
            "follow_up_frequency": freq
        }
        client.post("/api/tasks/", json=task_data)
    
    response = client.get(f"/api/tasks/by-pillar/{test_data['pillar_id']}/summary")
    assert response.status_code == 200
    
    data = response.json()
    assert data["pillar_id"] == test_data["pillar_id"]
    assert data["total_tasks"] >= 4
    assert "by_frequency" in data
    assert len(data["by_frequency"]) >= 4


def test_get_tasks_summary_by_category(setup_test_data):
    """Test getting task summary for a category"""
    test_data = setup_test_data
    
    # Create tasks
    for i in range(3):
        task_data = {
            "name": f"Category Task {i+1}",
            "pillar_id": test_data["pillar_id"],
            "category_id": test_data["category_id"],
            "allocated_minutes": 30 + (i * 15),
            "follow_up_frequency": "weekly"
        }
        client.post("/api/tasks/", json=task_data)
    
    response = client.get(f"/api/tasks/by-category/{test_data['category_id']}/summary")
    assert response.status_code == 200
    
    data = response.json()
    assert data["category_id"] == test_data["category_id"]
    assert data["total_tasks"] >= 3


def test_task_with_all_follow_up_frequencies(setup_test_data):
    """Test creating tasks with all follow-up frequencies"""
    test_data = setup_test_data
    
    frequencies = ["today", "weekly", "monthly", "quarterly", "yearly", "one_time"]
    
    for freq in frequencies:
        task_data = {
            "name": f"Task {freq}",
            "pillar_id": test_data["pillar_id"],
            "category_id": test_data["category_id"],
            "allocated_minutes": 60,
            "follow_up_frequency": freq
        }
        
        response = client.post("/api/tasks/", json=task_data)
        assert response.status_code == 201
        assert response.json()["follow_up_frequency"] == freq


def test_task_with_separately_followed(setup_test_data):
    """Test creating task with separately_followed flag"""
    test_data = setup_test_data
    
    task_data = {
        "name": "No Time Bound Task",
        "pillar_id": test_data["pillar_id"],
        "category_id": test_data["category_id"],
        "allocated_minutes": 60,
        "follow_up_frequency": "weekly",
        "separately_followed": True
    }
    
    response = client.post("/api/tasks/", json=task_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["separately_followed"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
