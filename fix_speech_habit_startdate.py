"""
Fix start_date for speech habit - set to today (April 24, 2026) in local time.
Run from project root: python3 fix_speech_habit_startdate.py
"""
import sqlite3
import os
from datetime import date

DB_PATH = os.path.join(os.path.dirname(__file__), 'backend', 'database', 'mytimemanager.db')
TARGET_DATE = '2026-04-24'

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("SELECT id, name, start_date FROM habits WHERE name LIKE '%Speech%' OR name LIKE '%speech%'")
rows = cursor.fetchall()

if not rows:
    print("❌ No speech habit found")
else:
    for habit_id, name, start_date in rows:
        print(f"Found: id={habit_id}, name='{name}', current start_date={start_date}")
        # Only fix the weekly speech habit (id=27), not older habits with valid historical start dates
        if habit_id != 27:
            print(f"   ⏭ Skipping (not the weekly speech habit)")
            continue
        cursor.execute("UPDATE habits SET start_date = ? WHERE id = ?", (TARGET_DATE, habit_id))
        print(f"✅ Updated start_date to {TARGET_DATE}")

conn.commit()
conn.close()
print("Done. Restart backend to pick up the change.")
