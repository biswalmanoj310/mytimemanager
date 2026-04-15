/**
 * ============================================================================
 * QUARTERLY TASKS PAGE - Clean Implementation
 * ============================================================================
 * 
 * Quarterly task tracking showing 4-quarter aggregate view
 * Uses yearlyTaskStatuses and yearlyMonthlyAggregates from context
 * Similar architecture to YearlyTasks but shows quarters instead of months
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

const QuarterlyTasks: React.FC = () => {
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
  const [showCompletedSection, setShowCompletedSection] = useState(false);

  const yearStartDate = useMemo(() => getYearStart(selectedDate), [selectedDate]);
  const yearNumber = useMemo(() => yearStartDate.getFullYear(), [yearStartDate]);

  // Track if data has been loaded at least once
  const [dataLoaded, setDataLoaded] = useState(false);

  const quarters = useMemo(() => {
    return [
      { quarter: 1, name: 'Q1', fullName: 'Q1 (Jan-Mar)', months: [1, 2, 3] },
      { quarter: 2, name: 'Q2', fullName: 'Q2 (Apr-Jun)', months: [4, 5, 6] },
      { quarter: 3, name: 'Q3', fullName: 'Q3 (Jul-Sep)', months: [7, 8, 9] },
      { quarter: 4, name: 'Q4', fullName: 'Q4 (Oct-Nov-Dec)', months: [10, 11, 12] }
    ];
  }, []);

  const today = useMemo(() => new Date(), []);

  // Load data on mount and when year changes
  useEffect(() => {
    console.log('📊 QuarterlyTasks: Loading data for year', yearNumber);
    setDataLoaded(false);
    const loadData = async () => {
      await Promise.all([
        loadTasks(),
        loadPillars(),
        loadCategories(),
        loadYearlyTaskStatuses(yearNumber),
        loadMonthlyAggregatesForYear(yearNumber)
      ]);
      setDataLoaded(true);
      console.log('✅ QuarterlyTasks: Data loaded - tasks:', tasks.length);
    };
    loadData();
  }, [yearNumber]);

  const filteredTasks = useMemo(() => {
    console.log('🔍 QuarterlyTasks: Filtering tasks', {
      totalTasks: tasks.length,
      yearlyTaskStatusesKeys: Object.keys(yearlyTaskStatuses).length,
      yearlyTaskStatuses,
      yearlyMonthlyAggregatesKeys: Object.keys(yearlyMonthlyAggregates).length
    });
    
    let filtered = tasks.filter(task => {
      const hasBeenAddedToYearly = yearlyTaskStatuses[task.id] !== undefined;
      if (!hasBeenAddedToYearly) {
        console.log(`❌ Task ${task.id} "${task.name}" not in yearly statuses`);
        return false;
      }
      if (selectedPillar && task.pillar_name !== selectedPillar) return false;
      if (selectedCategory && task.category_name !== selectedCategory) return false;
      if (!showInactive && !task.is_active) return false;
      
      // Exclude completed and NA tasks from main table
      const yearlyStatus = yearlyTaskStatuses[task.id];
      const isCompleted = yearlyStatus?.is_completed || false;
      const isNA = yearlyStatus?.is_na || false;
      if (isCompleted || isNA) return false;
      
      console.log(`✅ Task ${task.id} "${task.name}" passed all filters`);
      return true;
    });
    return sortTasksByHierarchy(filtered, hierarchyOrder, taskNameOrder);
  }, [tasks, yearlyTaskStatuses, selectedPillar, selectedCategory, showInactive, hierarchyOrder, taskNameOrder]);

  // Completed/NA tasks for bottom section
  const completedTasks = useMemo(() => {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    let filtered = tasks.filter(task => {
      const hasBeenAddedToYearly = yearlyTaskStatuses[task.id] !== undefined;
      if (!hasBeenAddedToYearly) return false;
      if (selectedPillar && task.pillar_name !== selectedPillar) return false;
      if (selectedCategory && task.category_name !== selectedCategory) return false;
      if (!showInactive && !task.is_active) return false;
      
      const yearlyStatus = yearlyTaskStatuses[task.id];
      const isCompleted = yearlyStatus?.is_completed || false;
      const isNA = yearlyStatus?.is_na || false;
      
      if (!isCompleted && !isNA) return false;
      
      // Filter out tasks completed/NA more than a month ago
      if (yearlyStatus?.completed_at) {
        const completedDate = new Date(yearlyStatus.completed_at);
        if (completedDate < oneMonthAgo) return false;
      }
      
      return true;
    });
    return sortTasksByHierarchy(filtered, hierarchyOrder, taskNameOrder);
  }, [tasks, yearlyTaskStatuses, selectedPillar, selectedCategory, showInactive, hierarchyOrder, taskNameOrder]);

  // Split into TIME-based and COUNT-based tasks
  const timeBasedTasks = useMemo(() => {
    return filteredTasks.filter(task => task.task_type === TaskType.TIME);
  }, [filteredTasks]);

  const countBasedTasks = useMemo(() => {
    return filteredTasks.filter(task => task.task_type === TaskType.COUNT || task.task_type === TaskType.BOOLEAN);
  }, [filteredTasks]);

  // Group tasks by frequency for better organization
  const tasksByFrequency = useMemo(() => {
    return {
      daily: filteredTasks.filter(task => task.follow_up_frequency === 'daily'),
      weekly: filteredTasks.filter(task => task.follow_up_frequency === 'weekly'),
      monthly: filteredTasks.filter(task => task.follow_up_frequency === 'monthly'),
      quarterly: filteredTasks.filter(task => task.follow_up_frequency === 'quarterly')
    };
  }, [filteredTasks]);

  // Helper to get quarterly time from monthly aggregates
  const getQuarterlyTime = (taskId: number, quarter: number): number => {
    const quarterData = quarters.find(q => q.quarter === quarter);
    if (!quarterData) return 0;
    
    return quarterData.months.reduce((sum, month) => {
      const key = `${taskId}-${month}`;
      return sum + (yearlyMonthlyAggregates[key] || 0);
    }, 0);
  };

  const formatValue = (task: Task, value: number): string => {
    if (task.task_type === TaskType.TIME) return `${Math.round(value)} min`;
    else if (task.task_type === TaskType.COUNT) return `${Math.round(value)} ${task.unit}`;
    else return value > 0 ? 'Yes' : 'No';
  };

  /**
   * Get inline style for boolean success rate badge based on 70% threshold.
   * ≥70% = green, 55-69% = yellow/orange, <55% = red
   */
  const getBooleanSuccessStyle = (pct: number): React.CSSProperties => {
    if (pct >= 70) return {
      display: 'inline-block', padding: '3px 8px', borderRadius: '12px',
      background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '12px'
    };
    if (pct >= 55) return {
      display: 'inline-block', padding: '3px 8px', borderRadius: '12px',
      background: '#fef3c7', color: '#b45309', fontWeight: 700, fontSize: '12px'
    };
    return {
      display: 'inline-block', padding: '3px 8px', borderRadius: '12px',
      background: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: '12px'
    };
  };

  const getQuarterlyRowColorClass = (task: Task, totalSpent: number, trackingStartQuarter: number | null, addedDate?: string | null): string => {
    // Row color based on YEAR-TO-DATE progress from when task was ADDED to quarterly tab
    const currentYear = today.getFullYear();
    const selectedYear = yearStartDate.getFullYear();
    
    // Don't color future years
    if (selectedYear > currentYear) return '';
    
    // Calculate days elapsed from addedDate (when task was added to quarterly) or year start
    let daysElapsed = 0;
    if (selectedYear === currentYear) {
      const startOfYear = new Date(currentYear, 0, 1);
      startOfYear.setHours(0, 0, 0, 0);
      
      const addedAt = addedDate ? new Date(addedDate) : startOfYear;
      addedAt.setHours(0, 0, 0, 0);
      const effectiveStart = addedAt > startOfYear ? addedAt : startOfYear;
      
      daysElapsed = Math.floor((today.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      // Past year: calculate from addedDate or Jan 1 to Dec 31
      const startOfYear = new Date(selectedYear, 0, 1);
      startOfYear.setHours(0, 0, 0, 0);
      const addedAt = addedDate ? new Date(addedDate) : startOfYear;
      addedAt.setHours(0, 0, 0, 0);
      const effectiveStart = addedAt > startOfYear ? addedAt : startOfYear;
      
      const endOfYear = new Date(selectedYear, 11, 31);
      endOfYear.setHours(23, 59, 59, 999);
      daysElapsed = Math.floor((endOfYear.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    
    // Calculate expected based on days elapsed
    let expectedTarget = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        expectedTarget = (task.target_value || 0) * daysElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        expectedTarget = (task.target_value || 0) * (daysElapsed / 7);
      } else if (task.follow_up_frequency === 'monthly') {
        const monthsElapsed = today.getMonth() + 1;
        expectedTarget = (task.target_value || 0) * monthsElapsed;
      } else {
        expectedTarget = (task.target_value || 0) * (daysElapsed / 365);
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      if (task.follow_up_frequency === 'daily') {
        expectedTarget = daysElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        expectedTarget = daysElapsed / 7;
      } else if (task.follow_up_frequency === 'monthly') {
        expectedTarget = today.getMonth() + 1;
      } else {
        expectedTarget = daysElapsed / 365;
      }
    } else {
      // TIME task
      if (task.follow_up_frequency === 'daily') {
        expectedTarget = task.allocated_minutes * daysElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        expectedTarget = task.allocated_minutes * (daysElapsed / 7);
      } else if (task.follow_up_frequency === 'monthly') {
        expectedTarget = task.allocated_minutes * (today.getMonth() + 1);
      } else {
        expectedTarget = task.allocated_minutes * (daysElapsed / 365);
      }
    }
    
    if (totalSpent >= expectedTarget) return 'weekly-on-track';
    else if (totalSpent > 0) return 'weekly-below-target';
    return '';
  };

  const getQuarterlyCellColorClass = (task: Task, actualValue: number, quarter: number, addedDate?: string | null): string => {
    const currentYear = today.getFullYear();
    const currentQuarter = Math.ceil((today.getMonth() + 1) / 3);
    const selectedYear = yearStartDate.getFullYear();
    
    // Don't color future quarters
    if (selectedYear > currentYear) return '';
    if (selectedYear === currentYear && quarter > currentQuarter) return '';
    
    // Calculate days elapsed in this specific quarter from addedDate (when task was added) or quarter start
    let daysElapsed = 0;
    if (selectedYear === currentYear && quarter === currentQuarter) {
      // Current quarter: calculate days from quarter start OR addedDate to today
      const quarterStartMonth = (quarter - 1) * 3;
      const quarterStart = new Date(currentYear, quarterStartMonth, 1);
      quarterStart.setHours(0, 0, 0, 0);
      
      const addedAt = addedDate ? new Date(addedDate) : quarterStart;
      addedAt.setHours(0, 0, 0, 0);
      const effectiveStart = addedAt > quarterStart ? addedAt : quarterStart;
      
      daysElapsed = Math.floor((today.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      // Past quarter: calculate from addedDate or quarter start to quarter end
      const quarterStartMonth = (quarter - 1) * 3;
      const quarterStart = new Date(selectedYear, quarterStartMonth, 1);
      quarterStart.setHours(0, 0, 0, 0);
      
      const quarterEndMonth = quarterStartMonth + 2;
      const quarterEnd = new Date(selectedYear, quarterEndMonth + 1, 0); // Last day of quarter
      quarterEnd.setHours(23, 59, 59, 999);
      
      const addedAt = addedDate ? new Date(addedDate) : quarterStart;
      addedAt.setHours(0, 0, 0, 0);
      const effectiveStart = addedAt > quarterStart ? addedAt : quarterStart;
      
      // If task was added after quarter ended, no expectation
      if (effectiveStart > quarterEnd) {
        daysElapsed = 0;
      } else {
        daysElapsed = Math.floor((quarterEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    
    // Calculate expected value based on days elapsed in THIS quarter
    let expectedValue = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        expectedValue = (task.target_value || 0) * daysElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        expectedValue = (task.target_value || 0) * (daysElapsed / 7);
      } else if (task.follow_up_frequency === 'monthly') {
        // ~3 months per quarter
        expectedValue = (task.target_value || 0) * (daysElapsed / (365 / 12));
      } else {
        expectedValue = (task.target_value || 0) / 4;
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      if (task.follow_up_frequency === 'daily') {
        expectedValue = daysElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        expectedValue = daysElapsed / 7;
      } else if (task.follow_up_frequency === 'monthly') {
        expectedValue = daysElapsed / (365 / 12);
      } else {
        expectedValue = 0.25;
      }
    } else {
      // TIME task
      if (task.follow_up_frequency === 'daily') {
        expectedValue = task.allocated_minutes * daysElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        expectedValue = task.allocated_minutes * (daysElapsed / 7);
      } else if (task.follow_up_frequency === 'monthly') {
        expectedValue = task.allocated_minutes * (daysElapsed / (365 / 12));
      } else {
        expectedValue = task.allocated_minutes / 4;
      }
    }
    
    if (actualValue >= expectedValue) return 'cell-achieved';
    else if (actualValue > 0) return 'cell-below-target';
    return '';
  };

  // Summary banner data
  const quarterlySummaryData = useMemo(() => {
    const nativeTasks = tasksByFrequency.quarterly;
    const monitoringTasks = [
      ...tasksByFrequency.daily,
      ...tasksByFrequency.weekly,
      ...tasksByFrequency.monthly,
    ];
    let nativeAchieved = 0, nativeBehind = 0;
    nativeTasks.forEach(task => {
      const totalSpent = quarters.reduce((sum, q) => sum + getQuarterlyTime(task.id, q.quarter), 0);
      const cls = getQuarterlyRowColorClass(task, totalSpent, null, yearlyTaskStatuses[task.id]?.created_at);
      if (cls === 'weekly-on-track') nativeAchieved++; else nativeBehind++;
    });
    let monAchieved = 0, monBehind = 0;
    monitoringTasks.forEach(task => {
      const totalSpent = quarters.reduce((sum, q) => sum + getQuarterlyTime(task.id, q.quarter), 0);
      const cls = getQuarterlyRowColorClass(task, totalSpent, null, yearlyTaskStatuses[task.id]?.created_at);
      if (cls === 'weekly-on-track') monAchieved++; else monBehind++;
    });
    return {
      nativeTotal: nativeTasks.length, nativeAchieved, nativeBehind,
      monTotal: monitoringTasks.length, monAchieved, monBehind,
    };
  }, [tasksByFrequency, quarters, yearlyMonthlyAggregates]);

  const handleCompleteTask = async (taskId: number) => {
    try {
      setLoading(true);
      await updateYearlyTaskStatus(taskId, yearNumber, { is_completed: true, is_na: false });
      await loadYearlyTaskStatuses(yearNumber);
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to complete task');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkNA = async (taskId: number) => {
    try {
      setLoading(true);
      await updateYearlyTaskStatus(taskId, yearNumber, { is_completed: false, is_na: true });
      await loadYearlyTaskStatuses(yearNumber);
    } catch (error) {
      console.error('Error marking task as NA:', error);
      alert('Failed to mark task as NA');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreTask = async (taskId: number) => {
    try {
      setLoading(true);
      await updateYearlyTaskStatus(taskId, yearNumber, { is_completed: false, is_na: false });
      await loadYearlyTaskStatuses(yearNumber);
    } catch (error) {
      console.error('Error restoring task:', error);
      alert('Failed to restore task');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromQuarterly = async (taskId: number) => {
    if (!window.confirm('Are you sure you want to remove this task from quarterly tracking?')) {
      return;
    }
    try {
      setLoading(true);
      // Remove task from yearly status (which quarterly shares)
      await fetch(`/api/yearly-time/status/${taskId}?year=${yearNumber}`, {
        method: 'DELETE'
      });
      await loadYearlyTaskStatuses(yearNumber);
    } catch (error) {
      console.error('Error removing task:', error);
      alert('Failed to remove task from quarterly tracking');
    } finally {
      setLoading(false);
    }
  };

  const renderTaskRow = (task: Task, isCompleted: boolean = false) => {
    const totalSpent = quarters.reduce((sum, q) => sum + getQuarterlyTime(task.id, q.quarter), 0);
    
    // Determine tracking start quarter from created_at
    const yearlyStatus = yearlyTaskStatuses[task.id];
    let trackingStartQuarter: number | null = 1; // Default to Q1 if no created_at
    
    if (yearlyStatus?.created_at) {
      const createdDate = new Date(yearlyStatus.created_at);
      // Only apply tracking start if created in current year
      if (createdDate.getFullYear() === yearStartDate.getFullYear()) {
        trackingStartQuarter = Math.ceil((createdDate.getMonth() + 1) / 3);
      } else if (createdDate.getFullYear() < yearStartDate.getFullYear()) {
        // Task added in previous year, track from Q1
        trackingStartQuarter = 1;
      } else {
        // Task added in future year (shouldn't happen), track from Q1
        trackingStartQuarter = 1;
      }
    }
    
    const currentQuarter = Math.ceil((today.getMonth() + 1) / 3);
    
    // Calculate effective start date (task creation or year start)
    const effectiveStart = yearlyStatus?.created_at 
      ? new Date(Math.max(new Date(yearlyStatus.created_at).getTime(), yearStartDate.getTime()))
      : yearStartDate;
    
    // Calculate days elapsed from effective start
    const yearEnd = new Date(yearStartDate.getFullYear(), 11, 31); // Dec 31
    const endOfPeriod = today < yearEnd ? today : yearEnd;
    const daysElapsed = Math.max(1, Math.ceil((endOfPeriod.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    // Calculate days in tracking period (effective start to year end)
    const daysInTrackingPeriod = Math.ceil((yearEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Calculate DAILY ideal (for display - NOT adjusted for daysElapsed)
    let dailyIdeal = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        dailyIdeal = task.target_value || 0;
      } else if (task.follow_up_frequency === 'weekly') {
        dailyIdeal = Math.round(((task.target_value || 0) * 52) / 365);
      } else if (task.follow_up_frequency === 'monthly') {
        dailyIdeal = Math.round(((task.target_value || 0) * 12) / 365);
      } else {
        dailyIdeal = Math.round((task.target_value || 0) / 365);
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      if (task.follow_up_frequency === 'daily') {
        dailyIdeal = 1;
      } else if (task.follow_up_frequency === 'weekly') {
        dailyIdeal = Math.round(52 / 365);
      } else if (task.follow_up_frequency === 'monthly') {
        dailyIdeal = Math.round(12 / 365);
      } else {
        dailyIdeal = Math.round(1 / 365);
      }
    } else {
      if (task.follow_up_frequency === 'daily') {
        dailyIdeal = task.allocated_minutes;
      } else if (task.follow_up_frequency === 'weekly') {
        dailyIdeal = Math.round((task.allocated_minutes * 52) / 365);
      } else if (task.follow_up_frequency === 'monthly') {
        dailyIdeal = Math.round((task.allocated_minutes * 12) / 365);
      } else {
        dailyIdeal = Math.round(task.allocated_minutes / 365);
      }
    }
    
    // Calculate yearly target using daysInTrackingPeriod
    const yearlyTarget = dailyIdeal * daysInTrackingPeriod;
    
    // Avg spent per day
    const avgSpentPerDay = Math.round(totalSpent / daysElapsed);
    
    // Needed avg per day (remaining target / remaining days)
    const daysRemaining = Math.max(0, daysInTrackingPeriod - daysElapsed);
    const remainingTarget = Math.max(0, yearlyTarget - totalSpent);
    const avgRemainingPerDay = daysRemaining > 0 ? Math.round(remainingTarget / daysRemaining) : 0;

    const rowColorClass = getQuarterlyRowColorClass(task, totalSpent, trackingStartQuarter, yearlyStatus?.created_at);

    // Task type indicator
    let taskTypeIndicator = '';
    if (task.follow_up_frequency === 'daily') taskTypeIndicator = '(Daily)';
    else if (task.follow_up_frequency === 'weekly') taskTypeIndicator = '(Weekly)';
    else if (task.follow_up_frequency === 'monthly') taskTypeIndicator = '(Monthly)';

    const taskIsCompleted = yearlyStatus?.is_completed || false;
    const taskIsNA = yearlyStatus?.is_na || false;

    return (
      <tr key={task.id} className={rowColorClass}>
        <td className="col-task sticky-col sticky-col-1" style={{ minWidth: '250px' }}>
          <div style={{ fontWeight: 500, color: '#2d3748' }}>{task.name} <span style={{ color: '#718096', fontSize: '0.85em' }}>{taskTypeIndicator}</span></div>
          <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>{task.pillar_name} → {task.category_name}</div>
        </td>
        <td className={`col-time sticky-col sticky-col-2 ${rowColorClass}`} style={{ textAlign: 'center', minWidth: '100px' }}>
          {task.task_type === TaskType.BOOLEAN ? (
            <span style={{ fontSize: '12px', color: '#4a5568' }}>
              1/day<br/><span style={{ fontSize: '10px', color: '#718096' }}>Goal: ≥70%</span>
            </span>
          ) : formatValue(task, dailyIdeal)}
        </td>
        <td className={`col-time sticky-col sticky-col-3 ${rowColorClass}`} style={{ textAlign: 'center', minWidth: '100px' }}>
          {task.task_type === TaskType.BOOLEAN ? (() => {
            const pct = Math.round((totalSpent / Math.max(1, daysElapsed)) * 100);
            const icon = pct >= 75 ? '✅' : pct >= 60 ? '⚠️' : '🔴';
            return (
              <span style={getBooleanSuccessStyle(pct)} title={pct >= 70 ? 'Achieved ≥70% goal' : pct >= 55 ? 'At risk' : 'Needs recovery'}>
                {totalSpent}/{daysElapsed}d {icon}<br/>{pct}%
              </span>
            );
          })() : formatValue(task, avgSpentPerDay)}
        </td>
        <td className={`col-time sticky-col sticky-col-4 ${rowColorClass}`} style={{ textAlign: 'center', minWidth: '100px' }}>
          {task.task_type === TaskType.BOOLEAN ? (() => {
            const targetSuccesses = Math.ceil(daysInTrackingPeriod * 0.70);
            const needed = Math.max(0, targetSuccesses - totalSpent);
            if (needed === 0) return <span style={{ color: '#15803d', fontSize: '12px', fontWeight: 600 }}>✅ Goal met</span>;
            return <span style={{ color: '#b91c1c', fontSize: '12px' }}>Need {needed} more</span>;
          })() : formatValue(task, avgRemainingPerDay)}
        </td>
        {quarters.map(q => {
          const quarterValue = getQuarterlyTime(task.id, q.quarter);
          const cellColorClass = getQuarterlyCellColorClass(task, quarterValue, q.quarter, yearlyStatus?.created_at);
          // Only show background color if this quarter is >= tracking start quarter
          const shouldShowColor = trackingStartQuarter !== null && q.quarter >= trackingStartQuarter;
          const bgColor = shouldShowColor && quarterValue > 0 && !cellColorClass ? '#e6ffed' : undefined;
          return (
            <td key={q.quarter} className={`col-hour ${cellColorClass} ${rowColorClass}`} style={{ backgroundColor: bgColor, textAlign: 'center', fontSize: '12px', minWidth: '80px' }}>
              {quarterValue > 0 ? (task.task_type === TaskType.BOOLEAN ? '✓' : Math.round(quarterValue)) : '-'}
            </td>
          );
        })}
        <td className="col-status" style={{ minWidth: '200px', textAlign: 'center' }}>
          {!isCompleted ? (
            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {(task.follow_up_frequency === 'quarterly' || task.follow_up_frequency === 'yearly') && (
                <button 
                  className="btn btn-sm" 
                  style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#4299e1', color: 'white', border: 'none', borderRadius: '4px' }}
                  onClick={() => {/* Edit handler will be added */}}
                  title="Edit Task"
                >
                  <i className="fas fa-edit"></i> Edit
                </button>
              )}
              <button 
                className="btn btn-sm" 
                style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#48bb78', color: 'white', border: 'none', borderRadius: '4px' }}
                onClick={() => handleCompleteTask(task.id)}
                disabled={loading}
                title="Mark as Completed"
              >
                <i className="fas fa-check"></i> Complete
              </button>
              <button 
                className="btn btn-sm" 
                style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#ed8936', color: 'white', border: 'none', borderRadius: '4px' }}
                onClick={() => handleMarkNA(task.id)}
                disabled={loading}
                title="Mark as Not Applicable"
              >
                <i className="fas fa-times"></i> NA
              </button>
              <button 
                className="btn btn-sm" 
                style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px' }}
                onClick={() => handleRemoveFromQuarterly(task.id)}
                disabled={loading}
                title="Remove from Quarterly"
              >
                <i className="fas fa-trash"></i> Delete
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: taskIsCompleted ? '#48bb78' : '#ed8936', fontWeight: 600 }}>
                {taskIsCompleted ? '✓ Completed' : '⊗ NA'}
              </span>
              <button 
                className="btn btn-sm" 
                style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#4299e1', color: 'white', border: 'none', borderRadius: '4px' }}
                onClick={() => handleRestoreTask(task.id)}
                disabled={loading}
                title="Restore Task"
              >
                <i className="fas fa-undo"></i> Restore
              </button>
              <button 
                className="btn btn-sm" 
                style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px' }}
                onClick={() => handleRemoveFromQuarterly(task.id)}
                disabled={loading}
                title="Remove from Quarterly"
              >
                <i className="fas fa-trash"></i> Remove
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div>
      {!dataLoaded ? (
        <div className="alert alert-info" style={{ textAlign: 'center', padding: '30px', margin: '20px 0' }}>
          <i className="fas fa-spinner fa-spin me-2"></i>
          Loading quarterly data...
        </div>
      ) : (
        <>
          {filteredTasks.length === 0 ? (
            <div className="alert alert-warning" style={{ textAlign: 'center', padding: '30px', margin: '20px 0' }}>
              <i className="fas fa-exclamation-triangle me-2"></i>
              No quarterly tasks found. Use "Add Quarterly Task" button to track tasks in quarterly view.
            </div>
          ) : (
        <>
          {/* Quarterly Summary Banner */}
          {(quarterlySummaryData.nativeTotal > 0 || quarterlySummaryData.monTotal > 0) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
              marginBottom: '12px', flexWrap: 'wrap',
              background: quarterlySummaryData.nativeBehind > 0 || quarterlySummaryData.monBehind > 0 ? '#fff5f5' : '#f0fdf4',
              border: `1.5px solid ${quarterlySummaryData.nativeBehind > 0 || quarterlySummaryData.monBehind > 0 ? '#fca5a5' : '#86efac'}`,
              borderRadius: '8px', fontSize: '14px', fontWeight: 500
            }}>
              <span>{quarterlySummaryData.nativeBehind > 0 || quarterlySummaryData.monBehind > 0 ? '⚠️' : '✅'}</span>
              {quarterlySummaryData.nativeTotal > 0 && (<>
                <span style={{ color: '#374151' }}>Total Quarterly Tasks: <strong>{quarterlySummaryData.nativeTotal}</strong></span>
                <span style={{ color: '#9ca3af' }}>|</span>
                <span style={{ color: '#16a34a' }}>Achieved: <strong>{quarterlySummaryData.nativeAchieved}</strong></span>
                <span style={{ color: '#9ca3af' }}>|</span>
                <span style={{ color: quarterlySummaryData.nativeBehind > 0 ? '#dc2626' : '#16a34a' }}>Not reached Target: <strong>{quarterlySummaryData.nativeBehind}</strong></span>
              </>)}
              {quarterlySummaryData.nativeTotal > 0 && quarterlySummaryData.monTotal > 0 && (
                <span style={{ color: '#d1d5db', margin: '0 4px' }}>｜</span>
              )}
              {quarterlySummaryData.monTotal > 0 && (<>
                <span style={{ color: '#374151' }}>Total Daily Tasks (on Quarterly): <strong>{quarterlySummaryData.monTotal}</strong></span>
                <span style={{ color: '#9ca3af' }}>|</span>
                <span style={{ color: '#16a34a' }}>Achieved: <strong>{quarterlySummaryData.monAchieved}</strong></span>
                <span style={{ color: '#9ca3af' }}>|</span>
                <span style={{ color: quarterlySummaryData.monBehind > 0 ? '#dc2626' : '#16a34a' }}>Not Achieved: <strong>{quarterlySummaryData.monBehind}</strong></span>
              </>)}
            </div>
          )}

          {/* DAILY TASKS */}
          {tasksByFrequency.daily.filter(t => t.task_type === TaskType.TIME).length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header time-based">
                <span className="emoji">⏰</span>
                <span>Time-Based Tasks (Daily)</span>
              </h3>
                  <div className="tasks-table-container">
                    <table className="tasks-table daily-table">
                      <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)', position: 'sticky', top: 0, zIndex: 20 }}>
                        <tr>
                          <th className="col-task sticky-col sticky-col-1" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#dbeafe', minWidth: '250px' }}>Task</th>
                          <th className="col-time sticky-col sticky-col-2" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bfdbfe', minWidth: '100px' }}>Ideal<br/>Avg/Day</th>
                          <th className="col-time sticky-col sticky-col-3" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bbf7d0', minWidth: '100px' }}>Actual Avg<br/>(Since Start)</th>
                          <th className="col-time sticky-col sticky-col-4" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fed7aa', minWidth: '100px' }}>Needed<br/>Avg/Day</th>
                          {quarters.map(q => <th key={q.quarter} className="col-hour" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '80px' }}>{q.name}</th>)}
                          <th className="col-status" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '200px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasksByFrequency.daily.filter(t => t.task_type === TaskType.TIME).map(task => renderTaskRow(task, false))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          {tasksByFrequency.daily.filter(t => t.task_type === TaskType.COUNT || t.task_type === TaskType.BOOLEAN).length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header count-based">
                <span className="emoji">🔢</span>
                <span>Count-Based Tasks (Daily)</span>
              </h3>
                  <div className="tasks-table-container">
                    <table className="tasks-table daily-table">
                      <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)', position: 'sticky', top: 0, zIndex: 20 }}>
                        <tr>
                          <th className="col-task sticky-col sticky-col-1" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#dbeafe', minWidth: '250px' }}>Task</th>
                          <th className="col-time sticky-col sticky-col-2" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bfdbfe', minWidth: '100px' }}>Ideal<br/>Avg/Day</th>
                          <th className="col-time sticky-col sticky-col-3" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bbf7d0', minWidth: '100px' }}>Actual Avg<br/>(Since Start)</th>
                          <th className="col-time sticky-col sticky-col-4" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fed7aa', minWidth: '100px' }}>Needed<br/>Avg/Day</th>
                          {quarters.map(q => <th key={q.quarter} className="col-hour" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '80px' }}>{q.name}</th>)}
                          <th className="col-status" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '200px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasksByFrequency.daily.filter(t => t.task_type === TaskType.COUNT || t.task_type === TaskType.BOOLEAN).map(task => renderTaskRow(task, false))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

          {/* WEEKLY TASKS */}
          {tasksByFrequency.weekly.filter(t => t.task_type === TaskType.TIME).length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header time-based">
                <span className="emoji">⏰</span>
                <span>Time-Based Tasks (Weekly)</span>
              </h3>
                  <div className="tasks-table-container">
                    <table className="tasks-table daily-table">
                      <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)', position: 'sticky', top: 0, zIndex: 20 }}>
                        <tr>
                          <th className="col-task sticky-col sticky-col-1" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#dbeafe', minWidth: '250px' }}>Task</th>
                          <th className="col-time sticky-col sticky-col-2" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bfdbfe', minWidth: '100px' }}>Ideal<br/>Avg/Day</th>
                          <th className="col-time sticky-col sticky-col-3" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bbf7d0', minWidth: '100px' }}>Actual Avg<br/>(Since Start)</th>
                          <th className="col-time sticky-col sticky-col-4" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fed7aa', minWidth: '100px' }}>Needed<br/>Avg/Day</th>
                          {quarters.map(q => <th key={q.quarter} className="col-hour" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '80px' }}>{q.name}</th>)}
                          <th className="col-status" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '200px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasksByFrequency.weekly.filter(t => t.task_type === TaskType.TIME).map(task => renderTaskRow(task, false))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          {tasksByFrequency.weekly.filter(t => t.task_type === TaskType.COUNT || t.task_type === TaskType.BOOLEAN).length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header count-based">
                <span className="emoji">🔢</span>
                <span>Count-Based Tasks (Weekly)</span>
              </h3>
                  <div className="tasks-table-container">
                    <table className="tasks-table daily-table">
                      <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)', position: 'sticky', top: 0, zIndex: 20 }}>
                        <tr>
                          <th className="col-task sticky-col sticky-col-1" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#dbeafe', minWidth: '250px' }}>Task</th>
                          <th className="col-time sticky-col sticky-col-2" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bfdbfe', minWidth: '100px' }}>Ideal<br/>Avg/Day</th>
                          <th className="col-time sticky-col sticky-col-3" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bbf7d0', minWidth: '100px' }}>Actual Avg<br/>(Since Start)</th>
                          <th className="col-time sticky-col sticky-col-4" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fed7aa', minWidth: '100px' }}>Needed<br/>Avg/Day</th>
                          {quarters.map(q => <th key={q.quarter} className="col-hour" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '80px' }}>{q.name}</th>)}
                          <th className="col-status" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '200px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasksByFrequency.weekly.filter(t => t.task_type === TaskType.COUNT || t.task_type === TaskType.BOOLEAN).map(task => renderTaskRow(task, false))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

          {/* MONTHLY TASKS */}
          {tasksByFrequency.monthly.filter(t => t.task_type === TaskType.TIME).length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header time-based">
                <span className="emoji">⏰</span>
                <span>Time-Based Tasks (Monthly)</span>
              </h3>
                  <div className="tasks-table-container">
                    <table className="tasks-table daily-table">
                      <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)', position: 'sticky', top: 0, zIndex: 20 }}>
                        <tr>
                          <th className="col-task sticky-col sticky-col-1" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#dbeafe', minWidth: '250px' }}>Task</th>
                          <th className="col-time sticky-col sticky-col-2" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bfdbfe', minWidth: '100px' }}>Ideal<br/>Avg/Day</th>
                          <th className="col-time sticky-col sticky-col-3" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bbf7d0', minWidth: '100px' }}>Actual Avg<br/>(Since Start)</th>
                          <th className="col-time sticky-col sticky-col-4" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fed7aa', minWidth: '100px' }}>Needed<br/>Avg/Day</th>
                          {quarters.map(q => <th key={q.quarter} className="col-hour" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '80px' }}>{q.name}</th>)}
                          <th className="col-status" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '200px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasksByFrequency.monthly.filter(t => t.task_type === TaskType.TIME).map(task => renderTaskRow(task, false))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          {tasksByFrequency.monthly.filter(t => t.task_type === TaskType.COUNT || t.task_type === TaskType.BOOLEAN).length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header count-based">
                <span className="emoji">🔢</span>
                <span>Count-Based Tasks (Monthly)</span>
              </h3>
                  <div className="tasks-table-container">
                    <table className="tasks-table daily-table">
                      <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)', position: 'sticky', top: 0, zIndex: 20 }}>
                        <tr>
                          <th className="col-task sticky-col sticky-col-1" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#dbeafe', minWidth: '250px' }}>Task</th>
                          <th className="col-time sticky-col sticky-col-2" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bfdbfe', minWidth: '100px' }}>Ideal<br/>Avg/Day</th>
                          <th className="col-time sticky-col sticky-col-3" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bbf7d0', minWidth: '100px' }}>Actual Avg<br/>(Since Start)</th>
                          <th className="col-time sticky-col sticky-col-4" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fed7aa', minWidth: '100px' }}>Needed<br/>Avg/Day</th>
                          {quarters.map(q => <th key={q.quarter} className="col-hour" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '80px' }}>{q.name}</th>)}
                          <th className="col-status" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '200px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasksByFrequency.monthly.filter(t => t.task_type === TaskType.COUNT || t.task_type === TaskType.BOOLEAN).map(task => renderTaskRow(task, false))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

          {/* QUARTERLY TASKS */}
          {tasksByFrequency.quarterly.filter(t => t.task_type === TaskType.TIME).length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header time-based">
                <span className="emoji">⏰</span>
                <span>Time-Based Tasks (Quarterly)</span>
              </h3>
                  <div className="tasks-table-container">
                    <table className="tasks-table daily-table">
                      <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)', position: 'sticky', top: 0, zIndex: 20 }}>
                        <tr>
                          <th className="col-task sticky-col sticky-col-1" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#dbeafe', minWidth: '250px' }}>Task</th>
                          <th className="col-time sticky-col sticky-col-2" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bfdbfe', minWidth: '100px' }}>Ideal<br/>Avg/Day</th>
                          <th className="col-time sticky-col sticky-col-3" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bbf7d0', minWidth: '100px' }}>Actual Avg<br/>(Since Start)</th>
                          <th className="col-time sticky-col sticky-col-4" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fed7aa', minWidth: '100px' }}>Needed<br/>Avg/Day</th>
                          {quarters.map(q => <th key={q.quarter} className="col-hour" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '80px' }}>{q.name}</th>)}
                          <th className="col-status" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '200px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasksByFrequency.quarterly.filter(t => t.task_type === TaskType.TIME).map(task => renderTaskRow(task, false))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          {tasksByFrequency.quarterly.filter(t => t.task_type === TaskType.COUNT || t.task_type === TaskType.BOOLEAN).length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header count-based">
                <span className="emoji">🔢</span>
                <span>Count-Based Tasks (Quarterly)</span>
              </h3>
                  <div className="tasks-table-container">
                    <table className="tasks-table daily-table">
                      <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)', position: 'sticky', top: 0, zIndex: 20 }}>
                        <tr>
                          <th className="col-task sticky-col sticky-col-1" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#dbeafe', minWidth: '250px' }}>Task</th>
                          <th className="col-time sticky-col sticky-col-2" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bfdbfe', minWidth: '100px' }}>Ideal<br/>Avg/Day</th>
                          <th className="col-time sticky-col sticky-col-3" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#bbf7d0', minWidth: '100px' }}>Actual Avg<br/>(Since Start)</th>
                          <th className="col-time sticky-col sticky-col-4" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#fed7aa', minWidth: '100px' }}>Needed<br/>Avg/Day</th>
                          {quarters.map(q => <th key={q.quarter} className="col-hour" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '80px' }}>{q.name}</th>)}
                          <th className="col-status" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '200px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasksByFrequency.quarterly.filter(t => t.task_type === TaskType.COUNT || t.task_type === TaskType.BOOLEAN).map(task => renderTaskRow(task, false))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
        </>
      )}

          {/* Completed/NA Tasks Section */}
          {completedTasks.length > 0 && (
            <div style={{ marginTop: '40px' }}>
              <div 
                onClick={() => setShowCompletedSection(!showCompletedSection)}
                style={{ 
                  color: '#2d3748', 
                  fontSize: '18px', 
                  fontWeight: 600, 
                  marginBottom: '15px',
                  padding: '12px',
                  backgroundColor: '#f7fafc',
                  borderLeft: '4px solid #718096',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#edf2f7'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f7fafc'}
              >
                <span>
                  ✓ Completed / NA Tasks ({completedTasks.length})
                </span>
                <i className={`fas fa-chevron-${showCompletedSection ? 'up' : 'down'}`} style={{ color: '#718096' }}></i>
              </div>
              
              {showCompletedSection && (
                <>
                  <div className="tasks-table-container">
                    <table className="tasks-table daily-table">
                      <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #718096 0%, #4a5568 100%)', position: 'sticky', top: 0, zIndex: 20 }}>
                        <tr>
                          <th className="col-task sticky-col sticky-col-1" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#718096', minWidth: '250px' }}>Task</th>
                          <th className="col-time sticky-col sticky-col-2" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#718096', minWidth: '100px' }}>Ideal<br/>Avg/Day</th>
                          <th className="col-time sticky-col sticky-col-3" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#718096', minWidth: '100px' }}>Actual Avg<br/>(Since Start)</th>
                          <th className="col-time sticky-col sticky-col-4" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#718096', minWidth: '100px' }}>Needed<br/>Avg/Day</th>
                          {quarters.map(q => <th key={q.quarter} className="col-hour" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '80px' }}>{q.name}</th>)}
                          <th className="col-status" style={{ color: '#1e40af', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', minWidth: '200px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completedTasks.map(task => renderTaskRow(task, true))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QuarterlyTasks;
