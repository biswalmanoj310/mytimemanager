"""
Time Block Routes
API endpoints for managing custom time block configurations
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from datetime import datetime

from app.database.config import get_db
from pydantic import BaseModel

router = APIRouter()

# Pydantic Schemas
class TimeBlockCreate(BaseModel):
    block_order: int
    start_hour: int
    end_hour: int
    label: str = None
    color_code: str = "#3b82f6"

class TimeBlockResponse(BaseModel):
    id: int
    config_id: int
    block_order: int
    start_hour: int
    end_hour: int
    label: str = None
    color_code: str
    
    class Config:
        from_attributes = True

class TimeBlockConfigCreate(BaseModel):
    profile_name: str
    config_name: str
    time_format: str = "24h"  # "24h" or "12h"
    blocks: List[TimeBlockCreate]

class TimeBlockConfigUpdate(BaseModel):
    config_name: str = None
    is_active: bool = None
    time_format: str = None
    blocks: List[TimeBlockCreate] = None

class TimeBlockConfigResponse(BaseModel):
    id: int
    profile_name: str
    config_name: str
    is_active: bool
    time_format: str
    created_at: datetime
    updated_at: datetime
    blocks: List[TimeBlockResponse]
    
    class Config:
        from_attributes = True

# Get all configs for current profile
@router.get("/configs", response_model=List[TimeBlockConfigResponse])
def get_time_block_configs(
    profile_name: str = "production",
    db: Session = Depends(get_db)
):
    """Get all time block configurations for a profile"""
    cursor = db.execute(
        text("SELECT * FROM time_block_configs WHERE profile_name = :profile ORDER BY created_at DESC"),
        {"profile": profile_name}
    )
    configs = cursor.fetchall()
    
    result = []
    for config in configs:
        # Get blocks for this config
        blocks_cursor = db.execute(
            text("SELECT * FROM time_blocks WHERE config_id = :config_id ORDER BY block_order"),
            {"config_id": config[0]}
        )
        blocks = [
            {
                "id": b[0],
                "config_id": b[1],
                "block_order": b[2],
                "start_hour": b[3],
                "end_hour": b[4],
                "label": b[5],
                "color_code": b[6]
            }
            for b in blocks_cursor.fetchall()
        ]
        
        result.append({
            "id": config[0],
            "profile_name": config[1],
            "config_name": config[2],
            "is_active": bool(config[3]),
            "time_format": config[4],
            "created_at": config[5],
            "updated_at": config[6],
            "blocks": blocks
        })
    
    return result

# Get active config
@router.get("/configs/active", response_model=TimeBlockConfigResponse)
def get_active_config(
    profile_name: str = "production",
    db: Session = Depends(get_db)
):
    """Get the active time block configuration"""
    cursor = db.execute(
        text("SELECT * FROM time_block_configs WHERE profile_name = :profile AND is_active = 1 LIMIT 1"),
        {"profile": profile_name}
    )
    config = cursor.fetchone()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active configuration found"
        )
    
    # Get blocks
    blocks_cursor = db.execute(
        text("SELECT * FROM time_blocks WHERE config_id = :config_id ORDER BY block_order"),
        {"config_id": config[0]}
    )
    blocks = [
        {
            "id": b[0],
            "config_id": b[1],
            "block_order": b[2],
            "start_hour": b[3],
            "end_hour": b[4],
            "label": b[5],
            "color_code": b[6]
        }
        for b in blocks_cursor.fetchall()
    ]
    
    return {
        "id": config[0],
        "profile_name": config[1],
        "config_name": config[2],
        "is_active": bool(config[3]),
        "time_format": config[4],
        "created_at": config[5],
        "updated_at": config[6],
        "blocks": blocks
    }

# Create new config
@router.post("/configs", response_model=TimeBlockConfigResponse, status_code=status.HTTP_201_CREATED)
def create_time_block_config(
    config: TimeBlockConfigCreate,
    db: Session = Depends(get_db)
):
    """Create a new time block configuration"""
    try:
        # Insert config
        cursor = db.execute(
            text("""INSERT INTO time_block_configs 
               (profile_name, config_name, is_active, time_format, updated_at) 
               VALUES (:profile, :name, 0, :format, CURRENT_TIMESTAMP)"""),
            {"profile": config.profile_name, "name": config.config_name, "format": config.time_format}
        )
        config_id = cursor.lastrowid
        
        # Insert blocks
        for block in config.blocks:
            db.execute(
                text("""INSERT INTO time_blocks 
                   (config_id, block_order, start_hour, end_hour, label, color_code) 
                   VALUES (:config_id, :order, :start, :end, :label, :color)"""),
                {"config_id": config_id, "order": block.block_order, "start": block.start_hour, 
                 "end": block.end_hour, "label": block.label, "color": block.color_code}
            )
        
        db.commit()
        
        # Return created config
        return get_time_block_configs(config.profile_name, db)[0]
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Update config
@router.put("/configs/{config_id}", response_model=TimeBlockConfigResponse)
def update_time_block_config(
    config_id: int,
    config_update: TimeBlockConfigUpdate,
    db: Session = Depends(get_db)
):
    """Update a time block configuration"""
    try:
        # Check if config exists
        cursor = db.execute(text("SELECT * FROM time_block_configs WHERE id = :id"), {"id": config_id})
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Configuration not found"
            )
        
        profile_name = existing[1]
        
        # If setting to active, deactivate others
        if config_update.is_active:
            db.execute(
                text("UPDATE time_block_configs SET is_active = 0 WHERE profile_name = :profile"),
                {"profile": profile_name}
            )
        
        # Update config
        params = {"id": config_id}
        
        if config_update.config_name is not None:
            db.execute(
                text("UPDATE time_block_configs SET config_name = :name, updated_at = CURRENT_TIMESTAMP WHERE id = :id"),
                {"name": config_update.config_name, "id": config_id}
            )
        
        if config_update.is_active is not None:
            db.execute(
                text("UPDATE time_block_configs SET is_active = :active, updated_at = CURRENT_TIMESTAMP WHERE id = :id"),
                {"active": 1 if config_update.is_active else 0, "id": config_id}
            )
        
        if config_update.time_format is not None:
            db.execute(
                text("UPDATE time_block_configs SET time_format = :format, updated_at = CURRENT_TIMESTAMP WHERE id = :id"),
                {"format": config_update.time_format, "id": config_id}
            )
        
        # Update blocks if provided
        if config_update.blocks is not None:
            # Delete existing blocks
            db.execute(text("DELETE FROM time_blocks WHERE config_id = :id"), {"id": config_id})
            
            # Insert new blocks
            for block in config_update.blocks:
                db.execute(
                    text("""INSERT INTO time_blocks 
                       (config_id, block_order, start_hour, end_hour, label, color_code) 
                       VALUES (:config_id, :order, :start, :end, :label, :color)"""),
                    {"config_id": config_id, "order": block.block_order, "start": block.start_hour,
                     "end": block.end_hour, "label": block.label, "color": block.color_code}
                )
        
        db.commit()
        
        # Return updated config
        configs = get_time_block_configs(profile_name, db)
        return next(c for c in configs if c["id"] == config_id)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Delete config
@router.delete("/configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time_block_config(
    config_id: int,
    db: Session = Depends(get_db)
):
    """Delete a time block configuration"""
    # Check if it's the default/active config
    cursor = db.execute(
        text("SELECT is_active, config_name FROM time_block_configs WHERE id = :id"), 
        {"id": config_id}
    )
    config = cursor.fetchone()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    if config[1] == "Standard 24-hour":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the default Standard 24-hour configuration"
        )
    
    if config[0]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete active configuration. Activate another config first."
        )
    
    # Delete (CASCADE will delete blocks)
    db.execute(text("DELETE FROM time_block_configs WHERE id = :id"), {"id": config_id})
    db.commit()
    
    return None

# Get preset templates
@router.get("/templates")
def get_preset_templates():
    """Get preset time block templates"""
    return {
        "templates": [
            {
                "name": "Standard 24-hour",
                "description": "Hour-by-hour monitoring (default)",
                "time_format": "24h",
                "blocks": []  # Empty means use all 24 hours
            },
            {
                "name": "School Day",
                "description": "For students with 8 AM - 3 PM school hours",
                "time_format": "12h",
                "blocks": [
                    {"block_order": 1, "start_hour": 6, "end_hour": 8, "label": "Morning", "color_code": "#10b981"},
                    {"block_order": 2, "start_hour": 8, "end_hour": 15, "label": "School", "color_code": "#f59e0b"},
                    {"block_order": 3, "start_hour": 15, "end_hour": 17, "label": "After School", "color_code": "#3b82f6"},
                    {"block_order": 4, "start_hour": 17, "end_hour": 21, "label": "Family Time", "color_code": "#8b5cf6"},
                    {"block_order": 5, "start_hour": 21, "end_hour": 6, "label": "Sleep", "color_code": "#6b7280"}
                ]
            },
            {
                "name": "Standard Workday",
                "description": "For professionals with 9 AM - 5 PM work hours",
                "time_format": "12h",
                "blocks": [
                    {"block_order": 1, "start_hour": 6, "end_hour": 9, "label": "Morning", "color_code": "#10b981"},
                    {"block_order": 2, "start_hour": 9, "end_hour": 17, "label": "Work", "color_code": "#3b82f6"},
                    {"block_order": 3, "start_hour": 17, "end_hour": 21, "label": "Evening", "color_code": "#8b5cf6"},
                    {"block_order": 4, "start_hour": 21, "end_hour": 6, "label": "Sleep", "color_code": "#6b7280"}
                ]
            },
            {
                "name": "Teaching Day",
                "description": "For teachers with 7 AM - 3 PM teaching hours",
                "time_format": "12h",
                "blocks": [
                    {"block_order": 1, "start_hour": 6, "end_hour": 7, "label": "Morning Prep", "color_code": "#10b981"},
                    {"block_order": 2, "start_hour": 7, "end_hour": 15, "label": "Teaching", "color_code": "#f59e0b"},
                    {"block_order": 3, "start_hour": 15, "end_hour": 18, "label": "Grading/Admin", "color_code": "#3b82f6"},
                    {"block_order": 4, "start_hour": 18, "end_hour": 22, "label": "Family Time", "color_code": "#8b5cf6"},
                    {"block_order": 5, "start_hour": 22, "end_hour": 6, "label": "Sleep", "color_code": "#6b7280"}
                ]
            }
        ]
    }
