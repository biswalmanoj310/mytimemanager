/**
 * Tasks Page
 * Display and manage all tasks with tabs and table view
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './Tasks.css';
import TaskForm from '../components/TaskForm';
import { Task } from '../types';

type TabType = 'today' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('today');
  // Hourly time entries for daily tab - key format: "taskId-hour"
  const [hourlyEntries, setHourlyEntries] = useState<Record<string, number>>({});
  // Selected date for daily tab
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // Incomplete days list
  const [incompleteDays, setIncompleteDays] = useState<any[]>([]);
  // Save timeout for debouncing
  const [saveTimeout, setSaveTimeout] = useState<number | null>(null);

  useEffect(() => {
    loadTasks();
    loadIncompleteDays();
  }, []);

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyEntries(selectedDate);
    }
  }, [activeTab, selectedDate]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading tasks from API...');
      const data = await api.get<Task[]>('/api/tasks/');
      console.log('Tasks loaded:', data);
      setTasks(data);
    } catch (err: any) {
      console.error('Error loading tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskComplete = async (taskId: number) => {
    try {
      await api.post(`/api/tasks/${taskId}/complete`, {});
      // Reload tasks to get updated data
      loadTasks();
    } catch (err: any) {
      console.error('Error updating task:', err);
      console.error('Error response:', err.response);
      alert('Failed to update task status: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleTaskNA = async (taskId: number) => {
    try {
      // Mark as inactive for NA status
      await api.put(`/api/tasks/${taskId}`, { is_active: false });
      // Reload tasks to get updated data
      loadTasks();
    } catch (err: any) {
      console.error('Error updating task:', err);
      console.error('Error response:', err.response);
      alert('Failed to update task status: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setIsTaskFormOpen(true);
  };

  const handleFormClose = () => {
    setIsTaskFormOpen(false);
    setSelectedTaskId(null);
  };

  // Load daily time entries from backend for selected date
  const loadDailyEntries = async (date: Date) => {
    try {
      const dateStr = date.toISOString().split('T')[0];
      console.log('Loading daily entries for date:', dateStr);
      const entries = await api.get<any[]>(`/api/daily-time/entries/${dateStr}`);
      console.log('Loaded entries:', entries);
      
      // Convert entries array to hourlyEntries map format
      const entriesMap: Record<string, number> = {};
      entries.forEach((entry: any) => {
        const key = `${entry.task_id}-${entry.hour}`;
        entriesMap[key] = entry.minutes;
      });
      
      console.log('Setting hourlyEntries:', entriesMap);
      setHourlyEntries(entriesMap);
    } catch (err) {
      console.error('Error loading daily entries:', err);
    }
  };

  // Load list of incomplete days
  const loadIncompleteDays = async () => {
    try {
      const days = await api.get<any[]>('/api/daily-time/incomplete-days/');
      setIncompleteDays(days);
    } catch (err) {
      console.error('Error loading incomplete days:', err);
    }
  };

  // Save daily entries to backend (debounced)
  const saveDailyEntries = async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      console.log('Saving daily entries for date:', dateStr);
      console.log('Current hourlyEntries:', hourlyEntries);
      
      // Convert hourlyEntries map to array format
      const entries = Object.entries(hourlyEntries)
        .filter(([_, minutes]) => minutes > 0)
        .map(([key, minutes]) => {
          const [task_id, hour] = key.split('-').map(Number);
          return { task_id, hour, minutes };
        });

      console.log('Entries to save:', entries);
      if (entries.length > 0) {
        const response = await api.post('/api/daily-time/entries/bulk/', {
          entry_date: dateStr,
          entries: entries
        });
        console.log('Save response:', response);
        
        // Reload incomplete days after save
        loadIncompleteDays();
      } else {
        console.log('No entries to save (all zero or empty)');
      }
    } catch (err) {
      console.error('Error saving daily entries:', err);
    }
  };

  // Change selected date
  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // Open day in new tab
  const openDayInNewTab = (dateStr: string) => {
    const url = `${window.location.origin}${window.location.pathname}?tab=daily&date=${dateStr}`;
    window.open(url, '_blank');
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Generate 24 hour labels (two-line format)
  const generateHourLabels = () => {
    const hours = [];
    // Start from 5 AM (index 5) through 11 PM (index 23)
    for (let i = 5; i < 24; i++) {
      const startHour = i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`;
      const endHour = i === 23 ? '12 AM' : i + 1 < 12 ? `${i + 1} AM` : i + 1 === 12 ? '12 PM' : `${i + 1 - 12} PM`;
      hours.push({
        index: i,
        label: `${startHour}\n${endHour}` // Split into two lines with newline
      });
    }
    // Then add 12 AM (index 0) through 4 AM (index 4) at the end
    for (let i = 0; i < 5; i++) {
      const startHour = i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`;
      const endHour = i === 23 ? '12 AM' : i + 1 < 12 ? `${i + 1} AM` : i + 1 === 12 ? '12 PM' : `${i + 1 - 12} PM`;
      hours.push({
        index: i,
        label: `${startHour}\n${endHour}` // Split into two lines with newline
      });
    }
    return hours;
  };

  const hourLabels = generateHourLabels();

  // Handle hourly time entry change with auto-save
  const handleHourlyTimeChange = (taskId: number, hour: number, value: string) => {
    const minutes = parseInt(value) || 0;
    const key = `${taskId}-${hour}`;
    setHourlyEntries(prev => ({
      ...prev,
      [key]: minutes
    }));
    
    // Debounced auto-save - wait 1 second after last input
    if (saveTimeout) {
      window.clearTimeout(saveTimeout);
    }
    
    const timeout = window.setTimeout(() => {
      saveDailyEntries();
    }, 1000);
    
    setSaveTimeout(timeout);
  };

  // Get hourly time entry for a task and hour
  const getHourlyTime = (taskId: number, hour: number): number => {
    const key = `${taskId}-${hour}`;
    return hourlyEntries[key] || 0;
  };

  // Hierarchy order for sorting

  if (loading) {
    return (
      <div className="tasks-loading">
        <div className="spinner"></div>
        <p>Loading tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tasks-error">
        <p>{error}</p>
        <button onClick={loadTasks} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  // Define hierarchy order for sorting
  const hierarchyOrder: { [key: string]: number } = {
    // Hard Work
    'Hard Work|Office-Tasks': 1,
    'Hard Work|Office Tasks': 1,
    'Hard Work|Learning': 2,
    // Calmness
    'Calmness|Confidence': 3,
    'Calmness|Yoga': 4,
    'Calmness|Sleep+Yoga': 4,
    'Calmness|Sleep': 5,
    // Family
    'Family|My Tasks': 6,
    'Family|Home Tasks': 7,
    'Family|Family Tasks': 7,
    'Family|Time Waste': 8,
  };

  // Filter tasks by active tab
  // Also filter out completed/NA tasks that are older than today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const filteredTasks = tasks
    .filter(task => {
      if (task.follow_up_frequency !== activeTab) return false;
      
      // If task is completed, only show if completed today
      if (task.is_completed && task.completed_at) {
        const completedDate = new Date(task.completed_at);
        completedDate.setHours(0, 0, 0, 0);
        return completedDate.getTime() === today.getTime();
      }
      
      // If task is marked as NA (inactive), only show if marked today
      if (!task.is_active && task.na_marked_at) {
        const naMarkedDate = new Date(task.na_marked_at);
        naMarkedDate.setHours(0, 0, 0, 0);
        return naMarkedDate.getTime() === today.getTime();
      }
      
      return true;
    })
    .sort((a, b) => {
      // Get hierarchy order for each task
      const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
      const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
      const orderA = hierarchyOrder[keyA] || 999;
      const orderB = hierarchyOrder[keyB] || 999;
      
      // Sort by hierarchy order
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Within same category, sort by task name
      return (a.name || '').localeCompare(b.name || '');
    });

  const tabs: { key: TabType; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'quarterly', label: 'Quarterly' },
    { key: 'yearly', label: 'Yearly' }
  ];

  return (
    <div className="tasks-page">
      <header className="tasks-header">
        <h1>My Tasks</h1>
        <button className="btn btn-primary" onClick={() => setIsTaskFormOpen(true)}>
          ➕ Add Task
        </button>
      </header>

      {/* Tabs */}
      <div className="tasks-tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Navigator for Daily Tab */}
      {activeTab === 'daily' && (
        <div className="date-navigator">
          <button className="btn-nav" onClick={() => changeDate(-1)}>
            ← Previous Day
          </button>
          <input
            type="date"
            className="date-input"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
          />
          <button className="btn-nav" onClick={() => changeDate(1)}>
            Next Day →
          </button>
          <button className="btn-nav btn-today" onClick={() => setSelectedDate(new Date())}>
            📅 Today
          </button>
          <span className="date-display">
            {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
        </div>
      )}

      {/* Excel-like Table */}
      {filteredTasks.length === 0 ? (
        <div className="empty-state">
          <p>No {activeTab} tasks yet.</p>
          <button className="btn btn-primary" onClick={() => setIsTaskFormOpen(true)}>
            Create Task
          </button>
        </div>
      ) : (
        <div className="tasks-table-container">
          <table className={`tasks-table ${activeTab === 'daily' ? 'daily-table' : ''}`}>
            <thead>
              <tr>
                <th className="col-task sticky-col sticky-col-1">Task</th>
                <th className="col-time sticky-col sticky-col-2">Allocated</th>
                {activeTab !== 'today' && activeTab !== 'daily' && <th className="col-time">Spent</th>}
                {activeTab !== 'today' && activeTab !== 'daily' && <th className="col-time">Remaining</th>}
                {activeTab === 'daily' ? (
                  <>
                    <th className="col-time sticky-col sticky-col-3">Spent</th>
                    <th className="col-time sticky-col sticky-col-4">Remaining</th>
                    {hourLabels.map(hour => (
                      <th key={hour.index} className="col-hour">{hour.label}</th>
                    ))}
                    <th className="col-status">Status</th>
                  </>
                ) : (
                  <th className="col-status">Status</th>
                )}
                {activeTab !== 'today' && activeTab !== 'daily' && <th className="col-due">Due Date</th>}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => (
                <tr key={task.id} className={task.is_completed ? 'completed-row' : !task.is_active ? 'na-row' : ''}>
                  <td className="col-task sticky-col sticky-col-1">
                    <div 
                      className="task-name task-link" 
                      onClick={() => handleTaskClick(task.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {task.name}
                    </div>
                    {task.pillar_name && (
                      <div className="task-pillar">
                        ({task.pillar_name}{task.category_name ? ` - ${task.category_name}` : ''})
                      </div>
                    )}
                  </td>
                  <td className="col-time sticky-col sticky-col-2">{task.allocated_minutes} min</td>
                  
                  {activeTab === 'daily' ? (
                    <>
                      {/* Spent column - sum of all hourly entries */}
                      <td className="col-time sticky-col sticky-col-3">
                        {hourLabels.reduce((sum, hour) => sum + getHourlyTime(task.id, hour.index), 0)} min
                      </td>
                      {/* Remaining column */}
                      <td className="col-time sticky-col sticky-col-4">
                        {task.allocated_minutes - hourLabels.reduce((sum, hour) => sum + getHourlyTime(task.id, hour.index), 0)} min
                      </td>
                      {/* 24 hourly columns */}
                      {hourLabels.map(hour => (
                        <td key={hour.index} className="col-hour">
                          <input
                            type="number"
                            min="0"
                            max="60"
                            className="hour-input"
                            value={getHourlyTime(task.id, hour.index) || ''}
                            onChange={(e) => handleHourlyTimeChange(task.id, hour.index, e.target.value)}
                            placeholder="0"
                          />
                        </td>
                      ))}
                      {/* Status column at the end */}
                      <td className="col-status">
                        {task.is_completed ? (
                          <span className="completed-text">✓ Completed</span>
                        ) : !task.is_active ? (
                          <span className="na-text">NA</span>
                        ) : (
                          <div className="action-buttons">
                            <button 
                              className="btn-complete"
                              onClick={() => handleTaskComplete(task.id)}
                            >
                              Completed
                            </button>
                            <button 
                              className="btn-na"
                              onClick={() => handleTaskNA(task.id)}
                            >
                              NA
                            </button>
                          </div>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      {activeTab !== 'today' && <td className="col-time">{task.spent_minutes} min</td>}
                      {activeTab !== 'today' && <td className="col-time">{task.allocated_minutes - task.spent_minutes} min</td>}
                      <td className="col-status">
                        {task.is_completed ? (
                          <span className="completed-text">✓ Completed</span>
                        ) : !task.is_active ? (
                          <span className="na-text">NA</span>
                        ) : (
                          <div className="action-buttons">
                            <button 
                              className="btn-complete"
                              onClick={() => handleTaskComplete(task.id)}
                            >
                              Completed
                            </button>
                            <button 
                              className="btn-na"
                              onClick={() => handleTaskNA(task.id)}
                            >
                              NA
                            </button>
                          </div>
                        )}
                      </td>
                      {activeTab !== 'today' && (
                        <td className="col-due">
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              {activeTab === 'today' && (
                <tr className="total-row">
                  <td className="col-task">
                    <strong>Total Time</strong><br/>
                    <strong>Required</strong>
                  </td>
                  <td className="col-time">
                    <strong>
                      {filteredTasks
                        .filter(task => !task.is_completed && task.is_active)
                        .reduce((sum, task) => sum + task.allocated_minutes, 0)} min
                    </strong>
                  </td>
                  <td className="col-status"></td>
                </tr>
              )}
              {activeTab === 'daily' && (() => {
                const totalAllocated = filteredTasks
                  .filter(task => task.is_active)
                  .reduce((sum, task) => sum + task.allocated_minutes, 0);
                const totalSpent = filteredTasks
                  .filter(task => task.is_active)
                  .reduce((sum, task) => 
                    sum + hourLabels.reduce((hourSum, hour) => hourSum + getHourlyTime(task.id, hour.index), 0)
                  , 0);
                const totalHours = totalAllocated / 60;
                const isExactly24 = totalHours === 24;
                
                return (
                  <tr className={`total-row ${!isExactly24 ? 'total-mismatch' : ''}`}>
                    <td className="col-task sticky-col sticky-col-1">
                      <strong>Total</strong><br/>
                      <strong>Time</strong>
                    </td>
                    <td className="col-time sticky-col sticky-col-2">
                      <strong>{totalAllocated} min</strong><br/>
                      <strong>({totalHours.toFixed(2)}h)</strong>
                    </td>
                    <td className="col-time sticky-col sticky-col-3">
                      <strong>{totalSpent} min</strong>
                    </td>
                    <td className="col-time sticky-col sticky-col-4">
                      <strong>{totalAllocated - totalSpent} min</strong>
                    </td>
                    {hourLabels.map(hour => {
                      const hourTotal = filteredTasks
                        .filter(task => task.is_active)
                        .reduce((sum, task) => sum + getHourlyTime(task.id, hour.index), 0);
                      const isOverLimit = hourTotal > 60;
                      return (
                        <td key={hour.index} className={`col-hour ${isOverLimit ? 'hour-over-limit' : ''}`}>
                          <strong>{hourTotal || '-'}</strong>
                        </td>
                      );
                    })}
                    <td className="col-status"></td>
                  </tr>
                );
              })()}
              {activeTab !== 'today' && activeTab !== 'daily' && (() => {
                const totalMinutes = filteredTasks
                  .filter(task => task.is_active)
                  .reduce((sum, task) => sum + task.allocated_minutes, 0);
                const totalHours = totalMinutes / 60;
                const isExactly24 = totalHours === 24;
                
                return (
                  <tr className={`total-row ${!isExactly24 ? 'total-mismatch' : ''}`}>
                    <td className="col-task">
                      <strong>Total</strong><br/>
                      <strong>Time</strong>
                    </td>
                    <td className="col-time">
                      <strong>{totalMinutes} min</strong><br/>
                      <strong>({totalHours.toFixed(2)}h)</strong>
                    </td>
                    <td className="col-time"></td>
                    <td className="col-time"></td>
                    <td className="col-status"></td>
                    <td className="col-due"></td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      )}

      {/* Incomplete Days Alert */}
      {activeTab === 'daily' && incompleteDays.length > 0 && (
        <div className="incomplete-days-section">
          <div className="incomplete-days-alert">
            <h3>⚠️ Incomplete Days ({incompleteDays.length})</h3>
            <p>These days need attention - Allocated time doesn't match Spent time:</p>
            <div className="incomplete-days-list">
              {incompleteDays.slice(0, 10).map((day: any) => (
                <div key={day.entry_date} className="incomplete-day-item">
                  <a
                    href="#"
                    className="incomplete-day-link"
                    onClick={(e) => {
                      e.preventDefault();
                      openDayInNewTab(day.entry_date.split('T')[0]);
                    }}
                  >
                    <span className="day-date">{formatDate(day.entry_date)}</span>
                    <span className="day-stats">
                      Allocated: {day.total_allocated} min | 
                      Spent: {day.total_spent} min | 
                      <strong className="missing"> Missing: {day.difference} min</strong>
                    </span>
                  </a>
                </div>
              ))}
            </div>
            {incompleteDays.length > 10 && (
              <p className="more-days">
                ...and {incompleteDays.length - 10} more incomplete days
              </p>
            )}
          </div>
        </div>
      )}

      {/* Task Form Modal */}
      <TaskForm
        isOpen={isTaskFormOpen}
        onClose={handleFormClose}
        onSuccess={() => {
          loadTasks();
          handleFormClose();
        }}
        taskId={selectedTaskId || undefined}
      />
    </div>
  );
}
