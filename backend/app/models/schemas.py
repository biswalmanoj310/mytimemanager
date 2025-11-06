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
    """Base Task model with shared fields"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    pillar_id: int = Field(..., gt=0)
    category_id: int = Field(..., gt=0)
    sub_category_id: Optional[int] = Field(None, gt=0)
    task_type: str = Field(default='time', description="Type of task: time, count, or boolean")
    allocated_minutes: int = Field(default=0, description="Time allocated in minutes (for time-based tasks)")
    target_value: Optional[int] = Field(None, description="Target value for count-based tasks")
    unit: Optional[str] = Field(None, max_length=50, description="Unit for count-based tasks (e.g., reps, glasses)")
    follow_up_frequency: FollowUpFrequency
    separately_followed: bool = Field(default=False, description="No time bound")
    goal_id: Optional[int] = Field(None, gt=0)
    is_part_of_goal: bool = Field(default=False)
    related_wish_id: Optional[int] = Field(None, gt=0, description="Link to Dream/Wish")
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
    task_type: Optional[str] = Field(None, description="Type of task: time, count, or boolean")
    allocated_minutes: Optional[int] = Field(None, description="Time allocated in minutes")
    target_value: Optional[int] = Field(None, description="Target value for count-based tasks")
    unit: Optional[str] = Field(None, max_length=50, description="Unit for count-based tasks")
    follow_up_frequency: Optional[FollowUpFrequency] = None
    separately_followed: Optional[bool] = None
    goal_id: Optional[int] = Field(None, gt=0)
    is_part_of_goal: Optional[bool] = None
    related_wish_id: Optional[int] = Field(None, gt=0)
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
    na_marked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    pillar_name: Optional[str] = None
    category_name: Optional[str] = None
    sub_category_name: Optional[str] = None

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


# ============= GOAL SCHEMAS =============

class GoalBase(BaseModel):
    """Base schema for Goal"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    pillar_id: int = Field(..., gt=0)
    category_id: int = Field(..., gt=0)
    sub_category_id: Optional[int] = Field(None, gt=0)
    goal_time_period: GoalTimePeriod
    allocated_hours: float = Field(..., gt=0, description="Total hours allocated for this goal")
    why_reason: Optional[str] = Field(None, description="Why this goal is important")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class GoalCreate(GoalBase):
    """Schema for creating a new Goal"""
    pass


class GoalUpdate(BaseModel):
    """Schema for updating a Goal"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    pillar_id: Optional[int] = Field(None, gt=0)
    category_id: Optional[int] = Field(None, gt=0)
    sub_category_id: Optional[int] = Field(None, gt=0)
    goal_time_period: Optional[GoalTimePeriod] = None
    allocated_hours: Optional[float] = Field(None, gt=0)
    why_reason: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    is_completed: Optional[bool] = None


class GoalResponse(GoalBase):
    """Schema for Goal response"""
    id: int
    spent_hours: float = 0.0
    is_active: bool = True
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GoalWithStats(GoalResponse):
    """Goal with detailed statistics"""
    pillar_name: Optional[str] = None
    category_name: Optional[str] = None
    sub_category_name: Optional[str] = None
    progress_percentage: float = 0.0
    linked_tasks_count: int = 0
    completed_tasks_count: int = 0
    remaining_hours: float = 0.0


class GoalFilters(BaseModel):
    """Filters for goal queries"""
    pillar_id: Optional[int] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    goal_time_period: Optional[GoalTimePeriod] = None
    is_active: Optional[bool] = None
    is_completed: Optional[bool] = None


# ============= TIME ENTRY SCHEMAS =============

class TimeEntryBase(BaseModel):
    """Base schema for TimeEntry"""
    task_id: int = Field(..., gt=0)
    entry_date: Optional[datetime] = None
    start_time: datetime = Field(...)
    end_time: datetime = Field(...)
    notes: Optional[str] = None


class TimeEntryCreate(TimeEntryBase):
    """Schema for creating a new TimeEntry"""
    pass


class TimeEntryUpdate(BaseModel):
    """Schema for updating a TimeEntry"""
    task_id: Optional[int] = Field(None, gt=0)
    entry_date: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    notes: Optional[str] = None


class TimeEntryResponse(TimeEntryBase):
    """Schema for TimeEntry response"""
    id: int
    duration_minutes: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TimeEntryWithDetails(TimeEntryResponse):
    """TimeEntry with task and pillar details"""
    task_name: Optional[str] = None
    pillar_name: Optional[str] = None
    category_name: Optional[str] = None
    sub_category_name: Optional[str] = None


# ============= DAILY TIME ENTRY SCHEMAS =============

class DailyTimeEntryBase(BaseModel):
    """Base schema for DailyTimeEntry"""
    task_id: int = Field(..., gt=0)
    entry_date: datetime
    hour: int = Field(..., ge=0, le=23)
    minutes: int = Field(default=0, ge=0)


class DailyTimeEntryCreate(DailyTimeEntryBase):
    """Schema for creating/updating a daily time entry"""
    pass


class DailyTimeEntryBulkCreate(BaseModel):
    """Schema for bulk creating daily time entries"""
    entry_date: datetime
    entries: List[dict]  # List of {task_id, hour, minutes}


class DailyTimeEntryResponse(DailyTimeEntryBase):
    """Schema for DailyTimeEntry response"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============= DAILY SUMMARY SCHEMAS =============

