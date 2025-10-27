"""
Datetime utility functions for consistent local timezone handling.

All datetime operations in this application use the system's local timezone.
This ensures consistent behavior regardless of server location or deployment.
"""

from datetime import datetime, date, time


def get_local_datetime() -> datetime:
    """
    Get current datetime in local timezone.
    
    Returns:
        datetime: Current local datetime (timezone-naive)
    """
    return datetime.now()


def get_local_date() -> date:
    """
    Get current date in local timezone.
    
    Returns:
        date: Current local date
    """
    return datetime.now().date()


def get_local_date_str() -> str:
    """
    Get current date as ISO format string (YYYY-MM-DD).
    
    Returns:
        str: Current date in ISO format
    """
    return datetime.now().date().isoformat()


def combine_date_midnight(d: date) -> datetime:
    """
    Combine a date with midnight time (00:00:00).
    
    Args:
        d: Date to combine
        
    Returns:
        datetime: Datetime at midnight on the given date
    """
    return datetime.combine(d, time.min)


def normalize_to_midnight(dt: datetime) -> datetime:
    """
    Normalize a datetime to midnight (00:00:00) on the same date.
    
    Args:
        dt: Datetime to normalize
        
    Returns:
        datetime: Datetime at midnight
    """
    return datetime(dt.year, dt.month, dt.day)
