"""
Migration 045 – Shift weekly habit periods/sessions from Monday to Sunday (REQ-261).

Companion to migration 044. habit_periods and habit_sessions with a weekly
period_type are keyed by period_start (a Monday) and period_end (a Sunday). With
the week now starting on Sunday they move back one day (Mon-Sun -> Sun-Sat).
Rows that don't start on a Monday are left alone, so the migration is re-runnable.
A row whose shifted key already exists is skipped (left unshifted) rather than merged.

ALWAYS run ./backup_database.sh first.
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
        # habit_periods: UNIQUE(habit_id, period_start)
        rows = cursor.execute(
            "SELECT id, habit_id, date(period_start, '-1 day') FROM habit_periods "
            "WHERE period_type IN ('weekly', 'week') AND strftime('%w', period_start) = '1'"
        ).fetchall()
        shifted = skipped = 0
        for row_id, habit_id, new_start in rows:
            clash = cursor.execute(
                "SELECT 1 FROM habit_periods WHERE habit_id = ? AND period_start = ?",
                (habit_id, new_start),
            ).fetchone()
            if clash:
                skipped += 1
                continue
            cursor.execute(
                "UPDATE habit_periods SET period_start = date(period_start, '-1 day'), "
                "period_end = date(period_end, '-1 day') WHERE id = ?",
                (row_id,),
            )
            shifted += 1
        print(f"✓ habit_periods: shifted {shifted}, skipped {skipped} (key clash)")

        # habit_sessions: UNIQUE(habit_id, period_start, session_number)
        rows = cursor.execute(
            "SELECT id, habit_id, session_number, date(period_start, '-1 day') FROM habit_sessions "
            "WHERE period_type IN ('weekly', 'week') AND strftime('%w', period_start) = '1'"
        ).fetchall()
        shifted = skipped = 0
        for row_id, habit_id, session_number, new_start in rows:
            clash = cursor.execute(
                "SELECT 1 FROM habit_sessions WHERE habit_id = ? AND period_start = ? AND session_number = ?",
                (habit_id, new_start, session_number),
            ).fetchone()
            if clash:
                skipped += 1
                continue
            cursor.execute(
                "UPDATE habit_sessions SET period_start = date(period_start, '-1 day'), "
                "period_end = date(period_end, '-1 day') WHERE id = ?",
                (row_id,),
            )
            shifted += 1
        print(f"✓ habit_sessions: shifted {shifted}, skipped {skipped} (key clash)")

        conn.commit()
        print("✓ Migration 045 completed!")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
