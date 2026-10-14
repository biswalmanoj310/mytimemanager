"""
Single source of truth for "which day does the week start on" (backend).

Change WEEK_START_WEEKDAY to move the start of every week-based calculation.
Frontend counterpart: WEEK_START_DAY in frontend/src/utils/dateHelpers.ts (keep in sync).
"""

from datetime import date, timedelta

# Python weekday numbering: Monday=0 ... Saturday=5, Sunday=6
WEEK_START_WEEKDAY = 6  # Sunday (REQ-261)


def get_week_start(d: date) -> date:
    """Return the first day of the week containing `d`."""
    return d - timedelta(days=(d.weekday() - WEEK_START_WEEKDAY) % 7)
