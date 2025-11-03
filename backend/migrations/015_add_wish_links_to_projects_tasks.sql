-- Migration 015: Add wish/dream links to projects and tasks
-- This allows tracking which projects and tasks are related to specific dreams

-- Add related_wish_id to projects table
ALTER TABLE projects ADD COLUMN related_wish_id INTEGER REFERENCES wishes(id) ON DELETE SET NULL;

-- Add related_wish_id to tasks table
ALTER TABLE tasks ADD COLUMN related_wish_id INTEGER REFERENCES wishes(id) ON DELETE SET NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_related_wish ON projects(related_wish_id);
CREATE INDEX IF NOT EXISTS idx_tasks_related_wish ON tasks(related_wish_id);
