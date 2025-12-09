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
import { 
  getWeekStart, 
  addDays, 
  formatDateForInput,
  getShortDayName
} from '../utils/dateHelpers';
import {
  sortTasksByHierarchy,
} from '../utils/taskHelpers';

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
        await Promise.all([
          loadWeeklyTaskStatuses(weekStartString),
          loadDailyAggregatesForWeek(weekStartString),
        ]);
      } catch (err) {
        console.error('Error loading week data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (tasks.length > 0) {
      loadWeekData();
    }
  }, [weekStartString, tasks.length]);

  // ============================================================================
  // TASK FILTERING & GROUPING
  // ============================================================================
  
  /**
   * Filter tasks for weekly view
   * 
   * Business Rule: Show only tasks that have been explicitly added to weekly tracking
   * This is determined by presence in weeklyTaskStatuses map
   */
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      // Must be explicitly added to weekly tracking
      const hasBeenAddedToWeekly = weeklyTaskStatuses[task.id] !== undefined;
      if (!hasBeenAddedToWeekly) return false;

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

    filteredTasks.forEach(task => {
      if (task.task_type === TaskType.TIME) {
        groups.time.push(task);
      } else if (task.task_type === TaskType.COUNT) {
        groups.count.push(task);
      } else if (task.task_type === TaskType.BOOLEAN) {
        groups.boolean.push(task);
      }
    });

    return groups;
  }, [filteredTasks]);

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
        expectedTarget = task.allocated_minutes * daysElapsed;
      } else {
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
      expectedValue = task.follow_up_frequency === 'daily' 
        ? task.allocated_minutes 
        : task.allocated_minutes / 7;
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

  // ============================================================================
  // HELPER FUNCTIONS - UI Utilities
  // ============================================================================
  
  /**
   * Format value display based on task type
   */
  const formatValue = (task: Task, value: number): string => {
    if (task.task_type === TaskType.TIME) {
      return `${value} min`;
    } else if (task.task_type === TaskType.COUNT) {
      return `${value} ${task.unit}`;
    } else {
      return value > 0 ? 'Yes' : 'No';
    }
  };

  // ============================================================================
  // RENDERING HELPERS
  // ============================================================================
  
  /**
   * Render a single task row with full styling
   */
  const renderTaskRow = (task: Task) => {
    // Calculate totals for this task
    const totalSpent = weekDays.reduce((sum, day) => sum + getWeeklyTime(task.id, day.index), 0);
    
    // Calculate target and averages
    const weeklyTarget = task.task_type === TaskType.COUNT 
      ? (task.target_value || 0) * 7 
      : task.allocated_minutes * 7;
    
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
    
    const avgSpentPerDay = Math.round(totalSpent / daysElapsed);
    const remaining = weeklyTarget - totalSpent;
    const avgRemainingPerDay = daysRemaining > 0 ? Math.round(remaining / daysRemaining) : 0;
    
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
        
        {/* Ideal Average/Day - Sticky Column 2 */}
        <td 
          className={`col-time sticky-col sticky-col-2 ${rowColorClass}`}
          style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}
        >
          {formatValue(task, task.task_type === TaskType.COUNT ? (task.target_value || 0) : task.allocated_minutes)}
        </td>
        
        {/* Actual Average/Day - Sticky Column 3 */}
        <td 
          className={`col-time sticky-col sticky-col-3 ${rowColorClass}`}
          style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}
        >
          {formatValue(task, avgSpentPerDay)}
        </td>
        
        {/* Needed Average/Day - Sticky Column 4 */}
        <td 
          className={`col-time sticky-col sticky-col-4 ${rowColorClass}`}
          style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}
        >
          {formatValue(task, avgRemainingPerDay)}
        </td>
        
        {/* 7 Day Columns */}
        {weekDays.map(day => {
          const dayValue = getWeeklyTime(task.id, day.index);
          const cellColorClass = getWeeklyCellColorClass(task, dayValue, day.date);
          
          return (
            <td 
              key={day.index} 
              className={`col-hour ${cellColorClass}`}
              style={{ 
                backgroundColor: bgColor || (dayValue > 0 && !cellColorClass ? '#e6ffed' : undefined),
                textAlign: 'center',
                fontSize: '12px'
              }}
            >
              {dayValue > 0 ? (task.task_type === TaskType.BOOLEAN ? '✓' : dayValue) : '-'}
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
          ) : (
            <div className="action-buttons">
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
  const renderTaskSection = (sectionTitle: string, emoji: string, sectionClass: string, tasks: Task[]) => {
    if (tasks.length === 0) return null;

    return (
      <div style={{ marginBottom: '32px' }}>
        {/* Section Header */}
        <h3 className={`task-section-header ${sectionClass}`}>
          <span className="emoji">{emoji}</span>
          <span>{sectionTitle}</span>
          <span className="subtitle">(Auto-calculated from Daily)</span>
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
                  Ideal<br/>Average/Day
                </th>
                <th className="col-time sticky-col sticky-col-3" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fef3c7' }}>
                  Actual<br/>Average/Day
                </th>
                <th className="col-time sticky-col sticky-col-4" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fef3c7' }}>
                  Needed<br/>Average/Day
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
      {/* Task Sections by Type */}
      <div className="row">
        <div className="col">
          {filteredTasks.length === 0 ? (
            <div className="alert alert-warning">
              <i className="fas fa-exclamation-triangle me-2"></i>
              No weekly tasks found. Adjust your filters or add new weekly tasks.
            </div>
          ) : (
            <>
              {renderTaskSection('Time-Based Tasks', '⏱️', 'time-based', tasksByType.time)}
              {renderTaskSection('Count-Based Tasks', '🔢', 'count-based', tasksByType.count)}
              {renderTaskSection('Yes/No Tasks', '✅', 'boolean-based', tasksByType.boolean)}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default WeeklyTasks;
