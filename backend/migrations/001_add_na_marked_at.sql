-- Migration: Add na_marked_at column to tasks table
-- Purpose: Track when tasks are marked as NA (not applicable) to enable auto-hiding after one day
-- Date: 2025-10-22

ALTER TABLE tasks ADD COLUMN na_marked_at TIMESTAMP;
