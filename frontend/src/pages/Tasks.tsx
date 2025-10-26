/**
 * Tasks Page
 * Display and manage all tasks with tabs and table view
 */

import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Tasks.css';
import TaskForm from '../components/TaskForm';
import { Task, FollowUpFrequency, TaskType } from '../types';

type TabType = 'today' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'onetime' | 'projects';

// Helper functions for task type display
const formatTaskTarget = (task: Task, showPeriod: boolean = false, showAvgPerDay: boolean = false): React.ReactNode => {
  if (task.task_type === TaskType.COUNT) {
    const baseValue = `${task.target_value} ${task.unit}`;
    if (showPeriod && task.follow_up_frequency !== 'daily') {
      // Show period for non-daily tasks (e.g., "20 numbers/month" or "4 speeches/week")
      const period = task.follow_up_frequency === 'weekly' ? '/week' : 
                     task.follow_up_frequency === 'monthly' ? '/month' : 
                     task.follow_up_frequency === 'quarterly' ? '/quarter' : '';
      
      // Optionally show average per day on second line
      if (showAvgPerDay) {
        const daysInPeriod = task.follow_up_frequency === 'weekly' ? 7 : 
                            task.follow_up_frequency === 'monthly' ? 30 : 
                            task.follow_up_frequency === 'quarterly' ? 90 : 1;
        const avgPerDay = ((task.target_value || 0) / daysInPeriod).toFixed(1);
        return (
          <>
            {baseValue}{period}
            <br />
            <small style={{ color: '#666', fontSize: '0.85em' }}>~{avgPerDay}/day</small>
          </>
        );
      }
      
      return `${baseValue}${period}`;
    }
    return baseValue;
  } else if (task.task_type === TaskType.BOOLEAN) {
    return 'Yes/No';
  } else {
    const baseValue = `${task.allocated_minutes} min`;
    if (showPeriod && task.follow_up_frequency !== 'daily') {
      // Show period for non-daily tasks (e.g., "120 min/month" or "20 min/week")
      const period = task.follow_up_frequency === 'weekly' ? '/week' : 
                     task.follow_up_frequency === 'monthly' ? '/month' : 
                     task.follow_up_frequency === 'quarterly' ? '/quarter' : '';
      
      // Optionally show average per day on second line
      if (showAvgPerDay) {
        const daysInPeriod = task.follow_up_frequency === 'weekly' ? 7 : 
                            task.follow_up_frequency === 'monthly' ? 30 : 
                            task.follow_up_frequency === 'quarterly' ? 90 : 1;
        const avgPerDay = Math.round((task.allocated_minutes || 0) / daysInPeriod);
        return (
          <>
            {baseValue}{period}
            <br />
            <small style={{ color: '#666', fontSize: '0.85em' }}>~{avgPerDay} min/day</small>
          </>
        );
      }
      
      return `${baseValue}${period}`;
    }
    return baseValue;
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
  const [addToTrackingAfterCreate, setAddToTrackingAfterCreate] = useState<'weekly' | 'monthly' | 'yearly' | 'onetime' | null>(null);
  
  // Monthly tab state - key format: "taskId-dayOfMonth" (1-31)
  const [monthlyEntries, setMonthlyEntries] = useState<Record<string, number>>({});
  // Daily aggregates for monthly view - key format: "taskId-dayOfMonth"
  const [monthlyDailyAggregates, setMonthlyDailyAggregates] = useState<Record<string, number>>({});
  // Monthly task statuses - key format: "taskId", value: {is_completed, is_na}
  const [monthlyTaskStatuses, setMonthlyTaskStatuses] = useState<Record<number, {is_completed: boolean, is_na: boolean}>>({});
  // Selected month start date for monthly tab
  const [selectedMonthStart, setSelectedMonthStart] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [monthlySaveTimeout, setMonthlySaveTimeout] = useState<number | null>(null);
  // Monthly task modal state
  const [showAddMonthlyTaskModal, setShowAddMonthlyTaskModal] = useState(false);
  const [selectedDailyTaskForMonthly, setSelectedDailyTaskForMonthly] = useState<number | null>(null);

  // Yearly tab state - key format: "taskId-month" (1-12 for Jan-Dec)
  const [yearlyEntries, setYearlyEntries] = useState<Record<string, number>>({});
  // Monthly aggregates for yearly view - key format: "taskId-month"
  const [yearlyMonthlyAggregates, setYearlyMonthlyAggregates] = useState<Record<string, number>>({});
  // Yearly task statuses - key format: "taskId", value: {is_completed, is_na}
  const [yearlyTaskStatuses, setYearlyTaskStatuses] = useState<Record<number, {is_completed: boolean, is_na: boolean}>>({});
  // Selected year start date for yearly tab
  const [selectedYearStart, setSelectedYearStart] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), 0, 1); // January 1st of current year
  });
  const [yearlySaveTimeout, setYearlySaveTimeout] = useState<number | null>(null);
  // Yearly task modal state
  const [showAddYearlyTaskModal, setShowAddYearlyTaskModal] = useState(false);
  const [selectedDailyTaskForYearly, setSelectedDailyTaskForYearly] = useState<number | null>(null);

  // One-time tasks state
  interface OneTimeTaskData {
    id: number;
    task_id: number;
    start_date: string;
    target_gap: number | null;
    updated_date: string | null;
  }
  const [oneTimeTasks, setOneTimeTasks] = useState<OneTimeTaskData[]>([]);
  const [showAddOneTimeTaskModal, setShowAddOneTimeTaskModal] = useState(false);
  const [selectedTaskForOneTime, setSelectedTaskForOneTime] = useState<number | null>(null);

  // Projects state
  interface ProjectData {
    id: number;
    name: string;
    description: string | null;
    pillar_id: number | null;
    category_id: number | null;
    start_date: string | null;
    target_completion_date: string | null;
    status: string;
    is_active: boolean;
    is_completed: boolean;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    progress: {
      total_tasks: number;
      completed_tasks: number;
      progress_percentage: number;
    };
  }
  
  interface ProjectTaskData {
    id: number;
    project_id: number;
    parent_task_id: number | null;
    name: string;
    description: string | null;
    due_date: string | null;
    priority: string;
    is_completed: boolean;
    completed_at: string | null;
    order: number;
    created_at: string;
    updated_at: string;
  }

  // Life Goals state
  interface LifeGoalData {
    id: number;
    name: string;
    parent_goal_id: number | null;
    start_date: string;
    target_date: string;
    actual_completion_date: string | null;
    status: string; // not_started, in_progress, on_track, at_risk, behind, completed, abandoned
    category: string | null;
    priority: string;
    why_statements: string[]; // Array of strings
    description: string | null;
    progress_percentage: number;
    time_allocated_hours: number;
    time_spent_hours: number;
    days_remaining: number | null;
    created_at: string;
    updated_at: string | null;
  }

  interface MilestoneData {
    id: number;
    goal_id: number;
    name: string;
    description: string | null;
    target_date: string;
    actual_completion_date: string | null;
    is_completed: boolean;
    metric: string | null;
    order: number;
    created_at: string;
  }

  interface GoalTaskLinkData {
    id: number;
    goal_id: number;
    task_id: number;
    task_type: string;
    time_allocated_hours: number;
    notes: string | null;
    created_at: string;
    task?: Task; // Populated task data
  }

  interface GoalTaskData {
    id: number;
    goal_id: number;
    name: string;
    description: string | null;
    due_date: string | null;
    is_completed: boolean;
    completed_at: string | null;
    time_allocated_hours: number;
    time_spent_hours: number;
    priority: string;
    order: number;
    created_at: string;
    updated_at: string | null;
  }

  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [projectTasks, setProjectTasks] = useState<ProjectTaskData[]>([]);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null);
  const [editingTask, setEditingTask] = useState<ProjectTaskData | null>(null);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [projectTasksDueToday, setProjectTasksDueToday] = useState<Array<ProjectTaskData & { project_name?: string }>>([]);
  const [overdueOneTimeTasks, setOverdueOneTimeTasks] = useState<Array<OneTimeTaskData & { task_name?: string }>>([]);
  const [goalTasksDueToday, setGoalTasksDueToday] = useState<Array<any>>([]);
  const [pendingProjectId, setPendingProjectId] = useState<number | null>(null); // Track project ID from URL

  // Life Goals state
  const [lifeGoals, setLifeGoals] = useState<LifeGoalData[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<LifeGoalData | null>(null);
  const [goalMilestones, setGoalMilestones] = useState<MilestoneData[]>([]);
  const [goalTasks, setGoalTasks] = useState<GoalTaskData[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<GoalTaskLinkData[]>([]);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false);
  const [showAddGoalTaskModal, setShowAddGoalTaskModal] = useState(false);
  const [showLinkTaskModal, setShowLinkTaskModal] = useState(false);

  // Get location for URL parameters
  const location = useLocation();
  const navigate = useNavigate();

  // Handle URL parameters on mount and when location changes
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    const projectParam = searchParams.get('project');
    const dateParam = searchParams.get('date');

    console.log('URL params:', { tabParam, projectParam, dateParam });

    // Set active tab if provided
    if (tabParam) {
      const validTabs: TabType[] = ['today', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'onetime', 'projects'];
      if (validTabs.includes(tabParam as TabType)) {
        console.log('Setting active tab to:', tabParam);
        setActiveTab(tabParam as TabType);
      }
    }

    // Set selected date if provided (for daily tab)
    if (dateParam) {
      try {
        const date = new Date(dateParam);
        if (!isNaN(date.getTime())) {
          setSelectedDate(date);
        }
      } catch (e) {
        console.error('Invalid date parameter:', dateParam);
      }
    }

    // Store project ID to select after projects are loaded (only if not already set)
    if (projectParam && tabParam === 'projects') {
      const projectId = parseInt(projectParam);
      console.log('Parsed project ID from URL:', projectId);
      if (!isNaN(projectId)) {
        setPendingProjectId(projectId);
      }
    } else if (tabParam !== 'projects') {
      // Clear pending project ID if we're not on projects tab
      setPendingProjectId(null);
    }
  }, [location.search]);

  // Select project when projects are loaded and we have a pending project ID
  useEffect(() => {
    console.log('Project selection effect:', { pendingProjectId, projectsCount: projects.length });
    if (pendingProjectId !== null && projects.length > 0) {
      console.log('Looking for project with ID:', pendingProjectId);
      console.log('Available projects:', projects.map(p => ({ id: p.id, name: p.name })));
      const project = projects.find(p => p.id === pendingProjectId);
      if (project) {
        console.log('Found and selecting project:', project.name);
        handleSelectProject(project);
        setPendingProjectId(null); // Clear pending ID after selection
      } else {
        console.warn('Project not found with ID:', pendingProjectId);
        console.log('This might mean the project is linked to a goal but not in the projects list');
      }
    }
  }, [projects, pendingProjectId]);

  useEffect(() => {
    loadTasks();
    loadIncompleteDays();
  }, []);

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyEntries(selectedDate);
    } else if (activeTab === 'weekly') {
      loadWeeklyEntries(selectedWeekStart);
    } else if (activeTab === 'monthly') {
      loadMonthlyEntries(selectedMonthStart);
    } else if (activeTab === 'yearly') {
      loadYearlyEntries(selectedYearStart);
    } else if (activeTab === 'onetime') {
      loadOneTimeTasks();
    } else if (activeTab === 'projects') {
      loadProjects();
    } else if (activeTab === 'today') {
      loadProjectTasksDueToday();
      loadGoalTasksDueToday();
      // Load one-time tasks so we can check for overdue ones
      loadOneTimeTasks();
    }
  }, [activeTab, selectedDate, selectedWeekStart, selectedMonthStart, selectedYearStart]);

  // Reload overdue one-time tasks when tasks or oneTimeTasks change
  useEffect(() => {
    if (activeTab === 'today' && tasks.length > 0 && oneTimeTasks.length > 0) {
      loadOverdueOneTimeTasks();
    }
  }, [tasks, oneTimeTasks, activeTab]);

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
      // Mark weekly status ONLY for this week (don't affect global task status)
      await api.post(`/api/weekly-time/status/${taskId}/complete?week_start_date=${dateStr}`, {});
      // Reload weekly statuses only (don't reload tasks to avoid affecting daily view)
      await loadWeeklyEntries(selectedWeekStart);
    } catch (err: any) {
      console.error('Error updating weekly task status:', err);
      alert('Failed to update task status: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleWeeklyTaskNA = async (taskId: number) => {
    try {
      const dateStr = selectedWeekStart.toISOString().split('T')[0];
      // Mark weekly status ONLY for this week (don't affect global task status)
      await api.post(`/api/weekly-time/status/${taskId}/na?week_start_date=${dateStr}`, {});
      // Reload weekly statuses only (don't reload tasks to avoid affecting daily view)
      await loadWeeklyEntries(selectedWeekStart);
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
    setAddToTrackingAfterCreate(null);
  };

  // Handle adding weekly task from daily task
  const handleAddWeeklyTask = async () => {
    if (!selectedDailyTask) {
      // If no task selected, user wants to create a new task
      setIsCreatingNewTask(true);
      setAddToTrackingAfterCreate('weekly');
      setIsTaskFormOpen(true);
      setShowAddWeeklyTaskModal(false);
      return;
    }

    try {
      // Get the selected task details
      const task = tasks.find(t => t.id === selectedDailyTask);
      if (!task) return;

      // Create a weekly status entry to mark this task for tracking this week
      // This keeps the task as 'daily' but makes it appear in the weekly view
      const weekStart = selectedWeekStart.toISOString().split('T')[0];
      await api.post(`/api/weekly-time/status/${selectedDailyTask}/${weekStart}`, {
        is_completed: false,
        is_na: false
      });

      // Reload tasks and weekly entries to show the task in weekly view
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
        
        // Reload weekly entries to update daily aggregates in weekly view
        await loadWeeklyEntries(selectedWeekStart);
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

      // Auto-copy incomplete tasks from previous week ONLY if viewing the current real week
      if (statusData.length === 0) {
        // Check if the week we're loading IS the current real week (not a future week)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekStartDate = new Date(weekStart);
        weekStartDate.setHours(0, 0, 0, 0);
        const weekEndDate = new Date(weekStart);
        weekEndDate.setDate(weekEndDate.getDate() + 6); // Saturday
        weekEndDate.setHours(23, 59, 59, 999);
        
        const isCurrentRealWeek = today >= weekStartDate && today <= weekEndDate;
        
        // Only auto-copy if this is the current real week (not browsing future weeks)
        if (isCurrentRealWeek) {
          // This week has no tasks yet - check if we should copy from previous week
          const prevWeekStart = new Date(weekStart);
          prevWeekStart.setDate(prevWeekStart.getDate() - 7);
          const prevWeekDateStr = prevWeekStart.toISOString().split('T')[0];
          
          try {
            const prevWeekStatusResponse: any = await api.get(`/api/weekly-time/status/${prevWeekDateStr}`);
            const prevWeekStatusData = Array.isArray(prevWeekStatusResponse) ? prevWeekStatusResponse : (prevWeekStatusResponse.data || []);
            
            if (Array.isArray(prevWeekStatusData) && prevWeekStatusData.length > 0) {
              // Copy tasks that were NOT completed and NOT NA in previous week
              const tasksToCopy = prevWeekStatusData.filter((status: any) => 
                !status.is_completed && !status.is_na
              );
              
              if (tasksToCopy.length > 0) {
                // Create status entries for this week for all incomplete tasks
                for (const prevStatus of tasksToCopy) {
                  try {
                    await api.post(`/api/weekly-time/status/${prevStatus.task_id}/${dateStr}`, {
                      is_completed: false,
                      is_na: false
                    });
                  } catch (err) {
                    console.error(`Error copying task ${prevStatus.task_id} to new week:`, err);
                  }
                }
                
                // Reload statuses after copying
                const newStatusResponse: any = await api.get(`/api/weekly-time/status/${dateStr}`);
                const newStatusData = Array.isArray(newStatusResponse) ? newStatusResponse : (newStatusResponse.data || []);
                const newStatusMap: Record<number, {is_completed: boolean, is_na: boolean}> = {};
                
                if (Array.isArray(newStatusData)) {
                  newStatusData.forEach((status: any) => {
                    newStatusMap[status.task_id] = {
                      is_completed: status.is_completed,
                      is_na: status.is_na
                    };
                  });
                }
                
                setWeeklyTaskStatuses(newStatusMap);
              }
            }
          } catch (err) {
            console.error('Error checking/copying tasks from previous week:', err);
          }
        }
      }

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

  // Check if a task has any daily aggregates in monthly view
  const hasMonthlyDailyAggregates = (taskId: number): boolean => {
    // Check if any day in the month has daily aggregate data for this task
    return Object.keys(monthlyDailyAggregates).some(key => {
      const [id] = key.split('-');
      return parseInt(id) === taskId;
    });
  };

  // Check if a task has any monthly aggregates in yearly view
  const hasYearlyMonthlyAggregates = (taskId: number): boolean => {
    // Check if any month in the year has monthly aggregate data for this task
    return Object.keys(yearlyMonthlyAggregates).some(key => {
      const [id] = key.split('-');
      return parseInt(id) === taskId;
    });
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

  // ============= MONTHLY TAB FUNCTIONS =============
  
  // Load monthly time entries and aggregates
  const loadMonthlyEntries = async (monthStart: Date) => {
    try {
      const dateStr = monthStart.toISOString().split('T')[0];
      
      // Load monthly entries
      const response: any = await api.get(`/api/monthly-time/entries/${dateStr}`);
      let entries = Array.isArray(response) ? response : (response.data || []);
      
      // Convert array to map: key = "taskId-dayOfMonth", value = minutes
      const entriesMap: Record<string, number> = {};
      if (Array.isArray(entries)) {
        entries.forEach((entry: any) => {
          const key = `${entry.task_id}-${entry.day_of_month}`;
          entriesMap[key] = entry.minutes;
        });
      }
      
      setMonthlyEntries(entriesMap);

      // Load daily aggregates for the month
      const dailyResponse: any = await api.get(`/api/daily-time/entries/month/${dateStr}`);
      
      // Convert daily aggregates to same format: "taskId-dayOfMonth"
      const aggregatesMap: Record<string, number> = {};
      const dailyData = dailyResponse.data || dailyResponse;
      
      if (dailyData && typeof dailyData === 'object') {
        Object.entries(dailyData).forEach(([taskId, dayData]: [string, any]) => {
          if (dayData && typeof dayData === 'object') {
            Object.entries(dayData).forEach(([dayOfMonth, minutes]: [string, any]) => {
              const key = `${taskId}-${dayOfMonth}`;
              aggregatesMap[key] = minutes;
            });
          }
        });
      }
      
      setMonthlyDailyAggregates({...aggregatesMap});

      // Load monthly task statuses
      const statusResponse: any = await api.get(`/api/monthly-time/status/${dateStr}`);
      
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
      
      setMonthlyTaskStatuses(statusMap);

      // Auto-copy incomplete tasks from previous month ONLY if viewing the current real month
      if (statusData.length === 0) {
        // Check if the month we're loading IS the current real month (not a future month)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const monthStartDate = new Date(monthStart);
        monthStartDate.setHours(0, 0, 0, 0);
        const monthEndDate = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
        monthEndDate.setHours(23, 59, 59, 999);
        
        const isCurrentRealMonth = today >= monthStartDate && today <= monthEndDate;
        
        // Only auto-copy if this is the current real month (not browsing future months)
        if (isCurrentRealMonth) {
          // This month has no tasks yet - check if we should copy from previous month
          const prevMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
          const prevMonthDateStr = prevMonthStart.toISOString().split('T')[0];
          
          try {
            const prevMonthStatusResponse: any = await api.get(`/api/monthly-time/status/${prevMonthDateStr}`);
            const prevMonthStatusData = Array.isArray(prevMonthStatusResponse) ? prevMonthStatusResponse : (prevMonthStatusResponse.data || []);
            
            if (Array.isArray(prevMonthStatusData) && prevMonthStatusData.length > 0) {
              // Copy tasks that were NOT completed and NOT NA in previous month
              const tasksToCopy = prevMonthStatusData.filter((status: any) => 
                !status.is_completed && !status.is_na
              );
              
              if (tasksToCopy.length > 0) {
                // Create status entries for this month for all incomplete tasks
                for (const prevStatus of tasksToCopy) {
                  try {
                    await api.post(`/api/monthly-time/status/${prevStatus.task_id}/${dateStr}`, {
                      is_completed: false,
                      is_na: false
                    });
                  } catch (err) {
                    console.error(`Error copying task ${prevStatus.task_id} to new month:`, err);
                  }
                }
                
                // Reload statuses after copying
                const newStatusResponse: any = await api.get(`/api/monthly-time/status/${dateStr}`);
                const newStatusData = Array.isArray(newStatusResponse) ? newStatusResponse : (newStatusResponse.data || []);
                const newStatusMap: Record<number, {is_completed: boolean, is_na: boolean}> = {};
                
                if (Array.isArray(newStatusData)) {
                  newStatusData.forEach((status: any) => {
                    newStatusMap[status.task_id] = {
                      is_completed: status.is_completed,
                      is_na: status.is_na
                    };
                  });
                }
                
                setMonthlyTaskStatuses(newStatusMap);
              }
            }
          } catch (err) {
            console.error('Error checking/copying tasks from previous month:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error loading monthly entries:', err);
      setMonthlyEntries({});
      setMonthlyDailyAggregates({});
      setMonthlyTaskStatuses({});
    }
  };

  // Save monthly entries to backend (debounced)
  const saveMonthlyEntries = async () => {
    try {
      const dateStr = selectedMonthStart.toISOString().split('T')[0];
      
      // Convert monthlyEntries map to array format
      const entries = Object.entries(monthlyEntries)
        .filter(([_, minutes]) => minutes > 0)
        .map(([key, minutes]) => {
          const [task_id, day_of_month] = key.split('-').map(Number);
          return { task_id, day_of_month, minutes };
        });

      if (entries.length > 0) {
        await api.post('/api/monthly-time/entries/bulk/', {
          month_start_date: dateStr,
          entries: entries
        });
      }
    } catch (err) {
      console.error('Error saving monthly entries:', err);
    }
  };

  // Handle monthly time entry change with auto-save
  const handleMonthlyTimeChange = (taskId: number, dayOfMonth: number, value: string) => {
    // For empty string, set to 0; otherwise parse the number
    const numericValue = value === '' ? 0 : parseInt(value, 10);
    // If parsing fails (NaN), keep as 0
    const finalValue = isNaN(numericValue) ? 0 : numericValue;
    
    const key = `${taskId}-${dayOfMonth}`;
    
    setMonthlyEntries(prev => ({
      ...prev,
      [key]: finalValue
    }));
    
    // Debounced auto-save - wait 1 second after last input
    if (monthlySaveTimeout) {
      window.clearTimeout(monthlySaveTimeout);
    }
    
    const timeout = window.setTimeout(() => {
      saveMonthlyEntries();
    }, 1000);
    
    setMonthlySaveTimeout(timeout);
  };

  // Get monthly time entry for a task and day
  const getMonthlyTime = (taskId: number, dayOfMonth: number): number => {
    const key = `${taskId}-${dayOfMonth}`;
    // If there's a monthly entry, use it; otherwise use daily aggregate
    if (monthlyEntries[key] !== undefined) {
      return monthlyEntries[key];
    }
    return monthlyDailyAggregates[key] || 0;
  };

  // Handle monthly task complete
  const handleMonthlyTaskComplete = async (taskId: number) => {
    try {
      const dateStr = selectedMonthStart.toISOString().split('T')[0];
      await api.post(`/api/monthly-time/status/${taskId}/complete?month_start_date=${dateStr}`, {});
      await loadMonthlyEntries(selectedMonthStart);
    } catch (err: any) {
      console.error('Error updating monthly task status:', err);
      alert('Failed to update task status: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Handle monthly task NA
  const handleMonthlyTaskNA = async (taskId: number) => {
    try {
      const dateStr = selectedMonthStart.toISOString().split('T')[0];
      await api.post(`/api/monthly-time/status/${taskId}/na?month_start_date=${dateStr}`, {});
      await loadMonthlyEntries(selectedMonthStart);
    } catch (err: any) {
      console.error('Error updating monthly task status:', err);
      alert('Failed to update task status: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Handle add monthly task
  const handleAddMonthlyTask = async () => {
    if (!selectedDailyTaskForMonthly) {
      setIsCreatingNewTask(true);
      setAddToTrackingAfterCreate('monthly');
      setIsTaskFormOpen(true);
      setShowAddMonthlyTaskModal(false);
      return;
    }

    try {
      const task = tasks.find(t => t.id === selectedDailyTaskForMonthly);
      if (!task) return;

      // Create a monthly status entry to mark this task for tracking this month
      const monthStart = selectedMonthStart.toISOString().split('T')[0];
      await api.post(`/api/monthly-time/status/${selectedDailyTaskForMonthly}/${monthStart}`, {
        is_completed: false,
        is_na: false
      });

      // Reload tasks and monthly entries
      await loadTasks();
      await loadMonthlyEntries(selectedMonthStart);
      setShowAddMonthlyTaskModal(false);
      setSelectedDailyTaskForMonthly(null);
    } catch (err: any) {
      console.error('Error adding monthly task:', err);
      alert('Failed to add monthly task: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Change selected month
  const changeMonth = (months: number) => {
    const newDate = new Date(selectedMonthStart);
    newDate.setMonth(newDate.getMonth() + months);
    setSelectedMonthStart(newDate);
    loadMonthlyEntries(newDate);
  };

  // Go to current month
  const goToCurrentMonth = () => {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    setSelectedMonthStart(currentMonth);
    loadMonthlyEntries(currentMonth);
  };

  // ============= YEARLY TAB FUNCTIONS =============
  
  // Load yearly time entries and aggregates
  const loadYearlyEntries = async (yearStart: Date) => {
    try {
      const dateStr = yearStart.toISOString().split('T')[0];
      
      // Load yearly entries
      const response: any = await api.get(`/api/yearly-time/entries/${dateStr}`);
      let entries = Array.isArray(response) ? response : (response.data || []);
      
      // Convert array to map: key = "taskId-month", value = minutes
      const entriesMap: Record<string, number> = {};
      if (Array.isArray(entries)) {
        entries.forEach((entry: any) => {
          const key = `${entry.task_id}-${entry.month}`;
          entriesMap[key] = entry.minutes;
        });
      }
      
      setYearlyEntries(entriesMap);

      // Load aggregates from all tabs (daily, weekly, monthly) for the year
      const aggregatesResponse: any = await api.get(`/api/yearly-time/aggregates/${dateStr}`);
      
      // Convert aggregates to same format: "taskId-month"
      const aggregatesMap: Record<string, number> = {};
      const aggregatesData = aggregatesResponse.data || aggregatesResponse;
      
      if (aggregatesData && typeof aggregatesData === 'object') {
        Object.entries(aggregatesData).forEach(([taskId, monthData]: [string, any]) => {
          if (monthData && typeof monthData === 'object') {
            Object.entries(monthData).forEach(([month, minutes]: [string, any]) => {
              const key = `${taskId}-${month}`;
              aggregatesMap[key] = minutes;
            });
          }
        });
      }
      
      setYearlyMonthlyAggregates({...aggregatesMap});

      // Load yearly task statuses
      const statusResponse: any = await api.get(`/api/yearly-time/status/${dateStr}`);
      
      const statusData = Array.isArray(statusResponse) ? statusResponse : (statusResponse.data || []);
      const statusMap: Record<number, {is_completed: boolean, is_na: boolean}> = {};
      
      if (Array.isArray(statusData)) {
        statusData.forEach((status: any) => {
          statusMap[status.task_id] = {
            is_completed: status.is_completed || false,
            is_na: status.is_na || false
          };
        });
      }
      
      setYearlyTaskStatuses(statusMap);
    } catch (err: any) {
      console.error('Error loading yearly entries:', err);
      // Initialize empty states on error
      setYearlyEntries({});
      setYearlyMonthlyAggregates({});
      setYearlyTaskStatuses({});
    }
  };

  // Save yearly entries with debounce
  const saveYearlyEntries = async () => {
    try {
      const dateStr = selectedYearStart.toISOString().split('T')[0];
      const entries = Object.entries(yearlyEntries).map(([key, minutes]) => {
        const [taskId, month] = key.split('-').map(Number);
        return {
          task_id: taskId,
          year_start_date: dateStr,
          month: month,
          minutes: minutes
        };
      });
      
      await api.post(`/api/yearly-time/entries/bulk`, { entries });
    } catch (err: any) {
      console.error('Error saving yearly entries:', err);
      alert('Failed to save yearly entries: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Get yearly time for a task and month
  const getYearlyTime = (taskId: number, month: number): number => {
    const key = `${taskId}-${month}`;
    // Check yearly entries first, then monthly aggregates
    return yearlyEntries[key] || yearlyMonthlyAggregates[key] || 0;
  };

  // Handle yearly time input change
  const handleYearlyTimeChange = (taskId: number, month: number, value: string) => {
    const key = `${taskId}-${month}`;
    
    // Parse the value based on task type
    const task = tasks.find(t => t.id === taskId);
    let numericValue: number;
    
    if (task?.task_type === TaskType.BOOLEAN) {
      numericValue = value === '1' ? 1 : 0;
    } else {
      numericValue = value === '' ? 0 : parseInt(value, 10);
      numericValue = isNaN(numericValue) ? 0 : numericValue;
    }
    
    setYearlyEntries(prev => ({
      ...prev,
      [key]: numericValue
    }));
    
    // Debounced save
    if (yearlySaveTimeout) {
      clearTimeout(yearlySaveTimeout);
    }
    
    const timeout = window.setTimeout(() => {
      saveYearlyEntries();
    }, 1000);
    
    setYearlySaveTimeout(timeout);
  };

  // Handle yearly task status change
  const handleYearlyStatusChange = async (taskId: number, isCompleted: boolean, isNA: boolean) => {
    try {
      const dateStr = selectedYearStart.toISOString().split('T')[0];
      await api.post(`/api/yearly-time/status/${taskId}/${dateStr}`, {
        is_completed: isCompleted,
        is_na: isNA
      });
      
      setYearlyTaskStatuses(prev => ({
        ...prev,
        [taskId]: { is_completed: isCompleted, is_na: isNA }
      }));
      
      await loadTasks();
    } catch (err: any) {
      console.error('Error updating yearly status:', err);
      alert('Failed to update status: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Handle add yearly task
  const handleAddYearlyTask = async () => {
    if (!selectedDailyTaskForYearly) {
      setIsCreatingNewTask(true);
      setAddToTrackingAfterCreate('yearly' as any);
      setIsTaskFormOpen(true);
      setShowAddYearlyTaskModal(false);
      return;
    }

    try {
      const task = tasks.find(t => t.id === selectedDailyTaskForYearly);
      if (!task) return;

      // Create a yearly status entry to mark this task for tracking this year
      const yearStart = selectedYearStart.toISOString().split('T')[0];
      await api.post(`/api/yearly-time/status/${selectedDailyTaskForYearly}/${yearStart}`, {
        is_completed: false,
        is_na: false
      });

      // Reload tasks and yearly entries
      await loadTasks();
      await loadYearlyEntries(selectedYearStart);
      setShowAddYearlyTaskModal(false);
      setSelectedDailyTaskForYearly(null);
    } catch (err: any) {
      console.error('Error adding yearly task:', err);
      alert('Failed to add yearly task: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Change selected year
  const changeYear = (years: number) => {
    const newDate = new Date(selectedYearStart);
    newDate.setFullYear(newDate.getFullYear() + years);
    setSelectedYearStart(newDate);
    loadYearlyEntries(newDate);
  };

  // Go to current year
  const goToCurrentYear = () => {
    const today = new Date();
    const currentYear = new Date(today.getFullYear(), 0, 1);
    setSelectedYearStart(currentYear);
    loadYearlyEntries(currentYear);
  };

  // One-Time Tasks Functions
  const loadOneTimeTasks = async () => {
    try {
      const response: any = await api.get('/api/one-time-tasks/');
      const data = response.data || response;
      setOneTimeTasks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error loading one-time tasks:', err);
      setOneTimeTasks([]);
    }
  };

  const handleAddOneTimeTask = async () => {
    if (!selectedTaskForOneTime) {
      setIsCreatingNewTask(true);
      setAddToTrackingAfterCreate('onetime' as any);
      setIsTaskFormOpen(true);
      setShowAddOneTimeTaskModal(false);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      await api.post('/api/one-time-tasks/', {
        task_id: selectedTaskForOneTime,
        start_date: today,
        target_gap: null,
        updated_date: null
      });

      await loadTasks();
      await loadOneTimeTasks();
      setShowAddOneTimeTaskModal(false);
      setSelectedTaskForOneTime(null);
    } catch (err: any) {
      console.error('Error adding one-time task:', err);
      alert('Failed to add one-time task: ' + (err.response?.data?.detail || err.message));
    }
  };

  const updateOneTimeTask = async (taskId: number, updates: Partial<OneTimeTaskData>) => {
    try {
      await api.put(`/api/one-time-tasks/${taskId}`, updates);
      await loadOneTimeTasks();
      if (activeTab === 'today') {
        loadOverdueOneTimeTasks();
      }
    } catch (err: any) {
      console.error('Error updating one-time task:', err);
      alert('Failed to update task: ' + (err.response?.data?.detail || err.message));
    }
  };

  const deleteOneTimeTask = async (taskId: number) => {
    try {
      await api.delete(`/api/one-time-tasks/${taskId}`);
      await loadOneTimeTasks();
      if (activeTab === 'today') {
        loadOverdueOneTimeTasks();
      }
    } catch (err: any) {
      console.error('Error deleting one-time task:', err);
      alert('Failed to delete task: ' + (err.response?.data?.detail || err.message));
    }
  };

  const calculateDaysOver = (updatedDate: string | null): number => {
    if (!updatedDate) return 0;
    const today = new Date();
    const updated = new Date(updatedDate);
    const diffTime = today.getTime() - updated.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getOneTimeRowColorClass = (targetGap: number | null, daysOver: number): string => {
    if (!targetGap) return '';
    
    if (daysOver > targetGap) {
      return 'row-overdue'; // Red
    } else if (daysOver >= targetGap - 7 && daysOver <= targetGap) {
      return 'row-warning'; // Gray
    } else {
      return 'row-good'; // Green
    }
  };

  // Projects Functions
  const loadProjects = async () => {
    try {
      const response: any = await api.get('/api/projects/');
      const data = response.data || response;
      const projectsList = Array.isArray(data) ? data : [];
      console.log('Loaded projects from API:', projectsList.map(p => ({ id: p.id, name: p.name })));
      setProjects(projectsList);
      
      // Load all project tasks to check for overdue status
      if (projectsList.length > 0) {
        const allTasks: ProjectTaskData[] = [];
        for (const project of projectsList) {
          try {
            const tasksResponse: any = await api.get(`/api/projects/${project.id}/tasks`);
            const tasks = tasksResponse.data || tasksResponse;
            if (Array.isArray(tasks)) {
              allTasks.push(...tasks);
            }
          } catch (err) {
            console.error(`Error loading tasks for project ${project.id}:`, err);
          }
        }
        setProjectTasks(allTasks);
      }
    } catch (err: any) {
      console.error('Error loading projects:', err);
      setProjects([]);
    }
  };

  const loadProjectTasksDueToday = async () => {
    try {
      // Load both tasks due today AND overdue tasks
      const [todayResponse, overdueResponse]: any[] = await Promise.all([
        api.get('/api/projects/tasks/due-today'),
        api.get('/api/projects/tasks/overdue')
      ]);
      
      const todayTasks = Array.isArray(todayResponse.data || todayResponse) ? (todayResponse.data || todayResponse) : [];
      const overdueTasks = Array.isArray(overdueResponse.data || overdueResponse) ? (overdueResponse.data || overdueResponse) : [];
      
      // Combine and remove duplicates (in case a task is both due today and overdue)
      const allTasks = [...overdueTasks, ...todayTasks];
      const uniqueTasks = allTasks.filter((task, index, self) => 
        index === self.findIndex(t => t.id === task.id)
      );
      
      setProjectTasksDueToday(uniqueTasks);
    } catch (err: any) {
      console.error('Error loading project tasks due today:', err);
      setProjectTasksDueToday([]);
    }
  };

  const loadGoalTasksDueToday = async () => {
    try {
      // Load both goal tasks due today AND overdue goal tasks
      const [todayResponse, overdueResponse]: any[] = await Promise.all([
        api.get('/api/life-goals/goal-tasks/due-today'),
        api.get('/api/life-goals/goal-tasks/overdue')
      ]);
      
      const todayTasks = Array.isArray(todayResponse.data || todayResponse) ? (todayResponse.data || todayResponse) : [];
      const overdueTasks = Array.isArray(overdueResponse.data || overdueResponse) ? (overdueResponse.data || overdueResponse) : [];
      
      // Combine and remove duplicates
      const allTasks = [...overdueTasks, ...todayTasks];
      const uniqueTasks = allTasks.filter((task, index, self) => 
        index === self.findIndex(t => t.id === task.id)
      );
      
      setGoalTasksDueToday(uniqueTasks);
    } catch (err: any) {
      console.error('Error loading goal tasks due today:', err);
      setGoalTasksDueToday([]);
    }
  };

  const loadOverdueOneTimeTasks = () => {
    try {
      // Filter one-time tasks that are overdue (red)
      const overdue = oneTimeTasks.filter(oneTimeTask => {
        const daysOver = calculateDaysOver(oneTimeTask.updated_date);
        const rowClass = getOneTimeRowColorClass(oneTimeTask.target_gap, daysOver);
        return rowClass === 'row-overdue'; // Only red/overdue tasks
      }).map(oneTimeTask => {
        const task = tasks.find(t => t.id === oneTimeTask.task_id);
        return {
          ...oneTimeTask,
          task_name: task?.name || 'Unknown Task'
        };
      });
      
      setOverdueOneTimeTasks(overdue);
    } catch (err: any) {
      console.error('Error loading overdue one-time tasks:', err);
      setOverdueOneTimeTasks([]);
    }
  };

  const loadProjectTasks = async (projectId: number) => {
    try {
      const response: any = await api.get(`/api/projects/${projectId}/tasks`);
      const data = response.data || response;
      
      // Keep all existing tasks but update/add tasks for this project
      setProjectTasks(prevTasks => {
        const otherProjectTasks = prevTasks.filter(t => t.project_id !== projectId);
        const newTasks = Array.isArray(data) ? data : [];
        return [...otherProjectTasks, ...newTasks];
      });
    } catch (err: any) {
      console.error('Error loading project tasks:', err);
    }
  };

  const handleSelectProject = async (project: ProjectData) => {
    console.log('handleSelectProject called with:', { id: project.id, name: project.name });
    console.log('Call stack:', new Error().stack);
    setSelectedProject(project);
    await loadProjectTasks(project.id);
    console.log('Project selected and tasks loaded for:', project.name);
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    // Don't clear projectTasks - keep them for overdue status checking
    setExpandedTasks(new Set());
  };

  const toggleTaskExpansion = (taskId: number) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const getTasksByParentId = (parentId: number | null): ProjectTaskData[] => {
    if (!selectedProject) return [];
    return projectTasks.filter(t => 
      t.project_id === selectedProject.id && t.parent_task_id === parentId
    );
  };

  const getDueDateColorClass = (dueDate: string | null): string => {
    if (!dueDate) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'task-overdue'; // Red - overdue
    } else if (diffDays <= 2) {
      return 'task-urgent'; // Red - 0-2 days
    } else if (diffDays <= 7) {
      return 'task-soon'; // Yellow - 3-7 days
    } else {
      return 'task-ok'; // Green - >7 days
    }
  };

  const hasOverdueTasks = (projectId: number): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if any incomplete task in this project is overdue
    return projectTasks.some(task => {
      if (task.project_id !== projectId || task.is_completed || !task.due_date) {
        return false;
      }
      const due = new Date(task.due_date);
      due.setHours(0, 0, 0, 0);
      return due < today;
    });
  };

  const getProjectCardClass = (project: ProjectData): string => {
    // For list view, we need to fetch tasks to check for overdue
    // We'll use a simpler approach: check if project is in_progress and has overdue target date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (project.status === 'in_progress' && project.target_completion_date) {
      const dueDate = new Date(project.target_completion_date);
      dueDate.setHours(0, 0, 0, 0);
      
      if (dueDate < today) {
        return 'project-overdue';
      }
    }
    
    return '';
  };

  const handleToggleTaskCompletion = async (taskId: number, currentStatus: boolean) => {
    try {
      await api.put(`/api/projects/tasks/${taskId}`, {
        is_completed: !currentStatus
      });
      
      // Refresh both projects list and tasks
      await loadProjects(); // This will reload all projects with updated status
      
      if (selectedProject) {
        await loadProjectTasks(selectedProject.id);
      }
    } catch (err: any) {
      console.error('Error toggling task completion:', err);
      alert('Failed to update task: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task and all its sub-tasks?')) {
      return;
    }

    try {
      await api.delete(`/api/projects/tasks/${taskId}`);
      if (selectedProject) {
        await loadProjectTasks(selectedProject.id);
        await loadProjects(); // Refresh to update progress
      }
    } catch (err: any) {
      console.error('Error deleting task:', err);
      alert('Failed to delete task: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEditTask = (task: ProjectTaskData) => {
    setEditingTask(task);
    setShowEditTaskModal(true);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      await api.put(`/api/projects/tasks/${editingTask.id}`, {
        name: editingTask.name,
        description: editingTask.description,
        due_date: editingTask.due_date,
        priority: editingTask.priority
      });
      
      setShowEditTaskModal(false);
      setEditingTask(null);
      
      // Refresh data
      await loadProjects();
      if (selectedProject) {
        await loadProjectTasks(selectedProject.id);
      }
      if (activeTab === 'today') {
        await loadProjectTasksDueToday();
      }
    } catch (err: any) {
      console.error('Error updating task:', err);
      alert('Failed to update task: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUpdateTaskDueDate = async (taskId: number, newDueDate: string) => {
    try {
      await api.put(`/api/projects/tasks/${taskId}`, {
        due_date: newDueDate
      });
      
      // Refresh data
      await loadProjects();
      if (selectedProject) {
        await loadProjectTasks(selectedProject.id);
      }
      if (activeTab === 'today') {
        await loadProjectTasksDueToday();
      }
    } catch (err: any) {
      console.error('Error updating task due date:', err);
      alert('Failed to update due date: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleToggleGoalTaskCompletion = async (taskId: number, isCompleted: boolean) => {
    try {
      await api.put(`/api/life-goals/tasks/${taskId}`, {
        is_completed: !isCompleted
      });
      
      // Refresh goal tasks
      await loadGoalTasksDueToday();
    } catch (err: any) {
      console.error('Error toggling goal task completion:', err);
      alert('Failed to update goal task: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUpdateGoalTaskDueDate = async (taskId: number, newDueDate: string) => {
    try {
      await api.put(`/api/life-goals/tasks/${taskId}`, {
        due_date: newDueDate
      });
      
      // Refresh goal tasks
      await loadGoalTasksDueToday();
    } catch (err: any) {
      console.error('Error updating goal task due date:', err);
      alert('Failed to update due date: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (!confirm('Are you sure you want to delete this project and all its tasks?')) {
      return;
    }

    try {
      await api.delete(`/api/projects/${projectId}`);
      await loadProjects();
      setSelectedProject(null);
      setProjectTasks([]);
    } catch (err: any) {
      console.error('Error deleting project:', err);
      alert('Failed to delete project: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Life Goals functions
  const loadLifeGoals = async () => {
    try {
      const response = await api.get('/api/life-goals/');
      setLifeGoals(response.data);
    } catch (error) {
      console.error('Error loading life goals:', error);
    }
  };

  const loadGoalDetails = async (goalId: number) => {
    try {
      const [goalResponse, milestonesResponse, tasksResponse, linkedTasksResponse] = await Promise.all([
        api.get(`/api/life-goals/${goalId}`),
        api.get(`/api/life-goals/${goalId}/milestones`),
        api.get(`/api/life-goals/${goalId}/tasks`),
        api.get(`/api/life-goals/${goalId}/linked-tasks`)
      ]);
      setSelectedGoal(goalResponse.data);
      setGoalMilestones(milestonesResponse.data);
      setGoalTasks(tasksResponse.data);
      setLinkedTasks(linkedTasksResponse.data);
    } catch (error) {
      console.error('Error loading goal details:', error);
    }
  };

  const handleCreateLifeGoal = async (goalData: any) => {
    try {
      await api.post('/api/life-goals/', goalData);
      await loadLifeGoals();
      setShowAddGoalModal(false);
    } catch (error) {
      console.error('Error creating life goal:', error);
      alert('Failed to create goal');
    }
  };

  const handleUpdateLifeGoal = async (goalId: number, updates: any) => {
    try {
      await api.put(`/api/life-goals/${goalId}`, updates);
      await loadLifeGoals();
      if (selectedGoal?.id === goalId) {
        await loadGoalDetails(goalId);
      }
    } catch (error) {
      console.error('Error updating life goal:', error);
      alert('Failed to update goal');
    }
  };

  const handleDeleteLifeGoal = async (goalId: number) => {
    if (!window.confirm('Are you sure you want to delete this goal? This will also delete all its sub-goals, milestones, and tasks.')) {
      return;
    }
    try {
      await api.delete(`/api/life-goals/${goalId}`);
      await loadLifeGoals();
      if (selectedGoal?.id === goalId) {
        setSelectedGoal(null);
      }
    } catch (error) {
      console.error('Error deleting life goal:', error);
      alert('Failed to delete goal');
    }
  };

  const handleCreateMilestone = async (goalId: number, milestoneData: any) => {
    try {
      await api.post(`/api/life-goals/${goalId}/milestones`, milestoneData);
      await loadGoalDetails(goalId);
      setShowAddMilestoneModal(false);
    } catch (error) {
      console.error('Error creating milestone:', error);
      alert('Failed to create milestone');
    }
  };

  const handleToggleMilestone = async (milestoneId: number, isCompleted: boolean) => {
    try {
      await api.put(`/api/life-goals/milestones/${milestoneId}`, { is_completed: isCompleted });
      if (selectedGoal) {
        await loadGoalDetails(selectedGoal.id);
      }
    } catch (error) {
      console.error('Error toggling milestone:', error);
      alert('Failed to update milestone');
    }
  };

  const handleDeleteMilestone = async (milestoneId: number) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) {
      return;
    }
    try {
      await api.delete(`/api/life-goals/milestones/${milestoneId}`);
      if (selectedGoal) {
        await loadGoalDetails(selectedGoal.id);
      }
    } catch (error) {
      console.error('Error deleting milestone:', error);
      alert('Failed to delete milestone');
    }
  };

  const handleLinkTask = async (goalId: number, taskId: number, taskType: string, timeAllocated?: number, notes?: string) => {
    try {
      await api.post(`/api/life-goals/${goalId}/link-task`, {
        task_id: taskId,
        task_type: taskType,
        time_allocated_hours: timeAllocated,
        notes: notes
      });
      await loadGoalDetails(goalId);
      setShowLinkTaskModal(false);
    } catch (error) {
      console.error('Error linking task:', error);
      alert('Failed to link task');
    }
  };

  const handleUnlinkTask = async (linkId: number) => {
    if (!window.confirm('Are you sure you want to unlink this task?')) {
      return;
    }
    try {
      await api.delete(`/api/life-goals/task-links/${linkId}`);
      if (selectedGoal) {
        await loadGoalDetails(selectedGoal.id);
      }
    } catch (error) {
      console.error('Error unlinking task:', error);
      alert('Failed to unlink task');
    }
  };

  const handleCreateGoalTask = async (goalId: number, taskData: any) => {
    try {
      await api.post(`/api/life-goals/${goalId}/tasks`, taskData);
      await loadGoalDetails(goalId);
      setShowAddGoalTaskModal(false);
    } catch (error) {
      console.error('Error creating goal task:', error);
      alert('Failed to create task');
    }
  };

  const handleUpdateGoalTask = async (taskId: number, updates: any) => {
    try {
      await api.put(`/api/life-goals/tasks/${taskId}`, updates);
      if (selectedGoal) {
        await loadGoalDetails(selectedGoal.id);
      }
    } catch (error) {
      console.error('Error updating goal task:', error);
      alert('Failed to update task');
    }
  };

  const handleDeleteGoalTask = async (taskId: number) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }
    try {
      await api.delete(`/api/life-goals/tasks/${taskId}`);
      if (selectedGoal) {
        await loadGoalDetails(selectedGoal.id);
      }
    } catch (error) {
      console.error('Error deleting goal task:', error);
      alert('Failed to delete task');
    }
  };

  const handleBackToGoals = () => {
    setSelectedGoal(null);
    setGoalMilestones([]);
    setGoalTasks([]);
    setLinkedTasks([]);
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
      
      // Debounced auto-save - wait 500ms after last input
      if (saveTimeout) {
        window.clearTimeout(saveTimeout);
      }
      
      const timeout = window.setTimeout(() => {
        saveDailyEntriesWithData(newEntries);
      }, 500);
      
      setSaveTimeout(timeout);
      
      return newEntries;
    });
  };

  // Handle blur event - save immediately when input loses focus
  const handleHourlyTimeBlur = () => {
    if (saveTimeout) {
      window.clearTimeout(saveTimeout);
      setSaveTimeout(null);
    }
    saveDailyEntriesWithData(hourlyEntries);
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
    
    // Calculate expected target based on task type, follow-up frequency, and days elapsed
    let expectedTarget = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        // Daily habits: target per day * days elapsed (e.g., 20 push-ups per day)
        expectedTarget = (task.target_value || 0) * daysElapsed;
      } else {
        // Weekly/Monthly tasks: target for entire period * (days elapsed / 7)
        // This allows flexibility: complete target anytime during the week
        expectedTarget = (task.target_value || 0) * (daysElapsed / 7);
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      // For boolean tasks: 1 per day * days elapsed (should be done each day)
      expectedTarget = daysElapsed;
    } else {
      // TIME tasks
      if (task.follow_up_frequency === 'daily') {
        // Daily habits: allocated minutes per day * days elapsed (e.g., 45 min meditation per day)
        expectedTarget = task.allocated_minutes * daysElapsed;
      } else {
        // Weekly/Monthly tasks: allocated minutes for entire period * (days elapsed / 7)
        // This allows flexibility: allocate time anytime during the week
        expectedTarget = task.allocated_minutes * (daysElapsed / 7);
      }
    }
    
    // Return color class based on comparison
    if (totalSpent >= expectedTarget) {
      return 'weekly-on-track'; // Green - meeting or exceeding target
    } else if (totalSpent > 0) {
      return 'weekly-below-target'; // Light red - below target but has some progress
    }
    return ''; // No color if no progress yet
  };

  const getMonthlyRowColorClass = (task: Task): string => {
    if (activeTab !== 'monthly') return '';
    
    // Calculate total spent/count in the month so far
    const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
    let totalSpent = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      totalSpent += getMonthlyTime(task.id, day);
    }
    
    // Determine how many days have elapsed in the current month (including today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(selectedMonthStart);
    monthStart.setHours(0, 0, 0, 0);
    
    // Calculate days elapsed: if today is within this month, count up to today; otherwise use full month
    let daysElapsed = daysInMonth; // Default to full month
    if (today >= monthStart) {
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      monthEnd.setHours(0, 0, 0, 0);
      
      if (today <= monthEnd) {
        // Current month: count days from month start to today (inclusive)
        const diffTime = today.getTime() - monthStart.getTime();
        daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    
    // Calculate expected target based on task type, follow-up frequency, and days elapsed
    let expectedTarget = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        // Daily habits: target per day * days elapsed (e.g., 20 push-ups per day)
        expectedTarget = (task.target_value || 0) * daysElapsed;
      } else {
        // Weekly/Monthly tasks: target for entire period * (days elapsed / days in month)
        // This allows flexibility: complete target anytime during the month
        expectedTarget = (task.target_value || 0) * (daysElapsed / daysInMonth);
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      // For boolean tasks: 1 per day * days elapsed (should be done each day)
      expectedTarget = daysElapsed;
    } else {
      // TIME tasks
      if (task.follow_up_frequency === 'daily') {
        // Daily habits: allocated minutes per day * days elapsed (e.g., 45 min meditation per day)
        expectedTarget = task.allocated_minutes * daysElapsed;
      } else {
        // Weekly/Monthly tasks: allocated minutes for entire period * (days elapsed / days in month)
        // This allows flexibility: allocate time anytime during the month
        expectedTarget = task.allocated_minutes * (daysElapsed / daysInMonth);
      }
    }
    
    // Return color class based on comparison
    if (totalSpent >= expectedTarget) {
      return 'weekly-on-track'; // Green - meeting or exceeding target (reuse weekly class)
    } else if (totalSpent > 0) {
      return 'weekly-below-target'; // Light red - below target but has some progress (reuse weekly class)
    }
    return ''; // No color if no progress yet
  };

  const getYearlyRowColorClass = (task: Task): string => {
    if (activeTab !== 'yearly') return '';
    
    // Calculate total spent/count in the year so far
    let totalSpent = 0;
    for (let month = 1; month <= 12; month++) {
      totalSpent += getYearlyTime(task.id, month);
    }
    
    // Determine how many months have elapsed in the current year (including this month)
    const today = new Date();
    const yearStart = new Date(selectedYearStart);
    yearStart.setHours(0, 0, 0, 0);
    
    // Calculate months elapsed: if today is within this year, count up to this month; otherwise use full 12 months
    let monthsElapsed = 12; // Default to full year
    if (today.getFullYear() === yearStart.getFullYear()) {
      // Current year: count months from year start to today (inclusive)
      monthsElapsed = today.getMonth() + 1; // getMonth() returns 0-11, so add 1
    } else if (today.getFullYear() < yearStart.getFullYear()) {
      // Future year: no months elapsed yet
      monthsElapsed = 0;
    }
    
    // Calculate expected target based on task type, follow-up frequency, and months elapsed
    let expectedTarget = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        // Daily habits: target per day * days elapsed (estimate 30 days per month)
        expectedTarget = (task.target_value || 0) * monthsElapsed * 30;
      } else if (task.follow_up_frequency === 'weekly') {
        // Weekly tasks: target per week * weeks elapsed (estimate 4 weeks per month)
        expectedTarget = (task.target_value || 0) * monthsElapsed * 4;
      } else if (task.follow_up_frequency === 'monthly') {
        // Monthly tasks: target per month * months elapsed
        expectedTarget = (task.target_value || 0) * monthsElapsed;
      } else {
        // Yearly tasks: target for entire year * (months elapsed / 12)
        expectedTarget = (task.target_value || 0) * (monthsElapsed / 12);
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      // For boolean tasks: depends on frequency
      if (task.follow_up_frequency === 'daily') {
        expectedTarget = monthsElapsed * 30; // ~30 days per month
      } else if (task.follow_up_frequency === 'weekly') {
        expectedTarget = monthsElapsed * 4; // ~4 weeks per month
      } else if (task.follow_up_frequency === 'monthly') {
        expectedTarget = monthsElapsed;
      } else {
        expectedTarget = monthsElapsed / 12; // Yearly tasks
      }
    } else {
      // TIME tasks
      if (task.follow_up_frequency === 'daily') {
        // Daily habits: allocated minutes per day * days elapsed
        expectedTarget = task.allocated_minutes * monthsElapsed * 30;
      } else if (task.follow_up_frequency === 'weekly') {
        // Weekly tasks: allocated minutes per week * weeks elapsed
        expectedTarget = task.allocated_minutes * monthsElapsed * 4;
      } else if (task.follow_up_frequency === 'monthly') {
        // Monthly tasks: allocated minutes per month * months elapsed
        expectedTarget = task.allocated_minutes * monthsElapsed;
      } else {
        // Yearly tasks: allocated minutes for entire year * (months elapsed / 12)
        expectedTarget = task.allocated_minutes * (monthsElapsed / 12);
      }
    }
    
    // Return color class based on comparison
    if (totalSpent >= expectedTarget) {
      return 'weekly-on-track'; // Green - meeting or exceeding target (reuse weekly class)
    } else if (totalSpent > 0) {
      return 'weekly-below-target'; // Light red - below target but has some progress (reuse weekly class)
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
      // Exclude one-time tasks from other tabs (they only appear in onetime tab)
      if (activeTab !== 'onetime' && task.follow_up_frequency === 'one_time') {
        return false;
      }
      
      // For weekly tab: ONLY show tasks that have data or status for this specific week
      if (activeTab === 'weekly') {
        // Check if this task has daily aggregates for the current week
        const hasDailyDataThisWeek = weekDays.some(day => {
          const key = `${task.id}-${day.index}`;
          return (dailyAggregates[key] || 0) > 0;
        });
        
        // Check if this task has weekly time entries for the current week
        const hasWeeklyDataThisWeek = weekDays.some(day => {
          const key = `${task.id}-${day.index}`;
          return (weeklyEntries[key] || 0) > 0;
        });
        
        // Check if task has been explicitly added to this week
        const hasBeenAddedToWeekly = weeklyTaskStatuses[task.id] !== undefined;
        
        // Show task ONLY if:
        // 1. It has data for this week (daily or weekly entries), OR
        // 2. It has been explicitly added to weekly tracking (has status entry for this week)
        if (task.follow_up_frequency === 'weekly') {
          // Weekly task - show ONLY if it has data or was explicitly added
          if (!hasWeeklyDataThisWeek && !hasDailyDataThisWeek && !hasBeenAddedToWeekly) {
            return false; // No data and not added - don't show
          }
        } else if (task.follow_up_frequency === 'daily') {
          // Daily task - show ONLY if it has data or was explicitly added
          if (!hasDailyDataThisWeek && !hasBeenAddedToWeekly) {
            return false; // No data and not added - don't show
          }
        } else {
          // Other frequencies - don't show in weekly tab
          return false;
        }
        
      } else if (activeTab === 'monthly') {
        // For monthly tab: ONLY show tasks that have been explicitly added to monthly tracking
        // Check if task has been explicitly added to this month
        const hasBeenAddedToMonthly = monthlyTaskStatuses[task.id] !== undefined;
        
        // Show task ONLY if it has been explicitly added to monthly tracking
        // Note: We show daily aggregates in the cells for daily tasks, but any task type can be tracked monthly
        if (!hasBeenAddedToMonthly) {
          return false; // Not explicitly added to monthly - don't show
        }
        
      } else if (activeTab === 'yearly') {
        // For yearly tab: ONLY show tasks that have been explicitly added to yearly tracking
        // Check if task has been explicitly added to this year
        const hasBeenAddedToYearly = yearlyTaskStatuses[task.id] !== undefined;
        
        // Show task ONLY if it has been explicitly added to yearly tracking
        // Note: We show monthly aggregates in the cells for monthly/weekly/daily tasks, but any task type can be tracked yearly
        if (!hasBeenAddedToYearly) {
          return false; // Not explicitly added to yearly - don't show
        }
        
      } else {
        // For non-weekly tabs, normal frequency filter
        if (task.follow_up_frequency !== activeTab) return false;
      }
      
      // For weekly tab: Handle weekly-specific completion status
      if (activeTab === 'weekly') {
        const taskStatus = weeklyTaskStatuses[task.id];
        
        // If task is marked completed/NA for THIS week, show it
        if (taskStatus && (taskStatus.is_completed || taskStatus.is_na)) {
          return true;
        }
        
        // Don't filter out based on "ever completed" since weekly status is independent
        // This allows the same task to be tracked in multiple weeks
        
        // Only filter out if the task itself is globally completed/NA (from daily or other tabs)
        // But since we removed that from weekly handlers, this should rarely happen
        if (task.is_completed || !task.is_active) {
          // Only hide if it's a weekly task (not a daily task showing in weekly view)
          if (task.follow_up_frequency === 'weekly') {
            return false;
          }
        }
        
        return true;
      }
      
      // For monthly tab: Handle monthly-specific completion status
      if (activeTab === 'monthly') {
        const taskStatus = monthlyTaskStatuses[task.id];
        
        // If task is marked completed/NA for THIS month, show it
        if (taskStatus && (taskStatus.is_completed || taskStatus.is_na)) {
          return true;
        }
        
        // Don't filter out based on "ever completed" since monthly status is independent
        // This allows the same task to be tracked in multiple months
        
        // Only filter out if the task itself is globally completed/NA (from daily or other tabs)
        if (task.is_completed || !task.is_active) {
          return false;
        }
        
        return true;
      }
      
      // For yearly tab: Handle yearly-specific completion status
      if (activeTab === 'yearly') {
        const taskStatus = yearlyTaskStatuses[task.id];
        
        // If task is marked completed/NA for THIS year, show it
        if (taskStatus && (taskStatus.is_completed || taskStatus.is_na)) {
          return true;
        }
        
        // Don't filter out based on "ever completed" since yearly status is independent
        // This allows the same task to be tracked in multiple years
        
        // Only filter out if the task itself is globally completed/NA (from daily or other tabs)
        if (task.is_completed || !task.is_active) {
          return false;
        }
        
        return true;
      }
      
      // For other tabs (daily, etc.): If task is completed, only show if completed today
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
    { key: 'yearly', label: 'Yearly' },
    { key: 'onetime', label: 'One Time Tasks' },
    { key: 'projects', label: 'Projects' }
  ];

  // TaskNode component for hierarchical display
  const TaskNode = ({ 
    task, 
    level, 
    allTasks, 
    expandedTasks, 
    onToggleExpand, 
    onToggleComplete, 
    onDelete,
    onEdit,
    onUpdateDueDate,
    getDueDateColorClass,
    getTasksByParentId 
  }: { 
    task: ProjectTaskData; 
    level: number; 
    allTasks: ProjectTaskData[];
    expandedTasks: Set<number>;
    onToggleExpand: (taskId: number) => void;
    onToggleComplete: (taskId: number, currentStatus: boolean) => void;
    onDelete: (taskId: number) => void;
    onEdit: (task: ProjectTaskData) => void;
    onUpdateDueDate: (taskId: number, newDueDate: string) => void;
    getDueDateColorClass: (dueDate: string | null) => string;
    getTasksByParentId: (parentId: number | null) => ProjectTaskData[];
  }) => {
    const subTasks = getTasksByParentId(task.id);
    const hasSubTasks = subTasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);
    const dueDateClass = getDueDateColorClass(task.due_date);

    return (
      <div className={`task-node level-${level}`} style={{ marginLeft: `${level * 20}px` }}>
        <div className={`task-row ${dueDateClass} ${task.is_completed ? 'completed' : ''}`}>
          <div className="task-checkbox">
            <input
              type="checkbox"
              checked={task.is_completed}
              onChange={() => onToggleComplete(task.id, task.is_completed)}
            />
          </div>
          
          <div className="task-expand">
            {hasSubTasks && (
              <button 
                className="btn-expand"
                onClick={() => onToggleExpand(task.id)}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
          </div>
          
          <div className="task-content">
            <span 
              className={`task-name ${task.is_completed ? 'strikethrough' : ''}`}
              onClick={() => onEdit(task)}
              style={{ 
                cursor: 'pointer', 
                textDecoration: task.is_completed ? 'line-through' : 'underline',
                color: '#3182ce'
              }}
              title="Click to edit task"
            >
              {task.name}
            </span>
            {task.description && (
              <span className="task-description">{task.description}</span>
            )}
          </div>
          
          {task.due_date && (
            <div className="task-due-date">
              📅 <input 
                type="date"
                value={task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''}
                onChange={(e) => onUpdateDueDate(task.id, e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: '3px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f7fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                title="Click to change due date"
              />
            </div>
          )}
          
          <div className={`task-priority priority-${task.priority}`}>
            {task.priority}
          </div>
          
          <div className="task-actions">
            <button 
              className="btn btn-sm btn-primary"
              onClick={() => onEdit(task)}
              style={{ marginRight: '8px' }}
            >
              Edit
            </button>
            <button 
              className="btn btn-sm btn-danger"
              onClick={() => onDelete(task.id)}
            >
              Delete
            </button>
          </div>
        </div>
        
        {hasSubTasks && isExpanded && (
          <div className="task-children">
            {subTasks.map(subTask => (
              <TaskNode
                key={subTask.id}
                task={subTask}
                level={level + 1}
                allTasks={allTasks}
                expandedTasks={expandedTasks}
                onToggleExpand={onToggleExpand}
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                onEdit={onEdit}
                onUpdateDueDate={onUpdateDueDate}
                getDueDateColorClass={getDueDateColorClass}
                getTasksByParentId={getTasksByParentId}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

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
            onClick={() => {
              setActiveTab(tab.key);
              // Force reload data when switching tabs
              if (tab.key === 'weekly') {
                loadWeeklyEntries(selectedWeekStart);
              } else if (tab.key === 'monthly') {
                loadMonthlyEntries(selectedMonthStart);
              }
            }}
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

      {/* Month Navigator for Monthly Tab */}
      {activeTab === 'monthly' && (
        <div className="date-navigator">
          <button className="btn-nav" onClick={() => changeMonth(-1)}>
            ← Previous Month
          </button>
          <button className="btn-nav" onClick={() => changeMonth(1)}>
            Next Month →
          </button>
          <button className="btn-nav btn-today" onClick={goToCurrentMonth}>
            📅 Current Month
          </button>
          <button 
            className="btn-nav btn-add-monthly" 
            onClick={() => setShowAddMonthlyTaskModal(true)}
            style={{ marginLeft: 'auto', backgroundColor: '#10b981', color: 'white' }}
          >
            ➕ Add Monthly Task
          </button>
          <span className="date-display">
            {selectedMonthStart.toLocaleDateString('en-US', { 
              month: 'long',
              year: 'numeric'
            })}
          </span>
        </div>
      )}

      {activeTab === 'yearly' && (
        <div className="date-navigator">
          <button className="btn-nav" onClick={() => changeYear(-1)}>
            ← Previous Year
          </button>
          <button className="btn-nav" onClick={() => changeYear(1)}>
            Next Year →
          </button>
          <button className="btn-nav btn-today" onClick={goToCurrentYear}>
            📅 Current Year
          </button>
          <button 
            className="btn-nav btn-add-yearly" 
            onClick={() => setShowAddYearlyTaskModal(true)}
            style={{ marginLeft: 'auto', backgroundColor: '#10b981', color: 'white' }}
          >
            ➕ Add Yearly Task
          </button>
          <span className="date-display">
            {selectedYearStart.getFullYear()}
          </span>
        </div>
      )}

      {/* One Time Tasks Navigator */}
      {activeTab === 'onetime' && (
        <div className="date-navigator">
          <button 
            className="btn-nav btn-add-onetime" 
            onClick={() => setShowAddOneTimeTaskModal(true)}
            style={{ backgroundColor: '#10b981', color: 'white' }}
          >
            ➕ Add One Time Task
          </button>
          <span className="date-display">
            One-Time Tasks
          </span>
        </div>
      )}

      {/* One-Time Tasks Table */}
      {activeTab === 'onetime' ? (
        <div className="tasks-table-container">
          <table className="tasks-table">
            <thead>
              <tr>
                <th className="col-date">Start Date</th>
                <th className="col-task-name">Task Name</th>
                <th className="col-number">Target Gap (days)</th>
                <th className="col-date">Updated Date</th>
                <th className="col-number">Days Over</th>
                <th className="col-category">Pillar - Category</th>
                <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {oneTimeTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                    No one-time tasks yet. Click "Add One Time Task" to get started.
                  </td>
                </tr>
              ) : (
                oneTimeTasks.map((oneTimeTask) => {
                  const task = tasks.find(t => t.id === oneTimeTask.task_id);
                  if (!task) return null;
                  
                  const daysOver = calculateDaysOver(oneTimeTask.updated_date);
                  const rowClass = getOneTimeRowColorClass(oneTimeTask.target_gap, daysOver);
                  
                  return (
                    <tr key={oneTimeTask.id} className={rowClass}>
                      <td className="col-date">
                        <input
                          type="date"
                          value={oneTimeTask.start_date ? new Date(oneTimeTask.start_date).toISOString().split('T')[0] : ''}
                          onChange={(e) => updateOneTimeTask(oneTimeTask.task_id, { start_date: e.target.value })}
                          style={{ width: '100%', padding: '4px' }}
                        />
                      </td>
                      <td className="col-task-name">
                        {task.name}
                      </td>
                      <td className="col-number">
                        <input
                          type="number"
                          min="0"
                          value={oneTimeTask.target_gap || ''}
                          onChange={(e) => updateOneTimeTask(oneTimeTask.task_id, { target_gap: parseInt(e.target.value) || null })}
                          placeholder="0"
                          style={{ width: '100%', padding: '4px', textAlign: 'center' }}
                        />
                      </td>
                      <td className="col-date">
                        <input
                          type="date"
                          value={oneTimeTask.updated_date ? new Date(oneTimeTask.updated_date).toISOString().split('T')[0] : ''}
                          onChange={(e) => updateOneTimeTask(oneTimeTask.task_id, { updated_date: e.target.value })}
                          style={{ width: '100%', padding: '4px' }}
                        />
                      </td>
                      <td className="col-number" style={{ textAlign: 'center' }}>
                        {daysOver}
                      </td>
                      <td className="col-category">
                        {task.pillar_name} - {task.category_name}
                      </td>
                      <td className="col-action">
                        <button 
                          className="btn-delete"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to remove this task from one-time tracking?')) {
                              deleteOneTimeTask(oneTimeTask.task_id);
                            }
                          }}
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'projects' ? (
        <div className="projects-container">
          {!selectedProject ? (
            // Projects List View
            <>
              <div className="projects-header">
                <button 
                  className="btn btn-primary" 
                  onClick={() => setShowAddProjectModal(true)}
                  style={{ marginBottom: '20px' }}
                >
                  ➕ Add Project
                </button>
              </div>

              <div className="projects-grid">
                {projects.length === 0 ? (
                  <div className="empty-state">
                    <p>No projects yet. Click "Add Project" to get started.</p>
                  </div>
                ) : (
                  projects.map((project) => {
                    const hasOverdue = hasOverdueTasks(project.id);
                    const cardClass = getProjectCardClass(project);
                    
                    return (
                      <div key={project.id} className={`project-card ${cardClass} ${hasOverdue ? 'project-has-overdue' : ''}`}>
                        <div className="project-card-header">
                          <h3>{project.name}</h3>
                          <span className={`project-status status-${project.status} ${hasOverdue ? 'status-overdue' : ''}`}>
                            {hasOverdue && '⚠️ '}{project.status.replace('_', ' ')}
                          </span>
                        </div>
                      
                      {project.description && (
                        <p className="project-description">{project.description}</p>
                      )}
                      
                      <div className="project-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${project.progress.progress_percentage}%` }}
                          />
                        </div>
                        <span className="progress-text">
                          {project.progress.completed_tasks} / {project.progress.total_tasks} tasks completed 
                          ({project.progress.progress_percentage}%)
                        </span>
                      </div>
                      
                      <div className="project-meta">
                        {project.target_completion_date && (
                          <div className="project-due-date">
                            🗓️ Due: {new Date(project.target_completion_date).toLocaleDateString()}
                          </div>
                        )}
                        {project.pillar_id && (
                          <div className="project-pillar">
                            📌 Pillar ID: {project.pillar_id}
                          </div>
                        )}
                      </div>
                      
                      <div className="project-actions">
                        <button 
                          className="btn btn-primary btn-view-tasks"
                          onClick={() => handleSelectProject(project)}
                        >
                          View Tasks
                        </button>
                        <button 
                          className="btn btn-danger"
                          onClick={() => handleDeleteProject(project.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            // Project Detail View with Tasks
            <>
              <div className="project-detail-header">
                <button 
                  className="btn btn-secondary" 
                  onClick={handleBackToProjects}
                >
                  ← Back to Projects
                </button>
                <h2>{selectedProject.name}</h2>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setShowAddTaskModal(true)}
                >
                  ➕ Add Project Task
                </button>
              </div>

              {selectedProject.description && (
                <p className="project-detail-description">{selectedProject.description}</p>
              )}

              <div className="project-progress" style={{ marginBottom: '20px' }}>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${selectedProject.progress.progress_percentage}%` }}
                  />
                </div>
                <span className="progress-text">
                  {selectedProject.progress.completed_tasks} / {selectedProject.progress.total_tasks} tasks completed 
                  ({selectedProject.progress.progress_percentage}%)
                </span>
              </div>

              <div className="project-tasks-tree">
                {projectTasks.length === 0 ? (
                  <div className="empty-state">
                    <p>No tasks yet. Click "Add Project Task" to get started.</p>
                  </div>
                ) : (
                  <div className="task-list">
                    {getTasksByParentId(null).map((task) => (
                      <TaskNode 
                        key={task.id} 
                        task={task} 
                        level={0}
                        allTasks={projectTasks}
                        expandedTasks={expandedTasks}
                        onToggleExpand={toggleTaskExpansion}
                        onToggleComplete={handleToggleTaskCompletion}
                        onDelete={handleDeleteTask}
                        onEdit={handleEditTask}
                        onUpdateDueDate={handleUpdateTaskDueDate}
                        getDueDateColorClass={getDueDateColorClass}
                        getTasksByParentId={getTasksByParentId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="empty-state">
          <p>No {activeTab} tasks yet.</p>
          <button className="btn btn-primary" onClick={() => setIsTaskFormOpen(true)}>
            Create Task
          </button>
        </div>
      ) : (
        <div className="tasks-table-container">
          <table className={`tasks-table ${activeTab === 'daily' || activeTab === 'weekly' || activeTab === 'monthly' || activeTab === 'yearly' ? 'daily-table' : ''}`}>
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
                    <th className="col-time sticky-col sticky-col-3">Spent<br/>(Average)</th>
                    <th className="col-time sticky-col sticky-col-4">Remaining<br/>(Average)</th>
                    {weekDays.map(day => (
                      <th key={day.index} className="col-hour">{day.label}</th>
                    ))}
                    <th className="col-status">Status</th>
                  </>
                ) : activeTab === 'monthly' ? (
                  <>
                    <th className="col-time sticky-col sticky-col-3">Spent<br/>(Average)</th>
                    <th className="col-time sticky-col sticky-col-4">Remaining<br/>(Average)</th>
                    {(() => {
                      const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
                      const days = [];
                      for (let i = 1; i <= daysInMonth; i++) {
                        days.push(<th key={i} className="col-hour">{i}</th>);
                      }
                      return days;
                    })()}
                    <th className="col-status">Status</th>
                  </>
                ) : activeTab === 'yearly' ? (
                  <>
                    <th className="col-time sticky-col sticky-col-3">Spent<br/>(Average)</th>
                    <th className="col-time sticky-col sticky-col-4">Remaining<br/>(Average)</th>
                    {(() => {
                      const year = selectedYearStart.getFullYear();
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      return months.map((month, index) => (
                        <th key={index + 1} className="col-hour">
                          {month}<br/>{year}
                        </th>
                      ));
                    })()}
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
                // Check if this task has any daily/monthly aggregates (meaning it came from daily/monthly tab)
                const hasWeeklyDailyAggregates = activeTab === 'weekly' && weekDays.some(day => isFromDailyAggregate(task.id, day.index));
                const hasMonthlyDailyAggs = activeTab === 'monthly' && hasMonthlyDailyAggregates(task.id);
                const hasYearlyMonthlyAggs = activeTab === 'yearly' && hasYearlyMonthlyAggregates(task.id);
                const hasDailyAggregates = hasWeeklyDailyAggregates || hasMonthlyDailyAggs || hasYearlyMonthlyAggs;
                
                // Get row color class for weekly/monthly/yearly view
                const weeklyColorClass = getWeeklyRowColorClass(task);
                const monthlyColorClass = getMonthlyRowColorClass(task);
                const yearlyColorClass = getYearlyRowColorClass(task);
                const colorClass = activeTab === 'weekly' ? weeklyColorClass : activeTab === 'monthly' ? monthlyColorClass : activeTab === 'yearly' ? yearlyColorClass : '';
                
                // Determine row class based on status for weekly/monthly/yearly tab
                const weeklyStatus = weeklyTaskStatuses[task.id];
                const isWeeklyCompleted = activeTab === 'weekly' && weeklyStatus?.is_completed;
                const isWeeklyNA = activeTab === 'weekly' && weeklyStatus?.is_na;
                const monthlyStatus = monthlyTaskStatuses[task.id];
                const isMonthlyCompleted = activeTab === 'monthly' && monthlyStatus?.is_completed;
                const isMonthlyNA = activeTab === 'monthly' && monthlyStatus?.is_na;
                const yearlyStatus = yearlyTaskStatuses[task.id];
                const isYearlyCompleted = activeTab === 'yearly' && yearlyStatus?.is_completed;
                const isYearlyNA = activeTab === 'yearly' && yearlyStatus?.is_na;
                const rowClassName = isWeeklyCompleted || isMonthlyCompleted || isYearlyCompleted ? 'completed-row' : isWeeklyNA || isMonthlyNA || isYearlyNA ? 'na-row' : (task.is_completed ? 'completed-row' : !task.is_active ? 'na-row' : '');
                
                return (
                <tr key={task.id} className={rowClassName}>
                  <td className={`col-task sticky-col sticky-col-1 ${colorClass}`}>
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
                      {activeTab === 'weekly' && task.follow_up_frequency === 'daily' && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>
                      )}
                      {activeTab === 'weekly' && task.follow_up_frequency === 'weekly' && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#4299e1', fontWeight: '600' }}>(Weekly)</span>
                      )}
                      {activeTab === 'monthly' && task.follow_up_frequency === 'daily' && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>
                      )}
                    </div>
                    {task.pillar_name && (
                      <div className="task-pillar">
                        ({task.pillar_name}{task.category_name ? ` - ${task.category_name}` : ''})
                      </div>
                    )}
                  </td>
                  <td className={`col-time sticky-col sticky-col-2 ${colorClass}`}>
                    {formatTaskTarget(task, activeTab === 'weekly' || activeTab === 'monthly' || activeTab === 'yearly', activeTab === 'monthly' || activeTab === 'yearly')}
                  </td>
                  
                  {activeTab === 'daily' ? (
                    <>
                      {/* Spent column - sum of all hourly entries */}
                      <td className={`col-time sticky-col sticky-col-3 ${colorClass}`}>
                        {formatTaskValue(task, hourLabels.reduce((sum, hour) => sum + getHourlyTime(task.id, hour.index), 0))}
                      </td>
                      {/* Remaining column */}
                      <td className={`col-time sticky-col sticky-col-4 ${colorClass}`}>
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
                                onBlur={handleHourlyTimeBlur}
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
                                onBlur={handleHourlyTimeBlur}
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
                      {/* Spent column - average per day till today */}
                      <td className={`col-time sticky-col sticky-col-3 ${colorClass}`}>
                        {(() => {
                          const totalSpent = weekDays.reduce((sum, day) => sum + getWeeklyTime(task.id, day.index), 0);
                          
                          // Calculate days elapsed so far in this week
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const weekStart = new Date(selectedWeekStart);
                          weekStart.setHours(0, 0, 0, 0);
                          
                          let daysElapsed = 1; // At least 1 day
                          if (today >= weekStart) {
                            const weekEnd = new Date(weekStart);
                            weekEnd.setDate(weekEnd.getDate() + 6); // Saturday
                            
                            if (today <= weekEnd) {
                              // Current week: count days from week start to today (inclusive)
                              const diffTime = today.getTime() - weekStart.getTime();
                              daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                            } else {
                              // Past week: all 7 days
                              daysElapsed = 7;
                            }
                          }
                          
                          const averagePerDay = Math.round(totalSpent / daysElapsed);
                          return formatTaskValue(task, averagePerDay);
                        })()}
                      </td>
                      {/* Remaining column - average needed per remaining day to hit target */}
                      <td className={`col-time sticky-col sticky-col-4 ${colorClass}`}>
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
                            // Current week: days from tomorrow to end of week (inclusive)
                            const diffTime = weekEnd.getTime() - today.getTime();
                            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          }
                          
                          if (remaining <= 0) {
                            return formatTaskValue(task, 0); // Target already met
                          } else if (daysRemaining === 0) {
                            // Last day of the week: show remaining amount needed today
                            return formatTaskValue(task, remaining);
                          } else {
                            // Average per day needed to achieve target
                            const avgPerDayNeeded = Math.round(remaining / daysRemaining);
                            return formatTaskValue(task, avgPerDayNeeded);
                          }
                        })()}
                      </td>
                      {/* 7 daily columns */}
                      {weekDays.map(day => {
                        const isBoolean = task.task_type === TaskType.BOOLEAN;
                        // If task has ANY daily aggregates, disable ALL days for this task
                        const isTaskFromDaily = hasDailyAggregates;
                        return (
                          <td key={day.index} className={`col-hour ${colorClass}`}>
                            {isBoolean ? (
                              <input
                                type="checkbox"
                                className={`hour-input ${isTaskFromDaily ? 'from-daily' : ''}`}
                                checked={getWeeklyTime(task.id, day.index) > 0}
                                onChange={(e) => handleWeeklyTimeChange(task.id, day.index, e.target.checked ? '1' : '0')}
                                title={isTaskFromDaily ? 'Read-only: This is a Daily task. Edit in Daily tab to change.' : 'Mark as done'}
                                disabled={isTaskFromDaily}
                                style={isTaskFromDaily ? { cursor: 'not-allowed', opacity: 0.7 } : { cursor: 'pointer' }}
                              />
                            ) : (
                              <input
                                type="number"
                                min="0"
                                className={`hour-input ${isTaskFromDaily ? 'from-daily' : ''}`}
                                value={getWeeklyTime(task.id, day.index) || ''}
                                onChange={(e) => handleWeeklyTimeChange(task.id, day.index, e.target.value)}
                                placeholder="0"
                                title={isTaskFromDaily ? 'Read-only: This is a Daily task. Edit in Daily tab to change.' : `Enter ${task.task_type === TaskType.COUNT ? 'count' : 'time'}`}
                                readOnly={isTaskFromDaily}
                                disabled={isTaskFromDaily}
                                style={isTaskFromDaily ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
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
                  ) : activeTab === 'monthly' ? (
                    <>
                      {/* Spent column - average per day till today */}
                      <td className={`col-time sticky-col sticky-col-3 ${getMonthlyRowColorClass(task)}`}>
                        {(() => {
                          const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
                          let totalSpent = 0;
                          for (let day = 1; day <= daysInMonth; day++) {
                            totalSpent += getMonthlyTime(task.id, day);
                          }
                          
                          // Calculate days elapsed so far in this month
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const monthStart = new Date(selectedMonthStart);
                          monthStart.setHours(0, 0, 0, 0);
                          
                          let daysElapsed = 1; // At least 1 day
                          if (today >= monthStart) {
                            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
                            monthEnd.setHours(0, 0, 0, 0);
                            
                            if (today <= monthEnd) {
                              // Current month: count days from month start to today (inclusive)
                              const diffTime = today.getTime() - monthStart.getTime();
                              daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                            } else {
                              // Past month: all days in month
                              daysElapsed = daysInMonth;
                            }
                          }
                          
                          const averagePerDay = Math.round(totalSpent / daysElapsed);
                          return formatTaskValue(task, averagePerDay);
                        })()}
                      </td>
                      {/* Remaining column - average needed per remaining day to hit target */}
                      <td className={`col-time sticky-col sticky-col-4 ${getMonthlyRowColorClass(task)}`}>
                        {(() => {
                          const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
                          let totalSpent = 0;
                          for (let day = 1; day <= daysInMonth; day++) {
                            totalSpent += getMonthlyTime(task.id, day);
                          }
                          
                          // Calculate monthly target based on follow-up frequency
                          let monthlyTarget = 0;
                          if (task.task_type === TaskType.COUNT) {
                            if (task.follow_up_frequency === 'daily') {
                              // Daily task: multiply by days in month
                              monthlyTarget = (task.target_value || 0) * daysInMonth;
                            } else if (task.follow_up_frequency === 'weekly') {
                              // Weekly task: multiply by number of weeks in month (~4.3)
                              monthlyTarget = Math.round((task.target_value || 0) * (daysInMonth / 7));
                            } else {
                              // Monthly task: use target as-is
                              monthlyTarget = task.target_value || 0;
                            }
                          } else {
                            // TIME task
                            if (task.follow_up_frequency === 'daily') {
                              // Daily task: multiply by days in month
                              monthlyTarget = task.allocated_minutes * daysInMonth;
                            } else if (task.follow_up_frequency === 'weekly') {
                              // Weekly task: multiply by number of weeks in month (~4.3)
                              monthlyTarget = Math.round(task.allocated_minutes * (daysInMonth / 7));
                            } else {
                              // Monthly task: use allocated as-is
                              monthlyTarget = task.allocated_minutes;
                            }
                          }
                          
                          const remaining = monthlyTarget - totalSpent;
                          
                          // Calculate days remaining in the month
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const monthStart = new Date(selectedMonthStart);
                          monthStart.setHours(0, 0, 0, 0);
                          const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
                          monthEnd.setHours(0, 0, 0, 0);
                          
                          let daysRemaining = 0;
                          if (today >= monthStart && today <= monthEnd) {
                            // Current month: days from tomorrow to end of month (inclusive)
                            const diffTime = monthEnd.getTime() - today.getTime();
                            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          }
                          
                          if (remaining <= 0) {
                            return formatTaskValue(task, 0); // Target already met
                          } else if (daysRemaining === 0) {
                            // Last day of the month: show remaining amount needed today
                            return formatTaskValue(task, remaining);
                          } else {
                            // Average per day needed to achieve target
                            const avgPerDayNeeded = Math.round(remaining / daysRemaining);
                            return formatTaskValue(task, avgPerDayNeeded);
                          }
                        })()}
                      </td>
                      {/* Dynamic day columns (1-31) */}
                      {(() => {
                        const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
                        const days = [];
                        const isBoolean = task.task_type === TaskType.BOOLEAN;
                        // If task has ANY daily aggregates, disable ALL days for this task (like weekly tab)
                        const isTaskFromDaily = hasDailyAggregates;
                        
                        for (let day = 1; day <= daysInMonth; day++) {
                          days.push(
                            <td key={day} className={`col-hour ${colorClass}`}>
                              {isBoolean ? (
                                <input
                                  type="checkbox"
                                  className={`hour-input ${isTaskFromDaily ? 'from-daily' : ''}`}
                                  checked={getMonthlyTime(task.id, day) > 0}
                                  onChange={(e) => handleMonthlyTimeChange(task.id, day, e.target.checked ? '1' : '0')}
                                  title={isTaskFromDaily ? 'Read-only: This is a Daily task. Edit in Daily tab to change.' : 'Mark as done'}
                                  disabled={isTaskFromDaily}
                                  style={isTaskFromDaily ? { cursor: 'not-allowed', opacity: 0.7 } : { cursor: 'pointer' }}
                                />
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  className={`hour-input ${isTaskFromDaily ? 'from-daily' : ''}`}
                                  value={getMonthlyTime(task.id, day) || ''}
                                  onChange={(e) => handleMonthlyTimeChange(task.id, day, e.target.value)}
                                  placeholder="0"
                                  title={isTaskFromDaily ? 'Read-only: This is a Daily task. Edit in Daily tab to change.' : `Enter ${task.task_type === TaskType.COUNT ? 'count' : 'time'}`}
                                  readOnly={isTaskFromDaily}
                                  disabled={isTaskFromDaily}
                                  style={isTaskFromDaily ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
                                />
                              )}
                            </td>
                          );
                        }
                        return days;
                      })()}
                      {/* Status column at the end - Monthly specific status */}
                      <td className="col-status">
                        {monthlyTaskStatuses[task.id]?.is_completed ? (
                          <span className="completed-text">✓ Completed (Month)</span>
                        ) : monthlyTaskStatuses[task.id]?.is_na ? (
                          <span className="na-text">NA (Month)</span>
                        ) : (
                          <div className="action-buttons">
                            <button 
                              className="btn-complete"
                              onClick={() => handleMonthlyTaskComplete(task.id)}
                              title="Mark as completed for this month only"
                            >
                              Completed
                            </button>
                            <button 
                              className="btn-na"
                              onClick={() => handleMonthlyTaskNA(task.id)}
                              title="Mark as NA for this month only"
                            >
                              NA
                            </button>
                          </div>
                        )}
                      </td>
                    </>
                  ) : activeTab === 'yearly' ? (
                    <>
                      {/* Spent column - average per month till today */}
                      <td className={`col-time sticky-col sticky-col-3 ${getYearlyRowColorClass(task)}`}>
                        {(() => {
                          let totalSpent = 0;
                          for (let month = 1; month <= 12; month++) {
                            totalSpent += getYearlyTime(task.id, month);
                          }
                          
                          // Calculate months elapsed so far in this year
                          const today = new Date();
                          const yearStart = new Date(selectedYearStart);
                          let monthsElapsed = 1; // At least 1 month
                          if (today.getFullYear() === yearStart.getFullYear()) {
                            monthsElapsed = today.getMonth() + 1; // 0-indexed, so add 1
                          } else if (today.getFullYear() > yearStart.getFullYear()) {
                            monthsElapsed = 12; // Full year
                          }
                          
                          const avgPerMonth = monthsElapsed > 0 ? (totalSpent / monthsElapsed).toFixed(1) : '0.0';
                          return (
                            <>
                              {formatTaskValue(task, totalSpent)}
                              <br />
                              <small style={{ color: '#666', fontSize: '0.85em' }}>~{avgPerMonth}/month</small>
                            </>
                          );
                        })()}
                      </td>
                      {/* Remaining column - average needed per month */}
                      <td className={`col-time sticky-col sticky-col-4 ${getYearlyRowColorClass(task)}`}>
                        {(() => {
                          let totalSpent = 0;
                          for (let month = 1; month <= 12; month++) {
                            totalSpent += getYearlyTime(task.id, month);
                          }
                          
                          // Calculate target and remaining based on task type and follow-up frequency
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
                            // TIME tasks
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
                          
                          const remaining = yearlyTarget - totalSpent;
                          
                          // Calculate how many months are left in the year
                          const today = new Date();
                          const yearStart = new Date(selectedYearStart);
                          let monthsElapsed = 1;
                          if (today.getFullYear() === yearStart.getFullYear()) {
                            monthsElapsed = today.getMonth() + 1;
                          } else if (today.getFullYear() > yearStart.getFullYear()) {
                            monthsElapsed = 12;
                          }
                          const monthsRemaining = 12 - monthsElapsed;
                          
                          if (remaining <= 0 || monthsRemaining === 0) {
                            return formatTaskValue(task, remaining);
                          } else {
                            // Average per month needed to achieve target
                            const avgPerMonthNeeded = Math.round(remaining / monthsRemaining);
                            return formatTaskValue(task, avgPerMonthNeeded);
                          }
                        })()}
                      </td>
                      {/* 12 month columns (Jan - Dec) */}
                      {(() => {
                        const months = [];
                        const isBoolean = task.task_type === TaskType.BOOLEAN;
                        // If task has ANY monthly aggregates, disable ALL months for this task
                        const isTaskFromOtherTabs = hasYearlyMonthlyAggregates(task.id);
                        
                        for (let month = 1; month <= 12; month++) {
                          const timeValue = getYearlyTime(task.id, month);
                          months.push(
                            <td key={month} className={`col-hour ${colorClass}`}>
                              {isBoolean ? (
                                <input
                                  type="checkbox"
                                  className={`hour-input ${isTaskFromOtherTabs ? 'from-daily' : ''}`}
                                  checked={timeValue > 0}
                                  onChange={(e) => handleYearlyTimeChange(task.id, month, e.target.checked ? '1' : '0')}
                                  title={isTaskFromOtherTabs ? 'Read-only: This task has aggregated data from Monthly/Weekly/Daily tabs. Edit there to change.' : 'Mark as done'}
                                  disabled={isTaskFromOtherTabs}
                                  style={isTaskFromOtherTabs ? { cursor: 'not-allowed', opacity: 0.7 } : { cursor: 'pointer' }}
                                />
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  className={`hour-input ${isTaskFromOtherTabs ? 'from-daily' : ''}`}
                                  value={timeValue || ''}
                                  onChange={(e) => handleYearlyTimeChange(task.id, month, e.target.value)}
                                  placeholder="0"
                                  title={isTaskFromOtherTabs ? 'Read-only: This task has aggregated data from Monthly/Weekly/Daily tabs. Edit there to change.' : `Enter ${task.task_type === TaskType.COUNT ? 'count' : 'time'}`}
                                  readOnly={isTaskFromOtherTabs}
                                  disabled={isTaskFromOtherTabs}
                                  style={isTaskFromOtherTabs ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
                                />
                              )}
                            </td>
                          );
                        }
                        return months;
                      })()}
                      {/* Status column at the end - Yearly specific status */}
                      <td className="col-status">
                        {yearlyTaskStatuses[task.id]?.is_completed ? (
                          <span className="completed-text">✓ Completed (Year)</span>
                        ) : yearlyTaskStatuses[task.id]?.is_na ? (
                          <span className="na-text">NA (Year)</span>
                        ) : (
                          <div className="action-buttons">
                            <button 
                              className="btn-complete"
                              onClick={() => handleYearlyStatusChange(task.id, true, false)}
                              title="Mark as completed for this year only"
                            >
                              Completed
                            </button>
                            <button 
                              className="btn-na"
                              onClick={() => handleYearlyStatusChange(task.id, false, true)}
                              title="Mark as NA for this year only"
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
                      const isNotExactly60 = hourTotal !== 60;
                      return (
                        <td key={hour.index} className={`col-hour ${isNotExactly60 ? 'hour-over-limit' : ''}`}>
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

      {/* Project Tasks Due Today (shown in Today tab) */}
      {activeTab === 'today' && projectTasksDueToday.length > 0 && (
        <div className="project-tasks-today-section">
          <h3 style={{ marginTop: '40px', marginBottom: '20px', color: '#2d3748', fontSize: '24px' }}>
            📋 Project Tasks Due Today & Overdue
          </h3>
          <div className="tasks-table-container">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th className="col-checkbox"></th>
                  <th className="col-task">Task</th>
                  <th className="col-task">Project</th>
                  <th className="col-time">Priority</th>
                  <th className="col-time">Due Date</th>
                  <th className="col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {projectTasksDueToday.map((task) => {
                  const dueDateClass = getDueDateColorClass(task.due_date);
                  return (
                    <tr key={task.id} className={`${dueDateClass} ${task.is_completed ? 'completed-row' : ''}`}>
                      <td className="col-checkbox">
                        <input
                          type="checkbox"
                          checked={task.is_completed}
                          onChange={() => handleToggleTaskCompletion(task.id, task.is_completed)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </td>
                      <td className="col-task">
                        <div 
                          className={`task-name ${task.is_completed ? 'strikethrough' : ''}`}
                          onClick={() => handleEditTask(task)}
                          style={{ 
                            cursor: 'pointer', 
                            textDecoration: task.is_completed ? 'line-through' : 'underline',
                            color: '#3182ce'
                          }}
                          title="Click to edit task"
                        >
                          {task.name}
                        </div>
                        {task.description && (
                          <div className="task-pillar" style={{ fontSize: '13px', color: '#718096' }}>
                            {task.description}
                          </div>
                        )}
                      </td>
                      <td className="col-task">
                        {task.project_name || `Project #${task.project_id}`}
                      </td>
                      <td className="col-time">
                        <span className={`task-priority priority-${task.priority}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="col-time">
                        <input 
                          type="date"
                          value={task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleUpdateTaskDueDate(task.id, e.target.value)}
                          style={{
                            border: '1px solid #e2e8f0',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                          title="Click to change due date"
                        />
                      </td>
                      <td className="col-action">
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleEditTask(task)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Goal Tasks Due Today (shown in Today tab) */}
      {activeTab === 'today' && goalTasksDueToday.length > 0 && (
        <div className="project-tasks-today-section">
          <h3 style={{ marginTop: '40px', marginBottom: '20px', color: '#2d3748', fontSize: '24px' }}>
            🎯 Goal Tasks Due Today & Overdue
          </h3>
          <div className="tasks-table-container">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th className="col-checkbox"></th>
                  <th className="col-task">Task</th>
                  <th className="col-task">Goal</th>
                  <th className="col-time">Priority</th>
                  <th className="col-time">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {goalTasksDueToday.map((task) => {
                  const dueDateClass = getDueDateColorClass(task.due_date);
                  return (
                    <tr key={`goal-${task.id}`} className={`${dueDateClass} ${task.is_completed ? 'completed-row' : ''}`}>
                      <td className="col-checkbox">
                        <input
                          type="checkbox"
                          checked={task.is_completed}
                          onChange={() => handleToggleGoalTaskCompletion(task.id, task.is_completed)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </td>
                      <td className="col-task">
                        <div 
                          className={`task-name ${task.is_completed ? 'strikethrough' : ''}`}
                          style={{ 
                            cursor: 'default',
                            color: '#2d3748'
                          }}
                        >
                          {task.name}
                        </div>
                        {task.description && (
                          <div className="task-pillar" style={{ fontSize: '13px', color: '#718096' }}>
                            {task.description}
                          </div>
                        )}
                      </td>
                      <td className="col-task">
                        {task.goal_name || `Goal #${task.goal_id}`}
                      </td>
                      <td className="col-time">
                        <span className={`task-priority priority-${task.priority}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="col-time">
                        <input 
                          type="date"
                          value={task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleUpdateGoalTaskDueDate(task.id, e.target.value)}
                          style={{
                            border: '1px solid #e2e8f0',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                          title="Click to change due date"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overdue One-Time Tasks (shown in Today tab) */}
      {activeTab === 'today' && overdueOneTimeTasks.length > 0 && (
        <div className="project-tasks-today-section">
          <h3 style={{ marginTop: '40px', marginBottom: '20px', color: '#2d3748', fontSize: '24px' }}>
            🔴 One-Time Tasks Due Today or Overdue
          </h3>
          <div className="tasks-table-container">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th className="col-task">Task Name</th>
                  <th className="col-date">Start Date</th>
                  <th className="col-number">Target Gap (days)</th>
                  <th className="col-date">Last Updated</th>
                  <th className="col-number">Days Over</th>
                  <th className="col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {overdueOneTimeTasks.map((oneTimeTask) => {
                  const daysOver = calculateDaysOver(oneTimeTask.updated_date);
                  return (
                    <tr key={oneTimeTask.id} className="row-overdue">
                      <td className="col-task">
                        <div className="task-name">
                          {oneTimeTask.task_name}
                        </div>
                      </td>
                      <td className="col-date">
                        {new Date(oneTimeTask.start_date).toLocaleDateString()}
                      </td>
                      <td className="col-number">
                        {oneTimeTask.target_gap || 'N/A'}
                      </td>
                      <td className="col-date">
                        <input
                          type="date"
                          value={oneTimeTask.updated_date ? new Date(oneTimeTask.updated_date).toISOString().split('T')[0] : ''}
                          onChange={(e) => updateOneTimeTask(oneTimeTask.task_id, { updated_date: e.target.value })}
                          style={{
                            border: '1px solid #e2e8f0',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                          title="Click to update date"
                        />
                      </td>
                      <td className="col-number">
                        {daysOver}
                      </td>
                      <td className="col-action">
                        <button 
                          className="btn btn-sm btn-success"
                          onClick={() => updateOneTimeTask(oneTimeTask.task_id, { updated_date: new Date().toISOString().split('T')[0] })}
                          title="Mark as done today"
                        >
                          ✓ Done
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                Select an existing task to track for this week:
              </p>
              
              <div className="form-group">
                <label htmlFor="dailyTaskSelect">Select from Tasks:</label>
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
                  <option value="">-- Select a task --</option>
                  {tasks
                    .filter(task => task.is_active && !weeklyTaskStatuses[task.id])
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
                    .map(task => {
                      let displayValue = '';
                      if (task.task_type === 'time') {
                        displayValue = `(${task.allocated_minutes} min)`;
                      } else if (task.task_type === 'count') {
                        displayValue = `(${task.target_value} ${task.unit || 'count'})`;
                      } else if (task.task_type === 'boolean') {
                        displayValue = '(Yes/No)';
                      }
                      
                      return (
                        <option key={task.id} value={task.id}>
                          {task.pillar_name} - {task.category_name}: {task.name} {displayValue}
                        </option>
                      );
                    })
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

      {/* Add Monthly Task Modal */}
      {showAddMonthlyTaskModal && (
        <div className="modal-overlay" onClick={() => setShowAddMonthlyTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Monthly Task</h2>
              <button className="btn-close" onClick={() => setShowAddMonthlyTaskModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '15px', color: '#666' }}>
                Select an existing task to track for this month:
              </p>
              
              <div className="form-group">
                <label htmlFor="dailyTaskSelectMonthly">Select from Daily Tasks:</label>
                <select 
                  id="dailyTaskSelectMonthly"
                  className="form-control"
                  value={selectedDailyTaskForMonthly || ''}
                  onChange={(e) => setSelectedDailyTaskForMonthly(e.target.value ? Number(e.target.value) : null)}
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
                    .filter(task => task.follow_up_frequency === 'daily' && task.is_active && !monthlyTaskStatuses[task.id])
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
                    .map(task => {
                      let displayValue = '';
                      if (task.task_type === 'time') {
                        displayValue = `(${task.allocated_minutes} min)`;
                      } else if (task.task_type === 'count') {
                        displayValue = `(${task.target_value} ${task.unit || 'count'})`;
                      } else if (task.task_type === 'boolean') {
                        displayValue = '(Yes/No)';
                      }
                      
                      return (
                        <option key={task.id} value={task.id}>
                          {task.pillar_name} - {task.category_name}: {task.name} {displayValue}
                        </option>
                      );
                    })
                  }
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '20px' }}>
                <label htmlFor="weeklyTaskSelectMonthly">Select from Weekly Tasks:</label>
                <select 
                  id="weeklyTaskSelectMonthly"
                  className="form-control"
                  value={selectedDailyTaskForMonthly || ''}
                  onChange={(e) => setSelectedDailyTaskForMonthly(e.target.value ? Number(e.target.value) : null)}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    marginTop: '5px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e0'
                  }}
                >
                  <option value="">-- Select a weekly task --</option>
                  {tasks
                    .filter(task => task.follow_up_frequency === 'weekly' && task.is_active && !monthlyTaskStatuses[task.id])
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
                    .map(task => {
                      let displayValue = '';
                      if (task.task_type === 'time') {
                        displayValue = `(${task.allocated_minutes} min)`;
                      } else if (task.task_type === 'count') {
                        displayValue = `(${task.target_value} ${task.unit || 'count'})`;
                      } else if (task.task_type === 'boolean') {
                        displayValue = '(Yes/No)';
                      }
                      
                      return (
                        <option key={task.id} value={task.id}>
                          {task.pillar_name} - {task.category_name}: {task.name} {displayValue}
                        </option>
                      );
                    })
                  }
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '20px' }}>
                <label htmlFor="monthlyTaskSelectMonthly">Select from Monthly Tasks:</label>
                <select 
                  id="monthlyTaskSelectMonthly"
                  className="form-control"
                  value={selectedDailyTaskForMonthly || ''}
                  onChange={(e) => setSelectedDailyTaskForMonthly(e.target.value ? Number(e.target.value) : null)}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    marginTop: '5px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e0'
                  }}
                >
                  <option value="">-- Select a monthly task --</option>
                  {tasks
                    .filter(task => task.follow_up_frequency === 'monthly' && task.is_active && !monthlyTaskStatuses[task.id])
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
                    .map(task => {
                      let displayValue = '';
                      if (task.task_type === 'time') {
                        displayValue = `(${task.allocated_minutes} min)`;
                      } else if (task.task_type === 'count') {
                        displayValue = `(${task.target_value} ${task.unit || 'count'})`;
                      } else if (task.task_type === 'boolean') {
                        displayValue = '(Yes/No)';
                      }
                      
                      return (
                        <option key={task.id} value={task.id}>
                          {task.pillar_name} - {task.category_name}: {task.name} {displayValue}
                        </option>
                      );
                    })
                  }
                </select>
              </div>

              <div style={{ margin: '20px 0', textAlign: 'center', color: '#999' }}>
                OR
              </div>

              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedDailyTaskForMonthly(null);
                  handleAddMonthlyTask();
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
                  setShowAddMonthlyTaskModal(false);
                  setSelectedDailyTaskForMonthly(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleAddMonthlyTask}
                disabled={!selectedDailyTaskForMonthly}
                style={{ 
                  opacity: selectedDailyTaskForMonthly ? 1 : 0.5,
                  cursor: selectedDailyTaskForMonthly ? 'pointer' : 'not-allowed'
                }}
              >
                Add to Monthly
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddYearlyTaskModal && (
        <div className="modal-overlay" onClick={() => setShowAddYearlyTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Yearly Task</h2>
              <button className="btn-close" onClick={() => setShowAddYearlyTaskModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '15px', color: '#666' }}>
                Select an existing task to track for this year:
              </p>
              
              <div className="form-group">
                <label htmlFor="dailyTaskSelectYearly" style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                  Select from Daily Tasks:
                </label>
                <select 
                  id="dailyTaskSelectYearly"
                  className="form-control"
                  value={selectedDailyTaskForYearly || ''}
                  onChange={(e) => setSelectedDailyTaskForYearly(e.target.value ? Number(e.target.value) : null)}
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
                    .filter(task => task.is_active && !yearlyTaskStatuses[task.id] && task.follow_up_frequency === 'daily')
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
                    .map(task => {
                      let displayValue = '';
                      if (task.task_type === 'time') {
                        displayValue = `(${task.allocated_minutes} min)`;
                      } else if (task.task_type === 'count') {
                        displayValue = `(${task.target_value} ${task.unit || 'count'})`;
                      } else if (task.task_type === 'boolean') {
                        displayValue = '(Yes/No)';
                      }
                      
                      return (
                        <option key={task.id} value={task.id}>
                          {task.pillar_name} - {task.category_name}: {task.name} {displayValue}
                        </option>
                      );
                    })
                  }
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '20px' }}>
                <label htmlFor="weeklyTaskSelectYearly" style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                  Select from Weekly Tasks:
                </label>
                <select 
                  id="weeklyTaskSelectYearly"
                  className="form-control"
                  value={selectedDailyTaskForYearly || ''}
                  onChange={(e) => setSelectedDailyTaskForYearly(e.target.value ? Number(e.target.value) : null)}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    marginTop: '5px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e0'
                  }}
                >
                  <option value="">-- Select a weekly task --</option>
                  {tasks
                    .filter(task => task.is_active && !yearlyTaskStatuses[task.id] && task.follow_up_frequency === 'weekly')
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
                    .map(task => {
                      let displayValue = '';
                      if (task.task_type === 'time') {
                        displayValue = `(${task.allocated_minutes} min)`;
                      } else if (task.task_type === 'count') {
                        displayValue = `(${task.target_value} ${task.unit || 'count'})`;
                      } else if (task.task_type === 'boolean') {
                        displayValue = '(Yes/No)';
                      }
                      
                      return (
                        <option key={task.id} value={task.id}>
                          {task.pillar_name} - {task.category_name}: {task.name} {displayValue}
                        </option>
                      );
                    })
                  }
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '20px' }}>
                <label htmlFor="monthlyTaskSelectYearly" style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                  Select from Monthly Tasks:
                </label>
                <select 
                  id="monthlyTaskSelectYearly"
                  className="form-control"
                  value={selectedDailyTaskForYearly || ''}
                  onChange={(e) => setSelectedDailyTaskForYearly(e.target.value ? Number(e.target.value) : null)}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    marginTop: '5px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e0'
                  }}
                >
                  <option value="">-- Select a monthly task --</option>
                  {tasks
                    .filter(task => task.is_active && !yearlyTaskStatuses[task.id] && task.follow_up_frequency === 'monthly')
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
                    .map(task => {
                      let displayValue = '';
                      if (task.task_type === 'time') {
                        displayValue = `(${task.allocated_minutes} min)`;
                      } else if (task.task_type === 'count') {
                        displayValue = `(${task.target_value} ${task.unit || 'count'})`;
                      } else if (task.task_type === 'boolean') {
                        displayValue = '(Yes/No)';
                      }
                      
                      return (
                        <option key={task.id} value={task.id}>
                          {task.pillar_name} - {task.category_name}: {task.name} {displayValue}
                        </option>
                      );
                    })
                  }
                </select>
              </div>

              <div style={{ margin: '20px 0', textAlign: 'center', color: '#999' }}>
                OR
              </div>

              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedDailyTaskForYearly(null);
                  handleAddYearlyTask();
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
                  setShowAddYearlyTaskModal(false);
                  setSelectedDailyTaskForYearly(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleAddYearlyTask}
                disabled={!selectedDailyTaskForYearly}
                style={{ 
                  opacity: selectedDailyTaskForYearly ? 1 : 0.5,
                  cursor: selectedDailyTaskForYearly ? 'pointer' : 'not-allowed'
                }}
              >
                Add to Yearly
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add One-Time Task Modal */}
      {showAddOneTimeTaskModal && (
        <div className="modal-overlay" onClick={() => setShowAddOneTimeTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add One-Time Task</h2>
              <button className="btn-close" onClick={() => setShowAddOneTimeTaskModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '15px', color: '#666' }}>
                Select an existing task to track as a one-time task:
              </p>
              
              <div className="form-group">
                <label htmlFor="taskSelectOneTime">Select Task:</label>
                <select 
                  id="taskSelectOneTime"
                  className="form-control"
                  value={selectedTaskForOneTime || ''}
                  onChange={(e) => setSelectedTaskForOneTime(e.target.value ? Number(e.target.value) : null)}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    marginTop: '5px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e0'
                  }}
                >
                  <option value="">-- Select a task --</option>
                  {tasks
                    .filter(task => task.is_active && !oneTimeTasks.find(ot => ot.task_id === task.id))
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
                        {task.pillar_name} - {task.category_name}: {task.name}
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
                  setSelectedTaskForOneTime(null);
                  handleAddOneTimeTask();
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
                  setShowAddOneTimeTaskModal(false);
                  setSelectedTaskForOneTime(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleAddOneTimeTask}
                disabled={!selectedTaskForOneTime}
                style={{ 
                  opacity: selectedTaskForOneTime ? 1 : 0.5,
                  cursor: selectedTaskForOneTime ? 'pointer' : 'not-allowed'
                }}
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProjectModal && (
        <div className="modal-overlay" onClick={() => setShowAddProjectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Project</h2>
              <button className="btn-close" onClick={() => setShowAddProjectModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                try {
                  const goalId = formData.get('goal_id');
                  await api.post('/api/projects/', {
                    name: formData.get('name'),
                    description: formData.get('description') || null,
                    goal_id: goalId && goalId !== '' ? parseInt(goalId as string) : null,
                    start_date: formData.get('start_date') || null,
                    target_completion_date: formData.get('target_completion_date') || null
                  });
                  
                  await loadProjects();
                  setShowAddProjectModal(false);
                } catch (err: any) {
                  console.error('Error creating project:', err);
                  alert('Failed to create project: ' + (err.response?.data?.detail || err.message));
                }
              }}>
                <div className="form-group">
                  <label htmlFor="project-goal">Link to Life Goal (Optional)</label>
                  <select
                    id="project-goal"
                    name="goal_id"
                    className="form-control"
                  >
                    <option value="">-- No Goal --</option>
                    {lifeGoals.map(goal => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name}
                      </option>
                    ))}
                  </select>
                  <small className="form-text">
                    Link this project to a life goal for better tracking
                  </small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="project-name">Project Name *</label>
                  <input
                    type="text"
                    id="project-name"
                    name="name"
                    className="form-control"
                    required
                    placeholder="e.g., Getting DTM 2025"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="project-description">Description</label>
                  <textarea
                    id="project-description"
                    name="description"
                    className="form-control"
                    rows={3}
                    placeholder="Brief description of the project"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="project-start-date">Start Date *</label>
                  <input
                    type="date"
                    id="project-start-date"
                    name="start_date"
                    className="form-control"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                  <small className="form-text">
                    When did/will you start this project? (Editable - can be in the past)
                  </small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="project-due-date">Target Completion Date</label>
                  <input
                    type="date"
                    id="project-due-date"
                    name="target_completion_date"
                    className="form-control"
                  />
                  <small className="form-text">
                    When do you want to complete this project?
                  </small>
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={() => setShowAddProjectModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Task to Project Modal */}
      {showAddTaskModal && selectedProject && (
        <div className="modal-overlay" onClick={() => setShowAddTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Project Task to {selectedProject.name}</h2>
              <button className="btn-close" onClick={() => setShowAddTaskModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                try {
                  await api.post(`/api/projects/${selectedProject.id}/tasks`, {
                    name: formData.get('name'),
                    description: formData.get('description') || null,
                    parent_task_id: formData.get('parent_task_id') ? Number(formData.get('parent_task_id')) : null,
                    due_date: formData.get('due_date') || null,
                    priority: formData.get('priority') || 'medium',
                    order: 0
                  });
                  
                  await loadProjectTasks(selectedProject.id);
                  await loadProjects(); // Refresh progress
                  setShowAddTaskModal(false);
                } catch (err: any) {
                  console.error('Error creating task:', err);
                  alert('Failed to create task: ' + (err.response?.data?.detail || err.message));
                }
              }}>
                <div className="form-group">
                  <label htmlFor="task-name">Task Name *</label>
                  <input
                    type="text"
                    id="task-name"
                    name="name"
                    className="form-control"
                    required
                    placeholder="e.g., Complete Pathway 1"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="task-description">Description</label>
                  <textarea
                    id="task-description"
                    name="description"
                    className="form-control"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="task-parent">Parent Task (for sub-tasks)</label>
                  <select
                    id="task-parent"
                    name="parent_task_id"
                    className="form-control"
                  >
                    <option value="">-- None (Root Task) --</option>
                    {projectTasks
                      .filter(task => !selectedProject || task.project_id === selectedProject.id)
                      .map(task => (
                        <option key={task.id} value={task.id}>
                          {task.name}
                        </option>
                      ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="task-due-date">Due Date</label>
                  <input
                    type="date"
                    id="task-due-date"
                    name="due_date"
                    className="form-control"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="task-priority">Priority</label>
                  <select
                    id="task-priority"
                    name="priority"
                    className="form-control"
                    defaultValue="medium"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={() => setShowAddTaskModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Add Project Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Task Modal */}
      {showEditTaskModal && editingTask && (
        <div className="modal-overlay" onClick={() => setShowEditTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Task</h2>
              <button className="btn-close" onClick={() => setShowEditTaskModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpdateTask}>
                <div className="form-group">
                  <label htmlFor="edit-task-name">Task Name *</label>
                  <input
                    type="text"
                    id="edit-task-name"
                    className="form-control"
                    value={editingTask.name}
                    onChange={(e) => setEditingTask({...editingTask, name: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-task-description">Description</label>
                  <textarea
                    id="edit-task-description"
                    className="form-control"
                    rows={2}
                    value={editingTask.description || ''}
                    onChange={(e) => setEditingTask({...editingTask, description: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-task-due-date">Due Date</label>
                  <input
                    type="date"
                    id="edit-task-due-date"
                    className="form-control"
                    value={editingTask.due_date ? new Date(editingTask.due_date).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditingTask({...editingTask, due_date: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-task-priority">Priority</label>
                  <select
                    id="edit-task-priority"
                    className="form-control"
                    value={editingTask.priority || 'medium'}
                    onChange={(e) => setEditingTask({...editingTask, priority: e.target.value as 'low' | 'medium' | 'high'})}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={() => setShowEditTaskModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Life Goal Modal */}
      {/* Task Form Modal */}
      <TaskForm
        isOpen={isTaskFormOpen}
        onClose={handleFormClose}
        onSuccess={async (createdTaskId?: number) => {
          await loadTasks();
          
          // If this task was created from the "Add Weekly/Monthly/Yearly Task" modal,
          // automatically add it to tracking
          if (addToTrackingAfterCreate && createdTaskId) {
            try {
              if (addToTrackingAfterCreate === 'weekly') {
                const weekStart = selectedWeekStart.toISOString().split('T')[0];
                await api.post(`/api/weekly-time/status/${createdTaskId}/${weekStart}`, {
                  is_completed: false,
                  is_na: false
                });
                await loadWeeklyEntries(selectedWeekStart);
              } else if (addToTrackingAfterCreate === 'monthly') {
                const monthStart = selectedMonthStart.toISOString().split('T')[0];
                await api.post(`/api/monthly-time/status/${createdTaskId}/${monthStart}`, {
                  is_completed: false,
                  is_na: false
                });
                await loadMonthlyEntries(selectedMonthStart);
              } else if (addToTrackingAfterCreate === 'yearly') {
                const yearStart = selectedYearStart.toISOString().split('T')[0];
                await api.post(`/api/yearly-time/status/${createdTaskId}/${yearStart}`, {
                  is_completed: false,
                  is_na: false
                });
                await loadYearlyEntries(selectedYearStart);
              } else if (addToTrackingAfterCreate === 'onetime') {
                const today = new Date().toISOString().split('T')[0];
                await api.post('/api/one-time-tasks/', {
                  task_id: createdTaskId,
                  start_date: today,
                  target_gap: null,
                  updated_date: null
                });
                await loadOneTimeTasks();
              }
            } catch (err: any) {
              console.error('Error adding task to tracking:', err);
              alert('Task created but failed to add to tracking: ' + (err.response?.data?.detail || err.message));
            }
          }
          
          // Reset tracking context
          setAddToTrackingAfterCreate(null);
          handleFormClose();
        }}
        taskId={selectedTaskId || undefined}
        defaultFrequency={isCreatingNewTask ? FollowUpFrequency.WEEKLY : undefined}
      />
    </div>
  );
}
