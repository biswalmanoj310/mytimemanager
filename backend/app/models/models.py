"""
Database models for MyTimeManager application.
Implements the three-pillar system with categories, tasks, and goals.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Text, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum
from typing import TYPE_CHECKING

from app.database.config import Base

if TYPE_CHECKING:
    from app.models.goal import LifeGoal


# Enums for consistent values
class FollowUpFrequency(str, enum.Enum):
    """Follow-up frequency options for tasks"""
    TODAY = "today"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    PROJECT_TASK = "project_task"  # Tasks that live only in Projects tab
    ONE_TIME = "one_time"
    MISC = "misc"


class GoalTimePeriod(str, enum.Enum):
    """Time period for goals"""
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"


# Models
class Pillar(Base):
    """
    Three pillars of life: Hard Work, Calmness, Family
    Each pillar has 8 hours allocated (total 24 hours)
    """
    __tablename__ = "pillars"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    allocated_hours = Column(Float, default=8.0, nullable=False)
    color_code = Column(String(7), nullable=True)  # Hex color code
    icon = Column(String(50), nullable=True)  # Icon name/emoji
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    categories = relationship("Category", back_populates="pillar", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="pillar")
    goals = relationship("Goal", back_populates="pillar")

    def __repr__(self):
        return f"<Pillar(name='{self.name}', hours={self.allocated_hours})>"


class Category(Base):
    """
    Categories within each pillar
    Time allocated must sum up to pillar's allocated time
    """
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    pillar_id = Column(Integer, ForeignKey("pillars.id"), nullable=False)
    allocated_hours = Column(Float, default=0.0, nullable=False)
    color_code = Column(String(7), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    pillar = relationship("Pillar", back_populates="categories")
    sub_categories = relationship("SubCategory", back_populates="category", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="category")
    goals = relationship("Goal", back_populates="category")

    def __repr__(self):
        return f"<Category(name='{self.name}', pillar='{self.pillar.name if self.pillar else None}')>"


class SubCategory(Base):
    """
    Sub-categories within each category
    Provides granular task organization
    """
    __tablename__ = "sub_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    allocated_hours = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    category = relationship("Category", back_populates="sub_categories")
    tasks = relationship("Task", back_populates="sub_category")
    goals = relationship("Goal", back_populates="sub_category")

    def __repr__(self):
        return f"<SubCategory(name='{self.name}', category='{self.category.name if self.category else None}')>"


class Goal(Base):
    """
    Goals with time-based tracking
    Can be linked to tasks
    """
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Hierarchy
    pillar_id = Column(Integer, ForeignKey("pillars.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    sub_category_id = Column(Integer, ForeignKey("sub_categories.id"), nullable=True)
    
    # Time tracking
    goal_time_period = Column(String(20), nullable=False)  # Using String instead of Enum for SQLite compatibility
    allocated_hours = Column(Float, nullable=False)  # Total hours for this goal
    spent_hours = Column(Float, default=0.0)  # Hours already spent
    
    # Motivation
    why_reason = Column(Text, nullable=True)  # Why is this goal important
    
    # Status
    is_active = Column(Boolean, default=True)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    pillar = relationship("Pillar", back_populates="goals")
    category = relationship("Category", back_populates="goals")
    sub_category = relationship("SubCategory", back_populates="goals")
    tasks = relationship("Task", back_populates="goal")

    def __repr__(self):
        return f"<Goal(name='{self.name}', period='{self.goal_time_period}')>"


class Task(Base):
    """
    Individual tasks with comprehensive tracking
    """
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Hierarchy
    pillar_id = Column(Integer, ForeignKey("pillars.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    sub_category_id = Column(Integer, ForeignKey("sub_categories.id"), nullable=True)
    
    # Task type and allocation
    task_type = Column(String(20), nullable=False, default='time')  # 'time', 'count', or 'boolean'
    allocated_minutes = Column(Integer, nullable=False)  # Time in minutes (for time-based tasks)
    target_value = Column(Integer, nullable=True)  # Target for count-based tasks (e.g., 10 push-ups)
    unit = Column(String(50), nullable=True)  # Unit for count tasks (e.g., 'reps', 'glasses', 'miles')
    spent_minutes = Column(Integer, default=0)  # Actual time spent
    
    # Follow-up
    follow_up_frequency = Column(String(20), nullable=False)  # Using String instead of Enum for SQLite compatibility
    separately_followed = Column(Boolean, default=False)  # No time bound
    is_daily_one_time = Column(Boolean, default=False)  # True for simple daily tasks (done once, not hourly tracked)
    
    # Goal linkage
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    is_part_of_goal = Column(Boolean, default=False)
    related_wish_id = Column(Integer, ForeignKey("wishes.id", ondelete="SET NULL"), nullable=True)  # Link to Dream/Wish
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)  # Link to Project
    parent_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True)  # For subtasks
    
    # Motivation
    why_reason = Column(Text, nullable=True)  # Why this task is important
    additional_whys = Column(Text, nullable=True)  # JSON array of additional reasons
    
    # Status
    is_active = Column(Boolean, default=True)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    na_marked_at = Column(DateTime(timezone=True), nullable=True)  # When task was marked as NA
    
    # Priority (1-10, where 1 is highest priority)
    priority = Column(Integer, default=10, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    due_date = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    pillar = relationship("Pillar", back_populates="tasks")
    category = relationship("Category", back_populates="tasks")
    sub_category = relationship("SubCategory", back_populates="tasks")
    goal = relationship("Goal", back_populates="tasks")
    project = relationship("Project")
    time_entries = relationship("TimeEntry", back_populates="task", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Task(name='{self.name}', pillar='{self.pillar.name if self.pillar else None}')>"


class TimeEntry(Base):
    """
    Individual time tracking entries for tasks
    Tracks time in 30-minute slots
    """
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    
    # Time tracking
    entry_date = Column(DateTime(timezone=True), nullable=False, index=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, nullable=False)  # Should be in multiples of 30
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    task = relationship("Task", back_populates="time_entries")

    def __repr__(self):
        return f"<TimeEntry(task='{self.task.name if self.task else None}', minutes={self.duration_minutes})>"


class DailyTimeEntry(Base):
    """
    Stores actual time spent on each task for each hour of each day
    """
    __tablename__ = "daily_time_entries"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    entry_date = Column(DateTime(timezone=True), nullable=False, index=True)
    hour = Column(Integer, nullable=False)  # 0-23
    minutes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    task = relationship("Task", backref="daily_entries")

    def __repr__(self):
        return f"<DailyTimeEntry(task_id={self.task_id}, date={self.entry_date}, hour={self.hour}, minutes={self.minutes})>"


class DailySummary(Base):
    """
    Summary of each day's time tracking completion status
    """
    __tablename__ = "daily_summary"

    id = Column(Integer, primary_key=True, index=True)
    entry_date = Column(DateTime(timezone=True), nullable=False, unique=True, index=True)
    total_allocated = Column(Integer, nullable=False, default=0)
    total_spent = Column(Integer, nullable=False, default=0)
    is_complete = Column(Boolean, nullable=False, default=False)
    is_ignored = Column(Boolean, nullable=False, default=False)
    ignore_reason = Column(Text, nullable=True)
    ignored_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<DailySummary(date={self.entry_date}, allocated={self.total_allocated}, spent={self.total_spent}, complete={self.is_complete}, ignored={self.is_ignored})>"


class WeeklyTimeEntry(Base):
    """
    Weekly time entries - stores time spent on each task for each day of the week
    """
    __tablename__ = "weekly_time_entries"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    week_start_date = Column(DateTime(timezone=True), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Sunday, 6=Saturday
    minutes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    task = relationship("Task", backref="weekly_entries")

    def __repr__(self):
        return f"<WeeklyTimeEntry(task_id={self.task_id}, week={self.week_start_date}, day={self.day_of_week}, minutes={self.minutes})>"


class WeeklySummary(Base):
    """
    Summary of each week's time tracking completion status
    """
    __tablename__ = "weekly_summary"

    id = Column(Integer, primary_key=True, index=True)
    week_start_date = Column(DateTime(timezone=True), nullable=False, unique=True, index=True)
    total_allocated = Column(Integer, nullable=False, default=0)
    total_spent = Column(Integer, nullable=False, default=0)
    is_complete = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<WeeklySummary(week={self.week_start_date}, allocated={self.total_allocated}, spent={self.total_spent}, complete={self.is_complete})>"


class WeeklyTaskStatus(Base):
    """
    Track completion status of tasks per week (independent of the task's global status)
    """
    __tablename__ = "weekly_task_status"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    week_start_date = Column(DateTime(timezone=True), nullable=False, index=True)
    is_completed = Column(Boolean, nullable=False, default=False)
    is_na = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    task = relationship("Task", backref="weekly_statuses")

    def __repr__(self):
        return f"<WeeklyTaskStatus(task_id={self.task_id}, week={self.week_start_date}, completed={self.is_completed})>"


class MonthlyTimeEntry(Base):
    """
    Monthly time entries - stores time spent on each task for each day of the month
    """
    __tablename__ = "monthly_time_entries"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    month_start_date = Column(DateTime(timezone=True), nullable=False, index=True)
    day_of_month = Column(Integer, nullable=False)  # 1-31
    minutes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    task = relationship("Task", backref="monthly_entries")

    def __repr__(self):
        return f"<MonthlyTimeEntry(task_id={self.task_id}, month={self.month_start_date}, day={self.day_of_month}, minutes={self.minutes})>"


class MonthlyTaskStatus(Base):
    """
    Track completion status of tasks per month (independent of the task's global status)
    """
    __tablename__ = "monthly_task_status"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    month_start_date = Column(DateTime(timezone=True), nullable=False, index=True)
    is_completed = Column(Boolean, nullable=False, default=False)
    is_na = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    task = relationship("Task", backref="monthly_statuses")

    def __repr__(self):
        return f"<MonthlyTaskStatus(task_id={self.task_id}, month={self.month_start_date}, completed={self.is_completed})>"


class YearlyTimeEntry(Base):
    """
    Yearly time entries - stores time spent on each task for each month of the year
    """
    __tablename__ = "yearly_time_entries"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    year_start_date = Column(DateTime(timezone=True), nullable=False, index=True)
    month = Column(Integer, nullable=False)  # 1-12 for Jan-Dec
    minutes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    task = relationship("Task", backref="yearly_entries")

    def __repr__(self):
        return f"<YearlyTimeEntry(task_id={self.task_id}, year={self.year_start_date}, month={self.month}, minutes={self.minutes})>"


class YearlyTaskStatus(Base):
    """
    Track completion status of tasks per year (independent of the task's global status)
    """
    __tablename__ = "yearly_task_status"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    year_start_date = Column(DateTime(timezone=True), nullable=False, index=True)
    is_completed = Column(Boolean, nullable=False, default=False)
    is_na = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    task = relationship("Task", backref="yearly_statuses")

    def __repr__(self):
        return f"<YearlyTaskStatus(task_id={self.task_id}, year={self.year_start_date}, completed={self.is_completed})>"


class MotivationalQuote(Base):
    """
    Motivational quotes displayed on the dashboard
    """
    __tablename__ = "motivational_quotes"

    id = Column(Integer, primary_key=True, index=True)
    quote = Column(Text, nullable=False)
    author = Column(String(100), nullable=True)
    category = Column(String(50), nullable=True)  # motivation, time-management, cani, etc.
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Quote(author='{self.author}')>"


class OneTimeTask(Base):
    """
    One-time tasks with start date, target gap, and updated date tracking
    """
    __tablename__ = "one_time_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=False, index=True)
    target_gap = Column(Integer, nullable=True)  # Target days between updates
    updated_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    task = relationship("Task", backref="one_time_entries")

    def __repr__(self):
        return f"<OneTimeTask(task_id={self.task_id}, start_date={self.start_date})>"


class Project(Base):
    """
    Projects - Container for complex tasks with hierarchical sub-tasks
    Different from Goals: Projects focus on execution with dependencies,
    Goals focus on aspirational achievements with metrics
    Can be linked to a Life Goal for goal-oriented project management
    """
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    pillar_id = Column(Integer, ForeignKey("pillars.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    goal_id = Column(Integer, ForeignKey("life_goals.id", ondelete="SET NULL"), nullable=True)  # Link to Life Goal
    goal_milestone_id = Column(Integer, ForeignKey("life_goal_milestones.id", ondelete="SET NULL"), nullable=True, index=True)  # Link to Goal Milestone
    related_wish_id = Column(Integer, ForeignKey("wishes.id", ondelete="SET NULL"), nullable=True)  # Link to Dream/Wish
    start_date = Column(DateTime(timezone=True), nullable=True)
    target_completion_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="not_started")  # not_started, in_progress, completed, on_hold
    is_active = Column(Boolean, nullable=False, default=True)
    is_completed = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    pillar = relationship("Pillar", backref="projects")
    category = relationship("Category", backref="projects")
    tasks = relationship("ProjectTask", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}', status='{self.status}')>"


class ProjectTask(Base):
    """
    Project Tasks - Hierarchical tasks within a project
    Supports up to 3 levels: Task → Sub-task → Sub-sub-task
    """
    __tablename__ = "project_tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_task_id = Column(Integer, ForeignKey("project_tasks.id", ondelete="CASCADE"), nullable=True, index=True)
    milestone_id = Column(Integer, ForeignKey("project_milestones.id", ondelete="SET NULL"), nullable=True, index=True)
    goal_milestone_id = Column(Integer, ForeignKey("life_goal_milestones.id", ondelete="SET NULL"), nullable=True, index=True)  # Link to Goal Milestone
    name = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True, index=True)
    priority = Column(String(10), nullable=False, default="medium")  # DEPRECATED: high, medium, low (keep for compatibility)
    priority_new = Column(Integer, nullable=True, default=10)  # NEW: 1-10 integer priority
    allocated_minutes = Column(Integer, nullable=True, default=60)  # NEW: Time allocation
    is_completed = Column(Boolean, nullable=False, default=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    order = Column(Integer, nullable=False, default=0)  # For manual sorting
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="tasks")
    parent_task = relationship("ProjectTask", remote_side=[id], backref="sub_tasks")
    milestone = relationship("ProjectMilestone", foreign_keys=[milestone_id])

    def __repr__(self):
        return f"<ProjectTask(id={self.id}, name='{self.name}', completed={self.is_completed})>"


class MiscTaskGroup(Base):
    """
    Misc Task Groups - Container for one-time tasks with hierarchical sub-tasks
    Similar to Projects but for simpler, temporary tasks
    Examples: Organize garage, Plan birthday party, Home renovation
    """
    __tablename__ = "misc_task_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    pillar_id = Column(Integer, ForeignKey("pillars.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    goal_id = Column(Integer, ForeignKey("life_goals.id", ondelete="SET NULL"), nullable=True)  # Link to Life Goal
    due_date = Column(DateTime(timezone=True), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_completed = Column(Boolean, nullable=False, default=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    pillar = relationship("Pillar", backref="misc_task_groups")
    category = relationship("Category", backref="misc_task_groups")
    tasks = relationship("MiscTaskItem", back_populates="group", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MiscTaskGroup(id={self.id}, name='{self.name}', completed={self.is_completed})>"


class MiscTaskItem(Base):
    """
    Misc Task Items - Hierarchical tasks within a misc task group
    Supports up to 3 levels: Task → Sub-task → Sub-sub-task
    """
    __tablename__ = "misc_task_items"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("misc_task_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_task_id = Column(Integer, ForeignKey("misc_task_items.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True, index=True)
    priority = Column(String(10), nullable=False, default="medium")  # DEPRECATED: high, medium, low
    priority_new = Column(Integer, nullable=True, default=10)  # NEW: 1-10 integer priority
    allocated_minutes = Column(Integer, nullable=True, default=60)  # NEW: Time allocation
    is_completed = Column(Boolean, nullable=False, default=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    order = Column(Integer, nullable=False, default=0)  # For manual sorting
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    group = relationship("MiscTaskGroup", back_populates="tasks")
    parent_task = relationship("MiscTaskItem", remote_side=[id], backref="sub_tasks")

    def __repr__(self):
        return f"<MiscTaskItem(id={self.id}, name='{self.name}', completed={self.is_completed})>"


# ============================================
# HABIT TRACKING MODELS
# ============================================

class Habit(Base):
    """
    Habit tracking for building consistent behaviors
    """
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Organization within three-pillar framework
    pillar_id = Column(Integer, ForeignKey("pillars.id"), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    sub_category_id = Column(Integer, ForeignKey("sub_categories.id"), nullable=True, index=True)
    
    # Type of habit
    habit_type = Column(String(20), nullable=False)  # 'boolean', 'time_based', 'count_based'
    
    # Link to existing task (optional - for auto-sync)
    linked_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    
    # Link to life goals and wishes (optional - for purpose alignment)
    life_goal_id = Column(Integer, ForeignKey("life_goals.id"), nullable=True, index=True)
    wish_id = Column(Integer, ForeignKey("wishes.id"), nullable=True, index=True)
    
    # Tracking criteria
    target_frequency = Column(String(20), nullable=False)  # 'daily', 'weekly', 'monthly'
    target_value = Column(Integer, nullable=True)  # For time_based: minutes, count_based: count
    target_comparison = Column(String(10), nullable=False, default='at_least')  # 'at_least', 'at_most', 'exactly'
    
    # Weekly/Monthly occurrence tracking
    target_count_per_period = Column(Integer, nullable=True)  # e.g., 4 for "4x per week"
    period_type = Column(String(20), nullable=True)  # 'daily', 'weekly', 'monthly'
    tracking_mode = Column(String(30), nullable=True)  # 'occurrence', 'occurrence_with_value', 'aggregate'
    session_target_value = Column(Integer, nullable=True)  # e.g., 45 for "45 min per session"
    session_target_unit = Column(String(20), nullable=True)  # 'minutes', 'pages', 'reps', 'km', etc.
    aggregate_target = Column(Integer, nullable=True)  # e.g., 300 for "300 pages per week"
    
    # Habit direction
    is_positive = Column(Boolean, default=True)  # True = "do this", False = "don't do this"
    
    # Motivation
    why_reason = Column(Text, nullable=True)
    
    # Dates
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=True)  # NULL = ongoing indefinitely
    is_active = Column(Boolean, default=True, index=True)
    is_completed = Column(Boolean, default=False, index=True)  # Manually mark habit as completed
    completed_at = Column(DateTime(timezone=True), nullable=True)  # When habit was marked complete
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    pillar = relationship("Pillar", foreign_keys=[pillar_id])
    category = relationship("Category", foreign_keys=[category_id])
    sub_category = relationship("SubCategory", foreign_keys=[sub_category_id])
    linked_task = relationship("Task", foreign_keys=[linked_task_id])
    life_goal = relationship("LifeGoal", foreign_keys=[life_goal_id])
    wish = relationship("Wish", foreign_keys=[wish_id])
    entries = relationship("HabitEntry", back_populates="habit", cascade="all, delete-orphan")
    streaks = relationship("HabitStreak", back_populates="habit", cascade="all, delete-orphan")
    sessions = relationship("HabitSession", foreign_keys="[HabitSession.habit_id]", cascade="all, delete-orphan")
    periods = relationship("HabitPeriod", foreign_keys="[HabitPeriod.habit_id]", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Habit(id={self.id}, name='{self.name}', type='{self.habit_type}')>"


class HabitEntry(Base):
    """
    Daily entries for habit tracking (one per day per habit)
    """
    __tablename__ = "habit_entries"

    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False)
    entry_date = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Success tracking
    is_successful = Column(Boolean, nullable=False, default=False)
    actual_value = Column(Integer, nullable=True)  # Actual minutes/count achieved
    
    # Notes
    note = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    habit = relationship("Habit", back_populates="entries")

    def __repr__(self):
        return f"<HabitEntry(habit_id={self.habit_id}, date={self.entry_date}, successful={self.is_successful})>"


class HabitStreak(Base):
    """
    Streak records for habits (for motivation and gamification)
    """
    __tablename__ = "habit_streaks"

    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False)
    
    # Streak details
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=True)  # NULL = current active streak
    streak_length = Column(Integer, nullable=False)
    
    # Is this an active streak?
    is_active = Column(Boolean, default=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    habit = relationship("Habit", back_populates="streaks")

    def __repr__(self):
        return f"<HabitStreak(habit_id={self.habit_id}, length={self.streak_length}, active={self.is_active})>"


class HabitSession(Base):
    """
    Individual sessions/occurrences within a period (for weekly/monthly habits)
    Example: 4 gym sessions in a week
    """
    __tablename__ = "habit_sessions"

    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False)
    
    # Period tracking
    period_type = Column(String(20), nullable=False)  # 'week' or 'month'
    period_start = Column(Date, nullable=False, index=True)
    period_end = Column(Date, nullable=False)
    session_number = Column(Integer, nullable=False)  # 1, 2, 3, 4...
    
    # Session completion
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_completed = Column(Boolean, default=False, index=True)
    value_achieved = Column(Integer, nullable=True)  # For occurrence_with_value mode (e.g., 60 min, 50 pages)
    meets_target = Column(Boolean, nullable=True)  # Did this session meet the individual target?
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    habit = relationship("Habit", foreign_keys=[habit_id])

    def __repr__(self):
        return f"<HabitSession(habit_id={self.habit_id}, period={self.period_start}, session={self.session_number}, completed={self.is_completed})>"


class HabitPeriod(Base):
    """
    Period summary for weekly/monthly habits
    Tracks overall completion for the week/month
    """
    __tablename__ = "habit_periods"

    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False)
    
    # Period tracking
    period_type = Column(String(20), nullable=False)  # 'week' or 'month'
    period_start = Column(Date, nullable=False, index=True)
    period_end = Column(Date, nullable=False)
    
    # Occurrence tracking
    target_count = Column(Integer, nullable=True)  # For occurrence mode: target times (e.g., 4x/week)
    completed_count = Column(Integer, default=0)  # For occurrence mode: actual times done
    
    # Aggregate tracking
    aggregate_target = Column(Integer, nullable=True)  # For aggregate mode: total target (e.g., 300 pages)
    aggregate_achieved = Column(Integer, default=0)  # For aggregate mode: total achieved
    
    # Success metrics
    is_successful = Column(Boolean, default=False, index=True)
    success_percentage = Column(Float, nullable=True)  # Overall progress percentage
    quality_percentage = Column(Float, nullable=True)  # For occurrence_with_value: % of sessions meeting target
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    habit = relationship("Habit", foreign_keys=[habit_id])

    def __repr__(self):
        return f"<HabitPeriod(habit_id={self.habit_id}, period={self.period_start}, successful={self.is_successful})>"


# ============================================================================
# WISHES / DREAM BOARD MODELS
# Philosophy: Wishes → Aspirational Goals → Committed Goals
# Based on: Viktor Frankl, Napoleon Hill, Stephen Covey, James Clear
# ============================================================================

class Wish(Base):
    """
    Wish / Dream Board item - aspirational desires without pressure
    "A goal is a dream with a deadline" - Napoleon Hill
    This is the dream BEFORE the deadline
    """
    __tablename__ = "wishes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True, index=True)  # travel, financial, personal, career, health, relationship, learning, lifestyle
    dream_type = Column(String(50), nullable=True)  # experience, acquisition, achievement, transformation
    
    # Aspirational details (no pressure, just exploration)
    estimated_timeframe = Column(String(50), nullable=True)  # someday, 1-2 years, 2-5 years, 5+ years
    estimated_cost = Column(Float, nullable=True)
    priority = Column(String(20), default='low')  # low, medium, high, burning_desire
    
    # Emotional connection (Viktor Frankl: "Know your why")
    why_important = Column(Text, nullable=True)  # Why does this matter?
    emotional_impact = Column(Text, nullable=True)  # How will I feel?
    life_area = Column(String(50), nullable=True)  # Which life pillar?
    
    # Visual inspiration
    image_url = Column(Text, nullable=True)
    inspiration_notes = Column(Text, nullable=True)
    
    # Related to existing system
    pillar_id = Column(Integer, ForeignKey('pillars.id', ondelete='SET NULL'), nullable=True)
    category_id = Column(Integer, ForeignKey('categories.id', ondelete='SET NULL'), nullable=True)
    related_goal_id = Column(Integer, ForeignKey('life_goals.id', ondelete='SET NULL'), nullable=True)
    
    # Status tracking
    status = Column(String(50), default='dreaming', index=True)  # dreaming, exploring, ready, moved_to_goal, achieved, released
    converted_to_goal_at = Column(DateTime(timezone=True), nullable=True)
    
    # Dream lifecycle fields (Migration 014)
    achieved_at = Column(DateTime(timezone=True), nullable=True)
    released_at = Column(DateTime(timezone=True), nullable=True)
    release_reason = Column(Text, nullable=True)
    achievement_notes = Column(Text, nullable=True)
    linked_goal_id = Column(Integer, nullable=True)
    
    # Metadata
    is_active = Column(Boolean, default=True, index=True)
    is_private = Column(Boolean, default=False)
    tags = Column(Text, nullable=True)  # JSON string of tags
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    pillar_relation = relationship("Pillar", foreign_keys=[pillar_id])
    category_relation = relationship("Category", foreign_keys=[category_id])
    related_goal_relation = relationship("LifeGoal", foreign_keys=[related_goal_id])
    reflections = relationship("WishReflection", back_populates="wish", cascade="all, delete-orphan")
    exploration_steps = relationship("WishExplorationStep", back_populates="wish", cascade="all, delete-orphan")
    inspirations = relationship("WishInspiration", back_populates="wish", cascade="all, delete-orphan")

    def to_dict(self):
        """Convert wish to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'dream_type': self.dream_type,
            'estimated_timeframe': self.estimated_timeframe,
            'estimated_cost': self.estimated_cost,
            'priority': self.priority,
            'why_important': self.why_important,
            'emotional_impact': self.emotional_impact,
            'life_area': self.life_area,
            'image_url': self.image_url,
            'inspiration_notes': self.inspiration_notes,
            'pillar_id': self.pillar_id,
            'category_id': self.category_id,
            'related_goal_id': self.related_goal_id,
            'status': self.status,
            'converted_to_goal_at': self.converted_to_goal_at.isoformat() if self.converted_to_goal_at else None,
            'achieved_at': self.achieved_at.isoformat() if self.achieved_at else None,
            'released_at': self.released_at.isoformat() if self.released_at else None,
            'release_reason': self.release_reason,
            'achievement_notes': self.achievement_notes,
            'linked_goal_id': self.linked_goal_id,
            'is_active': self.is_active,
            'is_private': self.is_private,
            'tags': self.tags,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<Wish(id={self.id}, title='{self.title}', status='{self.status}')>"


class WishReflection(Base):
    """
    Journaling about wishes - track thoughts and clarity over time
    """
    __tablename__ = "wish_reflections"

    id = Column(Integer, primary_key=True, index=True)
    wish_id = Column(Integer, ForeignKey('wishes.id', ondelete='CASCADE'), nullable=False, index=True)
    reflection_date = Column(Date, nullable=False)
    reflection_text = Column(Text, nullable=False)
    mood = Column(String(50), nullable=True)  # excited, uncertain, determined, doubtful, inspired
    clarity_score = Column(Integer, nullable=True)  # 1-10, how clear is this wish?
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    wish = relationship("Wish", back_populates="reflections")

    def __repr__(self):
        return f"<WishReflection(wish_id={self.wish_id}, date={self.reflection_date})>"


class WishExplorationStep(Base):
    """
    Small exploration steps toward understanding/achieving the wish
    Not committed goals, just gentle exploration
    """
    __tablename__ = "wish_exploration_steps"

    id = Column(Integer, primary_key=True, index=True)
    wish_id = Column(Integer, ForeignKey('wishes.id', ondelete='CASCADE'), nullable=False, index=True)
    step_title = Column(String(255), nullable=False)
    step_description = Column(Text, nullable=True)
    step_type = Column(String(50), nullable=True)  # research, save_money, learn_skill, explore, connect
    
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    wish = relationship("Wish", back_populates="exploration_steps")

    def __repr__(self):
        return f"<WishExplorationStep(wish_id={self.wish_id}, title='{self.step_title}')>"


class WishInspiration(Base):
    """
    Collect inspiring content related to wishes
    Articles, videos, photos, quotes that fuel the dream
    """
    __tablename__ = "wish_inspirations"

    id = Column(Integer, primary_key=True, index=True)
    wish_id = Column(Integer, ForeignKey('wishes.id', ondelete='CASCADE'), nullable=False, index=True)
    inspiration_type = Column(String(50), nullable=True)  # article, video, photo, quote, story, person
    title = Column(String(255), nullable=True)
    url = Column(Text, nullable=True)
    content_text = Column(Text, nullable=True)
    source = Column(String(255), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    wish = relationship("Wish", back_populates="inspirations")

    def __repr__(self):
        return f"<WishInspiration(wish_id={self.wish_id}, type='{self.inspiration_type}')>"


class Challenge(Base):
    """
    Time-bound personal challenges (7-30 days)
    Fun experiments to build new behaviors
    """
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    challenge_type = Column(String(50), nullable=False)  # daily_streak, count_based, accumulation
    
    # Challenge parameters
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    target_days = Column(Integer, nullable=True)  # For daily_streak
    target_count = Column(Integer, nullable=True)  # For count_based
    target_value = Column(Float, nullable=True)  # For accumulation
    unit = Column(String(50), nullable=True)  # fruits, treks, km, pages, etc.
    
    # Tracking
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    completed_days = Column(Integer, default=0)
    current_count = Column(Integer, default=0)
    current_value = Column(Float, default=0.0)
    
    # Status
    status = Column(String(20), default='active', index=True)  # active, completed, failed, abandoned
    is_completed = Column(Boolean, default=False, index=True)
    completion_date = Column(DateTime(timezone=True), nullable=True)
    
    # Gamification
    difficulty = Column(String(20), nullable=True)  # easy, medium, hard
    reward = Column(Text, nullable=True)
    why_reason = Column(Text, nullable=True)
    
    # Links
    pillar_id = Column(Integer, ForeignKey('pillars.id', ondelete='SET NULL'), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=True, index=True)
    sub_category_id = Column(Integer, ForeignKey('sub_categories.id'), nullable=True, index=True)
    linked_task_id = Column(Integer, ForeignKey('tasks.id'), nullable=True, index=True)
    goal_id = Column(Integer, ForeignKey('goals.id', ondelete='SET NULL'), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete='SET NULL'), nullable=True, index=True)
    
    # Auto-sync from linked task
    auto_sync = Column(Boolean, default=False, index=True)  # Auto-update progress from linked task logs
    
    can_graduate_to_habit = Column(Boolean, default=False)
    graduated_habit_id = Column(Integer, ForeignKey('habits.id', ondelete='SET NULL'), nullable=True)
    
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    pillar = relationship("Pillar", foreign_keys=[pillar_id])
    category = relationship("Category", foreign_keys=[category_id])
    sub_category = relationship("SubCategory", foreign_keys=[sub_category_id])
    linked_task = relationship("Task", foreign_keys=[linked_task_id])
    goal = relationship("Goal", foreign_keys=[goal_id])
    project = relationship("Project", foreign_keys=[project_id])
    entries = relationship("ChallengeEntry", back_populates="challenge", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Challenge(id={self.id}, name='{self.name}', type='{self.challenge_type}')>"


class ChallengeEntry(Base):
    """
    Daily entries for challenge tracking
    """
    __tablename__ = "challenge_entries"

    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey('challenges.id', ondelete='CASCADE'), nullable=False, index=True)
    entry_date = Column(Date, nullable=False, index=True)
    
    # Entry data
    is_completed = Column(Boolean, default=False, index=True)
    count_value = Column(Integer, default=0)
    numeric_value = Column(Float, default=0.0)
    
    # Optional
    note = Column(Text, nullable=True)
    mood = Column(String(20), nullable=True)  # great, good, okay, struggled
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    challenge = relationship("Challenge", back_populates="entries")

    def __repr__(self):
        return f"<ChallengeEntry(challenge_id={self.challenge_id}, date={self.entry_date})>"


class ProjectMilestone(Base):
    """
    Milestones for project phase tracking
    """
    __tablename__ = "project_milestones"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    target_date = Column(Date, nullable=False, index=True)
    is_completed = Column(Boolean, default=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    order = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project")

    def __repr__(self):
        return f"<ProjectMilestone(project_id={self.project_id}, name='{self.name}')>"


class DailyTaskStatus(Base):
    """
    Tracks daily task status: completion, N/A, and tracking status
    This allows tasks to have different states on different dates
    """
    __tablename__ = "daily_task_status"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    is_completed = Column(Boolean, default=False)
    is_na = Column(Boolean, default=False)
    is_tracked = Column(Boolean, default=True)  # Whether task is being tracked on this date
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    task = relationship("Task")

    def __repr__(self):
        return f"<DailyTaskStatus(task_id={self.task_id}, date={self.date}, completed={self.is_completed}, na={self.is_na}, tracked={self.is_tracked})>"



class ImportantTask(Base):
    """
    Important Tasks - Periodic check tasks with ideal gap
    Example: Check bank account every 45 days
    Status: RED (overdue), YELLOW (upcoming 5 days), GREEN (on track)
    """
    __tablename__ = "important_tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Organization
    pillar_id = Column(Integer, ForeignKey("pillars.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    sub_category_id = Column(Integer, ForeignKey("sub_categories.id"), nullable=True)
    
    # Periodic check parameters
    ideal_gap_days = Column(Integer, nullable=False)
    last_check_date = Column(DateTime(timezone=True), nullable=True)
    start_date = Column(DateTime(timezone=True), server_default=func.now())
    check_history = Column(Text, nullable=True)
    
    # Hierarchy support
    parent_id = Column(Integer, ForeignKey("important_tasks.id"), nullable=True)
    
    # Priority & Status
    priority = Column(Integer, default=10)
    is_active = Column(Boolean, default=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    pillar = relationship("Pillar", foreign_keys=[pillar_id])
    category = relationship("Category", foreign_keys=[category_id])
    sub_category = relationship("SubCategory", foreign_keys=[sub_category_id])
    parent = relationship("ImportantTask", remote_side=[id], foreign_keys=[parent_id])
    children = relationship("ImportantTask", foreign_keys=[parent_id], remote_side=[parent_id])

    def __repr__(self):
        return f"<ImportantTask(id={self.id}, name=\"{self.name}\", gap_days={self.ideal_gap_days})>"

