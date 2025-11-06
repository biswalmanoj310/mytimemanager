/**
 * Time Entry Grid Component
 * 
 * Reusable grid component for displaying and editing time entries.
 * Used by Daily, Weekly, Monthly, and Yearly tabs.
 * 
 * Features:
 * - Time/count input fields
 * - Completion marking
 * - N/A marking
 * - Notes management
 * - Responsive grid layout
 */

import React, { useState } from 'react';
import { Task, TaskType } from '../types';

export interface TimeEntryData {
  taskId: number;
  timeSpent?: number;
  count?: number;
  notes?: string;
  isCompleted: boolean;
  isNA: boolean;
}

interface TimeEntryGridProps {
  /** Tasks to display in grid */
  tasks: Task[];
  
  /** Existing time entries mapped by task ID */
  entries: Map<number, TimeEntryData>;
  
  /** Callback when entry changes */
  onEntryChange: (taskId: number, entry: Partial<TimeEntryData>) => void;
  
  /** Callback when task is completed */
  onComplete: (taskId: number) => void;
  
  /** Callback when task is marked N/A */
  onMarkNA: (taskId: number) => void;
  
  /** Read-only mode (for viewing past periods) */
  readOnly?: boolean;
  
  /** Show notes column */
  showNotes?: boolean;
  
  /** Optional CSS classes */
  className?: string;
}

/**
 * Time Entry Grid Component
 * Displays tasks in a grid with time/count entry fields
 */
const TimeEntryGrid: React.FC<TimeEntryGridProps> = ({
  tasks,
  entries,
  onEntryChange,
  onComplete,
  onMarkNA,
  readOnly = false,
  showNotes = true,
  className = '',
}) => {
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

  /**
   * Get entry data for a task
   */
  const getEntry = (taskId: number): TimeEntryData => {
    return entries.get(taskId) || {
      taskId,
      timeSpent: undefined,
      count: undefined,
      notes: '',
      isCompleted: false,
      isNA: false,
    };
  };

  /**
   * Handle time input change
   */
  const handleTimeChange = (taskId: number, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    if (numValue !== undefined && (isNaN(numValue) || numValue < 0)) return;
    
    onEntryChange(taskId, { timeSpent: numValue });
  };

  /**
   * Handle count input change
   */
  const handleCountChange = (taskId: number, value: string) => {
    const numValue = value === '' ? undefined : parseInt(value, 10);
    if (numValue !== undefined && (isNaN(numValue) || numValue < 0)) return;
    
    onEntryChange(taskId, { count: numValue });
  };

  /**
   * Handle notes change
   */
  const handleNotesChange = (taskId: number, value: string) => {
    onEntryChange(taskId, { notes: value });
  };

  /**
   * Toggle notes expansion
   */
  const toggleNotes = (taskId: number) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  /**
   * Get input placeholder based on task type
   */
  const getInputPlaceholder = (task: Task): string => {
    if (task.task_type === TaskType.TIME) {
      return 'Minutes';
    } else if (task.task_type === TaskType.COUNT) {
      return task.unit || 'Count';
    }
    return '';
  };

  /**
   * Render input field based on task type
   */
  const renderInputField = (task: Task, entry: TimeEntryData) => {
    if (task.task_type === TaskType.BOOLEAN) {
      // Boolean tasks only have complete/NA buttons
      return (
        <div className="boolean-task-actions">
          <span className="text-muted">
            <i className="fas fa-check-circle me-1"></i>
            Complete or Mark N/A
          </span>
        </div>
      );
    }

    const isTimeTask = task.task_type === TaskType.TIME;
    const value = isTimeTask ? entry.timeSpent : entry.count;

    return (
      <div className="input-group input-group-sm">
        <input
          type="number"
          min="0"
          step={isTimeTask ? '1' : '1'}
          value={value ?? ''}
          onChange={(e) =>
            isTimeTask
              ? handleTimeChange(task.id, e.target.value)
              : handleCountChange(task.id, e.target.value)
          }
          className="form-control"
          placeholder={getInputPlaceholder(task)}
          disabled={readOnly || entry.isCompleted || entry.isNA}
        />
        {task.task_type === TaskType.COUNT && task.unit && (
          <span className="input-group-text">{task.unit}</span>
        )}
      </div>
    );
  };

  if (tasks.length === 0) {
    return (
      <div className={`time-entry-grid empty ${className}`}>
        <div className="empty-state">
          <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
          <p className="text-muted">No tasks to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`time-entry-grid ${className}`}>
      <div className="table-responsive">
        <table className="table table-hover table-sm">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Task</th>
              <th style={{ width: '15%' }}>Type</th>
              <th style={{ width: '20%' }}>Entry</th>
              {showNotes && <th style={{ width: '20%' }}>Notes</th>}
              <th style={{ width: '15%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const entry = getEntry(task.id);
              const isNotesExpanded = expandedNotes.has(task.id);

              return (
                <tr
                  key={task.id}
                  className={`
                    ${entry.isCompleted ? 'table-success' : ''}
                    ${entry.isNA ? 'table-secondary' : ''}
                  `}
                >
                  {/* Task Name */}
                  <td>
                    <div className="task-info">
                      <div className="task-name">{task.name}</div>
                      {task.description && (
                        <small className="text-muted">{task.description}</small>
                      )}
                    </div>
                  </td>

                  {/* Task Type */}
                  <td>
                    <span className="badge bg-info">
                      {task.task_type === TaskType.TIME && 'Time'}
                      {task.task_type === TaskType.COUNT && 'Count'}
                      {task.task_type === TaskType.BOOLEAN && 'Yes/No'}
                    </span>
                  </td>

                  {/* Entry Input */}
                  <td>{renderInputField(task, entry)}</td>

                  {/* Notes */}
                  {showNotes && (
                    <td>
                      {isNotesExpanded ? (
                        <textarea
                          value={entry.notes || ''}
                          onChange={(e) => handleNotesChange(task.id, e.target.value)}
                          className="form-control form-control-sm"
                          rows={2}
                          placeholder="Add notes..."
                          disabled={readOnly}
                        />
                      ) : (
                        <button
                          onClick={() => toggleNotes(task.id)}
                          className="btn btn-sm btn-outline-secondary"
                          disabled={readOnly}
                        >
                          <i className="fas fa-sticky-note me-1"></i>
                          {entry.notes ? 'Edit' : 'Add'} Notes
                        </button>
                      )}
                    </td>
                  )}

                  {/* Actions */}
                  <td>
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        onClick={() => onComplete(task.id)}
                        className={`btn ${
                          entry.isCompleted ? 'btn-success' : 'btn-outline-success'
                        }`}
                        title="Mark as completed"
                        disabled={readOnly || entry.isNA}
                      >
                        <i className="fas fa-check"></i>
                      </button>
                      <button
                        onClick={() => onMarkNA(task.id)}
                        className={`btn ${
                          entry.isNA ? 'btn-secondary' : 'btn-outline-secondary'
                        }`}
                        title="Mark as N/A"
                        disabled={readOnly || entry.isCompleted}
                      >
                        <i className="fas fa-ban"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TimeEntryGrid;
