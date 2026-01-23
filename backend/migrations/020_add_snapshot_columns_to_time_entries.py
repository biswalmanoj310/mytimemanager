"""
Migration 020: Add snapshot columns to time entry tables
Purpose: Preserve historical task/pillar/category data when tasks are deleted or modified
Date: 2026-01-23
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    
    print(f"📊 Migration 020: Adding snapshot columns to time entry tables...")
    print(f"📂 Database: {db_path}")
    print(f"🕐 Started at: {datetime.now()}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # ========================================
        # STEP 1: Add snapshot columns to daily_time_entries
        # ========================================
        print("\n1️⃣  Adding snapshot columns to daily_time_entries...")
        
        columns_to_add = [
            ("task_name_snapshot", "VARCHAR(255)"),
            ("pillar_id_snapshot", "INTEGER"),
            ("pillar_name_snapshot", "VARCHAR(100)"),
            ("category_id_snapshot", "INTEGER"),
            ("category_name_snapshot", "VARCHAR(100)")
        ]
        
        for col_name, col_type in columns_to_add:
            try:
                cursor.execute(f"ALTER TABLE daily_time_entries ADD COLUMN {col_name} {col_type}")
                print(f"   ✓ Added {col_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    print(f"   ⚠ {col_name} already exists, skipping...")
                else:
                    raise
        
        # ========================================
        # STEP 2: Backfill daily_time_entries with current data
        # ========================================
        print("\n2️⃣  Backfilling daily_time_entries with current task data...")
        
        cursor.execute("""
            UPDATE daily_time_entries
            SET 
                task_name_snapshot = (SELECT name FROM tasks WHERE tasks.id = daily_time_entries.task_id),
                pillar_id_snapshot = (SELECT pillar_id FROM tasks WHERE tasks.id = daily_time_entries.task_id),
                pillar_name_snapshot = (
                    SELECT pillars.name 
                    FROM tasks 
                    LEFT JOIN pillars ON tasks.pillar_id = pillars.id 
                    WHERE tasks.id = daily_time_entries.task_id
                ),
                category_id_snapshot = (SELECT category_id FROM tasks WHERE tasks.id = daily_time_entries.task_id),
                category_name_snapshot = (
                    SELECT categories.name 
                    FROM tasks 
                    LEFT JOIN categories ON tasks.category_id = categories.id 
                    WHERE tasks.id = daily_time_entries.task_id
                )
            WHERE task_name_snapshot IS NULL
        """)
        
        rows_updated = cursor.rowcount
        print(f"   ✓ Backfilled {rows_updated} daily time entries")
        
        # ========================================
        # STEP 3: Add snapshot columns to weekly_time_entries
        # ========================================
        print("\n3️⃣  Adding snapshot columns to weekly_time_entries...")
        
        for col_name, col_type in columns_to_add:
            try:
                cursor.execute(f"ALTER TABLE weekly_time_entries ADD COLUMN {col_name} {col_type}")
                print(f"   ✓ Added {col_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    print(f"   ⚠ {col_name} already exists, skipping...")
                else:
                    raise
        
        # ========================================
        # STEP 4: Backfill weekly_time_entries
        # ========================================
        print("\n4️⃣  Backfilling weekly_time_entries with current task data...")
        
        cursor.execute("""
            UPDATE weekly_time_entries
            SET 
                task_name_snapshot = (SELECT name FROM tasks WHERE tasks.id = weekly_time_entries.task_id),
                pillar_id_snapshot = (SELECT pillar_id FROM tasks WHERE tasks.id = weekly_time_entries.task_id),
                pillar_name_snapshot = (
                    SELECT pillars.name 
                    FROM tasks 
                    LEFT JOIN pillars ON tasks.pillar_id = pillars.id 
                    WHERE tasks.id = weekly_time_entries.task_id
                ),
                category_id_snapshot = (SELECT category_id FROM tasks WHERE tasks.id = weekly_time_entries.task_id),
                category_name_snapshot = (
                    SELECT categories.name 
                    FROM tasks 
                    LEFT JOIN categories ON tasks.category_id = categories.id 
                    WHERE tasks.id = weekly_time_entries.task_id
                )
            WHERE task_name_snapshot IS NULL
        """)
        
        rows_updated = cursor.rowcount
        print(f"   ✓ Backfilled {rows_updated} weekly time entries")
        
        # ========================================
        # STEP 5: Add snapshot columns to monthly_time_entries
        # ========================================
        print("\n5️⃣  Adding snapshot columns to monthly_time_entries...")
        
        for col_name, col_type in columns_to_add:
            try:
                cursor.execute(f"ALTER TABLE monthly_time_entries ADD COLUMN {col_name} {col_type}")
                print(f"   ✓ Added {col_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    print(f"   ⚠ {col_name} already exists, skipping...")
                else:
                    raise
        
        # ========================================
        # STEP 6: Backfill monthly_time_entries
        # ========================================
        print("\n6️⃣  Backfilling monthly_time_entries with current task data...")
        
        cursor.execute("""
            UPDATE monthly_time_entries
            SET 
                task_name_snapshot = (SELECT name FROM tasks WHERE tasks.id = monthly_time_entries.task_id),
                pillar_id_snapshot = (SELECT pillar_id FROM tasks WHERE tasks.id = monthly_time_entries.task_id),
                pillar_name_snapshot = (
                    SELECT pillars.name 
                    FROM tasks 
                    LEFT JOIN pillars ON tasks.pillar_id = pillars.id 
                    WHERE tasks.id = monthly_time_entries.task_id
                ),
                category_id_snapshot = (SELECT category_id FROM tasks WHERE tasks.id = monthly_time_entries.task_id),
                category_name_snapshot = (
                    SELECT categories.name 
                    FROM tasks 
                    LEFT JOIN categories ON tasks.category_id = categories.id 
                    WHERE tasks.id = monthly_time_entries.task_id
                )
            WHERE task_name_snapshot IS NULL
        """)
        
        rows_updated = cursor.rowcount
        print(f"   ✓ Backfilled {rows_updated} monthly time entries")
        
        # ========================================
        # STEP 7: Verify data integrity
        # ========================================
        print("\n7️⃣  Verifying data integrity...")
        
        # Check daily entries
        cursor.execute("SELECT COUNT(*) FROM daily_time_entries WHERE task_name_snapshot IS NULL")
        null_count = cursor.fetchone()[0]
        if null_count > 0:
            print(f"   ⚠ Warning: {null_count} daily entries have NULL snapshots (likely deleted tasks)")
        else:
            print(f"   ✓ All daily entries have snapshot data")
        
        # Check weekly entries
        cursor.execute("SELECT COUNT(*) FROM weekly_time_entries WHERE task_name_snapshot IS NULL")
        null_count = cursor.fetchone()[0]
        if null_count > 0:
            print(f"   ⚠ Warning: {null_count} weekly entries have NULL snapshots (likely deleted tasks)")
        else:
            print(f"   ✓ All weekly entries have snapshot data")
        
        # Check monthly entries
        cursor.execute("SELECT COUNT(*) FROM monthly_time_entries WHERE task_name_snapshot IS NULL")
        null_count = cursor.fetchone()[0]
        if null_count > 0:
            print(f"   ⚠ Warning: {null_count} monthly entries have NULL snapshots (likely deleted tasks)")
        else:
            print(f"   ✓ All monthly entries have snapshot data")
        
        # Commit all changes
        conn.commit()
        
        print(f"\n✅ Migration 020 completed successfully!")
        print(f"🕐 Finished at: {datetime.now()}")
        print(f"\n📝 Summary:")
        print(f"   - Added 5 snapshot columns to 3 time entry tables (15 columns total)")
        print(f"   - Backfilled all existing entries with current task/pillar/category data")
        print(f"   - Historical data is now preserved even if tasks are deleted/modified")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {str(e)}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
