#!/usr/bin/env python3
"""Recalculate all daily summaries with updated logic"""

import sys
sys.path.append('backend')

from datetime import date, timedelta
from app.database.config import SessionLocal
from app.services.daily_time_service import update_daily_summary

def main():
    """Main function"""
    db = SessionLocal()
    try:
        print("Recalculating all daily summaries...")
        
        # Recalculate from Nov 1, 2025 to today
        start_date = date(2025, 11, 1)
        end_date = date.today()
        
        current_date = start_date
        count = 0
        
        while current_date <= end_date:
            try:
                update_daily_summary(db, current_date)
                count += 1
                if count % 10 == 0:
                    print(f"  Processed {count} days...")
            except Exception as e:
                print(f"  Error processing {current_date}: {e}")
            
            current_date += timedelta(days=1)
        
        print(f"✅ Recalculation complete! Processed {count} days.")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
