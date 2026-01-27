"""
Timezone utilities for consistent datetime handling across all platforms.
Ensures local time is used consistently regardless of OS (Windows, Mac, Linux).
"""

from datetime import datetime, timezone
from typing import Optional


def get_local_now() -> datetime:
    """
    Get current local time as a naive datetime (no timezone info).
    This is consistent across all operating systems.
    
    Returns:
        datetime: Current local time without timezone info
        
    Usage:
        task.created_at = get_local_now()  # Instead of func.now() or datetime.utcnow()
    """
    return datetime.now()


def get_local_date_start() -> datetime:
    """
    Get start of current local day (midnight today).
    
    Returns:
        datetime: Today at 00:00:00 local time
    """
    now = datetime.now()
    return datetime(now.year, now.month, now.day, 0, 0, 0)


def to_local_date_start(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Convert a datetime to start of its local day (set time to 00:00:00).
    
    Args:
        dt: Input datetime (can be timezone-aware or naive)
        
    Returns:
        datetime: Same date at 00:00:00, or None if input is None
        
    Usage:
        task_date = to_local_date_start(task.created_at)
    """
    if dt is None:
        return None
    
    # If timezone-aware, convert to local time first
    if dt.tzinfo is not None:
        dt = dt.astimezone().replace(tzinfo=None)
    
    return datetime(dt.year, dt.month, dt.day, 0, 0, 0)


def parse_date_string(date_str: str) -> datetime:
    """
    Parse date string from frontend (YYYY-MM-DD) to local datetime at midnight.
    
    Args:
        date_str: Date string in YYYY-MM-DD format
        
    Returns:
        datetime: Parsed date at 00:00:00 local time
        
    Raises:
        ValueError: If date string format is invalid
        
    Usage:
        selected_date = parse_date_string(params.get('date'))
    """
    try:
        return datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        raise ValueError(f"Invalid date format: {date_str}. Expected YYYY-MM-DD")


def format_for_frontend(dt: Optional[datetime]) -> Optional[str]:
    """
    Format datetime for frontend display (ISO format without timezone).
    
    Args:
        dt: Datetime to format
        
    Returns:
        str: ISO format string (YYYY-MM-DDTHH:MM:SS), or None if input is None
        
    Usage:
        response_data['created_at'] = format_for_frontend(task.created_at)
    """
    if dt is None:
        return None
    
    # If timezone-aware, convert to local time first
    if dt.tzinfo is not None:
        dt = dt.astimezone().replace(tzinfo=None)
    
    return dt.isoformat()


def is_same_day(dt1: datetime, dt2: datetime) -> bool:
    """
    Check if two datetimes are on the same local day.
    
    Args:
        dt1: First datetime
        dt2: Second datetime
        
    Returns:
        bool: True if both are on the same calendar day
        
    Usage:
        if is_same_day(task.created_at, selected_date):
            # Task was created on selected date
    """
    # Convert both to local dates (midnight)
    date1 = to_local_date_start(dt1)
    date2 = to_local_date_start(dt2)
    
    return date1 == date2


# Constants for common use cases
LOCAL_NOW = property(get_local_now)  # Can be used as timezone_utils.LOCAL_NOW


# Migration helper: Convert UTC timestamps to local time
def convert_utc_to_local(utc_dt: datetime, timezone_offset_hours: int = -8) -> datetime:
    """
    Convert UTC datetime to local time (used for fixing old data).
    
    Args:
        utc_dt: UTC datetime
        timezone_offset_hours: Hours difference from UTC (e.g., PST = -8, EST = -5)
        
    Returns:
        datetime: Local time (naive)
        
    Note:
        This is for DATA MIGRATION only. Normal code should use get_local_now().
    """
    from datetime import timedelta
    return utc_dt + timedelta(hours=timezone_offset_hours)
