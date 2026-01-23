"""
Migration 023: Add snapshot columns to habit_entries, habit_sessions, and challenge_entries
Purpose: Preserve historical habit/challenge data even when habits/challenges are renamed or deleted
Author: AI Assistant
Date: 2025-01-23
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    """Add snapshot columns to habit and challenge tables"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("=" * 60)
        print("MIGRATION 023: Adding snapshot columns to habits and challenges")
        print("=" * 60)
        
        # ==============================================
        # 1. Add snapshot columns to habit_entries
        # ==============================================
        print("\n1️⃣  Adding snapshot columns to habit_entries...")
        
        habit_entry_columns = [
            "ALTER TABLE habit_entries ADD COLUMN habit_name_snapshot TEXT",
            "ALTER TABLE habit_entries ADD COLUMN pillar_id_snapshot INTEGER",
            "ALTER TABLE habit_entries ADD COLUMN pillar_name_snapshot TEXT",
            "ALTER TABLE habit_entries ADD COLUMN category_id_snapshot INTEGER",
            "ALTER TABLE habit_entries ADD COLUMN category_name_snapshot TEXT"
        ]
        
        for sql in habit_entry_columns:
            try:
                cursor.execute(sql)
                print(f"  ✓ {sql.split('ADD COLUMN')[1].split()[0]}")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    print(f"  ⚠ Column {sql.split('ADD COLUMN')[1].split()[0]} already exists, skipping")
                else:
                    raise
        
        # Backfill habit_entries with current data
        print("\n  📊 Backfilling habit_entries with current habit data...")
        cursor.execute("""
            UPDATE habit_entries
            SET 
                habit_name_snapshot = (SELECT name FROM habits WHERE habits.id = habit_entries.habit_id),
                pillar_id_snapshot = (SELECT pillar_id FROM habits WHERE habits.id = habit_entries.habit_id),
                pillar_name_snapshot = (SELECT pillars.name FROM habits 
                                       JOIN pillars ON habits.pillar_id = pillars.id 
                                       WHERE habits.id = habit_entries.habit_id),
                category_id_snapshot = (SELECT category_id FROM habits WHERE habits.id = habit_entries.habit_id),
                category_name_snapshot = (SELECT categories.name FROM habits 
                                         JOIN categories ON habits.category_id = categories.id 
                                         WHERE habits.id = habit_entries.habit_id)
            WHERE habit_name_snapshot IS NULL
        """)
        backfilled_entries = cursor.rowcount
        print(f"  ✓ Backfilled {backfilled_entries} habit entries")
        
        # ==============================================
        # 2. Add snapshot columns to habit_sessions
        # ==============================================
        print("\n2️⃣  Adding snapshot columns to habit_sessions...")
        
        habit_session_columns = [
            "ALTER TABLE habit_sessions ADD COLUMN habit_name_snapshot TEXT",
            "ALTER TABLE habit_sessions ADD COLUMN pillar_id_snapshot INTEGER",
            "ALTER TABLE habit_sessions ADD COLUMN pillar_name_snapshot TEXT",
            "ALTER TABLE habit_sessions ADD COLUMN category_id_snapshot INTEGER",
            "ALTER TABLE habit_sessions ADD COLUMN category_name_snapshot TEXT"
        ]
        
        for sql in habit_session_columns:
            try:
                cursor.execute(sql)
                print(f"  ✓ {sql.split('ADD COLUMN')[1].split()[0]}")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    print(f"  ⚠ Column {sql.split('ADD COLUMN')[1].split()[0]} already exists, skipping")
                else:
                    raise
        
        # Backfill habit_sessions with current data
        print("\n  📊 Backfilling habit_sessions with current habit data...")
        cursor.execute("""
            UPDATE habit_sessions
            SET 
                habit_name_snapshot = (SELECT name FROM habits WHERE habits.id = habit_sessions.habit_id),
                pillar_id_snapshot = (SELECT pillar_id FROM habits WHERE habits.id = habit_sessions.habit_id),
                pillar_name_snapshot = (SELECT pillars.name FROM habits 
                                       JOIN pillars ON habits.pillar_id = pillars.id 
                                       WHERE habits.id = habit_sessions.habit_id),
                category_id_snapshot = (SELECT category_id FROM habits WHERE habits.id = habit_sessions.habit_id),
                category_name_snapshot = (SELECT categories.name FROM habits 
                                         JOIN categories ON habits.category_id = categories.id 
                                         WHERE habits.id = habit_sessions.habit_id)
            WHERE habit_name_snapshot IS NULL
        """)
        backfilled_sessions = cursor.rowcount
        print(f"  ✓ Backfilled {backfilled_sessions} habit sessions")
        
        # ==============================================
        # 3. Add snapshot columns to challenge_entries
        # ==============================================
        print("\n3️⃣  Adding snapshot columns to challenge_entries...")
        
        challenge_entry_columns = [
            "ALTER TABLE challenge_entries ADD COLUMN challenge_name_snapshot TEXT",
            "ALTER TABLE challenge_entries ADD COLUMN pillar_id_snapshot INTEGER",
            "ALTER TABLE challenge_entries ADD COLUMN pillar_name_snapshot TEXT",
            "ALTER TABLE challenge_entries ADD COLUMN category_id_snapshot INTEGER",
            "ALTER TABLE challenge_entries ADD COLUMN category_name_snapshot TEXT"
        ]
        
        for sql in challenge_entry_columns:
            try:
                cursor.execute(sql)
                print(f"  ✓ {sql.split('ADD COLUMN')[1].split()[0]}")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    print(f"  ⚠ Column {sql.split('ADD COLUMN')[1].split()[0]} already exists, skipping")
                else:
                    raise
        
        # Backfill challenge_entries with current data
        print("\n  📊 Backfilling challenge_entries with current challenge data...")
        cursor.execute("""
            UPDATE challenge_entries
            SET 
                challenge_name_snapshot = (SELECT name FROM challenges WHERE challenges.id = challenge_entries.challenge_id),
                pillar_id_snapshot = (SELECT pillar_id FROM challenges WHERE challenges.id = challenge_entries.challenge_id),
                pillar_name_snapshot = (SELECT pillars.name FROM challenges 
                                       JOIN pillars ON challenges.pillar_id = pillars.id 
                                       WHERE challenges.id = challenge_entries.challenge_id),
                category_id_snapshot = (SELECT category_id FROM challenges WHERE challenges.id = challenge_entries.challenge_id),
                category_name_snapshot = (SELECT categories.name FROM challenges 
                                         JOIN categories ON challenges.category_id = categories.id 
                                         WHERE challenges.id = challenge_entries.challenge_id)
            WHERE challenge_name_snapshot IS NULL
        """)
        backfilled_challenge_entries = cursor.rowcount
        print(f"  ✓ Backfilled {backfilled_challenge_entries} challenge entries")
        
        # ==============================================
        # 4. Verify migration
        # ==============================================
        print("\n4️⃣  Verifying migration...")
        
        # Check habit_entries columns
        cursor.execute("PRAGMA table_info(habit_entries)")
        habit_entry_cols = {row[1] for row in cursor.fetchall()}
        assert 'habit_name_snapshot' in habit_entry_cols
        assert 'pillar_id_snapshot' in habit_entry_cols
        print("  ✓ habit_entries columns verified")
        
        # Check habit_sessions columns
        cursor.execute("PRAGMA table_info(habit_sessions)")
        habit_session_cols = {row[1] for row in cursor.fetchall()}
        assert 'habit_name_snapshot' in habit_session_cols
        assert 'pillar_id_snapshot' in habit_session_cols
        print("  ✓ habit_sessions columns verified")
        
        # Check challenge_entries columns
        cursor.execute("PRAGMA table_info(challenge_entries)")
        challenge_entry_cols = {row[1] for row in cursor.fetchall()}
        assert 'challenge_name_snapshot' in challenge_entry_cols
        assert 'pillar_id_snapshot' in challenge_entry_cols
        print("  ✓ challenge_entries columns verified")
        
        conn.commit()
        print("\n" + "=" * 60)
        print("✅ Migration 023 completed successfully!")
        print(f"   - Backfilled {backfilled_entries} habit entries")
        print(f"   - Backfilled {backfilled_sessions} habit sessions")
        print(f"   - Backfilled {backfilled_challenge_entries} challenge entries")
        print("=" * 60)
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {str(e)}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print(f"\n🚀 Starting migration at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    run_migration()
    print(f"\n✅ Migration completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
