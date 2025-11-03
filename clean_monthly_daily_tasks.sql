-- Clean up monthly task references
-- This script removes monthly task entries that are just daily task references
-- allowing you to start fresh with monthly tracking

-- Delete all monthly time entries for tasks with 'daily' frequency
DELETE FROM monthly_time_entries 
WHERE task_id IN (
  SELECT id FROM tasks WHERE follow_up_frequency = 'daily'
);

-- Delete all monthly task status entries for tasks with 'daily' frequency  
DELETE FROM monthly_task_status
WHERE task_id IN (
  SELECT id FROM tasks WHERE follow_up_frequency = 'daily'
);

-- Verify the cleanup
SELECT 'Remaining monthly time entries:', COUNT(*) FROM monthly_time_entries;
SELECT 'Remaining monthly task statuses:', COUNT(*) FROM monthly_task_status;

-- Show which tasks remain in monthly tracking
SELECT 
  t.id,
  t.name,
  t.follow_up_frequency,
  COUNT(DISTINCT mte.month_start_date) as months_tracked
FROM tasks t
LEFT JOIN monthly_time_entries mte ON t.id = mte.task_id
WHERE mte.id IS NOT NULL
GROUP BY t.id, t.name, t.follow_up_frequency
ORDER BY t.follow_up_frequency, t.name;