class DailySummaryBase(BaseModel):
    """Base schema for DailySummary"""
    entry_date: datetime
    total_allocated: int = 0
    total_spent: int = 0
    is_complete: bool = False


class DailySummaryResponse(DailySummaryBase):
    """Schema for DailySummary response"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IncompleteDayResponse(BaseModel):
    """Schema for incomplete day listing"""
    entry_date: datetime
    total_allocated: int
    total_spent: int
    difference: int

    class Config:
        from_attributes = True


# ============= WEEKLY TIME ENTRY SCHEMAS =============

class WeeklyTimeEntryBase(BaseModel):
    """Base schema for WeeklyTimeEntry"""
    task_id: int = Field(..., gt=0)
    week_start_date: datetime
    day_of_week: int = Field(..., ge=0, le=6)  # 0=Sunday, 6=Saturday
    minutes: int = Field(default=0, ge=0)


class WeeklyTimeEntryCreate(WeeklyTimeEntryBase):
    """Schema for creating/updating a weekly time entry"""
    pass


class WeeklyTimeEntryBulkCreate(BaseModel):
    """Schema for bulk creating weekly time entries"""
    week_start_date: datetime
    entries: List[dict]  # List of {task_id, day_of_week, minutes}


class WeeklyTimeEntryResponse(WeeklyTimeEntryBase):
    """Schema for WeeklyTimeEntry response"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============= WEEKLY SUMMARY SCHEMAS =============

class WeeklySummaryBase(BaseModel):
    """Base schema for WeeklySummary"""
    week_start_date: datetime
    total_allocated: int = 0
    total_spent: int = 0
    is_complete: bool = False


class WeeklySummaryResponse(WeeklySummaryBase):
    """Schema for WeeklySummary response"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IncompleteWeekResponse(BaseModel):
    """Schema for incomplete week listing"""
    week_start_date: datetime
    total_allocated: int
    total_spent: int
    difference: int

    class Config:
        from_attributes = True


# ============= WEEKLY TASK STATUS SCHEMAS =============

class WeeklyTaskStatusBase(BaseModel):
    """Base schema for WeeklyTaskStatus"""
    task_id: int = Field(..., gt=0)
    week_start_date: datetime
    is_completed: bool = False
    is_na: bool = False


class WeeklyTaskStatusCreate(WeeklyTaskStatusBase):
    """Schema for creating/updating a weekly task status"""
    pass


class WeeklyTaskStatusResponse(WeeklyTaskStatusBase):
    """Schema for WeeklyTaskStatus response"""
    id: int
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============= DAILY TASK STATUS SCHEMAS =============

class DailyTaskStatusBase(BaseModel):
    """Base schema for DailyTaskStatus"""
    task_id: int = Field(..., gt=0)
    date: datetime  # Will be converted to date in backend
    is_completed: bool = False
    is_na: bool = False
    is_tracked: bool = True


class DailyTaskStatusCreate(BaseModel):
    """Schema for creating/updating a daily task status"""
    task_id: int = Field(..., gt=0)
    date: datetime
    is_completed: Optional[bool] = None
    is_na: Optional[bool] = None
    is_tracked: Optional[bool] = None


class DailyTaskStatusUpdate(BaseModel):
    """Schema for updating daily task status"""
    is_completed: Optional[bool] = None
    is_na: Optional[bool] = None
    is_tracked: Optional[bool] = None


class DailyTaskStatusResponse(BaseModel):
    """Schema for DailyTaskStatus response"""
    id: int
    task_id: int
    date: datetime
    is_completed: bool
    is_na: bool
    is_tracked: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
