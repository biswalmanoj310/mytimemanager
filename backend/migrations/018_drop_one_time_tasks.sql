-- Migration 018: Drop one_time_tasks table
-- This table is being replaced by the important_tasks table
-- Reason: Consolidating periodic check tasks into a single, well-designed system

-- Drop the one_time_tasks table
DROP TABLE IF EXISTS one_time_tasks;
