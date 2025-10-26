"""
Migration script to add goal_projects and goal_project_task_links tables
This allows creating projects within goals that track daily/weekly/monthly tasks
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from app.database.config import DATABASE_URL

def migrate():
    """Add goal_projects and goal_project_task_links tables"""
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    
    with engine.connect() as db:
        print("Creating goal_projects and goal_project_task_links tables...")
        
        try:
            # Create goal_projects table
            db.execute(text('''
                CREATE TABLE IF NOT EXISTS goal_projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    goal_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_at DATE DEFAULT CURRENT_DATE,
                    updated_at DATE DEFAULT CURRENT_DATE,
                    FOREIGN KEY (goal_id) REFERENCES life_goals(id) ON DELETE CASCADE
                )
            '''))
            print("✅ Created goal_projects table")
            
            # Create goal_project_task_links table
            db.execute(text('''
                CREATE TABLE IF NOT EXISTS goal_project_task_links (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    goal_project_id INTEGER NOT NULL,
                    task_id INTEGER NOT NULL,
                    task_type TEXT NOT NULL,
                    track_start_date DATE NOT NULL,
                    track_end_date DATE,
                    expected_frequency_value INTEGER NOT NULL,
                    expected_frequency_unit TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    notes TEXT,
                    created_at DATE DEFAULT CURRENT_DATE,
                    FOREIGN KEY (goal_project_id) REFERENCES goal_projects(id) ON DELETE CASCADE,
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                    UNIQUE(goal_project_id, task_id)
                )
            '''))
            print("✅ Created goal_project_task_links table")
            
            db.commit()
            print("\n✅ Migration completed successfully!")
            
        except Exception as e:
            print(f"\n❌ Error during migration: {e}")
            db.rollback()
            raise

if __name__ == "__main__":
    migrate()
