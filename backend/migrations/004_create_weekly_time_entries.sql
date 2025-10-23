-- Migration: Create weekly_time_entries table for tracking weekly time per task
-- This table stores the time spent on each task for each day of each week

CREATE TABLE IF NOT EXISTS weekly_time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    week_start_date DATE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
    minutes INTEGER NOT NULL DEFAULT 0 CHECK(minutes >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, week_start_date, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_weekly_time_entries_task_week ON weekly_time_entries(task_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_time_entries_week ON weekly_time_entries(week_start_date);

-- Migration: Create weekly_summary table for tracking completion status
CREATE TABLE IF NOT EXISTS weekly_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start_date DATE NOT NULL UNIQUE,
    total_allocated INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0,
    is_complete BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_weekly_summary_week ON weekly_summary(week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_summary_incomplete ON weekly_summary(is_complete) WHERE is_complete = 0;
