-- Add milestone_id to project_tasks table
-- This allows linking project tasks to milestones for better progress tracking

ALTER TABLE project_tasks ADD COLUMN milestone_id INTEGER;

-- Add foreign key constraint
-- Note: SQLite doesn't support adding foreign keys to existing tables easily
-- We'll handle this in the application layer for now

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_project_tasks_milestone_id ON project_tasks(milestone_id);

-- Optional: You can verify the changes with:
-- SELECT sql FROM sqlite_master WHERE type='table' AND name='project_tasks';
