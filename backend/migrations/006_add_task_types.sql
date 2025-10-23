-- Migration: Add task type support (time, count, boolean)
-- This enables tracking different types of habits and tasks

-- Add new columns to tasks table
-- task_type: Type of task - 'time' (minutes), 'count' (reps/numbers), or 'boolean' (yes/no)
-- target_value: Target value for count-based tasks (e.g., 10 push-ups, 5 glasses of water)
-- unit: Unit for count-based tasks (e.g., reps, glasses, miles, pages)

ALTER TABLE tasks ADD COLUMN task_type VARCHAR(20) DEFAULT 'time' NOT NULL;
ALTER TABLE tasks ADD COLUMN target_value INTEGER DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN unit VARCHAR(50) DEFAULT NULL;

-- Update existing tasks to have proper defaults
UPDATE tasks SET task_type = 'time' WHERE task_type IS NULL;

-- Note: daily_time_entries.minutes will store:
-- - For time tasks: minutes spent
-- - For count tasks: count/quantity achieved
-- - For boolean tasks: 1 (yes/done) or 0 (no/not done)
