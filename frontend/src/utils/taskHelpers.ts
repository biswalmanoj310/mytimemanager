/**
 * Task Utility Functions
 * Extracted from Tasks.tsx during refactoring
 * 
 * These functions provide task filtering, sorting, and hierarchy management
 * used across all task-related features
 */

import { Task } from '../types';

/**
 * Default pillar-category hierarchy order
 * This defines the sort order for task display across the application
 * 
 * NOTE: This is user-specific configuration and should eventually
 * be moved to user preferences/settings
 */
export const DEFAULT_HIERARCHY_ORDER: { [key: string]: number } = {
  // Hard Work
  'Hard Work|Office-Tasks': 1,
  'Hard Work|Learning': 2,
  'Hard Work|Confidence': 3,
  // Calmness
  'Calmness|Yoga': 4,
  'Calmness|Sleep': 5,
  // Family
  'Family|My Tasks': 6,
  'Family|Home Tasks': 7,
  'Family|Time Waste': 8,
};

/**
 * Default custom task name order
 * Defines explicit ordering for specific task names
 * 
 * NOTE: This is user-specific and should be in user preferences
 */
export const DEFAULT_TASK_NAME_ORDER: { [key: string]: number } = {
  'cd-Mails-Tickets': 1,
  'Code Coverage': 2,
  'Code - Scripts': 3,
  'Cloud': 4,
  'LLM GenAI': 5,
  'Git Jenkin Tools': 6,
  'Interview Q/A': 7,
  'Interview Talk': 8,
  'Life Coach & NLP': 9,
  'Toastmaster Task': 10,
  'Yoga - Dhyan': 11,
  'Sleep': 12,
  'Planning': 13,
  'Stocks': 14,
  'Task (Bank/ mail)': 15,
  'Commute': 16,
  'Nature Needs': 17,
  'Eating': 18,
  'My Games': 19,
  'Parent Talk': 20,
  'Home Task': 21,
  'Task Trishna': 22,
  'Task Divyanshi': 23,
  'Daughter Sports': 24,
  'Shopping': 25,
  'Family Friends': 26,
  'Youtube': 27,
  'TV': 28,
  'Facebook': 29,
  'Nextdoor': 30,
  'News': 31,
  'Dark Future': 32,
};

/**
 * Generate hierarchy key for sorting
 * @param task - Task object
 * @returns String key in format "Pillar|Category"
 */
export const getHierarchyKey = (task: Task): string => {
  return `${task.pillar_name || ''}|${task.category_name || ''}`;
};

/**
 * Sort tasks by hierarchy order (pillar/category) then by task name
 * @param tasks - Array of tasks
 * @param hierarchyOrder - Custom hierarchy order mapping
 * @param taskNameOrder - Custom task name order mapping
 * @returns Sorted array of tasks
 */
export const sortTasksByHierarchy = (
  tasks: Task[],
  hierarchyOrder: { [key: string]: number } = DEFAULT_HIERARCHY_ORDER,
  taskNameOrder: { [key: string]: number } = DEFAULT_TASK_NAME_ORDER
): Task[] => {
  return [...tasks].sort((a, b) => {
    const keyA = getHierarchyKey(a);
    const keyB = getHierarchyKey(b);
    const orderA = hierarchyOrder[keyA] || 999;
    const orderB = hierarchyOrder[keyB] || 999;

    // Sort by hierarchy order first
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // Within same hierarchy, sort by custom task name order
    const taskOrderA = taskNameOrder[a.name || ''] || 999;
    const taskOrderB = taskNameOrder[b.name || ''] || 999;

    if (taskOrderA !== taskOrderB) {
      return taskOrderA - taskOrderB;
    }

    // If not in custom order, sort alphabetically
    return (a.name || '').localeCompare(b.name || '');
  });
};

/**
 * Filter tasks by pillar
 * @param tasks - Array of tasks
 * @param pillarName - Pillar name to filter by
 * @returns Filtered array
 */
export const filterByPillar = (tasks: Task[], pillarName: string): Task[] => {
  if (!pillarName) return tasks;
  return tasks.filter((task) => task.pillar_name === pillarName);
};

/**
 * Filter tasks by category
 * @param tasks - Array of tasks
 * @param categoryName - Category name to filter by
 * @returns Filtered array
 */
export const filterByCategory = (tasks: Task[], categoryName: string): Task[] => {
  if (!categoryName) return tasks;
  return tasks.filter((task) => task.category_name === categoryName);
};

/**
 * Filter tasks by both pillar and category
 * @param tasks - Array of tasks
 * @param pillarName - Pillar name (optional)
 * @param categoryName - Category name (optional)
 * @returns Filtered array
 */
