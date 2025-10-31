-- Migration 010: Add habit sessions for weekly/monthly occurrence tracking
-- This supports habits like "Gym 4x/week" or "Review 2x/month"

-- Table to track individual sessions/occurrences of a habit within a period
CREATE TABLE IF NOT EXISTS habit_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    period_type VARCHAR(20) NOT NULL, -- 'week' or 'month'
    period_start DATE NOT NULL, -- Start of the week/month
    period_end DATE NOT NULL, -- End of the week/month
    session_number INTEGER NOT NULL, -- 1, 2, 3, 4 (which occurrence this is)
    completed_at TIMESTAMP, -- When this session was marked complete
    is_completed BOOLEAN DEFAULT FALSE,
    value_achieved INTEGER, -- For "occurrence_with_value" mode (e.g., 60 min, 50 pages)
    meets_target BOOLEAN, -- Did this session meet the individual target? (e.g., >= 45 min)
    notes TEXT, -- Optional notes for this session
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    UNIQUE(habit_id, period_start, session_number)
);

-- Table to track overall period completion (weekly/monthly summary)
CREATE TABLE IF NOT EXISTS habit_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    period_type VARCHAR(20) NOT NULL, -- 'week' or 'month'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    target_count INTEGER, -- For occurrence mode: how many times (e.g., 4 for "4x/week")
    completed_count INTEGER DEFAULT 0, -- For occurrence mode: how many done
    aggregate_target INTEGER, -- For aggregate mode: total target (e.g., 300 pages)
    aggregate_achieved INTEGER DEFAULT 0, -- For aggregate mode: total achieved
    is_successful BOOLEAN DEFAULT FALSE, -- Did we hit the target?
    success_percentage DECIMAL(5,2), -- Progress percentage
    quality_percentage DECIMAL(5,2), -- For occurrence_with_value: % of sessions that met individual target
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    UNIQUE(habit_id, period_start)
);

-- Update habits table to support weekly/monthly occurrence targets
ALTER TABLE habits ADD COLUMN target_count_per_period INTEGER; -- e.g., 4 for "4x per week"
ALTER TABLE habits ADD COLUMN period_type VARCHAR(20); -- 'daily', 'weekly', 'monthly'
ALTER TABLE habits ADD COLUMN tracking_mode VARCHAR(30); -- 'occurrence', 'occurrence_with_value', 'aggregate'
ALTER TABLE habits ADD COLUMN session_target_value INTEGER; -- e.g., 45 for "45 min per session"
ALTER TABLE habits ADD COLUMN session_target_unit VARCHAR(20); -- 'minutes', 'pages', 'reps', 'km', etc.
ALTER TABLE habits ADD COLUMN aggregate_target INTEGER; -- e.g., 300 for "300 pages per week"

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_habit_sessions_habit_period ON habit_sessions(habit_id, period_start);
CREATE INDEX IF NOT EXISTS idx_habit_periods_habit_period ON habit_periods(habit_id, period_start);
CREATE INDEX IF NOT EXISTS idx_habit_sessions_completed ON habit_sessions(habit_id, is_completed, completed_at);
