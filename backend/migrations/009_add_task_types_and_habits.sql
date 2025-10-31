-- Migration 009: Add habit tracking
-- Date: 2025-10-27
-- Note: task_type columns already exist in tasks table

-- ============================================
-- PART 1: Create habit tracking tables
-- ============================================

-- Main habits table
CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Type of habit
    habit_type VARCHAR(20) NOT NULL CHECK(habit_type IN ('boolean', 'time_based', 'count_based')),
    
    -- Link to existing task (optional - for auto-sync)
    linked_task_id INTEGER,
    
    -- Tracking criteria
    target_frequency VARCHAR(20) NOT NULL CHECK(target_frequency IN ('daily', 'weekly', 'monthly')),
    target_value INTEGER, -- For time_based: minutes, count_based: count
    target_comparison VARCHAR(10) DEFAULT 'at_least' CHECK(target_comparison IN ('at_least', 'at_most', 'exactly')),
    
    -- Habit direction
    is_positive BOOLEAN DEFAULT 1, -- 1 = "do this", 0 = "don't do this"
    
    -- Motivation
    why_reason TEXT,
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE, -- NULL = ongoing
    is_active BOOLEAN DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    
    FOREIGN KEY (linked_task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- Daily habit entries (one per day per habit)
CREATE TABLE IF NOT EXISTS habit_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    entry_date DATE NOT NULL,
    
    -- Success tracking
    is_successful BOOLEAN NOT NULL DEFAULT 0,
    actual_value INTEGER, -- Actual minutes/count achieved
    
    -- Notes
    note TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    UNIQUE(habit_id, entry_date) -- One entry per day per habit
);

-- Streak records (top streaks for motivation)
CREATE TABLE IF NOT EXISTS habit_streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    
    -- Streak details
    start_date DATE NOT NULL,
    end_date DATE, -- NULL = current active streak
    streak_length INTEGER NOT NULL,
    
    -- Is this an active streak?
    is_active BOOLEAN DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);

-- ============================================
-- PART 2: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_habits_linked_task ON habits(linked_task_id);
CREATE INDEX IF NOT EXISTS idx_habits_active ON habits(is_active);
CREATE INDEX IF NOT EXISTS idx_habit_entries_date ON habit_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_habit_entries_habit_date ON habit_entries(habit_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_habit_streaks_active ON habit_streaks(is_active);
