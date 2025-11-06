-- Migration 016: Add daily_task_status table for per-date task tracking
-- Purpose: Track task completion, NA status, and tracking status on a per-date basis
-- This allows tasks to have different states on different dates (SQLite version)

-- Create the daily_task_status table
CREATE TABLE IF NOT EXISTS daily_task_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT 0 NOT NULL,
    is_na BOOLEAN DEFAULT 0 NOT NULL,
    is_tracked BOOLEAN DEFAULT 1 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_task_status_task_id ON daily_task_status(task_id);
CREATE INDEX IF NOT EXISTS idx_daily_task_status_date ON daily_task_status(date);
CREATE INDEX IF NOT EXISTS idx_daily_task_status_is_tracked ON daily_task_status(is_tracked);

-- Create trigger to auto-update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_daily_task_status_updated_at 
    AFTER UPDATE ON daily_task_status
    FOR EACH ROW
BEGIN
    UPDATE daily_task_status SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
