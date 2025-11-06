-- Migration 017: Add ignore functionality to daily_summary
-- Purpose: Allow users to mark days as ignored (travel, sick days, etc.)

ALTER TABLE daily_summary ADD COLUMN is_ignored BOOLEAN DEFAULT FALSE;
ALTER TABLE daily_summary ADD COLUMN ignore_reason TEXT;
ALTER TABLE daily_summary ADD COLUMN ignored_at TIMESTAMP;

-- Create index for faster queries on ignored days
CREATE INDEX IF NOT EXISTS idx_daily_summary_is_ignored ON daily_summary(is_ignored);
