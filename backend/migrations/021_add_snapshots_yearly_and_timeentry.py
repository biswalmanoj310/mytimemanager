"""
Migration 021: Add snapshot columns to yearly_time_entries and time_entries tables
Purpose: Complete snapshot coverage for all time tracking tables
Date: 2026-01-23
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    
    print(f"📊 Migration 021: Adding snapshot columns to yearly_time_entries and time_entries...")
    print(f"📂 Database: {db_path}")
    print(f"🕐 Started at: {datetime.now()}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        columns_to_add = [
            ("task_name_snapshot", "VARCHAR(255)"),
            ("pillar_id_snapshot", "INTEGER"),
            ("pillar_name_snapshot", "VARCHAR(100)"),
            ("category_id_snapshot", "INTEGER"),
            ("category_name_snapshot", "VARCHAR(100)")
        ]
        
        # ========================================
        # STEP 1: Add snapshot columns to yearly_time_entries
        # ========================================
        print("\n1️⃣  Adding snapshot columns to yearly_time_entries...")
        
        for col_name, col_type in columns_to_add:
            try:
                cursor.execute(f"ALTER TABLE yearly_time_entries ADD COLUMN {col_name} {col_type}")
                print(f"   ✓ Added {col_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    print(f"   ⚠ {col_name} already exists, skipping...")
                else:
                    raise
        
        # ========================================
        # STEP 2: Backfill yearly_time_entries
        # ========================================
        print("\n2️⃣  Backfilling yearly_time_entries with current task data...")
        
        cursor.execute("""
            UPDATE yearly_time_entries
            SET 
                task_name_snapshot = (SELECT name FROM tasks WHERE tasks.id = yearly_time_entries.task_id),
                pillar_id_snapshot = (SELECT pillar_id FROM tasks WHERE tasks.id = yearly_time_entries.task_id),
                pillar_name_snapshot = (
                    SELECT pillars.name 
                    FROM tasks 
                    LEFT JOIN pillars ON tasks.pillar_id = pillars.id 
                    WHERE tasks.id = yearly_time_entries.task_id
                ),
                category_id_snapshot = (SELECT category_id FROM tasks WHERE tasks.id = yearly_time_entries.task_id),
                category_name_snapshot = (
                    SELECT categories.name 
                    FROM tasks 
                    LEFT JOIN categories ON tasks.category_id = categories.id 
                    WHERE tasks.id = yearly_time_entries.task_id
                )
            WHERE task_name_snapshot IS NULL
        """)
        
        rows_updated = cursor.rowcount
        print(f"   ✓ Backfilled {rows_updated} yearly time entries")
        
        # ========================================
        # STEP 3: Add snapshot columns to time_entries (old 30-min slot table)
        # ========================================
        print("\n3️⃣  Adding snapshot columns to time_entries (legacy)...")
        
        for col_name, col_type in columns_to_add:
            try:
                cursor.execute(f"ALTER TABLE time_entries ADD COLUMN {col_name} {col_type}")
                print(f"   ✓ Added {col_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    print(f"   ⚠ {col_name} already exists, skipping...")
                else:
                    raise
        
        # ========================================
        # STEP 4: Backfill time_entries
        # ========================================
        print("\n4️⃣  Backfilling time_entries with current task data...")
        
        cursor.execute("""
            UPDATE time_entries
            SET 
                task_name_snapshot = (SELECT name FROM tasks WHERE tasks.id = time_entries.task_id),
                pillar_id_snapshot = (SELECT pillar_id FROM tasks WHERE tasks.id = time_entries.task_id),
                pillar_name_snapshot = (
                    SELECT pillars.name 
                    FROM tasks 
                    LEFT JOIN pillars ON tasks.pillar_id = pillars.id 
                    WHERE tasks.id = time_entries.task_id
                ),
                category_id_snapshot = (SELECT category_id FROM tasks WHERE tasks.id = time_entries.task_id),
                category_name_snapshot = (
                    SELECT categories.name 
                    FROM tasks 
                    LEFT JOIN categories ON tasks.category_id = categories.id 
                    WHERE tasks.id = time_entries.task_id
                )
            WHERE task_name_snapshot IS NULL
        """)
        
        rows_updated = cursor.rowcount
        print(f"   ✓ Backfilled {rows_updated} time entries")
        
        # ========================================
        # STEP 5: Verify data integrity
        # ========================================
        print("\n5️⃣  Verifying data integrity...")
        
        # Check yearly entries
        cursor.execute("SELECT COUNT(*) FROM yearly_time_entries WHERE task_name_snapshot IS NULL")
        null_count = cursor.fetchone()[0]
        if null_count > 0:
            print(f"   ⚠ Warning: {null_count} yearly entries have NULL snapshots (likely deleted tasks)")
        else:
            print(f"   ✓ All yearly entries have snapshot data")
        
        # Check time entries
        cursor.execute("SELECT COUNT(*) FROM time_entries WHERE task_name_snapshot IS NULL")
        null_count = cursor.fetchone()[0]
        if null_count > 0:
            print(f"   ⚠ Warning: {null_count} time entries have NULL snapshots (likely deleted tasks)")
        else:
            print(f"   ✓ All time entries have snapshot data")
        
        # Commit all changes
        conn.commit()
        
        print(f"\n✅ Migration 021 completed successfully!")
        print(f"🕐 Finished at: {datetime.now()}")
        print(f"\n📝 Summary:")
        print(f"   - Added snapshot columns to yearly_time_entries and time_entries")
        print(f"   - All time tracking tables now have complete snapshot coverage")
        print(f"   - Historical data preserved across ALL time tracking features")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {str(e)}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
