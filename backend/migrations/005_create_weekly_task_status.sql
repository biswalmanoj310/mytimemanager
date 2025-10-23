-- Migration: Create weekly_task_status table for tracking per-task completion per week
-- This allows marking tasks as complete/NA for specific weeks without affecting the task itself

CREATE TABLE IF NOT EXISTS weekly_task_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    week_start_date DATE NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT 0,
    is_na BOOLEAN NOT NULL DEFAULT 0,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_task_status_task_week ON weekly_task_status(task_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_task_status_week ON weekly_task_status(week_start_date);
