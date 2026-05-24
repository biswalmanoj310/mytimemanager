"""
Migration 043 – Add task_allocation_history table.

This table tracks historical changes to a task's allocated_minutes so that
daily summaries can use the allocation that was in effect on each specific date
rather than always using the current (potentially different) value.

The migration:
  1. Creates the task_allocation_history table.
  2. Backfills one open-ended entry per active daily TIME task using its
     current allocated_minutes, starting from the app's active-usage date
     (2025-11-01).  This baseline is sufficient for all future allocation
     changes – the next time allocated_minutes is edited the backend will
     close this entry with yesterday's date and open a new one, capturing the
     transition correctly.
"""

import sqlite3
import os


def run_migration():
    db_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "database",
        "mytimemanager.db",
    )
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # ------------------------------------------------------------------
        # 1. Create table
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS task_allocation_history (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id          INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                allocated_minutes INTEGER NOT NULL,
                effective_from   DATE NOT NULL,
                effective_to     DATE,
                created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_tah_task_id "
            "ON task_allocation_history(task_id)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_tah_effective_from "
            "ON task_allocation_history(effective_from)"
        )

        # ------------------------------------------------------------------
        # 2. Backfill for existing active daily TIME tasks
        # ------------------------------------------------------------------
        active_start = "2025-11-01"

        cursor.execute("""
            SELECT id, allocated_minutes
            FROM tasks
            WHERE follow_up_frequency = 'daily'
              AND UPPER(task_type) = 'TIME'
              AND is_active = 1
              AND is_completed = 0
              AND (is_daily_one_time = 0 OR is_daily_one_time IS NULL)
        """)
        tasks = cursor.fetchall()

        inserted = 0
        skipped = 0
        for task_id, allocated_minutes in tasks:
            # Skip if any history entry already exists (idempotent re-run)
            cursor.execute(
                "SELECT COUNT(*) FROM task_allocation_history WHERE task_id = ?",
                (task_id,),
            )
            if cursor.fetchone()[0] > 0:
                skipped += 1
                continue

            cursor.execute(
                """
                INSERT INTO task_allocation_history
                    (task_id, allocated_minutes, effective_from, effective_to)
                VALUES (?, ?, ?, NULL)
                """,
                (task_id, allocated_minutes, active_start),
            )
            inserted += 1

        conn.commit()
        print(
            f"✓ Migration 043 complete: table created, "
            f"{inserted} tasks backfilled, {skipped} already had history."
        )

    except Exception as exc:
        conn.rollback()
        print(f"❌ Migration 043 failed: {exc}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
