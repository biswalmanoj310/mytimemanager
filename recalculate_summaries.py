#!/usr/bin/env python3
"""Recalculate all daily summaries with updated logic"""

import sys
sys.path.append('backend')

from app.database.database import SessionLocal
from app.services.daily_time_service import recalculate_all_summaries

def main():
    """Main function"""
    db = SessionLocal()
    try:
        print("Recalculating all daily summaries...")
        recalculate_all_summaries(db)
        print("✅ Recalculation complete!")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
