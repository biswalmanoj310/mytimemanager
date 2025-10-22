"""
API routes for Pillar operations
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database.config import get_db
from app.models.schemas import (
    PillarCreate, PillarUpdate, PillarResponse, PillarWithStats,
    TimeAllocationValidation, DashboardStats, PillarStatistics
)
from app.services.pillar_service import PillarService

router = APIRouter()


@router.get("/", response_model=List[PillarResponse])
def get_all_pillars(db: Session = Depends(get_db)):
    """
    Get all pillars
    
    Returns a list of all pillars in the system.
    """
    pillars = PillarService.get_all_pillars(db)
    return pillars


@router.get("/stats", response_model=List[PillarWithStats])
def get_all_pillars_with_stats(db: Session = Depends(get_db)):
    """
    Get all pillars with statistics
    
    Returns a list of all pillars with usage statistics including:
    - Total categories
    - Total tasks
    - Total goals
    - Total spent hours
    """
    pillars = PillarService.get_all_pillars(db)
    result = []
    
    for pillar in pillars:
        stats = PillarService.get_pillar_with_stats(db, pillar.id)
        result.append(stats)
    
    return result


@router.get("/validate", response_model=TimeAllocationValidation)
def validate_total_allocation(db: Session = Depends(get_db)):
    """
    Validate that total pillar allocation equals 24 hours
    
    Returns validation status and details about current allocation.
    """
    validation = PillarService.validate_total_allocation(db)
    return validation


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Get overall dashboard statistics for all pillars
    
    Returns comprehensive statistics including:
    - Total pillars
    - Total hours allocated
    - Total hours spent
    - Percentage utilized
    - Per-pillar breakdown
    """
    pillars = PillarService.get_all_pillars(db)
    
    total_spent = 0.0
    pillars_breakdown = []
    
    for pillar in pillars:
        stats = PillarService.get_pillar_statistics(db, pillar.id)
        if stats:
            pillars_breakdown.append(stats)
            total_spent += stats.spent_hours
    
    percentage_utilized = (total_spent / 24.0) * 100 if total_spent > 0 else 0.0
    
    return DashboardStats(
        total_pillars=len(pillars),
        total_hours_allocated=24.0,
        total_hours_spent=round(total_spent, 2),
        percentage_utilized=round(percentage_utilized, 2),
        pillars_breakdown=pillars_breakdown
    )


@router.get("/{pillar_id}", response_model=PillarResponse)
def get_pillar(pillar_id: int, db: Session = Depends(get_db)):
    """
    Get a specific pillar by ID
    
    Args:
        pillar_id: ID of the pillar to retrieve
        
    Returns:
        Pillar details
        
    Raises:
        404: If pillar not found
    """
    pillar = PillarService.get_pillar_by_id(db, pillar_id)
    if not pillar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pillar with ID {pillar_id} not found"
        )
    return pillar


@router.get("/{pillar_id}/stats", response_model=PillarWithStats)
def get_pillar_with_stats(pillar_id: int, db: Session = Depends(get_db)):
    """
    Get a specific pillar with statistics
    
    Args:
        pillar_id: ID of the pillar to retrieve
        
    Returns:
        Pillar details with statistics
        
    Raises:
        404: If pillar not found
    """
    stats = PillarService.get_pillar_with_stats(db, pillar_id)
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pillar with ID {pillar_id} not found"
        )
    return stats


@router.post("/", response_model=PillarResponse, status_code=status.HTTP_201_CREATED)
def create_pillar(pillar: PillarCreate, db: Session = Depends(get_db)):
    """
    Create a new pillar
    
    Args:
        pillar: Pillar data to create
        
    Returns:
        Created pillar details
        
    Raises:
        400: If validation fails (duplicate name or exceeds 24-hour limit)
    """
    try:
        new_pillar = PillarService.create_pillar(db, pillar)
        return new_pillar
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{pillar_id}", response_model=PillarResponse)
def update_pillar(
    pillar_id: int, 
    pillar_update: PillarUpdate, 
    db: Session = Depends(get_db)
):
    """
    Update a pillar
    
    Args:
        pillar_id: ID of the pillar to update
        pillar_update: Updated pillar data
        
    Returns:
        Updated pillar details
        
    Raises:
        404: If pillar not found
        400: If validation fails
    """
    try:
        updated_pillar = PillarService.update_pillar(db, pillar_id, pillar_update)
        return updated_pillar
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


@router.delete("/{pillar_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pillar(pillar_id: int, db: Session = Depends(get_db)):
    """
    Delete a pillar
    
    Args:
        pillar_id: ID of the pillar to delete
        
    Raises:
        404: If pillar not found
        400: If pillar has dependencies (categories)
    """
    try:
        PillarService.delete_pillar(db, pillar_id)
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
