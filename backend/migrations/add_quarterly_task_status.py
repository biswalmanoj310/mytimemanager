"""
Migration: Add quarterly_task_status table.
Quarterly monitoring is fully independent from yearly_task_status.
"""
import sqlite3
import os

def run_migration():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS quarterly_task_status (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                year_start_date DATETIME NOT NULL,
                is_completed BOOLEAN NOT NULL DEFAULT 0,
                is_na BOOLEAN NOT NULL DEFAULT 0,
                completed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_quarterly_task_status_year ON quarterly_task_status(year_start_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_quarterly_task_status_task ON quarterly_task_status(task_id)")
        conn.commit()
        print("✓ quarterly_task_status table created successfully")
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
