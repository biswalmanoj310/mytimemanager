from sqlalchemy import Column, Integer, String, Date, Boolean, Float, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from app.database.config import Base
import datetime

class LifeGoal(Base):
    __tablename__ = "life_goals"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    parent_goal_id = Column(Integer, ForeignKey('life_goals.id'), nullable=True)
    start_date = Column(Date, nullable=False)
    target_date = Column(Date, nullable=False)
    actual_completion_date = Column(Date, nullable=True)
    status = Column(String, default='not_started')  # not_started, in_progress, on_track, at_risk, behind, completed, abandoned
    category = Column(String, nullable=True)  # career, health, financial, personal, learning, other
    priority = Column(String, default='medium')  # high, medium, low
    why_statements = Column(JSON, default=list)  # Array of strings
    description = Column(Text, nullable=True)
    progress_percentage = Column(Float, default=0.0)
    time_allocated_hours = Column(Float, default=0.0)
    time_spent_hours = Column(Float, default=0.0)
    created_at = Column(Date, default=datetime.date.today)
    updated_at = Column(Date, nullable=True)
    
    # NEW: Organization fields (pillar/category structure)
    pillar_id = Column(Integer, ForeignKey("pillars.id"), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    sub_category_id = Column(Integer, ForeignKey("sub_categories.id"), nullable=True, index=True)
    linked_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True, index=True)
    related_wish_id = Column(Integer, ForeignKey("wishes.id"), nullable=True, index=True)  # Link to Dream/Wish
    
    # Relationships
    parent_goal = relationship("LifeGoal", remote_side=[id], backref="sub_goals")
    milestones = relationship("LifeGoalMilestone", back_populates="goal", cascade="all, delete-orphan")
    task_links = relationship("LifeGoalTaskLink", back_populates="goal", cascade="all, delete-orphan")
    goal_tasks = relationship("LifeGoalTask", back_populates="goal", cascade="all, delete-orphan")
    goal_projects = relationship("GoalProject", back_populates="goal", cascade="all, delete-orphan")
    
    # NEW: Organization relationships
    pillar = relationship("Pillar", foreign_keys=[pillar_id])
    category = relationship("Category", foreign_keys=[category_id])
    sub_category = relationship("SubCategory", foreign_keys=[sub_category_id])
    linked_task = relationship("Task", foreign_keys=[linked_task_id])


class LifeGoalMilestone(Base):
    __tablename__ = "life_goal_milestones"
    
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey('life_goals.id'), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)  # When work on this milestone started
    target_date = Column(Date, nullable=False)
    actual_completion_date = Column(Date, nullable=True)
    is_completed = Column(Boolean, default=False)
    metric = Column(String, nullable=True)  # e.g., "3 presentations", "100 pages"
    order = Column(Integer, default=0)
    created_at = Column(Date, default=datetime.date.today)
    
    # Relationships
    goal = relationship("LifeGoal", back_populates="milestones")


class LifeGoalTaskLink(Base):
    __tablename__ = "life_goal_task_links"
    
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey('life_goals.id'), nullable=False)
    task_id = Column(Integer, ForeignKey('tasks.id'), nullable=False)
    task_type = Column(String, nullable=False)  # daily, weekly, monthly, project, onetime
    time_allocated_hours = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    link_start_date = Column(Date, nullable=True)  # When this task was linked to goal
    expected_frequency = Column(String, nullable=True)  # daily, weekly, monthly
    created_at = Column(Date, default=datetime.date.today)
    
    # Relationships
    goal = relationship("LifeGoal", back_populates="task_links")
    task = relationship("Task")


class LifeGoalTask(Base):
    __tablename__ = "life_goal_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey('life_goals.id'), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)  # When work on this task started
    due_date = Column(Date, nullable=True)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(Date, nullable=True)
    
    # Task type support (TIME, COUNT, BOOLEAN)
    task_type = Column(String, default='time')  # 'time', 'count', 'boolean'
    target_value = Column(Integer, nullable=True)  # For COUNT type (e.g., 5 courses)
    current_value = Column(Integer, default=0)  # Current progress for COUNT/BOOLEAN
    unit = Column(String, nullable=True)  # For COUNT type (e.g., 'courses', 'deals')
    allocated_minutes = Column(Integer, nullable=True)  # For TIME type
    
    # Legacy time tracking (kept for backward compatibility)
    time_allocated_hours = Column(Float, default=0.0)
    time_spent_hours = Column(Float, default=0.0)
    
    priority = Column(String, default='medium')  # high, medium, low
    order = Column(Integer, default=0)
    created_at = Column(Date, default=datetime.date.today)
    updated_at = Column(Date, nullable=True)
    
    # Relationships
    goal = relationship("LifeGoal", back_populates="goal_tasks")


class GoalProject(Base):
    """
    Projects created within a Goal context for tracking daily/weekly/monthly tasks
    Separate from standalone projects in the Tasks section
    """
    __tablename__ = "goal_projects"
    
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey('life_goals.id'), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(Date, default=datetime.date.today)
    updated_at = Column(Date, nullable=True)
    
    # Relationships
    goal = relationship("LifeGoal")
    task_links = relationship("GoalProjectTaskLink", back_populates="goal_project", cascade="all, delete-orphan")


class GoalProjectTaskLink(Base):
    """
    Links daily/weekly/monthly tasks to a Goal Project with tracking parameters
    """
    __tablename__ = "goal_project_task_links"
    
    id = Column(Integer, primary_key=True, index=True)
    goal_project_id = Column(Integer, ForeignKey('goal_projects.id'), nullable=False)
    task_id = Column(Integer, ForeignKey('tasks.id'), nullable=False)
    task_type = Column(String, nullable=False)  # daily, weekly, monthly
    track_start_date = Column(Date, nullable=False)
    track_end_date = Column(Date, nullable=True)  # NULL = ongoing
    expected_frequency_value = Column(Integer, nullable=False)  # e.g., 6, 5, 3
    expected_frequency_unit = Column(String, nullable=False)  # per_week, per_month, per_day
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(Date, default=datetime.date.today)
    
    # Relationships
    goal_project = relationship("GoalProject", back_populates="task_links")
    task = relationship("Task")
