-- Add missing daily tasks directly to database
-- Fix pillar-category relationships and add missing tasks

-- 1. Create "My Tasks" category under Family
INSERT INTO categories (name, pillar_id, allocated_hours) VALUES ('My Tasks', 3, 0);

-- Get the new category ID (it should be 7)
-- 2. Add Confidence tasks under Calmness pillar (not Hard Work)
INSERT INTO tasks (name, pillar_id, category_id, allocated_minutes, spent_minutes, follow_up_frequency, separately_followed, is_part_of_goal, is_active, is_completed) 
VALUES 
('Life Coach & NLP', 2, 3, 30, 0, 'daily', 0, 0, 1, 0),
('Toastmaster Task', 2, 3, 60, 0, 'daily', 0, 0, 1, 0);

-- 3. Add My Tasks under Family pillar
INSERT INTO tasks (name, pillar_id, category_id, allocated_minutes, spent_minutes, follow_up_frequency, separately_followed, is_part_of_goal, is_active, is_completed) 
VALUES 
('Planning', 3, 7, 15, 0, 'daily', 0, 0, 1, 0),
('Stocks', 3, 7, 12, 0, 'daily', 0, 0, 1, 0),
('Task (Bank/ mail)', 3, 7, 15, 0, 'daily', 0, 0, 1, 0),
('Commute', 3, 7, 60, 0, 'daily', 0, 0, 1, 0),
('Nature Needs', 3, 7, 60, 0, 'daily', 0, 0, 1, 0),
('Eating', 3, 7, 60, 0, 'daily', 0, 0, 1, 0),
('My Games', 3, 7, 30, 0, 'daily', 0, 0, 1, 0);
