-- Migration 016: Add daily task status tracking
-- This allows tracking completion/NA status per task per date
-- Also tracks which tasks are actively being monitored on each date

-- Daily task status table
CREATE TABLE IF NOT EXISTS daily_task_status (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    is_na BOOLEAN DEFAULT FALSE,
    is_tracked BOOLEAN DEFAULT TRUE,  -- Whether this task is being tracked on this date
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, date)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_task_status_date ON daily_task_status(date);
CREATE INDEX IF NOT EXISTS idx_daily_task_status_task_date ON daily_task_status(task_id, date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_task_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_daily_task_status_updated_at ON daily_task_status;
CREATE TRIGGER trigger_update_daily_task_status_updated_at
    BEFORE UPDATE ON daily_task_status
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_task_status_updated_at();

-- Comments
COMMENT ON TABLE daily_task_status IS 'Tracks completion/NA status and tracking status for each task on each date';
COMMENT ON COLUMN daily_task_status.is_tracked IS 'Whether this task is actively being tracked on this date (false = removed from tracking)';
COMMENT ON COLUMN daily_task_status.is_completed IS 'Whether this task was marked as completed on this date';
COMMENT ON COLUMN daily_task_status.is_na IS 'Whether this task was marked as N/A on this date';
