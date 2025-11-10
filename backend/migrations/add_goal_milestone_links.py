"""
Migration: Add goal_milestone_id to projects and project_tasks tables
to support linking projects and tasks to specific goal milestones

This allows each milestone to have:
- Associated projects (the project is working towards this milestone)
- Associated project tasks (specific tasks that complete this milestone)

Similar to how project tasks link to project milestones
"""

import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine, text
from app.database.config import DATABASE_URL

def run_migration():
    """Add goal_milestone_id to projects and project_tasks tables"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Start transaction
        trans = conn.begin()
        
        try:
            # Check if goal_milestone_id exists in projects table
            result = conn.execute(text("PRAGMA table_info(projects)")).fetchall()
            columns = [row[1] for row in result]
            
            if 'goal_milestone_id' not in columns:
                print("Adding goal_milestone_id to projects table...")
                conn.execute(text("""
                    ALTER TABLE projects 
                    ADD COLUMN goal_milestone_id INTEGER
                    REFERENCES life_goal_milestones(id) ON DELETE SET NULL;
                """))
                
                print("Adding index on projects.goal_milestone_id...")
                conn.execute(text("""
                    CREATE INDEX ix_projects_goal_milestone_id 
                    ON projects(goal_milestone_id);
                """))
            else:
                print("goal_milestone_id already exists in projects table")
            
            # Check if goal_milestone_id exists in project_tasks table
            result = conn.execute(text("PRAGMA table_info(project_tasks)")).fetchall()
            columns = [row[1] for row in result]
            
            if 'goal_milestone_id' not in columns:
                print("Adding goal_milestone_id to project_tasks table...")
                conn.execute(text("""
                    ALTER TABLE project_tasks 
                    ADD COLUMN goal_milestone_id INTEGER
                    REFERENCES life_goal_milestones(id) ON DELETE SET NULL;
                """))
                
                print("Adding index on project_tasks.goal_milestone_id...")
                conn.execute(text("""
                    CREATE INDEX ix_project_tasks_goal_milestone_id 
                    ON project_tasks(goal_milestone_id);
                """))
            else:
                print("goal_milestone_id already exists in project_tasks table")
            
            # Commit transaction
            trans.commit()
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            trans.rollback()
            print(f"❌ Migration failed: {e}")
            raise

if __name__ == "__main__":
    run_migration()
