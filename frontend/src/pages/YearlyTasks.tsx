/**
 * ============================================================================
 * YEARLY TASKS PAGE - Complete Implementation with Full Styling
 * ============================================================================
 * 
 * Production-ready yearly task tracking with full styling and color logic
 * Self-contained architecture with inline helpers for clarity
 * 
 * ============================================================================
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTaskContext, useTimeEntriesContext, useUserPreferencesContext } from '../contexts';
import { Task, TaskType } from '../types';
import { 
  getYearStart,
} from '../utils/dateHelpers';
import {
  sortTasksByHierarchy,
} from '../utils/taskHelpers';

const YearlyTasks: React.FC = () => {
  const { tasks, loadTasks, loadPillars, loadCategories } = useTaskContext();
  const { 
    yearlyTaskStatuses,
    loadYearlyTaskStatuses,
    updateYearlyTaskStatus,
    yearlyMonthlyAggregates,
    loadMonthlyAggregatesForYear,
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

  const [loading, setLoading] = useState(false);

  const yearStartDate = useMemo(() => getYearStart(selectedDate), [selectedDate]);
  const yearNumber = useMemo(() => yearStartDate.getFullYear(), [yearStartDate]);

  const months = useMemo(() => {
    return [
      { month: 1, name: 'Jan', fullName: 'January' },
      { month: 2, name: 'Feb', fullName: 'February' },
      { month: 3, name: 'Mar', fullName: 'March' },
      { month: 4, name: 'Apr', fullName: 'April' },
      { month: 5, name: 'May', fullName: 'May' },
      { month: 6, name: 'Jun', fullName: 'June' },
      { month: 7, name: 'Jul', fullName: 'July' },
      { month: 8, name: 'Aug', fullName: 'August' },
      { month: 9, name: 'Sep', fullName: 'September' },
      { month: 10, name: 'Oct', fullName: 'October' },
      { month: 11, name: 'Nov', fullName: 'November' },
      { month: 12, name: 'Dec', fullName: 'December' },
    ];
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        await Promise.all([loadTasks(), loadPillars(), loadCategories()]);
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const loadYearData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          loadYearlyTaskStatuses(yearNumber),
          loadMonthlyAggregatesForYear(yearNumber),
        ]);
      } catch (err) {
        console.error('Error loading year data:', err);
      } finally {
        setLoading(false);
      }
    };
    if (tasks.length > 0) {
      loadYearData();
    }
  }, [yearNumber, tasks.length]);

  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      const hasBeenAddedToYearly = yearlyTaskStatuses[task.id] !== undefined;
      if (!hasBeenAddedToYearly) return false;
      if (selectedPillar && task.pillar_name !== selectedPillar) return false;
      if (selectedCategory && task.category_name !== selectedCategory) return false;
      const yearlyStatus = yearlyTaskStatuses[task.id];
      const isCompleted = yearlyStatus?.is_completed || false;
      const isNA = yearlyStatus?.is_na || false;
      if (!showCompleted && isCompleted) return false;
      if (!showNA && isNA) return false;
      if (!showInactive && !task.is_active) return false;
      return true;
    });
    return sortTasksByHierarchy(filtered, hierarchyOrder, taskNameOrder);
  }, [tasks, yearlyTaskStatuses, selectedPillar, selectedCategory, showCompleted, showNA, showInactive, hierarchyOrder, taskNameOrder]);

  const tasksByType = useMemo(() => {
    const groups: { time: Task[]; count: Task[]; boolean: Task[]; } = { time: [], count: [], boolean: [] };
    filteredTasks.forEach(task => {
      if (task.task_type === TaskType.TIME) groups.time.push(task);
      else if (task.task_type === TaskType.COUNT) groups.count.push(task);
      else if (task.task_type === TaskType.BOOLEAN) groups.boolean.push(task);
    });
    return groups;
  }, [filteredTasks]);

  const getYearlyTime = (taskId: number, month: number): number => {
    const key = `${taskId}-${month}`;
    return yearlyMonthlyAggregates[key] || 0;
  };

  const getYearlyRowColorClass = (task: Task, totalSpent: number, trackingStartMonth: number | null): string => {
    // If trackingStartMonth is null, task was added before this year - no special handling needed
    if (trackingStartMonth === null) {
      trackingStartMonth = 1; // Track from beginning of year
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yearStart = new Date(yearStartDate);
    yearStart.setHours(0, 0, 0, 0);
    
    // Calculate months elapsed from tracking start (not from January)
    let monthsElapsed = 1;
    if (today.getFullYear() === yearStart.getFullYear()) {
      // Current year: from tracking start month to current month
      const currentMonth = today.getMonth() + 1;
      monthsElapsed = Math.max(1, currentMonth - trackingStartMonth + 1);
    } else if (today.getFullYear() > yearStart.getFullYear()) {
      // Past year: from tracking start month to December
      monthsElapsed = Math.max(1, 12 - trackingStartMonth + 1);
    }
    
    let expectedTarget = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        const daysPerMonth = 365 / 12;
        expectedTarget = (task.target_value || 0) * daysPerMonth * monthsElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        const weeksPerMonth = 52 / 12;
        expectedTarget = (task.target_value || 0) * weeksPerMonth * monthsElapsed;
      } else if (task.follow_up_frequency === 'monthly') {
        expectedTarget = (task.target_value || 0) * monthsElapsed;
      } else {
        expectedTarget = (task.target_value || 0) * (monthsElapsed / 12);
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      if (task.follow_up_frequency === 'daily') {
        expectedTarget = (365 / 12) * monthsElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        expectedTarget = (52 / 12) * monthsElapsed;
      } else if (task.follow_up_frequency === 'monthly') {
        expectedTarget = monthsElapsed;
      } else {
        expectedTarget = monthsElapsed / 12;
      }
    } else {
      if (task.follow_up_frequency === 'daily') {
        expectedTarget = task.allocated_minutes * (365 / 12) * monthsElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        expectedTarget = task.allocated_minutes * (52 / 12) * monthsElapsed;
      } else if (task.follow_up_frequency === 'monthly') {
        expectedTarget = task.allocated_minutes * monthsElapsed;
      } else {
        expectedTarget = task.allocated_minutes * (monthsElapsed / 12);
      }
    }
    
    if (totalSpent >= expectedTarget) return 'weekly-on-track';
    else if (totalSpent > 0) return 'weekly-below-target';
    return '';
  };

  const getYearlyCellColorClass = (task: Task, actualValue: number, month: number): string => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const selectedYear = yearStartDate.getFullYear();
    
    if (selectedYear > currentYear) return '';
    if (selectedYear === currentYear && month > currentMonth) return '';
    
    let expectedValue = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        expectedValue = (task.target_value || 0) * (365 / 12);
      } else if (task.follow_up_frequency === 'weekly') {
        expectedValue = (task.target_value || 0) * (52 / 12);
      } else if (task.follow_up_frequency === 'monthly') {
        expectedValue = task.target_value || 0;
      } else {
        expectedValue = (task.target_value || 0) / 12;
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      if (task.follow_up_frequency === 'daily') {
        expectedValue = 365 / 12;
      } else if (task.follow_up_frequency === 'weekly') {
        expectedValue = 52 / 12;
      } else if (task.follow_up_frequency === 'monthly') {
        expectedValue = 1;
      } else {
        expectedValue = 1 / 12;
      }
    } else {
      if (task.follow_up_frequency === 'daily') {
        expectedValue = task.allocated_minutes * (365 / 12);
      } else if (task.follow_up_frequency === 'weekly') {
        expectedValue = task.allocated_minutes * (52 / 12);
      } else if (task.follow_up_frequency === 'monthly') {
        expectedValue = task.allocated_minutes;
      } else {
        expectedValue = task.allocated_minutes / 12;
      }
    }
    
    if (actualValue >= expectedValue) return 'cell-achieved';
    else if (expectedValue > 0) return 'cell-below-target';
    return '';
  };

  const handleYearlyTaskComplete = async (taskId: number) => {
    try {
      await updateYearlyTaskStatus(taskId, yearNumber, { is_completed: true, is_na: false });
      await loadYearlyTaskStatuses(yearNumber);
    } catch (err: any) {
      console.error('Error marking task complete:', err);
    }
  };

  const handleYearlyTaskNA = async (taskId: number) => {
    try {
      await updateYearlyTaskStatus(taskId, yearNumber, { is_completed: false, is_na: true });
      await loadYearlyTaskStatuses(yearNumber);
    } catch (err: any) {
      console.error('Error marking task NA:', err);
    }
  };



  const formatValue = (task: Task, value: number): string => {
    if (task.task_type === TaskType.TIME) return `${Math.round(value)} min`;
    else if (task.task_type === TaskType.COUNT) return `${Math.round(value)} ${task.unit}`;
    else return value > 0 ? 'Yes' : 'No';
  };

  const renderTaskRow = (task: Task) => {
    const totalSpent = months.reduce((sum, m) => sum + getYearlyTime(task.id, m.month), 0);
    
    let yearlyTarget = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        yearlyTarget = (task.target_value || 0) * 365;
      } else if (task.follow_up_frequency === 'weekly') {
        yearlyTarget = Math.round((task.target_value || 0) * 52);
      } else if (task.follow_up_frequency === 'monthly') {
        yearlyTarget = (task.target_value || 0) * 12;
      } else {
        yearlyTarget = task.target_value || 0;
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      if (task.follow_up_frequency === 'daily') {
        yearlyTarget = 365;
      } else if (task.follow_up_frequency === 'weekly') {
        yearlyTarget = 52;
      } else if (task.follow_up_frequency === 'monthly') {
        yearlyTarget = 12;
      } else {
        yearlyTarget = 1;
      }
    } else {
      if (task.follow_up_frequency === 'daily') {
        yearlyTarget = task.allocated_minutes * 365;
      } else if (task.follow_up_frequency === 'weekly') {
        yearlyTarget = task.allocated_minutes * 52;
      } else if (task.follow_up_frequency === 'monthly') {
        yearlyTarget = task.allocated_minutes * 12;
      } else {
        yearlyTarget = task.allocated_minutes;
      }
    }
    
    // Determine tracking start month from created_at
    const yearlyStatus = yearlyTaskStatuses[task.id];
    let trackingStartMonth: number | null = 1; // Default to January if no created_at
    
    if (yearlyStatus?.created_at) {
      const createdDate = new Date(yearlyStatus.created_at);
      // Only apply tracking start if created in current year
      if (createdDate.getFullYear() === yearStartDate.getFullYear()) {
        trackingStartMonth = createdDate.getMonth() + 1; // 1-based month
      } else if (createdDate.getFullYear() < yearStartDate.getFullYear()) {
        // Task added in previous year, track from January
        trackingStartMonth = 1;
      } else {
        // Task added in future year (shouldn't happen), track from January
        trackingStartMonth = 1;
      }
    }
    
    const today = new Date();
    const yearStart = new Date(yearStartDate);
    
    // Calculate months elapsed from tracking start (not from January)
    let monthsElapsed = 1;
    if (today.getFullYear() === yearStart.getFullYear()) {
      // Current year: from tracking start month to current month
      const currentMonth = today.getMonth() + 1;
      monthsElapsed = Math.max(1, currentMonth - trackingStartMonth + 1);
    } else if (today.getFullYear() > yearStart.getFullYear()) {
      // Past year: from tracking start month to December
      monthsElapsed = Math.max(1, 12 - trackingStartMonth + 1);
    }
    
    const monthsRemaining = 12 - (today.getMonth() + 1); // Remaining in the year
    
    const avgSpentPerMonth = Math.round(totalSpent / monthsElapsed);
    const remaining = yearlyTarget - totalSpent;
    const avgRemainingPerMonth = monthsRemaining > 0 ? Math.round(remaining / monthsRemaining) : 0;
    
    const rowColorClass = getYearlyRowColorClass(task, totalSpent, trackingStartMonth);
    const yearlyStatus = yearlyTaskStatuses[task.id];
    const isYearlyCompleted = yearlyStatus?.is_completed || false;
    const isYearlyNA = yearlyStatus?.is_na || false;
    const rowClassName = isYearlyCompleted ? 'completed-row' : isYearlyNA ? 'na-row' : '';
    const bgColor = isYearlyCompleted ? '#c6f6d5' : isYearlyNA ? '#e2e8f0' : undefined;
    
    return (
      <tr key={task.id} className={rowClassName} style={bgColor ? { backgroundColor: bgColor } : undefined}>
        <td className={`col-task sticky-col sticky-col-1 ${rowColorClass}`} style={bgColor ? { backgroundColor: bgColor } : undefined}>
          <div className="task-name">
            {task.name}
            {task.follow_up_frequency === 'daily' && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>}
            {task.follow_up_frequency === 'weekly' && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Weekly)</span>}
            {task.follow_up_frequency === 'monthly' && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Monthly)</span>}
            {task.follow_up_frequency === 'yearly' && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#4299e1', fontWeight: '600' }}>(Yearly)</span>}
          </div>
        </td>
        <td className={`col-time sticky-col sticky-col-2 ${rowColorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
          {formatValue(task, task.task_type === TaskType.COUNT ? (task.target_value || 0) : task.allocated_minutes)}
        </td>
        <td className={`col-time sticky-col sticky-col-3 ${rowColorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
          {formatValue(task, avgSpentPerMonth)}
        </td>
        <td className={`col-time sticky-col sticky-col-4 ${rowColorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
          {formatValue(task, avgRemainingPerMonth)}
        </td>
        {months.map(m => {
          const monthValue = getYearlyTime(task.id, m.month);
          const cellColorClass = getYearlyCellColorClass(task, monthValue, m.month);
          // Only show background color if this month is >= tracking start month
          const shouldShowColor = trackingStartMonth !== null && m.month >= trackingStartMonth;
          const cellBgColor = bgColor || (shouldShowColor && monthValue > 0 && !cellColorClass ? '#e6ffed' : undefined);
          return (
            <td key={m.month} className={`col-hour ${cellColorClass}`} style={{ backgroundColor: cellBgColor, textAlign: 'center', fontSize: '12px' }}>
              {monthValue > 0 ? (task.task_type === TaskType.BOOLEAN ? '✓' : Math.round(monthValue)) : '-'}
            </td>
          );
        })}
        <td className="col-status" style={bgColor ? { backgroundColor: bgColor } : undefined}>
          {task.is_completed && (task.follow_up_frequency === 'daily' || task.follow_up_frequency === 'weekly' || task.follow_up_frequency === 'monthly') ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
              <span style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}>
                ✓ Completed via {task.follow_up_frequency === 'daily' ? 'Daily' : task.follow_up_frequency === 'weekly' ? 'Weekly' : 'Monthly'}
              </span>
            </div>
          ) : !task.is_active && (task.follow_up_frequency === 'daily' || task.follow_up_frequency === 'weekly' || task.follow_up_frequency === 'monthly') ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
              <span style={{ background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, boxShadow: '0 2px 4px rgba(156, 163, 175, 0.3)' }}>
                ⊘ NA via {task.follow_up_frequency === 'daily' ? 'Daily' : task.follow_up_frequency === 'weekly' ? 'Weekly' : 'Monthly'}
              </span>
            </div>
          ) : (
            <div className="action-buttons">
              <button className={`btn-complete ${isYearlyCompleted ? 'active' : ''}`} onClick={() => handleYearlyTaskComplete(task.id)} title="Mark as completed for this year only">
                COMPLETED
              </button>
              <button className={`btn-na ${isYearlyNA ? 'active' : ''}`} onClick={() => handleYearlyTaskNA(task.id)} title="Mark as NA for this year only">
                NA
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const renderTaskSection = (sectionTitle: string, emoji: string, sectionClass: string, tasks: Task[]) => {
    if (tasks.length === 0) return null;
    return (
      <div style={{ marginBottom: '32px' }}>
        <h3 className={`task-section-header ${sectionClass}`}>
          <span className="emoji">{emoji}</span>
          <span>{sectionTitle}</span>
          <span className="subtitle">(Auto-calculated from lower levels)</span>
        </h3>
        <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
          <table className="tasks-table daily-table">
            <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', position: 'sticky', top: 0, zIndex: 20, borderBottom: '2px solid #5a67d8' }}>
              <tr>
                <th className="col-task sticky-col sticky-col-1" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#667eea' }}>Task</th>
                <th className="col-time sticky-col sticky-col-2" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#4299e1' }}>Ideal<br/>Average/Month</th>
                <th className="col-time sticky-col sticky-col-3" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#48bb78' }} title="Calculated from first month with data">Actual Avg<br/>(Since Start)</th>
                <th className="col-time sticky-col sticky-col-4" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#ed8936' }}>Needed<br/>Average/Month</th>
                {months.map(m => <th key={m.month} className="col-hour" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>{m.name}</th>)}
                <th className="col-status" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Actions</th>
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

  if (loading && tasks.length === 0) {
    return (
      <div className="container-fluid mt-4">
        <div className="text-center">
          <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>
          <p className="mt-2">Loading yearly tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="row mb-3">
        <div className="col">
          <div className="alert alert-info">
            <i className="fas fa-info-circle me-2"></i>
            <strong>{filteredTasks.length}</strong> tasks tracked this year
            {selectedPillar && <span> in <strong>{selectedPillar}</strong></span>}
            {selectedCategory && <span> / <strong>{selectedCategory}</strong></span>}
            <div className="mt-2 small">
              <strong>📊 Read-Only Dashboard:</strong> Monthly values are auto-aggregated from Daily/Weekly/Monthly tabs. 
              To update data, enter time in the task's home tab (Daily/Weekly/Monthly based on follow-up frequency). 
              <strong>Average calculation starts from first month with data.</strong>
            </div>
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col">
          {filteredTasks.length === 0 ? (
            <div className="alert alert-warning">
              <i className="fas fa-exclamation-triangle me-2"></i>No yearly tasks found. Adjust your filters or add new yearly tasks.
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

export default YearlyTasks;
