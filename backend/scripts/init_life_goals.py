"""
Database initialization script for Life Goals feature
Run this to create the new tables
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.config import engine, Base
from app.models.goal import LifeGoal, LifeGoalMilestone, LifeGoalTaskLink, LifeGoalTask

def init_life_goals_tables():
    """Create life goals tables"""
    print("Creating life goals tables...")
    
    # Create tables
    Base.metadata.create_all(bind=engine, tables=[
        LifeGoal.__table__,
        LifeGoalMilestone.__table__,
        LifeGoalTaskLink.__table__,
        LifeGoalTask.__table__
    ])
    
    print("✓ Life goals tables created successfully!")
    print("  - life_goals")
    print("  - life_goal_milestones")
    print("  - life_goal_task_links")
    print("  - life_goal_tasks")

if __name__ == "__main__":
    init_life_goals_tables()
