/**
 * Tasks Page
 * Display and manage all tasks with tabs and table view
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Tasks.css';
import TaskForm from '../components/TaskForm';
import { Task, FollowUpFrequency, TaskType } from '../types';

type TabType = 'today' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'onetime' | 'misc' | 'projects' | 'habits';

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
  // Ref to track latest hourly entries (avoids stale closure issues)
  const hourlyEntriesRef = useRef<Record<string, number>>({});
  // Ref to track last pasted value to prevent wheel from overwriting it
  const lastPastedValueRef = useRef<{key: string, value: number, timestamp: number} | null>(null);
  // Ref to track if current change is from wheel event
  const isWheelChangeRef = useRef<boolean>(false);
  // Selected date for daily tab - initialize to today at midnight local time
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  // Incomplete days list
  const [incompleteDays, setIncompleteDays] = useState<any[]>([]);
  // Save timeout for debouncing
  const [saveTimeout, setSaveTimeout] = useState<number | null>(null);
  // Weekly tab state - key format: "taskId-dayIndex" (0=Sunday, 6=Saturday)
  const [weeklyEntries, setWeeklyEntries] = useState<Record<string, number>>({});
  // Ref to track latest weekly entries
  const weeklyEntriesRef = useRef<Record<string, number>>({});
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
  // Column highlighting state
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [addToTrackingAfterCreate, setAddToTrackingAfterCreate] = useState<'weekly' | 'monthly' | 'yearly' | 'onetime' | null>(null);
  
  // Monthly tab state - key format: "taskId-dayOfMonth" (1-31)
  const [monthlyEntries, setMonthlyEntries] = useState<Record<string, number>>({});
  // Ref to track latest monthly entries
  const monthlyEntriesRef = useRef<Record<string, number>>({});
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

  // Misc Tasks state (similar to Projects)
  const [miscTaskGroups, setMiscTaskGroups] = useState<ProjectData[]>([]);
  const [selectedMiscGroup, setSelectedMiscGroup] = useState<ProjectData | null>(null);
  const [miscTasks, setMiscTasks] = useState<ProjectTaskData[]>([]);
  const [showAddMiscGroupModal, setShowAddMiscGroupModal] = useState(false);
  const [showAddMiscTaskModal, setShowAddMiscTaskModal] = useState(false);
  const [editingMiscGroup, setEditingMiscGroup] = useState<ProjectData | null>(null);
  const [editingMiscTask, setEditingMiscTask] = useState<ProjectTaskData | null>(null);
  const [showEditMiscTaskModal, setShowEditMiscTaskModal] = useState(false);
  const [expandedMiscTasks, setExpandedMiscTasks] = useState<Set<number>>(new Set());
  const [projectTasksDueToday, setProjectTasksDueToday] = useState<Array<ProjectTaskData & { project_name?: string }>>([]);
  const [overdueOneTimeTasks, setOverdueOneTimeTasks] = useState<Array<OneTimeTaskData & { task_name?: string }>>([]);
  const [goalTasksDueToday, setGoalTasksDueToday] = useState<Array<any>>([]);
  const [pendingProjectId, setPendingProjectId] = useState<number | null>(null); // Track project ID from URL

  // Habits state
  interface HabitData {
    id: number;
    name: string;
    description?: string;
    habit_type: 'boolean' | 'time_based' | 'count_based';
    linked_task_id?: number;
    linked_task_name?: string;
    target_frequency: 'daily' | 'weekly' | 'monthly';
    target_value?: number;
    target_comparison: 'at_least' | 'at_most' | 'exactly';
    is_positive: boolean;
    why_reason?: string;
    start_date: string;
    end_date?: string;
    is_active: boolean;
    created_at: string;
    // New fields for enhanced tracking
    tracking_mode?: 'daily_streak' | 'occurrence' | 'occurrence_with_value' | 'aggregate';
    period_type?: 'daily' | 'weekly' | 'monthly';
    target_count_per_period?: number;
    session_target_value?: number;
    session_target_unit?: string;
    aggregate_target?: number;
    stats?: {
      total_entries: number;
      successful_entries: number;
      success_rate: number;
      current_streak: number;
      longest_streak: number;
    };
  }

  interface HabitEntry {
    id: number;
    habit_id: number;
    entry_date: string;
    is_successful: boolean;
    actual_value?: number;
    note?: string;
    created_at: string;
  }

  interface HabitStreak {
    id: number;
    start_date: string;
    end_date: string;
    streak_length: number;
    is_active: boolean;
  }

  interface HabitSession {
    id: number;
    habit_id: number;
    period_start: string;
    period_end: string;
    session_number: number;
    is_completed: boolean;
    completed_at?: string;
    value_achieved?: number;
    meets_target: boolean;
    notes?: string;
  }

  interface HabitPeriod {
    id: number;
    habit_id: number;
    period_type: 'weekly' | 'monthly';
    period_start: string;
    period_end: string;
    target_count?: number;
    completed_count: number;
    aggregate_target?: number;
    aggregate_achieved: number;
    is_successful: boolean;
    success_percentage: number;
    quality_percentage?: number;
  }

  interface PeriodStats {
    habit_id: number;
    period_start: string;
    period_end: string;
    tracking_mode: string;
    period_type: string;
    target_count?: number;
    completed_count: number;
    aggregate_target?: number;
    aggregate_achieved: number;
    success_percentage: number;
    quality_percentage?: number;
    is_successful: boolean;
    days_remaining: number;
    sessions: HabitSession[];
  }

  const [habits, setHabits] = useState<HabitData[]>([]);
  const [selectedHabit, setSelectedHabit] = useState<HabitData | null>(null);
  const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([]);
  const [habitStreaks, setHabitStreaks] = useState<HabitStreak[]>([]);
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [showHabitDetailsModal, setShowHabitDetailsModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitData | null>(null);
  const [currentPeriodStats, setCurrentPeriodStats] = useState<Record<number, PeriodStats>>({});

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

  // Wishes state
  interface WishData {
    id: number;
    title: string;
    description?: string;
    category?: string;
    dream_type?: string;
    estimated_timeframe?: string;
    estimated_cost?: number;
    priority: string;
    why_important?: string;
    emotional_impact?: string;
    life_area?: string;
    image_url?: string;
    inspiration_notes?: string;
    pillar_id?: number;
    category_id?: number;
    status: string;
    is_active: boolean;
    is_private: boolean;
    tags?: string;
    created_at: string;
    stats?: {
      days_dreaming: number;
      reflections_count: number;
      exploration_steps_total: number;
      exploration_steps_completed: number;
      exploration_progress: number;
      inspirations_count: number;
      average_clarity_score?: number;
    };
  }

  interface WishReflection {
    id: number;
    wish_id: number;
    reflection_date: string;
    reflection_text: string;
    mood?: string;
    clarity_score?: number;
    created_at: string;
  }

  interface ExplorationStep {
    id: number;
    wish_id: number;
    step_title: string;
    step_description?: string;
    step_type?: string;
    is_completed: boolean;
    completed_at?: string;
    notes?: string;
    created_at: string;
  }

  const [wishes, setWishes] = useState<WishData[]>([]);
  const [selectedWish, setSelectedWish] = useState<WishData | null>(null);
  const [showAddWishModal, setShowAddWishModal] = useState(false);
  const [showWishDetailsModal, setShowWishDetailsModal] = useState(false);

  // Get location for URL parameters
  const location = useLocation();
  const navigate = useNavigate();

  // Handle URL parameters on mount and when location changes
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    const projectParam = searchParams.get('project');
    const dateParam = searchParams.get('date');

    // Set active tab if provided
    if (tabParam) {
      const validTabs: TabType[] = ['today', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'onetime', 'projects'];
      if (validTabs.includes(tabParam as TabType)) {
        setActiveTab(tabParam as TabType);
      }
    }

    // Set selected date if provided (for daily tab)
    if (dateParam) {
      try {
        // Parse date as local (YYYY-MM-DD) to avoid timezone shift
        const [year, month, day] = dateParam.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setHours(0, 0, 0, 0);
        if (!isNaN(date.getTime())) {
          setSelectedDate(date);
        }
      } catch (e) {
        console.error('Invalid date parameter:', dateParam);
      }
    } else if (!tabParam || tabParam === 'daily') {
      // If no date param but on daily tab, ensure we're on today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setSelectedDate(today);
    }

    // Store project ID to select after projects are loaded (only if not already set)
    if (projectParam && tabParam === 'projects') {
      const projectId = parseInt(projectParam);
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
    // Don't load daily entries here - let the URL params or tab change handle it
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
    } else if (activeTab === 'misc') {
      loadMiscTaskGroups();
    } else if (activeTab === 'habits') {
      loadHabits();
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

  // Helper function to format date for input (avoids timezone issues)
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to check if a date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  };

  // Helper function to check if a date is in the future
  const isFutureDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate > today;
  };

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
      const dateStr = formatDateForInput(date);
      const entries = await api.get<any[]>(`/api/daily-time/entries/${dateStr}`);
      
      // Convert entries array to hourlyEntries map format
      const entriesMap: Record<string, number> = {};
      entries.forEach((entry: any) => {
        const key = `${entry.task_id}-${entry.hour}`;
        entriesMap[key] = entry.minutes;
      });
      
      // Update both state and ref in sync
      hourlyEntriesRef.current = entriesMap;
      setHourlyEntries(entriesMap);
    } catch (err) {
      console.error('Error loading daily entries:', err);
      // On error, reset to empty
      const emptyMap: Record<string, number> = {};
      hourlyEntriesRef.current = emptyMap;
      setHourlyEntries(emptyMap);
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
      // Group entries by task_id to find all tasks that have been edited
      const taskEntries = new Map<number, Array<{hour: number, minutes: number}>>();
      
      Object.entries(entriesToSave).forEach(([key, minutes]) => {
        const [task_id, hour] = key.split('-').map(Number);
        if (!taskEntries.has(task_id)) {
          taskEntries.set(task_id, []);
        }
        taskEntries.get(task_id)!.push({ hour, minutes });
      });
      
      // Convert to array format - include ALL entries for edited tasks (even 0s)
      const entries = Array.from(taskEntries.entries()).flatMap(([task_id, hourEntries]) => {
        return hourEntries.map(({ hour, minutes }) => ({
          task_id,
          hour,
          minutes
        }));
      });

      if (entries.length > 0) {
        const payload = {
          entry_date: formatDateForInput(selectedDate) + 'T00:00:00',
          entries: entries
        };
        
        await api.post('/api/daily-time/entries/bulk/', payload);
        
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
    // Parse as local date to avoid timezone shift
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
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
      // Also update ref
      weeklyEntriesRef.current = entriesMap;

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
      
      // Use ref to get latest entries
      const entriesToSave = weeklyEntriesRef.current;
      console.log('Current weeklyEntries:', entriesToSave);
      
      // Convert weeklyEntries map to array format
      const entries = Object.entries(entriesToSave)
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
    setWeeklyEntries(prev => {
      const newEntries = {
        ...prev,
        [key]: minutes
      };
      
      // Update ref immediately
      weeklyEntriesRef.current = newEntries;
      
      return newEntries;
    });
    
    // Debounced auto-save - wait 1 second after last input
    if (weeklySaveTimeout) {
      window.clearTimeout(weeklySaveTimeout);
    }
    
    const timeout = window.setTimeout(() => {
      saveWeeklyEntries();
    }, 1000);
    
    setWeeklySaveTimeout(timeout);
  };

  // Handle blur event for weekly - save immediately when input loses focus
  const handleWeeklyTimeBlur = () => {
    if (weeklySaveTimeout) {
      window.clearTimeout(weeklySaveTimeout);
      setWeeklySaveTimeout(null);
    }
    // Use ref to get latest value (no race condition, no delay needed)
    saveWeeklyEntries();
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
      // Also update ref
      monthlyEntriesRef.current = entriesMap;

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
      
      // Use ref to get latest entries
      const entriesToSave = monthlyEntriesRef.current;
      
      // Convert monthlyEntries map to array format
      const entries = Object.entries(entriesToSave)
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
    
    setMonthlyEntries(prev => {
      const newEntries = {
        ...prev,
        [key]: finalValue
      };
      
      // Update ref immediately
      monthlyEntriesRef.current = newEntries;
      
      return newEntries;
    });
    
    // Debounced auto-save - wait 1 second after last input
    if (monthlySaveTimeout) {
      window.clearTimeout(monthlySaveTimeout);
    }
    
    const timeout = window.setTimeout(() => {
      saveMonthlyEntries();
    }, 1000);
    
    setMonthlySaveTimeout(timeout);
  };

  // Handle blur event for monthly - save immediately when input loses focus
  const handleMonthlyTimeBlur = () => {
    if (monthlySaveTimeout) {
      window.clearTimeout(monthlySaveTimeout);
      setMonthlySaveTimeout(null);
    }
    // Use ref to get latest value (no race condition, no delay needed)
    saveMonthlyEntries();
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
      console.log('Toggling task completion:', taskId, 'from', currentStatus, 'to', !currentStatus);
      
      await api.put(`/api/projects/tasks/${taskId}`, {
        is_completed: !currentStatus
      });
      
      console.log('Task updated successfully, reloading data...');
      
      // Refresh both projects list and tasks
      await loadProjects(); // This will reload all projects with updated status
      await loadProjectTasksDueToday(); // Reload the today tasks list
      
      if (selectedProject) {
        await loadProjectTasks(selectedProject.id);
      }
      
      console.log('Data reloaded successfully');
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

  // Misc Tasks Functions (similar to Projects)
  const loadMiscTaskGroups = async () => {
    try {
      const response: any = await api.get('/api/misc-tasks/');
      const data = response.data || response;
      const groupsList = Array.isArray(data) ? data : [];
      console.log('Loaded misc task groups from API:', groupsList.map(g => ({ id: g.id, name: g.name })));
      setMiscTaskGroups(groupsList);
      
      // Load all misc tasks to check for overdue status
      if (groupsList.length > 0) {
        const allTasks: ProjectTaskData[] = [];
        for (const group of groupsList) {
          try {
            const tasksResponse: any = await api.get(`/api/misc-tasks/${group.id}/tasks`);
            const tasks = tasksResponse.data || tasksResponse;
            if (Array.isArray(tasks)) {
              allTasks.push(...tasks);
            }
          } catch (err) {
            console.error(`Error loading tasks for misc group ${group.id}:`, err);
          }
        }
        setMiscTasks(allTasks);
      }
    } catch (err: any) {
      console.error('Error loading misc task groups:', err);
      setMiscTaskGroups([]);
    }
  };

  const loadMiscTasks = async (groupId: number) => {
    try {
      const response: any = await api.get(`/api/misc-tasks/${groupId}/tasks`);
      const data = response.data || response;
      setMiscTasks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error loading misc tasks:', err);
      setMiscTasks([]);
    }
  };

  const handleSelectMiscGroup = async (group: ProjectData) => {
    setSelectedMiscGroup(group);
    await loadMiscTasks(group.id);
  };

  const handleBackToMiscGroups = () => {
    setSelectedMiscGroup(null);
    setMiscTasks([]);
    setExpandedMiscTasks(new Set());
  };

  const handleDeleteMiscGroup = async (groupId: number) => {
    if (!confirm('Are you sure you want to delete this misc task group and all its tasks?')) {
      return;
    }

    try {
      await api.delete(`/api/misc-tasks/${groupId}`);
      await loadMiscTaskGroups();
      setSelectedMiscGroup(null);
      setMiscTasks([]);
    } catch (err: any) {
      console.error('Error deleting misc task group:', err);
      alert('Failed to delete misc task group: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Habits Functions
  const loadHabits = async () => {
    try {
      const response: any = await api.get('/api/habits/');
      const data = response.data || response;
      const habitsList = Array.isArray(data) ? data : [];
      console.log('Loaded habits from API:', habitsList);
      setHabits(habitsList);
    } catch (err: any) {
      console.error('Error loading habits:', err);
      setHabits([]);
    }
  };

  const loadHabitEntries = async (habitId: number, startDate?: string, endDate?: string) => {
    try {
      let url = `/api/habits/${habitId}/entries`;
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response: any = await api.get(url);
      const data = response.data || response;
      setHabitEntries(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error loading habit entries:', err);
      setHabitEntries([]);
    }
  };

  const loadHabitStreaks = async (habitId: number) => {
    try {
      const response: any = await api.get(`/api/habits/${habitId}/top-streaks?limit=3`);
      const data = response.data || response;
      setHabitStreaks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error loading habit streaks:', err);
      setHabitStreaks([]);
    }
  };

  const handleSelectHabit = async (habit: HabitData) => {
    setSelectedHabit(habit);
    await loadHabitEntries(habit.id);
    await loadHabitStreaks(habit.id);
    setShowHabitDetailsModal(true);
  };

  const handleMarkHabitEntry = async (habitId: number, entryDate: string, isSuccessful: boolean) => {
    try {
      await api.post(`/api/habits/${habitId}/entries`, {
        entry_date: entryDate,
        is_successful: isSuccessful
      });
      
      // Reload habits to get updated stats
      await loadHabits();
      
      // If viewing this habit's details, reload entries
      if (selectedHabit?.id === habitId) {
        await loadHabitEntries(habitId);
        await loadHabitStreaks(habitId);
      }
    } catch (err: any) {
      console.error('Error marking habit entry:', err);
      alert('Failed to mark habit: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateHabit = async (habitData: any) => {
    try {
      await api.post('/api/habits/', habitData);
      await loadHabits();
      setShowAddHabitModal(false);
    } catch (err: any) {
      console.error('Error creating habit:', err);
      alert('Failed to create habit: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUpdateHabit = async (habitId: number, updates: any) => {
    try {
      await api.put(`/api/habits/${habitId}`, updates);
      await loadHabits();
      if (selectedHabit?.id === habitId) {
        const response = await api.get(`/api/habits/${habitId}`);
        setSelectedHabit(response.data);
      }
    } catch (err: any) {
      console.error('Error updating habit:', err);
      alert('Failed to update habit: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteHabit = async (habitId: number) => {
    if (!confirm('Are you sure you want to deactivate this habit?')) {
      return;
    }

    try {
      await api.delete(`/api/habits/${habitId}`);
      await loadHabits();
      setSelectedHabit(null);
      setShowHabitDetailsModal(false);
    } catch (err: any) {
      console.error('Error deleting habit:', err);
      alert('Failed to delete habit: ' + (err.response?.data?.detail || err.message));
    }
  };

  // New Period & Session Functions
  const loadPeriodStats = async (habitId: number) => {
    try {
      const response: any = await api.get(`/api/habits/${habitId}/current-period`);
      const data = response.data || response;
      setCurrentPeriodStats(prev => ({
        ...prev,
        [habitId]: data
      }));
      return data;
    } catch (err: any) {
      console.error('Error loading period stats:', err);
      return null;
    }
  };

  const initializePeriod = async (habitId: number) => {
    try {
      await api.post(`/api/habits/${habitId}/initialize-period`);
      await loadPeriodStats(habitId);
    } catch (err: any) {
      console.error('Error initializing period:', err);
      alert('Failed to initialize period: ' + (err.response?.data?.detail || err.message));
    }
  };

  const markSessionComplete = async (sessionId: number, value?: number, notes?: string) => {
    try {
      await api.post(`/api/habits/sessions/${sessionId}/complete`, {
        value,
        notes
      });
      
      // Find which habit this session belongs to and reload its stats
      const habitId = Object.keys(currentPeriodStats).find(key => {
        const stats = currentPeriodStats[parseInt(key)];
        return stats.sessions.some(s => s.id === sessionId);
      });
      
      if (habitId) {
        await loadPeriodStats(parseInt(habitId));
        await loadHabits(); // Refresh overall stats
      }
    } catch (err: any) {
      console.error('Error marking session complete:', err);
      alert('Failed to mark session: ' + (err.response?.data?.detail || err.message));
    }
  };

  const addToAggregate = async (habitId: number, value: number, entryDate?: string) => {
    try {
      await api.post(`/api/habits/${habitId}/add-aggregate`, {
        value,
        entry_date: entryDate || new Date().toISOString().split('T')[0]
      });
      
      await loadPeriodStats(habitId);
      await loadHabits(); // Refresh overall stats
    } catch (err: any) {
      console.error('Error adding to aggregate:', err);
      alert('Failed to add value: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Wish / Dream Board functions
  const loadWishes = async () => {
    try {
      const response: any = await api.get('/api/wishes/');
      const data = response.data || response;
      const wishesList = Array.isArray(data) ? data : [];
      console.log('Loaded wishes from API:', wishesList);
      setWishes(wishesList);
    } catch (err: any) {
      console.error('Error loading wishes:', err);
      setWishes([]);
    }
  };

  const handleCreateWish = async (wishData: any) => {
    try {
      await api.post('/api/wishes/', wishData);
      await loadWishes();
      setShowAddWishModal(false);
    } catch (err: any) {
      console.error('Error creating wish:', err);
      alert('Failed to create wish: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUpdateWish = async (wishId: number, updates: any) => {
    try {
      await api.put(`/api/wishes/${wishId}`, updates);
      await loadWishes();
      if (selectedWish?.id === wishId) {
        const response: any = await api.get(`/api/wishes/${wishId}`);
        setSelectedWish(response.data || response);
      }
    } catch (err: any) {
      console.error('Error updating wish:', err);
      alert('Failed to update wish: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleArchiveWish = async (wishId: number) => {
    if (!confirm('Archive this wish? You can view archived wishes later.')) {
      return;
    }

    try {
      await api.delete(`/api/wishes/${wishId}/archive`);
      await loadWishes();
      setSelectedWish(null);
      setShowWishDetailsModal(false);
    } catch (err: any) {
      console.error('Error archiving wish:', err);
      alert('Failed to archive wish: ' + (err.response?.data?.detail || err.message));
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
    
    // First, add merged column for 12 AM - 5 AM (hours 0-4)
    hours.push({
      index: 0, // We'll use index 0 to represent the merged column
      label: '12AM\n5AM',
      isSleepColumn: true, // Flag to identify this special column
      sleepHours: [0, 1, 2, 3, 4] // Hours included in this column
    });
    
    // Then add 5 AM (index 5) through 11 PM (index 23)
    for (let i = 5; i < 24; i++) {
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
    // Parse the value - allow empty string to become 0
    const minutes = value === '' ? 0 : parseInt(value);
    
    // Validate the input - if NaN or invalid, ignore the change
    if (isNaN(minutes) || minutes < 0) {
      console.warn('Invalid input value:', value);
      return;
    }
    
    const key = `${taskId}-${hour}`;
    
    // Update BOTH ref and state together to keep them in sync
    const newEntries = {
      ...hourlyEntriesRef.current,
      [key]: minutes
    };
    
    hourlyEntriesRef.current = newEntries;
    setHourlyEntries(newEntries);
    
    // Clear any existing timeout
    if (saveTimeout) {
      window.clearTimeout(saveTimeout);
    }
    
    // Debounced auto-save
    const timeout = window.setTimeout(() => {
      saveDailyEntriesWithData(hourlyEntriesRef.current);
    }, 1000);
    
    setSaveTimeout(timeout);
  };

  // Handle blur event - save immediately when input loses focus
  const handleHourlyTimeBlur = () => {
    if (saveTimeout) {
      window.clearTimeout(saveTimeout);
      setSaveTimeout(null);
    }
    saveDailyEntriesWithData(hourlyEntriesRef.current);
  };

  // Handle paste event to ensure clean paste behavior
  const handleHourlyTimePaste = (taskId: number, hour: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    const pastedText = e.clipboardData.getData('text');
    const pastedValue = parseInt(pastedText) || 0;
    const key = `${taskId}-${hour}`;
    
    // Record this paste to protect it from wheel events for 2 seconds
    lastPastedValueRef.current = {
      key,
      value: pastedValue,
      timestamp: Date.now()
    };
    
    const input = e.currentTarget;
    input.value = String(pastedValue);
    
    handleHourlyTimeChange(taskId, hour, String(pastedValue));
  };

  // Handle focus event to add paste protection
  const handleHourlyTimeFocus = (taskId: number, hour: number, e: React.FocusEvent<HTMLInputElement>) => {
    const key = `${taskId}-${hour}`;
    const input = e.currentTarget;
    
    // Prevent mouse wheel from changing value
    const wheelHandler = (wheelEvent: WheelEvent) => {
      wheelEvent.preventDefault();
      isWheelChangeRef.current = true; // Mark next change as wheel-induced
    };
    
    // Prevent arrow keys from changing value  
    const keydownHandler = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'ArrowUp' || keyEvent.key === 'ArrowDown') {
        keyEvent.preventDefault();
        isWheelChangeRef.current = true; // Mark next change as arrow-key-induced
      }
    };
    
    const pasteHandler = (pasteEvent: ClipboardEvent) => {
      pasteEvent.preventDefault();
      
      const pastedText = pasteEvent.clipboardData?.getData('text') || '';
      const pastedValue = parseInt(pastedText) || 0;
      
      // Record this paste to protect it from wheel events for 2 seconds
      lastPastedValueRef.current = {
        key,
        value: pastedValue,
        timestamp: Date.now()
      };
      
      input.value = String(pastedValue);
      handleHourlyTimeChange(taskId, hour, String(pastedValue));
    };
    
    // Add listeners
    input.addEventListener('paste', pasteHandler);
    input.addEventListener('wheel', wheelHandler, { passive: false });
    input.addEventListener('keydown', keydownHandler);
    
    // Clean up on blur
    const blurCleanup = () => {
      input.removeEventListener('paste', pasteHandler);
      input.removeEventListener('wheel', wheelHandler);
      input.removeEventListener('keydown', keydownHandler);
      input.removeEventListener('blur', blurCleanup);
    };
    input.addEventListener('blur', blurCleanup, { once: true });
  };

  // Get hourly time entry for a task and hour
  const getHourlyTime = (taskId: number, hour: number): number => {
    const key = `${taskId}-${hour}`;
    // Use state for display, as it's now in sync with ref
    return hourlyEntries[key] || 0;
  };

  // Get total time for sleep column (hours 0-4)
  const getSleepColumnTime = (taskId: number): number => {
    return [0, 1, 2, 3, 4].reduce((sum, hour) => sum + getHourlyTime(taskId, hour), 0);
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

  // Define hierarchy order for sorting (matches actual database pillar-category combinations)
  const hierarchyOrder: { [key: string]: number } = {
    // Hard Work
    'Hard Work|Office-Tasks': 1,
    'Hard Work|Learning': 2,
    'Hard Work|Confidence': 3,
    // Calmness
    'Calmness|Yoga': 4,
    'Calmness|Sleep': 5,
    // Family
    'Family|My Tasks': 6,
    'Family|Home Tasks': 7,
    'Family|Time Waste': 8,
  };

  // Define custom task name order
  const taskNameOrder: { [key: string]: number } = {
    'cd-Mails-Tickets': 1,
    'Code Coverage': 2,
    'Code - Scripts': 3,
    'Cloud': 4,
    'LLM GenAI': 5,
    'Git Jenkin Tools': 6,
    'Interview Q/A': 7,
    'Interview Talk': 8,
    'Life Coach & NLP': 9,
    'Toastmaster Task': 10,
    'Yoga - Dhyan': 11,
    'Sleep': 12,
    'Planning': 13,
    'Stocks': 14,
    'Task (Bank/ mail)': 15,
    'Commute': 16,
    'Nature Needs': 17,
    'Eating': 18,
    'My Games': 19,
    'Parent Talk': 20,
    'Home Task': 21,
    'Task Trishna': 22,
    'Task Divyanshi': 23,
    'Daughter Sports': 24,
    'Shopping': 25,
    'Family Friends': 26,
    'Youtube': 27,
    'TV': 28,
    'Facebook': 29,
    'Nextdoor': 30,
    'News': 31,
    'Dark Future': 32,
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
      
      // For TODAY tab: Only show active tasks OR tasks completed/NA today
      if (activeTab === 'today') {
        // If task is completed, only show if completed today (in local timezone)
        if (task.is_completed && task.completed_at) {
          const completedDate = new Date(task.completed_at);
          // Get local date components (not UTC)
          const completedLocalDate = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());
          const todayLocalDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          
          // Debug logging
          console.log(`Task: ${task.name}, completed_at: ${task.completed_at}, completedDate: ${completedDate}, completedLocal: ${completedLocalDate}, today: ${todayLocalDate}, match: ${completedLocalDate.getTime() === todayLocalDate.getTime()}`);
          
          return completedLocalDate.getTime() === todayLocalDate.getTime();
        }
        
        // If task is marked as NA (inactive), only show if marked today (in local timezone)
        if (!task.is_active && task.na_marked_at) {
          const naMarkedDate = new Date(task.na_marked_at);
          // Get local date components (not UTC)
          const naMarkedLocalDate = new Date(naMarkedDate.getFullYear(), naMarkedDate.getMonth(), naMarkedDate.getDate());
          const todayLocalDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          return naMarkedLocalDate.getTime() === todayLocalDate.getTime();
        }
        
        // Show all other active tasks
        return task.is_active && !task.is_completed;
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
      
      // Sort by hierarchy order first
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Within same category, sort by custom task name order
      const taskOrderA = taskNameOrder[a.name || ''] || 999;
      const taskOrderB = taskNameOrder[b.name || ''] || 999;
      
      if (taskOrderA !== taskOrderB) {
        return taskOrderA - taskOrderB;
      }
      
      // If not in custom order, sort alphabetically
      return (a.name || '').localeCompare(b.name || '');
    });

  // Separate tasks by type for daily and weekly tabs
  const timeBasedTasks = (activeTab === 'daily' || activeTab === 'weekly')
    ? filteredTasks.filter(task => task.task_type === TaskType.TIME)
    : [];
  
  const countBasedTasks = (activeTab === 'daily' || activeTab === 'weekly')
    ? filteredTasks.filter(task => task.task_type === TaskType.COUNT)
    : [];
  
  const booleanTasks = (activeTab === 'daily' || activeTab === 'weekly')
    ? filteredTasks.filter(task => task.task_type === TaskType.BOOLEAN)
    : [];

  const tabs: { key: TabType; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'quarterly', label: 'Quarterly' },
    { key: 'yearly', label: 'Yearly' },
    { key: 'onetime', label: 'Important Tasks' },
    { key: 'misc', label: 'Misc Tasks' },
    { key: 'projects', label: 'Projects' },
    { key: 'habits', label: '🎯 Habits' }
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
            value={formatDateForInput(selectedDate)}
            max={formatDateForInput(new Date())} // Prevent future dates
            onChange={(e) => {
              const [year, month, day] = e.target.value.split('-').map(Number);
              const localDate = new Date(year, month - 1, day);
              setSelectedDate(localDate);
            }}
          />
          <button className="btn-nav" onClick={() => changeDate(1)}>
            Next Day →
          </button>
          <button 
            className={`btn-nav btn-today ${isToday(selectedDate) ? 'active' : 'inactive'}`}
            onClick={() => {
              const today = new Date();
              // Set to start of day in local timezone
              today.setHours(0, 0, 0, 0);
              setSelectedDate(today);
            }}
          >
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

      {/* Important Tasks Navigator (formerly One Time Tasks) */}
      {activeTab === 'onetime' && (
        <div className="date-navigator">
          <button 
            className="btn-nav btn-add-onetime" 
            onClick={() => setShowAddOneTimeTaskModal(true)}
            style={{ backgroundColor: '#10b981', color: 'white' }}
          >
            ➕ Add Important Task
          </button>
          <span className="date-display">
            Important Tasks
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
      ) : activeTab === 'misc' ? (
        <div className="projects-container">
          {!selectedMiscGroup ? (
            // Misc Task Groups List View
            <>
              <div className="projects-header">
                <button 
                  className="btn btn-primary" 
                  onClick={() => setShowAddMiscGroupModal(true)}
                  style={{ marginBottom: '20px' }}
                >
                  ➕ Add Misc Task Group
                </button>
              </div>

              <div className="projects-grid">
                {miscTaskGroups.length === 0 ? (
                  <div className="empty-state">
                    <p>No misc task groups yet. Click "Add Misc Task Group" to get started.</p>
                  </div>
                ) : (
                  miscTaskGroups.map((group) => {
                    return (
                      <div key={group.id} className={`project-card ${group.is_completed ? 'status-completed' : 'status-not_started'}`}>
                        <div className="project-card-header">
                          <h3>{group.name}</h3>
                          <span className={`project-status status-${group.is_completed ? 'completed' : 'in_progress'}`}>
                            {group.is_completed ? 'completed' : 'in progress'}
                          </span>
                        </div>
                      
                        {group.description && (
                          <p className="project-description">{group.description}</p>
                        )}
                      
                        <div className="project-progress">
                          <div className="progress-bar">
                            <div 
                              className="progress-fill" 
                              style={{ width: `${group.progress?.progress_percentage || 0}%` }}
                            />
                          </div>
                          <span className="progress-text">
                            {group.progress?.completed_tasks || 0} / {group.progress?.total_tasks || 0} tasks completed 
                            ({group.progress?.progress_percentage || 0}%)
                          </span>
                        </div>
                      
                        <div className="project-meta">
                          {group.due_date && (
                            <div className="project-due-date">
                              🗓️ Due: {new Date(group.due_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      
                        <div className="project-actions">
                          <button 
                            className="btn btn-primary btn-view-tasks"
                            onClick={() => handleSelectMiscGroup(group)}
                          >
                            View Tasks
                          </button>
                          <button 
                            className="btn btn-danger"
                            onClick={() => handleDeleteMiscGroup(group.id)}
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
            // Misc Group Detail View with Tasks
            <>
              <div className="project-detail-header">
                <button 
                  className="btn btn-secondary" 
                  onClick={handleBackToMiscGroups}
                >
                  ← Back to Misc Tasks
                </button>
                <h2>{selectedMiscGroup.name}</h2>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setShowAddMiscTaskModal(true)}
                >
                  ➕ Add Task
                </button>
              </div>

              {selectedMiscGroup.description && (
                <p className="project-detail-description">{selectedMiscGroup.description}</p>
              )}

              <div className="project-progress" style={{ marginBottom: '20px' }}>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${selectedMiscGroup.progress?.progress_percentage || 0}%` }}
                  />
                </div>
                <span className="progress-text">
                  {selectedMiscGroup.progress?.completed_tasks || 0} / {selectedMiscGroup.progress?.total_tasks || 0} tasks completed 
                  ({selectedMiscGroup.progress?.progress_percentage || 0}%)
                </span>
              </div>

              <div className="project-tasks-tree">
                {miscTasks.length === 0 ? (
                  <div className="empty-state">
                    <p>No tasks yet. Click "Add Task" to get started.</p>
                  </div>
                ) : (
                  <div className="task-list">
                    {miscTasks.filter(t => !t.parent_task_id).map((task) => (
                      <TaskNode 
                        key={task.id} 
                        task={task} 
                        level={0}
                        isExpanded={expandedMiscTasks.has(task.id)}
                        onToggleExpand={() => {
                          const newExpanded = new Set(expandedMiscTasks);
                          if (newExpanded.has(task.id)) {
                            newExpanded.delete(task.id);
                          } else {
                            newExpanded.add(task.id);
                          }
                          setExpandedMiscTasks(newExpanded);
                        }}
                        onToggleComplete={async (taskId: number) => {
                          const task = miscTasks.find(t => t.id === taskId);
                          if (task) {
                            try {
                              await api.put(`/api/misc-tasks/tasks/${taskId}`, {
                                is_completed: !task.is_completed
                              });
                              await loadMiscTasks(selectedMiscGroup.id);
                            } catch (err: any) {
                              console.error('Error toggling task:', err);
                            }
                          }
                        }}
                        onEdit={(task: ProjectTaskData) => {
                          setEditingMiscTask(task);
                          setShowEditMiscTaskModal(true);
                        }}
                        onDelete={async (taskId: number) => {
                          if (confirm('Are you sure you want to delete this task?')) {
                            try {
                              await api.delete(`/api/misc-tasks/tasks/${taskId}`);
                              await loadMiscTasks(selectedMiscGroup.id);
                            } catch (err: any) {
                              console.error('Error deleting task:', err);
                            }
                          }
                        }}
                        children={miscTasks.filter(t => t.parent_task_id === task.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : activeTab === 'habits' ? (
        <div className="habits-container">
          <div className="habits-header">
            <h2>🎯 Your Habits</h2>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowAddHabitModal(true)}
              style={{ marginBottom: '20px' }}
            >
              ➕ Add New Habit
            </button>
          </div>

          {habits.length === 0 ? (
            <div className="empty-state">
              <p>No habits yet. Start building great habits today!</p>
              <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                Track daily habits, build streaks, and develop consistency.
              </p>
            </div>
          ) : (
            <div className="habits-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
              gap: '20px',
              marginTop: '20px'
            }}>
              {habits.map((habit) => {
                const periodStats = currentPeriodStats[habit.id];
                const trackingMode = habit.tracking_mode || 'daily_streak';
                const showPeriodTracking = ['occurrence', 'occurrence_with_value', 'aggregate'].includes(trackingMode);
                
                return (
                <div key={habit.id} className="habit-card" style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '20px',
                  backgroundColor: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'box-shadow 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'}
                >
                  <div style={{ marginBottom: '15px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
                      {habit.name}
                    </h3>
                    {habit.description && (
                      <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                        {habit.description}
                      </p>
                    )}
                    {showPeriodTracking && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        📅 {habit.period_type === 'weekly' ? 'Weekly' : 'Monthly'} • 
                        {trackingMode === 'occurrence' && ' Simple tracking'}
                        {trackingMode === 'occurrence_with_value' && ' Value tracking'}
                        {trackingMode === 'aggregate' && ' Aggregate total'}
                      </div>
                    )}
                  </div>

                  {/* Traditional streak display for daily habits */}
                  {!showPeriodTracking && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '15px',
                      backgroundColor: '#f7fafc',
                      borderRadius: '6px',
                      marginBottom: '15px'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e53e3e' }}>
                          🔥 {habit.stats?.current_streak || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          Current Streak
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3182ce' }}>
                          🏆 {habit.stats?.longest_streak || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          Best Streak
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38a169' }}>
                          {habit.stats?.success_rate || 0}%
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          Success Rate
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Period-based tracking display */}
                  {showPeriodTracking && (
                    <div style={{ marginBottom: '15px' }}>
                      {!periodStats ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const stats = await loadPeriodStats(habit.id);
                              if (!stats || stats.sessions.length === 0) {
                                await initializePeriod(habit.id);
                              }
                            }}
                          >
                            Load {habit.period_type === 'weekly' ? 'This Week' : 'This Month'}
                          </button>
                        </div>
                      ) : trackingMode === 'occurrence' || trackingMode === 'occurrence_with_value' ? (
                        <div>
                          {/* Session checkboxes */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                            gap: '10px',
                            marginBottom: '15px'
                          }}>
                            {periodStats.sessions.map((session) => (
                              <div key={session.id} style={{
                                padding: '10px',
                                border: session.is_completed ? '2px solid #48bb78' : '2px solid #e2e8f0',
                                borderRadius: '6px',
                                backgroundColor: session.is_completed ? '#f0fff4' : 'white',
                                textAlign: 'center',
                                cursor: 'pointer'
                              }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!session.is_completed) {
                                  if (trackingMode === 'occurrence_with_value') {
                                    const value = prompt(`Enter ${habit.session_target_unit || 'value'} for session ${session.session_number}:`);
                                    if (value) {
                                      await markSessionComplete(session.id, parseInt(value));
                                    }
                                  } else {
                                    await markSessionComplete(session.id);
                                  }
                                }
                              }}
                              >
                                <div style={{ fontSize: '20px', marginBottom: '4px' }}>
                                  {session.is_completed ? '✅' : '☐'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#666' }}>
                                  #{session.session_number}
                                </div>
                                {trackingMode === 'occurrence_with_value' && session.value_achieved && (
                                  <div style={{ 
                                    fontSize: '12px', 
                                    fontWeight: 'bold',
                                    color: session.meets_target ? '#38a169' : '#ed8936',
                                    marginTop: '4px'
                                  }}>
                                    {session.value_achieved}
                                    {session.meets_target ? ' ⭐' : ' ⚠️'}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Progress stats */}
                          <div style={{
                            padding: '12px',
                            backgroundColor: '#f7fafc',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span>Progress:</span>
                              <span style={{ fontWeight: 'bold' }}>
                                {periodStats.completed_count} / {periodStats.target_count} 
                                ({Math.round(periodStats.success_percentage)}%)
                              </span>
                            </div>
                            {trackingMode === 'occurrence_with_value' && periodStats.quality_percentage !== undefined && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Quality:</span>
                                <span style={{ fontWeight: 'bold', color: periodStats.quality_percentage >= 75 ? '#38a169' : '#ed8936' }}>
                                  {Math.round(periodStats.quality_percentage)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : trackingMode === 'aggregate' ? (
                        <div>
                          {/* Progress bar */}
                          <div style={{ marginBottom: '15px' }}>
                            <div style={{
                              width: '100%',
                              height: '30px',
                              backgroundColor: '#e2e8f0',
                              borderRadius: '15px',
                              overflow: 'hidden',
                              position: 'relative'
                            }}>
                              <div style={{
                                width: `${Math.min(periodStats.success_percentage, 100)}%`,
                                height: '100%',
                                backgroundColor: periodStats.success_percentage >= 100 ? '#48bb78' : '#3182ce',
                                transition: 'width 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '13px'
                              }}>
                                {Math.round(periodStats.success_percentage)}%
                              </div>
                            </div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginTop: '8px',
                              fontSize: '13px',
                              color: '#666'
                            }}>
                              <span>{periodStats.aggregate_achieved} {habit.session_target_unit}</span>
                              <span>Goal: {periodStats.aggregate_target} {habit.session_target_unit}</span>
                            </div>
                          </div>

                          {/* Add value input */}
                          <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              placeholder={`Add ${habit.session_target_unit || 'value'}`}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                              onKeyPress={async (e) => {
                                if (e.key === 'Enter') {
                                  const input = e.currentTarget;
                                  const value = parseInt(input.value);
                                  if (value && value > 0) {
                                    await addToAggregate(habit.id, value);
                                    input.value = '';
                                  }
                                }
                              }}
                            />
                            <button
                              className="btn btn-sm btn-primary"
                              style={{ padding: '8px 16px' }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                const value = parseInt(input.value);
                                if (value && value > 0) {
                                  await addToAggregate(habit.id, value);
                                  input.value = '';
                                }
                              }}
                            >
                              Add
                            </button>
                          </div>

                          {/* Pace info */}
                          <div style={{
                            marginTop: '10px',
                            padding: '8px',
                            backgroundColor: '#f7fafc',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#666'
                          }}>
                            {periodStats.days_remaining > 0 && periodStats.aggregate_target ? (
                              <>
                                📊 {periodStats.days_remaining} days left • 
                                Need {Math.ceil((periodStats.aggregate_target - periodStats.aggregate_achieved) / periodStats.days_remaining)} 
                                {' '}{habit.session_target_unit}/day
                              </>
                            ) : (
                              '✨ Period ending soon!'
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Quick action buttons for daily habits */}
                  {!showPeriodTracking && (
                    <div style={{ display: 'flex', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="btn btn-sm"
                        style={{ 
                          flex: 1,
                          padding: '10px',
                          backgroundColor: '#48bb78',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                        onClick={() => handleMarkHabitEntry(habit.id, new Date().toISOString().split('T')[0], true)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#38a169'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#48bb78'}
                      >
                        ✅ Done Today
                      </button>
                      <button 
                        className="btn btn-sm"
                        style={{ 
                          flex: 1,
                          padding: '10px',
                          backgroundColor: '#fc8181',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                        onClick={() => handleMarkHabitEntry(habit.id, new Date().toISOString().split('T')[0], false)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e53e3e'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fc8181'}
                      >
                        ❌ Missed
                      </button>
                    </div>
                  )}

                  {habit.linked_task_name && (
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '8px', 
                      backgroundColor: '#edf2f7',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#4a5568'
                    }}>
                      🔗 Linked to: <strong>{habit.linked_task_name}</strong>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="empty-state">
          <p>No {activeTab} tasks yet.</p>
          <button className="btn btn-primary" onClick={() => setIsTaskFormOpen(true)}>
            Create Task
          </button>
        </div>
      ) : activeTab === 'daily' ? (
        /* DAILY TAB: Three separate tables by task type */
        <>
          {/* TIME-BASED TASKS TABLE */}
          {timeBasedTasks.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header time-based">
                <span className="emoji">⏰</span>
                <span>Time-Based Tasks</span>
              </h3>
              <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
                <table className="tasks-table daily-table">
                  <thead>
                    <tr>
                      <th className={`col-task sticky-col sticky-col-1 ${hoveredColumn === -1 ? 'column-highlight' : ''}`}>Task</th>
                      {hourLabels.map(hour => (
                        <th 
                          key={hour.index} 
                          className={`col-hour ${hoveredColumn === hour.index ? 'column-highlight' : ''}`}
                          data-col={hour.index}
                        >
                          {hour.label}
                        </th>
                      ))}
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeBasedTasks.map((task, taskIndex) => {
                      const rowClassName = task.is_completed ? 'completed-row' : !task.is_active ? 'na-row' : '';
                      return (
                        <tr key={task.id} className={rowClassName}>
                          <td 
                            className={`col-task sticky-col sticky-col-1 ${hoveredColumn === -1 ? 'column-highlight' : ''}`}
                            onMouseEnter={() => setHoveredColumn(-1)}
                            onMouseLeave={() => setHoveredColumn(null)}
                          >
                            <div 
                              className="task-name task-link"
                              onClick={() => handleTaskClick(task.id)}
                              style={{ cursor: 'pointer' }}
                              title={
                                task.pillar_name 
                                  ? `${task.pillar_name}${task.category_name ? ` - ${task.category_name}` : ''}\nClick to edit`
                                  : 'Click to edit'
                              }
                            >
                              {task.name}
                              <span style={{ marginLeft: '8px', fontSize: '12px', color: '#718096' }}>
                                ({formatTaskTarget(task, false, false)})
                              </span>
                            </div>
                          </td>
                          
                          {/* 24 hourly columns */}
                          {hourLabels.map(hour => {
                            const displayValue = getHourlyTime(task.id, hour.index);
                            
                            return (
                              <td 
                                key={hour.index} 
                                className={`col-hour ${hoveredColumn === hour.index ? 'column-highlight' : ''}`}
                                data-col={hour.index}
                                onMouseEnter={() => setHoveredColumn(hour.index)}
                                onMouseLeave={() => setHoveredColumn(null)}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  max="60"
                                  step="1"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  className="hour-input"
                                  value={displayValue || ''}
                                  data-row={taskIndex}
                                  data-col={hour.index}
                                  onChange={(e) => handleHourlyTimeChange(task.id, hour.index, e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  onWheel={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                  }}
                                  onKeyDown={(e) => {
                                    const input = e.currentTarget;
                                    const row = parseInt(input.dataset.row || '0');
                                    const col = parseInt(input.dataset.col || '0');
                                    
                                    if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      const nextInput = document.querySelector(`input[data-row="${row - 1}"][data-col="${col}"]`) as HTMLInputElement;
                                      if (nextInput) nextInput.focus();
                                    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                      e.preventDefault();
                                      const nextInput = document.querySelector(`input[data-row="${row + 1}"][data-col="${col}"]`) as HTMLInputElement;
                                      if (nextInput) nextInput.focus();
                                    } else if (e.key === 'ArrowLeft') {
                                      e.preventDefault();
                                      const nextInput = document.querySelector(`input[data-row="${row}"][data-col="${col - 1}"]`) as HTMLInputElement;
                                      if (nextInput) nextInput.focus();
                                    } else if (e.key === 'ArrowRight') {
                                      e.preventDefault();
                                      const nextInput = document.querySelector(`input[data-row="${row}"][data-col="${col + 1}"]`) as HTMLInputElement;
                                      if (nextInput) nextInput.focus();
                                    }
                                  }}
                                  placeholder="0"
                                  disabled={task.is_completed || !task.is_active || isFutureDate(selectedDate)}
                                />
                              </td>
                            );
                          })}
                          
                          {/* Action buttons column */}
                          <td className="col-actions">
                            {task.is_completed ? (
                              <span className="completed-text">✓ Done</span>
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
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const totalAllocated = timeBasedTasks
                        .filter(task => task.is_active)
                        .reduce((sum, task) => sum + task.allocated_minutes, 0);
                      const totalSpent = timeBasedTasks
                        .filter(task => task.is_active)
                        .reduce((sum, task) => 
                          sum + hourLabels.reduce((hourSum, hour) => {
                            return hourSum + getHourlyTime(task.id, hour.index);
                          }, 0)
                        , 0);
                      const totalHours = totalAllocated / 60;
                      const isExactly24 = totalHours === 24;
                      
                      return (
                        <tr className={`total-row ${!isExactly24 ? 'total-mismatch' : ''}`}>
                          <td className={`col-task ${hoveredColumn === -1 ? 'column-highlight' : ''}`}>
                            <strong>Total Time</strong><br/>
                            <small style={{ fontSize: '11px', color: '#666' }}>
                              Allocated: {totalAllocated} min ({totalHours.toFixed(2)}h) | Spent: {totalSpent} min
                            </small>
                          </td>
                          {hourLabels.map(hour => {
                            const hourTotal = timeBasedTasks
                              .filter(task => task.is_active)
                              .reduce((sum, task) => {
                                return sum + getHourlyTime(task.id, hour.index);
                              }, 0);
                            // For sleep column (5 hours), check if not exactly 300 minutes
                            const expectedMinutes = (hour as any).isSleepColumn ? 300 : 60;
                            const isNotExpected = hourTotal !== expectedMinutes;
                            return (
                              <td 
                                key={hour.index} 
                                className={`col-hour ${isNotExpected ? 'hour-over-limit' : ''} ${hoveredColumn === hour.index ? 'column-highlight' : ''}`}
                                data-col={hour.index}
                              >
                                <strong>{hourTotal || '-'}</strong>
                              </td>
                            );
                          })}
                          <td className="col-actions"></td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* COUNT-BASED TASKS TABLE */}
          {countBasedTasks.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header count-based">
                <span className="emoji">🔢</span>
                <span>Count-Based Tasks</span>
              </h3>
              <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
                <table className="tasks-table">
                  <thead>
                    <tr>
                      <th className="col-task sticky-col sticky-col-1">Task</th>
                      <th className="col-time">Target</th>
                      <th className="col-time">Completed</th>
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countBasedTasks.map((task, taskIndex) => {
                      const rowClassName = task.is_completed ? 'completed-row' : !task.is_active ? 'na-row' : '';
                      // For count tasks, store in hour 0
                      const value = getHourlyTime(task.id, 0);
                      const target = task.target_value || 0;
                      const isComplete = value >= target;
                      
                      return (
                        <tr key={task.id} className={rowClassName}>
                          <td className="col-task sticky-col sticky-col-1">
                            <div 
                              className="task-name task-link"
                              onClick={() => handleTaskClick(task.id)}
                              style={{ cursor: 'pointer' }}
                              title={
                                task.pillar_name 
                                  ? `${task.pillar_name}${task.category_name ? ` - ${task.category_name}` : ''}\nClick to edit`
                                  : 'Click to edit'
                              }
                            >
                              {task.name}
                            </div>
                          </td>
                          
                          <td className="col-time">
                            {formatTaskTarget(task, false, false)}
                          </td>
                          
                          <td className="col-time">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="hour-input"
                              style={{ maxWidth: '80px' }}
                              value={value || ''}
                              data-row={taskIndex}
                              data-col={0}
                              onChange={(e) => handleHourlyTimeChange(task.id, 0, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onWheel={(e) => {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }}
                              onKeyDown={(e) => {
                                const input = e.currentTarget;
                                const row = parseInt(input.dataset.row || '0');
                                
                                if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  const nextInput = document.querySelector(`input[data-row="${row - 1}"][data-col="0"]`) as HTMLInputElement;
                                  if (nextInput) nextInput.focus();
                                } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                  e.preventDefault();
                                  const nextInput = document.querySelector(`input[data-row="${row + 1}"][data-col="0"]`) as HTMLInputElement;
                                  if (nextInput) nextInput.focus();
                                }
                              }}
                              placeholder="0"
                              disabled={task.is_completed || !task.is_active || isFutureDate(selectedDate)}
                            />
                            <span style={{ marginLeft: '4px', fontSize: '12px', color: '#718096' }}>
                              {task.unit}
                            </span>
                          </td>
                          
                          <td className="col-actions">
                            {task.is_completed ? (
                              <span className="completed-text">✓ Done</span>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* YES/NO TASKS TABLE */}
          {booleanTasks.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header boolean-based">
                <span className="emoji">✅</span>
                <span>Yes/No Tasks</span>
              </h3>
              <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
                <table className="tasks-table">
                  <thead>
                    <tr>
                      <th className="col-task sticky-col sticky-col-1">Task</th>
                      <th className="col-time">Completed</th>
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booleanTasks.map((task, taskIndex) => {
                      const rowClassName = task.is_completed ? 'completed-row' : !task.is_active ? 'na-row' : '';
                      // For boolean tasks, store in hour 0
                      const value = getHourlyTime(task.id, 0);
                      const isChecked = value > 0;
                      
                      return (
                        <tr key={task.id} className={rowClassName}>
                          <td className="col-task sticky-col sticky-col-1">
                            <div 
                              className="task-name task-link"
                              onClick={() => handleTaskClick(task.id)}
                              style={{ cursor: 'pointer' }}
                              title={
                                task.pillar_name 
                                  ? `${task.pillar_name}${task.category_name ? ` - ${task.category_name}` : ''}\nClick to edit`
                                  : 'Click to edit'
                              }
                            >
                              {task.name}
                            </div>
                          </td>
                          
                          <td className="col-time">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleHourlyTimeChange(task.id, 0, e.target.checked ? '1' : '0')}
                              disabled={task.is_completed || !task.is_active || isFutureDate(selectedDate)}
                              style={{ 
                                width: '20px', 
                                height: '20px', 
                                cursor: 'pointer' 
                              }}
                            />
                          </td>
                          
                          <td className="col-actions">
                            {task.is_completed ? (
                              <span className="completed-text">✓ Done</span>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : activeTab === 'weekly' ? (
        /* WEEKLY TAB: Three separate tables with aggregated data from daily */
        <>
          {/* TIME-BASED TASKS TABLE */}
          {timeBasedTasks.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header time-based">
                <span className="emoji">⏰</span>
                <span>Time-Based Tasks</span>
                <span className="subtitle">(Auto-calculated from Daily)</span>
              </h3>
              <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
                <table className="tasks-table daily-table">
                  <thead>
                    <tr>
                      <th className="col-task sticky-col sticky-col-1">Task</th>
                      <th className="col-time sticky-col sticky-col-2">Target</th>
                      <th className="col-time sticky-col sticky-col-3">Spent<br/>(Average/day)</th>
                      <th className="col-time sticky-col sticky-col-4">Remaining<br/>(Average/day)</th>
                      {weekDays.map(day => (
                        <th key={day.index} className="col-hour">{day.label}</th>
                      ))}
                      <th className="col-status">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeBasedTasks.map((task) => {
                      const totalSpent = weekDays.reduce((sum, day) => sum + getWeeklyTime(task.id, day.index), 0);
                      const weeklyTarget = task.allocated_minutes * 7;
                      const avgSpentPerDay = Math.round(totalSpent / 7);
                      const remaining = weeklyTarget - totalSpent;
                      const avgRemainingPerDay = Math.round(remaining / 7);
                      const isComplete = totalSpent >= weeklyTarget;
                      const colorClass = getWeeklyRowColorClass(task);
                      const rowClassName = isComplete ? 'completed-row' : '';
                      
                      return (
                        <tr key={task.id} className={rowClassName}>
                          <td className={`col-task sticky-col sticky-col-1 ${colorClass}`}>
                            <div className="task-name">
                              {task.name}
                              <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>
                            </div>
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-2 ${colorClass}`}>
                            {weeklyTarget} min
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-3 ${colorClass}`}>
                            {avgSpentPerDay} min
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-4 ${colorClass}`}>
                            {avgRemainingPerDay} min
                          </td>
                          
                          {weekDays.map(day => {
                            const dayTotal = getWeeklyTime(task.id, day.index);
                            return (
                              <td key={day.index} className="col-hour" style={{ 
                                backgroundColor: dayTotal > 0 ? '#e6ffed' : '#fff',
                                textAlign: 'center',
                                fontSize: '12px'
                              }}>
                                {dayTotal || '-'}
                              </td>
                            );
                          })}
                          
                          <td className="col-status">
                            {isComplete ? '✓ Complete' : `${totalSpent}/${weeklyTarget}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* COUNT-BASED TASKS TABLE */}
          {countBasedTasks.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header count-based">
                <span className="emoji">🔢</span>
                <span>Count-Based Tasks</span>
                <span className="subtitle">(Auto-calculated from Daily)</span>
              </h3>
              <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
                <table className="tasks-table daily-table">
                  <thead>
                    <tr>
                      <th className="col-task sticky-col sticky-col-1">Task</th>
                      <th className="col-time sticky-col sticky-col-2">Target</th>
                      <th className="col-time sticky-col sticky-col-3">Total Count</th>
                      <th className="col-time sticky-col sticky-col-4">Days Done</th>
                      {weekDays.map(day => (
                        <th key={day.index} className="col-hour">{day.label}</th>
                      ))}
                      <th className="col-status">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countBasedTasks.map((task) => {
                      const weeklyTarget = (task.target_value || 0) * 7;
                      const totalCount = weekDays.reduce((sum, day) => {
                        const key = `count-${task.id}`;
                        return sum + (getWeeklyTime(task.id, day.index) || 0);
                      }, 0);
                      const daysDone = weekDays.filter(day => getWeeklyTime(task.id, day.index) > 0).length;
                      const isComplete = totalCount >= weeklyTarget;
                      const rowClassName = isComplete ? 'completed-row' : '';
                      
                      return (
                        <tr key={task.id} className={rowClassName}>
                          <td className="col-task sticky-col sticky-col-1">
                            <div className="task-name">
                              {task.name}
                              <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>
                            </div>
                          </td>
                          
                          <td className="col-time sticky-col sticky-col-2">
                            {weeklyTarget} {task.unit}
                          </td>
                          
                          <td className="col-time sticky-col sticky-col-3">
                            {totalCount} {task.unit}
                          </td>
                          
                          <td className="col-time sticky-col sticky-col-4">
                            {daysDone}/7 days
                          </td>
                          
                          {weekDays.map(day => {
                            const dayCount = getWeeklyTime(task.id, day.index);
                            return (
                              <td key={day.index} className="col-hour" style={{ 
                                backgroundColor: dayCount > 0 ? '#e6ffed' : '#fff',
                                textAlign: 'center',
                                fontSize: '12px'
                              }}>
                                {dayCount || '-'}
                              </td>
                            );
                          })}
                          
                          <td className="col-status">
                            {isComplete ? '✓ Complete' : `${totalCount}/${weeklyTarget}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* YES/NO TASKS TABLE */}
          {booleanTasks.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header boolean-based">
                <span className="emoji">✅</span>
                <span>Yes/No Tasks</span>
                <span className="subtitle">(Auto-calculated from Daily)</span>
              </h3>
              <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
                <table className="tasks-table daily-table">
                  <thead>
                    <tr>
                      <th className="col-task sticky-col sticky-col-1">Task</th>
                      <th className="col-time sticky-col sticky-col-2">Days Completed</th>
                      <th className="col-time sticky-col sticky-col-3">Completion Rate</th>
                      <th className="col-time sticky-col sticky-col-4">Current Streak</th>
                      {weekDays.map(day => (
                        <th key={day.index} className="col-hour">{day.label}</th>
                      ))}
                      <th className="col-status">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booleanTasks.map((task) => {
                      const daysCompleted = weekDays.filter(day => getWeeklyTime(task.id, day.index) > 0).length;
                      const completionRate = Math.round((daysCompleted / 7) * 100);
                      
                      // Calculate current streak
                      let currentStreak = 0;
                      for (let i = weekDays.length - 1; i >= 0; i--) {
                        if (getWeeklyTime(task.id, weekDays[i].index) > 0) {
                          currentStreak++;
                        } else {
                          break;
                        }
                      }
                      
                      const isComplete = daysCompleted === 7;
                      const rowClassName = isComplete ? 'completed-row' : '';
                      
                      return (
                        <tr key={task.id} className={rowClassName}>
                          <td className="col-task sticky-col sticky-col-1">
                            <div className="task-name">
                              {task.name}
                              <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>
                            </div>
                          </td>
                          
                          <td className="col-time sticky-col sticky-col-2">
                            {daysCompleted}/7 days
                          </td>
                          
                          <td className="col-time sticky-col sticky-col-3">
                            {completionRate}%
                          </td>
                          
                          <td className="col-time sticky-col sticky-col-4">
                            {currentStreak > 0 ? `${currentStreak} days 🔥` : '-'}
                          </td>
                          
                          {weekDays.map(day => {
                            const isDone = getWeeklyTime(task.id, day.index) > 0;
                            return (
                              <td key={day.index} className="col-hour" style={{ 
                                backgroundColor: isDone ? '#e6ffed' : '#fff',
                                textAlign: 'center',
                                fontSize: '16px'
                              }}>
                                {isDone ? '✓' : '✗'}
                              </td>
                            );
                          })}
                          
                          <td className="col-status">
                            {isComplete ? '🌟 Perfect Week!' : `${completionRate}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* OTHER TABS: Keep existing single table */
        <div className="tasks-table-container">
          <table className={`tasks-table ${activeTab === 'weekly' || activeTab === 'monthly' || activeTab === 'yearly' ? 'daily-table' : ''}`}>
            <thead>
              <tr>
                <th className="col-task sticky-col sticky-col-1">Task</th>
                {activeTab === 'weekly' ? (
                  <>
                    <th className="col-time sticky-col sticky-col-2">Allocated</th>
                    <th className="col-time sticky-col sticky-col-3">Spent<br/>(Average)</th>
                    <th className="col-time sticky-col sticky-col-4">Remaining<br/>(Average)</th>
                    {weekDays.map(day => (
                      <th key={day.index} className="col-hour">{day.label}</th>
                    ))}
                    <th className="col-status">Status</th>
                  </>
                ) : activeTab === 'monthly' ? (
                  <>
                    <th className="col-time sticky-col sticky-col-2">Allocated</th>
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
                    <th className="col-time sticky-col sticky-col-2">Allocated</th>
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
                    <th className="col-time">Allocated</th>
                    {activeTab !== 'today' && <th className="col-time">Spent</th>}
                    {activeTab !== 'today' && <th className="col-time">Remaining</th>}
                    <th className="col-status">Status</th>
                    {activeTab !== 'today' && <th className="col-due">Due Date</th>}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, taskIndex) => {
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
                      title={
                        hasDailyAggregates 
                          ? 'Task with daily aggregates - edit time in Daily tab' 
                          : task.pillar_name 
                            ? `${task.pillar_name}${task.category_name ? ` - ${task.category_name}` : ''}\nClick to edit`
                            : 'Click to edit'
                      }
                    >
                      {task.name}
                      {activeTab === 'daily' && (
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#718096' }}>
                          ({formatTaskTarget(task, false, false)})
                        </span>
                      )}
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
                  </td>
                  
                  {activeTab === 'daily' ? (
                    <>
                      {/* 24 hourly columns */}
                      {hourLabels.map(hour => {
                        const isBoolean = task.task_type === TaskType.BOOLEAN;
                        const isSleepCol = (hour as any).isSleepColumn;
                        const displayValue = isSleepCol ? getSleepColumnTime(task.id) : getHourlyTime(task.id, hour.index);
                        
                        return (
                          <td key={hour.index} className="col-hour">
                            {isBoolean ? (
                              <input
                                type="checkbox"
                                className="hour-input"
                                checked={displayValue > 0}
                                onChange={(e) => handleHourlyTimeChange(task.id, hour.index, e.target.checked ? '1' : '0')}
                                onBlur={handleHourlyTimeBlur}
                                title={isSleepCol ? "Mark sleep hours as done" : "Mark as done"}
                                style={{ cursor: 'pointer' }}
                                disabled={isFutureDate(selectedDate)}
                              />
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max={task.task_type === TaskType.COUNT ? undefined : (isSleepCol ? 300 : 60)}
                                className="hour-input"
                                value={displayValue || ''}
                                onChange={(e) => handleHourlyTimeChange(task.id, hour.index, e.target.value)}
                                onPaste={(e) => handleHourlyTimePaste(task.id, hour.index, e)}
                                onFocus={(e) => handleHourlyTimeFocus(task.id, hour.index, e)}
                                onWheel={(e) => e.preventDefault()}
                                data-row={taskIndex}
                                data-col={hour.index}
                                onKeyDown={(e) => {
                                  // Excel-like arrow key navigation
                                  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                                    e.preventDefault();
                                    
                                    const currentInput = e.currentTarget;
                                    const currentRow = parseInt(currentInput.dataset.row || '0');
                                    const currentCol = parseInt(currentInput.dataset.col || '0');
                                    
                                    let targetRow = currentRow;
                                    let targetCol = currentCol;
                                    
                                    switch(e.key) {
                                      case 'ArrowUp':
                                        targetRow = currentRow - 1;
                                        break;
                                      case 'ArrowDown':
                                      case 'Enter':
                                        targetRow = currentRow + 1;
                                        break;
                                      case 'ArrowLeft':
                                        targetCol = currentCol - 1;
                                        break;
                                      case 'ArrowRight':
                                        targetCol = currentCol + 1;
                                        break;
                                    }
                                    
                                    // Find the target input
                                    const targetInput = document.querySelector(
                                      `input[data-row="${targetRow}"][data-col="${targetCol}"]`
                                    ) as HTMLInputElement;
                                    
                                    if (targetInput && !targetInput.disabled) {
                                      targetInput.focus();
                                      targetInput.select(); // Select all text for easy replacement
                                    }
                                  }
                                }}
                                onBlur={handleHourlyTimeBlur}
                                placeholder="0"
                                title={task.task_type === TaskType.COUNT ? 'Enter count' : 'Enter minutes'}
                                disabled={isFutureDate(selectedDate)}
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
                      {/* Allocated column */}
                      <td className={`col-time sticky-col sticky-col-2 ${colorClass}`}>
                        {formatTaskTarget(task, true, false)}
                      </td>
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
                                onBlur={handleWeeklyTimeBlur}
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
                                onBlur={handleWeeklyTimeBlur}
                                placeholder="0"
                                data-row={taskIndex}
                                data-col={day.index}
                                onKeyDown={(e) => {
                                  // Excel-like arrow key navigation
                                  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                                    e.preventDefault();
                                    
                                    const currentInput = e.currentTarget;
                                    const currentRow = parseInt(currentInput.dataset.row || '0');
                                    const currentCol = parseInt(currentInput.dataset.col || '0');
                                    
                                    let targetRow = currentRow;
                                    let targetCol = currentCol;
                                    
                                    switch(e.key) {
                                      case 'ArrowUp':
                                        targetRow = currentRow - 1;
                                        break;
                                      case 'ArrowDown':
                                      case 'Enter':
                                        targetRow = currentRow + 1;
                                        break;
                                      case 'ArrowLeft':
                                        targetCol = currentCol - 1;
                                        break;
                                      case 'ArrowRight':
                                        targetCol = currentCol + 1;
                                        break;
                                    }
                                    
                                    // Find the target input
                                    const targetInput = document.querySelector(
                                      `input[data-row="${targetRow}"][data-col="${targetCol}"]`
                                    ) as HTMLInputElement;
                                    
                                    if (targetInput && !targetInput.disabled) {
                                      targetInput.focus();
                                      targetInput.select();
                                    }
                                  }
                                }}
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
                      {/* Allocated column */}
                      <td className={`col-time sticky-col sticky-col-2 ${getMonthlyRowColorClass(task)}`}>
                        {formatTaskTarget(task, true, true)}
                      </td>
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
                                  onBlur={handleMonthlyTimeBlur}
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
                                  onBlur={handleMonthlyTimeBlur}
                                  placeholder="0"
                                  data-row={taskIndex}
                                  data-col={day}
                                  onKeyDown={(e) => {
                                    // Excel-like arrow key navigation
                                    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                                      e.preventDefault();
                                      
                                      const currentInput = e.currentTarget;
                                      const currentRow = parseInt(currentInput.dataset.row || '0');
                                      const currentCol = parseInt(currentInput.dataset.col || '0');
                                      
                                      let targetRow = currentRow;
                                      let targetCol = currentCol;
                                      
                                      switch(e.key) {
                                        case 'ArrowUp':
                                          targetRow = currentRow - 1;
                                          break;
                                        case 'ArrowDown':
                                        case 'Enter':
                                          targetRow = currentRow + 1;
                                          break;
                                        case 'ArrowLeft':
                                          targetCol = currentCol - 1;
                                          break;
                                        case 'ArrowRight':
                                          targetCol = currentCol + 1;
                                          break;
                                      }
                                      
                                      // Find the target input
                                      const targetInput = document.querySelector(
                                        `input[data-row="${targetRow}"][data-col="${targetCol}"]`
                                      ) as HTMLInputElement;
                                      
                                      if (targetInput && !targetInput.disabled) {
                                        targetInput.focus();
                                        targetInput.select();
                                      }
                                    }
                                  }}
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
                      {/* Allocated column */}
                      <td className={`col-time sticky-col sticky-col-2 ${getYearlyRowColorClass(task)}`}>
                        {formatTaskTarget(task, true, true)}
                      </td>
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
                                  data-row={taskIndex}
                                  data-col={month}
                                  onKeyDown={(e) => {
                                    // Excel-like arrow key navigation
                                    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                                      e.preventDefault();
                                      
                                      const currentInput = e.currentTarget;
                                      const currentRow = parseInt(currentInput.dataset.row || '0');
                                      const currentCol = parseInt(currentInput.dataset.col || '0');
                                      
                                      let targetRow = currentRow;
                                      let targetCol = currentCol;
                                      
                                      switch(e.key) {
                                        case 'ArrowUp':
                                          targetRow = currentRow - 1;
                                          break;
                                        case 'ArrowDown':
                                        case 'Enter':
                                          targetRow = currentRow + 1;
                                          break;
                                        case 'ArrowLeft':
                                          targetCol = currentCol - 1;
                                          break;
                                        case 'ArrowRight':
                                          targetCol = currentCol + 1;
                                          break;
                                      }
                                      
                                      // Find the target input
                                      const targetInput = document.querySelector(
                                        `input[data-row="${targetRow}"][data-col="${targetCol}"]`
                                      ) as HTMLInputElement;
                                      
                                      if (targetInput && !targetInput.disabled) {
                                        targetInput.focus();
                                        targetInput.select();
                                      }
                                    }
                                  }}
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
                      <td className="col-time">{formatTaskValue(task, task.allocated_minutes)}</td>
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
                    sum + hourLabels.reduce((hourSum, hour) => {
                      const isSleepCol = (hour as any).isSleepColumn;
                      return hourSum + (isSleepCol ? getSleepColumnTime(task.id) : getHourlyTime(task.id, hour.index));
                    }, 0)
                  , 0);
                const totalHours = totalAllocated / 60;
                const isExactly24 = totalHours === 24;
                
                return (
                  <tr className={`total-row ${!isExactly24 ? 'total-mismatch' : ''}`}>
                    <td className="col-task sticky-col sticky-col-1">
                      <strong>Total Time</strong><br/>
                      <small style={{ fontSize: '11px', color: '#666' }}>
                        Allocated: {totalAllocated} min ({totalHours.toFixed(2)}h) | Spent: {totalSpent} min
                      </small>
                    </td>
                    {hourLabels.map(hour => {
                      const isSleepCol = (hour as any).isSleepColumn;
                      const hourTotal = filteredTasks
                        .filter(task => task.is_active)
                        .reduce((sum, task) => {
                          return sum + (isSleepCol ? getSleepColumnTime(task.id) : getHourlyTime(task.id, hour.index));
                        }, 0);
                      // For sleep column (5 hours), check if not exactly 300 minutes
                      const expectedMinutes = isSleepCol ? 300 : 60;
                      const isNotExpected = hourTotal !== expectedMinutes;
                      return (
                        <td key={hour.index} className={`col-hour ${isNotExpected ? 'hour-over-limit' : ''}`}>
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
                          onChange={(e) => {
                            console.log('Checkbox clicked for task:', task.id, 'Current status:', task.is_completed);
                            handleToggleTaskCompletion(task.id, task.is_completed);
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', pointerEvents: 'auto' }}
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
                    .filter(task => {
                      // Only show daily tasks
                      if (task.follow_up_frequency !== 'daily') return false;
                      
                      // Don't show if already added to this week
                      if (weeklyTaskStatuses[task.id]) return false;
                      
                      // Include all daily tasks (active, completed today, or marked NA today)
                      // This matches the Daily tab filtering logic
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      // If completed, include if completed today
                      if (task.is_completed && task.completed_at) {
                        const completedDate = new Date(task.completed_at);
                        completedDate.setHours(0, 0, 0, 0);
                        if (completedDate.getTime() === today.getTime()) return true;
                        return false; // Completed but not today
                      }
                      
                      // If marked NA, include if marked today
                      if (!task.is_active && task.na_marked_at) {
                        const naMarkedDate = new Date(task.na_marked_at);
                        naMarkedDate.setHours(0, 0, 0, 0);
                        if (naMarkedDate.getTime() === today.getTime()) return true;
                        return false; // Marked NA but not today
                      }
                      
                      // Include all other active tasks
                      return task.is_active;
                    })
                    .sort((a, b) => {
                      // Sort by pillar-category hierarchy order (same as Daily tab)
                      const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                      const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      
                      // Sort by hierarchy order first
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      
                      // Within same category, sort by custom task name order
                      const taskOrderA = taskNameOrder[a.name || ''] || 999;
                      const taskOrderB = taskNameOrder[b.name || ''] || 999;
                      
                      if (taskOrderA !== taskOrderB) {
                        return taskOrderA - taskOrderB;
                      }
                      
                      // If not in custom order, sort alphabetically
                      return (a.name || '').localeCompare(b.name || '');
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
                    .filter(task => {
                      // Only show daily tasks
                      if (task.follow_up_frequency !== 'daily') return false;
                      
                      // Don't show if already added to this month
                      if (monthlyTaskStatuses[task.id]) return false;
                      
                      // Include all daily tasks (active, completed today, or marked NA today)
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      // If completed, include if completed today
                      if (task.is_completed && task.completed_at) {
                        const completedDate = new Date(task.completed_at);
                        completedDate.setHours(0, 0, 0, 0);
                        if (completedDate.getTime() === today.getTime()) return true;
                        return false;
                      }
                      
                      // If marked NA, include if marked today
                      if (!task.is_active && task.na_marked_at) {
                        const naMarkedDate = new Date(task.na_marked_at);
                        naMarkedDate.setHours(0, 0, 0, 0);
                        if (naMarkedDate.getTime() === today.getTime()) return true;
                        return false;
                      }
                      
                      // Include all other active tasks
                      return task.is_active;
                    })
                    .sort((a, b) => {
                      // Sort by pillar-category hierarchy order (same as Daily tab)
                      const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                      const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      
                      // Sort by hierarchy order first
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      
                      // Within same category, sort by custom task name order
                      const taskOrderA = taskNameOrder[a.name || ''] || 999;
                      const taskOrderB = taskNameOrder[b.name || ''] || 999;
                      
                      if (taskOrderA !== taskOrderB) {
                        return taskOrderA - taskOrderB;
                      }
                      
                      // If not in custom order, sort alphabetically
                      return (a.name || '').localeCompare(b.name || '');
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
                    .filter(task => {
                      // Only show weekly tasks
                      if (task.follow_up_frequency !== 'weekly') return false;
                      
                      // Don't show if already added to this month
                      if (monthlyTaskStatuses[task.id]) return false;
                      
                      // Don't show completed tasks
                      if (task.is_completed) return false;
                      
                      // Only show active tasks
                      return task.is_active;
                    })
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
                    .filter(task => {
                      // Only show daily tasks
                      if (task.follow_up_frequency !== 'daily') return false;
                      
                      // Don't show if already added to this year
                      if (yearlyTaskStatuses[task.id]) return false;
                      
                      // Include all daily tasks (active, completed today, or marked NA today)
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      // If completed, include if completed today
                      if (task.is_completed && task.completed_at) {
                        const completedDate = new Date(task.completed_at);
                        completedDate.setHours(0, 0, 0, 0);
                        if (completedDate.getTime() === today.getTime()) return true;
                        return false;
                      }
                      
                      // If marked NA, include if marked today
                      if (!task.is_active && task.na_marked_at) {
                        const naMarkedDate = new Date(task.na_marked_at);
                        naMarkedDate.setHours(0, 0, 0, 0);
                        if (naMarkedDate.getTime() === today.getTime()) return true;
                        return false;
                      }
                      
                      // Include all other active tasks
                      return task.is_active;
                    })
                    .sort((a, b) => {
                      // Sort by pillar-category hierarchy order (same as Daily tab)
                      const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                      const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      
                      // Sort by hierarchy order first
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      
                      // Within same category, sort by custom task name order
                      const taskOrderA = taskNameOrder[a.name || ''] || 999;
                      const taskOrderB = taskNameOrder[b.name || ''] || 999;
                      
                      if (taskOrderA !== taskOrderB) {
                        return taskOrderA - taskOrderB;
                      }
                      
                      // If not in custom order, sort alphabetically
                      return (a.name || '').localeCompare(b.name || '');
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

      {/* Add Misc Task Group Modal */}
      {showAddMiscGroupModal && (
        <div className="modal-overlay" onClick={() => setShowAddMiscGroupModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Misc Task Group</h2>
              <button className="btn-close" onClick={() => setShowAddMiscGroupModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                try {
                  await api.post('/api/misc-tasks/', {
                    name: formData.get('name'),
                    description: formData.get('description') || null,
                    due_date: formData.get('due_date') || null
                  });
                  
                  await loadMiscTaskGroups();
                  setShowAddMiscGroupModal(false);
                } catch (err: any) {
                  console.error('Error creating misc task group:', err);
                  alert('Failed to create misc task group: ' + (err.response?.data?.detail || err.message));
                }
              }}>
                <div className="form-group">
                  <label htmlFor="misc-group-name">Task Group Name *</label>
                  <input
                    type="text"
                    id="misc-group-name"
                    name="name"
                    className="form-control"
                    required
                    placeholder="e.g., Organize Garage, Plan Birthday Party"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="misc-group-description">Description</label>
                  <textarea
                    id="misc-group-description"
                    name="description"
                    className="form-control"
                    rows={3}
                    placeholder="Brief description"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="misc-group-due-date">Due Date (Optional)</label>
                  <input
                    type="date"
                    id="misc-group-due-date"
                    name="due_date"
                    className="form-control"
                  />
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowAddMiscGroupModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Misc Task Modal */}
      {showAddMiscTaskModal && selectedMiscGroup && (
        <div className="modal-overlay" onClick={() => setShowAddMiscTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Task to {selectedMiscGroup.name}</h2>
              <button className="btn-close" onClick={() => setShowAddMiscTaskModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const parentId = formData.get('parent_task_id');
                
                try {
                  await api.post(`/api/misc-tasks/${selectedMiscGroup.id}/tasks`, {
                    name: formData.get('name'),
                    description: formData.get('description') || null,
                    parent_task_id: parentId && parentId !== '' ? parseInt(parentId as string) : null,
                    due_date: formData.get('due_date') || null,
                    priority: formData.get('priority') || 'medium'
                  });
                  
                  await loadMiscTasks(selectedMiscGroup.id);
                  setShowAddMiscTaskModal(false);
                } catch (err: any) {
                  console.error('Error creating misc task:', err);
                  alert('Failed to create misc task: ' + (err.response?.data?.detail || err.message));
                }
              }}>
                <div className="form-group">
                  <label htmlFor="misc-task-parent">Parent Task (Optional)</label>
                  <select
                    id="misc-task-parent"
                    name="parent_task_id"
                    className="form-control"
                  >
                    <option value="">-- Top Level Task --</option>
                    {miscTasks.map(task => (
                      <option key={task.id} value={task.id}>
                        {'  '.repeat((task.parent_task_id ? 1 : 0))} {task.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="misc-task-name">Task Name *</label>
                  <input
                    type="text"
                    id="misc-task-name"
                    name="name"
                    className="form-control"
                    required
                    placeholder="e.g., Sort tools, Clean floor"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="misc-task-description">Description</label>
                  <textarea
                    id="misc-task-description"
                    name="description"
                    className="form-control"
                    rows={2}
                    placeholder="Task details"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="misc-task-due-date">Due Date</label>
                  <input
                    type="date"
                    id="misc-task-due-date"
                    name="due_date"
                    className="form-control"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="misc-task-priority">Priority</label>
                  <select
                    id="misc-task-priority"
                    name="priority"
                    className="form-control"
                  >
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowAddMiscTaskModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Add Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Wish Modal */}
      {showAddWishModal && (
        <div className="modal-overlay" onClick={() => setShowAddWishModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>✨ Create New Wish</h2>
              <button className="btn-close" onClick={() => setShowAddWishModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                const wishData: any = {
                  title: formData.get('title') as string,
                  description: formData.get('description') as string || undefined,
                  category: formData.get('category') as string || undefined,
                  dream_type: formData.get('dream_type') as string || undefined,
                  estimated_timeframe: formData.get('estimated_timeframe') as string || undefined,
                  estimated_cost: formData.get('estimated_cost') ? parseFloat(formData.get('estimated_cost') as string) : undefined,
                  priority: formData.get('priority') as string || 'medium',
                  why_important: formData.get('why_important') as string || undefined,
                  emotional_impact: formData.get('emotional_impact') as string || undefined,
                  life_area: formData.get('life_area') as string || undefined,
                  image_url: formData.get('image_url') as string || undefined,
                  inspiration_notes: formData.get('inspiration_notes') as string || undefined,
                  status: 'dreaming',
                  is_active: true,
                };

                await handleCreateWish(wishData);
              }}>
                <div className="form-group">
                  <label htmlFor="title">Dream Title *</label>
                  <input 
                    type="text" 
                    id="title" 
                    name="title" 
                    placeholder="What's your dream?" 
                    required 
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea 
                    id="description" 
                    name="description" 
                    rows={3}
                    placeholder="Describe your wish in more detail..."
                    style={{ fontSize: '14px' }}
                  ></textarea>
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label htmlFor="category">Category</label>
                    <select id="category" name="category">
                      <option value="">Select category...</option>
                      <option value="travel">🌍 Travel & Adventure</option>
                      <option value="financial">💰 Financial</option>
                      <option value="personal">🌱 Personal Growth</option>
                      <option value="career">💼 Career</option>
                      <option value="health">💪 Health & Fitness</option>
                      <option value="relationship">❤️ Relationships</option>
                      <option value="learning">📚 Learning</option>
                      <option value="lifestyle">🏡 Lifestyle</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="dream_type">Type</label>
                    <select id="dream_type" name="dream_type">
                      <option value="">Select type...</option>
                      <option value="experience">🎭 Experience</option>
                      <option value="acquisition">🎁 Acquisition</option>
                      <option value="achievement">🏆 Achievement</option>
                      <option value="transformation">🦋 Transformation</option>
                    </select>
                  </div>
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label htmlFor="estimated_timeframe">Timeframe</label>
                    <select id="estimated_timeframe" name="estimated_timeframe">
                      <option value="">When do you imagine...</option>
                      <option value="someday">Someday (no rush)</option>
                      <option value="1-2 years">1-2 years</option>
                      <option value="2-5 years">2-5 years</option>
                      <option value="5+ years">5+ years</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="priority">Priority</label>
                    <select id="priority" name="priority" defaultValue="medium">
                      <option value="low">Low priority</option>
                      <option value="medium">Medium priority</option>
                      <option value="high">High priority</option>
                      <option value="burning_desire">🔥 Burning desire!</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="estimated_cost">Estimated Cost (optional)</label>
                  <input 
                    type="number" 
                    id="estimated_cost" 
                    name="estimated_cost" 
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="why_important">Why does this matter to you?</label>
                  <textarea 
                    id="why_important" 
                    name="why_important" 
                    rows={3}
                    placeholder="Viktor Frankl said: 'Those who have a why can bear almost any how.' What's your why?"
                    style={{ fontSize: '14px', fontStyle: 'italic' }}
                  ></textarea>
                  <small style={{ color: '#718096', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    This is your emotional anchor – it helps you understand what truly drives this dream.
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="emotional_impact">How will you feel when you achieve this?</label>
                  <textarea 
                    id="emotional_impact" 
                    name="emotional_impact" 
                    rows={2}
                    placeholder="Proud? Free? Fulfilled? Describe the feeling..."
                    style={{ fontSize: '14px' }}
                  ></textarea>
                </div>

                <div className="form-group">
                  <label htmlFor="inspiration_notes">Inspiration & Ideas</label>
                  <textarea 
                    id="inspiration_notes" 
                    name="inspiration_notes" 
                    rows={2}
                    placeholder="Any thoughts, inspirations, or ideas that sparked this wish..."
                    style={{ fontSize: '14px' }}
                  ></textarea>
                </div>

                <div className="form-group">
                  <label htmlFor="image_url">Image URL (optional)</label>
                  <input 
                    type="url" 
                    id="image_url" 
                    name="image_url" 
                    placeholder="https://example.com/inspiring-image.jpg"
                  />
                  <small style={{ color: '#718096', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Add a visual representation of your dream to keep it vivid in your mind.
                  </small>
                </div>

                <div style={{ 
                  marginTop: '24px', 
                  padding: '16px', 
                  backgroundColor: '#ebf8ff', 
                  borderRadius: '8px',
                  borderLeft: '4px solid #3182ce'
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#2c5282', lineHeight: '1.6' }}>
                    <strong>💡 Remember:</strong> This is a pressure-free space. No deadlines, no commitments yet. 
                    Just give yourself permission to dream. You can always explore, reflect, and eventually 
                    convert this into a committed goal when you're ready.
                  </p>
                </div>

                <div className="modal-footer" style={{ marginTop: '24px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowAddWishModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    ✨ Create Wish
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Wish Details Modal */}
      {showWishDetailsModal && selectedWish && (
        <div className="modal-overlay" onClick={() => setShowWishDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>✨ {selectedWish.title}</h2>
              <button className="btn-close" onClick={() => setShowWishDetailsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Header section with status and actions */}
              <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    backgroundColor: selectedWish.status === 'dreaming' ? '#e3f2fd' : 
                                    selectedWish.status === 'exploring' ? '#f3e5f5' :
                                    selectedWish.status === 'planning' ? '#fff3e0' :
                                    selectedWish.status === 'ready_to_commit' ? '#e8f5e9' : '#e0f2f1',
                    color: selectedWish.status === 'dreaming' ? '#1976d2' : 
                          selectedWish.status === 'exploring' ? '#7b1fa2' :
                          selectedWish.status === 'planning' ? '#f57c00' :
                          selectedWish.status === 'ready_to_commit' ? '#388e3c' : '#00897b',
                    textTransform: 'capitalize'
                  }}>
                    {selectedWish.status.replace('_', ' ')}
                  </span>
                  
                  {selectedWish.category && (
                    <span style={{ fontSize: '14px', color: '#718096' }}>
                      {selectedWish.category === 'travel' && '🌍'} 
                      {selectedWish.category === 'financial' && '💰'}
                      {selectedWish.category === 'personal' && '🌱'}
                      {selectedWish.category === 'career' && '💼'}
                      {selectedWish.category === 'health' && '💪'}
                      {selectedWish.category === 'relationship' && '❤️'}
                      {selectedWish.category === 'learning' && '📚'}
                      {selectedWish.category === 'lifestyle' && '🏡'}
                      {' '}{selectedWish.category}
                    </span>
                  )}
                  
                  {selectedWish.priority === 'burning_desire' && (
                    <span style={{ fontSize: '20px' }}>🔥</span>
                  )}
                </div>
                
                {selectedWish.description && (
                  <p style={{ margin: '12px 0', fontSize: '15px', color: '#4a5568', lineHeight: '1.6' }}>
                    {selectedWish.description}
                  </p>
                )}

                {selectedWish.estimated_timeframe && (
                  <div style={{ fontSize: '14px', color: '#718096', marginTop: '8px' }}>
                    ⏰ Estimated timeframe: <strong>{selectedWish.estimated_timeframe.replace('_', ' ')}</strong>
                  </div>
                )}

                {selectedWish.estimated_cost && (
                  <div style={{ fontSize: '14px', color: '#718096', marginTop: '4px' }}>
                    💵 Estimated cost: <strong>${selectedWish.estimated_cost.toLocaleString()}</strong>
                  </div>
                )}
              </div>

              {/* Why it matters section */}
              {selectedWish.why_important && (
                <div style={{
                  backgroundColor: '#fef5e7',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  borderLeft: '4px solid #f39c12'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#856404', fontWeight: '600' }}>
                    💫 Why this matters to you:
                  </h4>
                  <p style={{ margin: 0, fontSize: '14px', color: '#856404', lineHeight: '1.6' }}>
                    {selectedWish.why_important}
                  </p>
                </div>
              )}

              {/* Emotional impact section */}
              {selectedWish.emotional_impact && (
                <div style={{
                  backgroundColor: '#f0f9ff',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  borderLeft: '4px solid #3b82f6'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e40af', fontWeight: '600' }}>
                    ✨ How you'll feel:
                  </h4>
                  <p style={{ margin: 0, fontSize: '14px', color: '#1e40af', lineHeight: '1.6' }}>
                    {selectedWish.emotional_impact}
                  </p>
                </div>
              )}

              {/* Stats section */}
              {selectedWish.stats && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '16px',
                  marginBottom: '24px',
                  padding: '16px',
                  backgroundColor: '#f7fafc',
                  borderRadius: '8px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4a5568' }}>
                      {selectedWish.stats.days_dreaming || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                      Days Dreaming
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4a5568' }}>
                      {selectedWish.stats.reflections_count || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                      Reflections
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4a5568' }}>
                      {selectedWish.stats.exploration_steps_completed || 0}/{selectedWish.stats.exploration_steps_total || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                      Exploration Steps
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4a5568' }}>
                      {selectedWish.stats.inspirations_count || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                      Inspirations
                    </div>
                  </div>
                  {selectedWish.stats.average_clarity_score && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4a5568' }}>
                        {selectedWish.stats.average_clarity_score.toFixed(1)}/10
                      </div>
                      <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                        Clarity Score
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginBottom: '24px'
              }}>
                <button 
                  className="btn"
                  style={{
                    padding: '12px',
                    backgroundColor: '#bee3f8',
                    color: '#2c5282',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                  onClick={async () => {
                    const text = prompt("What are your thoughts about this dream? How do you feel about it right now?");
                    if (text) {
                      const moodOptions = ['excited', 'uncertain', 'determined', 'doubtful', 'inspired'];
                      const mood = prompt(`How would you describe your mood? (${moodOptions.join(', ')})`);
                      const clarityStr = prompt("How clear is this wish to you now? (1-10, where 10 is crystal clear)");
                      const clarity = clarityStr ? parseInt(clarityStr) : undefined;
                      
                      try {
                        await api.post(`/api/wishes/${selectedWish.id}/reflections`, {
                          reflection_text: text,
                          mood: mood || 'inspired',
                          clarity_score: clarity
                        });
                        await loadWishes();
                        const updated: any = await api.get(`/api/wishes/${selectedWish.id}`);
                        setSelectedWish(updated.data || updated);
                      } catch (err) {
                        console.error('Error adding reflection:', err);
                        alert('Failed to add reflection');
                      }
                    }
                  }}
                >
                  ✍️ Add Reflection
                </button>

                <button 
                  className="btn"
                  style={{
                    padding: '12px',
                    backgroundColor: '#c6f6d5',
                    color: '#22543d',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                  onClick={async () => {
                    const title = prompt("What small step can you take to explore this wish?");
                    if (title) {
                      const typeOptions = ['research', 'save_money', 'learn_skill', 'explore', 'connect'];
                      const type = prompt(`What type of step is this? (${typeOptions.join(', ')})`);
                      
                      try {
                        await api.post(`/api/wishes/${selectedWish.id}/steps`, {
                          step_title: title,
                          step_type: type || 'research'
                        });
                        await loadWishes();
                        const updated: any = await api.get(`/api/wishes/${selectedWish.id}`);
                        setSelectedWish(updated.data || updated);
                      } catch (err) {
                        console.error('Error adding exploration step:', err);
                        alert('Failed to add exploration step');
                      }
                    }
                  }}
                >
                  🔍 Add Exploration Step
                </button>

                <button 
                  className="btn"
                  style={{
                    padding: '12px',
                    backgroundColor: '#fef3c7',
                    color: '#78350f',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                  onClick={async () => {
                    const title = prompt("What inspired you? (article title, quote, person, etc.)");
                    if (title) {
                      const url = prompt("URL (if applicable):");
                      const typeOptions = ['article', 'video', 'photo', 'quote', 'story', 'person'];
                      const type = prompt(`What type of inspiration? (${typeOptions.join(', ')})`);
                      
                      try {
                        await api.post(`/api/wishes/${selectedWish.id}/inspirations`, {
                          title: title,
                          url: url || undefined,
                          inspiration_type: type || 'article'
                        });
                        await loadWishes();
                        const updated: any = await api.get(`/api/wishes/${selectedWish.id}`);
                        setSelectedWish(updated.data || updated);
                      } catch (err) {
                        console.error('Error adding inspiration:', err);
                        alert('Failed to add inspiration');
                      }
                    }
                  }}
                >
                  💡 Add Inspiration
                </button>

                {selectedWish.status === 'ready_to_commit' && (
                  <button 
                    className="btn"
                    style={{
                      padding: '12px',
                      backgroundColor: '#d1fae5',
                      color: '#065f46',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                    onClick={() => {
                      alert('Convert to Goal feature coming soon! This will create a Life Goal from your wish.');
                    }}
                  >
                    🎯 Convert to Goal
                  </button>
                )}
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <button 
                  className="btn btn-secondary"
                  onClick={async () => {
                    if (confirm('Are you sure you want to archive this wish? You can view archived wishes later.')) {
                      await handleArchiveWish(selectedWish.id);
                      setShowWishDetailsModal(false);
                    }
                  }}
                  style={{ color: '#e53e3e' }}
                >
                  🗄️ Archive
                </button>
                
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowWishDetailsModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Habit Modal */}
      {showAddHabitModal && (
        <div className="modal-overlay" onClick={() => setShowAddHabitModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Habit</h2>
              <button className="btn-close" onClick={() => setShowAddHabitModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                const trackingMode = formData.get('tracking_mode') as string;
                const periodType = formData.get('period_type') as string;
                
                const habitData: any = {
                  name: formData.get('name') as string,
                  description: formData.get('description') as string || undefined,
                  habit_type: formData.get('habit_type') as string,
                  target_frequency: formData.get('target_frequency') as string,
                  is_positive: formData.get('is_positive') === 'true',
                  why_reason: formData.get('why_reason') as string || undefined,
                  linked_task_id: formData.get('linked_task_id') ? parseInt(formData.get('linked_task_id') as string) : undefined,
                };

                // Add fields based on tracking mode
                if (trackingMode === 'daily_streak') {
                  // Traditional daily habit with streak
                  habitData.period_type = 'daily';
                  habitData.tracking_mode = 'daily_streak';
                  habitData.target_value = formData.get('target_value') ? parseInt(formData.get('target_value') as string) : undefined;
                  habitData.target_comparison = formData.get('target_comparison') as string || 'at_least';
                } else if (trackingMode === 'occurrence') {
                  // Weekly/Monthly occurrence (just checkboxes)
                  habitData.period_type = periodType;
                  habitData.tracking_mode = 'occurrence';
                  habitData.target_count_per_period = parseInt(formData.get('target_count_per_period') as string);
                } else if (trackingMode === 'occurrence_with_value') {
                  // Weekly/Monthly occurrence with value tracking
                  habitData.period_type = periodType;
                  habitData.tracking_mode = 'occurrence_with_value';
                  habitData.target_count_per_period = parseInt(formData.get('target_count_per_period') as string);
                  habitData.session_target_value = parseInt(formData.get('session_target_value') as string);
                  habitData.session_target_unit = formData.get('session_target_unit') as string;
                  habitData.target_comparison = formData.get('target_comparison') as string || 'at_least';
                } else if (trackingMode === 'aggregate') {
                  // Weekly/Monthly aggregate total
                  habitData.period_type = periodType;
                  habitData.tracking_mode = 'aggregate';
                  habitData.aggregate_target = parseInt(formData.get('aggregate_target') as string);
                  habitData.session_target_unit = formData.get('session_target_unit') as string;
                }

                await handleCreateHabit(habitData);
              }}>
                <div className="form-group">
                  <label htmlFor="habit-name">Habit Name *</label>
                  <input
                    type="text"
                    id="habit-name"
                    name="name"
                    className="form-control"
                    required
                    placeholder="e.g., Morning Meditation, Read 30 minutes"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="habit-description">Description</label>
                  <textarea
                    id="habit-description"
                    name="description"
                    className="form-control"
                    rows={2}
                    placeholder="What does this habit involve?"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tracking-mode">Tracking Mode *</label>
                  <select
                    id="tracking-mode"
                    name="tracking_mode"
                    className="form-control"
                    required
                    onChange={(e) => {
                      const mode = e.currentTarget.value;
                      const dailyFields = document.getElementById('daily-fields');
                      const occurrenceFields = document.getElementById('occurrence-fields');
                      const occurrenceValueFields = document.getElementById('occurrence-value-fields');
                      const aggregateFields = document.getElementById('aggregate-fields');
                      const periodTypeField = document.getElementById('period-type-field');
                      
                      // Hide all first
                      if (dailyFields) dailyFields.style.display = 'none';
                      if (occurrenceFields) occurrenceFields.style.display = 'none';
                      if (occurrenceValueFields) occurrenceValueFields.style.display = 'none';
                      if (aggregateFields) aggregateFields.style.display = 'none';
                      if (periodTypeField) periodTypeField.style.display = 'none';
                      
                      // Show relevant fields
                      if (mode === 'daily_streak' && dailyFields) {
                        dailyFields.style.display = 'block';
                      } else if (mode === 'occurrence') {
                        if (occurrenceFields) occurrenceFields.style.display = 'block';
                        if (periodTypeField) periodTypeField.style.display = 'block';
                      } else if (mode === 'occurrence_with_value') {
                        if (occurrenceValueFields) occurrenceValueFields.style.display = 'block';
                        if (periodTypeField) periodTypeField.style.display = 'block';
                      } else if (mode === 'aggregate') {
                        if (aggregateFields) aggregateFields.style.display = 'block';
                        if (periodTypeField) periodTypeField.style.display = 'block';
                      }
                    }}
                  >
                    <option value="daily_streak">Daily Streak (Traditional - track every day)</option>
                    <option value="occurrence">Weekly/Monthly Occurrences (e.g., Gym 4x/week - just checkboxes)</option>
                    <option value="occurrence_with_value">Weekly/Monthly with Values (e.g., Gym 4x/week, 45+ min each)</option>
                    <option value="aggregate">Weekly/Monthly Aggregate (e.g., Read 300 pages/week total)</option>
                  </select>
                  <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                    Daily Streak = Track every day with streaks<br/>
                    Occurrences = Do it X times per week/month<br/>
                    With Values = Track time/count for each session<br/>
                    Aggregate = Hit total target (flexible distribution)
                  </small>
                </div>

                <div className="form-group" id="period-type-field" style={{ display: 'none' }}>
                  <label htmlFor="period-type">Period *</label>
                  <select
                    id="period-type"
                    name="period_type"
                    className="form-control"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {/* Daily Streak Fields */}
                <div id="daily-fields" style={{ display: 'block' }}>
                  <div className="form-group">
                    <label htmlFor="habit-type">Habit Type *</label>
                    <select
                      id="habit-type"
                      name="habit_type"
                      className="form-control"
                      required
                      onChange={(e) => {
                        const targetValueGroup = document.getElementById('target-value-group');
                        if (targetValueGroup) {
                          targetValueGroup.style.display = e.currentTarget.value === 'boolean' ? 'none' : 'block';
                        }
                      }}
                    >
                      <option value="boolean">Yes/No (Did I do it?)</option>
                      <option value="time_based">Time-based (minutes)</option>
                      <option value="count_based">Count-based (reps/pages/etc)</option>
                    </select>
                  </div>

                  <div className="form-group" id="target-value-group" style={{ display: 'none' }}>
                    <label htmlFor="habit-target">Daily Target</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="number"
                        id="habit-target"
                        name="target_value"
                        className="form-control"
                        min="1"
                        placeholder="e.g., 30 for 30 minutes, 10 for 10 reps"
                      />
                      <select name="target_comparison" className="form-control" style={{ maxWidth: '150px' }}>
                        <option value="at_least">At least</option>
                        <option value="at_most">At most</option>
                        <option value="exactly">Exactly</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Occurrence Fields (simple checkboxes) */}
                <div id="occurrence-fields" style={{ display: 'none' }}>
                  <div className="form-group">
                    <label htmlFor="target-count">Target Count *</label>
                    <input
                      type="number"
                      id="target-count"
                      name="target_count_per_period"
                      className="form-control"
                      min="1"
                      placeholder="e.g., 4 for 4 times per week"
                    />
                    <small style={{ color: '#666' }}>How many times per week/month?</small>
                  </div>
                </div>

                {/* Occurrence with Value Fields */}
                <div id="occurrence-value-fields" style={{ display: 'none' }}>
                  <div className="form-group">
                    <label htmlFor="target-count-value">Target Count *</label>
                    <input
                      type="number"
                      id="target-count-value"
                      name="target_count_per_period"
                      className="form-control"
                      min="1"
                      placeholder="e.g., 4 for 4 sessions per week"
                    />
                    <small style={{ color: '#666' }}>How many sessions per week/month?</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="session-target">Target per Session *</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="number"
                        id="session-target"
                        name="session_target_value"
                        className="form-control"
                        min="1"
                        placeholder="e.g., 45 for 45 minutes"
                      />
                      <input
                        type="text"
                        name="session_target_unit"
                        className="form-control"
                        placeholder="Unit (min/pages/km)"
                        style={{ maxWidth: '150px' }}
                      />
                      <select name="target_comparison" className="form-control" style={{ maxWidth: '150px' }}>
                        <option value="at_least">At least</option>
                        <option value="at_most">At most</option>
                        <option value="exactly">Exactly</option>
                      </select>
                    </div>
                    <small style={{ color: '#666' }}>Each session should be at least/at most/exactly this value</small>
                  </div>
                </div>

                {/* Aggregate Fields */}
                <div id="aggregate-fields" style={{ display: 'none' }}>
                  <div className="form-group">
                    <label htmlFor="aggregate-target">Total Target *</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="number"
                        id="aggregate-target"
                        name="aggregate_target"
                        className="form-control"
                        min="1"
                        placeholder="e.g., 300 for 300 pages"
                      />
                      <input
                        type="text"
                        name="session_target_unit"
                        className="form-control"
                        placeholder="Unit (pages/km/min)"
                        style={{ maxWidth: '150px' }}
                      />
                    </div>
                    <small style={{ color: '#666' }}>Total to achieve by end of week/month (flexible distribution)</small>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="habit-frequency">Frequency *</label>
                  <select
                    id="habit-frequency"
                    name="target_frequency"
                    className="form-control"
                    required
                    style={{ display: 'none' }}
                  >
                    <option value="daily">Daily</option>
                  </select>
                  <small style={{ color: '#666' }}>This field is auto-set based on tracking mode</small>
                </div>

                <div className="form-group">
                  <label htmlFor="habit-goal-type">Goal Type *</label>
                  <select
                    id="habit-goal-type"
                    name="is_positive"
                    className="form-control"
                    required
                  >
                    <option value="true">Build (Do this habit)</option>
                    <option value="false">Break (Avoid this habit)</option>
                  </select>
                  <small style={{ color: '#666' }}>Build = success when you do it. Break = success when you don't do it.</small>
                </div>

                <div className="form-group">
                  <label htmlFor="habit-linked-task">Link to Daily Task (Optional)</label>
                  <select
                    id="habit-linked-task"
                    name="linked_task_id"
                    className="form-control"
                  >
                    <option value="">-- No link --</option>
                    {tasks
                      .filter(t => t.follow_up_frequency === 'daily' && t.is_active)
                      .map(task => (
                        <option key={task.id} value={task.id}>
                          {task.name}
                        </option>
                      ))}
                  </select>
                  <small style={{ color: '#666' }}>Auto-sync: Habit entry will be created automatically when you log time for the linked task.</small>
                </div>

                <div className="form-group">
                  <label htmlFor="habit-why">Why this habit? (Optional but recommended)</label>
                  <textarea
                    id="habit-why"
                    name="why_reason"
                    className="form-control"
                    rows={3}
                    placeholder="Why is this habit important to you? What will achieving this habit give you?"
                  />
                  <small style={{ color: '#666' }}>Clarity on 'why' increases consistency and motivation.</small>
                </div>

                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowAddHabitModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Habit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
