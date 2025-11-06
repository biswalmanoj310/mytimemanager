-- Migration: Add pillar_id to life_goals and goal_projects tables
-- Purpose: Associate goals and projects with pillars and categories for better organization

-- Add pillar_id to life_goals table
ALTER TABLE life_goals ADD COLUMN pillar_id INTEGER REFERENCES pillars(id) ON DELETE SET NULL;

-- Add pillar_id and category_id to goal_projects table
ALTER TABLE goal_projects ADD COLUMN pillar_id INTEGER REFERENCES pillars(id) ON DELETE SET NULL;
ALTER TABLE goal_projects ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_life_goals_pillar_id ON life_goals(pillar_id);
CREATE INDEX IF NOT EXISTS idx_goal_projects_pillar_id ON goal_projects(pillar_id);
CREATE INDEX IF NOT EXISTS idx_goal_projects_category_id ON goal_projects(category_id);
