/**
 * ============================================================================
 * MONTHLY TASKS PAGE - Complete Implementation with Full Styling
 * ============================================================================
 * 
 * Production-ready monthly task tracking with full styling and color logic
 * Self-contained architecture with inline helpers for clarity
 * 
 * ============================================================================
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTaskContext, useTimeEntriesContext, useUserPreferencesContext } from '../contexts';
import { Task, TaskType } from '../types';
import { 
  getMonthStart, 
  formatDateForInput,
} from '../utils/dateHelpers';
import {
  sortTasksByHierarchy,
} from '../utils/taskHelpers';

const MonthlyTasks: React.FC = () => {
  const { tasks, loadTasks, loadPillars, loadCategories } = useTaskContext();
  const { 
    monthlyTaskStatuses,
    loadMonthlyTaskStatuses,
    updateMonthlyTaskStatus,
    dailyAggregatesMonthly,
    loadDailyAggregatesForMonth,
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
  const [showCompletedSection, setShowCompletedSection] = useState(false);

  const monthStartDate = useMemo(() => getMonthStart(selectedDate), [selectedDate]);
  const monthStartString = formatDateForInput(monthStartDate);

  const daysInMonth = useMemo(() => {
    return new Date(monthStartDate.getFullYear(), monthStartDate.getMonth() + 1, 0).getDate();
  }, [monthStartDate]);

  const monthDays = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = new Date(monthStartDate.getFullYear(), monthStartDate.getMonth(), day);
      return { day, date, dateString: formatDateForInput(date) };
    });
  }, [monthStartDate, daysInMonth]);

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
    const loadMonthData = async () => {
      try {
        await loadMonthlyTaskStatuses(monthStartString);
        await loadDailyAggregatesForMonth(monthStartString);
      } catch (err) {
        console.error('Error loading month data:', err);
      }
    };
    loadMonthData();
  }, [monthStartString, loadMonthlyTaskStatuses, loadDailyAggregatesForMonth]);

  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      const hasBeenAddedToMonthly = monthlyTaskStatuses[task.id] !== undefined;
      if (!hasBeenAddedToMonthly) return false;
      if (selectedPillar && task.pillar_name !== selectedPillar) return false;
      if (selectedCategory && task.category_name !== selectedCategory) return false;
      if (!showInactive && !task.is_active) return false;
      
      const monthlyStatus = monthlyTaskStatuses[task.id];
      const isCompleted = monthlyStatus?.is_completed || false;
      const isNA = monthlyStatus?.is_na || false;
      
      // Exclude completed/NA tasks from main sections
      if (isCompleted || isNA) return false;
      
      return true;
    });
    return sortTasksByHierarchy(filtered, hierarchyOrder, taskNameOrder);
  }, [tasks, monthlyTaskStatuses, selectedPillar, selectedCategory, showInactive, hierarchyOrder, taskNameOrder]);

  // Completed/NA tasks for bottom section
  const completedTasks = useMemo(() => {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    let filtered = tasks.filter(task => {
      const hasBeenAddedToMonthly = monthlyTaskStatuses[task.id] !== undefined;
      if (!hasBeenAddedToMonthly) return false;
      if (selectedPillar && task.pillar_name !== selectedPillar) return false;
      if (selectedCategory && task.category_name !== selectedCategory) return false;
      if (!showInactive && !task.is_active) return false;
      
      const monthlyStatus = monthlyTaskStatuses[task.id];
      const isCompleted = monthlyStatus?.is_completed || false;
      const isNA = monthlyStatus?.is_na || false;
      
      if (!isCompleted && !isNA) return false;
      
      // Filter out tasks completed/NA more than a month ago
      if (monthlyStatus?.completed_at) {
        const completedDate = new Date(monthlyStatus.completed_at);
        if (completedDate < oneMonthAgo) return false;
      }
      
      return true;
    });
    return sortTasksByHierarchy(filtered, hierarchyOrder, taskNameOrder);
  }, [tasks, monthlyTaskStatuses, selectedPillar, selectedCategory, showInactive, hierarchyOrder, taskNameOrder]);

  const tasksByType = useMemo(() => {
    const groups: { 
      timeDaily: Task[]; countDaily: Task[]; booleanDaily: Task[];
      timeWeekly: Task[]; countWeekly: Task[]; booleanWeekly: Task[];
      timeMonthly: Task[]; countMonthly: Task[]; booleanMonthly: Task[];
    } = { 
      timeDaily: [], countDaily: [], booleanDaily: [],
      timeWeekly: [], countWeekly: [], booleanWeekly: [],
      timeMonthly: [], countMonthly: [], booleanMonthly: []
    };
    filteredTasks.forEach(task => {
      const freq = task.follow_up_frequency;
      if (task.task_type === TaskType.TIME) {
        if (freq === 'daily') groups.timeDaily.push(task);
        else if (freq === 'weekly') groups.timeWeekly.push(task);
        else if (freq === 'monthly') groups.timeMonthly.push(task);
      } else if (task.task_type === TaskType.COUNT) {
        if (freq === 'daily') groups.countDaily.push(task);
        else if (freq === 'weekly') groups.countWeekly.push(task);
        else if (freq === 'monthly') groups.countMonthly.push(task);
      } else if (task.task_type === TaskType.BOOLEAN) {
        if (freq === 'daily') groups.booleanDaily.push(task);
        else if (freq === 'weekly') groups.booleanWeekly.push(task);
        else if (freq === 'monthly') groups.booleanMonthly.push(task);
      }
    });
    return groups;
  }, [filteredTasks]);

  const completedTasksByType = useMemo(() => {
    const groups: { time: Task[]; count: Task[]; boolean: Task[]; } = { time: [], count: [], boolean: [] };
    completedTasks.forEach(task => {
      if (task.task_type === TaskType.TIME) groups.time.push(task);
      else if (task.task_type === TaskType.COUNT) groups.count.push(task);
      else if (task.task_type === TaskType.BOOLEAN) groups.boolean.push(task);
    });
    return groups;
  }, [completedTasks]);

  const getMonthlyTime = (taskId: number, dayOfMonth: number): number => {
    const key = `${taskId}-${dayOfMonth}`;
    return dailyAggregatesMonthly[key] || 0;
  };

  const getMonthlyRowColorClass = (task: Task, totalSpent: number): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(monthStartDate);
    monthStart.setHours(0, 0, 0, 0);
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
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        expectedTarget = (task.target_value || 0) * daysElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        // For weekly tasks: expected progress = (weekly_target / 7) * days_elapsed
        expectedTarget = (task.target_value || 0) * (daysElapsed / 7);
      } else {
        expectedTarget = (task.target_value || 0) * (daysElapsed / daysInMonth);
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      if (task.follow_up_frequency === 'daily') {
        expectedTarget = daysElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        // For weekly tasks: expected progress = (1 / 7) * days_elapsed
        expectedTarget = daysElapsed / 7;
      } else {
        expectedTarget = daysElapsed / daysInMonth;
      }
    } else {
      if (task.follow_up_frequency === 'daily') {
        expectedTarget = task.allocated_minutes * daysElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        // For weekly tasks: expected progress = (weekly_target / 7) * days_elapsed
        // This gives proportional expectation even in partial weeks
        expectedTarget = task.allocated_minutes * (daysElapsed / 7);
      } else {
        expectedTarget = task.allocated_minutes * (daysElapsed / daysInMonth);
      }
    }
    if (totalSpent >= expectedTarget) {
      return 'weekly-on-track'; // Green - meeting or exceeding target
    } else {
      // Below target (includes zero progress) - show red to indicate behind schedule
      return 'weekly-below-target'; // Red - below target or no progress
    }
  };

  const getMonthlyCellColorClass = (task: Task, actualValue: number, dayDate: Date): string => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (dayDate > today) return '';
    let expectedValue = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        expectedValue = (task.target_value || 0);
      } else if (task.follow_up_frequency === 'weekly') {
        expectedValue = (task.target_value || 0) / 7;
      } else {
        expectedValue = (task.target_value || 0) / daysInMonth;
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      if (task.follow_up_frequency === 'daily') {
        expectedValue = 1;
      } else if (task.follow_up_frequency === 'weekly') {
        expectedValue = 1 / 7;
      } else {
        expectedValue = 1 / daysInMonth;
      }
    } else {
      if (task.follow_up_frequency === 'daily') {
        expectedValue = task.allocated_minutes;
      } else if (task.follow_up_frequency === 'weekly') {
        expectedValue = task.allocated_minutes / 7;
      } else {
        expectedValue = task.allocated_minutes / daysInMonth;
      }
    }
    if (actualValue >= expectedValue) return 'cell-achieved';
    else if (expectedValue > 0) return 'cell-below-target';
    return '';
  };

  const handleMonthlyTaskComplete = async (taskId: number) => {
    try {
      await updateMonthlyTaskStatus(taskId, monthStartString, { is_completed: true, is_na: false });
      await loadMonthlyTaskStatuses(monthStartString);
    } catch (err: any) {
      console.error('Error marking task complete:', err);
    }
  };

  const handleMonthlyTaskNA = async (taskId: number) => {
    try {
      await updateMonthlyTaskStatus(taskId, monthStartString, { is_completed: false, is_na: true });
      await loadMonthlyTaskStatuses(monthStartString);
    } catch (err: any) {
      console.error('Error marking task NA:', err);
    }
  };

  const handleRestoreMonthlyTask = async (taskId: number) => {
    try {
      await updateMonthlyTaskStatus(taskId, monthStartString, { is_completed: false, is_na: false });
      await loadMonthlyTaskStatuses(monthStartString);
    } catch (err: any) {
      console.error('Error restoring task:', err);
    }
  };



  const formatValue = (task: Task, value: number): string => {
    if (task.task_type === TaskType.TIME) return `${value >= 10 ? Math.round(value) : value.toFixed(1)} min`;
    else if (task.task_type === TaskType.COUNT) return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${task.unit}`;
    else return value > 0 ? 'Yes' : 'No';
  };

  const renderTaskRow = (task: Task) => {
    const totalSpent = monthDays.reduce((sum, day) => sum + getMonthlyTime(task.id, day.day), 0);
    const monthlyTarget = task.task_type === TaskType.COUNT ? (task.target_value || 0) * daysInMonth : task.allocated_minutes * daysInMonth;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(monthStartDate);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    monthEnd.setHours(0, 0, 0, 0);
    
    // Use the later of month start or task creation date as the effective start
    const taskCreatedAt = new Date(task.created_at);
    taskCreatedAt.setHours(0, 0, 0, 0);
    const effectiveStart = taskCreatedAt > monthStart ? taskCreatedAt : monthStart;
    
    let daysElapsed = 1;
    if (today >= effectiveStart) {
      if (today <= monthEnd) {
        const diffTime = today.getTime() - effectiveStart.getTime();
        daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      } else {
        // Past month - count from effective start to month end
        const diffTime = monthEnd.getTime() - effectiveStart.getTime();
        daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    let daysRemaining = 0;
    if (today >= effectiveStart && today <= monthEnd) {
      const diffTime = monthEnd.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    const avgSpentPerDay = totalSpent / daysElapsed;
    const remaining = monthlyTarget - totalSpent;
    const avgRemainingPerDay = daysRemaining > 0 ? remaining / daysRemaining : 0;
    const rowColorClass = getMonthlyRowColorClass(task, totalSpent);
    const monthlyStatus = monthlyTaskStatuses[task.id];
    const isMonthlyCompleted = monthlyStatus?.is_completed || false;
    const isMonthlyNA = monthlyStatus?.is_na || false;
    const rowClassName = isMonthlyCompleted ? 'completed-row' : isMonthlyNA ? 'na-row' : '';
    const bgColor = isMonthlyCompleted ? '#c6f6d5' : isMonthlyNA ? '#e2e8f0' : undefined;
    
    return (
      <tr key={task.id} className={rowClassName} style={bgColor ? { backgroundColor: bgColor } : undefined}>
        <td className={`col-task sticky-col sticky-col-1 ${rowColorClass}`} style={{ ...(bgColor ? { backgroundColor: bgColor } : {}), color: '#1a202c' }}>
          <div className="task-name" style={{ color: '#1a202c' }}>
            {task.name}
            {task.follow_up_frequency === 'daily' && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>}
            {task.follow_up_frequency === 'weekly' && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#38a169', fontWeight: '600' }}>(Weekly)</span>}
            {task.follow_up_frequency === 'monthly' && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#4299e1', fontWeight: '600' }}>(Monthly)</span>}
          </div>
        </td>
        <td className={`col-time sticky-col sticky-col-2 ${rowColorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
          {formatValue(task, task.task_type === TaskType.COUNT ? (task.target_value || 0) : task.allocated_minutes)}
        </td>
        <td className={`col-time sticky-col sticky-col-3 ${rowColorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
          {formatValue(task, avgSpentPerDay)}
        </td>
        <td className={`col-time sticky-col sticky-col-4 ${rowColorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
          {formatValue(task, avgRemainingPerDay)}
        </td>
        {monthDays.map(day => {
          const dayValue = getMonthlyTime(task.id, day.day);
          const cellColorClass = getMonthlyCellColorClass(task, dayValue, day.date);
          return (
            <td key={day.day} className={`col-hour ${cellColorClass}`} style={{ backgroundColor: bgColor || (dayValue > 0 && !cellColorClass ? '#e6ffed' : undefined), textAlign: 'center', fontSize: '12px' }}>
              {dayValue > 0 ? (task.task_type === TaskType.BOOLEAN ? '✓' : dayValue) : '-'}
            </td>
          );
        })}
        <td className="col-status" style={bgColor ? { backgroundColor: bgColor } : undefined}>
          {task.is_completed && task.follow_up_frequency === 'daily' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
              <span style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}>
                ✓ Completed via Daily
              </span>
            </div>
          ) : !task.is_active && task.follow_up_frequency === 'daily' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
              <span style={{ background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, boxShadow: '0 2px 4px rgba(156, 163, 175, 0.3)' }}>
                ⊘ NA via Daily
              </span>
            </div>
          ) : isMonthlyCompleted || isMonthlyNA ? (
            <div className="action-buttons">
              <button style={{ background: '#4299e1', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }} onClick={() => handleRestoreMonthlyTask(task.id)} title="Restore this task to active state">
                <i className="fas fa-undo"></i> RESTORE
              </button>
            </div>
          ) : (
            <div className="action-buttons">
              <button className={`btn-complete ${isMonthlyCompleted ? 'active' : ''}`} onClick={() => handleMonthlyTaskComplete(task.id)} title="Mark as completed for this month only">
                COMPLETED
              </button>
              <button className={`btn-na ${isMonthlyNA ? 'active' : ''}`} onClick={() => handleMonthlyTaskNA(task.id)} title="Mark as NA for this month only">
                NA
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  // Render function for completed tasks
  const renderCompletedTaskRow = (task: Task) => {
    const totalSpent = monthDays.reduce((sum, day) => sum + getMonthlyTime(task.id, day.day), 0);
    const monthlyTarget = task.task_type === TaskType.COUNT ? (task.target_value || 0) * daysInMonth : task.allocated_minutes * daysInMonth;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(monthStartDate);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    monthEnd.setHours(0, 0, 0, 0);
    
    // Use the later of month start or task creation date as the effective start
    const taskCreatedAt = new Date(task.created_at);
    taskCreatedAt.setHours(0, 0, 0, 0);
    const effectiveStart = taskCreatedAt > monthStart ? taskCreatedAt : monthStart;
    
    let daysElapsed = 1;
    if (today >= effectiveStart) {
      if (today <= monthEnd) {
        const diffTime = today.getTime() - effectiveStart.getTime();
        daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      } else {
        // Past month - count from effective start to month end
        const diffTime = monthEnd.getTime() - effectiveStart.getTime();
        daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    let daysRemaining = 0;
    if (today >= effectiveStart && today <= monthEnd) {
      const diffTime = monthEnd.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    const avgSpentPerDay = totalSpent / daysElapsed;
    const remaining = monthlyTarget - totalSpent;
    const avgRemainingPerDay = daysRemaining > 0 ? remaining / daysRemaining : 0;
    const monthlyStatus = monthlyTaskStatuses[task.id];
    const isMonthlyCompleted = monthlyStatus?.is_completed || false;
    const isMonthlyNA = monthlyStatus?.is_na || false;
    
    const bgColor = isMonthlyCompleted ? '#e6ffed' : isMonthlyNA ? '#f3f4f6' : undefined;
    const rowColorClass = isMonthlyCompleted ? 'row-completed' : isMonthlyNA ? 'row-na' : '';
    
    return (
      <tr key={task.id} className={rowColorClass} style={bgColor ? { backgroundColor: bgColor } : undefined}>
        <td className={`col-task sticky-col sticky-col-1 ${rowColorClass}`} style={bgColor ? { backgroundColor: bgColor } : undefined}>
          <div className="task-name">
            {task.name}
            {task.follow_up_frequency === 'daily' && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>}
            {task.follow_up_frequency === 'weekly' && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#38a169', fontWeight: '600' }}>(Weekly)</span>}
            {task.follow_up_frequency === 'monthly' && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#4299e1', fontWeight: '600' }}>(Monthly)</span>}
          </div>
        </td>
        <td className={`col-time sticky-col sticky-col-2 ${rowColorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
          {formatValue(task, task.task_type === TaskType.COUNT ? (task.target_value || 0) : task.allocated_minutes)}
        </td>
        <td className={`col-time sticky-col sticky-col-3 ${rowColorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
          {formatValue(task, avgSpentPerDay)}
        </td>
        <td className={`col-time sticky-col sticky-col-4 ${rowColorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
          {formatValue(task, avgRemainingPerDay)}
        </td>
        {monthDays.map(day => {
          const dayValue = getMonthlyTime(task.id, day.day);
          const cellColorClass = getMonthlyCellColorClass(task, dayValue, day.date);
          return (
            <td key={day.day} className={`col-hour ${cellColorClass}`} style={{ backgroundColor: bgColor || (dayValue > 0 && !cellColorClass ? '#e6ffed' : undefined), textAlign: 'center', fontSize: '12px' }}>
              {dayValue > 0 ? (task.task_type === TaskType.BOOLEAN ? '✓' : dayValue) : '-'}
            </td>
          );
        })}
        <td className="col-status" style={bgColor ? { backgroundColor: bgColor } : undefined}>
          <div className="action-buttons">
            <button style={{ background: '#4299e1', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }} onClick={() => handleRestoreMonthlyTask(task.id)} title="Restore this task to active state">
              <i className="fas fa-undo"></i> RESTORE
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderCompletedSection = (sectionTitle: string, emoji: string, tasks: Task[]) => {
    if (tasks.length === 0) return null;
    return (
      <div style={{ marginBottom: '32px' }}>
        <h3 className="task-section-header">
          <span className="emoji">{emoji}</span>
          <span>{sectionTitle}</span>
        </h3>
        <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
          <table className="tasks-table daily-table">
            <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', position: 'sticky', top: 0, zIndex: 20, borderBottom: '2px solid #5a67d8' }}>
              <tr>
                <th className="col-task sticky-col sticky-col-1" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#fef3c7' }}>Task</th>
                <th className="col-time sticky-col sticky-col-2" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fef3c7' }}>Ideal<br/>Average/Day</th>
                <th className="col-time sticky-col sticky-col-3" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fef3c7' }}>Actual<br/>Average/Day</th>
                <th className="col-time sticky-col sticky-col-4" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fef3c7' }}>Needed<br/>Average/Day</th>
                {monthDays.map(day => <th key={day.day} className="col-hour" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>{day.day}</th>)}
                <th className="col-status" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => renderCompletedTaskRow(task))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTaskSection = (sectionTitle: string, emoji: string, sectionClass: string, tasks: Task[], subtitle?: string) => {
    if (tasks.length === 0) return null;
    return (
      <div style={{ marginBottom: '32px' }}>
        <h3 className={`task-section-header ${sectionClass}`}>
          <span className="emoji">{emoji}</span>
          <span>{sectionTitle}</span>
          {subtitle && <span className="subtitle">{subtitle}</span>}
        </h3>
        <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
          <table className="tasks-table daily-table">
            <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', position: 'sticky', top: 0, zIndex: 20, borderBottom: '2px solid #5a67d8' }}>
              <tr>
                <th className="col-task sticky-col sticky-col-1" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#fef3c7' }}>Task</th>
                <th className="col-time sticky-col sticky-col-2" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fef3c7' }}>Ideal<br/>Average/Day</th>
                <th className="col-time sticky-col sticky-col-3" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fef3c7' }}>Actual<br/>Average/Day</th>
                <th className="col-time sticky-col sticky-col-4" style={{ color: '#1a202c', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fef3c7' }}>Needed<br/>Average/Day</th>
                {monthDays.map(day => <th key={day.day} className="col-hour" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>{day.day}</th>)}
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
          <p className="mt-2">Loading monthly tasks...</p>
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
            <strong>{filteredTasks.length}</strong> tasks tracked this month
            {selectedPillar && <span> in <strong>{selectedPillar}</strong></span>}
            {selectedCategory && <span> / <strong>{selectedCategory}</strong></span>}
            <div className="mt-2 small"><em>Note: Tasks shown here have been explicitly added to monthly tracking. Daily tasks display aggregated data from daily entries.</em></div>
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col">
          {filteredTasks.length === 0 ? (
            <div className="alert alert-warning">
              <i className="fas fa-exclamation-triangle me-2"></i>No monthly tasks found. Adjust your filters or add new monthly tasks.
            </div>
          ) : (
            <>
              {renderTaskSection('Time-Based Tasks (Daily)', '⏱️', 'time-based', tasksByType.timeDaily, '(Auto-calculated from Daily)')}
              {renderTaskSection('Count-Based Tasks (Daily)', '🔢', 'count-based', tasksByType.countDaily, '(Auto-calculated from Daily)')}
              {renderTaskSection('Yes/No Tasks (Daily)', '✅', 'boolean-based', tasksByType.booleanDaily, '(Auto-calculated from Daily)')}
              
              {renderTaskSection('Time-Based Tasks (Weekly)', '⏱️', 'time-based', tasksByType.timeWeekly, '(Weekly tasks - aggregated over month)')}
              {renderTaskSection('Count-Based Tasks (Weekly)', '🔢', 'count-based', tasksByType.countWeekly, '(Weekly tasks - aggregated over month)')}
              {renderTaskSection('Yes/No Tasks (Weekly)', '✅', 'boolean-based', tasksByType.booleanWeekly, '(Weekly tasks - aggregated over month)')}
              
              {renderTaskSection('Time-Based Tasks (Monthly)', '⏱️', 'time-based', tasksByType.timeMonthly, '(Monthly tasks)')}
              {renderTaskSection('Count-Based Tasks (Monthly)', '🔢', 'count-based', tasksByType.countMonthly, '(Monthly tasks)')}
              {renderTaskSection('Yes/No Tasks (Monthly)', '✅', 'boolean-based', tasksByType.booleanMonthly, '(Monthly tasks)')}
            </>
          )}

          {/* Completed Tasks Section */}
          {completedTasks.length > 0 && (
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
                  ✅ Completed Tasks ({completedTasks.length})
                </h3>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                  Auto-hide after 1 month
                </span>
              </div>
              
              {showCompletedSection && (
                <>
                  {renderCompletedSection('Time-Based Tasks', '⏱️', completedTasksByType.time)}
                  {renderCompletedSection('Count-Based Tasks', '🔢', completedTasksByType.count)}
                  {renderCompletedSection('Yes/No Tasks', '✅', completedTasksByType.boolean)}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MonthlyTasks;
