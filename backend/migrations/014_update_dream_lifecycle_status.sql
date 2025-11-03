-- Migration 014: Update Dream Board Lifecycle Status Values
-- Enhanced status system based on dream lifecycle philosophy

-- Update status column to support new lifecycle states
-- Old states: dreaming, exploring, planning, ready_to_commit, converted, archived
-- New states: dreaming, exploring, ready, moved_to_goal, achieved, released

-- Map old status to new status
UPDATE wishes SET status = 'ready' WHERE status = 'ready_to_commit';
UPDATE wishes SET status = 'ready' WHERE status = 'planning';
UPDATE wishes SET status = 'moved_to_goal' WHERE status = 'converted';
UPDATE wishes SET status = 'released' WHERE status = 'archived';

-- Add new columns for enhanced dream tracking
ALTER TABLE wishes ADD COLUMN achieved_at TIMESTAMP;
ALTER TABLE wishes ADD COLUMN released_at TIMESTAMP;
ALTER TABLE wishes ADD COLUMN release_reason TEXT; -- why let go: no longer resonates, circumstances changed, priorities shifted, naturally outgrew
ALTER TABLE wishes ADD COLUMN achievement_notes TEXT; -- how it manifested
ALTER TABLE wishes ADD COLUMN linked_goal_id INTEGER; -- reference to life goal if moved

-- Add index for linked goal
CREATE INDEX IF NOT EXISTS idx_wishes_linked_goal ON wishes(linked_goal_id);

-- Add foreign key constraint for linked goal
-- Note: SQLite doesn't support adding FK constraints to existing tables directly
-- This will be handled in application logic
