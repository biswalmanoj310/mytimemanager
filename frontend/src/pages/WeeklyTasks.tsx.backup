/**
 * Weekly Tasks Page
 * 
 * Displays and manages weekly task entries with time/count tracking.
 * Uses shared components for consistent UX across all time tracking pages.
 * 
 * Features:
 * - Week navigation with date picker
 * - Pillar/Category filtering
 * - Task hierarchy grouping
 * - Weekly time entry grid
 * - Daily task aggregation display
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTaskContext, useTimeEntriesContext, useUserPreferencesContext } from '../contexts';
import { DateNavigator, TaskFilters, TaskHierarchyGroup, TimeEntryGrid, TimeEntryData } from '../components';
import { 
  getWeekStart, 
  addDays, 
  formatDateForInput,
  getShortDayName
} from '../utils/dateHelpers';
import {
  filterByPillarAndCategory,
  groupTasksByHierarchy,
  isTaskActive,
  sortTasksByHierarchy,
} from '../utils/taskHelpers';

const WeeklyTasks: React.FC = () => {
  // Context hooks
  const { tasks, loadTasks, loadPillars, loadCategories } = useTaskContext();
  const { 
    weeklyEntries, 
    loadWeeklyEntries, 
    saveWeeklyEntry, 
    updateWeeklyEntry,
    weeklyTaskStatuses,
    loadWeeklyTaskStatuses,
    updateWeeklyTaskStatus,
    dailyAggregatesWeekly,
    loadDailyAggregatesForWeek,
  } = useTimeEntriesContext();
  const {
    selectedDate,
    setSelectedDate,
    selectedPillar,
    setSelectedPillar,
    selectedCategory,
    setSelectedCategory,
    showCompleted,
    setShowCompleted,
    showNA,
    setShowNA,
    showInactive,
    setShowInactive,
    hierarchyOrder,
    taskNameOrder,
    expandedGroups,
    toggleGroup,
  } = useUserPreferencesContext();

  // Local state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate week start from selected date
  const weekStartDate = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekStartString = formatDateForInput(weekStartDate);

  // Get week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStartDate, i);
      return {
        date: day,
        dateString: formatDateForInput(day),
        dayName: getShortDayName(day),
        index: i,
      };
    });
  }, [weekStartDate]);

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
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  /**
   * Load weekly entries, task statuses, and daily aggregates when week changes
   */
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          loadWeeklyEntries(weekStartString),
          loadWeeklyTaskStatuses(weekStartString),
          loadDailyAggregatesForWeek(weekStartString),
        ]);
      } catch (err) {
        console.error('Error loading weekly data:', err);
        setError('Failed to load weekly data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [weekStartString, loadWeeklyEntries, loadWeeklyTaskStatuses, loadDailyAggregatesForWeek]);

  /**
   * Filter tasks based on current criteria
   * IMPORTANT: Weekly tab shows tasks that have been explicitly added to weekly tracking
   * (tracked via weeklyTaskStatuses), NOT filtered by frequency
   */
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      // CRITICAL: Only show tasks that have been explicitly added to weekly tracking
      // This is determined by presence in weeklyTaskStatuses, not by frequency
      const hasBeenAddedToWeekly = weeklyTaskStatuses[task.id] !== undefined;
      if (!hasBeenAddedToWeekly) {
        return false;
      }

      // Check weekly-specific completion status
      const taskStatus = weeklyTaskStatuses[task.id];
      if (taskStatus) {
        // If completed/NA for THIS week, show with proper status
        if (taskStatus.is_completed || taskStatus.is_na) {
          return true;
        }
      }

      // Filter by status preferences
      if (!showInactive && !isTaskActive(task)) return false;
      if (!showCompleted && task.is_completed) return false;
      if (!showNA && task.na_marked_at) return false;

      return true;
    });

    // Apply pillar/category filters
    filtered = filterByPillarAndCategory(filtered, selectedPillar, selectedCategory);

    return filtered;
  }, [tasks, weeklyTaskStatuses, selectedPillar, selectedCategory, showCompleted, showNA, showInactive]);

  /**
   * Group tasks by hierarchy
   */
  const groupedTasks = useMemo(() => {
    // First sort tasks by hierarchy
    const sorted = sortTasksByHierarchy(filteredTasks, hierarchyOrder, taskNameOrder);
    // Then group them
    return groupTasksByHierarchy(sorted);
  }, [filteredTasks, hierarchyOrder, taskNameOrder]);

  /**
   * Get weekly time for a task and day
   * Combines manual weekly entries and aggregated daily data
   */
  const getWeeklyTime = useCallback((taskId: number, dayIndex: number): number => {
    // For daily tasks: Use aggregated daily data
    const task = tasks.find(t => t.id === taskId);
    if (task && task.follow_up_frequency === 'daily') {
      const key = `${taskId}-${dayIndex}`;
      return dailyAggregatesWeekly[key] || 0;
    }
    
    // For weekly tasks: Use manual weekly entries
    // Note: weeklyEntries is an array, need to find matching entry
    const entry = weeklyEntries.find(e => e.task_id === taskId);
    if (entry) {
      // Weekly entries don't have per-day data, return total divided by 7 for now
      // This is a simplification - the old code had more complex logic
      return Math.round((entry.time_spent || entry.count || 0) / 7);
    }
    
    return 0;
  }, [tasks, dailyAggregatesWeekly, weeklyEntries]);

  /**
   * Convert tasks to display data
   * This is simplified - the old code had complex per-day tracking
   */
  const entriesMap = useMemo(() => {
    const map = new Map<number, TimeEntryData>();
    
    filteredTasks.forEach(task => {
      const taskStatus = weeklyTaskStatuses[task.id];
      map.set(task.id, {
        taskId: task.id,
        timeSpent: 0, // Will be calculated from getWeeklyTime
        count: 0,
        notes: '',
        isCompleted: taskStatus?.is_completed || false,
        isNA: taskStatus?.is_na || false,
      });
    });
    
    return map;
  }, [filteredTasks, weeklyTaskStatuses]);

  /**
   * Handle time entry change
   */
  const handleEntryChange = async (taskId: number, updates: Partial<TimeEntryData>) => {
    try {
      const existingEntry = weeklyEntries.find(e => e.task_id === taskId);
      
      if (existingEntry) {
        await updateWeeklyEntry(existingEntry.id, {
          time_spent: updates.timeSpent,
          count: updates.count,
          notes: updates.notes,
        });
      } else {
        await saveWeeklyEntry({
          task_id: taskId,
          week_start_date: weekStartString,
          time_spent: updates.timeSpent,
          count: updates.count,
          notes: updates.notes,
        });
      }
    } catch (err) {
      console.error('Error saving weekly entry:', err);
      setError('Failed to save entry');
    }
  };

  /**
   * Handle task completion (not applicable for weekly)
   */
  const handleComplete = async (_taskId: number) => {
    console.log('Completion not applicable for weekly view');
  };

  /**
   * Handle mark NA (not applicable for weekly)
   */
  const handleMarkNA = async (_taskId: number) => {
    console.log('N/A not applicable for weekly view');
  };

  /**
   * Clear filters
   */
  const handleClearFilters = () => {
    setSelectedPillar('');
    setSelectedCategory('');
    setShowCompleted(true);
    setShowNA(true);
    setShowInactive(false);
  };

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
    <div className="container-fluid mt-4">
      <div className="row mb-4">
        <div className="col">
          <h2>
            <i className="fas fa-calendar-week me-2"></i>
            Weekly Tasks
          </h2>
          <p className="text-muted">
            View daily tasks aggregated to weekly view - Shows how your daily habits perform over the week
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => setError(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Date Navigation */}
      <div className="row mb-4">
        <div className="col">
          <DateNavigator
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            navigationType="weekly"
            showDatePicker={true}
          />
        </div>
      </div>

      {/* Week Days Display */}
      <div className="row mb-3">
        <div className="col">
          <div className="week-days-display">
            <small className="text-muted">Week days: </small>
            {weekDays.map((day, index) => (
              <span key={index} className="badge bg-secondary me-1">
                {day.dayName} {day.dateString}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Task Filters */}
      <div className="row mb-4">
        <div className="col">
          <TaskFilters
            selectedPillar={selectedPillar}
            selectedCategory={selectedCategory}
            showCompleted={showCompleted}
            showNA={showNA}
            showInactive={showInactive}
            onPillarChange={setSelectedPillar}
            onCategoryChange={setSelectedCategory}
            onShowCompletedChange={setShowCompleted}
            onShowNAChange={setShowNA}
            onShowInactiveChange={setShowInactive}
            onClearFilters={handleClearFilters}
            showInactiveToggle={true}
          />
        </div>
      </div>

      {/* Tasks Summary */}
      <div className="row mb-3">
        <div className="col">
          <div className="alert alert-info">
            <i className="fas fa-info-circle me-2"></i>
            <strong>{filteredTasks.length}</strong> tasks tracked this week
            {selectedPillar && <span> in <strong>{selectedPillar}</strong></span>}
            {selectedCategory && <span> / <strong>{selectedCategory}</strong></span>}
            <div className="mt-2 small">
              <em>Note: Tasks shown here have been explicitly added to weekly tracking. 
              Daily tasks display aggregated data from daily entries.</em>
            </div>
          </div>
        </div>
      </div>

      {/* Task Groups */}
      <div className="row">
        <div className="col">
          {Object.keys(groupedTasks).length === 0 ? (
            <div className="alert alert-warning">
              <i className="fas fa-exclamation-triangle me-2"></i>
              No weekly tasks found. Adjust your filters or add new weekly tasks.
            </div>
          ) : (
            Object.entries(groupedTasks).map(([groupKey, groupTasks]) => (
              <TaskHierarchyGroup
                key={groupKey}
                groupKey={groupKey}
                groupName={groupKey}
                tasks={groupTasks}
                isExpanded={!expandedGroups.has(groupKey)}
                onToggle={toggleGroup}
                renderTask={(tasks) => (
                  <TimeEntryGrid
                    tasks={Array.isArray(tasks) ? tasks : [tasks]}
                    entries={entriesMap}
                    onEntryChange={handleEntryChange}
                    onComplete={handleComplete}
                    onMarkNA={handleMarkNA}
                    showNotes={true}
                  />
                )}
                showTaskCount={true}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WeeklyTasks;
