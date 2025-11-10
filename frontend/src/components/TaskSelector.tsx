/**
 * Reusable Task Selector Component with Frequency Filtering
 * 
 * Supports filtering by:
 * - Frequency (All/Daily/Weekly/Monthly)
 * - Pillar/Category (optional, when used with PillarCategorySelector)
 * 
 * Use cases:
 * - Habit monitoring (link habit to existing task)
 * - Goal task linking (associate tasks with life goals)
 * - Challenge tracking (track challenge through task completion)
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Task {
  id: number;
  name: string;
  pillar_id?: number;
  category_id?: number;
  sub_category_id?: number;
  pillar_name?: string;
  category_name?: string;
  sub_category_name?: string;
  follow_up_frequency?: string; // 'today', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'one_time'
  task_type?: string; // 'time', 'count', 'boolean'
  allocated_minutes?: number;
  target_value?: number;
  unit?: string;
}

type FrequencyFilter = 'all' | 'daily' | 'weekly' | 'monthly';

interface TaskSelectorProps {
  // Selected value
  selectedTaskId?: number | null;
  onTaskChange?: (taskId: number | null, task?: Task) => void;
  
  // Filtering
  defaultFrequency?: FrequencyFilter;
  filterByPillar?: number | null;
  filterByCategory?: number | null;
  showFrequencyFilter?: boolean; // Default true
  
  // Configuration
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  
  // Styling
  labelStyle?: React.CSSProperties;
  selectStyle?: React.CSSProperties;
  showTaskDetails?: boolean; // Show task type, duration, etc. below dropdown
}

export const TaskSelector: React.FC<TaskSelectorProps> = ({
  selectedTaskId,
  onTaskChange,
  defaultFrequency = 'daily',
  filterByPillar,
  filterByCategory,
  showFrequencyFilter = true,
  required = false,
  disabled = false,
  placeholder = '-- Select Task --',
  labelStyle = {},
  selectStyle = {},
  showTaskDetails = false
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>(defaultFrequency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, []);

  // Filter tasks when filters change
  useEffect(() => {
    filterTasks();
  }, [tasks, frequencyFilter, filterByPillar, filterByCategory]);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const tasksData: any = await api.get('/api/tasks/');
      console.log('✅ Tasks loaded:', tasksData);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (err: any) {
      console.error('❌ Error loading tasks:', err);
      setError('Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    if (!Array.isArray(tasks)) {
      setFilteredTasks([]);
      return;
    }

    let filtered = [...tasks];

    // Filter by frequency
    if (frequencyFilter !== 'all') {
      filtered = filtered.filter(t => 
        t.follow_up_frequency?.toLowerCase() === frequencyFilter.toLowerCase()
      );
    }

    // Filter by pillar
    if (filterByPillar) {
      filtered = filtered.filter(t => t.pillar_id === filterByPillar);
    }

    // Filter by category
    if (filterByCategory) {
      filtered = filtered.filter(t => t.category_id === filterByCategory);
    }

    setFilteredTasks(filtered);
  };

  const handleTaskChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const taskId = e.target.value ? parseInt(e.target.value) : null;
    const task = tasks.find(t => t.id === taskId);
    onTaskChange?.(taskId, task);
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const defaultLabelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '4px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    ...labelStyle
  };

  const defaultSelectStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: disabled ? '#f5f5f5' : 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...selectStyle
  };

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '6px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: active ? '#007bff' : 'white',
    color: active ? 'white' : '#333',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: active ? '600' : '400',
    transition: 'all 0.2s'
  });

  if (loading) {
    return <div style={{ padding: '10px', color: '#666' }}>Loading tasks...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '10px', color: '#e53e3e', fontSize: '14px' }}>
        {error}
        <button 
          onClick={loadTasks} 
          style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '12px' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Frequency Filter Buttons */}
      {showFrequencyFilter && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ ...defaultLabelStyle, marginBottom: '6px' }}>
            Filter by Frequency
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setFrequencyFilter('all')}
              style={buttonStyle(frequencyFilter === 'all')}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFrequencyFilter('daily')}
              style={buttonStyle(frequencyFilter === 'daily')}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setFrequencyFilter('weekly')}
              style={buttonStyle(frequencyFilter === 'weekly')}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setFrequencyFilter('monthly')}
              style={buttonStyle(frequencyFilter === 'monthly')}
            >
              Monthly
            </button>
          </div>
        </div>
      )}

      {/* Task Selection Dropdown */}
      <div>
        <label style={defaultLabelStyle}>
          Select Task {required && <span style={{ color: '#e53e3e' }}>*</span>}
        </label>
        <select
          value={selectedTaskId || ''}
          onChange={handleTaskChange}
          disabled={disabled}
          required={required}
          style={defaultSelectStyle}
        >
          <option value="">{placeholder}</option>
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => (
              <option key={task.id} value={task.id}>
                {task.name}
                {task.pillar_name && ` • ${task.pillar_name}`}
                {task.category_name && ` / ${task.category_name}`}
              </option>
            ))
          ) : (
            <option value="" disabled>No matching tasks</option>
          )}
        </select>
      </div>

      {/* Task Details (Optional) */}
      {showTaskDetails && selectedTask && (
        <div style={{ 
          marginTop: '8px', 
          padding: '8px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <div><strong>Type:</strong> {selectedTask.task_type}</div>
          {selectedTask.allocated_minutes && (
            <div><strong>Duration:</strong> {selectedTask.allocated_minutes} minutes</div>
          )}
          {selectedTask.target_value && (
            <div><strong>Target:</strong> {selectedTask.target_value} {selectedTask.unit}</div>
          )}
          <div><strong>Frequency:</strong> {selectedTask.follow_up_frequency}</div>
          {selectedTask.pillar_name && (
            <div><strong>Pillar:</strong> {selectedTask.pillar_name}</div>
          )}
          {selectedTask.category_name && (
            <div><strong>Category:</strong> {selectedTask.category_name}</div>
          )}
        </div>
      )}
    </div>
  );
};
