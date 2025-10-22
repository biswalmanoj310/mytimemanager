"""
API routes for Category operations
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.config import get_db
from app.models.schemas import (
    CategoryCreate, CategoryUpdate, CategoryResponse, CategoryWithStats,
    TimeAllocationValidation
)
from app.services.category_service import CategoryService

router = APIRouter()


@router.get("/", response_model=List[CategoryResponse])
def get_all_categories(
    pillar_id: Optional[int] = Query(None, description="Filter by pillar ID"),
    db: Session = Depends(get_db)
):
    """
    Get all categories, optionally filtered by pillar
    
    Args:
        pillar_id: Optional pillar ID to filter results
        
    Returns:
        List of categories
    """
    categories = CategoryService.get_all_categories(db, pillar_id=pillar_id)
    return categories


@router.get("/stats", response_model=List[CategoryWithStats])
def get_all_categories_with_stats(
    pillar_id: Optional[int] = Query(None, description="Filter by pillar ID"),
    db: Session = Depends(get_db)
):
    """
    Get all categories with statistics
    
    Args:
        pillar_id: Optional pillar ID to filter results
        
    Returns:
        List of categories with usage statistics
    """
    categories = CategoryService.get_all_categories(db, pillar_id=pillar_id)
    result = []
    
    for category in categories:
        stats = CategoryService.get_category_with_stats(db, category.id)
        if stats:
            result.append(stats)
    
    return result


@router.get("/validate/{pillar_id}", response_model=TimeAllocationValidation)
def validate_pillar_categories(pillar_id: int, db: Session = Depends(get_db)):
    """
    Validate that all categories within a pillar sum to pillar's allocated hours
    
    Args:
        pillar_id: ID of the pillar to validate
        
    Returns:
        Validation status and details
    """
    validation = CategoryService.validate_pillar_categories_total(db, pillar_id)
    return validation


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(category_id: int, db: Session = Depends(get_db)):
    """
    Get a specific category by ID
    
    Args:
        category_id: ID of the category to retrieve
        
    Returns:
        Category details
        
    Raises:
        404: If category not found
    """
    category = CategoryService.get_category_by_id(db, category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} not found"
        )
    return category


@router.get("/{category_id}/stats", response_model=CategoryWithStats)
def get_category_with_stats(category_id: int, db: Session = Depends(get_db)):
    """
    Get a specific category with statistics
    
    Args:
        category_id: ID of the category to retrieve
        
    Returns:
        Category details with statistics
        
    Raises:
        404: If category not found
    """
    stats = CategoryService.get_category_with_stats(db, category_id)
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} not found"
        )
    return stats


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    """
    Create a new category
    
    Args:
        category: Category data to create
        
    Returns:
        Created category details
        
    Raises:
        400: If validation fails (duplicate name or exceeds pillar allocation)
        404: If pillar not found
    """
    try:
        new_category = CategoryService.create_category(db, category)
        return new_category
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category_update: CategoryUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a category
    
    Args:
        category_id: ID of the category to update
        category_update: Updated category data
        
    Returns:
        Updated category details
        
    Raises:
        404: If category not found
        400: If validation fails
    """
    try:
        updated_category = CategoryService.update_category(db, category_id, category_update)
        return updated_category
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    """
    Delete a category
    
    Args:
        category_id: ID of the category to delete
        
    Raises:
        404: If category not found
        400: If category has dependencies (sub-categories or tasks)
    """
    try:
        CategoryService.delete_category(db, category_id)
        return None
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