export const filterByPillarAndCategory = (
  tasks: Task[],
  pillarName?: string,
  categoryName?: string
): Task[] => {
  let filtered = tasks;
  if (pillarName) {
    filtered = filterByPillar(filtered, pillarName);
  }
  if (categoryName) {
    filtered = filterByCategory(filtered, categoryName);
  }
  return filtered;
};

/**
 * Get display value for a task based on its type
 * @param task - Task object
 * @returns Display string (e.g., "(30 min)", "(10 reps)", "(Yes/No)")
 */
export const getTaskDisplayValue = (task: Task): string => {
  if (task.task_type === 'time') {
    return `(${task.allocated_minutes} min)`;
  } else if (task.task_type === 'count') {
    return `(${task.target_value} ${task.unit || 'count'})`;
  } else if (task.task_type === 'boolean') {
    return '(Yes/No)';
  }
  return '';
};

/**
 * Format task display name with pillar, category, and name
 * @param task - Task object
 * @param includeValue - Whether to include value display
 * @returns Formatted string
 */
export const formatTaskFullName = (task: Task, includeValue: boolean = true): string => {
  const baseName = `${task.pillar_name} - ${task.category_name}: ${task.name}`;
  if (includeValue) {
    const value = getTaskDisplayValue(task);
    return value ? `${baseName} ${value}` : baseName;
  }
  return baseName;
};

/**
 * Check if a task is active (not completed and not marked inactive)
 * @param task - Task object
 * @returns true if task is active
 */
export const isTaskActive = (task: Task): boolean => {
  return task.is_active && !task.is_completed;
};

/**
 * Check if a task was completed today
 * @param task - Task object
 * @returns true if completed today
 */
export const isTaskCompletedToday = (task: Task): boolean => {
  if (!task.is_completed || !task.completed_at) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedDate = new Date(task.completed_at);
  completedDate.setHours(0, 0, 0, 0);

  return completedDate.getTime() === today.getTime();
};

/**
 * Check if a task was marked NA today
 * @param task - Task object
 * @returns true if marked NA today
 */
export const isTaskMarkedNAToday = (task: Task): boolean => {
  if (task.is_active || !task.na_marked_at) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const naMarkedDate = new Date(task.na_marked_at);
  naMarkedDate.setHours(0, 0, 0, 0);

  return naMarkedDate.getTime() === today.getTime();
};

/**
 * Check if a task should be shown in Daily tab
 * (active, OR completed today, OR marked NA today)
 * @param task - Task object
 * @returns true if should be visible
 */
export const shouldShowInDailyTab = (task: Task): boolean => {
  if (task.follow_up_frequency !== 'daily') return false;
  return isTaskActive(task) || isTaskCompletedToday(task) || isTaskMarkedNAToday(task);
};

/**
 * Group tasks by pillar-category hierarchy
 * @param tasks - Array of tasks
 * @returns Object with hierarchy keys and task arrays
 */
export const groupTasksByHierarchy = (
  tasks: Task[]
): { [key: string]: Task[] } => {
  return tasks.reduce((acc, task) => {
    const key = getHierarchyKey(task);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(task);
    return acc;
  }, {} as { [key: string]: Task[] });
};

/**
 * Get unique pillars from task list
 * @param tasks - Array of tasks
 * @returns Array of unique pillar names
 */
export const getUniquePillars = (tasks: Task[]): string[] => {
  const pillars = new Set(tasks.map((t) => t.pillar_name).filter(Boolean) as string[]);
  return Array.from(pillars).sort();
};

/**
 * Get unique categories for a specific pillar
 * @param tasks - Array of tasks
 * @param pillarName - Pillar name to filter by
 * @returns Array of unique category names
 */
export const getCategoriesForPillar = (
  tasks: Task[],
  pillarName: string
): string[] => {
  const categories = new Set(
    tasks
      .filter((t) => t.pillar_name === pillarName)
      .map((t) => t.category_name)
      .filter(Boolean) as string[]
  );
  return Array.from(categories).sort();
};

/**
 * Calculate task completion percentage
 * Used for showing progress in various views
 * @param completed - Number of completed items
 * @param total - Total number of items
 * @returns Percentage (0-100)
 */
export const calculateCompletionPercentage = (
  completed: number,
  total: number
): number => {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
};

/**
 * Get color class for task type
 * Used for visual differentiation in UI
 * @param taskType - Task type
 * @returns CSS class name
 */
