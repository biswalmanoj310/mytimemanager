"""
Database models for MyTimeManager application.
Implements the three-pillar system with categories, tasks, and goals.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.database.config import Base


# Enums for consistent values
class FollowUpFrequency(str, enum.Enum):
    """Follow-up frequency options for tasks"""
    TODAY = "today"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    ONE_TIME = "one_time"


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
    
    # Time allocation
    allocated_minutes = Column(Integer, nullable=False)  # Time in minutes
    spent_minutes = Column(Integer, default=0)  # Actual time spent
    
    # Follow-up
    follow_up_frequency = Column(String(20), nullable=False)  # Using String instead of Enum for SQLite compatibility
    separately_followed = Column(Boolean, default=False)  # No time bound
    
    # Goal linkage
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    is_part_of_goal = Column(Boolean, default=False)
    
    # Motivation
    why_reason = Column(Text, nullable=True)  # Why this task is important
    additional_whys = Column(Text, nullable=True)  # JSON array of additional reasons
    
    # Status
    is_active = Column(Boolean, default=True)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    na_marked_at = Column(DateTime(timezone=True), nullable=True)  # When task was marked as NA
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    due_date = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    pillar = relationship("Pillar", back_populates="tasks")
    category = relationship("Category", back_populates="tasks")
    sub_category = relationship("SubCategory", back_populates="tasks")
    goal = relationship("Goal", back_populates="tasks")
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<DailySummary(date={self.entry_date}, allocated={self.total_allocated}, spent={self.total_spent}, complete={self.is_complete})>"


class MotivationalQuote(Base):
    """
    Inspirational quotes for the application
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
