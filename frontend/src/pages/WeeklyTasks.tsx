/**
 * ============================================================================
 * WEEKLY TASKS PAGE - Complete Implementation with Full Styling
 * ============================================================================
 * 
 * This page displays weekly task tracking with:
 * - Tasks grouped by type (Time/Count/Boolean)
 * - 7-day columns (Mon-Sun)
 * - Color-coded rows (green=on track, red=below target)
 * - Color-coded cells (green=daily target met, red=missed)
 * - Completed/NA status per week
 * - Daily task aggregates displayed
 * - Sticky columns for better scrolling
 * 
 * Architecture: Self-contained with inline helpers for clarity
 * 
 * Business Rules:
 * - Weekly tab shows tasks explicitly added to weekly tracking
 * - Daily tasks (follow_up_frequency='daily') display aggregated data from Daily tab
 * - Weekly tasks can be marked Complete/NA per week without affecting global status
 * - Color logic: Daily tasks expect target every day, Weekly tasks allow flexible distribution
 * 
 * ============================================================================
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTaskContext, useTimeEntriesContext, useUserPreferencesContext } from '../contexts';
import { Task, TaskType } from '../types';
import type { DailyEntry } from '../contexts/TimeEntriesContext';
import { 
  getWeekStart, 
  addDays, 
  formatDateForInput,
  getShortDayName
} from '../utils/dateHelpers';
import {
  sortTasksByHierarchy,
} from '../utils/taskHelpers';
import TaskForm from '../components/TaskForm';

const WeeklyTasks: React.FC = () => {
  // ============================================================================
  // CONTEXT HOOKS
  // ============================================================================
  
  const { tasks, loadTasks, loadPillars, loadCategories } = useTaskContext();
  const { 
    weeklyTaskStatuses,
    loadWeeklyTaskStatuses,
    updateWeeklyTaskStatus,
    dailyAggregatesWeekly,
    loadDailyAggregatesForWeek,
    dailyEntries,
    loadDailyEntries,
    saveDailyEntry,
    updateDailyEntry,
  } = useTimeEntriesContext();
  const {
    selectedDate,
    selectedPillar,
    selectedCategory,
    showCompleted,
    showNA,
    showInactive,
    hierarchyOrder,
    taskNameOrder,
  } = useUserPreferencesContext();

  // ============================================================================
  // LOCAL STATE
  // ============================================================================
  
  const [loading, setLoading] = useState(false);
  const [showCompletedSection, setShowCompletedSection] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [weeklyDailyEntries, setWeeklyDailyEntries] = useState<DailyEntry[]>([]);
  
  // Edit task state - use TaskForm component (like Daily tab)
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  
  // Calculate week start from selected date
  const weekStartDate = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekStartString = formatDateForInput(weekStartDate);

  // Generate week days array (Monday-Sunday)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStartDate, i);
      const dayNum = day.getDate();
      const monthNum = day.getMonth() + 1;
      return {
        date: day,
        dateString: formatDateForInput(day),
        dayName: getShortDayName(day),
        label: `${getShortDayName(day)}\n${monthNum}/${dayNum}`, // Mon\n11/4
        index: i,
      };
    });
  }, [weekStartDate]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================
  
  /**
   * Load initial data on mount
   */
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          loadTasks(),
          loadPillars(),
          loadCategories(),
        ]);
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, []);

  /**
   * Load week-specific data when week changes
   */
  useEffect(() => {
    const loadWeekData = async () => {
      try {
        setLoading(true);
        
        // Load weekly statuses and aggregates
        await Promise.all([
          loadWeeklyTaskStatuses(weekStartString),
          loadDailyAggregatesForWeek(weekStartString),
        ]);
        
        // Load daily entries for all 7 days of the week and accumulate them
        const allEntries: DailyEntry[] = [];
        for (const day of weekDays) {
          try {
            const response = await fetch(`/api/daily-time/?date=${day.dateString}`);
            if (response.ok) {
              const dayEntries: DailyEntry[] = await response.json();
              allEntries.push(...dayEntries);
            }
            // 404 is expected when there are no entries for that date - just skip
          } catch (err) {
            // Silently skip - no entries for this date yet
          }
        }
        
        // Store all accumulated entries in local state
        setWeeklyDailyEntries(allEntries);
        
      } catch (err) {
        console.error('Error loading week data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (tasks.length > 0) {
      loadWeekData();
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [weekStartString, tasks.length]);

  // ============================================================================
  // TASK FILTERING & GROUPING
  // ============================================================================
  
  /**
   * Filter tasks for weekly view
   * 
   * Business Rule: 
   * - Native weekly tasks (follow_up_frequency='weekly') always show - this is their home tab
   * - Monitoring tasks (daily/monthly) only show if explicitly added to weekly tracking
   */
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      const isNativeWeeklyTask = task.follow_up_frequency === 'weekly';
      const hasBeenAddedToWeekly = weeklyTaskStatuses[task.id] !== undefined;
      
      // Native weekly tasks always show (this is their home tab)
      // Monitoring tasks only show if explicitly added
      if (!isNativeWeeklyTask && !hasBeenAddedToWeekly) return false;

      // Apply pillar/category filters
      if (selectedPillar && task.pillar_name !== selectedPillar) return false;
      if (selectedCategory && task.category_name !== selectedCategory) return false;

      // Apply status filters
      const weeklyStatus = weeklyTaskStatuses[task.id];
      const isCompleted = weeklyStatus?.is_completed || false;
      const isNA = weeklyStatus?.is_na || false;
      
      if (!showCompleted && isCompleted) return false;
      if (!showNA && isNA) return false;
      if (!showInactive && !task.is_active) return false;

      return true;
    });

    // Sort by hierarchy
    return sortTasksByHierarchy(filtered, hierarchyOrder, taskNameOrder);
  }, [tasks, weeklyTaskStatuses, selectedPillar, selectedCategory, showCompleted, showNA, showInactive, hierarchyOrder, taskNameOrder]);

  /**
   * Separate native weekly tasks from monitoring tasks
   * Native weekly tasks have follow_up_frequency='weekly'
   * Monitoring tasks are daily/monthly tasks being tracked weekly
   */
  const nativeWeeklyTasks = useMemo(() => {
    return filteredTasks.filter(task => {
      const weeklyStatus = weeklyTaskStatuses[task.id];
      const isCompleted = weeklyStatus?.is_completed || false;
      const isNA = weeklyStatus?.is_na || false;
      return task.follow_up_frequency === 'weekly' && !isCompleted && !isNA;
    });
  }, [filteredTasks, weeklyTaskStatuses, weeklyDailyEntries]);

  const monitoringTasks = useMemo(() => {
    return filteredTasks.filter(task => {
      if (task.follow_up_frequency === 'weekly') return false;
      
      // Exclude completed/NA monitoring tasks from main table
      const weeklyStatus = weeklyTaskStatuses[task.id];
      const isCompleted = weeklyStatus?.is_completed || false;
      const isNA = weeklyStatus?.is_na || false;
      
      return !isCompleted && !isNA;
    });
  }, [filteredTasks, weeklyTaskStatuses]);

  const completedWeeklyTasks = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return filteredTasks.filter(task => {
      const weeklyStatus = weeklyTaskStatuses[task.id];
      if (!weeklyStatus) return false;
      
      const isCompleted = weeklyStatus.is_completed || false;
      const isNA = weeklyStatus.is_na || false;
      
      // Include both native weekly tasks AND monitoring tasks that are completed/NA
      if (!isCompleted && !isNA) return false;
      
      // Filter out tasks completed/NA more than 1 week ago
      if (weeklyStatus.completed_at) {
        const completedDate = new Date(weeklyStatus.completed_at);
        if (completedDate < oneWeekAgo) return false;
      }
      
      return true;
    });
  }, [filteredTasks, weeklyTaskStatuses]);

  /**
   * Group filtered tasks by task type for sectioned display
   */
  const tasksByType = useMemo(() => {
    const groups: {
      time: Task[];
      count: Task[];
      boolean: Task[];
    } = {
      time: [],
      count: [],
      boolean: [],
    };

    nativeWeeklyTasks.forEach(task => {
      if (task.task_type === TaskType.TIME) {
        groups.time.push(task);
      } else if (task.task_type === TaskType.COUNT) {
        groups.count.push(task);
      } else if (task.task_type === TaskType.BOOLEAN) {
        groups.boolean.push(task);
      }
    });

    return groups;
  }, [nativeWeeklyTasks]);

  /**
   * Group completed weekly tasks by type
   */
  const completedTasksByType = useMemo(() => {
    const groups: {
      time: Task[];
      count: Task[];
      boolean: Task[];
    } = {
      time: [],
      count: [],
      boolean: [],
    };

    completedWeeklyTasks.forEach(task => {
      if (task.task_type === TaskType.TIME) {
        groups.time.push(task);
      } else if (task.task_type === TaskType.COUNT) {
        groups.count.push(task);
      } else if (task.task_type === TaskType.BOOLEAN) {
        groups.boolean.push(task);
      }
    });

    return groups;
  }, [completedWeeklyTasks]);

  /**
   * Group monitoring tasks by task type
   */
  const monitoringTasksByType = useMemo(() => {
    const groups: {
      time: Task[];
      count: Task[];
      boolean: Task[];
    } = {
      time: [],
      count: [],
      boolean: [],
    };

    monitoringTasks.forEach(task => {
      if (task.task_type === TaskType.TIME) {
        groups.time.push(task);
      } else if (task.task_type === TaskType.COUNT) {
        groups.count.push(task);
      } else if (task.task_type === TaskType.BOOLEAN) {
        groups.boolean.push(task);
      }
    });

    return groups;
  }, [monitoringTasks]);

  // ============================================================================
  // HELPER FUNCTIONS - Time Retrieval
  // ============================================================================
  
  /**
   * Get time/count for a specific task and day
   * Uses daily aggregates since weekly tasks show daily data rolled up
   * 
   * @param taskId - Task ID
   * @param dayIndex - Day index (0=Mon, 6=Sun)
   * @returns Time in minutes or count value
   */
  const getWeeklyTime = (taskId: number, dayIndex: number): number => {
    const key = `${taskId}-${dayIndex}`;
    return dailyAggregatesWeekly[key] || 0;
  };

  // ============================================================================
  // HELPER FUNCTIONS - Color Calculation
  // ============================================================================
  
  /**
   * Get row-level color class for weekly task
   * 
   * Color Logic:
   * - Green (weekly-on-track): Total spent >= expected target for days elapsed
   * - Light Red (weekly-below-target): Total spent < expected but > 0
   * - No color: No progress yet
   * 
   * Target Calculation:
   * - Daily tasks: target * daysElapsed (must do every day)
   * - Weekly tasks: target * (daysElapsed / 7) (flexible distribution)
   * 
   * @param task - Task object
   * @param totalSpent - Total time/count spent so far this week
   * @returns CSS class name
   */
  const getWeeklyRowColorClass = (task: Task, totalSpent: number): string => {
    // Calculate days elapsed in week (including today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(weekStartDate);
    weekStart.setHours(0, 0, 0, 0);
    
    let daysElapsed = 7; // Default to full week for past weeks
    if (today >= weekStart) {
      const diffTime = today.getTime() - weekStart.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      daysElapsed = Math.min(diffDays + 1, 7); // +1 to include today, max 7
    }
    
    // Calculate expected target based on task type and frequency
    let expectedTarget = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        // Daily: expect target every day (e.g., 20 push-ups * 5 days = 100)
        expectedTarget = (task.target_value || 0) * daysElapsed;
      } else {
        // Weekly: allow flexible distribution (e.g., 100 push-ups over 7 days, so 5/7 * 100 = 71 by day 5)
        expectedTarget = (task.target_value || 0) * (daysElapsed / 7);
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      // Boolean: 1 per day for daily tasks, flexible for weekly
      expectedTarget = task.follow_up_frequency === 'daily' ? daysElapsed : (daysElapsed / 7);
    } else {
      // TIME tasks
      if (task.follow_up_frequency === 'daily') {
        // Daily task: allocated_minutes is per-day, multiply by days elapsed
        // Example: 60 min/day → by day 4, need 240 min
        expectedTarget = task.allocated_minutes * daysElapsed;
      } else {
        // Weekly task: allocated_minutes is per-week, divide by 7 then multiply by days
        // Example: 420 min/week (60/day) → by day 4, need 420 * (4/7) = 240 min
        expectedTarget = task.allocated_minutes * (daysElapsed / 7);
      }
    }
    
    // Return color based on progress
    if (totalSpent >= expectedTarget) {
      return 'weekly-on-track'; // Green - meeting or exceeding target
    } else {
      // Below target (includes zero progress) - show red to indicate behind schedule
      return 'weekly-below-target'; // Red - below target or no progress
    }
  };

  /**
   * Get cell-level color for a specific day
   * 
   * @param task - Task object
   * @param actualValue - Actual time/count for this day
   * @param dayDate - Date of the day
   * @returns CSS class name
   */
  const getWeeklyCellColorClass = (task: Task, actualValue: number, dayDate: Date): string => {
    // Check if day is in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (dayDate > today) {
      return ''; // No color for future days
    }
    
    // Calculate expected value for this specific day
    let expectedValue = 0;
    if (task.task_type === TaskType.COUNT) {
      expectedValue = task.follow_up_frequency === 'daily' 
        ? (task.target_value || 0) 
        : (task.target_value || 0) / 7;
    } else if (task.task_type === TaskType.BOOLEAN) {
      expectedValue = task.follow_up_frequency === 'daily' ? 1 : 1 / 7;
    } else {
      // TIME tasks: per-day expectation
      if (task.follow_up_frequency === 'daily') {
        // Daily task: allocated_minutes is already per-day
        expectedValue = task.allocated_minutes;
      } else {
        // Weekly task: allocated_minutes is per-week, divide by 7 for per-day expectation
        expectedValue = task.allocated_minutes / 7;
      }
    }
    
    // Return color based on achievement
    if (actualValue >= expectedValue) {
      return 'cell-achieved'; // Green - target met for this day
    } else if (expectedValue > 0) {
      return 'cell-below-target'; // Red - below target for this day
    }
    return '';
  };

  // ============================================================================
  // HELPER FUNCTIONS - Status Handling
  // ============================================================================
  
  /**
   * Mark task as completed for this week only
   * Does NOT affect global task status
   */
  const handleWeeklyTaskComplete = async (taskId: number) => {
    try {
      await updateWeeklyTaskStatus(taskId, weekStartString, {
        is_completed: true,
        is_na: false,
      });
      // Reload to reflect changes
      await loadWeeklyTaskStatuses(weekStartString);
    } catch (err: any) {
      console.error('Error marking task complete:', err);
    }
  };

  /**
   * Mark task as NA for this week only
   * Does NOT affect global task status
   */
  const handleWeeklyTaskNA = async (taskId: number) => {
    try {
      await updateWeeklyTaskStatus(taskId, weekStartString, {
        is_completed: false,
        is_na: true,
      });
      // Reload to reflect changes
      await loadWeeklyTaskStatuses(weekStartString);
    } catch (err: any) {
      console.error('Error marking task NA:', err);
    }
  };

  /**
   * Restore a completed/NA task back to active status
   */
  const handleRestoreWeeklyTask = async (taskId: number) => {
    try {
      await updateWeeklyTaskStatus(taskId, weekStartString, {
        is_completed: false,
        is_na: false,
      });
      // Reload to reflect changes
      await loadWeeklyTaskStatuses(weekStartString);
    } catch (err: any) {
      console.error('Error restoring task:', err);
    }
  };

  /**
   * Open TaskForm for editing a task
   */
  const handleEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setIsTaskFormOpen(true);
  };

  /**
   * Handle input change for native weekly task cells
   * Debounced auto-save after 1.5 seconds
   */
  const handleCellChange = (taskId: number, date: string, hour: number, value: string) => {
    const key = `${taskId}-${date}-${hour}`;
    const numValue = value === '' ? 0 : parseFloat(value) || 0;
    
    setPendingChanges(prev => ({
      ...prev,
      [key]: { taskId, date, hour, value: numValue }
    }));

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (numValue > 0) {
          // Save/update entry
          await saveDailyEntry({
            task_id: taskId,
            entry_date: `${date}T00:00:00`,  // Convert date string to ISO datetime
            hour,
            minutes: numValue,
          });
        } else {
          // Delete entry when value is 0
          try {
            const response = await fetch(`/api/daily-time/${taskId}/${date}/0`, {
              method: 'DELETE',
            });
            if (!response.ok) {
              console.warn('Delete returned non-ok status, but continuing');
            }
          } catch (deleteErr) {
            console.warn('Error deleting entry (may not exist):', deleteErr);
          }
        }

        // Reload entries for this specific date and update our local state
        const response = await fetch(`/api/daily-time/?date=${date}`);
        if (response.ok) {
          const dayEntries: DailyEntry[] = await response.json();
          
          // Update weeklyDailyEntries: remove old entries for this date and add new ones
          setWeeklyDailyEntries(prev => {
            const filtered = prev.filter(e => e.entry_date.split('T')[0] !== date);
            return [...filtered, ...dayEntries];
          });
        }
        
        // Reload aggregates
        await loadDailyAggregatesForWeek(weekStartString);

        // Remove from pending changes
        setPendingChanges(prev => {
          const newPending = { ...prev };
          delete newPending[key];
          return newPending;
        });
      } catch (err) {
        console.error('Error saving cell value:', err);
      }
    }, 1500);
  };

  // ============================================================================
  // HELPER FUNCTIONS - UI Utilities
  // ============================================================================
  
  /**
   * Handle keyboard navigation in table cells
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, taskId: number, dayIndex: number) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
      return;
    }

    e.preventDefault();
    
    const input = e.currentTarget;
    const cell = input.closest('td');
    const row = cell?.closest('tr');
    const tbody = row?.closest('tbody');
    
    if (!cell || !row || !tbody) return;

    let targetCell: HTMLTableCellElement | null = null;

    switch (e.key) {
      case 'ArrowLeft':
        // Move to previous cell in same row
        targetCell = cell.previousElementSibling as HTMLTableCellElement;
        // Skip sticky columns (first 4 columns)
        while (targetCell && targetCell.classList.contains('sticky-col')) {
          targetCell = targetCell.previousElementSibling as HTMLTableCellElement;
        }
        break;

      case 'ArrowRight':
      case 'Enter':
        // Move to next cell in same row
        targetCell = cell.nextElementSibling as HTMLTableCellElement;
        // Skip action column (last column)
        if (targetCell && targetCell.classList.contains('col-status')) {
          targetCell = null;
        }
        break;

      case 'ArrowUp':
        // Move to same cell in previous row
        const prevRow = row.previousElementSibling as HTMLTableRowElement;
        if (prevRow) {
          const cellIndex = Array.from(row.children).indexOf(cell);
          targetCell = prevRow.children[cellIndex] as HTMLTableCellElement;
        }
        break;

      case 'ArrowDown':
        // Move to same cell in next row
        const nextRow = row.nextElementSibling as HTMLTableRowElement;
        if (nextRow) {
          const cellIndex = Array.from(row.children).indexOf(cell);
          targetCell = nextRow.children[cellIndex] as HTMLTableCellElement;
        }
        break;
    }

    // Focus the input in the target cell
    if (targetCell) {
      const targetInput = targetCell.querySelector('input[type="number"]') as HTMLInputElement;
      if (targetInput && !targetInput.disabled) {
        targetInput.focus();
        targetInput.select(); // Select all text for easy overwriting
      }
    }
  };

  /**
   * Format value display based on task type
   */
  const formatValue = (task: Task, value: number): string => {
    if (task.task_type === TaskType.TIME) {
      return `${value >= 10 ? Math.round(value) : value.toFixed(1)} min`;
    } else if (task.task_type === TaskType.COUNT) {
      return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${task.unit}`;
    } else {
      // For boolean tasks, show as fraction (e.g., "5/7 days")
      return `${Math.round(value)}/7 days`;
    }
  };

  /**
   * Format average display for boolean tasks as percentage
   */
  const formatBooleanPercentage = (daysCompleted: number, totalDays: number = 7): string => {
    const percentage = Math.round((daysCompleted / totalDays) * 100);
    return `${percentage}%`;
  };

  // ============================================================================
  // RENDERING HELPERS
  // ============================================================================
  
  /**
   * Render a single task row with full styling
   */
  const renderTaskRow = (task: Task) => {
    const isNativeWeeklyTask = task.follow_up_frequency === 'weekly';
    
    // Calculate totals for this task
    // For native weekly tasks, use weeklyDailyEntries; for monitoring tasks, use dailyAggregatesWeekly
    let totalSpent = 0;
    if (isNativeWeeklyTask) {
      // Sum from weeklyDailyEntries for this task across all days in the week
      weekDays.forEach(day => {
        const pendingKey = `${task.id}-${day.dateString}-0`;
        
        // Check if there's a pending change for this day
        if (pendingChanges[pendingKey] !== undefined) {
          // Use pending value (user is typing/editing)
          totalSpent += pendingChanges[pendingKey].value;
        } else {
          // Use saved value from weeklyDailyEntries
          const dayEntries = weeklyDailyEntries.filter(
            e => e.task_id === task.id && e.entry_date.split('T')[0] === day.dateString
          );
          totalSpent += dayEntries.reduce((sum, e) => sum + (e.minutes || 0), 0);
        }
      });
    } else {
      // Use aggregates for monitoring tasks
      totalSpent = weekDays.reduce((sum, day) => sum + getWeeklyTime(task.id, day.index), 0);
    }
    
    // Calculate target and averages
    const weeklyTarget = task.task_type === TaskType.COUNT 
      ? (task.follow_up_frequency === 'daily' ? (task.target_value || 0) * 7 : (task.target_value || 0))
      : (task.follow_up_frequency === 'daily' ? task.allocated_minutes * 7 : task.allocated_minutes);
    
    // Calculate days elapsed and remaining
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(weekStartDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    let daysElapsed = 1; // At least 1 day
    if (today >= weekStart) {
      if (today <= weekEnd) {
        const diffTime = today.getTime() - weekStart.getTime();
        daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      } else {
        daysElapsed = 7; // Past week
      }
    }
    
    let daysRemaining = 0;
    if (today >= weekStart && today <= weekEnd) {
      const diffTime = weekEnd.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include today
    }
    
    const avgSpentPerDay = totalSpent / daysElapsed;
    const remaining = weeklyTarget - totalSpent;
    const avgRemainingPerDay = daysRemaining > 0 ? remaining / daysRemaining : 0;
    
    // Get colors
    const rowColorClass = getWeeklyRowColorClass(task, totalSpent);
    
    // Get status
    const weeklyStatus = weeklyTaskStatuses[task.id];
    const isWeeklyCompleted = weeklyStatus?.is_completed || false;
    const isWeeklyNA = weeklyStatus?.is_na || false;
    
    const rowClassName = isWeeklyCompleted ? 'completed-row' : isWeeklyNA ? 'na-row' : '';
    const bgColor = isWeeklyCompleted ? '#c6f6d5' : isWeeklyNA ? '#e2e8f0' : undefined;
    
    return (
      <tr 
        key={task.id} 
        className={rowClassName}
        style={bgColor ? { backgroundColor: bgColor } : undefined}
      >
        {/* Task Name - Sticky Column 1 */}
        <td 
          className={`col-task sticky-col sticky-col-1 ${rowColorClass}`}
          style={{ ...(bgColor ? { backgroundColor: bgColor } : {}), color: '#1a202c' }}
        >
          <div className="task-name" style={{ color: '#1a202c' }}>
            {task.name}
            {task.follow_up_frequency === 'daily' && (
              <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>
            )}
            {task.follow_up_frequency === 'weekly' && (
              <span style={{ marginLeft: '8px', fontSize: '11px', color: '#4299e1', fontWeight: '600' }}>(Weekly)</span>
            )}
          </div>
        </td>
        
        {/* Ideal Avg/Day - Sticky Column 2 */}
        <td 
          className={`col-time sticky-col sticky-col-2 ${rowColorClass}`}
          style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}
        >
          {task.task_type === TaskType.BOOLEAN 
            ? '1/1 day' 
            : formatValue(task, weeklyTarget / 7)
          }
        </td>
        
        {/* Actual Avg/Day - Sticky Column 3 */}
        <td 
          className={`col-time sticky-col sticky-col-3 ${rowColorClass}`}
          style={{ textAlign: 'center', color: '#2d3748', ...(bgColor ? { backgroundColor: bgColor } : {}) }}
        >
          {task.task_type === TaskType.BOOLEAN 
            ? `${formatBooleanPercentage(totalSpent, 7)} (${totalSpent}/7)` 
            : formatValue(task, avgSpentPerDay)
          }
        </td>
        
        {/* Needed Avg/Day - Sticky Column 4 */}
        <td 
          className={`col-time sticky-col sticky-col-4 ${rowColorClass}`}
          style={{ textAlign: 'center', color: '#2d3748', ...(bgColor ? { backgroundColor: bgColor } : {}) }}
        >
          {task.task_type === TaskType.BOOLEAN 
            ? `${formatBooleanPercentage(7 - totalSpent, 7)} (${7 - totalSpent}/7)`
            : formatValue(task, avgRemainingPerDay)
          }
        </td>
        
        {/* 7 Day Columns */}
        {weekDays.map(day => {
          const isNativeWeeklyTask = task.follow_up_frequency === 'weekly';
          
          // Get cell value based on task type
          let cellValue = 0;
          if (isNativeWeeklyTask) {
            // For native weekly tasks, sum all entries for this day
            const dayEntries = weeklyDailyEntries.filter(
              e => e.task_id === task.id && e.entry_date.split('T')[0] === day.dateString
            );
            cellValue = dayEntries.reduce((sum, e) => sum + (e.minutes || 0), 0);
          } else {
            // For monitoring tasks, use aggregates
            cellValue = getWeeklyTime(task.id, day.index);
          }
          
          const cellColorClass = getWeeklyCellColorClass(task, cellValue, day.date);
          
          // Check if there's a pending change for this cell
          const pendingKey = `${task.id}-${day.dateString}-0`;
          const hasPending = pendingChanges[pendingKey] !== undefined;
          const displayValue = hasPending ? pendingChanges[pendingKey].value : cellValue;
          
          return (
            <td 
              key={day.index} 
              className={`col-hour ${cellColorClass}`}
              style={{ 
                backgroundColor: bgColor || (cellValue > 0 && !cellColorClass ? '#e6ffed' : undefined),
                textAlign: 'center',
                fontSize: '12px',
                padding: '4px'
              }}
            >
              {isNativeWeeklyTask ? (
                // Editable input for native weekly tasks
                <input
                  type="number"
                  min="0"
                  step={task.task_type === TaskType.TIME ? "1" : "0.1"}
                  value={displayValue || ''}
                  onChange={(e) => handleCellChange(task.id, day.dateString, 0, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, task.id, day.index)}
                  style={{
                    width: '100%',
                    border: hasPending ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '4px',
                    textAlign: 'center',
                    fontSize: '12px',
                    backgroundColor: hasPending ? '#fffbeb' : 'white'
                  }}
                  placeholder="-"
                  disabled={isWeeklyCompleted || isWeeklyNA}
                  title={hasPending ? 'Saving...' : ''}
                />
              ) : (
                // Read-only display for monitoring tasks
                <span>{cellValue > 0 ? (task.task_type === TaskType.BOOLEAN ? '✓' : Math.round(cellValue)) : '-'}</span>
              )}
            </td>
          );
        })}
        
        {/* Actions Column */}
        <td 
          className="col-status"
          style={bgColor ? { backgroundColor: bgColor } : undefined}
        >
          {task.is_completed && task.follow_up_frequency === 'daily' ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '12px'
            }}>
              <span style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
              }}>
                ✓ Completed via Daily
              </span>
            </div>
          ) : !task.is_active && task.follow_up_frequency === 'daily' ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '12px'
            }}>
              <span style={{
                background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(156, 163, 175, 0.3)'
              }}>
                ⊘ NA via Daily
              </span>
            </div>
          ) : isWeeklyCompleted || isWeeklyNA ? (
            <div className="action-buttons">
              <button 
                className="btn btn-sm" 
                style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#4299e1', color: 'white', border: 'none', borderRadius: '4px' }}
                onClick={() => handleRestoreWeeklyTask(task.id)}
                disabled={loading}
                title="Restore Task"
              >
                <i className="fas fa-undo"></i> Restore
              </button>
            </div>
          ) : (
            <div className="action-buttons">
              {task.follow_up_frequency === 'weekly' && (
                <button 
                  className="btn-edit"
                  onClick={() => handleEditTask(task)}
                  title="Edit task"
                >
                  EDIT
                </button>
              )}
              <button 
                className={`btn-complete ${isWeeklyCompleted ? 'active' : ''}`}
                onClick={() => handleWeeklyTaskComplete(task.id)}
                title="Mark as completed for this week only"
              >
                COMPLETED
              </button>
              <button 
                className={`btn-na ${isWeeklyNA ? 'active' : ''}`}
                onClick={() => handleWeeklyTaskNA(task.id)}
                title="Mark as NA for this week only"
              >
                NA
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  /**
   * Render task type section (Time/Count/Boolean)
   */
  const renderTaskSection = (sectionTitle: string, emoji: string, sectionClass: string, tasks: Task[], subtitle?: string) => {
    if (tasks.length === 0) return null;

    return (
      <div style={{ marginBottom: '32px' }}>
        {/* Section Header */}
        <h3 className={`task-section-header ${sectionClass}`}>
          <span className="emoji">{emoji}</span>
          <span>{sectionTitle}</span>
          {subtitle && <span className="subtitle">{subtitle}</span>}
        </h3>
        
        {/* Table */}
        <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
          <table className="tasks-table daily-table">
            <thead style={{ 
              display: 'table-header-group', 
              visibility: 'visible',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              position: 'sticky',
              top: 0,
              zIndex: 20,
              borderBottom: '2px solid #5a67d8'
            }}>
              <tr>
                <th className="col-task sticky-col sticky-col-1" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#fef3c7' }}>
                  Task
                </th>
                <th className="col-time sticky-col sticky-col-2" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fef3c7' }}>
                  Ideal<br/>Avg/Day
                </th>
                <th className="col-time sticky-col sticky-col-3" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fef3c7' }}>
                  Actual<br/>Avg/Day
                </th>
                <th className="col-time sticky-col sticky-col-4" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fef3c7' }}>
                  Needed<br/>Avg/Day
                </th>
                {weekDays.map(day => (
                  <th key={day.index} className="col-hour" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>
                    {day.label}
                  </th>
                ))}
                <th className="col-status" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => renderTaskRow(task))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  if (loading && tasks.length === 0) {
    return (
      <div className="container-fluid mt-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading weekly tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Native Weekly Tasks Section - Tasks with follow_up_frequency='weekly' */}
      {nativeWeeklyTasks.length > 0 && (
        <div className="row mb-4">
          <div className="col">
            <div className="alert" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', marginBottom: '24px', padding: '16px 20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)' }}>
              <h5 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                <i className="fas fa-calendar-week me-3"></i>
                📅 Weekly Tasks - Home Tab ({nativeWeeklyTasks.length} tasks)
              </h5>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', opacity: 0.95 }}>
                These are your weekly tasks. Track progress day-by-day (Mon-Sun) or mark complete/NA for the entire week.
              </p>
            </div>
            {renderTaskSection('⏱️ Time-Based Weekly Tasks', '⏱️', 'time-based', tasksByType.time)}
            {renderTaskSection('🔢 Count-Based Weekly Tasks', '🔢', 'count-based', tasksByType.count)}
            {renderTaskSection('✅ Yes/No Weekly Tasks', '✅', 'boolean-based', tasksByType.boolean)}
          </div>
        </div>
      )}

      {/* Monitoring Section - Daily/Monthly tasks tracked weekly */}
      {monitoringTasks.length > 0 && (
        <div className="row mb-4">
          <div className="col">
            <div className="alert alert-info" style={{ marginBottom: '24px', padding: '16px 20px', borderRadius: '12px' }}>
              <h5 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                <i className="fas fa-chart-line me-3"></i>
                📊 Weekly Monitoring - Read-Only ({monitoringTasks.length} tasks)
              </h5>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
                These are Daily/Monthly tasks being monitored at weekly level. Values are aggregated from their home tabs.
              </p>
            </div>
            {renderTaskSection('⏱️ Time-Based (Monitoring)', '⏱️', 'time-based', monitoringTasksByType.time, '(Auto-calculated from Daily)')}
            {renderTaskSection('🔢 Count-Based (Monitoring)', '🔢', 'count-based', monitoringTasksByType.count, '(Auto-calculated from Daily)')}
            {renderTaskSection('✅ Yes/No (Monitoring)', '✅', 'boolean-based', monitoringTasksByType.boolean, '(Auto-calculated from Daily)')}
          </div>
        </div>
      )}

      {/* Completed Tasks Section */}
      {completedWeeklyTasks.length > 0 && (
        <div className="row">
          <div className="col">
            <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '3px solid #e2e8f0' }}>
              <div 
                onClick={() => setShowCompletedSection(!showCompletedSection)}
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <i className={`fas fa-chevron-${showCompletedSection ? 'down' : 'right'}`} style={{ marginRight: '12px', color: '#64748b' }}></i>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                  ✅ Completed Weekly Tasks ({completedWeeklyTasks.length})
                </h3>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                  Auto-hide after 1 week
                </span>
              </div>
              
              {showCompletedSection && (
                <>
                  {renderTaskSection('⏱️ Time-Based (Completed)', '⏱️', 'time-based', completedTasksByType.time)}
                  {renderTaskSection('🔢 Count-Based (Completed)', '🔢', 'count-based', completedTasksByType.count)}
                  {renderTaskSection('✅ Yes/No (Completed)', '✅', 'boolean-based', completedTasksByType.boolean)}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {nativeWeeklyTasks.length === 0 && monitoringTasks.length === 0 && (
        <div className="row">
          <div className="col">
            <div className="alert alert-warning">
              <i className="fas fa-exclamation-triangle me-2"></i>
              No weekly tasks found. Adjust your filters or add new weekly tasks.
            </div>
          </div>
        </div>
      )}
      
      {/* TaskForm Component for Editing Tasks */}
      <TaskForm
        isOpen={isTaskFormOpen}
        taskId={editingTaskId || undefined}
        onClose={() => {
          setIsTaskFormOpen(false);
          setEditingTaskId(null);
        }}
        onSuccess={async () => {
          await loadTasks();
          setIsTaskFormOpen(false);
          setEditingTaskId(null);
        }}
      />
    </>
  );
};

export default WeeklyTasks;
