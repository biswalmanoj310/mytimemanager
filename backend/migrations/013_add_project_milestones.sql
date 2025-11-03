-- Migration: Add Project Milestones and Enhance Project Tracking
-- Date: 2025-10-31

-- Create project_milestones table
CREATE TABLE IF NOT EXISTS project_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT 0,
    completed_at DATETIME,
    "order" INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_target_date ON project_milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_project_milestones_completed ON project_milestones(is_completed);
