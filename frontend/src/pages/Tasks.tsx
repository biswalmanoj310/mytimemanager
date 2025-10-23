/**
 * Tasks Page
 * Display and manage all tasks with tabs and table view
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './Tasks.css';
import TaskForm from '../components/TaskForm';
import { Task, FollowUpFrequency, TaskType } from '../types';

type TabType = 'today' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

// Helper functions for task type display
const formatTaskTarget = (task: Task): string => {
  if (task.task_type === TaskType.COUNT) {
    return `${task.target_value} ${task.unit}`;
  } else if (task.task_type === TaskType.BOOLEAN) {
    return 'Yes/No';
  } else {
    return `${task.allocated_minutes} min`;
  }
};

const formatTaskValue = (task: Task, value: number): string => {
  if (task.task_type === TaskType.COUNT) {
    return `${value} ${task.unit}`;
  } else if (task.task_type === TaskType.BOOLEAN) {
    return value > 0 ? '✓ Yes' : '✗ No';
  } else {
    return `${value} min`;
  }
};

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
  // Weekly tab state - key format: "taskId-dayIndex" (0=Sunday, 6=Saturday)
  const [weeklyEntries, setWeeklyEntries] = useState<Record<string, number>>({});
  // Daily aggregates for weekly view - key format: "taskId-dayIndex"
  const [dailyAggregates, setDailyAggregates] = useState<Record<string, number>>({});
  // Weekly task statuses - key format: "taskId", value: {is_completed, is_na}
  const [weeklyTaskStatuses, setWeeklyTaskStatuses] = useState<Record<number, {is_completed: boolean, is_na: boolean}>>({});
  // Task IDs that have ever been completed/NA in any week
  const [everCompletedTaskIds, setEverCompletedTaskIds] = useState<Set<number>>(new Set());
  // Selected week start date for weekly tab
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day; // Adjust to Sunday
    return new Date(today.setDate(diff));
  });
  const [weeklySaveTimeout, setWeeklySaveTimeout] = useState<number | null>(null);
  // Weekly task modal state
  const [showAddWeeklyTaskModal, setShowAddWeeklyTaskModal] = useState(false);
  const [selectedDailyTask, setSelectedDailyTask] = useState<number | null>(null);
  const [isCreatingNewTask, setIsCreatingNewTask] = useState(false);

  useEffect(() => {
    loadTasks();
    loadIncompleteDays();
  }, []);

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyEntries(selectedDate);
    } else if (activeTab === 'weekly') {
      loadWeeklyEntries(selectedWeekStart);
    }
  }, [activeTab, selectedDate, selectedWeekStart]);

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

  // Weekly-specific completion handlers
  const handleWeeklyTaskComplete = async (taskId: number) => {
    try {
      const dateStr = selectedWeekStart.toISOString().split('T')[0];
      // Mark weekly status for this week
      await api.post(`/api/weekly-time/status/${taskId}/complete?week_start_date=${dateStr}`, {});
      // Also mark task globally as completed (so it won't appear in future weeks)
      await api.post(`/api/tasks/${taskId}/complete`, {});
      // Reload weekly statuses and tasks
      await loadWeeklyEntries(selectedWeekStart);
      await loadTasks();
    } catch (err: any) {
      console.error('Error updating weekly task status:', err);
      alert('Failed to update task status: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleWeeklyTaskNA = async (taskId: number) => {
    try {
      const dateStr = selectedWeekStart.toISOString().split('T')[0];
      // Mark weekly status for this week
      await api.post(`/api/weekly-time/status/${taskId}/na?week_start_date=${dateStr}`, {});
      // Also mark task globally as inactive/NA (so it won't appear in future weeks)
      await api.put(`/api/tasks/${taskId}`, { is_active: false });
      // Reload weekly statuses and tasks
      await loadWeeklyEntries(selectedWeekStart);
      await loadTasks();
    } catch (err: any) {
      console.error('Error updating weekly task status:', err);
      alert('Failed to update task status: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleTaskClick = (taskId: number) => {
    // Prevent editing daily tasks from the weekly tab
    if (activeTab === 'weekly') {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.follow_up_frequency === 'daily') {
        alert('Daily tasks cannot be edited or deleted from the Weekly tab. Please use the Daily tab to modify this task.');
        return;
      }
    }
    
    setSelectedTaskId(taskId);
    setIsTaskFormOpen(true);
  };

  const handleFormClose = () => {
    setIsTaskFormOpen(false);
    setSelectedTaskId(null);
    setIsCreatingNewTask(false);
  };

  // Handle adding weekly task from daily task
  const handleAddWeeklyTask = async () => {
    if (!selectedDailyTask) {
      // If no task selected, user wants to create a new task
      setIsCreatingNewTask(true);
      setIsTaskFormOpen(true);
      setShowAddWeeklyTaskModal(false);
      return;
    }

    try {
      // Get the selected task details
      const task = tasks.find(t => t.id === selectedDailyTask);
      if (!task) return;

      // Update the task to be weekly
      await api.put(`/api/tasks/${selectedDailyTask}`, {
        follow_up_frequency: 'weekly'
      });

      // Reload tasks and weekly entries to show daily aggregates
      await loadTasks();
      await loadWeeklyEntries(selectedWeekStart);
      setShowAddWeeklyTaskModal(false);
      setSelectedDailyTask(null);
    } catch (err: any) {
      console.error('Error adding weekly task:', err);
      alert('Failed to add weekly task: ' + (err.response?.data?.detail || err.message));
    }
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
  const saveDailyEntriesWithData = async (entriesToSave: Record<string, number>) => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      // Convert hourlyEntries map to array format
      const entries = Object.entries(entriesToSave)
        .filter(([_, minutes]) => minutes > 0)
        .map(([key, minutes]) => {
          const [task_id, hour] = key.split('-').map(Number);
          return { task_id, hour, minutes };
        });

      if (entries.length > 0) {
        await api.post('/api/daily-time/entries/bulk/', {
          entry_date: dateStr,
          entries: entries
        });
        
        // Reload incomplete days after save
        loadIncompleteDays();
      }
    } catch (err) {
      console.error('Error saving daily entries:', err);
    }
  };

  const saveDailyEntries = async () => {
    await saveDailyEntriesWithData(hourlyEntries);
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

  // ========== WEEKLY TAB FUNCTIONS ==========
  
  // Generate week days with dates
  const generateWeekDays = (weekStart: Date) => {
    const days = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedDate = `${monthNames[date.getMonth()]}-${date.getDate()}-${date.getFullYear()}`;
      
      days.push({
        index: i,
        name: dayNames[i],
        date: date,
        formattedDate: formattedDate,
        label: `${dayNames[i]}\n(${formattedDate})`
      });
    }
    return days;
  };

  const weekDays = generateWeekDays(selectedWeekStart);

  // Get week number
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Load weekly time entries from backend
  const loadWeeklyEntries = async (weekStart: Date) => {
    try {
      const dateStr = weekStart.toISOString().split('T')[0];
      
      // Load weekly entries
      const response: any = await api.get(`/api/weekly-time/entries/${dateStr}`);
      
      // Handle both direct array and response.data scenarios
      let entries = Array.isArray(response) ? response : (response.data || []);
      
      // Convert array to map: key = "taskId-dayOfWeek", value = minutes
      const entriesMap: Record<string, number> = {};
      if (Array.isArray(entries)) {
        entries.forEach((entry: any) => {
          const key = `${entry.task_id}-${entry.day_of_week}`;
          entriesMap[key] = entry.minutes;
        });
      }
      
      setWeeklyEntries(entriesMap);

      // Load daily aggregates for the week
      const dailyResponse: any = await api.get(`/api/daily-time/entries/week/${dateStr}`);
      
      // Convert daily aggregates to same format: "taskId-dayOfWeek"
      const aggregatesMap: Record<string, number> = {};
      const dailyData = dailyResponse.data || dailyResponse;
      
      if (dailyData && typeof dailyData === 'object') {
        Object.entries(dailyData).forEach(([taskId, dayData]: [string, any]) => {
          if (dayData && typeof dayData === 'object') {
            Object.entries(dayData).forEach(([dayOfWeek, minutes]: [string, any]) => {
              const key = `${taskId}-${dayOfWeek}`;
              aggregatesMap[key] = minutes;
            });
          }
        });
      }
      
      // Create a new object reference to ensure React detects the change
      setDailyAggregates({...aggregatesMap});

      // Load weekly task statuses
      const statusResponse: any = await api.get(`/api/weekly-time/status/${dateStr}`);
      
      const statusData = Array.isArray(statusResponse) ? statusResponse : (statusResponse.data || []);
      const statusMap: Record<number, {is_completed: boolean, is_na: boolean}> = {};
      
      if (Array.isArray(statusData)) {
        statusData.forEach((status: any) => {
          statusMap[status.task_id] = {
            is_completed: status.is_completed,
            is_na: status.is_na
          };
        });
      }
      
      setWeeklyTaskStatuses(statusMap);

      // Load list of all tasks that have ever been completed/NA in any week
      const completedResponse: any = await api.get('/api/weekly-time/status/completed-tasks');
      const completedIds = Array.isArray(completedResponse) ? completedResponse : (completedResponse.data || []);
      setEverCompletedTaskIds(new Set(completedIds));
    } catch (err) {
      console.error('Error loading weekly entries:', err);
      setWeeklyEntries({});
      setDailyAggregates({});
      setWeeklyTaskStatuses({});
      setEverCompletedTaskIds(new Set());
    }
  };

  // Save weekly entries to backend (debounced)
  const saveWeeklyEntries = async () => {
    try {
      const dateStr = selectedWeekStart.toISOString().split('T')[0];
      console.log('Saving weekly entries for week starting:', dateStr);
      console.log('Current weeklyEntries:', weeklyEntries);
      
      // Convert weeklyEntries map to array format
      const entries = Object.entries(weeklyEntries)
        .filter(([_, minutes]) => minutes > 0)
        .map(([key, minutes]) => {
          const [task_id, day_of_week] = key.split('-').map(Number);
          return { task_id, day_of_week, minutes };
        });

      console.log('Entries to save:', entries);
      if (entries.length > 0) {
        const response = await api.post('/api/weekly-time/entries/bulk/', {
          week_start_date: dateStr,
          entries: entries
        });
        console.log('Save response:', response);
      } else {
        console.log('No entries to save (all zero or empty)');
      }
    } catch (err) {
      console.error('Error saving weekly entries:', err);
    }
  };

  // Handle weekly time entry change with auto-save
  const handleWeeklyTimeChange = (taskId: number, dayIndex: number, value: string) => {
    const minutes = parseInt(value) || 0;
    const key = `${taskId}-${dayIndex}`;
    setWeeklyEntries(prev => ({
      ...prev,
      [key]: minutes
    }));
    
    // Debounced auto-save - wait 1 second after last input
    if (weeklySaveTimeout) {
      window.clearTimeout(weeklySaveTimeout);
    }
    
    const timeout = window.setTimeout(() => {
      saveWeeklyEntries();
    }, 1000);
    
    setWeeklySaveTimeout(timeout);
  };

  // Get weekly time entry for a task and day
  // If no weekly entry exists, return the daily aggregate (sum from Daily tab)
  const getWeeklyTime = (taskId: number, dayIndex: number): number => {
    const key = `${taskId}-${dayIndex}`;
    // If there's a weekly entry, use it; otherwise use daily aggregate
    if (weeklyEntries[key] !== undefined) {
      return weeklyEntries[key];
    }
    return dailyAggregates[key] || 0;
  };

  // Check if the displayed value is from daily aggregate
  const isFromDailyAggregate = (taskId: number, dayIndex: number): boolean => {
    const key = `${taskId}-${dayIndex}`;
    return weeklyEntries[key] === undefined && (dailyAggregates[key] || 0) > 0;
  };

  // Change selected week
  const changeWeek = (weeks: number) => {
    const newDate = new Date(selectedWeekStart);
    newDate.setDate(newDate.getDate() + (weeks * 7));
    setSelectedWeekStart(newDate);
    loadWeeklyEntries(newDate);
  };

  // Go to current week
  const goToCurrentWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    const currentWeek = new Date(today.setDate(diff));
    setSelectedWeekStart(currentWeek);
    loadWeeklyEntries(currentWeek);
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
    
    setHourlyEntries(prev => {
      const newEntries = {
        ...prev,
        [key]: minutes
      };
      
      // Debounced auto-save - wait 1 second after last input
      if (saveTimeout) {
        window.clearTimeout(saveTimeout);
      }
      
      const timeout = window.setTimeout(() => {
        saveDailyEntriesWithData(newEntries);
      }, 1000);
      
      setSaveTimeout(timeout);
      
      return newEntries;
    });
  };

  // Get hourly time entry for a task and hour
  const getHourlyTime = (taskId: number, hour: number): number => {
    const key = `${taskId}-${hour}`;
    return hourlyEntries[key] || 0;
  };

  // Calculate average daily time for a task in weekly view and get row color class
  const getWeeklyRowColorClass = (task: Task): string => {
    if (activeTab !== 'weekly') return '';
    
    // Calculate total spent/count in the week so far
    const totalSpent = weekDays.reduce((sum, day) => sum + getWeeklyTime(task.id, day.index), 0);
    
    // Determine how many days have elapsed in the current week (including today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(selectedWeekStart);
    weekStart.setHours(0, 0, 0, 0);
    
    // Calculate days elapsed: if today is within this week, count up to today; otherwise use full week
    let daysElapsed = 7; // Default to full week
    if (today >= weekStart) {
      const diffTime = today.getTime() - weekStart.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      daysElapsed = Math.min(diffDays + 1, 7); // +1 to include today, max 7 days
    }
    
    // Calculate expected target based on task type and days elapsed
    let expectedTarget = 0;
    if (task.task_type === TaskType.COUNT) {
      // For count tasks: target_value per day * days elapsed
      expectedTarget = (task.target_value || 0) * daysElapsed;
    } else if (task.task_type === TaskType.BOOLEAN) {
      // For boolean tasks: 1 per day * days elapsed (should be done each day)
      expectedTarget = daysElapsed;
    } else {
      // For time tasks: allocated_minutes per day * days elapsed
      expectedTarget = task.allocated_minutes * daysElapsed;
    }
    
    // Return color class based on comparison
    if (totalSpent >= expectedTarget) {
      return 'weekly-on-track'; // Green - meeting or exceeding target
    } else if (totalSpent > 0) {
      return 'weekly-below-target'; // Light red - below target but has some progress
    }
    return ''; // No color if no progress yet
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
      
      // For weekly tab: Check if task was ever completed/NA in any week
      if (activeTab === 'weekly') {
        const taskStatus = weeklyTaskStatuses[task.id];
        const wasEverCompleted = everCompletedTaskIds.has(task.id);
        
        if (taskStatus && (taskStatus.is_completed || taskStatus.is_na)) {
          // Task is completed/NA for current week - keep it visible this week
          return true;
        }
        
        // If task was ever completed/NA in any previous week, don't show it in future weeks
        if (wasEverCompleted) {
          return false;
        }
        
        // Also filter out globally completed/NA tasks
        if (task.is_completed || !task.is_active) {
          return false;
        }
        return true;
      }
      
      // For other tabs (daily, monthly, etc.): If task is completed, only show if completed today
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

      {/* Week Navigator for Weekly Tab */}
      {activeTab === 'weekly' && (
        <div className="date-navigator">
          <button className="btn-nav" onClick={() => changeWeek(-1)}>
            ← Previous Week
          </button>
          <button className="btn-nav" onClick={() => changeWeek(1)}>
            Next Week →
          </button>
          <button className="btn-nav btn-today" onClick={goToCurrentWeek}>
            📅 Current Week
          </button>
          <button 
            className="btn-nav btn-add-weekly" 
            onClick={() => setShowAddWeeklyTaskModal(true)}
            style={{ marginLeft: 'auto', backgroundColor: '#10b981', color: 'white' }}
          >
            ➕ Add Weekly Task
          </button>
          <span className="date-display">
            Week {getWeekNumber(selectedWeekStart)} - {selectedWeekStart.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            })} to {(() => {
              const weekEnd = new Date(selectedWeekStart);
              weekEnd.setDate(selectedWeekStart.getDate() + 6);
              return weekEnd.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              });
            })()}
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
          <table className={`tasks-table ${activeTab === 'daily' || activeTab === 'weekly' ? 'daily-table' : ''}`}>
            <thead>
              <tr>
                <th className="col-task sticky-col sticky-col-1">Task</th>
                <th className="col-time sticky-col sticky-col-2">Allocated</th>
                {activeTab === 'daily' ? (
                  <>
                    <th className="col-time sticky-col sticky-col-3">Spent</th>
                    <th className="col-time sticky-col sticky-col-4">Remaining</th>
                    {hourLabels.map(hour => (
                      <th key={hour.index} className="col-hour">{hour.label}</th>
                    ))}
                    <th className="col-status">Status</th>
                  </>
                ) : activeTab === 'weekly' ? (
                  <>
                    <th className="col-time sticky-col sticky-col-3">Spent</th>
                    <th className="col-time sticky-col sticky-col-4">Remaining</th>
                    {weekDays.map(day => (
                      <th key={day.index} className="col-hour">{day.label}</th>
                    ))}
                    <th className="col-status">Status</th>
                  </>
                ) : (
                  <>
                    {activeTab !== 'today' && <th className="col-time">Spent</th>}
                    {activeTab !== 'today' && <th className="col-time">Remaining</th>}
                    <th className="col-status">Status</th>
                    {activeTab !== 'today' && <th className="col-due">Due Date</th>}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => {
                // Check if this task has any daily aggregates (meaning it came from daily tab)
                const hasDailyAggregates = activeTab === 'weekly' && weekDays.some(day => isFromDailyAggregate(task.id, day.index));
                
                // Get row color class for weekly view
                const weeklyColorClass = getWeeklyRowColorClass(task);
                
                return (
                <tr key={task.id} className={task.is_completed ? 'completed-row' : !task.is_active ? 'na-row' : ''}>
                  <td className={`col-task sticky-col sticky-col-1 ${weeklyColorClass}`}>
                    <div 
                      className={`task-name ${hasDailyAggregates ? '' : 'task-link'}`}
                      onClick={() => handleTaskClick(task.id)}
                      style={{ 
                        cursor: hasDailyAggregates ? 'not-allowed' : 'pointer',
                        opacity: hasDailyAggregates ? 0.7 : 1
                      }}
                      title={hasDailyAggregates ? 'Task with daily aggregates - edit time in Daily tab' : 'Click to edit'}
                    >
                      {task.name}
                      {activeTab === 'weekly' && hasDailyAggregates && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>
                      )}
                      {activeTab === 'weekly' && !hasDailyAggregates && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#4299e1', fontWeight: '600' }}>(Weekly)</span>
                      )}
                    </div>
                    {task.pillar_name && (
                      <div className="task-pillar">
                        ({task.pillar_name}{task.category_name ? ` - ${task.category_name}` : ''})
                      </div>
                    )}
                  </td>
                  <td className={`col-time sticky-col sticky-col-2 ${weeklyColorClass}`}>
                    {formatTaskTarget(task)}
                  </td>
                  
                  {activeTab === 'daily' ? (
                    <>
                      {/* Spent column - sum of all hourly entries */}
                      <td className={`col-time sticky-col sticky-col-3 ${weeklyColorClass}`}>
                        {formatTaskValue(task, hourLabels.reduce((sum, hour) => sum + getHourlyTime(task.id, hour.index), 0))}
                      </td>
                      {/* Remaining column */}
                      <td className={`col-time sticky-col sticky-col-4 ${weeklyColorClass}`}>
                        {(() => {
                          const spent = hourLabels.reduce((sum, hour) => sum + getHourlyTime(task.id, hour.index), 0);
                          const target = task.task_type === TaskType.COUNT ? (task.target_value || 0) : task.allocated_minutes;
                          const remaining = target - spent;
                          return formatTaskValue(task, remaining > 0 ? remaining : 0);
                        })()}
                      </td>
                      {/* 24 hourly columns */}
                      {hourLabels.map(hour => {
                        const isBoolean = task.task_type === TaskType.BOOLEAN;
                        return (
                          <td key={hour.index} className="col-hour">
                            {isBoolean ? (
                              <input
                                type="checkbox"
                                className="hour-input"
                                checked={getHourlyTime(task.id, hour.index) > 0}
                                onChange={(e) => handleHourlyTimeChange(task.id, hour.index, e.target.checked ? '1' : '0')}
                                title="Mark as done"
                                style={{ cursor: 'pointer' }}
                              />
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max={task.task_type === TaskType.COUNT ? undefined : 60}
                                className="hour-input"
                                value={getHourlyTime(task.id, hour.index) || ''}
                                onChange={(e) => handleHourlyTimeChange(task.id, hour.index, e.target.value)}
                                placeholder="0"
                                title={task.task_type === TaskType.COUNT ? 'Enter count' : 'Enter minutes'}
                              />
                            )}
                          </td>
                        );
                      })}
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
                  ) : activeTab === 'weekly' ? (
                    <>
                      {/* Spent column - average per day */}
                      <td className={`col-time sticky-col sticky-col-3 ${weeklyColorClass}`}>
                        {(() => {
                          const totalSpent = weekDays.reduce((sum, day) => sum + getWeeklyTime(task.id, day.index), 0);
                          const averagePerDay = Math.round(totalSpent / 7);
                          return formatTaskValue(task, averagePerDay);
                        })()}
                      </td>
                      {/* Remaining column - time needed per remaining day to hit target */}
                      <td className={`col-time sticky-col sticky-col-4 ${weeklyColorClass}`}>
                        {(() => {
                          const totalSpent = weekDays.reduce((sum, day) => sum + getWeeklyTime(task.id, day.index), 0);
                          const dailyTarget = task.task_type === TaskType.COUNT ? (task.target_value || 0) : task.allocated_minutes;
                          const weeklyTarget = dailyTarget * 7;
                          const remaining = weeklyTarget - totalSpent;
                          
                          // Calculate days remaining in the week
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const weekStart = new Date(selectedWeekStart);
                          weekStart.setHours(0, 0, 0, 0);
                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekEnd.getDate() + 6); // Saturday
                          
                          let daysRemaining = 0;
                          if (today >= weekStart && today <= weekEnd) {
                            // Current week: days from tomorrow to end of week
                            const diffTime = weekEnd.getTime() - today.getTime();
                            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          }
                          
                          if (remaining <= 0) {
                            return formatTaskValue(task, 0); // Target already met
                          } else if (daysRemaining === 0) {
                            return formatTaskValue(task, remaining); // Last day, show total remaining
                          } else {
                            const perDayRemaining = Math.round(remaining / daysRemaining);
                            return formatTaskValue(task, perDayRemaining);
                          }
                        })()}
                      </td>
                      {/* 7 daily columns */}
                      {weekDays.map(day => {
                        const isDailyAggregate = isFromDailyAggregate(task.id, day.index);
                        const isBoolean = task.task_type === TaskType.BOOLEAN;
                        return (
                          <td key={day.index} className={`col-hour ${weeklyColorClass}`}>
                            {isBoolean ? (
                              <input
                                type="checkbox"
                                className={`hour-input ${isDailyAggregate ? 'from-daily' : ''}`}
                                checked={getWeeklyTime(task.id, day.index) > 0}
                                onChange={(e) => handleWeeklyTimeChange(task.id, day.index, e.target.checked ? '1' : '0')}
                                title={isDailyAggregate ? 'Read-only: Auto-populated from Daily tab. Edit in Daily tab to change.' : 'Mark as done'}
                                disabled={isDailyAggregate}
                                style={isDailyAggregate ? { cursor: 'not-allowed', opacity: 0.7 } : { cursor: 'pointer' }}
                              />
                            ) : (
                              <input
                                type="number"
                                min="0"
                                className={`hour-input ${isDailyAggregate ? 'from-daily' : ''}`}
                                value={getWeeklyTime(task.id, day.index) || ''}
                                onChange={(e) => handleWeeklyTimeChange(task.id, day.index, e.target.value)}
                                placeholder="0"
                                title={isDailyAggregate ? 'Read-only: Auto-populated from Daily tab. Edit in Daily tab to change.' : `Enter ${task.task_type === TaskType.COUNT ? 'count' : 'time'}`}
                                readOnly={isDailyAggregate}
                                disabled={isDailyAggregate}
                                style={isDailyAggregate ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
                              />
                            )}
                          </td>
                        );
                      })}
                      {/* Status column at the end - Weekly specific status */}
                      <td className="col-status">
                        {weeklyTaskStatuses[task.id]?.is_completed ? (
                          <span className="completed-text">✓ Completed (Week)</span>
                        ) : weeklyTaskStatuses[task.id]?.is_na ? (
                          <span className="na-text">NA (Week)</span>
                        ) : (
                          <div className="action-buttons">
                            <button 
                              className="btn-complete"
                              onClick={() => handleWeeklyTaskComplete(task.id)}
                              title="Mark as completed for this week only"
                            >
                              Completed
                            </button>
                            <button 
                              className="btn-na"
                              onClick={() => handleWeeklyTaskNA(task.id)}
                              title="Mark as NA for this week only"
                            >
                              NA
                            </button>
                          </div>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      {activeTab !== 'today' && <td className="col-time">{formatTaskValue(task, task.spent_minutes)}</td>}
                      {activeTab !== 'today' && <td className="col-time">{(() => {
                        const target = task.task_type === TaskType.COUNT ? (task.target_value || 0) : task.allocated_minutes;
                        const remaining = target - task.spent_minutes;
                        return formatTaskValue(task, remaining > 0 ? remaining : 0);
                      })()}</td>}
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
              );
              })}
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

      {/* Add Weekly Task Modal */}
      {showAddWeeklyTaskModal && (
        <div className="modal-overlay" onClick={() => setShowAddWeeklyTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Weekly Task</h2>
              <button className="btn-close" onClick={() => setShowAddWeeklyTaskModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '15px', color: '#666' }}>
                Select an existing daily task to convert to weekly, or create a new task:
              </p>
              
              <div className="form-group">
                <label htmlFor="dailyTaskSelect">Select from Daily Tasks:</label>
                <select 
                  id="dailyTaskSelect"
                  className="form-control"
                  value={selectedDailyTask || ''}
                  onChange={(e) => setSelectedDailyTask(e.target.value ? Number(e.target.value) : null)}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    marginTop: '5px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e0'
                  }}
                >
                  <option value="">-- Select a daily task --</option>
                  {tasks
                    .filter(task => task.follow_up_frequency === 'daily' && task.is_active)
                    .sort((a, b) => {
                      // Sort by pillar-category hierarchy order
                      const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                      const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      
                      // If same hierarchy, sort by name
                      return a.name.localeCompare(b.name);
                    })
                    .map(task => (
                      <option key={task.id} value={task.id}>
                        {task.pillar_name} - {task.category_name}: {task.name} ({task.allocated_minutes} min)
                      </option>
                    ))
                  }
                </select>
              </div>

              <div style={{ margin: '20px 0', textAlign: 'center', color: '#999' }}>
                OR
              </div>

              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedDailyTask(null);
                  handleAddWeeklyTask();
                }}
                style={{ width: '100%' }}
              >
                Create New Task
              </button>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowAddWeeklyTaskModal(false);
                  setSelectedDailyTask(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleAddWeeklyTask}
                disabled={!selectedDailyTask}
                style={{ 
                  opacity: selectedDailyTask ? 1 : 0.5,
                  cursor: selectedDailyTask ? 'pointer' : 'not-allowed'
                }}
              >
                Add to Weekly
              </button>
            </div>
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
        defaultFrequency={isCreatingNewTask ? FollowUpFrequency.WEEKLY : undefined}
      />
    </div>
  );
}
