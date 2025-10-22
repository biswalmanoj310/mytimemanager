-- Migration: Create daily_time_entries table for tracking hourly time per day
-- This table stores the actual time spent on each task for each hour of each day

CREATE TABLE IF NOT EXISTS daily_time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    entry_date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK(hour >= 0 AND hour <= 23),
    minutes INTEGER NOT NULL DEFAULT 0 CHECK(minutes >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, entry_date, hour)
);

CREATE INDEX IF NOT EXISTS idx_daily_time_entries_task_date ON daily_time_entries(task_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_daily_time_entries_date ON daily_time_entries(entry_date);

-- Migration: Create daily_summary table for tracking completion status
CREATE TABLE IF NOT EXISTS daily_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_date DATE NOT NULL UNIQUE,
    total_allocated INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0,
    is_complete BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_summary(entry_date);
CREATE INDEX IF NOT EXISTS idx_daily_summary_incomplete ON daily_summary(is_complete) WHERE is_complete = 0;
