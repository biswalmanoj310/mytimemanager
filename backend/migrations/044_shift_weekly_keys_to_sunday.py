"""
Migration 044 – Shift weekly period keys from Monday to Sunday (REQ-261).

The week now starts on Sunday, so every row keyed by a Monday week_start_date
(weekly_task_status, weekly_summary, weekly_time_entries) is moved back one day to
the Sunday that starts the same Mon-Sun block's new week. Rows already keyed by a
non-Monday date are left untouched, so the migration is safe to re-run.

Collision handling (a Sunday-keyed row already exists for the target week):
  - weekly_task_status: keep whichever row carries a completed/NA flag; if neither
    does, the Monday-keyed row wins.
  - weekly_summary / weekly_time_entries: the already-existing Sunday row wins.

ALWAYS run ./backup_database.sh first.
"""

import sqlite3
import os


def _shifted(col):
    # Keep the stored text format (e.g. "2026-10-12 00:00:00.000000"), only move the date part
    return f"date({col}, '-1 day') || substr({col}, 11)"


def run_migration():
    db_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "database",
        "mytimemanager.db",
    )
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # --- weekly_task_status (unique: task_id, week_start_date) ---
        rows = cursor.execute(
            "SELECT id, task_id, is_completed, is_na, date(week_start_date, '-1 day') "
            "FROM weekly_task_status WHERE strftime('%w', week_start_date) = '1'"
        ).fetchall()
        shifted = dropped = 0
        for row_id, task_id, is_completed, is_na, new_date in rows:
            clash = cursor.execute(
                "SELECT id, is_completed, is_na FROM weekly_task_status "
                "WHERE task_id = ? AND date(week_start_date) = ?",
                (task_id, new_date),
            ).fetchone()
            if clash:
                clash_id, clash_completed, clash_na = clash
                if clash_completed or clash_na:
                    cursor.execute("DELETE FROM weekly_task_status WHERE id = ?", (row_id,))
                    dropped += 1
                    continue
                cursor.execute("DELETE FROM weekly_task_status WHERE id = ?", (clash_id,))
                dropped += 1
            cursor.execute(
                f"UPDATE weekly_task_status SET week_start_date = {_shifted('week_start_date')} WHERE id = ?",
                (row_id,),
            )
            shifted += 1
        print(f"✓ weekly_task_status: shifted {shifted}, dropped {dropped} duplicate(s)")

        # --- weekly_summary (unique: week_start_date) ---
        rows = cursor.execute(
            "SELECT id, date(week_start_date, '-1 day') FROM weekly_summary "
            "WHERE strftime('%w', week_start_date) = '1'"
        ).fetchall()
        shifted = dropped = 0
        for row_id, new_date in rows:
            clash = cursor.execute(
                "SELECT 1 FROM weekly_summary WHERE date(week_start_date) = ?", (new_date,)
            ).fetchone()
            if clash:
                cursor.execute("DELETE FROM weekly_summary WHERE id = ?", (row_id,))
                dropped += 1
                continue
            cursor.execute(
                f"UPDATE weekly_summary SET week_start_date = {_shifted('week_start_date')} WHERE id = ?",
                (row_id,),
            )
            shifted += 1
        print(f"✓ weekly_summary: shifted {shifted}, dropped {dropped} duplicate(s)")

        # --- weekly_time_entries (unique: task_id, week_start_date, day_of_week) ---
        # day_of_week is an offset from week_start_date, so shifting the key also
        # shifts the day: offset+1 keeps the real calendar date unchanged.
        rows = cursor.execute(
            "SELECT id, task_id, day_of_week, date(week_start_date, '-1 day') "
            "FROM weekly_time_entries WHERE strftime('%w', week_start_date) = '1' "
            "ORDER BY day_of_week DESC"
        ).fetchall()
        shifted = dropped = 0
        for row_id, task_id, day_of_week, new_date in rows:
            if day_of_week >= 6:
                # Sunday of the old Mon-Sun week becomes day 0 of the *next* Sunday-start week
                new_date = cursor.execute("SELECT date(?, '+7 day')", (new_date,)).fetchone()[0]
                new_day = 0
            else:
                new_day = day_of_week + 1
            clash = cursor.execute(
                "SELECT 1 FROM weekly_time_entries WHERE task_id = ? AND date(week_start_date) = ? AND day_of_week = ?",
                (task_id, new_date, new_day),
            ).fetchone()
            if clash:
                cursor.execute("DELETE FROM weekly_time_entries WHERE id = ?", (row_id,))
                dropped += 1
                continue
            cursor.execute(
                "UPDATE weekly_time_entries SET week_start_date = ? || substr(week_start_date, 11), day_of_week = ? WHERE id = ?",
                (new_date, new_day, row_id),
            )
            shifted += 1
        print(f"✓ weekly_time_entries: shifted {shifted}, dropped {dropped} duplicate(s)")

        conn.commit()
        print("✓ Migration 044 completed!")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