export const getTaskTypeColorClass = (taskType?: string): string => {
  switch (taskType) {
    case 'time':
      return 'task-type-time';
    case 'count':
      return 'task-type-count';
    case 'boolean':
      return 'task-type-boolean';
    default:
      return 'task-type-default';
  }
};

/**
 * Validate time entry value
 * @param value - Time value in minutes
 * @param max - Maximum allowed value (optional)
 * @returns true if valid
 */
export const isValidTimeEntry = (value: number, max?: number): boolean => {
  if (isNaN(value) || value < 0) return false;
  if (max !== undefined && value > max) return false;
  return true;
};

/**
 * Validate count entry value
 * @param value - Count value
 * @param max - Maximum allowed value (optional)
 * @returns true if valid
 */
export const isValidCountEntry = (value: number, max?: number): boolean => {
  if (isNaN(value) || value < 0 || !Number.isInteger(value)) return false;
  if (max !== undefined && value > max) return false;
  return true;
};

/**
 * Get row-level color class for weekly tab
 * Returns color class based on whether task is on track for weekly target
 * @param task - Task object
 * @param totalSpent - Total time/count spent in week
 * @param weekStartDate - Start date of the week
 * @returns CSS class name ('weekly-on-track' | 'weekly-below-target' | '')
 */
export const getWeeklyRowColorClass = (
  task: Task,
  totalSpent: number,
  weekStartDate: Date
): string => {
  // Calculate days elapsed in week (including today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(weekStartDate);
  weekStart.setHours(0, 0, 0, 0);
  
  let daysElapsed = 7; // Default to full week
  if (today >= weekStart) {
    const diffTime = today.getTime() - weekStart.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    daysElapsed = Math.min(diffDays + 1, 7); // +1 to include today
  }
  
  // Calculate expected target based on task type and frequency
  let expectedTarget = 0;
  if (task.task_type === 'count') {
    if (task.follow_up_frequency === 'daily') {
      expectedTarget = (task.target_value || 0) * daysElapsed;
    } else {
      expectedTarget = (task.target_value || 0) * (daysElapsed / 7);
    }
  } else if (task.task_type === 'boolean') {
    expectedTarget = daysElapsed;
  } else {
    // TIME tasks
    if (task.follow_up_frequency === 'daily') {
      expectedTarget = task.allocated_minutes * daysElapsed;
    } else {
      expectedTarget = task.allocated_minutes * (daysElapsed / 7);
    }
  }
  
  // Return color based on progress
  if (totalSpent >= expectedTarget) {
    return 'weekly-on-track'; // Green
  } else if (totalSpent > 0) {
    return 'weekly-below-target'; // Light red
  }
  return '';
};

/**
 * Get row-level color class for monthly tab
 * @param task - Task object
 * @param totalSpent - Total time/count spent in month
 * @param monthStartDate - Start date of the month
 * @returns CSS class name ('weekly-on-track' | 'weekly-below-target' | '')
 */
export const getMonthlyRowColorClass = (
  task: Task,
  totalSpent: number,
  monthStartDate: Date
): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(monthStartDate);
  monthStart.setHours(0, 0, 0, 0);
  
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  
  let daysElapsed = daysInMonth;
  if (today >= monthStart) {
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    monthEnd.setHours(0, 0, 0, 0);
    
    if (today <= monthEnd) {
      const diffTime = today.getTime() - monthStart.getTime();
      daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
  }
  
  let expectedTarget = 0;
  if (task.task_type === 'count') {
    if (task.follow_up_frequency === 'daily') {
      expectedTarget = (task.target_value || 0) * daysElapsed;
    } else {
      expectedTarget = (task.target_value || 0) * (daysElapsed / daysInMonth);
    }
  } else if (task.task_type === 'boolean') {
    expectedTarget = daysElapsed;
  } else {
    if (task.follow_up_frequency === 'daily') {
      expectedTarget = task.allocated_minutes * daysElapsed;
    } else {
      expectedTarget = task.allocated_minutes * (daysElapsed / daysInMonth);
    }
  }
  
  if (totalSpent >= expectedTarget) {
    return 'weekly-on-track';
  } else if (totalSpent > 0) {
    return 'weekly-below-target';
  }
  return '';
};

/**
 * Get row-level color class for yearly tab
 * @param task - Task object
 * @param totalSpent - Total time/count spent in year
 * @param yearStartDate - Start date of the year
 * @returns CSS class name ('weekly-on-track' | 'weekly-below-target' | '')
 */
