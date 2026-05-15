"""
Migration 042: Add postpone_count to tasks table
Tracks how many times a task's due_date has been moved forward (postponed).
"""
import sqlite3
import os


def run_migration():
    db_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'database', 'mytimemanager.db'
    )
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute(
            "ALTER TABLE tasks ADD COLUMN postpone_count INTEGER DEFAULT 0"
        )
        conn.commit()
        print("✓ Migration 042 complete: added postpone_count to tasks")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("⚠  Column postpone_count already exists, skipping.")
        else:
            raise
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
