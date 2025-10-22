"""
Test cases for Category and SubCategory API endpoints
Run with: PYTHONPATH=. pytest backend/tests/test_categories.py -v
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database.config import Base, get_db
from app.models.models import Pillar, Category, SubCategory

# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_categories.db"
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


@pytest.fixture(scope="function")
def test_db():
    """Create fresh database for each test"""
    Base.metadata.create_all(bind=engine)
    # Create test pillar
    db = TestingSessionLocal()
    pillar = Pillar(name="Hard Work", allocated_hours=8.0)
    db.add(pillar)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


# ============= CATEGORY TESTS =============

def test_create_category(test_db):
    """Test creating a new category"""
    category_data = {
        "name": "Professional Development",
        "description": "Career growth",
        "pillar_id": 1,
        "allocated_hours": 4.0,
        "color_code": "#2563EB"
    }
    response = client.post("/api/categories/", json=category_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Professional Development"
    assert data["allocated_hours"] == 4.0
    assert "id" in data


def test_create_category_duplicate_name(test_db):
    """Test creating duplicate category in same pillar"""
    category_data = {"name": "Test Category", "pillar_id": 1, "allocated_hours": 2.0}
    client.post("/api/categories/", json=category_data)
    response = client.post("/api/categories/", json=category_data)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_create_category_exceeds_pillar_allocation(test_db):
    """Test that category allocation doesn't exceed pillar's 8 hours"""
    categories = [
        {"name": "Category 1", "pillar_id": 1, "allocated_hours": 5.0},
        {"name": "Category 2", "pillar_id": 1, "allocated_hours": 4.0}
    ]
    
    # First category should succeed
    response1 = client.post("/api/categories/", json=categories[0])
    assert response1.status_code == 201
    
    # Second category should fail (5+4=9 > 8)
    response2 = client.post("/api/categories/", json=categories[1])
    assert response2.status_code == 400
    assert "8.0 hours" in response2.json()["detail"] or "exceed" in response2.json()["detail"]


def test_get_all_categories(test_db):
    """Test getting all categories"""
    # Create two categories
    client.post("/api/categories/", json={"name": "Cat1", "pillar_id": 1, "allocated_hours": 3.0})
    client.post("/api/categories/", json={"name": "Cat2", "pillar_id": 1, "allocated_hours": 2.0})
    
    response = client.get("/api/categories/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_get_categories_filtered_by_pillar(test_db):
    """Test filtering categories by pillar"""
    client.post("/api/categories/", json={"name": "Cat1", "pillar_id": 1, "allocated_hours": 3.0})
    
    response = client.get("/api/categories/?pillar_id=1")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["pillar_id"] == 1


def test_get_category_by_id(test_db):
    """Test getting a specific category"""
    create_response = client.post("/api/categories/", json={"name": "Test", "pillar_id": 1, "allocated_hours": 2.0})
    category_id = create_response.json()["id"]
    
    response = client.get(f"/api/categories/{category_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Test"


def test_get_category_with_stats(test_db):
    """Test getting category with statistics"""
    create_response = client.post("/api/categories/", json={"name": "Test", "pillar_id": 1, "allocated_hours": 2.0})
    category_id = create_response.json()["id"]
    
    response = client.get(f"/api/categories/{category_id}/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_sub_categories" in data
    assert "total_tasks" in data
    assert "pillar_name" in data
    assert data["pillar_name"] == "Hard Work"


def test_update_category(test_db):
    """Test updating a category"""
    create_response = client.post("/api/categories/", json={"name": "Test", "pillar_id": 1, "allocated_hours": 2.0})
    category_id = create_response.json()["id"]
    
    update_data = {"description": "Updated description"}
    response = client.put(f"/api/categories/{category_id}", json=update_data)
    assert response.status_code == 200
    assert response.json()["description"] == "Updated description"


def test_delete_category(test_db):
    """Test deleting a category"""
    create_response = client.post("/api/categories/", json={"name": "Test", "pillar_id": 1, "allocated_hours": 2.0})
    category_id = create_response.json()["id"]
    
    response = client.delete(f"/api/categories/{category_id}")
    assert response.status_code == 204
    
    get_response = client.get(f"/api/categories/{category_id}")
    assert get_response.status_code == 404


def test_validate_pillar_categories(test_db):
    """Test validation of category allocations within a pillar"""
    client.post("/api/categories/", json={"name": "Cat1", "pillar_id": 1, "allocated_hours": 4.0})
    client.post("/api/categories/", json={"name": "Cat2", "pillar_id": 1, "allocated_hours": 4.0})
    
    response = client.get("/api/categories/validate/1")
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is True
    assert data["total_allocated"] == 8.0


# ============= SUB-CATEGORY TESTS =============

def test_create_sub_category(test_db):
    """Test creating a new sub-category"""
    # Create parent category first
    cat_response = client.post("/api/categories/", json={"name": "Category", "pillar_id": 1, "allocated_hours": 4.0})
    category_id = cat_response.json()["id"]
    
    sub_cat_data = {
        "name": "Python Programming",
        "description": "Learning Python",
        "category_id": category_id,
        "allocated_hours": 2.0
    }
    response = client.post("/api/sub-categories/", json=sub_cat_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Python Programming"
    assert data["allocated_hours"] == 2.0


def test_create_sub_category_exceeds_category_allocation(test_db):
    """Test that sub-category allocation doesn't exceed category's hours"""
    cat_response = client.post("/api/categories/", json={"name": "Category", "pillar_id": 1, "allocated_hours": 4.0})
    category_id = cat_response.json()["id"]
    
    # First sub-category
    client.post("/api/sub-categories/", json={"name": "SubCat1", "category_id": category_id, "allocated_hours": 3.0})
    
    # Second sub-category should fail (3+2=5 > 4)
    response = client.post("/api/sub-categories/", json={"name": "SubCat2", "category_id": category_id, "allocated_hours": 2.0})
    assert response.status_code == 400
    assert "4 hours" in response.json()["detail"] or "4.0 hours" in response.json()["detail"]


def test_get_sub_category_with_stats(test_db):
    """Test getting sub-category with full hierarchy"""
    cat_response = client.post("/api/categories/", json={"name": "Category", "pillar_id": 1, "allocated_hours": 4.0})
    category_id = cat_response.json()["id"]
    
    subcat_response = client.post("/api/sub-categories/", json={"name": "SubCat", "category_id": category_id, "allocated_hours": 2.0})
    subcat_id = subcat_response.json()["id"]
    
    response = client.get(f"/api/sub-categories/{subcat_id}/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["category_name"] == "Category"
    assert data["pillar_name"] == "Hard Work"
    assert "total_tasks" in data


def test_delete_sub_category(test_db):
    """Test deleting a sub-category"""
    cat_response = client.post("/api/categories/", json={"name": "Category", "pillar_id": 1, "allocated_hours": 4.0})
    category_id = cat_response.json()["id"]
    
    subcat_response = client.post("/api/sub-categories/", json={"name": "SubCat", "category_id": category_id, "allocated_hours": 2.0})
    subcat_id = subcat_response.json()["id"]
    
    response = client.delete(f"/api/sub-categories/{subcat_id}")
    assert response.status_code == 204
