"""
Migration 046 – Daily-minimum challenges (REQ-271).

Adds to `challenges`:
  daily_target  REAL     – "at least X per day" (e.g. 20 pushups, 90 minutes). A day only counts
                           when the logged value reaches it. NULL = classic total-target challenge.
  required_days INTEGER  – how many days must reach the daily target for the challenge to be won
                           (NULL = every day of the challenge, e.g. 18 gives slack for 20 days).

ALWAYS run ./backup_database.sh first. Safe to re-run.
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
        columns = [row[1] for row in cursor.execute("PRAGMA table_info(challenges)").fetchall()]
        for name, ddl in (("daily_target", "REAL"), ("required_days", "INTEGER")):
            if name in columns:
                print(f"⚠ Column {name} exists, skipping...")
                continue
            cursor.execute(f"ALTER TABLE challenges ADD COLUMN {name} {ddl}")
            print(f"✓ Added challenges.{name}")
        conn.commit()
        print("✓ Migration completed!")
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
