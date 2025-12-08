"""
Migration: Add Important Tasks table for periodic check tasks
- ideal_gap_days: Expected days between checks (e.g., 45 for bank account)
- last_check_date: Last time task was checked/completed
- priority: 1-10 integer priority for NOW tab integration
"""

import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent.parent / "database" / "mytimemanager.db"

def migrate():
    db_path = str(DB_PATH)
    print(f"Connecting to database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("\n1. Creating important_tasks table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS important_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                
                -- Organization
                pillar_id INTEGER,
                category_id INTEGER,
                sub_category_id INTEGER,
                
                -- Periodic check parameters
                ideal_gap_days INTEGER NOT NULL,
                last_check_date TIMESTAMP,
                check_history TEXT,  -- JSON array of check dates
                
                -- Priority & Status
                priority INTEGER DEFAULT 5,
                is_active BOOLEAN DEFAULT 1,
                
                -- Timestamps
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                
                FOREIGN KEY (pillar_id) REFERENCES pillars(id),
                FOREIGN KEY (category_id) REFERENCES categories(id),
                FOREIGN KEY (sub_category_id) REFERENCES sub_categories(id)
            )
        """)
        print("   ✓ Created important_tasks table")
        
        print("\n2. Adding priority_new and allocated_minutes to misc_task_items...")
        try:
            cursor.execute("ALTER TABLE misc_task_items ADD COLUMN priority_new INTEGER DEFAULT 5")
            print("   ✓ Added priority_new column")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print("   ⚠ priority_new already exists")
            else:
                raise
        
        try:
            cursor.execute("ALTER TABLE misc_task_items ADD COLUMN allocated_minutes INTEGER DEFAULT 60")
            print("   ✓ Added allocated_minutes column")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print("   ⚠ allocated_minutes already exists")
            else:
                raise
        
        # Convert string priority to integer for misc tasks
        print("\n3. Converting misc_task_items priority to integer...")
        cursor.execute("""
            UPDATE misc_task_items 
            SET priority_new = CASE 
                WHEN priority = 'high' THEN 2
                WHEN priority = 'medium' THEN 5
                WHEN priority = 'low' THEN 8
                ELSE 5
            END
            WHERE priority_new IS NULL OR priority_new = 5
        """)
        print(f"   ✓ Converted {cursor.rowcount} misc task priorities")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
        # Summary
        cursor.execute("SELECT COUNT(*) FROM important_tasks")
        important_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM misc_task_items")
        misc_count = cursor.fetchone()[0]
        
        print(f"\n📊 Summary:")
        print(f"   - important_tasks table created ({important_count} rows)")
        print(f"   - {misc_count} misc tasks now have integer priority + allocated_minutes")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Add Important Tasks & Enhance Misc Tasks")
    print("=" * 60)
    migrate()
