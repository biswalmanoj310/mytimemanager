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
        loadYearlyTaskStatuses(yearNumber),
        loadMonthlyAggregatesForYear(yearNumber)
      ]);
      setDataLoaded(true);
      console.log('✅ QuarterlyTasks: Data loaded');
    };
    loadData();
  }, [yearNumber, tasks.length]);

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
      const yearlyStatus = yearlyTaskStatuses[task.id];
      const isCompleted = yearlyStatus?.is_completed || false;
      const isNA = yearlyStatus?.is_na || false;
      if (!showCompleted && isCompleted) return false;
      if (!showNA && isNA) return false;
      if (!showInactive && !task.is_active) return false;
      console.log(`✅ Task ${task.id} "${task.name}" passed all filters`);
      return true;
    });
    return sortTasksByHierarchy(filtered, hierarchyOrder, taskNameOrder);
  }, [tasks, yearlyTaskStatuses, selectedPillar, selectedCategory, showCompleted, showNA, showInactive, hierarchyOrder, taskNameOrder]);

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

  const getQuarterlyRowColorClass = (task: Task, totalSpent: number, firstDataQuarter: number): string => {
    const currentQuarter = Math.ceil((today.getMonth() + 1) / 3);
    
    // Calculate yearly target based on task type
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

    // Calculate quarters elapsed from first data entry
    let quartersElapsed = 1;
    if (today.getFullYear() === yearStartDate.getFullYear()) {
      quartersElapsed = Math.max(1, currentQuarter - firstDataQuarter + 1);
    } else if (today.getFullYear() > yearStartDate.getFullYear()) {
      quartersElapsed = Math.max(1, 4 - firstDataQuarter + 1);
    }

    // Expected should be proportional to quarters elapsed
    const expectedTarget = (yearlyTarget / 4) * quartersElapsed;

    if (totalSpent >= expectedTarget) {
      return 'weekly-on-track';
    } else if (totalSpent > 0) {
      return 'weekly-below-target';
    }
    return '';
  };

  const renderTaskRow = (task: Task) => {
    const totalSpent = quarters.reduce((sum, q) => sum + getQuarterlyTime(task.id, q.quarter), 0);
    
    // Find first quarter with data
    const firstQuarterWithData = quarters.find(q => getQuarterlyTime(task.id, q.quarter) > 0);
    const firstDataQuarter = firstQuarterWithData ? firstQuarterWithData.quarter : 1;
    
    const currentQuarter = Math.ceil((today.getMonth() + 1) / 3);
    
    // Calculate quarters elapsed from first data entry
    let quartersElapsed = 1;
    if (today.getFullYear() === yearStartDate.getFullYear()) {
      quartersElapsed = Math.max(1, currentQuarter - firstDataQuarter + 1);
    } else if (today.getFullYear() > yearStartDate.getFullYear()) {
      quartersElapsed = Math.max(1, 4 - firstDataQuarter + 1);
    }

    const avgSpentPerQuarter = Math.round(totalSpent / quartersElapsed);
    
    // Calculate yearly target
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

    const idealAvgPerQuarter = Math.round(yearlyTarget / 4);
    const quartersRemaining = 4 - currentQuarter;
    const neededPerQuarter = quartersRemaining > 0 ? Math.max(0, Math.round((yearlyTarget - totalSpent) / quartersRemaining)) : 0;

    const rowColorClass = getQuarterlyRowColorClass(task, totalSpent, firstDataQuarter);

    // Task type indicator
    let taskTypeIndicator = '';
    if (task.follow_up_frequency === 'daily') taskTypeIndicator = '(Daily)';
    else if (task.follow_up_frequency === 'weekly') taskTypeIndicator = '(Weekly)';
    else if (task.follow_up_frequency === 'monthly') taskTypeIndicator = '(Monthly)';

    return (
      <tr key={task.id} className={rowColorClass}>
        <td className="col-task sticky-col sticky-col-1">
          <div style={{ fontWeight: 500, color: '#2d3748' }}>{task.name} <span style={{ color: '#718096', fontSize: '0.85em' }}>{taskTypeIndicator}</span></div>
          <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>{task.pillar_name} → {task.category_name}</div>
        </td>
        <td className={`col-time sticky-col sticky-col-2 ${rowColorClass}`} style={{ textAlign: 'center' }}>
          {formatValue(task, idealAvgPerQuarter)}
        </td>
        <td className={`col-time sticky-col sticky-col-3 ${rowColorClass}`} style={{ textAlign: 'center' }}>
          {formatValue(task, avgSpentPerQuarter)}
        </td>
        <td className={`col-time sticky-col sticky-col-4 ${rowColorClass}`} style={{ textAlign: 'center' }}>
          {formatValue(task, neededPerQuarter)}
        </td>
        {quarters.map(q => {
          const quarterValue = getQuarterlyTime(task.id, q.quarter);
          return (
            <td key={q.quarter} className="col-hour" style={{ backgroundColor: quarterValue > 0 ? '#e6ffed' : undefined, textAlign: 'center', fontSize: '12px' }}>
              {quarterValue > 0 ? (task.task_type === TaskType.BOOLEAN ? '✓' : Math.round(quarterValue)) : '-'}
            </td>
          );
        })}
        <td className="col-status">
          {/* Actions can be added here if needed */}
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
          <div className="alert alert-info" style={{ margin: '10px 0', padding: '12px', borderRadius: '8px', backgroundColor: '#ebf8ff', border: '1px solid #bee3f8' }}>
            <strong>📊 Read-Only Dashboard:</strong> Quarterly values are auto-aggregated from Daily/Weekly/Monthly tabs.
            To update data, enter time in the task's home tab (based on follow-up frequency). Each quarter shows the sum of 3 months.
            <strong> Average calculation starts from first quarter with data.</strong>
          </div>

          <div style={{ margin: '15px 0', padding: '10px', backgroundColor: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <strong>{filteredTasks.length}</strong> tasks tracked this year
          </div>

          {filteredTasks.length === 0 ? (
            <div className="alert alert-warning" style={{ textAlign: 'center', padding: '30px', margin: '20px 0' }}>
              <i className="fas fa-exclamation-triangle me-2"></i>
              No quarterly tasks found. Use "Add Quarterly Task" button to track tasks in quarterly view.
            </div>
          ) : (
        <div className="tasks-table-container">
          <table className="tasks-table daily-table">
            <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', position: 'sticky', top: 0, zIndex: 20 }}>
              <tr>
                <th className="col-task sticky-col sticky-col-1" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#667eea' }}>Task</th>
                <th className="col-time sticky-col sticky-col-2" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#4299e1' }}>Ideal<br/>Average/Quarter</th>
                <th className="col-time sticky-col sticky-col-3" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#48bb78' }}>Actual Avg<br/>(Since Start)</th>
                <th className="col-time sticky-col sticky-col-4" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#ed8936' }}>Needed<br/>Average/Quarter</th>
                {quarters.map(q => <th key={q.quarter} className="col-hour" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>{q.name}</th>)}
                <th className="col-status" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => renderTaskRow(task))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default QuarterlyTasks;
