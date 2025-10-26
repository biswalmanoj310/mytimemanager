"""
Migration script to add start_date to milestones and goal tasks
Run this from the backend directory: python3 migrate_add_start_dates.py
"""
from app.database.config import SessionLocal, engine
from sqlalchemy import text

def migrate():
    db = SessionLocal()
    try:
        print("Adding start_date columns...")
        
        # Add start_date to life_goal_milestones
        try:
            db.execute(text('ALTER TABLE life_goal_milestones ADD COLUMN start_date DATE'))
            print("✅ Added start_date column to life_goal_milestones")
        except Exception as e:
            if 'duplicate column' in str(e).lower():
                print("ℹ️  start_date column already exists in life_goal_milestones")
            else:
                raise e
        
        # Add start_date to life_goal_tasks
        try:
            db.execute(text('ALTER TABLE life_goal_tasks ADD COLUMN start_date DATE'))
            print("✅ Added start_date column to life_goal_tasks")
        except Exception as e:
            if 'duplicate column' in str(e).lower():
                print("ℹ️  start_date column already exists in life_goal_tasks")
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
