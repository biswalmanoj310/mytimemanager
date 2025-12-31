#!/usr/bin/env python3
"""
Recalculate progress and status for all goals
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy.orm import Session
from app.database.config import SessionLocal
from app.models.goal import LifeGoal
from app.services.life_goal_service import _recalculate_goal_progress


def recalculate_all_goals():
    """Recalculate progress for all goals"""
    db: Session = SessionLocal()
    
    try:
        goals = db.query(LifeGoal).all()
        print(f"Found {len(goals)} goals to recalculate")
        
        for goal in goals:
            print(f"\nRecalculating: {goal.name}")
            print(f"  Previous status: {goal.status}, progress: {goal.progress_percentage}%")
            
            _recalculate_goal_progress(db, goal.id)
            
            # Refresh to see updated values
            db.refresh(goal)
            print(f"  New status: {goal.status}, progress: {goal.progress_percentage}%")
        
        print("\n✓ All goals recalculated successfully!")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    recalculate_all_goals()
