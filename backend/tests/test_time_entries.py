"""
Tests for Time Entry API
Comprehensive tests for time tracking with 30-minute slot validation
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, date, timedelta

from app.main import app
from app.database.config import Base, get_db
from app.models.models import Pillar, Category, SubCategory, Task, TimeEntry


# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_time_entries.db"
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
    db.query(TimeEntry).delete()
    db.query(Task).delete()
    db.query(SubCategory).delete()
    db.query(Category).delete()
    db.query(Pillar).delete()
    
    # Create test pillar
    pillar = Pillar(name="Hard Work", allocated_hours=8.0, icon="💼")
    db.add(pillar)
    db.commit()
    db.refresh(pillar)
    
    # Create test category
    category = Category(
        name="Professional Development",
        pillar_id=pillar.id,
        allocated_hours=4.0
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    
    # Create test task
    task = Task(
        name="Study FastAPI",
        pillar_id=pillar.id,
        category_id=category.id,
        allocated_minutes=120,
        spent_minutes=0,
        follow_up_frequency="weekly",
        is_part_of_goal=False
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # Store IDs
    test_data = {
        "pillar_id": pillar.id,
        "category_id": category.id,
        "task_id": task.id
    }
    
    db.close()
    
    yield test_data


def test_create_time_entry_valid(setup_test_data):
    """Test creating a valid time entry with 30-minute duration"""
    test_data = setup_test_data
    
    start_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(minutes=30)
    
    response = client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["task_id"] == test_data["task_id"]
    assert data["duration_minutes"] == 30


def test_create_time_entry_60_minutes(setup_test_data):
    """Test creating a 60-minute time entry"""
    test_data = setup_test_data
    
    start_time = datetime.now().replace(hour=10, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(minutes=60)
    
    response = client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "notes": "Focused study session"
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["duration_minutes"] == 60
    assert data["notes"] == "Focused study session"


def test_create_time_entry_invalid_duration(setup_test_data):
    """Test that non-30-minute increments are rejected"""
    test_data = setup_test_data
    
    start_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(minutes=45)  # 45 minutes - invalid
    
    response = client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
    )
    
    assert response.status_code == 400
    assert "30-minute increments" in response.json()["detail"]


def test_create_time_entry_end_before_start(setup_test_data):
    """Test that end time before start time is rejected"""
    test_data = setup_test_data
    
    start_time = datetime.now().replace(hour=10, minute=0, second=0, microsecond=0)
    end_time = start_time - timedelta(minutes=30)
    
    response = client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
    )
    
    assert response.status_code == 400
    assert "after start time" in response.json()["detail"]


def test_create_time_entry_overlap(setup_test_data):
    """Test that overlapping time entries are rejected"""
    test_data = setup_test_data
    
    # Create first entry
    start_time1 = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    end_time1 = start_time1 + timedelta(minutes=60)
    
    response1 = client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time1.isoformat(),
            "end_time": end_time1.isoformat()
        }
    )
    assert response1.status_code == 201
    
    # Try to create overlapping entry
    start_time2 = start_time1 + timedelta(minutes=30)
    end_time2 = start_time2 + timedelta(minutes=60)
    
    response2 = client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time2.isoformat(),
            "end_time": end_time2.isoformat()
        }
    )
    
    assert response2.status_code == 400
    assert "overlaps" in response2.json()["detail"]


def test_create_time_entry_invalid_task(setup_test_data):
    """Test creating time entry for non-existent task"""
    start_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(minutes=30)
    
    response = client.post(
        "/api/time-entries/",
        json={
            "task_id": 99999,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
    )
    
    assert response.status_code == 404


def test_get_all_time_entries(setup_test_data):
    """Test getting all time entries"""
    test_data = setup_test_data
    
    # Create multiple entries
    base_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    
    for i in range(3):
        start_time = base_time + timedelta(hours=i*2)
        end_time = start_time + timedelta(minutes=30)
        
        client.post(
            "/api/time-entries/",
            json={
                "task_id": test_data["task_id"],
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat()
            }
        )
    
    response = client.get("/api/time-entries/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3


def test_get_time_entry_by_id(setup_test_data):
    """Test getting a specific time entry"""
    test_data = setup_test_data
    
    start_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(minutes=30)
    
    create_response = client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
    )
    entry_id = create_response.json()["id"]
    
    response = client.get(f"/api/time-entries/{entry_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == entry_id


def test_update_time_entry(setup_test_data):
    """Test updating a time entry"""
    test_data = setup_test_data
    
    start_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(minutes=30)
    
    create_response = client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
    )
    entry_id = create_response.json()["id"]
    
    # Update to 60 minutes
    new_end_time = start_time + timedelta(minutes=60)
    
    response = client.put(
        f"/api/time-entries/{entry_id}",
        json={
            "end_time": new_end_time.isoformat(),
            "notes": "Extended session"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["duration_minutes"] == 60
    assert data["notes"] == "Extended session"


def test_delete_time_entry(setup_test_data):
    """Test deleting a time entry"""
    test_data = setup_test_data
    
    start_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(minutes=30)
    
    create_response = client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
    )
    entry_id = create_response.json()["id"]
    
    response = client.delete(f"/api/time-entries/{entry_id}")
    assert response.status_code == 200
    
    # Verify deletion
    get_response = client.get(f"/api/time-entries/{entry_id}")
    assert get_response.status_code == 404


def test_get_daily_grid(setup_test_data):
    """Test getting daily time grid"""
    test_data = setup_test_data
    
    target_date = date.today()
    start_time = datetime.combine(target_date, datetime.min.time().replace(hour=9))
    end_time = start_time + timedelta(minutes=30)
    
    # Create an entry
    client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
    )
    
    response = client.get(f"/api/time-entries/grid/daily?target_date={target_date.isoformat()}")
    assert response.status_code == 200
    
    data = response.json()
    assert "slots" in data
    assert len(data["slots"]) == 48  # 24 hours * 2 (30-minute slots)
    assert data["total_entries"] == 1
    assert data["total_minutes"] == 30


def test_get_week_summary(setup_test_data):
    """Test getting weekly summary"""
    test_data = setup_test_data
    
    # Get Monday of current week
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    
    # Create entries for different days
    for i in range(3):
        day = start_of_week + timedelta(days=i)
        start_time = datetime.combine(day, datetime.min.time().replace(hour=9))
        end_time = start_time + timedelta(minutes=60)
        
        client.post(
            "/api/time-entries/",
            json={
                "task_id": test_data["task_id"],
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat()
            }
        )
    
    response = client.get(f"/api/time-entries/summary/week?start_date={start_of_week.isoformat()}")
    assert response.status_code == 200
    
    data = response.json()
    assert "by_pillar" in data
    assert "by_day" in data
    assert data["total_entries"] == 3
    assert data["total_minutes"] == 180
    assert data["total_hours"] == 3.0


def test_get_statistics(setup_test_data):
    """Test getting comprehensive statistics"""
    test_data = setup_test_data
    
    # Create multiple entries
    base_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    
    for i in range(4):
        start_time = base_time + timedelta(hours=i*2)
        end_time = start_time + timedelta(minutes=30)
        
        client.post(
            "/api/time-entries/",
            json={
                "task_id": test_data["task_id"],
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat()
            }
        )
    
    response = client.get("/api/time-entries/statistics/overview")
    assert response.status_code == 200
    
    data = response.json()
    assert data["total_entries"] == 4
    assert data["total_minutes"] == 120
    assert data["total_hours"] == 2.0
    assert "by_pillar" in data
    assert "by_category" in data
    assert "by_task" in data
    assert data["average_duration"] == 30.0


def test_filter_by_task(setup_test_data):
    """Test filtering time entries by task"""
    test_data = setup_test_data
    
    # Create entries
    start_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(minutes=30)
    
    client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
    )
    
    response = client.get(f"/api/time-entries/?task_id={test_data['task_id']}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["task_id"] == test_data["task_id"]


def test_filter_by_date_range(setup_test_data):
    """Test filtering time entries by date range"""
    test_data = setup_test_data
    
    today = date.today()
    tomorrow = today + timedelta(days=1)
    
    # Create entry for today
    start_time = datetime.combine(today, datetime.min.time().replace(hour=9))
    end_time = start_time + timedelta(minutes=30)
    
    client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
    )
    
    # Create entry for tomorrow
    start_time2 = datetime.combine(tomorrow, datetime.min.time().replace(hour=10))
    end_time2 = start_time2 + timedelta(minutes=30)
    
    client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time2.isoformat(),
            "end_time": end_time2.isoformat()
        }
    )
    
    # Filter for today only
    response = client.get(f"/api/time-entries/?start_date={today.isoformat()}&end_date={today.isoformat()}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1


def test_task_spent_time_updates(setup_test_data):
    """Test that task spent time is updated when creating time entries"""
    test_data = setup_test_data
    
    start_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(minutes=60)
    
    # Create time entry
    client.post(
        "/api/time-entries/",
        json={
            "task_id": test_data["task_id"],
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }
    )
    
    # Check task spent time
    task_response = client.get(f"/api/tasks/{test_data['task_id']}")
    assert task_response.status_code == 200
    task_data = task_response.json()
    assert task_data["spent_minutes"] == 60


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
