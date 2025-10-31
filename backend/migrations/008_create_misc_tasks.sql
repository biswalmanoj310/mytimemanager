-- Migration: Create misc task groups and items tables
-- Date: 2025-10-27
-- Description: Add tables for tracking misc tasks (one-time tasks with hierarchy)
-- Similar to Projects but for simpler, temporary tasks

-- Create misc_task_groups table
CREATE TABLE IF NOT EXISTS misc_task_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    pillar_id INTEGER,
    category_id INTEGER,
    goal_id INTEGER,
    due_date TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    is_completed BOOLEAN NOT NULL DEFAULT 0,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (pillar_id) REFERENCES pillars(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (goal_id) REFERENCES life_goals(id) ON DELETE SET NULL
);

-- Create indexes for misc_task_groups
CREATE INDEX IF NOT EXISTS ix_misc_task_groups_id ON misc_task_groups(id);
CREATE INDEX IF NOT EXISTS ix_misc_task_groups_name ON misc_task_groups(name);
CREATE INDEX IF NOT EXISTS ix_misc_task_groups_due_date ON misc_task_groups(due_date);
CREATE INDEX IF NOT EXISTS ix_misc_task_groups_is_completed ON misc_task_groups(is_completed);

-- Create misc_task_items table
CREATE TABLE IF NOT EXISTS misc_task_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    parent_task_id INTEGER,
    name VARCHAR(300) NOT NULL,
    description TEXT,
    due_date TIMESTAMP,
    priority VARCHAR(10) NOT NULL DEFAULT 'medium',
    is_completed BOOLEAN NOT NULL DEFAULT 0,
    completed_at TIMESTAMP,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES misc_task_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_task_id) REFERENCES misc_task_items(id) ON DELETE CASCADE
);

-- Create indexes for misc_task_items
CREATE INDEX IF NOT EXISTS ix_misc_task_items_id ON misc_task_items(id);
CREATE INDEX IF NOT EXISTS ix_misc_task_items_group_id ON misc_task_items(group_id);
CREATE INDEX IF NOT EXISTS ix_misc_task_items_parent_task_id ON misc_task_items(parent_task_id);
CREATE INDEX IF NOT EXISTS ix_misc_task_items_due_date ON misc_task_items(due_date);
CREATE INDEX IF NOT EXISTS ix_misc_task_items_is_completed ON misc_task_items(is_completed);
