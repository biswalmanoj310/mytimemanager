"""
API routes for SubCategory operations
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.config import get_db
from app.models.schemas import (
    SubCategoryCreate, SubCategoryUpdate, SubCategoryResponse, SubCategoryWithStats
)
from app.services.sub_category_service import SubCategoryService

router = APIRouter()


@router.get("/", response_model=List[SubCategoryResponse])
def get_all_sub_categories(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    db: Session = Depends(get_db)
):
    """
    Get all sub-categories, optionally filtered by category
    
    Args:
        category_id: Optional category ID to filter results
        
    Returns:
        List of sub-categories
    """
    sub_categories = SubCategoryService.get_all_sub_categories(db, category_id=category_id)
    return sub_categories


@router.get("/stats", response_model=List[SubCategoryWithStats])
def get_all_sub_categories_with_stats(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    db: Session = Depends(get_db)
):
    """
    Get all sub-categories with statistics
    
    Args:
        category_id: Optional category ID to filter results
        
    Returns:
        List of sub-categories with usage statistics
    """
    sub_categories = SubCategoryService.get_all_sub_categories(db, category_id=category_id)
    result = []
    
    for sub_category in sub_categories:
        stats = SubCategoryService.get_sub_category_with_stats(db, sub_category.id)
        if stats:
            result.append(stats)
    
    return result


@router.get("/{sub_category_id}", response_model=SubCategoryResponse)
def get_sub_category(sub_category_id: int, db: Session = Depends(get_db)):
    """
    Get a specific sub-category by ID
    
    Args:
        sub_category_id: ID of the sub-category to retrieve
        
    Returns:
        Sub-category details
        
    Raises:
        404: If sub-category not found
    """
    sub_category = SubCategoryService.get_sub_category_by_id(db, sub_category_id)
    if not sub_category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-category with ID {sub_category_id} not found"
        )
    return sub_category


@router.get("/{sub_category_id}/stats", response_model=SubCategoryWithStats)
def get_sub_category_with_stats(sub_category_id: int, db: Session = Depends(get_db)):
    """
    Get a specific sub-category with statistics
    
    Args:
        sub_category_id: ID of the sub-category to retrieve
        
    Returns:
        Sub-category details with statistics
        
    Raises:
        404: If sub-category not found
    """
    stats = SubCategoryService.get_sub_category_with_stats(db, sub_category_id)
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-category with ID {sub_category_id} not found"
        )
    return stats


@router.post("/", response_model=SubCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_sub_category(sub_category: SubCategoryCreate, db: Session = Depends(get_db)):
    """
    Create a new sub-category
    
    Args:
        sub_category: Sub-category data to create
        
    Returns:
        Created sub-category details
        
    Raises:
        400: If validation fails (duplicate name or exceeds category allocation)
        404: If category not found
    """
    try:
        new_sub_category = SubCategoryService.create_sub_category(db, sub_category)
        return new_sub_category
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


@router.put("/{sub_category_id}", response_model=SubCategoryResponse)
def update_sub_category(
    sub_category_id: int,
    sub_category_update: SubCategoryUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a sub-category
    
    Args:
        sub_category_id: ID of the sub-category to update
        sub_category_update: Updated sub-category data
        
    Returns:
        Updated sub-category details
        
    Raises:
        404: If sub-category not found
        400: If validation fails
    """
    try:
        updated_sub_category = SubCategoryService.update_sub_category(db, sub_category_id, sub_category_update)
        return updated_sub_category
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


@router.delete("/{sub_category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sub_category(sub_category_id: int, db: Session = Depends(get_db)):
    """
    Delete a sub-category
    
    Args:
        sub_category_id: ID of the sub-category to delete
        
    Raises:
        404: If sub-category not found
        400: If sub-category has dependencies (tasks)
    """
    try:
        SubCategoryService.delete_sub_category(db, sub_category_id)
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
