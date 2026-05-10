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
  
  const { tasks, loadTasks, loadPillars, loadCategories, completeTask, markTaskNA, reactivateTask } = useTaskContext();
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
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
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

        // Auto-copy incomplete tasks from previous week if this week has no tasks yet
        // (only for the current real week, not future weeks)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekStartDate = new Date(weekStartString);
        weekStartDate.setHours(0, 0, 0, 0);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        weekEndDate.setHours(23, 59, 59, 999);
        const isCurrentRealWeek = today >= weekStartDate && today <= weekEndDate;

        if (isCurrentRealWeek) {
          const checkResp = await fetch(`/api/weekly-time/status/${weekStartString}`);
          const currentStatuses: any[] = checkResp.ok ? await checkResp.json() : [];
          if (currentStatuses.length === 0) {
            try {
              const copyResp = await fetch(
                `/api/weekly-time/status/copy-from-previous-week?week_start_date=${weekStartString}`,
                { method: 'POST' }
              );
              if (copyResp.ok) {
                const result = await copyResp.json();
                if (result.copied > 0) {
                  await loadWeeklyTaskStatuses(weekStartString);
                }
              }
            } catch (err) {
              console.error('Error auto-copying tasks from previous week:', err);
            }
          }
        }
        
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

      // Apply status filters — also respect global task.is_completed so tasks stay done across weeks
      const weeklyStatus = weeklyTaskStatuses[task.id];
      const isCompleted = weeklyStatus?.is_completed || task.is_completed || false;
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
      // Also check global task.is_completed so tasks don't reappear after week rollover
      const isCompleted = weeklyStatus?.is_completed || task.is_completed || false;
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
    // Calculate days elapsed from task creation or week start (whichever is later)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(weekStartDate);
    weekStart.setHours(0, 0, 0, 0);
    // Cap effective end at weekEnd so past weeks don't inflate daysElapsed beyond 7
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(0, 0, 0, 0);

    // Use the later of week start or task creation date
    const taskCreatedAt = new Date(task.created_at);
    taskCreatedAt.setHours(0, 0, 0, 0);
    const effectiveStart = taskCreatedAt > weekStart ? taskCreatedAt : weekStart;
    const effectiveEnd = today < weekEnd ? today : weekEnd;

    let daysElapsed = 1; // At least 1 day
    if (effectiveEnd >= effectiveStart) {
      const diffTime = effectiveEnd.getTime() - effectiveStart.getTime();
      daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
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
      // Boolean: row is green when ≥60% of elapsed days are successful
      const effectiveDays = task.follow_up_frequency === 'daily' ? daysElapsed : Math.max(1, Math.ceil(daysElapsed / 7));
      const pct = totalSpent / effectiveDays;
      return pct >= 0.60 ? 'weekly-on-track' : 'weekly-below-target';
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
   * Mark task as completed.
   * For native weekly tasks: also sets global task.is_completed so the task
   * does NOT reappear after the week rolls over.
   */
  const handleWeeklyTaskComplete = async (taskId: number) => {
    try {
      await updateWeeklyTaskStatus(taskId, weekStartString, {
        is_completed: true,
        is_na: false,
      });
      // Persist globally for native weekly tasks so they don't come back next week
      const task = tasks.find(t => t.id === taskId);
      if (task?.follow_up_frequency === 'weekly') {
        await completeTask(taskId);
      }
      await loadWeeklyTaskStatuses(weekStartString);
    } catch (err: any) {
      console.error('Error marking task complete:', err);
    }
  };

  /**
   * Mark task as NA.
   * For native weekly tasks: also sets global task.is_active = false so the task
   * does NOT reappear after the week rolls over.
   */
  const handleWeeklyTaskNA = async (taskId: number) => {
    try {
      await updateWeeklyTaskStatus(taskId, weekStartString, {
        is_completed: false,
        is_na: true,
      });
      // Persist globally for native weekly tasks so they don't come back next week
      const task = tasks.find(t => t.id === taskId);
      if (task?.follow_up_frequency === 'weekly') {
        await markTaskNA(taskId);
      }
      await loadWeeklyTaskStatuses(weekStartString);
    } catch (err: any) {
      console.error('Error marking task NA:', err);
    }
  };

  /**
   * Restore a completed/NA task back to active status.
   * For native weekly tasks: also reactivates globally so the task reappears.
   */
  const handleRestoreWeeklyTask = async (taskId: number) => {
    try {
      await updateWeeklyTaskStatus(taskId, weekStartString, {
        is_completed: false,
        is_na: false,
      });
      // Reactivate globally for native weekly tasks
      const task = tasks.find(t => t.id === taskId);
      if (task?.follow_up_frequency === 'weekly') {
        await reactivateTask(taskId);
      }
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

  /**
   * Get inline style for boolean success rate badge based on 60% threshold.
   * ≥60% = green, 45-59% = yellow/orange, <45% = red
   */
  const getBooleanSuccessStyle = (pct: number): React.CSSProperties => {
    if (pct >= 60) return {
      display: 'inline-block', padding: '3px 8px', borderRadius: '12px',
      background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '12px'
    };
    if (pct >= 45) return {
      display: 'inline-block', padding: '3px 8px', borderRadius: '12px',
      background: '#fef3c7', color: '#b45309', fontWeight: 700, fontSize: '12px'
    };
    return {
      display: 'inline-block', padding: '3px 8px', borderRadius: '12px',
      background: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: '12px'
    };
  };

  // Compute summary data for weekly home tab banner
  const weeklySummaryData = useMemo(() => {
    // --- Home weekly tasks ---
    const allHomeTasks = [...tasksByType.time, ...tasksByType.count, ...tasksByType.boolean];
    const totalTasks = allHomeTasks.length;
    let behindCount = 0;
    let achievedCount = 0;
    allHomeTasks.forEach(task => {
      let totalSpent = 0;
      weekDays.forEach((day: { dateString: string; index: number }) => {
        const pendingKey = `${task.id}-${day.dateString}-0`;
        if (pendingChanges[pendingKey] !== undefined) {
          totalSpent += pendingChanges[pendingKey].value;
        } else {
          const dayEntries = weeklyDailyEntries.filter(
            (e: { task_id: number; entry_date: string; minutes?: number }) =>
              e.task_id === task.id && e.entry_date.split('T')[0] === day.dateString
          );
          totalSpent += dayEntries.reduce((sum: number, e: { minutes?: number }) => sum + (e.minutes || 0), 0);
        }
      });
      if (getWeeklyRowColorClass(task, totalSpent) === 'weekly-below-target') {
        behindCount++;
      } else if (getWeeklyRowColorClass(task, totalSpent) === 'weekly-on-track') {
        achievedCount++;
      }
    });

    // --- Monitoring (daily) tasks tracked on weekly tab ---
    const allMonitoringTasks = [...monitoringTasksByType.time, ...monitoringTasksByType.count, ...monitoringTasksByType.boolean];
    const totalMonitoring = allMonitoringTasks.length;
    let achievedMonitoring = 0;
    let notAchievedMonitoring = 0;
    allMonitoringTasks.forEach(task => {
      const totalSpent = weekDays.reduce((sum: number, day: { index: number }) => sum + getWeeklyTime(task.id, day.index), 0);
      const colorClass = getWeeklyRowColorClass(task, totalSpent);
      if (colorClass === 'weekly-on-track') achievedMonitoring++;
      else notAchievedMonitoring++;
    });

    return { totalTasks, achievedCount, behindCount, totalMonitoring, achievedMonitoring, notAchievedMonitoring };
  }, [tasksByType, monitoringTasksByType, weekDays, pendingChanges, weeklyDailyEntries, weekStartDate, dailyAggregatesWeekly]);

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
    // Calculate days elapsed and remaining
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(weekStartDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // Use the later of week start or task creation date as the effective start
    const taskCreatedAt = new Date(task.created_at);
    taskCreatedAt.setHours(0, 0, 0, 0);
    const effectiveStart = taskCreatedAt > weekStart ? taskCreatedAt : weekStart;
    
    let daysElapsed = 1; // At least 1 day
    if (today >= effectiveStart) {
      if (today <= weekEnd) {
        const diffTime = today.getTime() - effectiveStart.getTime();
        daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      } else {
        // Past week - count from effective start to week end
        const diffTime = weekEnd.getTime() - effectiveStart.getTime();
        daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    
    // Daily ideal target (for display - NOT adjusted for daysElapsed)
    const dailyIdeal = task.task_type === TaskType.COUNT 
      ? (task.follow_up_frequency === 'daily' ? (task.target_value || 0) : (task.target_value || 0) / 7)
      : (task.follow_up_frequency === 'daily' ? task.allocated_minutes : task.allocated_minutes / 7);
    
    // Calculate days in tracking period (from effectiveStart to weekEnd)
    let daysInTrackingPeriod = 7;
    if (effectiveStart > weekStart) {
      // Task created mid-week - count from creation to week end
      const diffTime = weekEnd.getTime() - effectiveStart.getTime();
      daysInTrackingPeriod = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    
    // Expected target for the FULL tracking period (not just elapsed days)
    const weeklyTarget = task.task_type === TaskType.COUNT 
      ? (task.follow_up_frequency === 'daily' ? (task.target_value || 0) * daysInTrackingPeriod : (task.target_value || 0))
      : (task.follow_up_frequency === 'daily' ? task.allocated_minutes * daysInTrackingPeriod : task.allocated_minutes);
    
    let daysRemaining = 0;
    if (today >= effectiveStart && today <= weekEnd) {
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
          {task.task_type === TaskType.BOOLEAN ? (
            <span style={{ fontSize: '12px', color: '#4a5568' }}>
              1/day
              <br/>
              <span style={{ fontSize: '10px', color: '#718096' }}>Goal: ≥60%</span>
            </span>
          ) : formatValue(task, dailyIdeal)}
        </td>
        
        {/* Actual Avg/Day - Sticky Column 3 */}
        <td 
          className={`col-time sticky-col sticky-col-3 ${rowColorClass}`}
          style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}
        >
          {task.task_type === TaskType.BOOLEAN ? (() => {
            // Use daysElapsed (not full 7) so Monday with 1 Yes = 1/1 = 100%, not 1/7 = 14%
            const effectiveDays = task.follow_up_frequency === 'daily' ? daysElapsed : 1;
            const pct = effectiveDays > 0 ? Math.round((totalSpent / effectiveDays) * 100) : 0;
            const icon = pct >= 65 ? '✅' : pct >= 50 ? '⚠️' : '🔴';
            return (
              <span style={getBooleanSuccessStyle(pct)} title={pct >= 60 ? 'Achieved ≥60% goal' : pct >= 45 ? 'At risk — below 60%' : 'Needs recovery'}>
                {totalSpent}/{effectiveDays} days {icon}<br/>{pct}%
              </span>
            );
          })() : formatValue(task, avgSpentPerDay)}
        </td>
        
        {/* Needed Avg/Day - Sticky Column 4 */}
        <td 
          className={`col-time sticky-col sticky-col-4 ${rowColorClass}`}
          style={{ textAlign: 'center', color: '#2d3748', ...(bgColor ? { backgroundColor: bgColor } : {}) }}
        >
          {task.task_type === TaskType.BOOLEAN ? (() => {
            // Target is 70% of the full tracking period; needed = remaining successes required
            const trackingDays = task.follow_up_frequency === 'daily' ? daysInTrackingPeriod : 1;
            const targetSuccesses = Math.ceil(trackingDays * 0.60);
            const needed = Math.max(0, targetSuccesses - totalSpent);
            if (needed === 0) return <span style={{ color: '#15803d', fontSize: '12px', fontWeight: 600 }}>✅ Goal met</span>;
            return <span style={{ color: '#b91c1c', fontSize: '12px' }}>Need {needed} more</span>;
          })() : formatValue(task, avgRemainingPerDay)}
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
              className={`col-hour ${cellColorClass} ${rowColorClass}`}
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
              background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)',
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
                  <th key={day.index} className="col-hour" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>
                    {day.label}
                  </th>
                ))}
                <th className="col-status" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>
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
            {/* Weekly Summary Banner */}
            {(weeklySummaryData.totalTasks > 0 || weeklySummaryData.totalMonitoring > 0) && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                marginBottom: '16px', flexWrap: 'wrap',
                background: weeklySummaryData.behindCount > 0 || weeklySummaryData.notAchievedMonitoring > 0 ? '#fff5f5' : '#f0fdf4',
                border: `1.5px solid ${weeklySummaryData.behindCount > 0 || weeklySummaryData.notAchievedMonitoring > 0 ? '#fca5a5' : '#86efac'}`,
                borderRadius: '8px', fontSize: '14px', fontWeight: 500
              }}>
                <span>{weeklySummaryData.behindCount > 0 || weeklySummaryData.notAchievedMonitoring > 0 ? '⚠️' : '✅'}</span>
                {weeklySummaryData.totalTasks > 0 && (<>
                  <span style={{ color: '#374151' }}>Total Weekly Tasks: <strong>{weeklySummaryData.totalTasks}</strong></span>
                  <span style={{ color: '#9ca3af' }}>|</span>
                  <span style={{ color: '#16a34a' }}>Achieved: <strong>{weeklySummaryData.achievedCount}</strong></span>
                  <span style={{ color: '#9ca3af' }}>|</span>
                  <span style={{ color: weeklySummaryData.behindCount > 0 ? '#dc2626' : '#16a34a' }}>
                    Not reached Target: <strong>{weeklySummaryData.behindCount}</strong>
                  </span>
                </>)}
                {weeklySummaryData.totalTasks > 0 && weeklySummaryData.totalMonitoring > 0 && (
                  <span style={{ color: '#d1d5db', margin: '0 4px' }}>｜</span>
                )}
                {weeklySummaryData.totalMonitoring > 0 && (<>
                  <span style={{ color: '#374151' }}>Total Daily Tasks (on Weekly): <strong>{weeklySummaryData.totalMonitoring}</strong></span>
                  <span style={{ color: '#9ca3af' }}>|</span>
                  <span style={{ color: '#16a34a' }}>Achieved: <strong>{weeklySummaryData.achievedMonitoring}</strong></span>
                  <span style={{ color: '#9ca3af' }}>|</span>
                  <span style={{ color: weeklySummaryData.notAchievedMonitoring > 0 ? '#dc2626' : '#16a34a' }}>
                    Not Achieved: <strong>{weeklySummaryData.notAchievedMonitoring}</strong>
                  </span>
                </>)}
              </div>
            )}
            <div className="alert" style={{ background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)', color: 'white', border: 'none', marginBottom: '24px', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                <i className="fas fa-calendar-week me-2"></i>
                📅 Weekly Tasks - Home Tab ({nativeWeeklyTasks.length} tasks) - Track progress day-by-day (Mon-Sun) or mark complete/NA for the entire week.
              </div>
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
            <div className="alert alert-info" style={{ marginBottom: '24px', padding: '12px 16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                <i className="fas fa-chart-line me-2"></i>
                📊 Weekly Monitoring - Read-Only ({monitoringTasks.length} tasks) - Daily/Monthly tasks monitored at weekly level. Values aggregated from their home tabs.
              </div>
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
