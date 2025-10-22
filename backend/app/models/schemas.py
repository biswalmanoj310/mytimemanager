"""
Pydantic schemas for API request/response validation
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from app.models.models import FollowUpFrequency, GoalTimePeriod


# ============= PILLAR SCHEMAS =============

class PillarBase(BaseModel):
    """Base schema for Pillar"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    allocated_hours: float = Field(default=8.0, ge=0, le=24)
    color_code: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: Optional[str] = Field(None, max_length=50)


class PillarCreate(PillarBase):
    """Schema for creating a new Pillar"""
    pass


class PillarUpdate(BaseModel):
    """Schema for updating a Pillar"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    allocated_hours: Optional[float] = Field(None, ge=0, le=24)
    color_code: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: Optional[str] = Field(None, max_length=50)


class PillarResponse(PillarBase):
    """Schema for Pillar response"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PillarWithStats(PillarResponse):
    """Pillar with usage statistics"""
    total_categories: int = 0
    total_tasks: int = 0
    total_goals: int = 0
    total_spent_hours: float = 0.0


# ============= CATEGORY SCHEMAS =============

class CategoryBase(BaseModel):
    """Base schema for Category"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    pillar_id: int = Field(..., gt=0)
    allocated_hours: float = Field(default=0.0, ge=0)
    color_code: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')


class CategoryCreate(CategoryBase):
    """Schema for creating a new Category"""
    pass


class CategoryUpdate(BaseModel):
    """Schema for updating a Category"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    pillar_id: Optional[int] = Field(None, gt=0)
    allocated_hours: Optional[float] = Field(None, ge=0)
    color_code: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')


class CategoryResponse(CategoryBase):
    """Schema for Category response"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CategoryWithStats(CategoryResponse):
    """Category with usage statistics"""
    total_sub_categories: int = 0
    total_tasks: int = 0
    total_spent_hours: float = 0.0
    pillar_name: Optional[str] = None


# ============= SUB-CATEGORY SCHEMAS =============

class SubCategoryBase(BaseModel):
    """Base schema for SubCategory"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    category_id: int = Field(..., gt=0)
    allocated_hours: float = Field(default=0.0, ge=0)


class SubCategoryCreate(SubCategoryBase):
    """Schema for creating a new SubCategory"""
    pass


class SubCategoryUpdate(BaseModel):
    """Schema for updating a SubCategory"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    category_id: Optional[int] = Field(None, gt=0)
    allocated_hours: Optional[float] = Field(None, ge=0)


class SubCategoryResponse(SubCategoryBase):
    """Schema for SubCategory response"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubCategoryWithStats(SubCategoryResponse):
    """SubCategory with usage statistics"""
    total_tasks: int = 0
    total_spent_hours: float = 0.0
    category_name: Optional[str] = None
    pillar_name: Optional[str] = None


# ============= VALIDATION SCHEMAS =============

class TimeAllocationValidation(BaseModel):
    """Schema for time allocation validation response"""
    is_valid: bool
    total_allocated: float
    total_allowed: float
    message: str
    details: Optional[dict] = None


# ============= STATISTICS SCHEMAS =============

class PillarStatistics(BaseModel):
    """Statistics for a pillar"""
    pillar_id: int
    pillar_name: str
    allocated_hours: float
    spent_hours: float
    percentage_used: float
    total_categories: int
    total_tasks: int
    total_goals: int


class DashboardStats(BaseModel):
    """Overall dashboard statistics"""
    total_pillars: int = 3
    total_hours_allocated: float = 24.0
    total_hours_spent: float = 0.0
    percentage_utilized: float = 0.0
    pillars_breakdown: List[PillarStatistics] = []


# ============= TASK SCHEMAS =============

class TaskBase(BaseModel):
    """Base schema for Task"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    pillar_id: int = Field(..., gt=0)
    category_id: int = Field(..., gt=0)
    sub_category_id: Optional[int] = Field(None, gt=0)
    allocated_minutes: int = Field(..., gt=0, description="Time allocated in minutes")
    follow_up_frequency: FollowUpFrequency
    separately_followed: bool = Field(default=False, description="No time bound")
    goal_id: Optional[int] = Field(None, gt=0)
    is_part_of_goal: bool = Field(default=False)
    why_reason: Optional[str] = Field(None, description="Why this task is important")
    additional_whys: Optional[List[str]] = Field(None, description="Additional why reasons")
    due_date: Optional[datetime] = None

    @validator('additional_whys', pre=True)
    def parse_additional_whys(cls, v):
        """Parse additional_whys if it's a JSON string"""
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return []
        return v


class TaskCreate(TaskBase):
    """Schema for creating a new Task"""
    pass


class TaskUpdate(BaseModel):
    """Schema for updating a Task"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    pillar_id: Optional[int] = Field(None, gt=0)
    category_id: Optional[int] = Field(None, gt=0)
    sub_category_id: Optional[int] = Field(None, gt=0)
    allocated_minutes: Optional[int] = Field(None, gt=0)
    follow_up_frequency: Optional[FollowUpFrequency] = None
    separately_followed: Optional[bool] = None
    goal_id: Optional[int] = Field(None, gt=0)
    is_part_of_goal: Optional[bool] = None
    why_reason: Optional[str] = None
    additional_whys: Optional[List[str]] = None
    due_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    is_completed: Optional[bool] = None

    @validator('additional_whys', pre=True)
    def parse_additional_whys(cls, v):
        """Parse additional_whys if it's a JSON string"""
        if v is None:
            return None
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return []
        return v


class TaskResponse(TaskBase):
    """Schema for Task response"""
    id: int
    spent_minutes: int = 0
    is_active: bool = True
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskWithStats(TaskResponse):
    """Task with detailed statistics and hierarchy info"""
    pillar_name: Optional[str] = None
    category_name: Optional[str] = None
    sub_category_name: Optional[str] = None
    goal_name: Optional[str] = None
    completion_percentage: float = 0.0
    time_entries_count: int = 0


class TaskFilters(BaseModel):
    """Filters for task queries"""
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    goal_id: Optional[int] = None
    follow_up_frequency: Optional[FollowUpFrequency] = None
    is_active: Optional[bool] = None
    is_completed: Optional[bool] = None
    is_part_of_goal: Optional[bool] = None
