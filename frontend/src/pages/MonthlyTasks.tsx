/**
 * Monthly Tasks Page
 * 
 * Displays and manages monthly task entries with time/count tracking.
 * Uses shared components for consistent UX across all time tracking pages.
 * 
 * Features:
 * - Month navigation with date picker
 * - Pillar/Category filtering
 * - Task hierarchy grouping
 * - Monthly time entry grid
 * - Weekly/daily task aggregation display
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTaskContext, useTimeEntriesContext, useUserPreferencesContext } from '../contexts';
import { DateNavigator, TaskFilters, TaskHierarchyGroup, TimeEntryGrid, TimeEntryData } from '../components';
import { 
  getMonthStart, 
  formatDateForInput
} from '../utils/dateHelpers';
import {
  filterByPillarAndCategory,
  groupTasksByHierarchy,
  isTaskActive,
  sortTasksByHierarchy,
} from '../utils/taskHelpers';

const MonthlyTasks: React.FC = () => {
  // Context hooks
  const { tasks, loadTasks, loadPillars, loadCategories } = useTaskContext();
  const { monthlyEntries, loadMonthlyEntries, saveMonthlyEntry, updateMonthlyEntry } = useTimeEntriesContext();
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

  // Calculate month start from selected date
  const monthStartDate = useMemo(() => getMonthStart(selectedDate), [selectedDate]);
  const monthStartString = formatDateForInput(monthStartDate);

  // Get month display info
  const monthInfo = useMemo(() => {
    const month = monthStartDate.getMonth();
    const year = monthStartDate.getFullYear();
    return {
      month,
      year,
      monthName: monthStartDate.toLocaleDateString('en-US', { month: 'long' }),
      monthYear: `${monthStartDate.toLocaleDateString('en-US', { month: 'long' })} ${year}`,
    };
  }, [monthStartDate]);

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
   * Load monthly entries when month changes
   */
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await loadMonthlyEntries(monthStartString);
      } catch (err) {
        console.error('Error loading monthly entries:', err);
        setError('Failed to load monthly entries');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [monthStartString]);

  /**
   * Filter tasks based on current criteria
   */
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      // Filter by monthly frequency
      if (task.follow_up_frequency !== 'monthly' && task.follow_up_frequency !== 'weekly' && task.follow_up_frequency !== 'daily') {
        return false;
      }

      // Filter by status
      if (!showInactive && !isTaskActive(task)) return false;
      if (!showCompleted && task.is_completed) return false;
      if (!showNA && task.na_marked_at) return false;

      return true;
    });

    // Apply pillar/category filters
    filtered = filterByPillarAndCategory(filtered, selectedPillar, selectedCategory);

    return filtered;
  }, [tasks, selectedPillar, selectedCategory, showCompleted, showNA, showInactive]);

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
   * Convert monthly entries to map for TimeEntryGrid
   */
  const entriesMap = useMemo(() => {
    const map = new Map<number, TimeEntryData>();
    monthlyEntries.forEach(entry => {
      map.set(entry.task_id, {
        taskId: entry.task_id,
        timeSpent: entry.time_spent,
        count: entry.count,
        notes: entry.notes,
        isCompleted: false, // Monthly entries don't have completion status
        isNA: false,
      });
    });
    return map;
  }, [monthlyEntries]);

  /**
   * Handle time entry change
   */
  const handleEntryChange = async (taskId: number, updates: Partial<TimeEntryData>) => {
    try {
      const existingEntry = monthlyEntries.find(e => e.task_id === taskId);
      
      if (existingEntry) {
        await updateMonthlyEntry(existingEntry.id, {
          time_spent: updates.timeSpent,
          count: updates.count,
          notes: updates.notes,
        });
      } else {
        await saveMonthlyEntry({
          task_id: taskId,
          month_start_date: monthStartString,
          time_spent: updates.timeSpent,
          count: updates.count,
          notes: updates.notes,
        });
      }
    } catch (err) {
      console.error('Error saving monthly entry:', err);
      setError('Failed to save entry');
    }
  };

  /**
   * Handle task completion (not applicable for monthly)
   */
  const handleComplete = async (_taskId: number) => {
    console.log('Completion not applicable for monthly view');
  };

  /**
   * Handle mark NA (not applicable for monthly)
   */
  const handleMarkNA = async (_taskId: number) => {
    console.log('N/A not applicable for monthly view');
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
          <p className="mt-2">Loading monthly tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      <div className="row mb-4">
        <div className="col">
          <h2>
            <i className="fas fa-calendar-alt me-2"></i>
            Monthly Tasks
          </h2>
          <p className="text-muted">
            Track your monthly tasks and monitor daily task aggregates
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
            navigationType="monthly"
            showDatePicker={true}
          />
        </div>
      </div>

      {/* Month Info Display */}
      <div className="row mb-3">
        <div className="col">
          <div className="month-info-display alert alert-light">
            <i className="fas fa-calendar-alt me-2"></i>
            <strong>{monthInfo.monthYear}</strong>
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
            <strong>{filteredTasks.length}</strong> tasks shown
            {selectedPillar && <span> in <strong>{selectedPillar}</strong></span>}
            {selectedCategory && <span> / <strong>{selectedCategory}</strong></span>}
          </div>
        </div>
      </div>

      {/* Task Groups */}
      <div className="row">
        <div className="col">
          {Object.keys(groupedTasks).length === 0 ? (
            <div className="alert alert-warning">
              <i className="fas fa-exclamation-triangle me-2"></i>
              No monthly tasks found. Adjust your filters or add new monthly tasks.
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

export default MonthlyTasks;
