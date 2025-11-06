/**
 * ============================================================================
 * ONE-TIME TASKS PAGE - Complete Implementation
 * ============================================================================
 * 
 * Displays and manages one-time tasks with completion tracking
 * Self-contained architecture for clarity
 * 
 * ============================================================================
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTaskContext, useTimeEntriesContext, useUserPreferencesContext } from '../contexts';
import { Task, TaskType, FollowUpFrequency } from '../types';
import { sortTasksByHierarchy } from '../utils/taskHelpers';

const OneTimeTasks: React.FC = () => {
  const { tasks, loadTasks, loadPillars, loadCategories } = useTaskContext();
  const { oneTimeEntries, loadOneTimeEntries, saveOneTimeEntry, updateOneTimeEntry } = useTimeEntriesContext();
  const {
    selectedPillar,
    selectedCategory,
    showCompleted,
    showNA,
    showInactive,
    hierarchyOrder,
    taskNameOrder,
  } = useUserPreferencesContext();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        await Promise.all([loadTasks(), loadPillars(), loadCategories(), loadOneTimeEntries()]);
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      if (task.follow_up_frequency !== FollowUpFrequency.ONE_TIME) return false;
      if (selectedPillar && task.pillar_name !== selectedPillar) return false;
      if (selectedCategory && task.category_name !== selectedCategory) return false;
      
      const entry = oneTimeEntries.find(e => e.task_id === task.id);
      const isCompleted = entry?.is_completed || task.is_completed || false;
      const isNA = !task.is_active;
      
      if (!showCompleted && isCompleted) return false;
      if (!showNA && isNA) return false;
      if (!showInactive && !task.is_active) return false;
      
      return true;
    });
    return sortTasksByHierarchy(filtered, hierarchyOrder, taskNameOrder);
  }, [tasks, oneTimeEntries, selectedPillar, selectedCategory, showCompleted, showNA, showInactive, hierarchyOrder, taskNameOrder]);

  const tasksByType = useMemo(() => {
    const groups: { time: Task[]; count: Task[]; boolean: Task[]; } = { time: [], count: [], boolean: [] };
    filteredTasks.forEach(task => {
      if (task.task_type === TaskType.TIME) groups.time.push(task);
      else if (task.task_type === TaskType.COUNT) groups.count.push(task);
      else if (task.task_type === TaskType.BOOLEAN) groups.boolean.push(task);
    });
    return groups;
  }, [filteredTasks]);

  const handleComplete = async (taskId: number) => {
    try {
      const existingEntry = oneTimeEntries.find(e => e.task_id === taskId);
      
      if (existingEntry) {
        await updateOneTimeEntry(existingEntry.id, {
          is_completed: !existingEntry.is_completed,
        });
      } else {
        await saveOneTimeEntry({
          task_id: taskId,
          is_completed: true,
        });
      }
      await loadOneTimeEntries();
    } catch (err: any) {
      console.error('Error updating completion:', err);
    }
  };

  const handleTimeChange = async (taskId: number, timeSpent: number) => {
    try {
      const existingEntry = oneTimeEntries.find(e => e.task_id === taskId);
      
      if (existingEntry) {
        await updateOneTimeEntry(existingEntry.id, { time_spent: timeSpent });
      } else {
        await saveOneTimeEntry({ task_id: taskId, time_spent: timeSpent });
      }
      await loadOneTimeEntries();
    } catch (err: any) {
      console.error('Error saving time:', err);
    }
  };

  const handleCountChange = async (taskId: number, count: number) => {
    try {
      const existingEntry = oneTimeEntries.find(e => e.task_id === taskId);
      
      if (existingEntry) {
        await updateOneTimeEntry(existingEntry.id, { count });
      } else {
        await saveOneTimeEntry({ task_id: taskId, count });
      }
      await loadOneTimeEntries();
    } catch (err: any) {
      console.error('Error saving count:', err);
    }
  };

  const handleNotesChange = async (taskId: number, notes: string) => {
    try {
      const existingEntry = oneTimeEntries.find(e => e.task_id === taskId);
      
      if (existingEntry) {
        await updateOneTimeEntry(existingEntry.id, { notes });
      } else {
        await saveOneTimeEntry({ task_id: taskId, notes });
      }
      await loadOneTimeEntries();
    } catch (err: any) {
      console.error('Error saving notes:', err);
    }
  };

  const renderTaskRow = (task: Task) => {
    const entry = oneTimeEntries.find(e => e.task_id === task.id);
    const isCompleted = entry?.is_completed || task.is_completed || false;
    const isNA = !task.is_active;
    const timeSpent = entry?.time_spent || 0;
    const count = entry?.count || 0;
    const notes = entry?.notes || '';
    
    const rowClassName = isCompleted ? 'completed-row' : isNA ? 'na-row' : '';
    const bgColor = isCompleted ? '#c6f6d5' : isNA ? '#e2e8f0' : undefined;
    
    return (
      <tr key={task.id} className={rowClassName} style={bgColor ? { backgroundColor: bgColor } : undefined}>
        <td style={bgColor ? { backgroundColor: bgColor } : undefined}>
          <div className="task-name">{task.name}</div>
        </td>
        <td style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
          {task.task_type === TaskType.TIME ? (
            <input
              type="number"
              min="0"
              className="hour-input"
              value={timeSpent || ''}
              onChange={(e) => handleTimeChange(task.id, parseInt(e.target.value) || 0)}
              placeholder="0"
              style={{ width: '80px', textAlign: 'center' }}
            />
          ) : task.task_type === TaskType.COUNT ? (
            <input
              type="number"
              min="0"
              className="hour-input"
              value={count || ''}
              onChange={(e) => handleCountChange(task.id, parseInt(e.target.value) || 0)}
              placeholder="0"
              style={{ width: '80px', textAlign: 'center' }}
            />
          ) : (
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={() => handleComplete(task.id)}
              style={{ cursor: 'pointer', transform: 'scale(1.3)' }}
            />
          )}
        </td>
        <td style={bgColor ? { backgroundColor: bgColor } : undefined}>
          <input
            type="text"
            className="form-control form-control-sm"
            value={notes}
            onChange={(e) => handleNotesChange(task.id, e.target.value)}
            placeholder="Add notes..."
            style={{ fontSize: '13px' }}
          />
        </td>
        <td style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
          <button
            className={`btn btn-sm ${isCompleted ? 'btn-success' : 'btn-outline-success'}`}
            onClick={() => handleComplete(task.id)}
            style={{ minWidth: '100px' }}
          >
            {isCompleted ? '✓ Completed' : 'Mark Complete'}
          </button>
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
        </h3>
        <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
          <table className="tasks-table daily-table">
            <thead style={{ display: 'table-header-group', visibility: 'visible', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', position: 'sticky', top: 0, zIndex: 20, borderBottom: '2px solid #5a67d8' }}>
              <tr>
                <th style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left' }}>Task</th>
                <th style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Value</th>
                <th style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left' }}>Notes</th>
                <th style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Status</th>
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
          <p className="mt-2">Loading one-time tasks...</p>
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
            <strong>{filteredTasks.length}</strong> one-time tasks
            {selectedPillar && <span> in <strong>{selectedPillar}</strong></span>}
            {selectedCategory && <span> / <strong>{selectedCategory}</strong></span>}
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col">
          {filteredTasks.length === 0 ? (
            <div className="alert alert-warning">
              <i className="fas fa-exclamation-triangle me-2"></i>No one-time tasks found. Adjust your filters or add new one-time tasks.
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

export default OneTimeTasks;