export const getYearlyRowColorClass = (
  task: Task,
  totalSpent: number,
  yearStartDate: Date
): string => {
  const today = new Date();
  const yearStart = new Date(yearStartDate);
  
  let monthsElapsed = 12;
  if (today.getFullYear() === yearStart.getFullYear()) {
    monthsElapsed = today.getMonth() + 1;
  } else if (today.getFullYear() < yearStart.getFullYear()) {
    monthsElapsed = 0;
  }
  
  let expectedTarget = 0;
  if (task.task_type === 'count') {
    if (task.follow_up_frequency === 'daily') {
      expectedTarget = (task.target_value || 0) * monthsElapsed * 30;
    } else if (task.follow_up_frequency === 'weekly') {
      expectedTarget = (task.target_value || 0) * monthsElapsed * 4;
    } else if (task.follow_up_frequency === 'monthly') {
      expectedTarget = (task.target_value || 0) * monthsElapsed;
    } else {
      expectedTarget = (task.target_value || 0) * (monthsElapsed / 12);
    }
  } else if (task.task_type === 'boolean') {
    if (task.follow_up_frequency === 'daily') {
      expectedTarget = monthsElapsed * 30;
    } else if (task.follow_up_frequency === 'weekly') {
      expectedTarget = monthsElapsed * 4;
    } else if (task.follow_up_frequency === 'monthly') {
      expectedTarget = monthsElapsed;
    } else {
      expectedTarget = monthsElapsed / 12;
    }
  } else {
    if (task.follow_up_frequency === 'daily') {
      expectedTarget = task.allocated_minutes * monthsElapsed * 30;
    } else if (task.follow_up_frequency === 'weekly') {
      expectedTarget = task.allocated_minutes * monthsElapsed * 4;
    } else if (task.follow_up_frequency === 'monthly') {
      expectedTarget = task.allocated_minutes * monthsElapsed;
    } else {
      expectedTarget = task.allocated_minutes * (monthsElapsed / 12);
    }
  }
  
  if (totalSpent >= expectedTarget) {
    return 'weekly-on-track';
  } else if (totalSpent > 0) {
    return 'weekly-below-target';
  }
  return '';
};

/**
 * Get cell-level color class for weekly tab
 * Determines if specific day meets target
 * @param task - Task object
 * @param actualValue - Actual time/count for the day
 * @param dayDate - Date of the specific day
 * @returns CSS class name ('cell-achieved' | 'cell-below-target' | '')
 */
export const getWeeklyCellColorClass = (
  task: Task,
  actualValue: number,
  dayDate: Date
): string => {
  // Calculate expected value for this day
  let expectedValue = 0;
  if (task.task_type === 'count') {
    expectedValue = task.follow_up_frequency === 'daily' 
      ? (task.target_value || 0) 
      : (task.target_value || 0) / 7;
  } else if (task.task_type === 'boolean') {
    expectedValue = task.follow_up_frequency === 'daily' ? 1 : 1 / 7;
  } else {
    expectedValue = task.follow_up_frequency === 'daily' 
      ? task.allocated_minutes 
      : task.allocated_minutes / 7;
  }
  
  // Check if day is in the future
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  if (dayDate > today) {
    return '';
  }
  
  // Return color based on achievement
  if (actualValue >= expectedValue) {
    return 'cell-achieved'; // Green
  } else if (expectedValue > 0) {
    return 'cell-below-target'; // Red
  }
  return '';
};

/**
 * Get cell-level color class for monthly tab
 * @param task - Task object
 * @param actualValue - Actual time/count for the day
 * @param dayDate - Date of the specific day
 * @returns CSS class name ('cell-achieved' | 'cell-below-target' | '')
 */
export const getMonthlyCellColorClass = (
  task: Task,
  actualValue: number,
  dayDate: Date
): string => {
  // Calculate expected value for this day
  let expectedValue = 0;
  const daysInMonth = new Date(dayDate.getFullYear(), dayDate.getMonth() + 1, 0).getDate();
  
  if (task.task_type === 'count') {
    expectedValue = task.follow_up_frequency === 'daily' 
      ? (task.target_value || 0) 
      : (task.target_value || 0) / daysInMonth;
  } else if (task.task_type === 'boolean') {
    expectedValue = task.follow_up_frequency === 'daily' ? 1 : 1 / daysInMonth;
  } else {
    expectedValue = task.follow_up_frequency === 'daily' 
      ? task.allocated_minutes 
      : task.allocated_minutes / daysInMonth;
  }
  
  // Check if day is in the future
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  if (dayDate > today) {
    return '';
  }
  
  // Return color based on achievement
  if (actualValue >= expectedValue) {
    return 'cell-achieved';
  } else if (expectedValue > 0) {
    return 'cell-below-target';
  }
  return '';
};
