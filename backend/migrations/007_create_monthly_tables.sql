-- Migration: Create monthly time entries and status tables
-- Date: 2025-10-23
-- Description: Add tables for tracking monthly time entries and task completion status

-- Create monthly_time_entries table
CREATE TABLE IF NOT EXISTS monthly_time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    month_start_date TIMESTAMP NOT NULL,
    day_of_month INTEGER NOT NULL,
    minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Create indexes for monthly_time_entries
CREATE INDEX IF NOT EXISTS ix_monthly_time_entries_task_id ON monthly_time_entries(task_id);
CREATE INDEX IF NOT EXISTS ix_monthly_time_entries_month_start_date ON monthly_time_entries(month_start_date);
CREATE INDEX IF NOT EXISTS ix_monthly_time_entries_task_month ON monthly_time_entries(task_id, month_start_date);

-- Create monthly_task_status table
CREATE TABLE IF NOT EXISTS monthly_task_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    month_start_date TIMESTAMP NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT 0,
    is_na BOOLEAN NOT NULL DEFAULT 0,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Create indexes for monthly_task_status
CREATE INDEX IF NOT EXISTS ix_monthly_task_status_task_id ON monthly_task_status(task_id);
CREATE INDEX IF NOT EXISTS ix_monthly_task_status_month_start_date ON monthly_task_status(month_start_date);
CREATE INDEX IF NOT EXISTS ix_monthly_task_status_task_month ON monthly_task_status(task_id, month_start_date);
