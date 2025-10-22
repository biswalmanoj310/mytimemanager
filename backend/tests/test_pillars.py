"""
Test cases for Pillar API endpoints
Run with: pytest backend/tests/test_pillars.py -v
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database.config import Base, get_db
from app.models.models import Pillar

# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
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


@pytest.fixture(scope="function")
def test_db():
    """Create fresh database for each test"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_read_root():
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Welcome to MyTimeManager API"
    assert "pillars" in data


def test_get_empty_pillars(test_db):
    """Test getting pillars when database is empty"""
    response = client.get("/api/pillars/")
    assert response.status_code == 200
    assert response.json() == []


def test_create_pillar(test_db):
    """Test creating a new pillar"""
    pillar_data = {
        "name": "Hard Work",
        "description": "Professional development",
        "allocated_hours": 8.0,
        "color_code": "#3B82F6",
        "icon": "💼"
    }
    response = client.post("/api/pillars/", json=pillar_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Hard Work"
    assert data["allocated_hours"] == 8.0
    assert "id" in data


def test_create_duplicate_pillar(test_db):
    """Test creating a pillar with duplicate name"""
    pillar_data = {
        "name": "Hard Work",
        "description": "Professional development",
        "allocated_hours": 8.0
    }
    # Create first pillar
    client.post("/api/pillars/", json=pillar_data)
    
    # Try to create duplicate
    response = client.post("/api/pillars/", json=pillar_data)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_create_pillar_exceeds_24_hours(test_db):
    """Test that creating pillars doesn't exceed 24 hours total"""
    # Create three pillars with 8 hours each
    pillars = [
        {"name": "Hard Work", "allocated_hours": 8.0},
        {"name": "Calmness", "allocated_hours": 8.0},
        {"name": "Family", "allocated_hours": 8.0}
    ]
    
    for pillar in pillars:
        response = client.post("/api/pillars/", json=pillar)
        assert response.status_code == 201
    
    # Try to add a fourth pillar
    response = client.post("/api/pillars/", json={"name": "Extra", "allocated_hours": 1.0})
    assert response.status_code == 400
    assert "24 hours" in response.json()["detail"]


def test_get_pillar_by_id(test_db):
    """Test getting a specific pillar"""
    # Create a pillar
    pillar_data = {"name": "Hard Work", "allocated_hours": 8.0}
    create_response = client.post("/api/pillars/", json=pillar_data)
    pillar_id = create_response.json()["id"]
    
    # Get the pillar
    response = client.get(f"/api/pillars/{pillar_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == pillar_id
    assert data["name"] == "Hard Work"


def test_get_nonexistent_pillar(test_db):
    """Test getting a pillar that doesn't exist"""
    response = client.get("/api/pillars/999")
    assert response.status_code == 404


def test_update_pillar(test_db):
    """Test updating a pillar"""
    # Create a pillar
    pillar_data = {"name": "Hard Work", "allocated_hours": 8.0}
    create_response = client.post("/api/pillars/", json=pillar_data)
    pillar_id = create_response.json()["id"]
    
    # Update the pillar
    update_data = {"description": "Updated description", "color_code": "#FF0000"}
    response = client.put(f"/api/pillars/{pillar_id}", json=update_data)
    assert response.status_code == 200
    data = response.json()
    assert data["description"] == "Updated description"
    assert data["color_code"] == "#FF0000"
    assert data["name"] == "Hard Work"  # Unchanged


def test_update_pillar_hours_validation(test_db):
    """Test that updating hours respects 24-hour constraint"""
    # Create three pillars with 8 hours each
    pillars = [
        {"name": "Hard Work", "allocated_hours": 8.0},
        {"name": "Calmness", "allocated_hours": 8.0},
        {"name": "Family", "allocated_hours": 8.0}
    ]
    
    pillar_ids = []
    for pillar in pillars:
        response = client.post("/api/pillars/", json=pillar)
        pillar_ids.append(response.json()["id"])
    
    # Try to update first pillar to 10 hours (would make total 26)
    response = client.put(f"/api/pillars/{pillar_ids[0]}", json={"allocated_hours": 10.0})
    assert response.status_code == 400


def test_delete_pillar(test_db):
    """Test deleting a pillar"""
    # Create a pillar
    pillar_data = {"name": "Hard Work", "allocated_hours": 8.0}
    create_response = client.post("/api/pillars/", json=pillar_data)
    pillar_id = create_response.json()["id"]
    
    # Delete the pillar
    response = client.delete(f"/api/pillars/{pillar_id}")
    assert response.status_code == 204
    
    # Verify it's deleted
    get_response = client.get(f"/api/pillars/{pillar_id}")
    assert get_response.status_code == 404


def test_validate_allocation(test_db):
    """Test validation endpoint"""
    # Create three pillars with 8 hours each
    pillars = [
        {"name": "Hard Work", "allocated_hours": 8.0},
        {"name": "Calmness", "allocated_hours": 8.0},
        {"name": "Family", "allocated_hours": 8.0}
    ]
    
    for pillar in pillars:
        client.post("/api/pillars/", json=pillar)
    
    # Validate allocation
    response = client.get("/api/pillars/validate")
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is True
    assert data["total_allocated"] == 24.0


def test_dashboard_stats(test_db):
    """Test dashboard statistics endpoint"""
    # Create three pillars
    pillars = [
        {"name": "Hard Work", "allocated_hours": 8.0, "color_code": "#3B82F6"},
        {"name": "Calmness", "allocated_hours": 8.0, "color_code": "#10B981"},
        {"name": "Family", "allocated_hours": 8.0, "color_code": "#F59E0B"}
    ]
    
    for pillar in pillars:
        client.post("/api/pillars/", json=pillar)
    
    # Get dashboard stats
    response = client.get("/api/pillars/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["total_pillars"] == 3
    assert data["total_hours_allocated"] == 24.0
    assert data["total_hours_spent"] == 0.0
    assert len(data["pillars_breakdown"]) == 3


def test_pillar_with_stats(test_db):
    """Test getting pillar with statistics"""
    # Create a pillar
    pillar_data = {"name": "Hard Work", "allocated_hours": 8.0}
    create_response = client.post("/api/pillars/", json=pillar_data)
    pillar_id = create_response.json()["id"]
    
    # Get pillar with stats
    response = client.get(f"/api/pillars/{pillar_id}/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == pillar_id
    assert data["total_categories"] == 0
    assert data["total_tasks"] == 0
    assert data["total_goals"] == 0
