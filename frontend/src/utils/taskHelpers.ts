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
