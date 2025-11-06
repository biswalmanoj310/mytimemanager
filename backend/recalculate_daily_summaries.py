"""
Recalculate daily summaries to use the new per-date tracking system
This will update all existing daily summaries to only count tracked tasks
"""

import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.database.config import SessionLocal, engine
from app.services import daily_time_service
from datetime import date
from sqlalchemy import text

def recalculate_all_summaries():
    """Recalculate all daily summaries"""
    db = SessionLocal()
    try:
        # Get all existing summaries using raw SQL to avoid model relationship issues
        result = db.execute(text("SELECT entry_date FROM daily_summary ORDER BY entry_date"))
        summary_dates = [row[0] for row in result]
        
        print(f"Found {len(summary_dates)} daily summaries to recalculate...")
        
        for entry_date_str in summary_dates:
            # Parse the date
            if isinstance(entry_date_str, str):
                from datetime import datetime
                entry_date = datetime.strptime(entry_date_str.split()[0], '%Y-%m-%d').date()
            else:
                entry_date = entry_date_str.date() if hasattr(entry_date_str, 'date') else entry_date_str
            
            print(f"Recalculating summary for {entry_date}...")
            
            # Recalculate using the updated function
            daily_time_service.update_daily_summary(db, entry_date)
        
        print(f"✅ Successfully recalculated {len(summary_dates)} daily summaries!")
        
        # Show incomplete days after recalculation
        incomplete = daily_time_service.get_incomplete_days(db, limit=50)
        print(f"\n📊 Incomplete days after recalculation: {len(incomplete)}")
        for day in incomplete[:10]:
            print(f"  - {day.entry_date}: Allocated={day.total_allocated} min, Spent={day.total_spent} min, Diff={day.difference} min")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    recalculate_all_summaries()
