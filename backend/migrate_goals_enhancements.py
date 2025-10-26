"""
Migration script to add enhanced tracking fields to life goals
Run this from the backend directory: python3 migrate_goals_enhancements.py
"""
from app.database.config import SessionLocal, engine
from sqlalchemy import text

def migrate():
    db = SessionLocal()
    try:
        print("Adding columns to life_goal_task_links...")
        
        # Add link_start_date column
        try:
            db.execute(text('ALTER TABLE life_goal_task_links ADD COLUMN link_start_date DATE'))
            print("✅ Added link_start_date column")
        except Exception as e:
            if 'duplicate column' in str(e).lower():
                print("ℹ️  link_start_date column already exists")
            else:
                raise e
        
        # Add expected_frequency column
        try:
            db.execute(text('ALTER TABLE life_goal_task_links ADD COLUMN expected_frequency TEXT'))
            print("✅ Added expected_frequency column")
        except Exception as e:
            if 'duplicate column' in str(e).lower():
                print("ℹ️  expected_frequency column already exists")
            else:
                raise e
        
        # Add goal_id to projects table
        print("\nAdding goal_id column to projects...")
        try:
            db.execute(text('ALTER TABLE projects ADD COLUMN goal_id INTEGER REFERENCES life_goals(id)'))
            print("✅ Added goal_id column to projects")
        except Exception as e:
            if 'duplicate column' in str(e).lower():
                print("ℹ️  goal_id column already exists in projects")
            else:
                raise e
        
        db.commit()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
