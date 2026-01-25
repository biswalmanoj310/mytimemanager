/**
 * Tasks Page
 * Display and manage all tasks with tabs and table view
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Tasks.css';
import './MiscTaskColors.css';
import './Projects.css';
import TaskForm from '../components/TaskForm';
import { Task, FollowUpFrequency, TaskType } from '../types';
import { WeeklyTasks, MonthlyTasks, QuarterlyTasks, YearlyTasks } from './index';
import { getWeekStart } from '../utils/dateHelpers';
import { AddHabitModal } from '../components/AddHabitModal';
import { RelatedChallengesList } from '../components/RelatedChallengesList';
import { PillarCategorySelector } from '../components/PillarCategorySelector';
import ImportantTasks from './ImportantTasks';
import UpcomingTasks from './UpcomingTasks';
import { useUserPreferencesContext } from '../contexts/UserPreferencesContext';

type TabType = 'now' | 'today' | 'daily' | 'weekly' | 'monthly' | 'upcoming' | 'quarterly' | 'yearly' | 'onetime' | 'misc' | 'projects' | 'habits';

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
  };
}

const formatTaskValue = (task: Task, value: number): string => {
  if (task.task_type === TaskType.COUNT) {
    return `${value} ${task.unit}`;
  } else if (task.task_type === TaskType.BOOLEAN) {
    return value > 0 ? '✓ Yes' : '✗ No';
  } else {
    return `${value} min`;
  };
}

export default function Tasks() {
  // Get setSelectedDate from UserPreferencesContext to update nested components
  const { setSelectedDate: setContextDate } = useUserPreferencesContext();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    // Initialize from URL if available
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      const validTabs: TabType[] = ['today', 'daily', 'weekly', 'monthly', 'upcoming', 'quarterly', 'yearly', 'onetime', 'misc', 'projects', 'habits'];
      if (validTabs.includes(tabParam as TabType)) {
        return tabParam as TabType;
      }
    }
    return 'today';
  });
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
  const [incompleteDaysLoaded, setIncompleteDaysLoaded] = useState(false);
  const [ignoredDays, setIgnoredDays] = useState<any[]>([]);
  const [showIgnoredDays, setShowIgnoredDays] = useState(false);
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
    const day = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday (if Sunday, go back 6 days)
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
  // Focused cell state (for keyboard navigation highlighting)
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  // Needs Attention section state
  const [showNeedsAttentionWeekly, setShowNeedsAttentionWeekly] = useState(true);
  const [showNeedsAttentionMonthly, setShowNeedsAttentionMonthly] = useState(true);
  
  // Monthly tab state - key format: "taskId-dayOfMonth" (1-31)
  const [monthlyEntries, setMonthlyEntries] = useState<Record<string, number>>({});
  // Ref to track latest monthly entries
  const monthlyEntriesRef = useRef<Record<string, number>>({});
  // Daily aggregates for monthly view - key format: "taskId-dayOfMonth"
  const [monthlyDailyAggregates, setMonthlyDailyAggregates] = useState<Record<string, number>>({});
  // Monthly task statuses - key format: "taskId", value: {is_completed, is_na}
  const [monthlyTaskStatuses, setMonthlyTaskStatuses] = useState<Record<number, {is_completed: boolean, is_na: boolean, created_at?: string}>>({});
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
  const [yearlyTaskStatuses, setYearlyTaskStatuses] = useState<Record<number, {is_completed: boolean, is_na: boolean, created_at?: string}>>({});
  // Selected year start date for yearly tab
  const [selectedYearStart, setSelectedYearStart] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), 0, 1); // January 1st of current year
  });
  const [yearlySaveTimeout, setYearlySaveTimeout] = useState<number | null>(null);
  // Yearly task modal state
  const [showAddYearlyTaskModal, setShowAddYearlyTaskModal] = useState(false);
  const [selectedDailyTaskForYearly, setSelectedDailyTaskForYearly] = useState<number | null>(null);

  // Quarterly task modal state
  const [showAddQuarterlyTaskModal, setShowAddQuarterlyTaskModal] = useState(false);
  const [selectedDailyTaskForQuarterly, setSelectedDailyTaskForQuarterly] = useState<number | null>(null);

  // Today tab - Month filter state
  const [selectedTodayMonth, setSelectedTodayMonth] = useState<string | null>(null); // Format: "YYYY-MM" or null for all

  // One-time tasks state
  interface OneTimeTaskData {
    id: number;
    task_id: number;
    start_date: string;
    target_gap: number | null;
    updated_date: string | null;
  };
  const [oneTimeTasks, setOneTimeTasks] = useState<OneTimeTaskData[]>([]);
  const [showAddOneTimeTaskModal, setShowAddOneTimeTaskModal] = useState(false);
  const [selectedTaskForOneTime, setSelectedTaskForOneTime] = useState<number | null>(null);

  // Daily task status state (per-date tracking)
  interface DailyTaskStatus {
    id: number;
    task_id: number;
    date: string;
    is_completed: boolean;
    is_na: boolean;
    is_tracked: boolean;
    created_at: string;
    updated_at: string;
  };
  const [dailyStatuses, setDailyStatuses] = useState<Map<number, DailyTaskStatus>>(new Map());
  
  // Map of task_id -> first completion date (for daily tasks)
  const [dailyTaskCompletionDates, setDailyTaskCompletionDates] = useState<Map<number, string>>(new Map());

  // Projects state
  interface ProjectData {
    id: number;
    name: string;
    description: string | null;
    pillar_id: number | null;
    category_id: number | null;
    goal_id: number | null;
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
      pending_tasks: number;
      overdue_tasks: number;
      progress_percentage: number;
    }
    milestone_progress?: {
      total_milestones: number;
      completed_milestones: number;
      pending_milestones: number;
      overdue_milestones: number;
      progress_percentage: number;
    }
    milestones?: ProjectMilestoneData[];
  };
  
  interface ProjectMilestoneData {
    id: number;
    project_id: number;
    name: string;
    description: string | null;
    target_date: string;
    is_completed: boolean;
    completed_at: string | null;
    order: number;
    created_at: string;
    updated_at: string;
  };
  
  interface ProjectTaskData {
    id: number;
    project_id: number;
    parent_task_id: number | null;
    milestone_id: number | null;
    name: string;
    description: string | null;
    due_date: string | null;
    priority: string;
    is_completed: boolean;
    completed_at: string | null;
    order: number;
    created_at: string;
    updated_at: string;
    pillar_name?: string;
    category_name?: string;
  };

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
  };

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
  };

  interface GoalTaskLinkData {
    id: number;
    goal_id: number;
    task_id: number;
    task_type: string;
    time_allocated_hours: number;
    notes: string | null;
    created_at: string;
    task?: Task; // Populated task data
  };

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
  };

  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [projectCategories, setProjectCategories] = useState<any[]>([]);
  const [projectPillars, setProjectPillars] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [projectTasks, setProjectTasks] = useState<ProjectTaskData[]>([]);
  const [projectMilestones, setProjectMilestones] = useState<ProjectMilestoneData[]>([]);
  const [projectChallenges, setProjectChallenges] = useState<{direct_challenges: any[], goal_challenges: any[]} | null>(null);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [projectFormGoalId, setProjectFormGoalId] = useState<number | null>(null);
  const [projectFormPillarId, setProjectFormPillarId] = useState<number | null>(null);
  const [projectFormCategoryId, setProjectFormCategoryId] = useState<number | null>(null);
  const [projectFormSubCategoryId, setProjectFormSubCategoryId] = useState<number | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showAddProjectMilestoneModal, setShowAddProjectMilestoneModal] = useState(false);
  const [showEditProjectMilestoneModal, setShowEditProjectMilestoneModal] = useState(false);
  const [showMilestoneDetailModal, setShowMilestoneDetailModal] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<ProjectMilestoneData | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestoneData | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null);
  const [editingTask, setEditingTask] = useState<ProjectTaskData | null>(null);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  // Regular task editing (non-project tasks)
  const [editingRegularTask, setEditingRegularTask] = useState<Task | null>(null);
  const [showEditRegularTaskModal, setShowEditRegularTaskModal] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  // Misc Tasks state (similar to Projects)
  const [miscTasks, setMiscTasks] = useState<ProjectTaskData[]>([]);
  const [expandedMiscTasks, setExpandedMiscTasks] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('expandedMiscTasks');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [expandedMiscCategories, setExpandedMiscCategories] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('expandedMiscCategories');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [miscSubtaskParentId, setMiscSubtaskParentId] = useState<number | null>(null);
  const [showAddMiscTaskModal, setShowAddMiscTaskModal] = useState(false);
  const [editingMiscTask, setEditingMiscTask] = useState<ProjectTaskData | null>(null);
  const [showCompletedMiscTasks, setShowCompletedMiscTasks] = useState(false);
  const [showCompletedDailyTasks, setShowCompletedDailyTasks] = useState(true); // Default to expanded
  const [expandedHabitCategories, setExpandedHabitCategories] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('expandedHabitCategories');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [expandedSections, setExpandedSections] = useState<{ milestones: boolean; allTasks: boolean; frequencyTasks: boolean; completedTasks: boolean; linkedTasks: boolean }>(() => {
    const saved = localStorage.getItem('projectDetailSectionsExpanded');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse projectDetailSectionsExpanded:', e);
      }
    }
    return { milestones: true, allTasks: false, frequencyTasks: true, completedTasks: false, linkedTasks: true };
  });
  
  useEffect(() => {
    localStorage.setItem('projectDetailSectionsExpanded', JSON.stringify(expandedSections));
  }, [expandedSections]);
  
  const [projectTaskFilter, setProjectTaskFilter] = useState<'all' | 'in-progress' | 'completed' | 'overdue' | 'no-milestone'>('all');
  const [projectTasksDueToday, setProjectTasksDueToday] = useState<Array<ProjectTaskData & { project_name?: string }>>([]);
  const [overdueOneTimeTasks, setOverdueOneTimeTasks] = useState<Array<OneTimeTaskData & { task_name?: string }>>([]);
  const [goalTasksDueToday, setGoalTasksDueToday] = useState<Array<any>>([]);
  const [pendingProjectId, setPendingProjectId] = useState<number | null>(null); // Track project ID from URL
  
  // Collapsible project sections state
  const [collapsedProjectSections, setCollapsedProjectSections] = useState<{[key: string]: boolean}>(() => {
    // Try to load saved state from localStorage
    const saved = localStorage.getItem('collapsedProjectSections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse collapsedProjectSections from localStorage:', e);
      }
    }
    // Default: all sections collapsed (true = collapsed)
    return {
      'completed': true
    };
  });

  // Today Tab state - expandable sections
  const [todayTabSections, setTodayTabSections] = useState(() => {
    // Try to load saved state from localStorage
    const saved = localStorage.getItem('todayTabSections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing todayTabSections from localStorage:', e);
      }
    }
    // Default state if nothing saved
    return {
      todaysOnlyTasks: true,
      projectTasksDueToday: true,
      goalTasksDueToday: true,
      miscTasksDueToday: true,
      importantTasksDueToday: true,
      weeklyNeedsAttention: true,
      monthlyNeedsAttention: true,
      quarterlyNeedsAttention: true,
      yearlyNeedsAttention: true,
      todaysHabits: true,
      upcomingTasks: true,
      upcomingNext7Days: true,
      upcomingThisMonth: true
    };
  });
  
  // Save to localStorage whenever todayTabSections changes
  useEffect(() => {
    localStorage.setItem('todayTabSections', JSON.stringify(todayTabSections));
  }, [todayTabSections]);
  
  // Reset selected project when navigating away from projects tab
  useEffect(() => {
    if (activeTab !== 'projects' && selectedProject) {
      setSelectedProject(null);
    }
  }, [activeTab, selectedProject]);
  
  // Today Tab data
  const [todaysOnlyTasks, setTodaysOnlyTasks] = useState<Task[]>([]);
  const [miscTasksDueToday, setMiscTasksDueToday] = useState<Array<ProjectTaskData & { group_name?: string }>>([]);
  const [importantTasksDueToday, setImportantTasksDueToday] = useState<Array<any>>([]);
  const [weeklyTasksNeedingAttention, setWeeklyTasksNeedingAttention] = useState<Task[]>([]);
  const [monthlyTasksNeedingAttention, setMonthlyTasksNeedingAttention] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);

  // Habits state
  interface HabitData {
    id: number;
    name: string;
    description?: string;
    habit_type: 'boolean' | 'time_based' | 'count_based';
    linked_task_id?: number;
    linked_task_name?: string;
    pillar_id?: number;
    pillar_name?: string;
    pillar_color?: string;
    category_id?: number;
    category_name?: string;
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
      week_success_rate?: number;
      month_success_rate?: number;
      current_streak: number;
      longest_streak: number;
      top_3_streaks?: HabitStreak[];
    }
  };

  interface HabitEntry {
    id: number;
    habit_id: number;
    entry_date: string;
    is_successful: boolean;
    actual_value?: number;
    note?: string;
    created_at: string;
  };

  interface HabitStreak {
    id: number;
    start_date: string;
    end_date: string;
    streak_length: number;
    is_active: boolean;
  };

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
  };

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
  };

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
  };

  const [habits, setHabits] = useState<HabitData[]>([]);
  const [completedHabits, setCompletedHabits] = useState<HabitData[]>([]);
  const [showCompletedHabits, setShowCompletedHabits] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<HabitData | null>(null);
  const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([]);
  const [habitStreaks, setHabitStreaks] = useState<HabitStreak[]>([]);
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [showEditHabitModal, setShowEditHabitModal] = useState(false);
  const [showHabitDetailsModal, setShowHabitDetailsModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitData | null>(null);
  const [habitMarkDate, setHabitMarkDate] = useState<Record<number, string>>({});
  const [habitMonthDays, setHabitMonthDays] = useState<Record<number, any[]>>({});
  const [habitSelectedMonth, setHabitSelectedMonth] = useState<Record<number, Date>>({}); // Per-habit month navigation

  // Today's habits and challenges
  interface TodaysHabit {
    id: number;
    name: string;
    description?: string;
    habit_type: string;
    target_frequency: string;
    target_value?: number;
    target_comparison: string;
    pillar_id?: number;
    pillar_name?: string;
    pillar_color?: string;
    category_id?: number;
    category_name?: string;
    is_positive: boolean;
    current_streak: number;
    longest_streak: number;
    completed_today: boolean;
    today_value?: number;
    period_type?: string;
    tracking_mode?: string;
    target_count_per_period?: number;
    session_target_value?: number;
    session_target_unit?: string;
    aggregate_target?: number;
    // Monthly completion data
    monthly_completion?: (boolean | null)[];
    completed_days_this_month?: number;
    total_days_this_month?: number;
    completion_rate?: number;
    // Stats object with success rates
    stats?: {
      success_rate?: number;  // Overall
      week_success_rate?: number;
      month_success_rate?: number;
      current_streak?: number;
      longest_streak?: number;
    };
  }

  interface TodaysChallenge {
    id: number;
    name: string;
    description?: string;
    challenge_type: string;
    pillar_id?: number;
    pillar_name?: string;
    pillar_color?: string;
    category_id?: number;
    category_name?: string;
    start_date: string;
    end_date: string;
    days_total: number;
    days_elapsed: number;
    days_remaining: number;
    target_days?: number;
    target_count?: number;
    target_value?: number;
    unit?: string;
    current_streak: number;
    completed_days: number;
    current_count: number;
    current_value: number;
    progress_percentage: number;
    status_indicator: string;
    completed_today: boolean;
    today_value?: number;
    difficulty?: string;
    reward?: string;
    // Daily average for accumulation challenges
    daily_average?: number;
  }

  const [todaysHabits, setTodaysHabits] = useState<TodaysHabit[]>([]);
  const [todaysChallenges, setTodaysChallenges] = useState<TodaysChallenge[]>([]);
  const [currentPeriodStats, setCurrentPeriodStats] = useState<Record<number, PeriodStats>>({});
  
  // NOW habits - stored in localStorage
  const [nowHabits, setNowHabits] = useState<Set<number>>(() => {
    const stored = localStorage.getItem('nowHabits');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

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
    }
  };

  interface WishReflection {
    id: number;
    wish_id: number;
    reflection_date: string;
    reflection_text: string;
    mood?: string;
    clarity_score?: number;
    created_at: string;
  };

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
  };

  const [wishes, setWishes] = useState<WishData[]>([]);
  const [selectedWish, setSelectedWish] = useState<WishData | null>(null);
  const [showAddWishModal, setShowAddWishModal] = useState(false);
  const [showWishDetailsModal, setShowWishDetailsModal] = useState(false);

  // Ref to track if tasks have been initially loaded
  const tasksLoadedRef = useRef(false);

  // Get location for URL parameters
  const location = useLocation();
  const navigate = useNavigate();

  // Helper functions (must be defined before useEffect hooks that use them)
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to parse YYYY-MM-DD string as local date (not UTC)
  const parseDateString = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  };

  const isCurrentWeek = (weekStart: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentWeekStart = getWeekStart(today);
    currentWeekStart.setHours(0, 0, 0, 0);
    const checkWeekStart = new Date(weekStart);
    checkWeekStart.setHours(0, 0, 0, 0);
    
    return checkWeekStart.getFullYear() === currentWeekStart.getFullYear() &&
           checkWeekStart.getMonth() === currentWeekStart.getMonth() &&
           checkWeekStart.getDate() === currentWeekStart.getDate();
  };

  const isCurrentMonth = (monthStart: Date): boolean => {
    const today = new Date();
    const checkMonth = new Date(monthStart);
    return checkMonth.getFullYear() === today.getFullYear() &&
           checkMonth.getMonth() === today.getMonth();
  };

  const isCurrentYear = (yearStart: Date): boolean => {
    const today = new Date();
    const checkYear = new Date(yearStart);
    return checkYear.getFullYear() === today.getFullYear();
  };

  const isFutureDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate.getTime() > today.getTime();
  };

  // Load completion dates for all daily tasks (when they were first completed)
  const loadDailyTaskCompletionDates = async () => {
    try {
      const response = await api.get<Record<number, string>>('/api/daily-tasks-history/completion-dates');
      const completionMap = new Map(Object.entries(response).map(([id, date]) => [parseInt(id), date]));
      setDailyTaskCompletionDates(completionMap);
    } catch (err: any) {
      console.error('Error loading completion dates:', err);
      // Don't set error state, just log - this is not critical
    }
  };

  // Load tasks function (needed by error UI)
  const loadTasks = async (): Promise<Task[]> => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Task[]>('/api/tasks/');
      setTasks(data);
      // Load completion dates for daily tasks
      await loadDailyTaskCompletionDates();
      return data;
    } catch (err: any) {
      console.error('Error loading tasks:', err);
      setError('Failed to load tasks');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Calculate current NOW tab task count (tasks with P1-P3)
  const getNowTaskCount = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nowTasks = tasks.filter(task => 
      task.priority && task.priority >= 1 && task.priority <= 3 && 
      task.is_active && !task.is_completed &&
      task.due_date && parseDateString(task.due_date) <= today
    );
    
    const nowProjectTasks = projectTasksDueToday.filter(task => 
      task.priority && task.priority >= 1 && task.priority <= 3 && 
      !task.is_completed &&
      task.due_date && parseDateString(task.due_date) <= today
    );
    
    const nowGoalTasks = goalTasksDueToday.filter(task => 
      task.priority && task.priority >= 1 && task.priority <= 3 && 
      !task.is_completed &&
      task.due_date && parseDateString(task.due_date) <= today
    );
    
    return nowTasks.length + nowProjectTasks.length + nowGoalTasks.length;
  };

  // Simplified priority change handler - no automatic NOW queue management
  const handlePriorityChange = async (taskId: number, newPriority: number, taskType: 'task' | 'project' | 'goal' = 'task') => {
    try {
      // Handle empty priority (set to null)
      if (isNaN(newPriority)) {
        const endpoint = taskType === 'project' ? `/api/projects/tasks/${taskId}` :
                        taskType === 'goal' ? `/api/life-goals/tasks/${taskId}` :
                        `/api/tasks/${taskId}`;
        await api.put(endpoint, { priority: null });
        await loadTasks();
        if (taskType === 'project') await loadProjectTasksDueToday();
        if (taskType === 'goal') await loadGoalTasksDueToday();
        return;
      }

      // For goal tasks, convert integer priority to string
      if (taskType === 'goal') {
        let priorityString: string;
        if (newPriority <= 3) priorityString = 'high';
        else if (newPriority <= 6) priorityString = 'medium';
        else priorityString = 'low';
        
        await api.put(`/api/life-goals/tasks/${taskId}`, { priority: priorityString });
        await loadGoalTasksDueToday();
        return;
      }

      // For project tasks, update priority_new (integer 1-10), not the old string priority
      if (taskType === 'project') {
        console.log(`Updating project task ${taskId}: priority_new = ${newPriority}`);
        await api.put(`/api/projects/tasks/${taskId}`, { priority_new: newPriority });
        await loadProjectTasksDueToday();
        console.log('Project tasks reloaded, checking task:', projectTasksDueToday.find(t => t.id === taskId));
        return;
      }

      // For regular tasks, use integer priority
      await api.put(`/api/tasks/${taskId}`, { priority: newPriority });
      await loadTasks();
    } catch (err: any) {
      console.error('Failed to update priority:', err);
      console.error('Error details:', err.response?.data || err.message);
      alert(`Failed to update task priority: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
    }
  };

  // Move task to NOW (set priority to 1 and due_date to today)
  const handleMoveToNow = async (taskId: number, taskType: 'task' | 'project' | 'goal' = 'task') => {
    try {
      console.log('handleMoveToNow called:', taskId, taskType);
      const currentNowCount = getNowTaskCount();
      if (currentNowCount >= 3) {
        alert('NOW tab is full (max 3 tasks). Please complete or move existing NOW tasks first.');
        return;
      }
      
      // Set priority to 1 and due_date to today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayDateOnly = formatDateForInput(today); // YYYY-MM-DD format
      const todayISO = today.toISOString(); // Full ISO string with time: 2025-12-09T00:00:00.000Z
      
      console.log('Updating task with:', { priority: 1, due_date: taskType === 'project' ? todayDateOnly : todayISO });
      
      if (taskType === 'goal') {
        await api.put(`/api/life-goals/tasks/${taskId}`, { 
          priority: 'high',
          due_date: todayDateOnly
        });
        await loadGoalTasksDueToday();
      } else if (taskType === 'project') {
        await api.put(`/api/projects/tasks/${taskId}`, { 
          priority_new: 1,
          due_date: todayDateOnly
        });
        await loadProjectTasksDueToday();
      } else {
        console.log('Making API call to /api/tasks/' + taskId);
        const response = await api.put(`/api/tasks/${taskId}`, { 
          priority: 1,
          due_date: todayISO
        });
        console.log('API response:', response);
      }
      
      // Wait for all data to reload before navigating
      console.log('Reloading all task data...');
      const freshTasks = await loadTasks(); // Must complete before navigating to NOW tab
      await loadProjectTasksDueToday();
      await loadGoalTasksDueToday();
      await loadTodaysOnlyTasks(freshTasks);
      await loadUpcomingTasks();
      console.log('Task moved to NOW successfully, all data reloaded');
      
      // Auto-navigate to NOW tab so user can see the task immediately
      setActiveTab('now');
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('tab', 'now');
      navigate(`?${searchParams.toString()}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to move to NOW - Full error:', err);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Error message:', err.message);
      
      // Handle validation errors (422)
      let errorMsg = 'Unknown error';
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Pydantic validation errors
          errorMsg = err.response.data.detail.map((e: any) => 
            `${e.loc?.join('.') || 'field'}: ${e.msg}`
          ).join(', ');
        } else if (typeof err.response.data.detail === 'string') {
          errorMsg = err.response.data.detail;
        }
      } else {
        errorMsg = err.response?.data?.message || err.message;
      }
      
      alert(`Failed to move task to NOW: ${errorMsg}`);
    }
  };

  // Move habit to NOW
  const handleMoveHabitToNow = (habitId: number) => {
    console.log('=== handleMoveHabitToNow called ===');
    console.log('habitId:', habitId);
    console.log('Current nowHabits before:', Array.from(nowHabits));
    
    const updatedNowHabits = new Set(nowHabits);
    updatedNowHabits.add(habitId);
    
    console.log('Updated nowHabits after:', Array.from(updatedNowHabits));
    
    setNowHabits(updatedNowHabits);
    localStorage.setItem('nowHabits', JSON.stringify([...updatedNowHabits]));
    
    console.log('localStorage saved:', localStorage.getItem('nowHabits'));
    console.log('===================================');
    
    // Reload habits to update both NOW and Today tabs
    loadTodaysHabits();
  };

  // Move habit back to Today
  const handleMoveHabitToToday = (habitId: number) => {
    console.log('Moving habit to Today:', habitId);
    const updatedNowHabits = new Set(nowHabits);
    updatedNowHabits.delete(habitId);
    setNowHabits(updatedNowHabits);
    localStorage.setItem('nowHabits', JSON.stringify([...updatedNowHabits]));
    // Reload habits to update both NOW and Today tabs
    loadTodaysHabits();
  };

  // Move task to Today (set priority to 4 or higher)
  const handleMoveToToday = async (taskId: number, taskType: 'task' | 'project' | 'goal' = 'task') => {
    try {
      console.log('handleMoveToToday called:', taskId, taskType);
      await handlePriorityChange(taskId, 4, taskType);
      // Force refresh all data to update NOW tab
      await loadTasks();
      await loadProjectTasksDueToday();
      await loadGoalTasksDueToday();
      console.log('Task moved to Today successfully');
    } catch (err: any) {
      console.error('Failed to move to Today:', err);
      alert('Failed to move task to Today');
    }
  };

  // Handle row hover/focus with automatic scroll adjustment to avoid sticky footer overlap
  const handleRowVisibility = (element: HTMLElement) => {
    const container = element.closest('.tasks-table-container') as HTMLElement;
    
    if (!container) return;
    
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Height of the sticky footer (Total Time row) - approximate
    const footerHeight = 100;
    
    // Calculate the bottom boundary where content should not overlap
    const safeBottomBoundary = containerRect.bottom - footerHeight;
    
    // If the element is overlapping with the footer area
    if (elementRect.bottom > safeBottomBoundary && elementRect.top < containerRect.bottom) {
      // Calculate how much we need to scroll up
      const scrollAdjustment = elementRect.bottom - safeBottomBoundary + 20; // +20 for extra padding
      
      // Smoothly scroll the container
      container.scrollBy({
        top: scrollAdjustment,
        behavior: 'smooth'
      });
    }
  };

  // Load habits function
  const loadHabits = async () => {
    try {
      console.log('🔄 loadHabits() called - fetching habits...');
      // Load active habits
      const response: any = await api.get('/api/habits/');
      const data = response.data || response;
      console.log('✅ Active habits API response:', data);
      const habitsList = Array.isArray(data) ? data : [];
      console.log('✅ Setting active habits count:', habitsList.length, habitsList.map((h: any) => ({ id: h.id, name: h.name, is_active: h.is_active })));
      setHabits(habitsList);
      
      // Load completed habits (inactive habits)
      const completedResponse: any = await api.get('/api/habits/?active_only=false');
      const completedData = completedResponse.data || completedResponse;
      console.log('✅ All habits API response:', completedData);
      const completedList = Array.isArray(completedData) ? completedData.filter((h: any) => !h.is_active) : [];
      console.log('✅ Setting completed habits count:', completedList.length, completedList.map((h: any) => ({ id: h.id, name: h.name, is_active: h.is_active })));
      setCompletedHabits(completedList);
      
      // Reset selected month to current month when loading habits
      setHabitSelectedMonth(new Date());
      
      // Load month days for each active habit
      habitsList.forEach((habit: any) => {
        loadHabitMonthDays(habit.id, new Date());
      });
    } catch (err: any) {
      console.error('Error loading habits:', err);
      setHabits([]);
      setCompletedHabits([]);
    }
  };

  // Load last 7 days of habit entries
  const loadHabitMonthDays = async (habitId: number, monthDate?: Date) => {
    try {
      const targetMonth = monthDate || habitSelectedMonth[habitId] || new Date();
      const year = targetMonth.getFullYear();
      const month = targetMonth.getMonth() + 1; // API expects 1-12
      
      // Use new month-data endpoint that works with linked tasks
      const monthDays: any = await api.get(`/api/habits/${habitId}/month-data?year=${year}&month=${month}`);
      const monthDaysData = monthDays.data || monthDays;
      
      setHabitMonthDays(prev => ({ ...prev, [habitId]: monthDaysData }));
    } catch (err) {
      console.error(`Error loading month days for habit ${habitId}:`, err);
    }
  };

  // Load daily task statuses for a specific date
  const loadDailyStatuses = useCallback(async (date: Date) => {
    try {
      const dateStr = formatDateForInput(date);
      const response = await api.get<DailyTaskStatus[]>(`/api/daily-task-status/date/${dateStr}`);
      const statusMap = new Map(response.map((s: DailyTaskStatus) => [s.task_id, s]));
      setDailyStatuses(statusMap);
    } catch (err: any) {
      console.error('Error loading daily statuses:', err);
      // Don't set error state, just log - this is not critical
    }
  }, []);

  // Load daily time entries from backend for selected date
  const loadDailyEntries = useCallback(async (date: Date) => {
    try {
      const dateStr = formatDateForInput(date);
      const entries = await api.get<any[]>(`/api/daily-time/entries/${dateStr}`);
      
      // Convert entries array to hourlyEntries map format
      const entriesMap: Record<string, number> = {}
      entries.forEach((entry: any) => {
        const key = `${entry.task_id}-${entry.hour}`;
        entriesMap[key] = entry.minutes;
      });
      
      // Update both state and ref in sync
      hourlyEntriesRef.current = entriesMap;
      setHourlyEntries(entriesMap);
      
      // Load daily task statuses for this date
      await loadDailyStatuses(date);
    } catch (err) {
      console.error('Error loading daily entries:', err);
      // On error, reset to empty
      const emptyMap: Record<string, number> = {}
      hourlyEntriesRef.current = emptyMap;
      setHourlyEntries(emptyMap);
    }
  }, [loadDailyStatuses]);

  // Load list of incomplete days
  const loadIncompleteDays = useCallback(async () => {
    try {
      const days = await api.get<any[]>('/api/daily-time/incomplete-days/');
      console.log('📊 Incomplete days loaded:', days.length, days);
      setIncompleteDays(days);
      setIncompleteDaysLoaded(true);
    } catch (err) {
      console.error('Error loading incomplete days:', err);
      setIncompleteDaysLoaded(true); // Still mark as loaded even on error
    }
  }, []);

  // Load list of ignored days
  const loadIgnoredDays = useCallback(async () => {
    try {
      const days = await api.get<any[]>('/api/daily-time/ignored-days/');
      setIgnoredDays(days);
    } catch (err) {
      console.error('Error loading ignored days:', err);
    }
  }, []);

  // Load project tasks and milestones (must be defined before handleSelectProject)
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

  const loadProjectMilestones = async (projectId: number) => {
    try {
      const response = await api.get(`/api/projects/${projectId}/milestones`);
      const data = response.data || response;
      const milestonesArray = Array.isArray(data) ? data : [];
      console.log('Loaded milestones for project', projectId, ':', milestonesArray);
      setProjectMilestones(milestonesArray);
    } catch (error) {
      console.error('Error loading project milestones:', error);
      setProjectMilestones([]);
    }
  };

  // Handle selecting a project (moved here to avoid "before initialization" error)
  const handleSelectProject = async (project: ProjectData) => {
    setSelectedProject(project);
    await loadProjectTasks(project.id);
    await loadProjectMilestones(project.id);
    
    // Load challenges related to this project
    try {
      const challenges = await api.get<{direct_challenges: any[], goal_challenges: any[]}>(`/api/projects/${project.id}/challenges`);
      setProjectChallenges(challenges);
      console.log('Project challenges loaded:', challenges);
    } catch (challengesError) {
      console.warn('Could not load project challenges:', challengesError);
      setProjectChallenges(null);
    }
    
    // Update URL to include project ID for refresh persistence
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('project', project.id.toString());
    navigate(`?${searchParams.toString()}`, { replace: true });
  };

  // Handle URL parameters on mount and when location changes
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    const projectParam = searchParams.get('project');
    const dateParam = searchParams.get('date');
    const actionParam = searchParams.get('action');
    
    console.log('🔍 URL params changed:', { tab: tabParam, project: projectParam, date: dateParam, action: actionParam });

    // Handle action parameter to open modals
    if (actionParam === 'add' && tabParam === 'projects') {
      setShowAddProjectModal(true);
      // Remove action param from URL after opening modal
      searchParams.delete('action');
      navigate(`?${searchParams.toString()}`, { replace: true });
    }

    // Set active tab if provided (when URL changes)
    if (tabParam) {
      const validTabs: TabType[] = ['now', 'today', 'daily', 'weekly', 'monthly', 'upcoming', 'quarterly', 'yearly', 'onetime', 'misc', 'projects', 'habits'];
      if (validTabs.includes(tabParam as TabType)) {
        setActiveTab(tabParam as TabType);
      }
    }

    // Set selected date if provided in URL (for preserving state on refresh)
    if (dateParam) {
      try {
        // Parse date as local (YYYY-MM-DD) to avoid timezone shift
        const [year, month, day] = dateParam.split('-').map(Number);
        const date = new Date(year, month - 1, day, 12, 0, 0, 0); // Use noon to avoid DST issues
        date.setHours(0, 0, 0, 0); // Then set to midnight
        console.log('📅 URL date param:', dateParam, '→ Parsed date:', date.toLocaleDateString(), 'ISO:', date.toISOString(), 'getDate():', date.getDate());
        if (!isNaN(date.getTime())) {
          setSelectedDate(date);
          console.log('✅ Set selectedDate to:', date);
        }
      } catch (e) {
        console.error('Invalid date parameter:', dateParam);
      }
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

  // Sync selectedDate to URL for daily tab (to preserve state on refresh)
  useEffect(() => {
    if (activeTab === 'daily' || activeTab === 'today') {
      const searchParams = new URLSearchParams(location.search);
      const currentDateParam = searchParams.get('date');
      const newDateParam = formatDateForInput(selectedDate);
      
      // Only update URL if date actually changed to avoid infinite loops
      if (currentDateParam !== newDateParam) {
        searchParams.set('date', newDateParam);
        navigate(`?${searchParams.toString()}`, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, activeTab]);

  // Select project when projects are loaded and we have a pending project ID
  useEffect(() => {
    if (pendingProjectId !== null && projects.length > 0) {
      const project = projects.find(p => p.id === pendingProjectId);
      if (project) {
        handleSelectProject(project);
        setPendingProjectId(null); // Clear pending ID after selection
      } else {
        console.warn('Project not found with ID:', pendingProjectId);
      }
    }
  }, [projects, pendingProjectId]);

  useEffect(() => {
    loadTasks();
    loadIncompleteDays();
    loadIgnoredDays();
    loadLifeGoals(); // Load goals for project linking
    // Don't load daily entries here - let the URL params or tab change handle it
  }, [loadIncompleteDays, loadIgnoredDays]);

  // Separate effect to load data once tasks are ready
  useEffect(() => {
    // Only load data if tasks have been loaded first
    if (tasks.length === 0) return;
    
    // Mark that tasks have been loaded (only once)
    if (!tasksLoadedRef.current) {
      tasksLoadedRef.current = true;
      
      // Trigger initial data load for the active tab
      if (activeTab === 'now') {
        // NOW tab needs project and goal tasks, plus habits
        loadProjectTasksDueToday();
        loadGoalTasksDueToday();
        loadTodaysHabits(); // Load habits so NOW habits can be displayed
      } else if (activeTab === 'daily') {
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
        loadTodaysHabits();
        loadTodaysChallenges();
        loadProjectTasksDueToday();
        loadGoalTasksDueToday();
        loadMiscTaskGroups(); // Load misc tasks for Today tab
        loadOneTimeTasks();
        loadWeeklyEntries(selectedWeekStart);
        loadMonthlyEntries(selectedMonthStart);
        loadYearlyEntries(selectedYearStart); // Load yearly data for Needs Attention section
      }
    }
  }, [tasks.length]);

  // Load data when tab or date changes (but only after tasks are loaded)
  useEffect(() => {
    if (!tasksLoadedRef.current) return;
    
    if (activeTab === 'now') {
      // NOW tab needs project and goal tasks, plus habits
      loadProjectTasksDueToday();
      loadGoalTasksDueToday();
      loadTodaysHabits(); // Load habits so NOW habits can be displayed
    } else if (activeTab === 'daily') {
      loadDailyEntries(selectedDate);
    } else if (activeTab === 'weekly') {
      loadWeeklyEntries(selectedWeekStart);
    } else if (activeTab === 'monthly') {
      loadMonthlyEntries(selectedMonthStart);
    } else if (activeTab === 'quarterly') {
      // Load yearly aggregates for quarterly display (sum quarters from months)
      loadYearlyEntries(selectedYearStart);
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
      console.log('🚀 TODAY TAB LOADING - Starting all data loads...');
      loadTodaysHabits();
      loadTodaysChallenges();
      loadProjectTasksDueToday();
      loadGoalTasksDueToday();
      loadTodaysOnlyTasks();
      loadMiscTaskGroups(); // Load misc tasks so they appear in Today tab
      loadImportantTasksDueToday();
      loadWeeklyTasksNeedingAttention();
      loadMonthlyTasksNeedingAttention();
      loadUpcomingTasks();
      // Load one-time tasks so we can check for overdue ones
      loadOneTimeTasks();
      // Load weekly, monthly, and yearly data for "Needs Attention" section
      loadWeeklyEntries(selectedWeekStart);
      loadMonthlyEntries(selectedMonthStart);
      loadYearlyEntries(selectedYearStart); // Load yearly data for Needs Attention section
    }
  }, [activeTab, selectedDate, selectedWeekStart, selectedMonthStart, selectedYearStart]);

  // Reload overdue one-time tasks when tasks or oneTimeTasks change
  useEffect(() => {
    if (activeTab === 'today' && tasks.length > 0 && oneTimeTasks.length > 0) {
      loadOverdueOneTimeTasks();
    }
  }, [tasks, oneTimeTasks, activeTab]);

  // Reload Today tab sections when data changes
  useEffect(() => {
    if (activeTab === 'today') {
      loadTodaysOnlyTasks();
      loadMiscTasksDueToday();
      loadImportantTasksDueToday();
      loadWeeklyTasksNeedingAttention();
      loadMonthlyTasksNeedingAttention();
      loadUpcomingTasks();
    }
  }, [tasks, miscTasks, weeklyTaskStatuses, monthlyTaskStatuses, activeTab]);

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

  const weekDays = generateWeekDays(selectedWeekStart);

  // Memoized version that will recompute when dependencies change
  const tasksNeedingAttention = useMemo(() => {
    return getTasksNeedingAttention();
  }, [tasks, weeklyTaskStatuses, monthlyTaskStatuses, yearlyTaskStatuses, weeklyEntries, dailyAggregates, monthlyEntries, monthlyDailyAggregates, selectedWeekStart, selectedMonthStart, activeTab]);

  // Calculate tab counts for badges
  const tabCounts = useMemo(() => {
    const todayTasksCount = tasksNeedingAttention.filter(item => 
      !item.task.priority || item.task.priority > 3
    ).length;
    const weeklyTasksCount = tasksNeedingAttention.filter(item => 
      item.reason === 'weekly' && (!item.task.priority || item.task.priority > 3)
    ).length;
    const monthlyTasksCount = tasksNeedingAttention.filter(item => 
      item.reason === 'monthly' && (!item.task.priority || item.task.priority > 3)
    ).length;
    const quarterlyTasksCount = tasksNeedingAttention.filter(item => 
      item.reason === 'quarterly' && (!item.task.priority || item.task.priority > 3)
    ).length;
    const yearlyTasksCount = tasksNeedingAttention.filter(item => 
      item.reason === 'yearly' && (!item.task.priority || item.task.priority > 3)
    ).length;
    
    return {
      today: todayTasksCount,
      weekly: weeklyTasksCount,
      monthly: monthlyTasksCount,
      quarterly: quarterlyTasksCount,
      yearly: yearlyTasksCount
    };
  }, [tasksNeedingAttention]);

  // Filter tasks by active tab
  // Also filter out completed/NA tasks that are older than today
  const filteredTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Debug: Check if missing tasks are in the tasks array
    const debugTaskIds = [5, 6, 12, 20, 24];
    console.log(`🔍 [filteredTasks useMemo] Running filter, activeTab=${activeTab}, total tasks=${tasks.length}`);
    const debugTasks = tasks.filter(t => debugTaskIds.includes(t.id));
    console.log(`🔍 [filteredTasks useMemo] Missing tasks in tasks array (${debugTasks.length}/5):`, debugTasks.map(t => ({
      id: t.id,
      name: t.name,
      follow_up_frequency: t.follow_up_frequency,
      is_active: t.is_active,
      is_completed: t.is_completed
    })));
    
    return tasks.filter(task => {
      // Debug each missing task
      const isDebugTask = debugTaskIds.includes(task.id);
      if (isDebugTask) {
        console.log(`🔍 [Filter Processing] Task ${task.id} (${task.name}) - activeTab=${activeTab}`);
      }
      
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
        
        // Show task ONLY if it has been explicitly added to weekly tracking
        if (!hasBeenAddedToWeekly) {
          return false;
        }
        
        // NEW: Prevent tasks that have EVER been manually completed/NA from reappearing
        // This applies to both native weekly tasks (frequency='weekly') AND monitoring tasks
        if (everCompletedTaskIds.has(task.id)) {
          return false;
        }
        
      } else if (activeTab === 'monthly') {
        const hasBeenAddedToMonthly = monthlyTaskStatuses[task.id] !== undefined;
        
        // Show if explicitly added OR if it's a daily/weekly task (they should always appear)
        if (!hasBeenAddedToMonthly && task.follow_up_frequency !== 'daily' && task.follow_up_frequency !== 'weekly') {
          return false;
        }
        
      } else if (activeTab === 'quarterly') {
        const hasBeenAddedToQuarterly = yearlyTaskStatuses[task.id] !== undefined;
        
        // Show if explicitly added OR if it's a daily/weekly/monthly task
        if (!hasBeenAddedToQuarterly && task.follow_up_frequency !== 'daily' && task.follow_up_frequency !== 'weekly' && task.follow_up_frequency !== 'monthly') {
          return false;
        }
        
      } else if (activeTab === 'yearly') {
        const hasBeenAddedToYearly = yearlyTaskStatuses[task.id] !== undefined;
        
        // Show if explicitly added OR if it's a daily/weekly/monthly task  
        if (!hasBeenAddedToYearly && task.follow_up_frequency !== 'daily' && task.follow_up_frequency !== 'weekly' && task.follow_up_frequency !== 'monthly') {
          return false;
        }
        
      } else {
        // Debug specific tasks
        const debugTaskIds = [5, 6, 12, 20, 24];
        if (debugTaskIds.includes(task.id)) {
          console.log(`🔍 [Tab Filter] Task ${task.id} (${task.name}):`, {
            activeTab,
            follow_up_frequency: task.follow_up_frequency,
            matches: task.follow_up_frequency === activeTab
          });
        }
        if (task.follow_up_frequency !== activeTab) {
          if (debugTaskIds.includes(task.id)) {
            console.log(`❌ [Tab Filter] Task ${task.id} filtered: frequency mismatch`);
          }
          return false;
        }
      }
      
      // For weekly tab: Handle weekly-specific completion status
      if (activeTab === 'weekly') {
        const taskStatus = weeklyTaskStatuses[task.id];
        if (taskStatus && (taskStatus.is_completed || taskStatus.is_na)) {
          // Check if we're viewing a week in the past
          const viewingWeekStart = new Date(selectedWeekStart);
          viewingWeekStart.setHours(0, 0, 0, 0);
          const viewingWeekEnd = new Date(viewingWeekStart);
          viewingWeekEnd.setDate(viewingWeekEnd.getDate() + 6); // Sunday
          viewingWeekEnd.setHours(23, 59, 59, 999);
          
          const now = new Date();
          
          // If the week has ended (past Sunday 11:59 PM), hide completed/NA tasks
          if (now > viewingWeekEnd) {
            return false;
          }
          // If viewing current week, show them (with green/gray background)
          return true;
        }
        return true;
      }
      
      // For monthly tab: Handle monthly-specific completion status
      if (activeTab === 'monthly') {
        const taskStatus = monthlyTaskStatuses[task.id];
        if (taskStatus && (taskStatus.is_completed || taskStatus.is_na)) {
          // Check if we're viewing a month in the past
          const viewingMonthStart = new Date(selectedMonthStart);
          viewingMonthStart.setHours(0, 0, 0, 0);
          const viewingMonthEnd = new Date(viewingMonthStart.getFullYear(), viewingMonthStart.getMonth() + 1, 0);
          viewingMonthEnd.setHours(23, 59, 59, 999);
          
          const now = new Date();
          
          // If the month has ended, hide completed/NA tasks
          if (now > viewingMonthEnd) {
            return false;
          }
          // If viewing current month, show them (with green/gray background)
          return true;
        }
        return true;
      }
      
      // For yearly tab: Handle yearly-specific completion status
      if (activeTab === 'yearly') {
        const taskStatus = yearlyTaskStatuses[task.id];
        if (taskStatus && (taskStatus.is_completed || taskStatus.is_na)) {
          return true;
        }
        return true;
      }
      
      // For daily tab: Handle date-based visibility with completion history
      if (activeTab === 'daily') {
        const viewingDate = new Date(selectedDate);
        viewingDate.setHours(0, 0, 0, 0);
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        
        // Debug specific tasks
        const debugTaskIds = [5, 6, 12, 20, 24]; // Cloud, LLM GenAI, Sleep, Parent Talk, Daughter Sports
        const isDebugTask = debugTaskIds.includes(task.id);
        
        if (isDebugTask) {
          console.log(`🔍 [Daily Tab Filter] Task ${task.id} (${task.name}):`, {
            viewingDate: viewingDate.toISOString(),
            created_at: task.created_at,
            is_active: task.is_active,
            is_completed: task.is_completed,
            is_daily_one_time: task.is_daily_one_time
          });
        }
        
        // Rule 1: Don't show task if viewing date is BEFORE task was created
        if (task.created_at) {
          const taskCreatedDate = new Date(task.created_at);
          taskCreatedDate.setHours(0, 0, 0, 0);
          if (viewingDate < taskCreatedDate) {
            if (isDebugTask) console.log(`❌ Rule 1: Viewing date before task creation`);
            return false; // Task didn't exist on this date
          }
        }
        
        // Rule 2: Check if task has daily_task_status entry for the viewing date
        const status = dailyStatuses.get(task.id);
        
        if (isDebugTask) {
          console.log(`   Status check:`, { hasStatus: !!status, status });
        }
        
        // If there's a status for today's viewing date and it's completed/NA,
        // show it (it will appear in completed section until midnight)
        if (status && (status.is_completed || status.is_na)) {
          if (isDebugTask) console.log(`✅ Rule 2: Has completed/NA status for today`);
          return true;
        }
        
        // Rule 3: Check if task was completed on any PREVIOUS day
        // If yes, hide it (user manually completed it, so it should disappear after midnight)
        const completionDateStr = dailyTaskCompletionDates.get(task.id);
        
        if (isDebugTask) {
          console.log(`   Completion history:`, { completionDateStr });
        }
        
        if (completionDateStr) {
          // Parse as local date (not UTC) to avoid timezone issues
          const [year, month, day] = completionDateStr.split('-').map(Number);
          const completionDate = new Date(year, month - 1, day);
          completionDate.setHours(0, 0, 0, 0);
          
          // If task was completed BEFORE viewing date, hide it permanently
          if (completionDate < viewingDate) {
            if (isDebugTask) console.log(`❌ Rule 3: Completed on previous day (${completionDateStr})`);
            return false;
          }
          // If completed ON viewing date, it's already handled by Rule 2 above
        }
        
        // Rule 4: Show all active tasks that were never completed
        if (isDebugTask) console.log(`✅ Rule 4: Active task with no completion history`);
        return task.is_active;
      }
      
      // For today tab: Filter completed/NA tasks and priority 1-3 tasks (they show in NOW tab)
      if (activeTab === 'today') {
        const status = dailyStatuses.get(task.id);
        if (status && (status.is_completed || status.is_na)) {
          return false;
        }
        // Exclude priority 1-3 tasks from Today tab (they appear in NOW tab)
        if (task.priority && task.priority <= 3) {
          return false;
        }
      }
      
      // For daily tab: Allow completed tasks (they'll show in completed section)
      // For other tabs: Filter out completed tasks
      if (activeTab === 'daily') {
        // For daily tab, show tasks that are active OR completed today
        // Check if task is completed via daily status OR global completion
        const status = dailyStatuses.get(task.id);
        
        if (isDebugTask) {
          console.log(`🔍 [Daily Tab Final Check] Task ${task.id}:`, {
            status,
            is_completed: task.is_completed,
            is_active: task.is_active
          });
        }
        
        // Always show if marked complete via daily status
        if (status && status.is_completed) {
          if (isDebugTask) console.log(`✅ Passed: has completed status`);
          return true;
        }
        
        // Show if globally completed (during reload when dailyStatuses might be empty)
        if (task.is_completed) {
          if (isDebugTask) console.log(`✅ Passed: globally completed`);
          return true;
        }
        
        // Show if marked as NA for today
        if (status && status.is_na) {
          if (isDebugTask) console.log(`✅ Passed: marked NA`);
          return true;
        }
        
        // Show all active tasks
        if (isDebugTask) console.log(`${task.is_active ? '✅' : '❌'} Final result: is_active = ${task.is_active}`);
        return task.is_active;
      }

      return task.is_active && !task.is_completed;
    })
    .sort((a, b) => {
      const keyA = `${a.pillar_name}|${a.category_name}`;
      const keyB = `${b.pillar_name}|${b.category_name}`;
      const orderA = hierarchyOrder[keyA] || 999;
      const orderB = hierarchyOrder[keyB] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      const nameOrderA = taskNameOrder[a.name] || 999;
      const nameOrderB = taskNameOrder[b.name] || 999;
      
      if (nameOrderA !== nameOrderB) {
        return nameOrderA - nameOrderB;
      }
      
      return a.name.localeCompare(b.name);
    });
  }, [tasks, activeTab, weekDays, dailyAggregates, weeklyEntries, weeklyTaskStatuses, monthlyTaskStatuses, yearlyTaskStatuses, dailyStatuses, selectedDate, hierarchyOrder, taskNameOrder]);

  // Separate tasks by type for daily and weekly tabs
  const timeBasedTasks = useMemo(() => {
    if (activeTab === 'daily' || activeTab === 'weekly' || activeTab === 'monthly' || activeTab === 'quarterly' || activeTab === 'yearly') {
      // For daily tab: exclude completed/NA tasks from main table (they show in completed section)
      if (activeTab === 'daily') {
        return filteredTasks.filter(task => {
          const status = dailyStatuses.get(task.id);
          const isCompletedOrNA = status && (status.is_completed || status.is_na);
          return task.task_type === TaskType.TIME && !task.is_daily_one_time && !isCompletedOrNA;
        });
      }
      // For weekly tab: exclude completed/NA tasks from main table (they show in completed section)
      if (activeTab === 'weekly') {
        return filteredTasks.filter(task => {
          const status = weeklyTaskStatuses[task.id];
          const isCompletedOrNA = status && (status.is_completed || status.is_na);
          return task.task_type === TaskType.TIME && !task.is_daily_one_time && !isCompletedOrNA;
        });
      }
      return filteredTasks.filter(task => task.task_type === TaskType.TIME && !task.is_daily_one_time);
    }
    return [];
  }, [activeTab, filteredTasks, dailyStatuses, weeklyTaskStatuses]);
  
  const countBasedTasks = useMemo(() => {
    if (activeTab === 'daily' || activeTab === 'weekly' || activeTab === 'monthly' || activeTab === 'quarterly' || activeTab === 'yearly') {
      // For daily tab: exclude completed/NA tasks from main table
      if (activeTab === 'daily') {
        return filteredTasks.filter(task => {
          const status = dailyStatuses.get(task.id);
          const isCompletedOrNA = status && (status.is_completed || status.is_na);
          return task.task_type === TaskType.COUNT && !isCompletedOrNA;
        });
      }
      // For weekly tab: exclude completed/NA tasks from main table
      if (activeTab === 'weekly') {
        return filteredTasks.filter(task => {
          const status = weeklyTaskStatuses[task.id];
          const isCompletedOrNA = status && (status.is_completed || status.is_na);
          return task.task_type === TaskType.COUNT && !isCompletedOrNA;
        });
      }
      return filteredTasks.filter(task => task.task_type === TaskType.COUNT);
    }
    return [];
  }, [activeTab, filteredTasks, dailyStatuses, weeklyTaskStatuses]);
  
  const booleanTasks = useMemo(() => {
    if (activeTab === 'daily' || activeTab === 'weekly' || activeTab === 'monthly' || activeTab === 'quarterly' || activeTab === 'yearly') {
      // For daily tab: exclude completed/NA tasks from main table
      if (activeTab === 'daily') {
        return filteredTasks.filter(task => {
          const status = dailyStatuses.get(task.id);
          const isCompletedOrNA = status && (status.is_completed || status.is_na);
          return task.task_type === TaskType.BOOLEAN && !isCompletedOrNA;
        });
      }
      // For weekly tab: exclude completed/NA tasks from main table
      if (activeTab === 'weekly') {
        return filteredTasks.filter(task => {
          const status = weeklyTaskStatuses[task.id];
          const isCompletedOrNA = status && (status.is_completed || status.is_na);
          return task.task_type === TaskType.BOOLEAN && !isCompletedOrNA;
        });
      }
      return filteredTasks.filter(task => task.task_type === TaskType.BOOLEAN);
    }
    return [];
  }, [activeTab, filteredTasks, dailyStatuses, weeklyTaskStatuses]);

  // Early returns for loading and error states (must come AFTER all hooks)
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

  // Daily-specific completion handlers - mark only the daily entry for current date
  const handleDailyTaskComplete = async (taskId: number) => {
    try {
      const dateStr = formatDateForInput(selectedDate);
      await api.post(`/api/daily-task-status/${taskId}/complete`, null, {
        params: { status_date: dateStr }
      });
      // Reload daily statuses, entries, and completion dates
      await loadDailyStatuses(selectedDate);
      await loadDailyEntries(selectedDate);
      await loadDailyTaskCompletionDates();
    } catch (err: any) {
      console.error('Error marking daily task complete:', err);
      alert('Failed to mark task as completed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDailyTaskNA = async (taskId: number) => {
    try {
      const dateStr = formatDateForInput(selectedDate);
      await api.post(`/api/daily-task-status/${taskId}/na`, null, {
        params: { status_date: dateStr }
      });
      // Reload daily statuses and entries
      await loadDailyStatuses(selectedDate);
      await loadDailyEntries(selectedDate);
    } catch (err: any) {
      console.error('Error marking daily task NA:', err);
      alert('Failed to mark task as NA: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUndoComplete = async (taskId: number) => {
    try {
      const dateStr = formatDateForInput(selectedDate);
      await api.post(`/api/daily-task-status/${taskId}/reset`, null, {
        params: { status_date: dateStr }
      });
      // Reload daily statuses and entries
      await loadDailyStatuses(selectedDate);
      await loadDailyEntries(selectedDate);
    } catch (err: any) {
      console.error('Error resetting task status:', err);
      alert('Failed to undo task status: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Tracking management functions
  const handleRemoveFromTracking = async (taskId: number) => {
    try {
      const dateStr = formatDateForInput(selectedDate);
      await api.post(`/api/daily-task-status/${taskId}/remove-from-tracking`, null, {
        params: { status_date: dateStr }
      });
      // Reload daily statuses and entries
      await loadDailyStatuses(selectedDate);
      await loadDailyEntries(selectedDate);
    } catch (err: any) {
      console.error('Error removing task from tracking:', err);
      alert('Failed to remove task from tracking: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAddToTracking = async (taskId: number) => {
    try {
      const dateStr = formatDateForInput(selectedDate);
      await api.post(`/api/daily-task-status/${taskId}/add-to-tracking`, null, {
        params: { status_date: dateStr }
      });
      // Reload daily statuses and entries
      await loadDailyStatuses(selectedDate);
      await loadDailyEntries(selectedDate);
    } catch (err: any) {
      console.error('Error adding task to tracking:', err);
      alert('Failed to add task to tracking: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleTaskComplete = async (taskId: number) => {
    try {
      // For DAILY tab, use daily-specific handler
      if (activeTab === 'daily') {
        return handleDailyTaskComplete(taskId);
      }
      
      // Find the task to check its frequency and priority
      const task = tasks.find(t => t.id === taskId);
      const completingHighPriorityTask = task && task.priority && task.priority <= 3;
      
      // Mark task as globally completed
      await api.post(`/api/tasks/${taskId}/complete`, {});
      
      // If this is a DAILY task, cascade to Weekly/Monthly ONLY if already being monitored there
      // This prevents unmonitored tasks from suddenly appearing in those tabs
      if (task && task.follow_up_frequency === 'daily') {
        try {
          // Only cascade to Weekly if task is already being monitored there
          if (weeklyTaskStatuses[taskId] !== undefined) {
            const weekDateStr = formatDateForInput(selectedWeekStart);
            await api.post(`/api/weekly-time/status/${taskId}/complete?week_start_date=${weekDateStr}`, {});
          }
          
          // Only cascade to Monthly if task is already being monitored there
          if (monthlyTaskStatuses[taskId] !== undefined) {
            const monthDateStr = formatDateForInput(selectedMonthStart);
            await api.post(`/api/monthly-time/status/${taskId}/complete?month_start_date=${monthDateStr}`, {});
          }
        } catch (statusErr) {
          console.warn('Failed to mark weekly/monthly status:', statusErr);
          // Don't fail the whole operation if status marking fails
        }
      }
      
      // Reload tasks to get updated data
      await loadTasks();
      
      // SMART QUEUE PROMOTION: If we just completed a P1-P3 task, check if we need to promote another task
      if (completingHighPriorityTask) {
        // Get all today's tasks with priorities (from all sources) after reload
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const allTasks = [
          ...tasks.filter(t => t.is_active && !t.is_completed && t.due_date && parseDateString(t.due_date) <= today).map(t => ({ ...t, type: 'task' })),
          ...projectTasksDueToday.filter(t => !t.is_completed && t.due_date && parseDateString(t.due_date) <= today).map(t => ({ ...t, type: 'project' })),
          ...goalTasksDueToday.filter(t => !t.is_completed && t.due_date && parseDateString(t.due_date) <= today).map(t => ({ ...t, type: 'goal' }))
        ];
        
        // Count how many P1-P3 tasks remain
        const highPriorityTasks = allTasks.filter(t => t.priority && t.priority <= 3);
        
        // If we have fewer than 3 high-priority tasks, promote the next eligible task
        if (highPriorityTasks.length < 3) {
          // Find all eligible tasks (P4+, due today or earlier)
          const eligibleTasks = allTasks
            .filter(t => t.priority && t.priority >= 4)
            .sort((a, b) => {
              // Sort by priority (lower number = higher priority)
              if (a.priority !== b.priority) return a.priority - b.priority;
              // Tie-breaker: oldest due_date first
              return parseDateString(a.due_date).getTime() - parseDateString(b.due_date).getTime();
            });
          
          if (eligibleTasks.length > 0) {
            const taskToPromote = eligibleTasks[0];
            console.log(`Auto-promoting task "${taskToPromote.name}" from P${taskToPromote.priority} to P3`);
            
            // Promote to P3
            const endpoint = taskToPromote.type === 'project' ? `/api/project-tasks/${taskToPromote.id}` :
                            taskToPromote.type === 'goal' ? `/api/goal-tasks/${taskToPromote.id}` :
                            `/api/tasks/${taskToPromote.id}`;
            await api.put(endpoint, { priority: 3 });
            
            // Reload again to show promoted task
            await loadTasks();
            if (taskToPromote.type === 'project') await loadProjectTasksDueToday();
            if (taskToPromote.type === 'goal') await loadGoalTasksDueToday();
          }
        }
      }
    } catch (err: any) {
      console.error('Error updating task:', err);
      console.error('Error response:', err.response);
      alert('Failed to update task status: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleTaskNA = async (taskId: number) => {
    try {
      // For DAILY tab, use daily-specific handler
      if (activeTab === 'daily') {
        return handleDailyTaskNA(taskId);
      }
      
      // Find the task to check its frequency
      const task = tasks.find(t => t.id === taskId);
      
      // Mark task as globally NA (inactive)
      await api.put(`/api/tasks/${taskId}`, { is_active: false });
      
      // If this is a DAILY task, cascade to Weekly/Monthly ONLY if already being monitored there
      // This prevents unmonitored tasks from suddenly appearing in those tabs
      if (task && task.follow_up_frequency === 'daily') {
        try {
          // Only cascade to Weekly if task is already being monitored there
          if (weeklyTaskStatuses[taskId] !== undefined) {
            const weekDateStr = formatDateForInput(selectedWeekStart);
            await api.post(`/api/weekly-time/status/${taskId}/na?week_start_date=${weekDateStr}`, {});
          }
          
          // Only cascade to Monthly if task is already being monitored there
          if (monthlyTaskStatuses[taskId] !== undefined) {
            const monthDateStr = formatDateForInput(selectedMonthStart);
            await api.post(`/api/monthly-time/status/${taskId}/na?month_start_date=${monthDateStr}`, {});
          }
        } catch (statusErr) {
          console.warn('Failed to mark weekly/monthly NA status:', statusErr);
          // Don't fail the whole operation if status marking fails
        }
      }
      
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
      const dateStr = formatDateForInput(selectedWeekStart);
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
      const dateStr = formatDateForInput(selectedWeekStart);
      // Mark weekly status ONLY for this week (don't affect global task status)
      await api.post(`/api/weekly-time/status/${taskId}/na?week_start_date=${dateStr}`, {});
      // Reload weekly statuses only (don't reload tasks to avoid affecting daily view)
      await loadWeeklyEntries(selectedWeekStart);
    } catch (err: any) {
      console.error('Error updating weekly task NA:', err);
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
      const weekStart = formatDateForInput(selectedWeekStart);
      
      console.log('Adding task to weekly tracking:', {
        taskId: selectedDailyTask,
        taskName: task.name,
        weekStart,
        url: `/api/weekly-time/status/${selectedDailyTask}/${weekStart}`
      });
      
      const response = await api.post(`/api/weekly-time/status/${selectedDailyTask}/${weekStart}`, {
        is_completed: false,
        is_na: false
      });
      
      console.log('Weekly status created successfully:', response);

      // Reload tasks and weekly entries to show the task in weekly view
      await loadTasks();
      await loadWeeklyEntries(selectedWeekStart);
      setShowAddWeeklyTaskModal(false);
      setSelectedDailyTask(null);
      
      alert(`✓ "${task.name}" added to weekly tracking!`);
    } catch (err: any) {
      console.error('Error adding weekly task:', err);
      console.error('Error details:', err.response?.data);
      alert('Failed to add weekly task: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Ignore a day (mark as travel, sick day, etc.)
  async function handleIgnoreDay(entryDate: string, reason?: string) {
    try {
      const dateOnly = entryDate.split('T')[0];
      await api.post(`/api/daily-time/ignore/${dateOnly}`, { reason: reason || null });
      // Reload both lists
      await loadIncompleteDays();
      await loadIgnoredDays();
    } catch (err) {
      console.error('Error ignoring day:', err);
      alert('Failed to ignore day. Please try again.');
    }
  };

  // Unignore a day (restore to incomplete list)
  async function handleUnignoreDay(entryDate: string) {
    try {
      const dateOnly = entryDate.split('T')[0];
      await api.post(`/api/daily-time/unignore/${dateOnly}`, {});
      // Reload both lists
      await loadIncompleteDays();
      await loadIgnoredDays();
    } catch (err) {
      console.error('Error unignoring day:', err);
      alert('Failed to unignore day. Please try again.');
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
        }
        
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
    // Ensure we stay at midnight even across DST boundaries
    newDate.setHours(0, 0, 0, 0);
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
  function generateWeekDays(weekStart: Date) {
    const days = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
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
  }

  // Get week number
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Load weekly time entries from backend
  async function loadWeeklyEntries(weekStart: Date) {
    try {
      // FIX: Use local date string instead of ISO (UTC) to avoid timezone issues
      const year = weekStart.getFullYear();
      const month = String(weekStart.getMonth() + 1).padStart(2, '0');
      const day = String(weekStart.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Load weekly entries
      const response: any = await api.get(`/api/weekly-time/entries/${dateStr}`);
      
      // Handle both direct array and response.data scenarios
      let entries = Array.isArray(response) ? response : (response.data || []);
      
      // Convert array to map: key = "taskId-dayOfWeek", value = minutes
      const entriesMap: Record<string, number> = {}
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
      const aggregatesMap: Record<string, number> = {}
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
      
      const statusMap: Record<number, {is_completed: boolean, is_na: boolean}> = {}
      
      if (Array.isArray(statusData)) {
        statusData.forEach((status: any) => {
          statusMap[status.task_id] = {
            is_completed: status.is_completed,
            is_na: status.is_na
          }
        });
      }
      
      // Force new object reference to ensure React detects the change
      setWeeklyTaskStatuses({...statusMap});

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
          const prevWeekDateStr = formatDateForInput(prevWeekStart);
          
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
                const newStatusMap: Record<number, {is_completed: boolean, is_na: boolean}> = {}
                
                if (Array.isArray(newStatusData)) {
                  newStatusData.forEach((status: any) => {
                    newStatusMap[status.task_id] = {
                      is_completed: status.is_completed,
                      is_na: status.is_na
                    }
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
  }

  // Save weekly entries to backend (debounced)
  const saveWeeklyEntries = async () => {
    try {
      const dateStr = formatDateForInput(selectedWeekStart);
      
      // Use ref to get latest entries
      const entriesToSave = weeklyEntriesRef.current;
      
      // Convert weeklyEntries map to array format
      const entries = Object.entries(entriesToSave)
        .filter(([_, minutes]) => minutes > 0)
        .map(([key, minutes]) => {
          const [task_id, day_of_week] = key.split('-').map(Number);
          return { task_id, day_of_week, minutes }
        });
      if (entries.length > 0) {
        const response = await api.post('/api/weekly-time/entries/bulk/', {
          week_start_date: dateStr,
          entries: entries
        });
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
      }
      
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
  function getWeeklyTime(taskId: number, dayIndex: number): number {
    const key = `${taskId}-${dayIndex}`;
    // If there's a weekly entry, use it; otherwise use daily aggregate
    if (weeklyEntries[key] !== undefined) {
      return weeklyEntries[key];
    }
    return dailyAggregates[key] || 0;
  }

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
    setContextDate(newDate); // Update context so WeeklyTasks component refreshes
    loadWeeklyEntries(newDate);
  };

  // Go to current week
  const goToCurrentWeek = () => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday (if Sunday, go back 6 days)
    const currentWeek = new Date(today.setDate(diff));
    setSelectedWeekStart(currentWeek);
    setContextDate(currentWeek); // Update context so WeeklyTasks component refreshes
    loadWeeklyEntries(currentWeek);
  };

  // ============= MONTHLY TAB FUNCTIONS =============
  
  // Load monthly time entries and aggregates
  async function loadMonthlyEntries(monthStart: Date) {
    try {
      const dateStr = formatDateForInput(monthStart);
      
      // Load monthly entries
      const response: any = await api.get(`/api/monthly-time/entries/${dateStr}`);
      let entries = Array.isArray(response) ? response : (response.data || []);
      
      // Convert array to map: key = "taskId-dayOfMonth", value = minutes
      const entriesMap: Record<string, number> = {}
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
      const aggregatesMap: Record<string, number> = {}
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
      const statusMap: Record<number, {is_completed: boolean, is_na: boolean}> = {}
      
      if (Array.isArray(statusData)) {
        statusData.forEach((status: any) => {
          statusMap[status.task_id] = {
            is_completed: status.is_completed,
            is_na: status.is_na,
            created_at: status.created_at // When monitoring started
          }
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
          const prevMonthDateStr = formatDateForInput(prevMonthStart);
          
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
                const newStatusMap: Record<number, {is_completed: boolean, is_na: boolean, created_at?: string}> = {}
                
                if (Array.isArray(newStatusData)) {
                  newStatusData.forEach((status: any) => {
                    newStatusMap[status.task_id] = {
                      is_completed: status.is_completed,
                      is_na: status.is_na,
                      created_at: status.created_at
                    }
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
      const dateStr = formatDateForInput(selectedMonthStart);
      
      // Use ref to get latest entries
      const entriesToSave = monthlyEntriesRef.current;
      
      // Convert monthlyEntries map to array format
      const entries = Object.entries(entriesToSave)
        .filter(([_, minutes]) => minutes > 0)
        .map(([key, minutes]) => {
          const [task_id, day_of_month] = key.split('-').map(Number);
          return { task_id, day_of_month, minutes }
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
      }
      
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
  function getMonthlyTime(taskId: number, dayOfMonth: number): number {
    const key = `${taskId}-${dayOfMonth}`;
    // If there's a monthly entry, use it; otherwise use daily aggregate
    if (monthlyEntries[key] !== undefined) {
      return monthlyEntries[key];
    }
    return monthlyDailyAggregates[key] || 0;
  }

  // Handle monthly task complete
  const handleMonthlyTaskComplete = async (taskId: number) => {
    try {
      const dateStr = formatDateForInput(selectedMonthStart);
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
      const dateStr = formatDateForInput(selectedMonthStart);
      await api.post(`/api/monthly-time/status/${taskId}/na?month_start_date=${dateStr}`, {});
      await loadMonthlyEntries(selectedMonthStart);
    } catch (err: any) {
      console.error('Error updating monthly task NA:', err);
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
      const monthStart = formatDateForInput(selectedMonthStart);
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
    setContextDate(newDate); // Update context so MonthlyTasks component refreshes
    loadMonthlyEntries(newDate);
  };

  // Go to current month
  const goToCurrentMonth = () => {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    setSelectedMonthStart(currentMonth);
    setContextDate(currentMonth); // Update context so MonthlyTasks component refreshes
    loadMonthlyEntries(currentMonth);
  };

  // ============= YEARLY TAB FUNCTIONS =============
  
  // Load yearly time entries and aggregates
  async function loadYearlyEntries(yearStart: Date) {
    try {
      const dateStr = formatDateForInput(yearStart);
      
      // Load yearly entries
      const response: any = await api.get(`/api/yearly-time/entries/${dateStr}`);
      let entries = Array.isArray(response) ? response : (response.data || []);
      
      // Convert array to map: key = "taskId-month", value = minutes
      const entriesMap: Record<string, number> = {}
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
      const aggregatesMap: Record<string, number> = {}
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
      console.log('📡 Loading yearly task statuses for:', dateStr);
      const statusResponse: any = await api.get(`/api/yearly-time/status/${dateStr}`);
      console.log('📡 Yearly status response:', statusResponse);
      
      const statusData = Array.isArray(statusResponse) ? statusResponse : (statusResponse.data || []);
      const statusMap: Record<number, {is_completed: boolean, is_na: boolean}> = {}
      
      if (Array.isArray(statusData)) {
        statusData.forEach((status: any) => {
          statusMap[status.task_id] = {
            is_completed: status.is_completed || false,
            is_na: status.is_na || false,
            created_at: status.created_at // When monitoring started
          }
        });
      }
      
      console.log('✅ Yearly task statuses loaded:', Object.keys(statusMap).length, 'tasks', statusMap);
      setYearlyTaskStatuses(statusMap);
      console.log('🔄 State updated, component should re-render now');
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
      const dateStr = formatDateForInput(selectedYearStart);
      const entries = Object.entries(yearlyEntries).map(([key, minutes]) => {
        const [taskId, month] = key.split('-').map(Number);
        return {
          task_id: taskId,
          year_start_date: dateStr,
          month: month,
          minutes: minutes
        }
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
      const dateStr = formatDateForInput(selectedYearStart);
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
    console.log('🎯 handleAddYearlyTask called with selectedDailyTaskForYearly:', selectedDailyTaskForYearly);
    if (!selectedDailyTaskForYearly) {
      console.log('⚠️ No task selected - opening full TaskForm');
      setIsCreatingNewTask(true);
      setAddToTrackingAfterCreate('yearly' as any);
      setIsTaskFormOpen(true);
      setShowAddYearlyTaskModal(false);
      return;
    }

    console.log('✅ Task selected - creating yearly status entry');
    try {
      const task = tasks.find(t => t.id === selectedDailyTaskForYearly);
      if (!task) return;

      // Create a yearly status entry to mark this task for tracking this year
      const yearStart = formatDateForInput(selectedYearStart);
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

  // Handle add quarterly task
  const handleAddQuarterlyTask = async () => {
    if (!selectedDailyTaskForQuarterly) {
      setIsCreatingNewTask(true);
      setAddToTrackingAfterCreate('quarterly' as any);
      setIsTaskFormOpen(true);
      setShowAddQuarterlyTaskModal(false);
      return;
    }

    try {
      // Add to yearly tracking (quarterly shares yearly status)
      const yearNumber = selectedYearStart.getFullYear();
      const dateStr = `${yearNumber}-01-01`;
      
      // year_start_date must be in URL path, not request body
      await api.post(`/api/yearly-time/status/${selectedDailyTaskForQuarterly}/${dateStr}`, {
        is_completed: false,
        is_na: false
      });

      setShowAddQuarterlyTaskModal(false);
      setSelectedDailyTaskForQuarterly(null);
      
      // Reload yearly data to get updated statuses
      await loadYearlyEntries(selectedYearStart);
    } catch (err: any) {
      console.error('Error adding task to quarterly:', err);
      alert('Failed to add task to quarterly tracking');
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
  async function loadOneTimeTasks() {
    // Deprecated: Now using ImportantTasks component which manages its own data
    // Old one_time_tasks table has been replaced with important_tasks
    console.log('loadOneTimeTasks() is deprecated - using ImportantTasks component');
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
      const today = formatDateForInput(new Date());
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
  async function loadProjects() {
    try {
      // Fetch categories and pillars
      const [projectsResponse, categoriesResponse, pillarsResponse] = await Promise.all([
        api.get('/api/projects/'),
        api.get('/api/categories/'),
        api.get('/api/pillars/')
      ]);
      
      const projectsList = Array.isArray(projectsResponse.data || projectsResponse) ? (projectsResponse.data || projectsResponse) : [];
      const categoriesList = Array.isArray(categoriesResponse.data || categoriesResponse) ? (categoriesResponse.data || categoriesResponse) : [];
      const pillarsList = Array.isArray(pillarsResponse.data || pillarsResponse) ? (pillarsResponse.data || pillarsResponse) : [];
      
      setProjects(projectsList);
      setProjectCategories(categoriesList);
      setProjectPillars(pillarsList);
      
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

  async function loadProjectTasksDueToday() {
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

  async function loadGoalTasksDueToday() {
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
      ).map(task => ({
        ...task,
        // Convert string priority to integer for display: high=P1, medium=P5, low=P9
        priority: typeof task.priority === 'string' 
          ? (task.priority === 'high' ? 1 : task.priority === 'medium' ? 5 : 9)
          : task.priority
      }));
      
      setGoalTasksDueToday(uniqueTasks);
    } catch (err: any) {
      console.error('Error loading goal tasks due today:', err);
      setGoalTasksDueToday([]);
    }
  };

  async function loadOverdueOneTimeTasks() {
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
        }
      });
      
      setOverdueOneTimeTasks(overdue);
    } catch (err: any) {
      console.error('Error loading overdue one-time tasks:', err);
      setOverdueOneTimeTasks([]);
    }
  };

  async function loadTodaysHabits() {
    try {
      const response: any = await api.get('/api/habits/today/active');
      const allHabits = Array.isArray(response.data || response) ? (response.data || response) : [];
      
      // Get current nowHabits from localStorage
      const storedNowHabits = localStorage.getItem('nowHabits');
      const nowHabitIds = storedNowHabits ? new Set(JSON.parse(storedNowHabits)) : new Set();
      
      // Filter to only show habits that haven't been done for 2+ consecutive days
      // OR habits that are in the NOW list (those should always load)
      const habitsNeedingAttention = allHabits.filter((habit: any) => {
        // Always include habits that are in NOW list
        if (nowHabitIds.has(habit.id)) {
          return true;
        }
        
        // Check monthly_completion array for consecutive misses and completion rate
        // The array represents [day1, day2, ..., today] where:
        // - true = completed
        // - false = missed
        // - null = before habit started
        
        if (habit.monthly_completion && Array.isArray(habit.monthly_completion)) {
          const completionArray = habit.monthly_completion;
          const todayIndex = completionArray.length - 1;
          
          // 1. Count consecutive missed days from today going backwards (only if not completed today)
          let consecutiveMissedDays = 0;
          
          if (!habit.completed_today) {
            // Only count consecutive if today is also missed
            for (let i = todayIndex; i >= 0; i--) {
              const dayStatus = completionArray[i];
              
              // Skip null days (before habit started)
              if (dayStatus === null) continue;
              
              if (dayStatus === false) {
                consecutiveMissedDays++;
              } else {
                // Hit a completed day, stop counting
                break;
              }
            }
          }
          
          // 2. Calculate weekly average (Monday to today)
          // monthly_completion array goes from 1st of month to today
          // We need to find Monday of current week
          const today = new Date();
          const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
          const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday-based (0=Monday)
          const dayOfMonth = today.getDate(); // 1-31
          const mondayDate = dayOfMonth - daysFromMonday; // Date number of this week's Monday
          
          let weeklyCompletedDays = 0;
          let weeklyApplicableDays = 0;
          
          // If Monday is in current month (mondayDate >= 1), calculate from Monday to today
          // Otherwise, start from 1st of month
          const weekStartDay = Math.max(1, mondayDate);
          const weekStartIndex = weekStartDay - 1; // Array is 0-indexed, days are 1-indexed
          
          for (let i = weekStartIndex; i <= todayIndex; i++) {
            const dayStatus = completionArray[i];
            if (dayStatus !== null) {
              weeklyApplicableDays++;
              if (dayStatus === true) {
                weeklyCompletedDays++;
              }
            }
          }
          
          const weeklyCompletionRate = weeklyApplicableDays > 0 
            ? (weeklyCompletedDays / weeklyApplicableDays * 100) 
            : 100;
          
          // 3. Check if behind on averages
          const isBehindOnWeekly = weeklyCompletionRate < 60;
          const isBehindOnMonthly = habit.completion_rate !== undefined && habit.completion_rate < 40;
          
          // Show habit if ANY of these conditions are met:
          // 1. Currently missing 2+ consecutive days, OR
          // 2. Weekly average < 60%, OR
          // 3. Monthly average < 40%
          const shouldShow = consecutiveMissedDays >= 2 || isBehindOnWeekly || isBehindOnMonthly;
          
          return shouldShow;
        }
        
        // Fallback: if no monthly_completion data, don't show if completed today
        return !habit.completed_today;
      });
      
      setTodaysHabits(habitsNeedingAttention);
    } catch (err: any) {
      console.error('Error loading today\'s habits:', err);
      setTodaysHabits([]);
    }
  }

  async function loadTodaysChallenges() {
    try {
      const response: any = await api.get('/api/challenges/today/active');
      const data = Array.isArray(response.data || response) ? (response.data || response) : [];
      setTodaysChallenges(data);
    } catch (err: any) {
      console.error('Error loading today\'s challenges:', err);
      setTodaysChallenges([]);
    }
  }

  async function loadTodaysOnlyTasks(tasksToFilter?: Task[]) {
    try {
      // Load tasks created specifically for today (follow_up_frequency = 'today')
      // Exclude NOW tasks (priority <= 3) to prevent duplicates
      // Include completed tasks if completed today (they'll be styled differently)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      
      console.log('loadTodaysOnlyTasks called with', tasksToFilter ? tasksToFilter.length : 'no', 'tasks');
      
      // Use provided tasks or fall back to state (for initial load)
      const tasksData = tasksToFilter || tasks;
      const todayTasks = tasksData.filter(task => {
        console.log('Checking task:', task.name, 'freq:', task.follow_up_frequency, 'priority:', task.priority, 'completed:', task.is_completed);
        
        if (task.follow_up_frequency !== 'today') return false;
        if (!task.is_active) return false;
        if (task.priority && task.priority <= 3) return false; // Exclude NOW tasks
        
        // Include incomplete tasks
        if (!task.is_completed) {
          console.log('  -> Including (not completed)');
          return true;
        }
        
        // Include tasks completed today (show until midnight)
        if (task.is_completed && task.completed_at) {
          const completedDate = new Date(task.completed_at);
          const include = completedDate >= today && completedDate <= todayEnd;
          console.log('  -> Completed task:', include ? 'Including (completed today)' : 'Excluding (completed earlier)');
          return include;
        }
        
        return false;
      });
      
      console.log('Found', todayTasks.length, 'today tasks:', todayTasks.map(t => t.name));
      setTodaysOnlyTasks(todayTasks);
    } catch (err: any) {
      console.error('Error loading today\'s only tasks:', err);
      setTodaysOnlyTasks([]);
    }
  }

  async function loadMiscTasksDueToday() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get all misc tasks that are due today or overdue
      const dueTasks: Array<ProjectTaskData & { group_name?: string; daysOverdue?: number }> = [];
      
      for (const task of miscTasks) {
        if (task.is_completed || !task.due_date) continue;
        
        // Extract date part if it's a datetime string
        const datePart = task.due_date.split('T')[0];
        const dueDate = parseDateString(datePart);
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate <= today) {
          const daysDiff = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          
          dueTasks.push({
            ...task,
            group_name: 'Misc Task',
            daysOverdue: daysDiff
          });
        }
      }
      
      // Sort by most overdue first
      dueTasks.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
      setMiscTasksDueToday(dueTasks);
    } catch (err: any) {
      console.error('Error loading misc tasks due today:', err);
      setMiscTasksDueToday([]);
    }
  }

  async function loadImportantTasksDueToday() {
    try {
      console.log('🔍 Loading important tasks due today...');
      // Get important tasks that are red or gray status (due or overdue)
      const response: any = await api.get('/api/important-tasks/due-today');
      const dueTasks = Array.isArray(response.data || response) ? (response.data || response) : [];
      
      console.log('✅ Important tasks loaded:', dueTasks.length, dueTasks);
      setImportantTasksDueToday(dueTasks);
    } catch (err: any) {
      console.error('❌ Error loading important tasks due today:', err);
      setImportantTasksDueToday([]);
    }
  }

  async function loadWeeklyTasksNeedingAttention() {
    try {
      // Find weekly tasks that haven't been completed this week OR are behind on progress
      const weekStart = new Date(selectedWeekStart);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Fetch daily entries for this week to calculate progress for native weekly tasks
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        const year = day.getFullYear();
        const month = String(day.getMonth() + 1).padStart(2, '0');
        const dayNum = String(day.getDate()).padStart(2, '0');
        return `${year}-${month}-${dayNum}`;
      });
      
      // Fetch all daily entries for this week
      const allEntriesPromises = weekDays.map(dateStr => 
        api.get<any[]>(`/api/daily-time/?date=${dateStr}`).catch(() => [])
      );
      const allEntriesArrays = await Promise.all(allEntriesPromises);
      const allEntries = allEntriesArrays.flat();
      
      const needsAttention = tasks.filter(task => {
        if (task.follow_up_frequency !== 'weekly' || task.is_completed || !task.is_active) return false;
        
        // Check if task has been marked complete or NA this week
        const statusKey = task.id;
        const status = weeklyTaskStatuses[statusKey];
        
        // If completed or NA this week, doesn't need attention
        if (status && (status.is_completed || status.is_na)) return false;
        
        // For native weekly tasks, check if they're behind on progress
        // Calculate days elapsed in the week
        const weekStartDate = new Date(weekStart);
        weekStartDate.setHours(0, 0, 0, 0);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        
        let daysElapsed = 1;
        if (today >= weekStartDate) {
          if (today <= weekEndDate) {
            const diffTime = today.getTime() - weekStartDate.getTime();
            daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          } else {
            daysElapsed = 7; // Past week
          }
        }
        
        // Calculate expected progress
        const expectedTarget = task.allocated_minutes * daysElapsed;
        
        // Calculate actual progress from daily entries
        const taskEntries = allEntries.filter((e: any) => e.task_id === task.id);
        const actualProgress = taskEntries.reduce((sum: number, e: any) => sum + (e.minutes || 0), 0);
        
        // Task needs attention if it exists (no status = needs to be done) 
        // OR if it's behind schedule (actual < expected)
        return !status || actualProgress < expectedTarget;
      });
      
      setWeeklyTasksNeedingAttention(needsAttention);
    } catch (err: any) {
      console.error('Error loading weekly tasks needing attention:', err);
      setWeeklyTasksNeedingAttention([]);
    }
  }

  async function loadMonthlyTasksNeedingAttention() {
    try {
      // Find monthly tasks that haven't been completed this month
      const needsAttention = tasks.filter(task => {
        if (task.follow_up_frequency !== 'monthly' || task.is_completed || !task.is_active) return false;
        
        // Check if task has been marked complete or NA this month
        const statusKey = task.id;
        const status = monthlyTaskStatuses[statusKey];
        
        return !status || (!status.is_completed && !status.is_na);
      });
      
      setMonthlyTasksNeedingAttention(needsAttention);
    } catch (err: any) {
      console.error('Error loading monthly tasks needing attention:', err);
      setMonthlyTasksNeedingAttention([]);
    }
  }

  async function loadUpcomingTasks() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      // Get tasks due in the next 7 days (but not today)
      const upcoming = tasks.filter(task => {
        if (!task.due_date || task.is_completed || !task.is_active) return false;
        
        const dueDate = parseDateString(task.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        return dueDate > today && dueDate <= nextWeek;
      }).sort((a, b) => {
        const dateA = new Date(a.due_date!);
        const dateB = new Date(b.due_date!);
        return dateA.getTime() - dateB.getTime();
      });
      
      setUpcomingTasks(upcoming);
    } catch (err: any) {
      console.error('Error loading upcoming tasks:', err);
      setUpcomingTasks([]);
    }
  }

  const handleCreateProjectMilestone = async (milestoneData: any) => {
    if (!selectedProject) return;
    try {
      await api.post(`/api/projects/${selectedProject.id}/milestones`, milestoneData);
      setShowAddProjectMilestoneModal(false);
      await loadProjectMilestones(selectedProject.id);
      await loadProjects(); // Refresh project list to update milestone progress
    } catch (error) {
      console.error('Error creating milestone:', error);
      alert('Failed to create milestone');
    }
  };

  const handleUpdateProjectMilestone = async (milestoneIdOrData: number | any, updateData?: any) => {
    if (!selectedProject) return;
    
    // Support both signatures: (milestoneId, data) and (data) for modal usage
    const milestoneId = typeof milestoneIdOrData === 'number' ? milestoneIdOrData : editingMilestone?.id;
    const data = typeof milestoneIdOrData === 'number' ? updateData : milestoneIdOrData;
    
    if (!milestoneId) return;
    
    try {
      await api.put(`/api/projects/milestones/${milestoneId}`, data);
      if (editingMilestone) {
        setShowEditProjectMilestoneModal(false);
        setEditingMilestone(null);
      }
      await loadProjectMilestones(selectedProject.id);
      await loadProjects(); // Refresh project list to update milestone progress
    } catch (error) {
      console.error('Error updating milestone:', error);
      alert('Failed to update milestone');
    }
  };

  const handleToggleProjectMilestone = async (milestoneId: number, isCompleted: boolean) => {
    if (!selectedProject) return;
    try {
      await api.put(`/api/projects/milestones/${milestoneId}`, { is_completed: isCompleted });
      await loadProjectMilestones(selectedProject.id);
      await loadProjects(); // Refresh project list to update milestone progress
    } catch (error) {
      console.error('Error updating milestone:', error);
    }
  };

  const handleDeleteProjectMilestone = async (milestoneId: number) => {
    if (!selectedProject) return;
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;
    try {
      await api.delete(`/api/projects/milestones/${milestoneId}`);
      await loadProjectMilestones(selectedProject.id);
      await loadProjects(); // Refresh project list to update milestone progress
    } catch (error) {
      console.error('Error deleting milestone:', error);
      alert('Failed to delete milestone');
    }
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    // Don't clear projectTasks - keep them for overdue status checking
    setExpandedTasks(new Set());
    
    // Remove project parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('project');
    navigate(`?${searchParams.toString()}`, { replace: true });
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
    
    // Scroll to the task after a brief delay to allow DOM update
    setTimeout(() => {
      const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
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
    
    // Parse due date as local time to avoid timezone shift
    const [year, month, day] = dueDate.split('-').map(Number);
    const due = new Date(year, month - 1, day);
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

  // Get color class for tasks based on due_date OR created_at (for 'today' frequency tasks)
  const getTaskColorClass = (task: TaskData): string => {
    // If task has explicit due_date, use that
    if (task.due_date) {
      return getDueDateColorClass(task.due_date);
    }
    
    // For 'today' frequency tasks without due_date, use created_at as implicit due date
    if (task.follow_up_frequency === 'today' && task.created_at && !task.is_completed) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const created = new Date(task.created_at);
      created.setHours(0, 0, 0, 0);
      
      const diffTime = today.getTime() - created.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0) {
        return 'task-overdue'; // Red - created before today, still incomplete
      }
    }
    
    return '';
  };

  const hasOverdueTasks = (projectId: number): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if any incomplete task in this project is overdue
    return projectTasks.some(task => {
      if (task.project_id !== projectId || task.is_completed || !task.due_date) {
        return false;
      }
      const due = parseDateString(task.due_date);
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

  const handleToggleTaskCompletion = async (taskId: number, currentStatus: boolean, taskType: 'task' | 'project' | 'goal' = 'task') => {
    try {
      // Save scroll position
      const scrollY = window.scrollY;
      
      if (taskType === 'project') {
        await api.put(`/api/projects/tasks/${taskId}`, {
          is_completed: !currentStatus
        });
        // Refresh both projects list and tasks
        await loadProjects(); // This will reload all projects with updated status
        await loadProjectTasksDueToday(); // Reload the today tasks list
        
        if (selectedProject) {
          await loadProjectTasks(selectedProject.id);
        }
        
        // Restore scroll position
        setTimeout(() => window.scrollTo(0, scrollY), 0);
      } else if (taskType === 'goal') {
        await api.put(`/api/life-goals/tasks/${taskId}`, {
          is_completed: !currentStatus
        });
        await loadGoalTasksDueToday();
        
        // Restore scroll position
        setTimeout(() => window.scrollTo(0, scrollY), 0);
      } else {
        // Regular task
        if (!currentStatus) {
          // Mark as complete - backend sets completed_at automatically
          await api.put(`/api/tasks/${taskId}`, { 
            is_completed: true
          });
        } else {
          // Mark as incomplete
          await api.put(`/api/tasks/${taskId}`, { 
            is_completed: false
          });
        }
        const freshTasks = await loadTasks();
        await loadTodaysOnlyTasks(freshTasks);
        
        // Restore scroll position
        setTimeout(() => window.scrollTo(0, scrollY), 0);
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

  const handleEditTask = async (task: ProjectTaskData) => {
    console.log('Editing task:', task.name, 'milestone_id:', task.milestone_id, 'project_id:', task.project_id);
    
    // Set the task to edit and show modal
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
        parent_task_id: editingTask.parent_task_id,
        milestone_id: editingTask.milestone_id,
        due_date: editingTask.due_date,
        priority: editingTask.priority
      });
      
      setShowEditTaskModal(false);
      setEditingTask(null);
      
      // Refresh data
      await loadProjects();
      if (selectedProject) {
        await loadProjectTasks(selectedProject.id);
        await loadProjectMilestones(selectedProject.id); // Reload milestones to update task counts
      }
      if (activeTab === 'today') {
        await loadProjectTasksDueToday();
      }
    } catch (err: any) {
      console.error('Error updating task:', err);
      alert('Failed to update task: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Handlers for regular task editing (non-project tasks)
  const handleEditRegularTask = (task: Task) => {
    console.log('Editing regular task:', task.name, 'id:', task.id);
    setEditingRegularTask(task);
    setShowEditRegularTaskModal(true);
  };

  const handleUpdateRegularTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegularTask) return;

    try {
      await api.put(`/api/tasks/${editingRegularTask.id}`, {
        name: editingRegularTask.name,
        description: editingRegularTask.description,
        allocated_minutes: editingRegularTask.allocated_minutes,
        pillar: editingRegularTask.pillar,
        category: editingRegularTask.category,
        subcategory: editingRegularTask.subcategory,
        follow_up_frequency: editingRegularTask.follow_up_frequency
      });
      
      setShowEditRegularTaskModal(false);
      setEditingRegularTask(null);
      
      // Refresh tasks
      await loadTasks();
      
      console.log('Task updated successfully');
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
      // Save scroll position
      const scrollY = window.scrollY;
      
      await api.put(`/api/life-goals/tasks/${taskId}`, {
        is_completed: !isCompleted
      });
      
      // Refresh goal tasks
      await loadGoalTasksDueToday();
      
      // Restore scroll position
      setTimeout(() => window.scrollTo(0, scrollY), 0);
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

  const handleToggleProjectComplete = async (projectId: number, isCompleted: boolean) => {
    // Find the project to check its status
    const project = projects.find(p => p.id === projectId);
    
    // Add confirmation for completing a project
    if (isCompleted && project) {
      const pendingCount = project.progress?.pending_tasks || 0;
      if (pendingCount > 0) {
        alert(`Cannot complete project: ${pendingCount} task(s) still pending. Please complete all tasks first.`);
        return;
      }
      
      if (!confirm(`Mark "${project.name}" as completed?`)) {
        return;
      }
    }
    
    try {
      await api.put(`/api/projects/${projectId}`, {
        is_completed: isCompleted,
        status: isCompleted ? 'completed' : 'in_progress'
      });
      await loadProjects();
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
      }
    } catch (err: any) {
      console.error('Error updating project completion:', err);
      alert('Failed to update project: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUpdateProject = async (projectId: number, updates: any) => {
    try {
      await api.put(`/api/projects/${projectId}`, updates);
      await loadProjects();
    } catch (err: any) {
      console.error('Error updating project:', err);
      alert('Failed to update project: ' + (err.response?.data?.detail || err.message));
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

  const handleDuplicateProject = async (projectId: number) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newName = prompt('Enter name for the duplicated project:', `${project.name} (Copy)`);
    if (!newName) return; // User cancelled

    try {
      // Create new project with copied data
      const newProjectResponse = await api.post('/api/projects/', {
        name: newName,
        description: project.description,
        goal_id: project.goal_id,
        pillar_id: project.pillar_id,
        category_id: project.category_id,
        start_date: formatDateForInput(new Date()), // Start today
        target_completion_date: project.target_completion_date,
        status: 'not_started'
      });
      const newProjectId = newProjectResponse.data.id;

      // Copy milestones if they exist
      if (project.milestones && project.milestones.length > 0) {
        for (const milestone of project.milestones) {
          await api.post(`/api/projects/${newProjectId}/milestones`, {
            name: milestone.name,
            description: milestone.description,
            target_date: milestone.target_date
          });
        }
      }

      // Get all tasks from the original project
      const tasksResponse = await api.get(`/api/projects/${projectId}/tasks`);
      const tasks = tasksResponse.data;

      // Copy tasks (need to do this in order: parent tasks first, then children)
      const taskIdMap = new Map(); // Map old task IDs to new task IDs

      // First, copy all parent tasks (level 1)
      const parentTasks = tasks.filter((t: ProjectTaskData) => !t.parent_task_id);
      for (const task of parentTasks) {
        const newTaskResponse = await api.post(`/api/projects/${newProjectId}/tasks`, {
          name: task.name,
          description: task.description,
          start_date: task.start_date,
          due_date: task.due_date,
          priority: task.priority,
          parent_task_id: null
        });
        taskIdMap.set(task.id, newTaskResponse.data.id);
      }

      // Then copy sub-tasks (level 2)
      const subTasks = tasks.filter((t: ProjectTaskData) => t.parent_task_id && !tasks.find((st: ProjectTaskData) => st.id === t.parent_task_id && st.parent_task_id));
      for (const task of subTasks) {
        const newParentId = taskIdMap.get(task.parent_task_id);
        if (newParentId) {
          const newTaskResponse = await api.post(`/api/projects/${newProjectId}/tasks`, {
            name: task.name,
            description: task.description,
            start_date: task.start_date,
            due_date: task.due_date,
            priority: task.priority,
            parent_task_id: newParentId
          });
          taskIdMap.set(task.id, newTaskResponse.data.id);
        }
      }

      // Finally copy sub-sub-tasks (level 3)
      const subSubTasks = tasks.filter((t: ProjectTaskData) => t.parent_task_id && tasks.find((st: ProjectTaskData) => st.id === t.parent_task_id && st.parent_task_id));
      for (const task of subSubTasks) {
        const newParentId = taskIdMap.get(task.parent_task_id);
        if (newParentId) {
          await api.post(`/api/projects/${newProjectId}/tasks`, {
            name: task.name,
            description: task.description,
            start_date: task.start_date,
            due_date: task.due_date,
            priority: task.priority,
            parent_task_id: newParentId
          });
        }
      }

      alert(`Project duplicated successfully as "${newName}"!`);
      await loadProjects();
    } catch (err: any) {
      console.error('Error duplicating project:', err);
      alert('Failed to duplicate project: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Misc Tasks Functions (similar to Projects)
  async function loadMiscTaskGroups() {
    // Load regular tasks with follow_up_frequency='misc'
    try {
      const response: any = await api.get('/api/tasks/');
      const data = response.data || response;
      const allTasks = Array.isArray(data) ? data : [];
      
      // Filter for misc tasks only
      const miscTasksList = allTasks.filter((t: Task) => t.follow_up_frequency === 'misc');
      
      // Convert to ProjectTaskData format for TaskNode component
      const convertedTasks: ProjectTaskData[] = miscTasksList.map((task: Task) => ({
        id: task.id,
        name: task.name,
        description: task.description || '',
        due_date: task.due_date || null,
        priority: task.priority?.toString() || '5',
        is_completed: task.is_completed,
        parent_task_id: task.parent_task_id || null, // Preserve parent-child relationships
        project_id: 0, // Not a project task
        milestone_id: null,
        created_at: task.created_at,
        completed_at: task.completed_at || null,
        order: 0,
        updated_at: task.updated_at || task.created_at,
        pillar_name: task.pillar_name, // Include pillar_name for category grouping
        category_name: task.category_name, // Include category_name for category grouping
        pillar_id: task.pillar_id, // Include for inheritance to subtasks
        category_id: task.category_id // Include for inheritance to subtasks
      }));
      
      setMiscTasks(convertedTasks);
      
      // Auto-expand all tasks that have subtasks only if no saved state exists
      const saved = localStorage.getItem('expandedMiscTasks');
      if (!saved) {
        const tasksWithChildren = convertedTasks
          .filter(task => convertedTasks.some(t => t.parent_task_id === task.id))
          .map(task => task.id);
        const newExpanded = new Set(tasksWithChildren);
        setExpandedMiscTasks(newExpanded);
        localStorage.setItem('expandedMiscTasks', JSON.stringify(Array.from(newExpanded)));
      }
    } catch (err: any) {
      console.error('Error loading misc tasks:', err);
      setMiscTasks([]);
    }
  }

  // Habits Functions
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
      
      // Reload month days to show updated visual tracker
      await loadHabitMonthDays(habitId);
      
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
        entry_date: entryDate || formatDateForInput(new Date())
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
  async function loadLifeGoals() {
    try {
      const response = await api.get('/api/life-goals/');
      const data = response.data || response;
      setLifeGoals(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading life goals:', error);
      setLifeGoals([]);
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

  const handleDuplicateLifeGoal = async (goalId: number) => {
    const goal = lifeGoals.find(g => g.id === goalId);
    if (!goal) return;

    const newName = prompt('Enter name for the duplicated goal:', `${goal.name} (Copy)`);
    if (!newName) return; // User cancelled

    try {
      // Create new goal with copied data
      const newGoalResponse = await api.post('/api/life-goals/', {
        name: newName,
        description: goal.description,
        pillar_id: goal.pillar_id,
        category_id: goal.category_id,
        time_period: goal.time_period,
        start_date: formatDateForInput(new Date()), // Start today
        target_date: goal.target_date,
        target_value: goal.target_value,
        current_value: 0, // Reset progress
        unit: goal.unit,
        parent_goal_id: goal.parent_goal_id // Preserve parent-child relationship
      });
      const newGoalId = newGoalResponse.data.id;

      // Get all details from the original goal
      const [milestonesResponse, tasksResponse] = await Promise.all([
        api.get(`/api/life-goals/${goalId}/milestones`),
        api.get(`/api/life-goals/${goalId}/tasks`)
      ]);

      // Copy milestones
      const milestones = milestonesResponse.data;
      if (milestones && milestones.length > 0) {
        for (const milestone of milestones) {
          await api.post(`/api/life-goals/${newGoalId}/milestones`, {
            name: milestone.name,
            description: milestone.description,
            target_date: milestone.target_date,
            target_value: milestone.target_value,
            unit: milestone.unit
          });
        }
      }

      // Copy goal-specific tasks (hierarchical)
      const tasks = tasksResponse.data;
      if (tasks && tasks.length > 0) {
        const taskIdMap = new Map(); // Map old task IDs to new task IDs

        // First, copy all parent tasks (level 1)
        const parentTasks = tasks.filter((t: any) => !t.parent_task_id);
        for (const task of parentTasks) {
          const newTaskResponse = await api.post(`/api/life-goals/${newGoalId}/tasks`, {
            name: task.name,
            description: task.description,
            start_date: task.start_date,
            due_date: task.due_date,
            priority: task.priority,
            parent_task_id: null
          });
          taskIdMap.set(task.id, newTaskResponse.data.id);
        }

        // Then copy sub-tasks (level 2)
        const subTasks = tasks.filter((t: any) => t.parent_task_id && !tasks.find((st: any) => st.id === t.parent_task_id && st.parent_task_id));
        for (const task of subTasks) {
          const newParentId = taskIdMap.get(task.parent_task_id);
          if (newParentId) {
            const newTaskResponse = await api.post(`/api/life-goals/${newGoalId}/tasks`, {
              name: task.name,
              description: task.description,
              start_date: task.start_date,
              due_date: task.due_date,
              priority: task.priority,
              parent_task_id: newParentId
            });
            taskIdMap.set(task.id, newTaskResponse.data.id);
          }
        }

        // Finally copy sub-sub-tasks (level 3)
        const subSubTasks = tasks.filter((t: any) => t.parent_task_id && tasks.find((st: any) => st.id === t.parent_task_id && st.parent_task_id));
        for (const task of subSubTasks) {
          const newParentId = taskIdMap.get(task.parent_task_id);
          if (newParentId) {
            await api.post(`/api/life-goals/${newGoalId}/tasks`, {
              name: task.name,
              description: task.description,
              start_date: task.start_date,
              due_date: task.due_date,
              priority: task.priority,
              parent_task_id: newParentId
            });
          }
        }
      }

      alert(`Goal duplicated successfully as "${newName}"!`);
      await loadLifeGoals();
    } catch (err: any) {
      console.error('Error duplicating goal:', err);
      alert('Failed to duplicate goal: ' + (err.response?.data?.detail || err.message));
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
    }
    
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
    // Clear focused cell highlighting
    setFocusedCell(null);
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
    }
    
    const input = e.currentTarget;
    input.value = String(pastedValue);
    
    handleHourlyTimeChange(taskId, hour, String(pastedValue));
  };

  // Handle focus event to add paste protection
  const handleHourlyTimeFocus = (taskId: number, hour: number, e: React.FocusEvent<HTMLInputElement>) => {
    const key = `${taskId}-${hour}`;
    const input = e.currentTarget;
    
    // Update focused cell state for highlighting
    const row = parseInt(input.dataset.row || '0');
    const col = parseInt(input.dataset.col || '0');
    setFocusedCell({ row, col });
    
    // Check if cell is behind sticky footer and scroll if needed
    setTimeout(() => {
      handleRowVisibility(input);
    }, 50);
    
    // Prevent mouse wheel from changing value
    const wheelHandler = (wheelEvent: WheelEvent) => {
      wheelEvent.preventDefault();
      isWheelChangeRef.current = true; // Mark next change as wheel-induced
    }
    
    // Prevent arrow keys from changing value  
    const keydownHandler = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'ArrowUp' || keyEvent.key === 'ArrowDown') {
        keyEvent.preventDefault();
        isWheelChangeRef.current = true; // Mark next change as arrow-key-induced
      }
    }
    
    const pasteHandler = (pasteEvent: ClipboardEvent) => {
      pasteEvent.preventDefault();
      
      const pastedText = pasteEvent.clipboardData?.getData('text') || '';
      const pastedValue = parseInt(pastedText) || 0;
      
      // Record this paste to protect it from wheel events for 2 seconds
      lastPastedValueRef.current = {
        key,
        value: pastedValue,
        timestamp: Date.now()
      }
      
      input.value = String(pastedValue);
      handleHourlyTimeChange(taskId, hour, String(pastedValue));
    }
    
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
    }
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
  }

  function getMonthlyRowColorClass(task: Task): string {
    // Allow checking from today tab for "Needs Attention" feature
    if (activeTab !== 'monthly' && activeTab !== 'today') return '';
    
    // Calculate total spent/count in the month so far
    const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
    let totalSpent = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      totalSpent += getMonthlyTime(task.id, day);
    }
    
    // Determine how many days have elapsed since monitoring started (or month start, whichever is later)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(selectedMonthStart);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    monthEnd.setHours(0, 0, 0, 0);
    
    // Get monitoring start date from monthly task status
    const taskStatus = monthlyTaskStatuses[task.id];
    let monitoringStart = monthStart;
    if (taskStatus?.created_at) {
      const createdAt = new Date(taskStatus.created_at);
      createdAt.setHours(0, 0, 0, 0);
      // Use the later of month start or monitoring start
      monitoringStart = createdAt > monthStart ? createdAt : monthStart;
    }
    
    // Calculate days elapsed from monitoring start to today (or month end if past month)
    let daysElapsed = 0;
    if (today >= monitoringStart && monitoringStart <= monthEnd) {
      if (today <= monthEnd) {
        // Current month: from monitoring start to today
        const diffTime = today.getTime() - monitoringStart.getTime();
        daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      } else {
        // Past month: from monitoring start to month end
        const diffTime = monthEnd.getTime() - monitoringStart.getTime();
        daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    } else if (monitoringStart > monthEnd) {
      // Monitoring started after this month ended - no expectation
      return '';
    } else {
      // Default to full month if monitoring started before month
      daysElapsed = daysInMonth;
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
  }

  function getYearlyRowColorClass(task: Task): string {
    if (activeTab !== 'yearly') return '';
    
    // Calculate total spent/count in the year so far
    let totalSpent = 0;
    for (let month = 1; month <= 12; month++) {
      totalSpent += getYearlyTime(task.id, month);
    }
    
    // Determine how many days have elapsed since monitoring started (or year start, whichever is later)
    const today = new Date();
    const yearStart = new Date(selectedYearStart);
    yearStart.setHours(0, 0, 0, 0);
    
    // Get monitoring start date from yearly task status
    const taskStatus = yearlyTaskStatuses[task.id];
    let monitoringStart = yearStart;
    if (taskStatus?.created_at) {
      const createdAt = new Date(taskStatus.created_at);
      createdAt.setHours(0, 0, 0, 0);
      // Use the later of year start or monitoring start
      monitoringStart = createdAt > yearStart ? createdAt : yearStart;
    }
    
    // Calculate days elapsed from monitoring start to today
    let daysElapsed = 0;
    if (today >= monitoringStart) {
      daysElapsed = Math.ceil((today.getTime() - monitoringStart.getTime()) / (1000 * 60 * 60 * 24)) + 1; // +1 to include today
    } else {
      // Future date: no days elapsed
      daysElapsed = 0;
    }
    
    // Calculate expected target based on task type, follow-up frequency, and days elapsed
    let expectedTarget = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        // Daily habits: target per day * days elapsed
        expectedTarget = (task.target_value || 0) * daysElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        // Weekly tasks: target per week * weeks elapsed
        const weeksElapsed = daysElapsed / 7;
        expectedTarget = (task.target_value || 0) * weeksElapsed;
      } else if (task.follow_up_frequency === 'monthly') {
        // Monthly tasks: target per month * months elapsed (approximate)
        const monthsElapsed = daysElapsed / 30;
        expectedTarget = (task.target_value || 0) * monthsElapsed;
      } else {
        // Yearly tasks: target for entire year * (days elapsed / 365)
        expectedTarget = (task.target_value || 0) * (daysElapsed / 365);
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      // For boolean tasks: depends on frequency
      if (task.follow_up_frequency === 'daily') {
        expectedTarget = daysElapsed; // One completion per day
      } else if (task.follow_up_frequency === 'weekly') {
        const weeksElapsed = daysElapsed / 7;
        expectedTarget = weeksElapsed;
      } else if (task.follow_up_frequency === 'monthly') {
        const monthsElapsed = daysElapsed / 30;
        expectedTarget = monthsElapsed;
      } else {
        expectedTarget = daysElapsed / 365; // Yearly tasks
      }
    } else {
      // TIME tasks
      if (task.follow_up_frequency === 'daily') {
        // Daily habits: allocated minutes per day * days elapsed
        expectedTarget = task.allocated_minutes * daysElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        // Weekly tasks: allocated minutes per week * weeks elapsed
        const weeksElapsed = daysElapsed / 7;
        expectedTarget = task.allocated_minutes * weeksElapsed;
      } else if (task.follow_up_frequency === 'monthly') {
        // Monthly tasks: allocated minutes per month * months elapsed (approximate)
        const monthsElapsed = daysElapsed / 30;
        expectedTarget = task.allocated_minutes * monthsElapsed;
      } else {
        // Yearly tasks: allocated minutes for entire year * (days elapsed / 365)
        expectedTarget = task.allocated_minutes * (daysElapsed / 365);
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

  // Get cell-level color for yearly tab - determines if specific month meets target
  function getYearlyMonthColorClass(task: Task, month: number): string {
    // Debug for task 65 (Dhyan)
    if (task.id === 65 && month === 1) {
      console.log('🎨 Task 65 month coloring:', {
        taskName: task.name,
        month,
        activeTab,
        allocated_minutes: task.allocated_minutes,
        task_type: task.task_type,
        follow_up_frequency: task.follow_up_frequency
      });
    }
    
    if (activeTab !== 'yearly') {
      if (task.id === 65 && month === 1) {
        console.log('  ❌ Returning empty - activeTab is not yearly:', activeTab);
      }
      return '';
    }
    
    const today = new Date();
    const yearStart = new Date(selectedYearStart);
    const currentYear = yearStart.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    
    // If viewing a future year or future month, no color
    if (today.getFullYear() < currentYear || (today.getFullYear() === currentYear && today.getMonth() + 1 < month)) {
      return '';
    }
    
    // Get monitoring start date from yearly task status
    const taskStatus = yearlyTaskStatuses[task.id];
    let monitoringStart = yearStart;
    if (taskStatus?.created_at) {
      const createdAt = new Date(taskStatus.created_at);
      createdAt.setHours(0, 0, 0, 0);
      monitoringStart = createdAt > yearStart ? createdAt : yearStart;
    }
    
    // Get actual value for this month
    const actualValue = getYearlyTime(task.id, month);
    
    // Calculate days elapsed in this month (from monitoring start or month start, whichever is later)
    const monthStartDate = new Date(currentYear, month - 1, 1); // First day of this month
    const monthEndDate = new Date(currentYear, month, 0); // Last day of this month
    
    let daysElapsed = 0;
    if (monitoringStart > monthEndDate) {
      // Monitoring started after this month ended - no expectation
      return '';
    } else if (monitoringStart >= monthStartDate) {
      // Monitoring started during this month
      const startDay = monitoringStart.getDate();
      if (today.getFullYear() === currentYear && today.getMonth() + 1 === month) {
        // Current month: from monitoring start to today
        daysElapsed = today.getDate() - startDay + 1;
      } else {
        // Past month: from monitoring start to month end
        daysElapsed = monthEndDate.getDate() - startDay + 1;
      }
    } else {
      // Monitoring started before this month
      if (today.getFullYear() === currentYear && today.getMonth() + 1 === month) {
        // Current month: use today's date
        daysElapsed = today.getDate();
      } else {
        // Past month: use full month days
        daysElapsed = monthEndDate.getDate();
      }
    }
    
    // Calculate expected value for this month based on task type and frequency
    let expectedValue = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        // Daily task: target per day * days elapsed
        expectedValue = (task.target_value || 0) * daysElapsed;
      } else if (task.follow_up_frequency === 'weekly') {
        // Weekly task: target per week * weeks elapsed in month
        const weeksElapsed = daysElapsed / 7;
        expectedValue = (task.target_value || 0) * weeksElapsed;
      } else if (task.follow_up_frequency === 'monthly') {
        // Monthly task: if month fully elapsed, expect full target; otherwise pro-rata
        const daysInMonth = new Date(currentYear, month, 0).getDate();
        expectedValue = (task.target_value || 0) * (daysElapsed / daysInMonth);
      } else {
        // Yearly task: pro-rata for this month
        expectedValue = (task.target_value || 0) / 12;
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      // Boolean: 1 if done, 0 if not
      if (task.follow_up_frequency === 'daily') {
        expectedValue = daysElapsed; // Expect done every day
      } else if (task.follow_up_frequency === 'weekly') {
        const weeksElapsed = daysElapsed / 7;
        expectedValue = weeksElapsed;
      } else if (task.follow_up_frequency === 'monthly') {
        const daysInMonth = new Date(currentYear, month, 0).getDate();
        expectedValue = daysElapsed / daysInMonth; // Pro-rata
      } else {
        expectedValue = 1 / 12; // Yearly: 1/12 per month
      }
    } else {
      // TIME task
      if (task.follow_up_frequency === 'daily') {
        // Daily task: allocated minutes per day * days elapsed
        expectedValue = task.allocated_minutes * daysElapsed;
        
        // Debug for Dhyan task
        if (task.name.includes('Dhyan')) {
          console.log('🔍 Dhyan month color calculation:', {
            month,
            actualValue,
            expectedValue,
            allocated_minutes: task.allocated_minutes,
            daysElapsed,
            isOnTrack: actualValue >= expectedValue
          });
        }
      } else if (task.follow_up_frequency === 'weekly') {
        // Weekly task: allocated minutes per week * weeks elapsed
        const weeksElapsed = daysElapsed / 7;
        expectedValue = task.allocated_minutes * weeksElapsed;
      } else if (task.follow_up_frequency === 'monthly') {
        // Monthly task: allocated minutes * (days elapsed / days in month)
        const daysInMonth = new Date(currentYear, month, 0).getDate();
        expectedValue = task.allocated_minutes * (daysElapsed / daysInMonth);
      } else {
        // Yearly task: allocated minutes / 12
        expectedValue = task.allocated_minutes / 12;
      }
    }
    
    // Return color class based on comparison
    if (actualValue >= expectedValue) {
      return 'weekly-on-track'; // Green - meeting or exceeding target
    } else if (actualValue > 0) {
      return 'weekly-below-target'; // Light red - below target but has some progress
    }
    return ''; // No color if no progress yet
  };

  // Get cell-level color for weekly tab - determines if specific day meets target
  function getWeeklyCellColorClass(task: Task, dayIndex: number): string {
    // Allow checking from today tab for "Needs Attention" feature
    if (activeTab !== 'weekly' && activeTab !== 'today') return '';
    
    const actualValue = getWeeklyTime(task.id, dayIndex);
    
    // Calculate expected value for this specific day
    let expectedValue = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        // Daily task: expect target_value each day
        expectedValue = task.target_value || 0;
      } else {
        // Weekly task: can distribute throughout week, so expect (target / 7) per day
        expectedValue = (task.target_value || 0) / 7;
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      // Boolean: 1 (done) per day if daily, or spread across week if weekly
      expectedValue = task.follow_up_frequency === 'daily' ? 1 : 1 / 7;
    } else {
      // TIME task
      if (task.follow_up_frequency === 'daily') {
        // Daily task: expect allocated_minutes each day
        expectedValue = task.allocated_minutes;
      } else {
        // Weekly task: can distribute throughout week
        expectedValue = task.allocated_minutes / 7;
      }
    }
    
    // Check if this day is in the past or today
    const dayDate = new Date(selectedWeekStart);
    dayDate.setDate(dayDate.getDate() + dayIndex);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    if (dayDate > today) {
      // Future day - no color needed
      return '';
    }
    
    // Return color based on achievement
    if (actualValue >= expectedValue) {
      return 'cell-achieved'; // Green - target met
    } else if (expectedValue > 0) {
      // Below target - show red whether or not there's progress
      return 'cell-below-target'; // Red - below target
    }
    return ''; // No expected value (shouldn't happen)
  }

  // Get cell-level color for monthly tab
  const getMonthlyCellColorClass = (task: Task, dayOfMonth: number): string => {
    // Allow checking from today tab for "Needs Attention" feature
    if (activeTab !== 'monthly' && activeTab !== 'today') return '';
    
    const actualValue = getMonthlyTime(task.id, dayOfMonth);
    
    // Calculate expected value for this specific day
    let expectedValue = 0;
    if (task.task_type === TaskType.COUNT) {
      if (task.follow_up_frequency === 'daily') {
        // Daily task: expect target_value each day
        expectedValue = task.target_value || 0;
      } else {
        // Monthly task: can distribute throughout month
        const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
        expectedValue = (task.target_value || 0) / daysInMonth;
      }
    } else if (task.task_type === TaskType.BOOLEAN) {
      // Boolean: 1 (done) per day if daily
      expectedValue = task.follow_up_frequency === 'daily' ? 1 : 0.03; // ~1/30 for monthly
    } else {
      // TIME task
      if (task.follow_up_frequency === 'daily') {
        // Daily task: expect allocated_minutes each day
        expectedValue = task.allocated_minutes;
      } else {
        // Monthly task: can distribute throughout month
        const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
        expectedValue = task.allocated_minutes / daysInMonth;
      }
    }
    
    // Check if this day is in the past or today
    const dayDate = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth(), dayOfMonth);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    if (dayDate > today) {
      // Future day - no color needed
      return '';
    }
    
    // Return color based on achievement
    if (actualValue >= expectedValue) {
      return 'cell-achieved'; // Green - target met
    } else if (expectedValue > 0) {
      // Below target - show red whether or not there's progress
      return 'cell-below-target'; // Red - below target
    }
    return ''; // No expected value (shouldn't happen)
  };

  // Calculate total allocated time by pillar for daily tasks
  const getPillarTimeAllocations = () => {
    const pillarTotals: Record<string, number> = {}
    
    // Only count ALLOCATED time for tasks in the Time-Based Tasks table
    // (same filtering as timeBasedTasks: time-based daily tasks, excluding one-time tasks)
    filteredTasks.forEach(task => {
      if (task.task_type === TaskType.TIME && !task.is_daily_one_time) {
        const pillarName = task.pillar_name || 'Other';
        pillarTotals[pillarName] = (pillarTotals[pillarName] || 0) + (task.allocated_minutes || 0);
      }
    });

    // Convert to hours and minutes format
    const formattedAllocations = Object.entries(pillarTotals)
      .map(([pillar, minutes]) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        return `${pillar}: ${timeStr}`;
      })
      .join(', ');

    return formattedAllocations;
  };

  // Get tasks that need attention (showing red in current week or month)
  function getTasksNeedingAttention() {
    // Wait for data to load before checking
    // Check if we have ANY weekly, monthly, or yearly data (statuses, entries, or aggregates)
    const hasWeeklyData = Object.keys(weeklyTaskStatuses).length > 0 || 
                          Object.keys(weeklyEntries).length > 0 || 
                          Object.keys(dailyAggregates).length > 0;
    const hasMonthlyData = Object.keys(monthlyTaskStatuses).length > 0 || 
                           Object.keys(monthlyEntries).length > 0 || 
                           Object.keys(monthlyDailyAggregates).length > 0;
    const hasYearlyData = Object.keys(yearlyTaskStatuses).length > 0;
    
    if (!hasWeeklyData && !hasMonthlyData && !hasYearlyData) {
      return [];
    }
    
    const needsAttention: Array<{
      task: Task;
      reason: string;
      weeklyIssue?: { redDays: number; totalDays: number; neededToday?: number; dailyTarget?: number; deficit?: number; currentAverage?: number }
      monthlyIssue?: { 
        percentBehind: number; 
        totalSpent: number; 
        expectedTarget: number;
        dailyTarget?: number;
        currentAverage?: number;
        neededToday?: number;
        deficit?: number;
      }
      quarterlyIssue?: {
        daysElapsed: number;
        neededToday?: number;
        dailyTarget?: number;
        deficit?: number;
        currentAverage?: number;
        daysLeft?: number;
        quarter?: number;
      }
      yearlyIssue?: {
        daysElapsed: number;
        neededToday?: number;
        dailyTarget?: number;
        deficit?: number;
        currentAverage?: number;
        daysLeft?: number;
      }
      recommendation: string;
    }> = [];

    tasks.forEach(task => {
      if (!task.is_active || task.is_completed) return;

      // Check weekly tab (current week only)
      const weeklyStatus = weeklyTaskStatuses[task.id];
      const isWeeklyTask = task.follow_up_frequency === 'weekly';
      
      // Include task if:
      // For native weekly tasks: no status OR (has status but not completed/NA)
      // For other tasks: has status AND not completed/NA
      const shouldCheckWeekly = isWeeklyTask 
        ? (!weeklyStatus || (!weeklyStatus.is_completed && !weeklyStatus.is_na))
        : (weeklyStatus && !weeklyStatus.is_completed && !weeklyStatus.is_na);
      
      if (shouldCheckWeekly) {
        // Calculate total spent and check if behind schedule
        let totalSpent = 0;
        let totalDaysIncludingToday = 0; // Total days including today (for display)
        let pastDaysOnly = 0; // Past days only (for deficit calculation)
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        
        weekDays.forEach(day => {
          totalSpent += getWeeklyTime(task.id, day.index);
          
          const dayDate = new Date(selectedWeekStart);
          dayDate.setDate(dayDate.getDate() + day.index);
          dayDate.setHours(0, 0, 0, 0);

          if (dayDate <= today) {
            totalDaysIncludingToday++;
          }
          
          // Count only PAST days (before today) for deficit calculation
          if (dayDate < today) {
            pastDaysOnly++;
          }
        });

        // Calculate targets and deficit
        let weeklyTarget = 0;
        if (task.task_type === TaskType.COUNT) {
          weeklyTarget = task.follow_up_frequency === 'daily' ? (task.target_value || 0) * 7 : (task.target_value || 0);
        } else if (task.task_type === TaskType.BOOLEAN) {
          weeklyTarget = task.follow_up_frequency === 'daily' ? 7 : 1;
        } else {
          // TIME tasks: allocated_minutes is daily target, so weekly = daily * 7
          weeklyTarget = task.allocated_minutes * 7;
        }

        const remaining = weeklyTarget - totalSpent;
        const daysLeft = 7 - totalDaysIncludingToday + 1; // +1 to include today
        
        // Calculate daily target
        let dailyTarget = 0;
        if (task.task_type === TaskType.COUNT) {
          dailyTarget = task.follow_up_frequency === 'daily' ? (task.target_value || 0) : (task.target_value || 0) / 7;
        } else if (task.task_type === TaskType.BOOLEAN) {
          dailyTarget = task.follow_up_frequency === 'daily' ? 1 : 1/7;
        } else {
          // TIME tasks: allocated_minutes is ALWAYS the daily target (whether daily or weekly)
          // For weekly tasks, user enters 60 min = 60 min/day (not 60 min total for week)
          dailyTarget = task.allocated_minutes;
        }
        
        // Calculate expected vs actual - ONLY count PAST days (not including today)
        const expectedByNow = dailyTarget * pastDaysOnly;
        const deficit = expectedByNow - totalSpent;
        
        // TODAY = daily target + ALL catch-up (front-loaded)
        const neededToday = dailyTarget + deficit;
        
        // Show in attention if:
        // 1. Behind schedule from past days (deficit > 0), OR
        // 2. Haven't completed today's target yet (totalSpent < expected including today)
        const expectedIncludingToday = dailyTarget * totalDaysIncludingToday;
        const shouldShowInAttention = totalSpent < expectedIncludingToday;
        
        if (shouldShowInAttention) {
          // Count red days for display purposes only
          let redDaysCount = 0;
          const todayForCheck = new Date();
          todayForCheck.setHours(23, 59, 59, 999);
          
          weekDays.forEach(day => {
            const dayDate = new Date(selectedWeekStart);
            dayDate.setDate(dayDate.getDate() + day.index);

            if (dayDate <= todayForCheck) {
              const cellColor = getWeeklyCellColorClass(task, day.index);
              if (cellColor === 'cell-below-target') {
                redDaysCount++;
              }
            }
          });
          
          const unit = task.task_type === TaskType.TIME ? 'min' : task.task_type === TaskType.COUNT ? (task.unit || 'count') : '';
          const recommendation = daysLeft > 0 
            ? `Need ${Math.ceil(neededToday)} ${unit} today (Ideal: ${Math.round(dailyTarget)}, Lagged: ${Math.round(deficit)}, ${daysLeft} days left)`
            : `Need ${Math.ceil(remaining)} ${unit} today to hit target`;

          needsAttention.push({
            task,
            reason: 'weekly',
            weeklyIssue: { redDays: redDaysCount, totalDays: totalDaysIncludingToday, neededToday: Math.ceil(neededToday), dailyTarget: Math.round(dailyTarget), deficit: Math.round(deficit) },
            recommendation
          });
        }
      }

      // Check monthly tab (current month only)
      const monthlyStatus = monthlyTaskStatuses[task.id];
      if (monthlyStatus && !monthlyStatus.is_completed && !monthlyStatus.is_na) {
        // Calculate how much behind
        const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
        let totalSpent = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          totalSpent += getMonthlyTime(task.id, day);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const monthStart = new Date(selectedMonthStart);
        monthStart.setHours(0, 0, 0, 0);
        
        let daysIncludingToday = 1; // Days including today
        let pastDaysOnly = 0; // Past days only (for deficit calculation)
        
        if (today >= monthStart) {
          const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
          monthEnd.setHours(0, 0, 0, 0);
          
          if (today <= monthEnd) {
            const diffTime = today.getTime() - monthStart.getTime();
            daysIncludingToday = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            pastDaysOnly = Math.max(0, daysIncludingToday - 1); // Exclude today
          } else {
            daysIncludingToday = daysInMonth;
            pastDaysOnly = daysInMonth;
          }
        }

        let expectedTarget = 0;
        if (task.task_type === TaskType.COUNT) {
          expectedTarget = task.follow_up_frequency === 'daily' ? (task.target_value || 0) * pastDaysOnly : (task.target_value || 0) * (pastDaysOnly / daysInMonth);
        } else if (task.task_type === TaskType.BOOLEAN) {
          expectedTarget = pastDaysOnly;
        } else {
          expectedTarget = task.follow_up_frequency === 'daily' ? task.allocated_minutes * pastDaysOnly : task.allocated_minutes * (pastDaysOnly / daysInMonth);
        }

        const percentBehind = expectedTarget > 0 ? Math.round(((expectedTarget - totalSpent) / expectedTarget) * 100) : 0;
        const daysLeft = daysInMonth - daysIncludingToday + 1; // +1 to include today
        const deficit = expectedTarget - totalSpent; // Total amount behind
        
        // Calculate daily target
        const dailyTarget = task.task_type === TaskType.COUNT 
          ? (task.follow_up_frequency === 'daily' ? (task.target_value || 0) : (task.target_value || 0) / daysInMonth)
          : (task.follow_up_frequency === 'daily' ? task.allocated_minutes : task.allocated_minutes / daysInMonth);
        
        // Calculate current average
        const currentAverage = daysIncludingToday > 0 ? totalSpent / daysIncludingToday : 0;
        
        // TODAY = daily target + ALL catch-up (front-loaded)
        const neededToday = dailyTarget + deficit;
        
        // Show in attention if:
        // 1. Behind schedule from past days (deficit > 0), OR
        // 2. Haven't completed today's target yet (totalSpent < expected including today)
        let expectedIncludingToday = 0;
        if (task.task_type === TaskType.COUNT) {
          expectedIncludingToday = task.follow_up_frequency === 'daily' ? (task.target_value || 0) * daysIncludingToday : (task.target_value || 0) * (daysIncludingToday / daysInMonth);
        } else if (task.task_type === TaskType.BOOLEAN) {
          expectedIncludingToday = daysIncludingToday;
        } else {
          expectedIncludingToday = task.follow_up_frequency === 'daily' ? task.allocated_minutes * daysIncludingToday : task.allocated_minutes * (daysIncludingToday / daysInMonth);
        }
        
        const shouldShowInAttention = totalSpent < expectedIncludingToday;
        
        if (shouldShowInAttention) {
          const unit = task.task_type === TaskType.TIME ? 'min' : task.task_type === TaskType.COUNT ? (task.unit || 'count') : '';
          const recommendation = daysLeft > 0
            ? `Need ${Math.ceil(neededToday)} ${unit} today (Ideal: ${Math.round(dailyTarget)}, Lagged: ${Math.round(deficit)}, ${daysLeft} days left)`
            : `Need ${Math.ceil(deficit)} ${unit} today to hit target (month ended)`;

          // Check if already added from weekly - if so, also add as separate monthly entry
          // This allows tasks to appear in both Weekly and Monthly "Needs Attention" sections
          needsAttention.push({
            task,
            reason: 'monthly',
            monthlyIssue: { 
              percentBehind, 
              totalSpent, 
              expectedTarget,
              dailyTarget: Math.round(dailyTarget),
              currentAverage: Math.round(currentAverage),
              neededToday: Math.ceil(neededToday),
              deficit: Math.round(deficit)
            },
            recommendation
          });
        }
      }

      // Check yearly tab (current year only)
      const yearlyStatus = yearlyTaskStatuses[task.id];
      if (yearlyStatus && !yearlyStatus.is_completed && !yearlyStatus.is_na) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);
        startOfYear.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        const daysElapsedInYear = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const daysLeftInYear = 365 - daysElapsedInYear + 1; // Including today
        
        // Calculate total spent from yearlyMonthlyAggregates (all months year-to-date)
        let totalSpent = 0;
        const currentMonthIndex = today.getMonth() + 1; // 1-12
        for (let month = 1; month <= currentMonthIndex; month++) {
          const key = `${task.id}-${month}`;
          totalSpent += (yearlyMonthlyAggregates[key] || 0);
        }
        
        // Calculate daily target (ideal daily average)
        let dailyTarget = 0;
        if (task.task_type === TaskType.COUNT) {
          dailyTarget = task.follow_up_frequency === 'daily' ? (task.target_value || 0) : (task.target_value || 0) / 365;
        } else if (task.task_type === TaskType.BOOLEAN) {
          dailyTarget = task.follow_up_frequency === 'daily' ? 1 : 1/365;
        } else {
          dailyTarget = task.allocated_minutes;
        }
        
        // Calculate actual average per day (since start of year)
        const actualAverage = daysElapsedInYear > 0 ? totalSpent / daysElapsedInYear : 0;
        
        // Only show in attention if actual average < ideal average
        const shouldShowInAttention = actualAverage < dailyTarget;
        
        if (shouldShowInAttention) {
          const expectedPastOnly = dailyTarget * (daysElapsedInYear - 1); // Past days only
          const deficit = Math.max(0, expectedPastOnly - totalSpent);
          const neededToday = dailyTarget + deficit;
          
          const unit = task.task_type === TaskType.TIME ? 'min' : task.task_type === TaskType.COUNT ? (task.unit || 'count') : '';
          const recommendation = daysLeftInYear > 0
            ? `Need ${Math.ceil(neededToday)} ${unit} today (Ideal: ${Math.round(dailyTarget)}, Lagged: ${Math.round(deficit)}, ${daysLeftInYear} days left)`
            : `Need ${Math.ceil(deficit)} ${unit} today to hit target`;
          
          needsAttention.push({
            task,
            reason: 'yearly',
            yearlyIssue: {
              daysElapsed: daysElapsedInYear,
              neededToday: Math.ceil(neededToday),
              dailyTarget: Math.round(dailyTarget),
              deficit: Math.round(deficit),
              currentAverage: Math.round(actualAverage * 10) / 10,
              daysLeft: daysLeftInYear
            },
            recommendation
          });
        }
      }

      // Check quarterly tab (current quarter only)
      // Use yearlyTaskStatuses since quarterly uses the same backend data structure
      if (yearlyStatus && !yearlyStatus.is_completed && !yearlyStatus.is_na) {
        const today = new Date();
        const currentYear = today.getFullYear();
        today.setHours(0, 0, 0, 0);
        
        // Determine current quarter
        const currentMonth = today.getMonth() + 1; // 1-12
        const currentQuarter = Math.ceil(currentMonth / 3); // 1, 2, 3, or 4
        
        // Calculate total spent from yearlyMonthlyAggregates (all quarters year-to-date)
        let totalSpent = 0;
        const currentMonthIndex = today.getMonth() + 1; // 1-12
        for (let month = 1; month <= currentMonthIndex; month++) {
          const key = `${task.id}-${month}`;
          totalSpent += (yearlyMonthlyAggregates[key] || 0);
        }
        
        // Calculate days elapsed in year
        const startOfYear = new Date(currentYear, 0, 1);
        startOfYear.setHours(0, 0, 0, 0);
        const daysElapsedInYear = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        // Calculate daily target (ideal daily average)
        let dailyTarget = 0;
        if (task.task_type === TaskType.COUNT) {
          dailyTarget = task.follow_up_frequency === 'daily' ? (task.target_value || 0) : (task.target_value || 0) / 365;
        } else if (task.task_type === TaskType.BOOLEAN) {
          dailyTarget = task.follow_up_frequency === 'daily' ? 1 : 1/365;
        } else {
          dailyTarget = task.allocated_minutes;
        }
        
        // Calculate actual average per day (since start of year)
        const actualAverage = daysElapsedInYear > 0 ? totalSpent / daysElapsedInYear : 0;
        
        // Only show in attention if actual average < ideal average
        const shouldShowInAttention = actualAverage < dailyTarget;
        
        if (shouldShowInAttention) {
          const daysLeftInYear = 365 - daysElapsedInYear + 1;
          const expectedSoFar = dailyTarget * (daysElapsedInYear - 1); // Past days only
          const deficit = Math.max(0, expectedSoFar - totalSpent);
          const neededToday = dailyTarget + deficit;
          
          const unit = task.task_type === TaskType.TIME ? 'min' : task.task_type === TaskType.COUNT ? (task.unit || 'count') : '';
          const recommendation = daysLeftInYear > 0
            ? `Need ${Math.ceil(neededToday)} ${unit} today (Ideal: ${Math.round(dailyTarget)}, Lagged: ${Math.round(deficit)}, ${daysLeftInYear} days left)`
            : `Need ${Math.ceil(deficit)} ${unit} today to hit target`;
          
          needsAttention.push({
            task,
            reason: 'quarterly',
            quarterlyIssue: {
              daysElapsed: daysElapsedInYear,
              neededToday: Math.ceil(neededToday),
              dailyTarget: Math.round(dailyTarget),
              deficit: Math.round(deficit),
              currentAverage: Math.round(actualAverage * 10) / 10,
              daysLeft: daysLeftInYear,
              quarter: currentQuarter
            },
            recommendation
          });
        }
      }
    });

    // Sort by severity (most behind first)
    return needsAttention.sort((a, b) => {
      const severityA = a.weeklyIssue?.redDays || a.monthlyIssue?.percentBehind || 0;
      const severityB = b.weeklyIssue?.redDays || b.monthlyIssue?.percentBehind || 0;
      return severityB - severityA;
    });
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'now', label: 'NOW' },
    { key: 'today', label: 'Today' },
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'upcoming', label: 'Upcoming' },
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
    getTasksByParentId,
    projectTaskFilter,
    onAddSubtask
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
    projectTaskFilter?: 'all' | 'in-progress' | 'completed' | 'no-milestone';
    onAddSubtask?: (parentTask: ProjectTaskData) => void;
  }) => {
    const subTasks = getTasksByParentId(task.id);
    const hasSubTasks = subTasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);
    // Strip time component from due_date before getting color class
    const dueDateOnly = task.due_date ? task.due_date.split('T')[0] : null;
    const dueDateClass = getDueDateColorClass(dueDateOnly);

    return (
      <div className={`task-node level-${level}`} style={{ marginLeft: `${level * 20}px` }} data-task-id={task.id}>
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
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
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
              {/* Show subtask count for root tasks and tasks with children */}
              {(() => {
                // Get all descendants (subtasks and sub-subtasks)
                const getAllDescendants = (taskId: number): ProjectTaskData[] => {
                  const directChildren = allTasks.filter(t => t.parent_task_id === taskId);
                  const allDescendants = [...directChildren];
                  directChildren.forEach(child => {
                    allDescendants.push(...getAllDescendants(child.id));
                  });
                  return allDescendants;
                }
                
                const descendants = getAllDescendants(task.id);
                // Include the parent task itself in the count
                const allTasksIncludingSelf = [task, ...descendants];
                const completedCount = allTasksIncludingSelf.filter(t => t.is_completed).length;
                const totalCount = allTasksIncludingSelf.length;
                
                // Always show count (including just the task itself if no children)
                return (
                  <span 
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '500',
                      background: completedCount === totalCount ? '#c6f6d5' : '#e6f3ff',
                      color: completedCount === totalCount ? '#22543d' : '#1e5a8e',
                      border: `1px solid ${completedCount === totalCount ? '#9ae6b4' : '#b3d9ff'}`
                    }}
                    title={`${completedCount} of ${totalCount} tasks completed (including this task)`}
                  >
                    📊 {completedCount}/{totalCount}
                  </span>
                );
              })()}
              {task.milestone_id && (() => {
                const milestone = projectMilestones.find(m => m.id === task.milestone_id);
                return milestone ? (
                  <span 
                    className="milestone-badge"
                    title={`Milestone: ${milestone.name} (Target: ${parseDateString(milestone.target_date).toLocaleDateString()})`}
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '500',
                      background: '#e6f3ff',
                      color: '#1e5a8e',
                      border: '1px solid #b3d9ff'
                    }}
                  >
                    🎯 {milestone.name}
                  </span>
                ) : null;
              })()}
            </div>
            {task.description && (
              <span className="task-description">{task.description}</span>
            )}
          </div>
          
          {task.due_date && (
            <div 
              className="task-due-date"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input 
                type="date"
                value={task.due_date ? task.due_date.split('T')[0] : ''}
                onChange={(e) => {
                  e.stopPropagation();
                  const newDate = e.target.value;
                  if (newDate) {
                    // Preserve the existing time or use midnight if none exists
                    const existingTime = task.due_date.includes('T') ? task.due_date.split('T')[1] : '00:00:00';
                    onUpdateDueDate(task.id, newDate + 'T' + existingTime);
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  border: '1px solid #e2e8f0',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  pointerEvents: 'auto'
                }}
              />
            </div>
          )}
          
          <div className="task-actions">
            <button 
              className="btn btn-sm"
              onClick={() => onToggleComplete(task.id, task.is_completed)}
              style={{ 
                marginRight: '8px',
                backgroundColor: task.is_completed ? '#48bb78' : '#4299e1',
                color: 'white',
                padding: '4px 8px',
                fontSize: '12px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
              title={task.is_completed ? 'Mark as incomplete' : 'Mark as done'}
            >
              {task.is_completed ? '↶ UNDO' : 'Done'}
            </button>
            <button 
              className="btn btn-sm"
              onClick={() => {
                console.log('➕ Sub button clicked for task:', task.name, 'ID:', task.id);
                if (onAddSubtask) {
                  console.log('Calling onAddSubtask callback');
                  onAddSubtask(task);
                } else {
                  console.log('No onAddSubtask callback, using default behavior');
                  setEditingTask(task);
                  setShowAddTaskModal(true);
                }
              }}
              style={{ 
                marginRight: '8px',
                backgroundColor: '#805ad5',
                color: 'white',
                padding: '4px 8px',
                fontSize: '12px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              title="Add subtask to this task"
            >
              ➕ Sub
            </button>
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
            {subTasks
              .filter(subTask => {
                // Apply filter to subtasks
                if (!projectTaskFilter || projectTaskFilter === 'all') return true;
                if (projectTaskFilter === 'in-progress') return !subTask.is_completed;
                if (projectTaskFilter === 'completed') return subTask.is_completed;
                if (projectTaskFilter === 'no-milestone') return !subTask.milestone_id;
                return true;
              })
              .map(subTask => (
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
                projectTaskFilter={projectTaskFilter}
                onAddSubtask={onAddSubtask}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Route to extracted page components for specific tabs
  if (activeTab === 'weekly') {
    return (
      <div className="tasks-page">
        <header className="tasks-header">
          <h1 style={{ flex: 1, textAlign: 'center' }}>My Time Manager Web Application</h1>
          <button className="btn btn-primary" onClick={() => { setSelectedTaskId(null); setIsTaskFormOpen(true); }}>
            ➕ Add Task
          </button>
        </header>
        <div className="tasks-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
                const searchParams = new URLSearchParams(location.search);
                searchParams.set('tab', tab.key);
                navigate(`?${searchParams.toString()}`, { replace: true });
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Week Navigator */}
        <div className="date-navigator">
          <button className="btn-nav" onClick={() => changeWeek(-1)}>
            ← Previous Week
          </button>
          <button 
            className={`btn-nav btn-today ${isCurrentWeek(selectedWeekStart) ? 'active' : 'inactive'}`}
            onClick={goToCurrentWeek}
          >
            📅 Current Week
          </button>
          <button className="btn-nav" onClick={() => changeWeek(1)}>
            Next Week →
          </button>
          <button 
            className="btn-nav btn-add-weekly" 
            onClick={() => setShowAddWeeklyTaskModal(true)}
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
        
        <div className="container-fluid">
          <WeeklyTasks />
        </div>
        <TaskForm
          isOpen={isTaskFormOpen}
          taskId={selectedTaskId || undefined}
          onClose={() => setIsTaskFormOpen(false)}
          onSuccess={async () => {
            await loadTasks();
            setIsTaskFormOpen(false);
          }}
        />
        
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
                        if (task.follow_up_frequency !== 'daily') return false;
                        if (weeklyTaskStatuses[task.id]) return false;
                        
                        // Exclude ALL completed tasks (global or daily)
                        if (task.is_completed) return false;
                        
                        // Check if completed in daily status
                        const completionDateStr = dailyTaskCompletionDates.get(task.id);
                        if (completionDateStr) return false;
                        
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        if (!task.is_active && task.na_marked_at) {
                          const naMarkedDate = new Date(task.na_marked_at);
                          naMarkedDate.setHours(0, 0, 0, 0);
                          if (naMarkedDate.getTime() === today.getTime()) return true;
                          return false;
                        }
                        
                        return task.is_active;
                      })
                      .sort((a, b) => {
                        const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                        const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                        const orderA = hierarchyOrder[keyA] || 999;
                        const orderB = hierarchyOrder[keyB] || 999;
                        
                        if (orderA !== orderB) {
                          return orderA - orderB;
                        }
                        
                        const taskOrderA = taskNameOrder[a.name || ''] || 999;
                        const taskOrderB = taskNameOrder[b.name || ''] || 999;
                        
                        if (taskOrderA !== taskOrderB) {
                          return taskOrderA - taskOrderB;
                        }
                        
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
      </div>
    );
  };

  if (activeTab === 'monthly') {
    return (
      <div className="tasks-page">
        <header className="tasks-header">
          <h1 style={{ flex: 1, textAlign: 'center' }}>My Time Manager Web Application</h1>
          <button className="btn btn-primary" onClick={() => { setSelectedTaskId(null); setIsTaskFormOpen(true); }}>
            ➕ Add Task
          </button>
        </header>
        <div className="tasks-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
                const searchParams = new URLSearchParams(location.search);
                searchParams.set('tab', tab.key);
                navigate(`?${searchParams.toString()}`, { replace: true });
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Date Navigator */}
        <div className="date-navigator">
          <button className="btn-nav" onClick={() => changeMonth(-1)}>
            ← Previous Month
          </button>
          <button 
            className={`btn-nav btn-today ${isCurrentMonth(selectedMonthStart) ? 'active' : 'inactive'}`}
            onClick={() => {
              const currentMonth = new Date();
              currentMonth.setDate(1);
              setSelectedMonthStart(currentMonth);
            }}
          >
            📅 Current Month
          </button>
          <button className="btn-nav" onClick={() => changeMonth(1)}>
            Next Month →
          </button>
          <button 
            className="btn-nav btn-add-monthly"
            onClick={() => setShowAddMonthlyTaskModal(true)}
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
        
        <div className="container-fluid">
          <MonthlyTasks />
        </div>
        <TaskForm
          isOpen={isTaskFormOpen}
          taskId={selectedTaskId || undefined}
          onClose={() => setIsTaskFormOpen(false)}
          onSuccess={async () => {
            await loadTasks();
            setIsTaskFormOpen(false);
          }}
        />
        
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
                        if (task.follow_up_frequency !== 'daily') return false;
                        if (monthlyTaskStatuses[task.id]) return false;
                        
                        // Exclude ALL completed tasks (global or daily)
                        if (task.is_completed) return false;
                        
                        // Check if completed in daily status
                        const completionDateStr = dailyTaskCompletionDates.get(task.id);
                        if (completionDateStr) return false;
                        
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        if (!task.is_active && task.na_marked_at) {
                          const naMarkedDate = new Date(task.na_marked_at);
                          naMarkedDate.setHours(0, 0, 0, 0);
                          if (naMarkedDate.getTime() === today.getTime()) return true;
                          return false;
                        }
                        
                        return task.is_active;
                      })
                      .sort((a, b) => {
                        const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                        const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                        const orderA = hierarchyOrder[keyA] || 999;
                        const orderB = hierarchyOrder[keyB] || 999;
                        
                        if (orderA !== orderB) {
                          return orderA - orderB;
                        }
                        
                        const taskOrderA = taskNameOrder[a.name || ''] || 999;
                        const taskOrderB = taskNameOrder[b.name || ''] || 999;
                        
                        if (taskOrderA !== taskOrderB) {
                          return taskOrderA - taskOrderB;
                        }
                        
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
                        if (task.follow_up_frequency !== 'weekly') return false;
                        if (monthlyTaskStatuses[task.id]) return false;
                        if (weeklyTaskStatuses[task.id]) return false; // Exclude completed/NA weekly tasks
                        if (task.is_completed) return false;
                        return task.is_active;
                      })
                      .sort((a, b) => {
                        const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                        const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                        const orderA = hierarchyOrder[keyA] || 999;
                        const orderB = hierarchyOrder[keyB] || 999;
                        
                        if (orderA !== orderB) {
                          return orderA - orderB;
                        }
                        
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
      </div>
    );
  };

  // Upcoming tab - separate component
  if (activeTab === 'upcoming') {
    return (
      <div className="tasks-page">
        <header className="tasks-header">
          <h1 style={{ flex: 1, textAlign: 'center' }}>My Time Manager Web Application</h1>
          <button className="btn btn-primary" onClick={() => { setSelectedTaskId(null); setIsTaskFormOpen(true); }}>
            ➕ Add Task
          </button>
        </header>
        <div className="tasks-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
                const searchParams = new URLSearchParams(location.search);
                searchParams.set('tab', tab.key);
                navigate(`?${searchParams.toString()}`, { replace: true });
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="container-fluid">
          <UpcomingTasks />
        </div>
        <TaskForm
          isOpen={isTaskFormOpen}
          taskId={selectedTaskId || undefined}
          onClose={() => setIsTaskFormOpen(false)}
          onSuccess={async () => {
            await loadTasks();
            setIsTaskFormOpen(false);
          }}
        />
      </div>
    );
  }

  if (activeTab === 'quarterly') {
    return (
      <div className="tasks-page">
        <header className="tasks-header">
          <h1 style={{ flex: 1, textAlign: 'center' }}>My Time Manager Web Application</h1>
          <button className="btn btn-primary" onClick={() => { setSelectedTaskId(null); setIsTaskFormOpen(true); }}>
            ➕ Add Task
          </button>
        </header>
        
        <div className="tasks-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
                const searchParams = new URLSearchParams(location.search);
                searchParams.set('tab', tab.key);
                navigate(`?${searchParams.toString()}`, { replace: true });
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Navigator with Add Quarterly Task button */}
        <div className="date-navigator">
          <button 
            className="btn-nav btn-add-quarterly"
            onClick={() => setShowAddQuarterlyTaskModal(true)}
            style={{ marginLeft: 'auto', backgroundColor: '#10b981', color: 'white' }}
          >
            ➕ Add Quarterly Task
          </button>
          <span className="date-display">
            Year {selectedYearStart.getFullYear()}
          </span>
        </div>

        <div className="container-fluid">
          <QuarterlyTasks />
        </div>

        {/* Add Quarterly Task Modal */}
        {showAddQuarterlyTaskModal && (
          <div className="modal-overlay" onClick={() => setShowAddQuarterlyTaskModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add Quarterly Task</h2>
                <button className="btn-close" onClick={() => setShowAddQuarterlyTaskModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '15px', color: '#666' }}>
                  Select an existing task to track quarterly:
                </p>
                
                <div className="form-group">
                  <label htmlFor="dailyTaskSelectQuarterly">Select from Daily Tasks:</label>
                  <select 
                    id="dailyTaskSelectQuarterly"
                    className="form-control"
                    value={selectedDailyTaskForQuarterly || ''}
                    onChange={(e) => setSelectedDailyTaskForQuarterly(e.target.value ? Number(e.target.value) : null)}
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
                        if (task.follow_up_frequency !== 'daily') return false;
                        
                        // Exclude ALL completed tasks (global or daily)
                        if (task.is_completed) return false;
                        
                        // Check if completed in daily status
                        const completionDateStr = dailyTaskCompletionDates.get(task.id);
                        if (completionDateStr) return false;
                        
                        // Check NA status
                        const today = new Date();
                        if (!task.is_active && task.na_marked_at) {
                          const naMarkedDate = new Date(task.na_marked_at);
                          return naMarkedDate.getTime() === today.getTime();
                        }
                        return task.is_active;
                      })
                      .sort((a, b) => {
                        const pillarCompare = (a.pillar_name || '').localeCompare(b.pillar_name || '');
                        if (pillarCompare !== 0) return pillarCompare;
                        const categoryCompare = (a.category_name || '').localeCompare(b.category_name || '');
                        if (categoryCompare !== 0) return categoryCompare;
                        return (a.name || '').localeCompare(b.name || '');
                      })
                      .map(task => (
                        <option key={task.id} value={task.id}>
                          {task.pillar_name} - {task.category_name}: {task.name}
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label htmlFor="weeklyTaskSelectQuarterly">Select from Weekly Tasks:</label>
                  <select 
                    id="weeklyTaskSelectQuarterly"
                    className="form-control"
                    value={selectedDailyTaskForQuarterly || ''}
                    onChange={(e) => setSelectedDailyTaskForQuarterly(e.target.value ? Number(e.target.value) : null)}
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
                        if (task.follow_up_frequency !== 'weekly') return false;
                        if (yearlyTaskStatuses[task.id]) return false; // Already added to yearly/quarterly
                        if (weeklyTaskStatuses[task.id]) return false; // Exclude completed/NA weekly tasks
                        if (task.is_completed) return false;
                        return task.is_active;
                      })
                      .map(task => (
                        <option key={task.id} value={task.id}>
                          {task.pillar_name} - {task.category_name}: {task.name}
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label htmlFor="monthlyTaskSelectQuarterly">Select from Monthly Tasks:</label>
                  <select 
                    id="monthlyTaskSelectQuarterly"
                    className="form-control"
                    value={selectedDailyTaskForQuarterly || ''}
                    onChange={(e) => setSelectedDailyTaskForQuarterly(e.target.value ? Number(e.target.value) : null)}
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
                      .filter(task => {
                        if (task.follow_up_frequency !== 'monthly') return false;
                        if (yearlyTaskStatuses[task.id]) return false; // Already added to yearly/quarterly
                        if (task.is_completed) return false;
                        return task.is_active;
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
                    setSelectedDailyTaskForQuarterly(null);
                    handleAddQuarterlyTask();
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
                    setShowAddQuarterlyTaskModal(false);
                    setSelectedDailyTaskForQuarterly(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleAddQuarterlyTask}
                  disabled={!selectedDailyTaskForQuarterly}
                >
                  Add to Quarterly
                </button>
              </div>
            </div>
          </div>
        )}

        <TaskForm
          isOpen={isTaskFormOpen}
          taskId={selectedTaskId || undefined}
          onClose={() => setIsTaskFormOpen(false)}
          onSuccess={async () => {
            await loadTasks();
            setIsTaskFormOpen(false);
          }}
        />
      </div>
    );
  }

  if (activeTab === 'yearly') {
    return (
      <div className="tasks-page">
        <header className="tasks-header">
          <h1 style={{ flex: 1, textAlign: 'center' }}>My Time Manager Web Application</h1>
          <button className="btn btn-primary" onClick={() => { setSelectedTaskId(null); setIsTaskFormOpen(true); }}>
            ➕ Add Task
          </button>
        </header>
        <div className="tasks-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
                const searchParams = new URLSearchParams(location.search);
                searchParams.set('tab', tab.key);
                navigate(`?${searchParams.toString()}`, { replace: true });
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Date Navigator */}
        <div className="date-navigator">
          <button className="btn-nav" onClick={() => changeYear(-1)}>
            ← Previous Year
          </button>
          <button 
            className={`btn-nav btn-today ${isCurrentYear(selectedYearStart) ? 'active' : 'inactive'}`}
            onClick={() => {
              const currentYear = new Date();
              currentYear.setMonth(0, 1);
              setSelectedYearStart(currentYear);
            }}
          >
            📅 Current Year
          </button>
          <button className="btn-nav" onClick={() => changeYear(1)}>
            Next Year →
          </button>
          <button 
            className="btn-nav btn-add-yearly"
            onClick={() => {
              console.log('🔘 Add Yearly Task button clicked (OLD section) - opening selection modal');
              setShowAddYearlyTaskModal(true);
            }}
            style={{ backgroundColor: '#10b981', color: 'white' }}
          >
            ➕ Add Yearly Task
          </button>
          <span className="date-display">
            Year {selectedYearStart.getFullYear()}
          </span>
        </div>
        
        <div className="container-fluid">
          <YearlyTasks />
        </div>
        <TaskForm
          isOpen={isTaskFormOpen}
          taskId={selectedTaskId || undefined}
          onClose={() => setIsTaskFormOpen(false)}
          onSuccess={async () => {
            await loadTasks();
            setIsTaskFormOpen(false);
          }}
        />
        
        {/* Add Yearly Task Modal - Selection modal for OLD yearly tab */}
        {showAddYearlyTaskModal && (
          <div className="modal-overlay" onClick={() => setShowAddYearlyTaskModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              {console.log('📋 Add Yearly Task SELECTION MODAL is rendering (OLD section)')}
              <div className="modal-header">
                <h2>Add Yearly Task</h2>
                <button className="btn-close" onClick={() => setShowAddYearlyTaskModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '15px', color: '#666' }}>
                  Select an existing task to track for this year:
                </p>
                
                <div className="form-group">
                  <label htmlFor="dailyTaskSelectYearly">Select from Daily Tasks:</label>
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
                        if (task.follow_up_frequency !== 'daily') return false;
                        if (!task.is_active) return false;
                        
                        // Exclude ALL completed tasks (global or daily)
                        if (task.is_completed) return false;
                        
                        // Check if completed in daily status
                        const completionDateStr = dailyTaskCompletionDates.get(task.id);
                        if (completionDateStr) return false;
                        
                        return true;
                      })
                      .map(task => (
                        <option key={task.id} value={task.id}>
                          {task.pillar_name} - {task.category_name}: {task.name}
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label htmlFor="weeklyTaskSelectYearly">Select from Weekly Tasks:</label>
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
                      .filter(task => {
                        if (task.follow_up_frequency !== 'weekly') return false;
                        if (yearlyTaskStatuses[task.id]) return false; // Already added to yearly
                        if (weeklyTaskStatuses[task.id]) return false; // Exclude completed/NA weekly tasks
                        if (!task.is_active) return false;
                        if (task.is_completed) return false;
                        return true;
                      })
                      .map(task => (
                        <option key={task.id} value={task.id}>
                          {task.pillar_name} - {task.category_name}: {task.name}
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label htmlFor="monthlyTaskSelectYearly">Select from Monthly Tasks:</label>
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
                      .filter(task => {
                        if (task.follow_up_frequency !== 'monthly') return false;
                        if (!task.is_active) return false;
                        if (task.is_completed) return false;
                        return true;
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
                >
                  Add to Yearly
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Upcoming tab - Shows future tasks grouped by pillar
  if (activeTab === 'upcoming') {
    return <UpcomingTasks />;
  }

  // NOW tab - First tab showing what needs attention right now
  if (activeTab === 'now') {
    return (
      <div className="tasks-page">
        <header className="tasks-header">
          <h1 style={{ flex: 1, textAlign: 'center' }}>My Time Manager Web Application</h1>
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
                const searchParams = new URLSearchParams(location.search);
                searchParams.set('tab', tab.key);
                navigate(`?${searchParams.toString()}`, { replace: true });
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

        <div style={{ padding: '20px' }}>
          {(() => {
            // NOW tab logic: Shows top 3 tasks with priority 1-3 due today or earlier
            // ANY priority can be set to 1-3 to appear here
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Filter tasks: priority 1-3 (any task can have this) AND due_date <= today
            const nowTasks = tasks.filter(task => {
              if (!task.priority || task.priority < 1 || task.priority > 3) return false;
              if (!task.is_active || task.is_completed) return false;
              
              // For tasks with due dates, must be today or earlier
              if (task.due_date) {
                const datePart = task.due_date.split('T')[0]; // Extract date part for datetime strings
                const taskDueDate = parseDateString(datePart);
                taskDueDate.setHours(0, 0, 0, 0);
                return taskDueDate <= today;
              }
              
              // For tasks without due dates (weekly/monthly), allow them in NOW
              return true;
            });
            
            console.log(`NOW tab filtering: found ${nowTasks.length} tasks with P1-3 and due today`);
            if (nowTasks.length > 0) {
              console.log('NOW tasks:', nowTasks.map(t => `${t.id}: ${t.name} (P${t.priority}, due: ${t.due_date})`));
            }
            
            const nowProjectTasks = projectTasksDueToday.filter(task => 
              task.priority && task.priority >= 1 && task.priority <= 3 && 
              !task.is_completed &&
              task.due_date && parseDateString(task.due_date.split('T')[0]) <= today
            );
            
            const nowGoalTasks = goalTasksDueToday.filter(task => 
              task.priority && task.priority >= 1 && task.priority <= 3 && 
              !task.is_completed &&
              task.due_date && parseDateString(task.due_date.split('T')[0]) <= today
            );
            
            // Combine and sort by priority (1 first), then by due_date (oldest first)
            // Take top 3 tasks - if more than 3 have P1-P3, show the most urgent
            const allNowTasks = [...nowTasks, ...nowProjectTasks, ...nowGoalTasks]
              .sort((a, b) => {
                if (a.priority !== b.priority) {
                  return a.priority - b.priority; // Lower priority number = higher urgency
                }
                // Same priority - oldest due_date first
                const aDatePart = a.due_date.split('T')[0];
                const bDatePart = b.due_date.split('T')[0];
                return parseDateString(aDatePart).getTime() - parseDateString(bDatePart).getTime();
              })
              .slice(0, 3); // Show top 3 only
            
            // Check if there are NOW habits to display
            const hasNowHabits = nowHabits.size > 0 && todaysHabits.filter(h => nowHabits.has(h.id)).length > 0;
            
            if (allNowTasks.length === 0 && !hasNowHabits) {
              return (
                <div style={{
                  padding: '40px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '8px',
                  border: '2px solid #22c55e',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                  <h3 style={{ color: '#15803d', margin: '0 0 8px 0' }}>No Urgent Tasks Right Now!</h3>
                  <p style={{ color: '#166534', margin: 0 }}>
                    Set task priorities to 1-3 with due dates today or earlier to see them here. Max 3 tasks allowed.
                  </p>
                </div>
              );
            }
            
            // Warning if more than 3 tasks qualify
            const qualifyingCount = [...nowTasks, ...nowProjectTasks, ...nowGoalTasks].length;

            return (
              <div className="tasks-table-container" style={{ marginTop: '20px' }}>
                {qualifyingCount > 3 && (
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '14px',
                    color: '#92400e'
                  }}>
                    ⚠️ <strong>{qualifyingCount} tasks</strong> qualify for NOW tab. Showing top 3 by priority and due date.
                  </div>
                )}
                <table className="tasks-table">
                  <thead>
                    <tr>
                      <th className="col-checkbox"></th>
                      <th className="col-task">Task</th>
                      <th className="col-time">Allocated</th>
                      <th className="col-time">Source</th>
                      <th className="col-time">Due Date</th>
                      <th className="col-action">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allNowTasks.map(task => {
                      const taskType = (task as any).project_name ? 'project' : 
                                      (task as any).goal_name ? 'goal' : 'task';
                      
                      return (
                        <tr 
                          key={`now-${taskType}-${task.id}`}
                          style={{ 
                            backgroundColor: task.priority === 1 ? '#fee2e2' : 
                                           task.priority === 2 ? '#fef2f2' : '#fef2f2'
                          }}
                        >
                          <td className="col-checkbox">
                            <input 
                              type="checkbox" 
                              checked={task.is_completed || false}
                              onChange={async (e) => {
                                e.stopPropagation();
                                try {
                                  if (taskType === 'project') {
                                    await api.put(`/api/projects/tasks/${task.id}`, { is_completed: e.target.checked });
                                    await loadProjectTasksDueToday();
                                  } else if (taskType === 'goal') {
                                    await api.put(`/api/life-goals/tasks/${task.id}`, { is_completed: e.target.checked });
                                    await loadGoalTasksDueToday();
                                  } else {
                                    if (e.target.checked) {
                                      await handleComplete(task.id);
                                    } else {
                                      await api.put(`/api/tasks/${task.id}`, { is_completed: false });
                                      await loadTasks();
                                    }
                                  }
                                } catch (err) {
                                  console.error('Error toggling completion:', err);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                            />
                          </td>
                          <td 
                            className="col-task"
                            onClick={(e) => {
                              console.log('Task name clicked:', task.id, taskType, task.name);
                              if (taskType === 'project') {
                                handleEditTask(task);
                              } else if (taskType === 'goal') {
                                // Goal tasks don't have edit form yet, just show info
                                alert(`Goal Task: ${task.name}\nGoal: ${(task as any).goal_name}`);
                              } else {
                                handleTaskClick(task.id);
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div style={{ fontWeight: '600', color: '#1f2937' }}>
                              {task.name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                              {task.pillar && (
                                <span>
                                  {task.pillar === 'hard_work' ? '💼' : task.pillar === 'calmness' ? '🧘' : '👨‍👩‍👦'}{' '}
                                  {task.pillar.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                              )}
                              {task.category && <span> › {task.category}</span>}
                            </div>
                          </td>
                          <td className="col-time" style={{ textAlign: 'center' }}>
                            {task.allocated_minutes ? `${task.allocated_minutes} min` : '-'}
                          </td>
                          <td className="col-time" style={{ textAlign: 'center' }}>
                            {(task as any).project_name && (
                              <span style={{ 
                                fontSize: '12px', 
                                padding: '4px 10px', 
                                backgroundColor: '#dbeafe', 
                                color: '#1e40af', 
                                borderRadius: '12px',
                                fontWeight: '600',
                                display: 'inline-block'
                              }}>📁 {(task as any).project_name}</span>
                            )}
                            {(task as any).goal_name && (
                              <span style={{ 
                                fontSize: '12px', 
                                padding: '4px 10px', 
                                backgroundColor: '#fef3c7', 
                                color: '#92400e', 
                                borderRadius: '12px',
                                fontWeight: '600',
                                display: 'inline-block'
                              }}>🎯 {(task as any).goal_name}</span>
                            )}
                            {!((task as any).project_name) && !((task as any).goal_name) && (
                              <span style={{ 
                                fontSize: '12px', 
                                padding: '4px 10px', 
                                backgroundColor: '#f3f4f6', 
                                color: '#4b5563', 
                                borderRadius: '12px',
                                fontWeight: '600',
                                display: 'inline-block'
                              }}>
                                📋 {task.follow_up_frequency === 'weekly' ? 'Weekly' : 
                                    task.follow_up_frequency === 'monthly' ? 'Monthly' : 
                                    task.follow_up_frequency === 'yearly' ? 'Yearly' : 
                                    task.follow_up_frequency === 'one_time' ? 'One-Time' : 
                                    'Daily'}
                              </span>
                            )}
                          </td>
                          <td className="col-time" style={{ textAlign: 'center' }}>
                            {task.due_date ? (
                              <input 
                                type="date"
                                value={task.due_date ? formatDateForInput(parseDateString(task.due_date)) : ''}
                                onChange={async (e) => {
                                  const newDate = e.target.value;
                                  if (!newDate) return;
                                  try {
                                    if (taskType === 'project') {
                                      await api.put(`/api/projects/tasks/${task.id}`, { due_date: newDate });
                                      await loadProjectTasksDueToday();
                                    } else if (taskType === 'goal') {
                                      await api.put(`/api/life-goals/tasks/${task.id}`, { due_date: newDate });
                                      await loadGoalTasksDueToday();
                                    } else {
                                      await api.put(`/api/tasks/${task.id}`, { due_date: newDate });
                                      await loadTasks();
                                    }
                                  } catch (err) {
                                    console.error('Failed to update due date:', err);
                                    alert('Failed to update due date');
                                  }
                                }}
                                style={{
                                  border: '1px solid #e2e8f0',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  color: parseDateString(task.due_date) < new Date() ? '#dc2626' : '#6b7280',
                                  fontWeight: parseDateString(task.due_date) < new Date() ? '600' : '400'
                                }}
                              />
                            ) : (
                              <input 
                                type="date"
                                value=""
                                onChange={async (e) => {
                                  const newDate = e.target.value;
                                  if (!newDate) return;
                                  try {
                                    if (taskType === 'project') {
                                      await api.put(`/api/projects/tasks/${task.id}`, { due_date: newDate });
                                    } else if (taskType === 'goal') {
                                      await api.put(`/api/life-goals/tasks/${task.id}`, { due_date: newDate });
                                    } else {
                                      await api.put(`/api/tasks/${task.id}`, { due_date: newDate });
                                    }
                                    await loadTasks();
                                  } catch (err) {
                                    console.error('Failed to update due date:', err);
                                    alert('Failed to update due date');
                                  }
                                }}
                                style={{
                                  border: '1px solid #e2e8f0',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '13px'
                                }}
                              />
                            )}
                          </td>
                          <td className="col-action">
                            <button 
                              className="btn btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('Move to Today clicked:', task.id, taskType);
                                handleMoveToToday(task.id, taskType);
                              }}
                              style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                marginRight: '8px'
                              }}
                              title="Move back to Today tab (P4)"
                            >
                              ← Today
                            </button>
                            <button 
                              className="btn-complete"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (taskType === 'project') {
                                  handleToggleTaskCompletion(task.id, false);
                                } else if (taskType === 'goal') {
                                  handleToggleGoalTaskCompletion(task.id, false);
                                } else {
                                  handleComplete(task.id);
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '600'
                              }}
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
            );
          })()}
          
          {/* NOW Habits Section - Always render outside tasks IIFE */}
          {(() => {
            console.log('=== NOW Habits Section Debug ===');
            console.log('nowHabits Set:', nowHabits);
            console.log('nowHabits.size:', nowHabits.size);
            console.log('nowHabits array:', Array.from(nowHabits));
            console.log('localStorage nowHabits:', localStorage.getItem('nowHabits'));
            console.log('todaysHabits:', todaysHabits);
            console.log('todaysHabits.length:', todaysHabits.length);
            console.log('================================');
            
            if (nowHabits.size === 0) {
              console.log('NO NOW HABITS - size is 0');
              return null;
            }
            
            const nowHabitsList = todaysHabits.filter(h => nowHabits.has(h.id));
            console.log('Filtered NOW Habits List:', nowHabitsList);
            if (nowHabitsList.length === 0) {
              console.log('NO HABITS FOUND IN FILTER');
              return null;
            }
                  
            return (
              <div className="tasks-table-container" style={{ marginTop: '24px' }}>
                <h3 style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#1f2937', 
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🎯 NOW Habits
                  <span style={{ fontSize: '14px', fontWeight: '400', color: '#6b7280' }}>
                    ({nowHabitsList.length})
                  </span>
                </h3>
                <table className="tasks-table">
                  <thead>
                    <tr>
                      <th className="col-checkbox"></th>
                      <th className="col-task">Habit</th>
                      <th className="col-time">Target</th>
                      <th className="col-action">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nowHabitsList.map(habit => (
                      <tr 
                        key={habit.id}
                        style={{ 
                          backgroundColor: '#fee2e2'
                        }}
                      >
                        <td className="col-checkbox">
                          <input
                            type="checkbox"
                            checked={habit.completed_today}
                            onChange={async (e) => {
                              e.stopPropagation();
                              try {
                                await api.post(`/api/habits/${habit.id}/mark-today?is_completed=${!habit.completed_today}`);
                                loadTodaysHabits();
                              } catch (err) {
                                console.error('Error toggling habit:', err);
                              }
                            }}
                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                          />
                        </td>
                        <td className="col-task">
                          <div style={{ fontWeight: '600', color: '#1f2937' }}>
                            {habit.name}
                          </div>
                        </td>
                        <td className="col-time">
                          {habit.target_value ? (
                            <span>{habit.target_value} {habit.session_target_unit || 'units'}/day</span>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>-</span>
                          )}
                        </td>
                        <td className="col-action">
                          <button
                            onClick={() => handleMoveHabitToToday(habit.id)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '13px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                            title="Move back to Today section"
                          >
                            ← Today
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

        <TaskForm
          isOpen={isTaskFormOpen}
          taskId={selectedTaskId || undefined}
          onClose={() => setIsTaskFormOpen(false)}
          onSuccess={async () => {
            await loadTasks();
            setIsTaskFormOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="tasks-page">
      <header className="tasks-header">
        <h1 style={{ flex: 1, textAlign: 'center' }}>My Time Manager Web Application</h1>
        <button className="btn btn-primary" onClick={() => setIsTaskFormOpen(true)}>
          ➕ Add Task
        </button>
      </header>

      {/* Tabs */}
      <div className="tasks-tabs">
        {tabs.map(tab => {
          // Get count for this tab
          let badgeCount = 0;
          if (tab.key === 'today') badgeCount = tabCounts.today;
          else if (tab.key === 'weekly') badgeCount = tabCounts.weekly;
          else if (tab.key === 'monthly') badgeCount = tabCounts.monthly;
          else if (tab.key === 'quarterly') badgeCount = tabCounts.quarterly;
          else if (tab.key === 'yearly') badgeCount = tabCounts.yearly;
          
          return (
            <button
              key={tab.key}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
                // Update URL with tab parameter
                const searchParams = new URLSearchParams(location.search);
                searchParams.set('tab', tab.key);
                navigate(`?${searchParams.toString()}`, { replace: true });
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
          );
        })}
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
              // Create date at noon first to avoid DST issues, then set to midnight
              const localDate = new Date(year, month - 1, day, 12, 0, 0, 0);
              localDate.setHours(0, 0, 0, 0);
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
            onClick={() => {
              console.log('🔘 Add Yearly Task button clicked - opening selection modal');
              setShowAddYearlyTaskModal(true);
            }}
            style={{ marginLeft: 'auto', backgroundColor: '#10b981', color: 'white' }}
          >
            ➕ Add Yearly Task
          </button>
          <span className="date-display">
            {selectedYearStart.getFullYear()}
          </span>
        </div>
      )}

      {/* Important Tasks Component */}
      {activeTab === 'onetime' ? (
        <ImportantTasks />
      ) : activeTab === 'projects' ? (
        <div className="projects-container">
          {!selectedProject ? (
            // Projects List View
            <>
              {/* Back to Dream button if coming from wish */}
              {sessionStorage.getItem('fromWishId') && (
                <div style={{ marginBottom: '16px' }}>
                  <button
                    onClick={() => {
                      const wishId = sessionStorage.getItem('fromWishId');
                      const wishName = sessionStorage.getItem('fromWishName');
                      sessionStorage.removeItem('fromWishId');
                      sessionStorage.removeItem('fromWishName');
                      navigate(`/goals?tab=dreams&wishId=${wishId}`);
                    }}
                    style={{
                      padding: '10px 16px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                    }}
                  >
                    ← Back to Dream: {sessionStorage.getItem('fromWishName')}
                  </button>
                </div>
              )}
              {/* Compact Header with Inline Stats */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                padding: '20px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                color: 'white'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>
                      📋 Projects
                    </h1>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                      <span style={{ 
                        background: 'rgba(255,255,255,0.2)', 
                        padding: '4px 12px', 
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        Total: {projects.length}
                      </span>
                      <span style={{ 
                        background: 'rgba(59, 130, 246, 0.3)', 
                        padding: '4px 12px', 
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        In Progress: {projects.filter(p => p.status === 'in_progress' && !p.is_completed && !(p.target_completion_date && new Date(p.target_completion_date) < new Date())).length}
                      </span>
                      <span style={{ 
                        background: 'rgba(168, 85, 247, 0.3)', 
                        padding: '4px 12px', 
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        Not Started: {projects.filter(p => p.status === 'not_started' && !p.is_completed).length}
                      </span>
                      <span style={{ 
                        background: 'rgba(16, 185, 129, 0.3)', 
                        padding: '4px 12px', 
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        Completed: {projects.filter(p => p.is_completed).length}
                      </span>
                      <span style={{ 
                        background: 'rgba(239, 68, 68, 0.3)', 
                        padding: '4px 12px', 
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        Overdue: {projects.filter(p => !p.is_completed && p.target_completion_date && new Date(p.target_completion_date) < new Date()).length}
                      </span>
                    </div>
                  </div>
                  {/* Category breakdown - Removed for now until categories are loaded */}
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setShowAddProjectModal(true)}
                    style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: 'white',
                      fontWeight: '600',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'all 0.2s',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  >
                    ➕ Add Project
                  </button>
                </div>
              </div>

              {projects.length === 0 ? (
                <div className="empty-state">
                  <p>No projects yet. Click "Add Project" to get started.</p>
                </div>
              ) : (
                <>
                  {/* Summary Panel - Project counts by category */}
                  {(() => {
                    // Define hierarchy order (same as Daily/Habits tab)
                    const hierarchyOrder: { [key: string]: number } = {
                      'Hard Work|Office-Tasks': 1,
                      'Hard Work|Learning': 2,
                      'Hard Work|Confidence': 3,
                      'Calmness|Yoga': 4,
                      'Calmness|Sleep': 5,
                      'Family|My Tasks': 6,
                      'Family|Home Tasks': 7,
                      'Family|Time Waste': 8,
                    };

                    // Split active and completed projects
                    const activeProjects = projects.filter(p => !p.is_completed);
                    const completedProjects = projects.filter(p => p.is_completed);

                    // Group active projects by category
                    const projectsByCategory = activeProjects.reduce((acc, project) => {
                      const category = projectCategories.find(c => c.id === project.category_id);
                      const categoryName = category?.name || 'Goal and Dream Projects';
                      if (!acc[categoryName]) {
                        acc[categoryName] = [];
                      }
                      acc[categoryName].push(project);
                      return acc;
                    }, {} as Record<string, ProjectData[]>);

                    // Sort categories by hierarchy order
                    const sortedCategories = Object.keys(projectsByCategory).sort((a, b) => {
                      // Get pillar name from pillar data, not from project
                      const aProject = projectsByCategory[a][0];
                      const bProject = projectsByCategory[b][0];
                      const aPillar = projectPillars.find(p => p.id === aProject?.pillar_id);
                      const bPillar = projectPillars.find(p => p.id === bProject?.pillar_id);
                      const aPillarName = aPillar?.name || '';
                      const bPillarName = bPillar?.name || '';
                      const keyA = `${aPillarName}|${a}`;
                      const keyB = `${bPillarName}|${b}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      return orderA - orderB;
                    });

                    return (
                      <div style={{ 
                        marginBottom: '24px',
                        padding: '16px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}>
                        <div style={{ 
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}>
                          {sortedCategories.map(categoryName => {
                            const categoryProjects = projectsByCategory[categoryName];
                            // Get pillar name from pillar data
                            const pillar = projectPillars.find(p => p.id === categoryProjects[0]?.pillar_id);
                            const pillarName = pillar?.name || 'Unknown';
                            const completedCount = categoryProjects.filter(p => p.is_completed).length;
                            const inProgressCount = categoryProjects.filter(p => p.status === 'in_progress' && !p.is_completed).length;
                            
                            let pillarColor = '#718096';
                            let pillarIcon = '📋';
                            
                            if (pillarName === 'Hard Work') {
                              pillarColor = '#2563eb';
                              pillarIcon = '💼';
                            } else if (pillarName === 'Calmness') {
                              pillarColor = '#16a34a';
                              pillarIcon = '🧘';
                            } else if (pillarName === 'Family') {
                              pillarColor = '#9333ea';
                              pillarIcon = '👨‍👩‍👦';
                            }

                            return (
                              <div 
                                key={categoryName}
                                style={{
                                  padding: '10px 16px',
                                  backgroundColor: 'rgba(255,255,255,0.95)',
                                  borderRadius: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                              >
                                <span style={{ fontSize: '18px' }}>{pillarIcon}</span>
                                <div>
                                  <div style={{ 
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: pillarColor
                                  }}>
                                    {categoryName}
                                  </div>
                                  <div style={{ 
                                    fontSize: '12px',
                                    color: '#666'
                                  }}>
                                    {categoryProjects.length} project{categoryProjects.length !== 1 ? 's' : ''}
                                    {inProgressCount > 0 && (
                                      <span style={{ 
                                        marginLeft: '4px',
                                        color: '#3b82f6',
                                        fontWeight: '600'
                                      }}>
                                        • {inProgressCount} 🔄
                                      </span>
                                    )}
                                    {completedCount > 0 && (
                                      <span style={{ 
                                        marginLeft: '4px',
                                        color: '#10b981',
                                        fontWeight: '600'
                                      }}>
                                        • {completedCount} ✅
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div 
                            style={{
                              padding: '10px 16px',
                              backgroundColor: 'rgba(255,255,255,0.95)',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              border: '2px solid #48bb78'
                            }}
                          >
                            <span style={{ fontSize: '18px' }}>📊</span>
                            <div>
                              <div style={{ 
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#2d3748'
                              }}>
                                Total Projects
                              </div>
                              <div style={{ 
                                fontSize: '20px',
                                fontWeight: '700',
                                color: '#48bb78',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                {projects.length}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Category-Based Sections (Collapsible) */}
                  {(() => {
                    // Define hierarchy order (same as Daily/Habits tab)
                    const hierarchyOrder: { [key: string]: number } = {
                      'Hard Work|Office-Tasks': 1,
                      'Hard Work|Learning': 2,
                      'Hard Work|Confidence': 3,
                      'Calmness|Yoga': 4,
                      'Calmness|Sleep': 5,
                      'Family|My Tasks': 6,
                      'Family|Home Tasks': 7,
                      'Family|Time Waste': 8,
                    };

                    // Helper function to render a project card
                    const renderProjectCard = (project: ProjectData) => {
                      const hasOverdue = hasOverdueTasks(project.id);
                      const cardClass = getProjectCardClass(project);
                      
                      return (
                        <div 
                          key={project.id} 
                          className={`project-card ${cardClass} ${hasOverdue ? 'project-has-overdue' : ''} ${project.is_completed ? 'status-completed' : ''}`}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('button, input')) return;
                            handleSelectProject(project);
                          }}
                          style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 24px', minHeight: '110px' }}
                        >
                          {/* Top Row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {/* Left: Icon & Title */}
                            <div style={{ display: 'flex', gap: '12px', minWidth: '280px', maxWidth: '280px', alignItems: 'center' }}>
                              <span style={{ fontSize: '32px', lineHeight: 1 }}>📊</span>
                              <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#2d3748', lineHeight: 1.3 }}>{project.name}</h3>
                                <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>
                                  {project.is_completed ? '✅ Completed' : 
                                   (!project.target_completion_date || new Date(project.target_completion_date) >= new Date()) ? 
                                   '▶️ ' + project.status.replace('_', ' ') : '🚨 Overdue'}
                                </div>
                              </div>
                            </div>

                            {/* Center: Circular Progress (Tasks & Milestones side by side) */}
                            <div style={{ flex: 1, display: 'flex', gap: '32px', alignItems: 'center', justifyContent: 'flex-start' }}>
                              {/* Task Progress Circle */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '13px', color: '#4a5568', fontWeight: '500' }}>📋 Tasks</span>
                                  <span style={{ fontSize: '16px', color: '#2d3748', fontWeight: '700' }}>{project.progress.completed_tasks}/{project.progress.total_tasks}</span>
                                </div>
                                <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                                  <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                                  <circle 
                                    cx="40" 
                                    cy="40" 
                                    r="32" 
                                    fill="none" 
                                    stroke="#10b981" 
                                    strokeWidth="8"
                                    strokeDasharray={`${2 * Math.PI * 32}`}
                                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - project.progress.progress_percentage / 100)}`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.3s' }}
                                  />
                                </svg>
                              </div>
                              {/* Milestone Progress Circle */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '13px', color: '#4a5568', fontWeight: '500' }}>🎯 Milestones</span>
                                  <span style={{ fontSize: '16px', color: '#2d3748', fontWeight: '700' }}>
                                    {project.milestone_progress ? `${project.milestone_progress.completed_milestones}/${project.milestone_progress.total_milestones}` : '0/0'}
                                  </span>
                                </div>
                                <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                                  <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                                  <circle 
                                    cx="40" 
                                    cy="40" 
                                    r="32" 
                                    fill="none" 
                                    stroke="#3b82f6" 
                                    strokeWidth="8"
                                    strokeDasharray={`${2 * Math.PI * 32}`}
                                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - (project.milestone_progress && project.milestone_progress.total_milestones > 0 ? (project.milestone_progress.completed_milestones / project.milestone_progress.total_milestones) * 100 : 0) / 100)}`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.3s' }}
                                  />
                                </svg>
                              </div>
                            </div>

                            {/* Right: Dates & Days Left */}
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <div style={{ fontSize: '12px' }}>
                                <div style={{ marginBottom: '8px' }}>
                                  <label style={{ display: 'block', color: '#718096', marginBottom: '2px', fontSize: '11px' }}>Start</label>
                                  <input
                                    type="date"
                                    value={project.start_date || ''}
                                    onChange={(e) => { e.stopPropagation(); handleUpdateProject(project.id, { start_date: e.target.value }); }}
                                    style={{ padding: '4px 8px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '11px', width: '120px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', color: '#718096', marginBottom: '2px', fontSize: '11px' }}>Target End</label>
                                  <input
                                    type="date"
                                    value={project.target_completion_date || ''}
                                    onChange={(e) => { e.stopPropagation(); handleUpdateProject(project.id, { target_completion_date: e.target.value }); }}
                                    style={{ padding: '4px 8px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '11px', width: '120px' }}
                                  />
                                </div>
                              </div>
                              {!project.is_completed && project.target_completion_date && (() => {
                                const daysLeft = Math.ceil((new Date(project.target_completion_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                const isOverdue = daysLeft < 0;
                                return (
                                  <div style={{ textAlign: 'center', padding: '12px 16px', backgroundColor: isOverdue ? '#fee2e2' : '#dbeafe', borderRadius: '8px', minWidth: '85px' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700', color: isOverdue ? '#dc2626' : '#2563eb', lineHeight: 1 }}>{Math.abs(daysLeft)}</div>
                                    <div style={{ fontSize: '10px', color: '#718096', textTransform: 'uppercase', marginTop: '4px' }}>{isOverdue ? 'overdue' : 'days left'}</div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Bottom Row: Stats & Next Milestone */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e5e3d0' }}>
                            {/* Left: Quick Stats */}
                            <div style={{ display: 'flex', gap: '24px', fontSize: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '14px' }}>⏳</span>
                                <span style={{ color: '#718096' }}>Active Tasks:</span>
                                <span style={{ fontWeight: '600', color: '#2d3748' }}>{project.progress.total_tasks - project.progress.completed_tasks}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '14px' }}>✅</span>
                                <span style={{ color: '#718096' }}>Completed:</span>
                                <span style={{ fontWeight: '600', color: '#10b981' }}>{project.progress.completed_tasks}</span>
                              </div>
                              {(() => {
                                const nextMilestone = project.milestones?.filter(m => !m.is_completed).sort((a, b) => parseDateString(a.target_date).getTime() - parseDateString(b.target_date).getTime())[0];
                                if (nextMilestone) {
                                  const milestoneDate = parseDateString(nextMilestone.target_date);
                                  const milestoneDaysLeft = Math.ceil((milestoneDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                  const isOverdue = milestoneDaysLeft < 0;
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '14px' }}>🎯</span>
                                      <span style={{ color: '#718096' }}>Next Milestone:</span>
                                      <span style={{ fontWeight: '600', color: isOverdue ? '#dc2626' : '#3b82f6', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nextMilestone.name}>
                                        {nextMilestone.name} ({Math.abs(milestoneDaysLeft)}d {isOverdue ? 'overdue' : 'left'})
                                      </span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>

                            {/* Right: Action Buttons */}
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button 
                                className="btn btn-primary"
                                onClick={(e) => { e.stopPropagation(); handleSelectProject(project); }}
                                style={{ padding: '8px 14px', fontSize: '13px', minWidth: '100px' }}
                              >
                                👁️ View
                              </button>
                              <button 
                                className="btn btn-secondary"
                                onClick={(e) => { e.stopPropagation(); setEditingProject(project); setShowAddProjectModal(true); }}
                                title="Edit Project"
                                style={{ padding: '8px 14px', fontSize: '13px', minWidth: '100px' }}
                              >
                                ✏️ Edit
                              </button>
                              <button 
                                className="btn btn-info"
                                onClick={(e) => { e.stopPropagation(); handleDuplicateProject(project.id); }}
                                title="Duplicate"
                                style={{ padding: '8px 14px', fontSize: '13px', minWidth: '100px' }}
                              >
                                📋 Duplicate
                              </button>
                              <button 
                                className="btn btn-danger"
                                onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                                style={{ padding: '8px 14px', fontSize: '13px', minWidth: '100px' }}
                              >
                                🗑️ Delete
                              </button>
                              {(!project.is_completed && project.progress.pending_tasks === 0 && project.progress.total_tasks > 0) && (
                                <button 
                                  className="btn btn-success"
                                  onClick={(e) => { e.stopPropagation(); handleToggleProjectComplete(project.id, true); }}
                                  title="Complete"
                                  style={{ padding: '8px 14px', fontSize: '13px', minWidth: '100px' }}
                                >
                                  ✓ Complete
                                </button>
                              )}
                              {project.is_completed && (
                                <button 
                                  className="btn btn-warning"
                                  onClick={(e) => { e.stopPropagation(); handleToggleProjectComplete(project.id, false); }}
                                  title="Reopen"
                                  style={{ padding: '8px 14px', fontSize: '13px', minWidth: '100px' }}
                                >
                                  ↺ Reopen
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    };

                    // Group active projects by category (exclude completed)
                    const activeProjects = projects.filter(p => !p.is_completed);
                    const completedProjects = projects.filter(p => p.is_completed);
                    
                    const projectsByCategory = activeProjects.reduce((acc, project) => {
                      const category = projectCategories.find(c => c.id === project.category_id);
                      const categoryName = category?.name || 'Goal and Dream Projects';
                      if (!acc[categoryName]) {
                        acc[categoryName] = [];
                      }
                      acc[categoryName].push(project);
                      return acc;
                    }, {} as Record<string, ProjectData[]>);

                    // Sort categories by hierarchy order
                    const sortedCategories = Object.keys(projectsByCategory).sort((a, b) => {
                      // Get pillar name from pillar data, not from project
                      const aProject = projectsByCategory[a][0];
                      const bProject = projectsByCategory[b][0];
                      const aPillar = projectPillars.find(p => p.id === aProject?.pillar_id);
                      const bPillar = projectPillars.find(p => p.id === bProject?.pillar_id);
                      const aPillarName = aPillar?.name || '';
                      const bPillarName = bPillar?.name || '';
                      const keyA = `${aPillarName}|${a}`;
                      const keyB = `${bPillarName}|${b}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      return orderA - orderB;
                    });

                    // Render active projects by category
                    const activeCategories = sortedCategories.map(categoryName => {
                      const categoryProjects = projectsByCategory[categoryName];
                      // Get pillar name from pillar data
                      const pillar = projectPillars.find(p => p.id === categoryProjects[0]?.pillar_id);
                      const pillarName = pillar?.name || 'Unknown';
                      const categoryKey = `${pillarName}|${categoryName}`;
                      // Default to collapsed (true) if not in state
                      const isCollapsed = collapsedProjectSections[categoryKey] !== false;
                      const isExpanded = !isCollapsed;
                      
                      let pillarColor = '#718096';
                      let pillarIcon = '📋';
                      
                      if (pillarName === 'Hard Work') {
                        pillarColor = '#2563eb';
                        pillarIcon = '💼';
                      } else if (pillarName === 'Calmness') {
                        pillarColor = '#16a34a';
                        pillarIcon = '🧘';
                      } else if (pillarName === 'Family') {
                        pillarColor = '#9333ea';
                        pillarIcon = '👨‍👩‍👦';
                      }

                      return (
                        <div key={categoryKey} style={{ marginBottom: '24px' }}>
                          <div 
                            onClick={() => {
                              const newState = { ...collapsedProjectSections, [categoryKey]: !isCollapsed };
                              setCollapsedProjectSections(newState);
                              localStorage.setItem('collapsedProjectSections', JSON.stringify(newState));
                            }}
                            style={{ 
                              fontSize: '18px', 
                              fontWeight: '600', 
                              color: pillarColor, 
                              marginBottom: isExpanded ? '15px' : '0', 
                              paddingBottom: '8px', 
                              borderBottom: isExpanded ? `2px solid ${pillarColor}` : 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '12px 16px',
                              background: isExpanded ? 'transparent' : '#f7fafc',
                              borderRadius: '8px',
                              transition: 'all 0.2s',
                              boxShadow: isExpanded ? 'none' : '0 1px 3px rgba(0,0,0,0.1)'
                            }}
                          >
                            <span title={`${pillarName} - ${categoryName}`}>
                              {isExpanded ? '▼' : '▶'} {pillarIcon} {categoryName} ({categoryProjects.length})
                            </span>
                            <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }} title={`${pillarName} - ${categoryName}`}>
                              {pillarName}
                            </span>
                          </div>
                          
                          {isExpanded && (
                            <div className="projects-grid">
                              {categoryProjects.map(project => renderProjectCard(project))}
                            </div>
                          )}
                        </div>
                      );
                    });

                    // Add Completed Projects section
                    return (
                      <>
                        {activeCategories}
                        
                        {/* Completed Projects Section */}
                        {completedProjects.length > 0 && (
                          <div style={{ marginTop: '48px', marginBottom: '24px' }}>
                            <div 
                              onClick={() => {
                                const isCompletedCollapsed = collapsedProjectSections['completed'] !== false;
                                const newState = { ...collapsedProjectSections, ['completed']: !isCompletedCollapsed };
                                setCollapsedProjectSections(newState);
                                localStorage.setItem('collapsedProjectSections', JSON.stringify(newState));
                              }}
                              style={{ 
                                fontSize: '18px', 
                                fontWeight: '600', 
                                color: '#10b981', 
                                marginBottom: collapsedProjectSections['completed'] === false ? '15px' : '0', 
                                paddingBottom: '8px', 
                                borderBottom: collapsedProjectSections['completed'] === false ? '2px solid #10b981' : 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                background: collapsedProjectSections['completed'] === false ? 'transparent' : '#f0fdf4',
                                borderRadius: '8px',
                                transition: 'all 0.2s',
                                boxShadow: collapsedProjectSections['completed'] === false ? 'none' : '0 1px 3px rgba(0,0,0,0.1)'
                              }}
                            >
                              <span>
                                {collapsedProjectSections['completed'] === false ? '▼' : '▶'} ✅ Completed Projects ({completedProjects.length})
                              </span>
                            </div>
                            
                            {collapsedProjectSections['completed'] === false && (
                              <div className="projects-grid">
                                {completedProjects.map(project => renderProjectCard(project))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </>
          ) : selectedProject ? (
            // Project Detail View with Tasks
            <>
              <div className="project-detail-header" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '20px',
                padding: '20px',
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                borderRadius: '12px',
                border: '2px solid #0ea5e9',
                marginBottom: '20px'
              }}>
                <div style={{ minWidth: 'fit-content' }}>
                  <h2 style={{ 
                    color: '#0c4a6e',
                    fontSize: '24px',
                    fontWeight: '700',
                    margin: 0
                  }}>{selectedProject.name}</h2>
                  
                  {/* Dream Link - if coming from wish */}
                  {sessionStorage.getItem('fromWishId') && (
                    <button
                      onClick={() => {
                        const wishId = sessionStorage.getItem('fromWishId');
                        const wishName = sessionStorage.getItem('fromWishName');
                        // Clear sessionStorage to avoid showing on other projects
                        sessionStorage.removeItem('fromWishId');
                        sessionStorage.removeItem('fromWishName');
                        // Navigate to dream detail page (tab=wishes not tab=dreams)
                        navigate(`/goals?tab=wishes&wishId=${wishId}`);
                      }}
                      style={{
                        marginTop: '6px',
                        padding: '6px 12px',
                        fontSize: '13px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        border: 'none',
                        color: 'white',
                        fontWeight: '600',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      ✨ Dream: {sessionStorage.getItem('fromWishName') || 'Unknown'}
                    </button>
                  )}
                  
                  {selectedProject.goal_id && (() => {
                    const linkedGoal = lifeGoals.find(g => g.id === selectedProject.goal_id);
                    return linkedGoal && (
                      <div style={{ 
                        marginTop: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ fontSize: '13px', color: '#667eea', fontWeight: '600' }}>🎯 Goal: {linkedGoal.name}</span>
                        <button
                          className="btn btn-primary"
                          onClick={() => navigate(`/goals?goal=${linkedGoal.id}`)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            color: 'white',
                            fontWeight: '600',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            boxShadow: '0 1px 4px rgba(102, 126, 234, 0.4)'
                          }}
                        >
                          View Goal →
                        </button>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Project Overview Stats - Inline */}
                {(() => {
                  const thisProjectTasks = projectTasks.filter(t => t.project_id === selectedProject.id);
                  const completedTasks = thisProjectTasks.filter(t => t.is_completed).length;
                  const inProgressTasks = thisProjectTasks.filter(t => !t.is_completed).length;
                  const rootTasks = thisProjectTasks.filter(t => !t.parent_task_id).length;
                  const subTasks = thisProjectTasks.filter(t => t.parent_task_id).length;
                  
                  return (
                    <div style={{ 
                      flex: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '20px',
                      justifyContent: 'center',
                      paddingLeft: '20px',
                      paddingRight: '20px'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>Total Tasks (All Levels)</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a' }}>
                          {thisProjectTasks.length}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>Completed</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>
                          {completedTasks}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>In Progress</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>
                          {inProgressTasks}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>Root Tasks</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#8b5cf6' }}>
                          {rootTasks}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>Sub-tasks</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f97316' }}>
                          {subTasks}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <button 
                  className="btn btn-secondary" 
                  onClick={handleBackToProjects}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                    border: 'none',
                    color: 'white',
                    fontWeight: '600',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    minWidth: 'fit-content',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ← Back to Projects
                </button>
              </div>

              {/* All Tasks Section */}
              <div className="project-all-tasks-section" style={{ marginBottom: '30px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '15px',
                  borderBottom: '2px solid #3182ce',
                  paddingBottom: '10px'
                }}>
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}
                    onClick={() => setExpandedSections(prev => ({ ...prev, allTasks: !prev.allTasks }))}
                  >
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: '22px', 
                      fontWeight: '700',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}>
                      {expandedSections.allTasks ? '▼' : '▶'} 📋 All Tasks
                    </h3>
                    <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>
                      {(() => {
                        const thisProjectTasks = projectTasks.filter(t => t.project_id === selectedProject.id);
                        return `${thisProjectTasks.filter(t => t.is_completed).length} / ${thisProjectTasks.length} completed`;
                      })()}
                    </span>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddTaskModal(true);
                    }}
                    style={{ fontSize: '14px', padding: '8px 16px' }}
                  >
                    ➕ Add Project Task
                  </button>
                </div>

                {/* Filter Buttons */}
                {expandedSections.allTasks && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '10px', 
                    marginBottom: '15px',
                    flexWrap: 'wrap',
                    padding: '10px',
                    background: '#f8f9fa',
                    borderRadius: '6px'
                  }}>
                    {(() => {
                      // Helper function to get all tasks including subtasks recursively
                      const getAllTasksRecursive = (taskList: ProjectTaskData[]): ProjectTaskData[] => {
                        const result: ProjectTaskData[] = [];
                        const addTaskAndChildren = (task: ProjectTaskData) => {
                          result.push(task);
                          const children = taskList.filter(t => t.parent_task_id === task.id);
                          children.forEach(child => addTaskAndChildren(child));
                        }
                        taskList.filter(t => !t.parent_task_id).forEach(root => addTaskAndChildren(root));
                        return result;
                      }
                      
                      const thisProjectTasks = projectTasks.filter(t => t.project_id === selectedProject.id);
                      const allTasksRecursive = getAllTasksRecursive(thisProjectTasks);
                      const totalCount = allTasksRecursive.length;
                      const inProgressCount = allTasksRecursive.filter(t => !t.is_completed).length;
                      const completedCount = allTasksRecursive.filter(t => t.is_completed).length;
                      const noMilestoneCount = allTasksRecursive.filter(t => !t.milestone_id).length;
                      
                      return (
                        <>
                          <button
                            className={`btn ${projectTaskFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setProjectTaskFilter('all')}
                            style={{ fontSize: '13px', padding: '6px 12px' }}
                          >
                            👁️ Show All ({totalCount})
                          </button>
                          <button
                            className={`btn ${projectTaskFilter === 'in-progress' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setProjectTaskFilter('in-progress')}
                            style={{ fontSize: '13px', padding: '6px 12px' }}
                          >
                            🔵 In Progress ({inProgressCount})
                          </button>
                          <button
                            className={`btn ${projectTaskFilter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setProjectTaskFilter('completed')}
                            style={{ fontSize: '13px', padding: '6px 12px' }}
                          >
                            ✅ Completed ({completedCount})
                          </button>
                          <button
                            className={`btn ${projectTaskFilter === 'no-milestone' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setProjectTaskFilter('no-milestone')}
                            style={{ fontSize: '13px', padding: '6px 12px' }}
                          >
                            🎯 No Milestone ({noMilestoneCount})
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
                
                {expandedSections.allTasks && (
                  <div className="project-tasks-tree">
                    {!projectTasks || projectTasks.length === 0 ? (
                      <div className="empty-state">
                        <p>No tasks yet. Click "Add Project Task" to get started.</p>
                      </div>
                    ) : (
                      <div className="task-list">
                        {(() => {
                          const thisProjectTasks = projectTasks.filter(t => t.project_id === selectedProject.id);
                          
                          // Helper to check if all children are completed
                          const allChildrenCompleted = (taskId: number): boolean => {
                            const children = thisProjectTasks.filter(t => t.parent_task_id === taskId);
                            if (children.length === 0) return true;
                            return children.every(child => child.is_completed && allChildrenCompleted(child.id));
                          };
                          
                          // Helper to check if task should be hidden (completed with all children completed)
                          const shouldHideTask = (task: ProjectTaskData): boolean => {
                            return task.is_completed && allChildrenCompleted(task.id);
                          };
                          
                          // Helper to check if task or any descendant matches filter
                          const taskMatchesFilter = (task: ProjectTaskData, filter: string): boolean => {
                            if (filter === 'all') return true;
                            if (filter === 'in-progress') return !task.is_completed;
                            if (filter === 'completed') return task.is_completed;
                            if (filter === 'no-milestone') return !task.milestone_id;
                            return true;
                          }
                          
                          const hasMatchingDescendant = (taskId: number, filter: string): boolean => {
                            const children = thisProjectTasks.filter(t => t.parent_task_id === taskId);
                            return children.some(child => 
                              taskMatchesFilter(child, filter) || hasMatchingDescendant(child.id, filter)
                            );
                          }
                          
                          // Get root tasks for this project, excluding fully completed hierarchies
                          let rootTasks = getTasksByParentId(null)
                            .filter(task => task.project_id === selectedProject.id)
                            .filter(task => !shouldHideTask(task));
                          
                          // Apply filter - show root if it matches OR if any descendant matches
                          if (projectTaskFilter !== 'all') {
                            rootTasks = rootTasks.filter(task => 
                              taskMatchesFilter(task, projectTaskFilter) || 
                              hasMatchingDescendant(task.id, projectTaskFilter)
                            );
                          }
                          
                          if (rootTasks.length === 0) {
                            return <div className="empty-state"><p>No active tasks. All tasks are completed!</p></div>;
                          }
                          
                          return rootTasks.map((task) => (
                            <TaskNode 
                              key={task.id} 
                              task={task} 
                              level={0}
                              allTasks={thisProjectTasks}
                              expandedTasks={expandedTasks}
                              onToggleExpand={toggleTaskExpansion}
                              onToggleComplete={(taskId, currentStatus) => handleToggleTaskCompletion(taskId, currentStatus, 'project')}
                              onDelete={handleDeleteTask}
                              onEdit={handleEditTask}
                              onUpdateDueDate={handleUpdateTaskDueDate}
                              getDueDateColorClass={getDueDateColorClass}
                              getTasksByParentId={getTasksByParentId}
                              projectTaskFilter={projectTaskFilter}
                            />
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Linked Tasks (Important/Misc) Section - Hidden until feature is implemented */}
              {false && (
              <div className="project-linked-tasks-section" style={{ marginBottom: '30px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '15px',
                  cursor: 'pointer' 
                }}
                  onClick={() => setExpandedSections(prev => ({ ...prev, linkedTasks: !prev.linkedTasks }))}
                >
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '22px', 
                    fontWeight: '700',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    {expandedSections.linkedTasks ? '▼' : '▶'} 📋 Linked Important/Misc Tasks
                  </h3>
                </div>
                
                {expandedSections.linkedTasks && (
                  <div style={{ padding: '15px', background: '#fef3c7', borderRadius: '8px', border: '2px solid #f59e0b' }}>
                    <p style={{ fontSize: '13px', color: '#92400e', fontStyle: 'italic', marginBottom: '12px' }}>
                      Important and Misc tasks linked to this project will appear here once the linking feature is implemented.
                    </p>
                  </div>
                )}
              </div>
              )}

              {/* Tasks by Frequency Section - NEW */}
              {(() => {
                const thisProjectTasks = projectTasks.filter(t => t.project_id === selectedProject.id);
                const activeTasks = thisProjectTasks.filter(t => {
                  if (t.is_completed) return false;
                  const dailyStatus = dailyStatuses.get(t.id);
                  if (dailyStatus && dailyStatus.is_completed) return false;
                  return true;
                });
                const hasFrequencyTasks = activeTasks.some(t => 
                  ['project_task', 'daily', 'weekly', 'monthly', 'yearly', 'one_time'].includes(t.follow_up_frequency || '')
                );
                
                if (!hasFrequencyTasks) return null;
                
                return (
              <div className="project-frequency-tasks-section" style={{ marginTop: '30px', marginBottom: '30px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '15px',
                  cursor: 'pointer' 
                }}
                  onClick={() => setExpandedSections(prev => ({ ...prev, frequencyTasks: !prev.frequencyTasks }))}
                >
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '22px', 
                    fontWeight: '700',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    {expandedSections.frequencyTasks ? '▼' : '▶'} 📅 Tasks by Frequency
                  </h3>
                </div>
                
                {expandedSections.frequencyTasks && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    {(() => {
                      const thisProjectTasks = projectTasks.filter(t => t.project_id === selectedProject.id);
                      
                      // Separate active and completed tasks
                      // Check both global completion AND daily status completion
                      const activeTasks = thisProjectTasks.filter(t => {
                        if (t.is_completed) return false; // Globally completed
                        const dailyStatus = dailyStatuses.get(t.id);
                        if (dailyStatus && dailyStatus.is_completed) return false; // Completed today
                        return true;
                      });
                      const completedTasks = thisProjectTasks.filter(t => {
                        if (t.is_completed) return true; // Globally completed
                        const dailyStatus = dailyStatuses.get(t.id);
                        if (dailyStatus && dailyStatus.is_completed) return true; // Completed today
                        return false;
                      });
                      
                      // Filter active tasks by frequency
                      const projectTasksFreq = activeTasks.filter(t => t.follow_up_frequency === 'project_task');
                      const dailyTasks = activeTasks.filter(t => t.follow_up_frequency === 'daily');
                      const weeklyTasks = activeTasks.filter(t => t.follow_up_frequency === 'weekly');
                      const monthlyTasks = activeTasks.filter(t => t.follow_up_frequency === 'monthly');
                      const yearlyTasks = activeTasks.filter(t => t.follow_up_frequency === 'yearly');
                      const oneTimeTasks = activeTasks.filter(t => t.follow_up_frequency === 'one_time');
                      
                      return (
                        <>
                          {/* Project Tasks */}
                          {projectTasksFreq.length > 0 && (
                            <div style={{ 
                              padding: '15px', 
                              background: '#f0f7ff', 
                              borderRadius: '8px',
                              border: '2px solid #4299e1' 
                            }}>
                              <h4 style={{ margin: '0 0 10px 0', color: '#2c5282' }}>
                                📁 Project Tasks ({projectTasksFreq.length})
                              </h4>
                              <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                                Shows only in Projects tab
                              </div>
                              {projectTasksFreq.map(task => (
                                <div key={task.id} style={{ 
                                  padding: '8px', 
                                  marginBottom: '6px', 
                                  background: 'white', 
                                  borderRadius: '4px',
                                  borderLeft: task.is_completed ? '3px solid #48bb78' : '3px solid #4299e1'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {task.is_completed ? '✅' : '⏳'}
                                    <span style={{ 
                                      fontSize: '13px',
                                      textDecoration: task.is_completed ? 'line-through' : 'none',
                                      color: task.is_completed ? '#666' : '#333'
                                    }}>
                                      {task.name}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Daily Support Tasks */}
                          {dailyTasks.length > 0 && (
                            <div style={{ 
                              padding: '15px', 
                              background: '#f0fff4', 
                              borderRadius: '8px',
                              border: '2px solid #48bb78' 
                            }}>
                              <h4 style={{ margin: '0 0 10px 0', color: '#22543d' }}>
                                📆 Daily Support ({dailyTasks.length})
                              </h4>
                              <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Daily tasks supporting this project</span>
                                <span>{dailyTasks.filter(t => t.is_completed).length}/{dailyTasks.length} completed</span>
                              </div>
                              {dailyTasks.map(task => (
                                <div key={task.id} style={{ 
                                  padding: '10px', 
                                  marginBottom: '8px', 
                                  background: 'white', 
                                  borderRadius: '4px',
                                  borderLeft: task.is_completed ? '3px solid #48bb78' : '3px solid #38a169'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    {task.is_completed ? '✅' : '🔄'}
                                    <span style={{ 
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      textDecoration: task.is_completed ? 'line-through' : 'none',
                                      color: task.is_completed ? '#666' : '#333',
                                      flex: 1
                                    }}>
                                      {task.name}
                                    </span>
                                    {task.allocated_minutes > 0 && (
                                      <span style={{ fontSize: '11px', color: '#666', background: '#e6fffa', padding: '2px 6px', borderRadius: '4px' }}>
                                        {task.allocated_minutes}m
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#718096', marginTop: '4px' }}>
                                    Created: {task.created_at ? new Date(task.created_at).toLocaleDateString() : 'N/A'}
                                    {task.is_completed && task.completed_at && (
                                      <> • Completed: {new Date(task.completed_at).toLocaleDateString()}</>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Weekly Support Tasks */}
                          {weeklyTasks.length > 0 && (
                            <div style={{ 
                              padding: '15px', 
                              background: '#fffaf0', 
                              borderRadius: '8px',
                              border: '2px solid #ed8936' 
                            }}>
                              <h4 style={{ margin: '0 0 10px 0', color: '#7c2d12' }}>
                                📅 Weekly Support ({weeklyTasks.length})
                              </h4>
                              <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Weekly tasks supporting this project</span>
                                <span>{weeklyTasks.filter(t => t.is_completed).length}/{weeklyTasks.length} completed</span>
                              </div>
                              {weeklyTasks.map(task => (
                                <div key={task.id} style={{ 
                                  padding: '8px', 
                                  marginBottom: '6px', 
                                  background: 'white', 
                                  borderRadius: '4px',
                                  borderLeft: task.is_completed ? '3px solid #f6ad55' : '3px solid #ed8936'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    {task.is_completed ? '✅' : '🔄'}
                                    <span style={{ 
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      textDecoration: task.is_completed ? 'line-through' : 'none',
                                      color: task.is_completed ? '#666' : '#333',
                                      flex: 1
                                    }}>
                                      {task.name}
                                    </span>
                                    {task.allocated_minutes > 0 && (
                                      <span style={{ fontSize: '11px', color: '#666', background: '#fffaf0', padding: '2px 6px', borderRadius: '4px' }}>
                                        {task.allocated_minutes}m
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#718096', marginTop: '4px' }}>
                                    Created: {task.created_at ? new Date(task.created_at).toLocaleDateString() : 'N/A'}
                                    {task.is_completed && task.completed_at && (
                                      <> • Completed: {new Date(task.completed_at).toLocaleDateString()}</>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Monthly Support Tasks */}
                          {monthlyTasks.length > 0 && (
                            <div style={{ 
                              padding: '15px', 
                              background: '#faf5ff', 
                              borderRadius: '8px',
                              border: '2px solid #9f7aea' 
                            }}>
                              <h4 style={{ margin: '0 0 10px 0', color: '#44337a' }}>
                                📅 Monthly Support ({monthlyTasks.length})
                              </h4>
                              <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Monthly tasks supporting this project</span>
                                <span>{monthlyTasks.filter(t => t.is_completed).length}/{monthlyTasks.length} completed</span>
                              </div>
                              {monthlyTasks.map(task => (
                                <div key={task.id} style={{ 
                                  padding: '8px', 
                                  marginBottom: '6px', 
                                  background: 'white', 
                                  borderRadius: '4px',
                                  borderLeft: task.is_completed ? '3px solid #b794f4' : '3px solid #9f7aea'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    {task.is_completed ? '✅' : '🔄'}
                                    <span style={{ 
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      textDecoration: task.is_completed ? 'line-through' : 'none',
                                      color: task.is_completed ? '#666' : '#333',
                                      flex: 1
                                    }}>
                                      {task.name}
                                    </span>
                                    {task.allocated_minutes > 0 && (
                                      <span style={{ fontSize: '11px', color: '#666', background: '#faf5ff', padding: '2px 6px', borderRadius: '4px' }}>
                                        {task.allocated_minutes}m
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#718096', marginTop: '4px' }}>
                                    Created: {task.created_at ? new Date(task.created_at).toLocaleDateString() : 'N/A'}
                                    {task.is_completed && task.completed_at && (
                                      <> • Completed: {new Date(task.completed_at).toLocaleDateString()}</>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Yearly Support Tasks */}
                          {yearlyTasks.length > 0 && (
                            <div style={{ 
                              padding: '15px', 
                              background: '#fff5f5', 
                              borderRadius: '8px',
                              border: '2px solid #fc8181' 
                            }}>
                              <h4 style={{ margin: '0 0 10px 0', color: '#742a2a' }}>
                                📅 Yearly Support ({yearlyTasks.length})
                              </h4>
                              <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Yearly tasks supporting this project</span>
                                <span>{yearlyTasks.filter(t => t.is_completed).length}/{yearlyTasks.length} completed</span>
                              </div>
                              {yearlyTasks.map(task => (
                                <div key={task.id} style={{ 
                                  padding: '8px', 
                                  marginBottom: '6px', 
                                  background: 'white', 
                                  borderRadius: '4px',
                                  borderLeft: task.is_completed ? '3px solid #feb2b2' : '3px solid #fc8181'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    {task.is_completed ? '✅' : '🔄'}
                                    <span style={{ 
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      textDecoration: task.is_completed ? 'line-through' : 'none',
                                      color: task.is_completed ? '#666' : '#333',
                                      flex: 1
                                    }}>
                                      {task.name}
                                    </span>
                                    {task.allocated_minutes > 0 && (
                                      <span style={{ fontSize: '11px', color: '#666', background: '#fff5f5', padding: '2px 6px', borderRadius: '4px' }}>
                                        {task.allocated_minutes}m
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#718096', marginTop: '4px' }}>
                                    Created: {task.created_at ? new Date(task.created_at).toLocaleDateString() : 'N/A'}
                                    {task.is_completed && task.completed_at && (
                                      <> • Completed: {new Date(task.completed_at).toLocaleDateString()}</>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* One-Time Tasks */}
                          {oneTimeTasks.length > 0 && (
                            <div style={{ 
                              padding: '15px', 
                              background: '#f7fafc', 
                              borderRadius: '8px',
                              border: '2px solid #718096' 
                            }}>
                              <h4 style={{ margin: '0 0 10px 0', color: '#2d3748' }}>
                                ⭐ Important One-Time ({oneTimeTasks.length})
                              </h4>
                              <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>One-time important tasks</span>
                                <span>{oneTimeTasks.filter(t => t.is_completed).length}/{oneTimeTasks.length} completed</span>
                              </div>
                              {oneTimeTasks.map(task => (
                                <div key={task.id} style={{ 
                                  padding: '8px', 
                                  marginBottom: '6px', 
                                  background: 'white', 
                                  borderRadius: '4px',
                                  borderLeft: task.is_completed ? '3px solid #a0aec0' : '3px solid #718096'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    {task.is_completed ? '✅' : '🔄'}
                                    <span style={{ 
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      textDecoration: task.is_completed ? 'line-through' : 'none',
                                      color: task.is_completed ? '#666' : '#333',
                                      flex: 1
                                    }}>
                                      {task.name}
                                    </span>
                                    {task.allocated_minutes > 0 && (
                                      <span style={{ fontSize: '11px', color: '#666', background: '#f7fafc', padding: '2px 6px', borderRadius: '4px' }}>
                                        {task.allocated_minutes}m
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#718096', marginTop: '4px' }}>
                                    Created: {task.created_at ? new Date(task.created_at).toLocaleDateString() : 'N/A'}
                                    {task.is_completed && task.completed_at && (
                                      <> • Completed: {new Date(task.completed_at).toLocaleDateString()}</>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
                );
              })()}

              {/* Milestones Section */}
              {(() => {
                if (!projectMilestones || projectMilestones.length === 0) return null;
                return (
              <div className="project-milestones-section" style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', cursor: 'pointer' }}
                  onClick={() => setExpandedSections(prev => ({ ...prev, milestones: !prev.milestones }))}
                >
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '22px', 
                    fontWeight: '700',
                    background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    {expandedSections.milestones ? '▼' : '▶'} 🎯 Milestones: {projectMilestones.length} (Total Tasks: {(() => {
                      // Calculate total tasks across all milestones
                      return projectMilestones.reduce((sum, milestone) => {
                        return sum + projectTasks.filter(task => task.milestone_id === milestone.id).length;
                      }, 0);
                    })()})
                  </h3>
                  <button 
                    className="btn btn-secondary" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddProjectMilestoneModal(true);
                    }}
                  >
                    ➕ Add Milestone
                  </button>
                </div>
                
                {expandedSections.milestones && (
                  !projectMilestones || projectMilestones.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px', fontSize: '14px' }}>
                      <p>No milestones yet. Add milestones to track project phases.</p>
                    </div>
                  ) : (
                    <div className="milestones-list">
                      {projectMilestones.map((milestone, index) => {
                      // Calculate all tasks for this milestone
                      const milestoneTasks = projectTasks.filter(task => task.milestone_id === milestone.id);
                      const completedTasks = milestoneTasks.filter(task => task.is_completed).length;
                      const totalTasks = milestoneTasks.length;
                      
                      return (
                        <div 
                          key={milestone.id} 
                          style={{ 
                            display: 'flex',
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '10px 15px', 
                            background: milestone.is_completed ? '#e6f7ed' : '#f8f9fa',
                            border: `1px solid ${milestone.is_completed ? '#9ae6b4' : '#e0e0e0'}`,
                            borderRadius: '6px',
                            marginBottom: '8px',
                            fontSize: '13px',
                            gap: '15px'
                          }}
                        >
                          {/* Left side: Checkbox + Number + Name (fixed width) + Stats + Date (aligned columns) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={milestone.is_completed}
                              onChange={() => handleToggleProjectMilestone(milestone.id, !milestone.is_completed)}
                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: 'bold', color: '#666', minWidth: '25px' }}>#{index + 1}</span>
                            <span 
                              onClick={() => {
                                setSelectedMilestone(milestone);
                                setShowMilestoneDetailModal(true);
                              }}
                              style={{ 
                                fontWeight: '600', 
                                color: '#3182ce', 
                                fontSize: '14px', 
                                width: '280px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                              title={`Click to view details: ${milestone.name}`}
                            >
                              {milestone.name}
                            </span>
                            <span style={{ color: '#805ad5', fontWeight: '500', minWidth: '80px' }}>Tasks: {completedTasks}/{totalTasks}</span>
                            <span style={{ color: '#666', minWidth: '100px' }}>
                              {parseDateString(milestone.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          
                          {/* Right side: Overdue badge + Action Buttons */}
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {parseDateString(milestone.target_date) < new Date() && !milestone.is_completed && (
                              <span style={{ 
                                color: '#fff',
                                background: '#f56565',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}>
                                ⚠️ Overdue
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setEditingMilestone(milestone);
                                setShowEditProjectMilestoneModal(true);
                              }}
                              style={{ 
                                padding: '5px 10px', 
                                fontSize: '12px',
                                background: '#4299e1', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '4px', 
                                cursor: 'pointer',
                                fontWeight: '500'
                              }}
                              title="Edit milestone"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteProjectMilestone(milestone.id)}
                              style={{ 
                                padding: '5px 10px', 
                                fontSize: '12px',
                                background: '#f56565', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '4px', 
                                cursor: 'pointer',
                                fontWeight: '500'
                              }}
                              title="Delete milestone"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )
                )}
              </div>
                );
              })()}

              {/* Completed Tasks Section */}
              {(() => {
                const thisProjectTasks = projectTasks.filter(t => t.project_id === selectedProject.id);
                
                // Helper to check if all children are completed
                const allChildrenCompleted = (taskId: number): boolean => {
                  const children = thisProjectTasks.filter(t => t.parent_task_id === taskId);
                  if (children.length === 0) return true;
                  return children.every(child => child.is_completed && allChildrenCompleted(child.id));
                };
                
                // Get root completed tasks (completed with all children completed)
                const rootCompletedTasks = thisProjectTasks.filter(t => 
                  !t.parent_task_id && t.is_completed && allChildrenCompleted(t.id)
                );
                
                if (rootCompletedTasks.length === 0) return null;
                
                // Helper to render completed task with hierarchy
                const renderCompletedTask = (task: ProjectTaskData, level: number = 0) => {
                  const children = thisProjectTasks.filter(t => t.parent_task_id === task.id);
                  const hasChildren = children.length > 0;
                  const indentPx = level * 20;
                  
                  return (
                    <div key={task.id} style={{ marginLeft: `${indentPx}px` }}>
                      <div style={{ 
                        padding: '12px', 
                        marginBottom: '8px',
                        background: 'white', 
                        borderRadius: '6px',
                        borderLeft: '3px solid #48bb78',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '16px' }}>✅</span>
                            <span style={{ 
                              fontSize: '14px',
                              fontWeight: '600',
                              textDecoration: 'line-through',
                              color: '#666'
                            }}>
                              {task.name}
                            </span>
                            {hasChildren && (
                              <span style={{ fontSize: '11px', color: '#718096', marginLeft: '4px' }}>
                                ({children.length} subtask{children.length > 1 ? 's' : ''})
                              </span>
                            )}
                          </div>
                          {task.completed_at && (
                            <div style={{ fontSize: '10px', color: '#718096', marginLeft: '24px' }}>
                              ⏰ Completed: {new Date(task.completed_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <button
                          className="btn btn-sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await axios.put(`http://localhost:8000/api/tasks/${task.id}`, {
                                ...task,
                                is_completed: false,
                                completed_at: null
                              });
                              showAlert(`Task "${task.name}" restored successfully!`, 'success');
                              refreshTasks();
                            } catch (error) {
                              console.error('Error restoring task:', error);
                              showAlert('Failed to restore task', 'error');
                            }
                          }}
                          style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            background: '#3182ce',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                          title="Mark as incomplete"
                        >
                          ↶ Restore
                        </button>
                      </div>
                      {hasChildren && children.map(child => renderCompletedTask(child, level + 1))}
                    </div>
                  );
                };
                
                return (
                  <div className="project-completed-section" style={{ marginTop: '30px', marginBottom: '30px' }}>
                    <div 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginBottom: '15px',
                        cursor: 'pointer',
                        borderBottom: '2px solid #48bb78',
                        paddingBottom: '10px'
                      }}
                      onClick={() => setExpandedSections(prev => ({ ...prev, completedTasks: !prev.completedTasks }))}
                    >
                      <h3 style={{ margin: 0, color: '#48bb78', fontSize: '20px' }}>
                        {expandedSections.completedTasks ? '▼' : '▶'} ✅ Completed Tasks ({(() => {
                          let count = 0;
                          const countTasks = (tasks: ProjectTaskData[]) => {
                            tasks.forEach(task => {
                              count++;
                              const children = thisProjectTasks.filter(t => t.parent_task_id === task.id);
                              countTasks(children);
                            });
                          };
                          countTasks(rootCompletedTasks);
                          return count;
                        })()})
                      </h3>
                    </div>
                    
                    {expandedSections.completedTasks && (
                      <div style={{ 
                        padding: '15px',
                        background: '#f0fff4',
                        borderRadius: '8px',
                        border: '2px solid #48bb78'
                      }}>
                        {rootCompletedTasks.map(task => renderCompletedTask(task, 0))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Description Section - Moved to End */}
              {selectedProject.description && (
                <div className="project-description-section" style={{ marginBottom: '30px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#2d3748' }}>
                    📝 Description
                  </h3>
                  <p className="project-detail-description" style={{ 
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    margin: 0,
                    color: '#475569',
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}>{selectedProject.description}</p>
                </div>
              )}

              {/* Challenges Section */}
              <div className="project-milestones-section" style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0 }}>🏆 Challenges</h3>
                </div>
                {projectChallenges && (
                  <RelatedChallengesList
                    directChallenges={projectChallenges.direct_challenges || []}
                    relatedChallenges={projectChallenges.goal_challenges || []}
                    title="Related Challenges"
                    emptyMessage="No challenges linked to this project or its parent goal yet."
                  />
                )}
                {!projectChallenges && (
                  <p style={{ color: '#718096', fontSize: '14px', fontStyle: 'italic' }}>
                    Loading challenges...
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
              <p>Project not found or still loading...</p>
              <button className="btn btn-secondary" onClick={handleBackToProjects}>
                ← Back to Projects
              </button>
            </div>
          )}
        </div>
      ) : activeTab === 'misc' ? (
        <div className="projects-container">
          {/* Filter Buttons */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <button
              className={`btn ${projectTaskFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setProjectTaskFilter('all')}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
                backgroundColor: projectTaskFilter === 'all' ? '#4299e1' : '#e2e8f0',
                color: projectTaskFilter === 'all' ? 'white' : '#2d3748'
              }}
            >
              🎯 Show All ({miscTasks.filter(t => !t.is_completed).length})
            </button>
            <button
              className={`btn ${projectTaskFilter === 'in-progress' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setProjectTaskFilter('in-progress')}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
                backgroundColor: projectTaskFilter === 'in-progress' ? '#4299e1' : '#e2e8f0',
                color: projectTaskFilter === 'in-progress' ? 'white' : '#2d3748'
              }}
            >
              🔵 In Progress ({miscTasks.filter(t => !t.is_completed).length})
            </button>
            <button
              className={`btn ${projectTaskFilter === 'overdue' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setProjectTaskFilter('overdue')}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
                backgroundColor: projectTaskFilter === 'overdue' ? '#e53e3e' : '#e2e8f0',
                color: projectTaskFilter === 'overdue' ? 'white' : '#2d3748'
              }}
            >
              ⏰ Overdue ({miscTasks.filter(t => !t.is_completed && t.due_date && parseDateString(t.due_date.split('T')[0]) < new Date()).length})
            </button>
          </div>

          {/* Monthly Planning Summary */}
          <div style={{
            backgroundColor: '#f7fafc',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#2d3748' }}>
              📊 Overdue Tasks: Monthly
            </h4>
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              fontSize: '13px'
            }}>
              {(() => {
                // Group tasks by their due date month
                const tasksByMonth: Record<string, { year: number; month: number; tasks: ProjectTaskData[] }> = {};
                
                miscTasks.forEach(task => {
                  if (task.due_date) {
                    const datePart = task.due_date.split('T')[0];
                    const dueDate = parseDateString(datePart);
                    const year = dueDate.getFullYear();
                    const month = dueDate.getMonth();
                    const key = `${year}-${month}`;
                    
                    if (!tasksByMonth[key]) {
                      tasksByMonth[key] = { year, month, tasks: [] };
                    }
                    tasksByMonth[key].tasks.push(task);
                  }
                });
                
                // Sort by date (oldest to newest)
                const sortedMonths = Object.entries(tasksByMonth)
                  .sort(([keyA], [keyB]) => {
                    const [yearA, monthA] = keyA.split('-').map(Number);
                    const [yearB, monthB] = keyB.split('-').map(Number);
                    if (yearA !== yearB) return yearA - yearB;
                    return monthA - monthB;
                  });
                
                const now = new Date();
                
                return sortedMonths.map(([key, { year, month, tasks }]) => {
                  const label = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                  const completed = tasks.filter(t => t.is_completed).length;
                  const total = tasks.length;
                  
                  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
                  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
                  const isPastMonth = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());
                  
                  // Color coding based on completion rate
                  let bgColor = '#e2e8f0'; // gray - low completion
                  let textColor = '#2d3748';
                  if (completionRate >= 80) {
                    bgColor = '#c6f6d5'; // green - high completion
                    textColor = '#22543d';
                  } else if (completionRate >= 50) {
                    bgColor = '#fef5e7'; // yellow - medium completion
                    textColor = '#744210';
                  } else if (completionRate > 0) {
                    bgColor = '#fed7d7'; // red - low completion
                    textColor = '#742a2a';
                  }
                  
                  return (
                    <div
                      key={key}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: bgColor,
                        color: textColor,
                        fontWeight: isCurrentMonth ? '700' : '500',
                        border: isCurrentMonth ? '2px solid #3182ce' : '1px solid transparent',
                        boxShadow: isCurrentMonth ? '0 0 0 3px rgba(49, 130, 206, 0.1)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: '140px',
                        opacity: isPastMonth && total - completed > 0 ? 0.7 : 1
                      }}
                      title={`${completed} completed out of ${total} tasks planned for ${label}`}
                    >
                      <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                        {label} {isCurrentMonth && '(Current)'} {isPastMonth && total - completed > 0 && '⚠️'}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '700' }}>
                        {completed}/{total} tasks ({completionRate}%)
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                        {total - completed > 0 && isPastMonth && `${total - completed} overdue`}
                        {total - completed > 0 && isCurrentMonth && `${total - completed} in progress`}
                        {total - completed > 0 && !isPastMonth && !isCurrentMonth && `${total - completed} planned`}
                        {total - completed === 0 && '✓ All done'}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <p style={{ 
              fontSize: '11px', 
              color: '#718096', 
              marginTop: '12px', 
              marginBottom: '0',
              fontStyle: 'italic'
            }}>
              💡 Tip: Use this overview to avoid overplanning. If you see low completion rates, consider planning fewer tasks next month.
            </p>
          </div>
          
          {/* Active Misc Tasks View */}
          <div className="project-tasks-tree" style={{ marginTop: '20px' }}>
            {miscTasks.filter(t => !t.is_completed).length === 0 ? (
              <div className="empty-state">
                <p>No active misc tasks. Click "Add Task" and select "Misc Task" to get started.</p>
                <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                  Misc tasks are perfect for one-off items that don't fit into daily/weekly schedules.
                </p>
              </div>
            ) : (
              <>
                {/* Category-Based Sections (Collapsible) */}
                {(() => {
                  // Define hierarchy order (same as Daily tab)
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

                  // Helper to check if all children are completed
                  const allChildrenCompleted = (taskId: number): boolean => {
                    const children = miscTasks.filter(t => t.parent_task_id === taskId);
                    if (children.length === 0) return true;
                    return children.every(child => child.is_completed && allChildrenCompleted(child.id));
                  };

                  // Group tasks by category - exclude completed tasks with all children completed
                  const tasksByCategory = miscTasks
                    .filter(t => !t.parent_task_id)
                    .filter(t => !(t.is_completed && allChildrenCompleted(t.id))) // Exclude fully completed hierarchies
                    .filter(task => {
                      if (projectTaskFilter === 'all') return true;
                      if (projectTaskFilter === 'in-progress') return !task.is_completed;
                      if (projectTaskFilter === 'overdue') {
                        return !task.is_completed && task.due_date && parseDateString(task.due_date.split('T')[0]) < new Date();
                      }
                      return true;
                    })
                    .reduce((acc, task) => {
                      const categoryName = task.category_name || 'Uncategorized';
                      if (!acc[categoryName]) {
                        acc[categoryName] = [];
                      }
                      acc[categoryName].push(task);
                      return acc;
                    }, {} as Record<string, ProjectTaskData[]>);

                  // Sort categories by hierarchy order (same as Daily tab)
                  const sortedCategories = Object.keys(tasksByCategory).sort((a, b) => {
                    const aPillarName = tasksByCategory[a][0]?.pillar_name || '';
                    const bPillarName = tasksByCategory[b][0]?.pillar_name || '';
                    const keyA = `${aPillarName}|${a}`;
                    const keyB = `${bPillarName}|${b}`;
                    const orderA = hierarchyOrder[keyA] || 999;
                    const orderB = hierarchyOrder[keyB] || 999;
                    return orderA - orderB;
                  });

                  return sortedCategories.map(categoryName => {
                    const categoryTasks = tasksByCategory[categoryName];
                    const categoryKey = `${categoryTasks[0]?.pillar_name || ''}|${categoryName}`;
                    const isExpanded = expandedMiscCategories.has(categoryKey);
                    
                    // Get pillar color for the category
                    const pillarName = categoryTasks[0]?.pillar_name || 'Unknown';
                    let pillarColor = '#718096';
                    let pillarIcon = '📋';
                    
                    if (pillarName === 'Hard Work') {
                      pillarColor = '#2563eb';
                      pillarIcon = '💼';
                    } else if (pillarName === 'Calmness') {
                      pillarColor = '#16a34a';
                      pillarIcon = '🧘';
                    } else if (pillarName === 'Family') {
                      pillarColor = '#9333ea';
                      pillarIcon = '👨‍👩‍👦';
                    }

                    return (
                      <div key={categoryKey} style={{ marginBottom: '20px' }}>
                        <div 
                          onClick={() => {
                            const newExpanded = new Set(expandedMiscCategories);
                            if (isExpanded) {
                              newExpanded.delete(categoryKey);
                            } else {
                              newExpanded.add(categoryKey);
                            }
                            setExpandedMiscCategories(newExpanded);
                            localStorage.setItem('expandedMiscCategories', JSON.stringify(Array.from(newExpanded)));
                          }}
                          style={{ 
                            fontSize: '17px', 
                            fontWeight: '600', 
                            color: pillarColor, 
                            marginBottom: isExpanded ? '15px' : '0', 
                            paddingBottom: '8px', 
                            borderBottom: isExpanded ? `2px solid ${pillarColor}` : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 15px',
                            background: isExpanded ? 'transparent' : '#f7fafc',
                            borderRadius: '8px',
                            transition: 'all 0.2s'
                          }}
                        >
                          <span>
                            {isExpanded ? '▼' : '▶'} {pillarIcon} {categoryName} ({categoryTasks.length})
                          </span>
                          <span style={{ fontSize: '13px', color: '#666', fontWeight: 'normal' }}>
                            {pillarName}
                          </span>
                        </div>
                        
                        {isExpanded && (
                          <div className="task-list">
                            {categoryTasks.map((task) => (
                  <TaskNode 
                    key={`${task.id}-${task.is_completed}`} 
                    task={task} 
                    level={0}
                    allTasks={miscTasks}
                    expandedTasks={expandedMiscTasks}
                    onToggleExpand={(taskId: number) => {
                      const newExpanded = new Set(expandedMiscTasks);
                      if (newExpanded.has(taskId)) {
                        newExpanded.delete(taskId);
                      } else {
                        newExpanded.add(taskId);
                      }
                      setExpandedMiscTasks(newExpanded);
                      localStorage.setItem('expandedMiscTasks', JSON.stringify(Array.from(newExpanded)));
                    }}
                    onToggleComplete={async (taskId: number, currentStatus: boolean) => {
                      // If trying to mark as complete, check for incomplete subtasks
                      if (!currentStatus) {
                        const hasIncompleteSubtasks = miscTasks.some(t => 
                          t.parent_task_id === taskId && !t.is_completed
                        );
                        
                        if (hasIncompleteSubtasks) {
                          alert('Cannot mark this task as done because it has incomplete subtasks. Please complete all subtasks first.');
                          return;
                        }
                      }
                      
                      try {
                        await api.put(`/api/tasks/${taskId}`, {
                          is_completed: !currentStatus
                        });
                        // Force a complete refresh by clearing and reloading
                        setMiscTasks([]);
                        await loadMiscTaskGroups();
                      } catch (err: any) {
                        console.error('Error toggling task:', err);
                      }
                    }}
                    onEdit={(task: ProjectTaskData) => {
                      setSelectedTaskId(task.id);
                      setIsTaskFormOpen(true);
                    }}
                    onDelete={async (taskId: number) => {
                      // Check if task has incomplete subtasks
                      const hasIncompleteSubtasks = miscTasks.some(t => 
                        t.parent_task_id === taskId && !t.is_completed
                      );
                      
                      if (hasIncompleteSubtasks) {
                        alert('Cannot delete this task because it has incomplete subtasks. Please complete or delete all subtasks first.');
                        return;
                      }
                      
                      if (confirm('Are you sure you want to delete this task? This will also delete all subtasks.')) {
                        try {
                          await api.delete(`/api/tasks/${taskId}`);
                          await loadMiscTaskGroups();
                        } catch (err: any) {
                          console.error('Error deleting task:', err);
                          console.error('Delete error response:', err.response);
                          const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
                          alert('Failed to delete task: ' + errorMsg);
                        }
                      }
                    }}
                    onUpdateDueDate={async (taskId: number, newDueDate: string) => {
                      try {
                        await api.put(`/api/tasks/${taskId}`, {
                          due_date: newDueDate
                        });
                        await loadMiscTaskGroups();
                      } catch (err: any) {
                        console.error('Error updating due date:', err);
                        alert('Failed to update due date. Please try again.');
                      }
                    }}
                    getDueDateColorClass={getDueDateColorClass}
                    getTasksByParentId={(parentId: number | null) => miscTasks.filter(t => t.parent_task_id === parentId)}
                    onAddSubtask={(parentTask: ProjectTaskData) => {
                      console.log('onAddSubtask called for Misc task:', parentTask);
                      setEditingMiscTask(parentTask);
                      setShowAddMiscTaskModal(true);
                      console.log('Modal should open now. editingMiscTask:', parentTask, 'showAddMiscTaskModal: true');
                    }}
                  />
                ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </>
            )}
          </div>

          {/* Completed Misc Tasks Section */}
          {(() => {
            // Helper to check if all children are completed
            const allChildrenCompleted = (taskId: number): boolean => {
              const children = miscTasks.filter(t => t.parent_task_id === taskId);
              if (children.length === 0) return true;
              return children.every(child => child.is_completed && allChildrenCompleted(child.id));
            };
            
            // Get root completed tasks (completed with all children completed)
            const rootCompletedTasks = miscTasks.filter(t => 
              !t.parent_task_id && t.is_completed && allChildrenCompleted(t.id)
            );
            
            if (rootCompletedTasks.length === 0) return null;
            
            return (
              <div style={{ marginTop: '40px' }}>
                <h3 
                  onClick={() => setShowCompletedMiscTasks(!showCompletedMiscTasks)}
                  style={{ 
                    marginBottom: '15px', 
                    color: '#666', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    userSelect: 'none',
                    fontSize: '18px',
                    fontWeight: '600'
                  }}
                >
                  {showCompletedMiscTasks ? '▼' : '▶'} ✅ Completed Tasks ({(() => {
                    let count = 0;
                    const countTasks = (tasks: ProjectTaskData[]) => {
                      tasks.forEach(task => {
                        count++;
                        const children = miscTasks.filter(t => t.parent_task_id === task.id);
                        countTasks(children);
                      });
                    };
                    countTasks(rootCompletedTasks);
                    return count;
                  })()})
                </h3>
                {showCompletedMiscTasks && (
                  <div className="project-tasks-tree" style={{ 
                    marginTop: '20px',
                    opacity: 0.8,
                    backgroundColor: '#f9fafb',
                    padding: '20px',
                    borderRadius: '8px'
                  }}>
                    <div className="task-list">
                      {rootCompletedTasks.map((task) => (
                      <TaskNode 
                        key={`${task.id}-${task.is_completed}`} 
                        task={task} 
                        level={0}
                        allTasks={miscTasks}
                        expandedTasks={expandedMiscTasks}
                        onToggleExpand={(taskId: number) => {
                          const newExpanded = new Set(expandedMiscTasks);
                          if (newExpanded.has(taskId)) {
                            newExpanded.delete(taskId);
                          } else {
                            newExpanded.add(taskId);
                          }
                          setExpandedMiscTasks(newExpanded);
                          localStorage.setItem('expandedMiscTasks', JSON.stringify(Array.from(newExpanded)));
                        }}
                    onToggleComplete={async (taskId: number, currentStatus: boolean) => {
                      // Allow uncompleting tasks
                      try {
                        await api.put(`/api/tasks/${taskId}`, {
                          is_completed: !currentStatus
                        });
                        // Force a complete refresh by clearing and reloading
                        setMiscTasks([]);
                        await loadMiscTaskGroups();
                      } catch (err: any) {
                        console.error('Error toggling task:', err);
                      }
                    }}
                        onEdit={(task: ProjectTaskData) => {
                          setSelectedTaskId(task.id);
                          setIsTaskFormOpen(true);
                        }}
                        onDelete={async (taskId: number) => {
                          if (confirm('Are you sure you want to permanently delete this completed task? This will also delete all subtasks.')) {
                            try {
                              await api.delete(`/api/tasks/${taskId}`);
                              await loadMiscTaskGroups();
                            } catch (err: any) {
                              console.error('Error deleting task:', err);
                              console.error('Delete error response:', err.response);
                              const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
                              alert('Failed to delete task: ' + errorMsg);
                            }
                          }
                        }}
                        onUpdateDueDate={async (taskId: number, newDueDate: string) => {
                          try {
                            await api.put(`/api/tasks/${taskId}`, {
                              due_date: newDueDate
                            });
                            await loadMiscTaskGroups();
                          } catch (err: any) {
                            console.error('Error updating due date:', err);
                            alert('Failed to update due date. Please try again.');
                          }
                        }}
                        getDueDateColorClass={getDueDateColorClass}
                        getTasksByParentId={(parentId: number | null) => miscTasks.filter(t => t.parent_task_id === parentId)}
                        onAddSubtask={(parentTask: ProjectTaskData) => {
                          setEditingMiscTask(parentTask);
                          setShowAddMiscTaskModal(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            );
          })()}
        </div>
      ) : activeTab === 'habits' ? (
        <div className="habits-container">
          <div className="habits-header">
            <h2>🎯 Your Habits</h2>
          </div>

          {habits.length === 0 ? (
            <div className="empty-state">
              <p>No habits yet. Start building great habits today!</p>
              <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                Track daily habits, build streaks, and develop consistency.
              </p>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowAddHabitModal(true)}
                style={{ marginTop: '20px' }}
              >
                ➕ Add New Habit
              </button>
            </div>
          ) : (
            <>
              {/* Summary Panel - Habit counts by category */}
              {(() => {
                // Define hierarchy order (same as Daily tab)
                const hierarchyOrder: { [key: string]: number } = {
                  'Hard Work|Office-Tasks': 1,
                  'Hard Work|Learning': 2,
                  'Hard Work|Confidence': 3,
                  'Calmness|Yoga': 4,
                  'Calmness|Sleep': 5,
                  'Family|My Tasks': 6,
                  'Family|Home Tasks': 7,
                  'Family|Time Waste': 8,
                };

                // Filter active habits
                const activeHabits = habits.filter((habit) => {
                  const habitMonth = habitSelectedMonth[habit.id] || new Date();
                  const selectedMonthStart = new Date(habitMonth.getFullYear(), habitMonth.getMonth(), 1);
                  selectedMonthStart.setHours(0, 0, 0, 0);
                  const selectedMonthEnd = new Date(habitMonth.getFullYear(), habitMonth.getMonth() + 1, 0);
                  selectedMonthEnd.setHours(23, 59, 59, 999);
                  
                  const habitStart = habit.start_date ? parseDateString(habit.start_date) : null;
                  const habitEnd = habit.end_date ? parseDateString(habit.end_date) : null;
                  
                  if (habitEnd && habitEnd < selectedMonthStart) return false;
                  const startedBeforeOrDuringMonth = !habitStart || habitStart <= selectedMonthEnd;
                  return startedBeforeOrDuringMonth;
                });

                // Group by category
                const habitsByCategory = activeHabits.reduce((acc, habit) => {
                  const categoryName = habit.category_name || 'Uncategorized';
                  if (!acc[categoryName]) {
                    acc[categoryName] = [];
                  }
                  acc[categoryName].push(habit);
                  return acc;
                }, {} as Record<string, any[]>);

                // Helper function to check if habit is successful
                const isHabitSuccessful = (habit: any) => {
                  const weekRate = habit.stats?.week_success_rate ?? 0;
                  const monthRate = habit.stats?.month_success_rate ?? 0;
                  return weekRate > 60 || monthRate > 40;
                };

                // Calculate successful habits
                const successfulHabitsCount = activeHabits.filter(isHabitSuccessful).length;

                // Sort categories
                const sortedCategories = Object.keys(habitsByCategory).sort((a, b) => {
                  const aPillarName = habitsByCategory[a][0]?.pillar_name || '';
                  const bPillarName = habitsByCategory[b][0]?.pillar_name || '';
                  const keyA = `${aPillarName}|${a}`;
                  const keyB = `${bPillarName}|${b}`;
                  const orderA = hierarchyOrder[keyA] || 999;
                  const orderB = hierarchyOrder[keyB] || 999;
                  return orderA - orderB;
                });

                return (
                  <div style={{ 
                    marginBottom: '24px',
                    padding: '16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    <div style={{ 
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      {sortedCategories.map(categoryName => {
                        const categoryHabits = habitsByCategory[categoryName];
                        const pillarName = categoryHabits[0]?.pillar_name || 'Unknown';
                        const categorySuccessfulCount = categoryHabits.filter(isHabitSuccessful).length;
                        let pillarColor = '#718096';
                        let pillarIcon = '📋';
                        
                        if (pillarName === 'Hard Work') {
                          pillarColor = '#2563eb';
                          pillarIcon = '💼';
                        } else if (pillarName === 'Calmness') {
                          pillarColor = '#16a34a';
                          pillarIcon = '🧘';
                        } else if (pillarName === 'Family') {
                          pillarColor = '#9333ea';
                          pillarIcon = '👨‍👩‍👦';
                        }

                        return (
                          <div 
                            key={categoryName}
                            style={{
                              padding: '10px 16px',
                              backgroundColor: 'rgba(255,255,255,0.95)',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                          >
                            <span style={{ fontSize: '18px' }}>{pillarIcon}</span>
                            <div>
                              <div style={{ 
                                fontSize: '14px',
                                fontWeight: '600',
                                color: pillarColor
                              }}>
                                {categoryName}
                              </div>
                              <div style={{ 
                                fontSize: '12px',
                                color: '#666'
                              }}>
                                {categoryHabits.length} habit{categoryHabits.length !== 1 ? 's' : ''}
                                {categorySuccessfulCount > 0 && (
                                  <span style={{ 
                                    marginLeft: '4px',
                                    color: '#48bb78',
                                    fontWeight: '600'
                                  }}>
                                    • {categorySuccessfulCount} 🌟
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div 
                        style={{
                          padding: '10px 16px',
                          backgroundColor: 'rgba(255,255,255,0.95)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          border: '2px solid #48bb78'
                        }}
                      >
                        <span style={{ fontSize: '18px' }}>✅</span>
                        <div>
                          <div style={{ 
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#2d3748'
                          }}>
                            Total Active
                          </div>
                          <div style={{ 
                            fontSize: '20px',
                            fontWeight: '700',
                            color: '#48bb78',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            {activeHabits.length}
                            {successfulHabitsCount > 0 && (
                              <span style={{ 
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#f59e0b'
                              }}>
                                ({successfulHabitsCount} 🌟)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                        <button 
                          className="btn btn-primary" 
                          onClick={() => setShowAddHabitModal(true)}
                          style={{ 
                            backgroundColor: 'white',
                            color: '#667eea',
                            border: 'none',
                            padding: '10px 16px',
                            fontSize: '14px',
                            fontWeight: '600',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          ➕ Add New Habit
                        </button>
                        <div 
                          style={{
                            fontSize: '11px',
                            color: '#fef3c7',
                            fontStyle: 'italic'
                          }}
                        >
                          💡 Success: Week &gt; 60% or Month &gt; 40%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Category-Based Sections (Collapsible) */}
              {(() => {
                // Define hierarchy order (same as Daily tab)
                const hierarchyOrder: { [key: string]: number } = {
                  'Hard Work|Office-Tasks': 1,
                  'Hard Work|Learning': 2,
                  'Hard Work|Confidence': 3,
                  'Calmness|Yoga': 4,
                  'Calmness|Sleep': 5,
                  'Family|My Tasks': 6,
                  'Family|Home Tasks': 7,
                  'Family|Time Waste': 8,
                };

                // Group habits by category
                const habitsByCategory = habits.filter((habit) => {
                  const habitMonth = habitSelectedMonth[habit.id] || new Date();
                  const selectedMonthStart = new Date(habitMonth.getFullYear(), habitMonth.getMonth(), 1);
                  selectedMonthStart.setHours(0, 0, 0, 0);
                  const selectedMonthEnd = new Date(habitMonth.getFullYear(), habitMonth.getMonth() + 1, 0);
                  selectedMonthEnd.setHours(23, 59, 59, 999);
                  
                  const habitStart = habit.start_date ? parseDateString(habit.start_date) : null;
                  const habitEnd = habit.end_date ? parseDateString(habit.end_date) : null;
                  
                  if (habitEnd && habitEnd < selectedMonthStart) return false;
                  const startedBeforeOrDuringMonth = !habitStart || habitStart <= selectedMonthEnd;
                  return startedBeforeOrDuringMonth;
                }).reduce((acc, habit) => {
                  const categoryName = habit.category_name || 'Uncategorized';
                  if (!acc[categoryName]) {
                    acc[categoryName] = [];
                  }
                  acc[categoryName].push(habit);
                  return acc;
                }, {} as Record<string, any[]>);

                // Helper function to check if habit is successful (for section headers)
                const isHabitSuccessful = (habit: any) => {
                  const weekRate = habit.stats?.week_success_rate ?? 0;
                  const monthRate = habit.stats?.month_success_rate ?? 0;
                  return weekRate > 60 || monthRate > 40;
                };

                // Sort categories by hierarchy order
                const sortedCategories = Object.keys(habitsByCategory).sort((a, b) => {
                  const aPillarName = habitsByCategory[a][0]?.pillar_name || '';
                  const bPillarName = habitsByCategory[b][0]?.pillar_name || '';
                  const keyA = `${aPillarName}|${a}`;
                  const keyB = `${bPillarName}|${b}`;
                  const orderA = hierarchyOrder[keyA] || 999;
                  const orderB = hierarchyOrder[keyB] || 999;
                  return orderA - orderB;
                });

                return sortedCategories.map(categoryName => {
                  const categoryHabits = habitsByCategory[categoryName];
                  const pillarName = categoryHabits[0]?.pillar_name || 'Unknown';
                  const categoryKey = `${pillarName}|${categoryName}`;
                  const isExpanded = expandedHabitCategories.has(categoryKey);
                  const categorySuccessfulCount = categoryHabits.filter(isHabitSuccessful).length;
                  
                  let pillarColor = '#718096';
                  let pillarIcon = '📋';
                  
                  if (pillarName === 'Hard Work') {
                    pillarColor = '#2563eb';
                    pillarIcon = '💼';
                  } else if (pillarName === 'Calmness') {
                    pillarColor = '#16a34a';
                    pillarIcon = '🧘';
                  } else if (pillarName === 'Family') {
                    pillarColor = '#9333ea';
                    pillarIcon = '👨‍👩‍👦';
                  }

                  return (
                    <div key={categoryKey} style={{ marginBottom: '24px' }}>
                      <div 
                        onClick={() => {
                          const newExpanded = new Set(expandedHabitCategories);
                          if (isExpanded) {
                            newExpanded.delete(categoryKey);
                          } else {
                            newExpanded.add(categoryKey);
                          }
                          setExpandedHabitCategories(newExpanded);
                          localStorage.setItem('expandedHabitCategories', JSON.stringify(Array.from(newExpanded)));
                        }}
                        style={{ 
                          fontSize: '18px', 
                          fontWeight: '600', 
                          color: pillarColor, 
                          marginBottom: isExpanded ? '15px' : '0', 
                          paddingBottom: '8px', 
                          borderBottom: isExpanded ? `2px solid ${pillarColor}` : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          background: isExpanded ? 'transparent' : '#f7fafc',
                          borderRadius: '8px',
                          transition: 'all 0.2s',
                          boxShadow: isExpanded ? 'none' : '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                      >
                        <span>
                          {isExpanded ? '▼' : '▶'} {pillarIcon} {categoryName} ({categoryHabits.length})
                          {categorySuccessfulCount > 0 && (
                            <span style={{ 
                              marginLeft: '8px',
                              color: '#16a34a',
                              fontSize: '16px',
                              fontWeight: '700'
                            }}>
                              ✅ {categorySuccessfulCount} success
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
                          {pillarName}
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div 
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '20px',
                            width: '100%',
                            marginTop: '12px'
                          }}
                        >
                          {categoryHabits.map((habit) => {
                const periodStats = currentPeriodStats[habit.id];
                const trackingMode = habit.tracking_mode || 'daily_streak';
                const showPeriodTracking = ['occurrence', 'occurrence_with_value', 'aggregate'].includes(trackingMode);
                
                // Get pillar color for gradient - use varied defaults if no pillar assigned
                const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
                const pillarColor = habit.pillar_color || defaultColors[habit.id % defaultColors.length];
                const gradientEnd = habit.pillar_color ? `${pillarColor}CC` : '#764ba2';
                
                return (
                <div key={habit.id} className="habit-card" style={{
                  border: `2px solid ${pillarColor}`,
                  borderRadius: '12px',
                  padding: '20px',
                  background: `linear-gradient(135deg, ${pillarColor}15 0%, ${pillarColor}05 100%)`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                >
                  {/* Habit Name with Pillar-Category */}
                  <div style={{ marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                      {habit.name}
                      {habit.pillar_name && (
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#718096',
                          marginLeft: '8px'
                        }}>
                          ({habit.pillar_name}{habit.category_name && ` - ${habit.category_name}`})
                        </span>
                      )}
                    </h3>
                  </div>

                  {/* Quick action buttons for daily habits */}
                  {!showPeriodTracking && (
                    <>
                      {/* Month navigation and visual tracker - MOVED TO TOP */}
                      {habitMonthDays[habit.id] && (
                        <div style={{ 
                          marginBottom: '12px',
                          padding: '8px',
                          backgroundColor: '#f7fafc',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0'
                        }}>
                          {/* Month navigation header - aligned left */}
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'flex-start', 
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '10px'
                          }}>
                            <button
                              className="btn btn-sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const currentMonth = habitSelectedMonth[habit.id] || new Date();
                                const newMonth = new Date(currentMonth);
                                newMonth.setMonth(newMonth.getMonth() - 1);
                                // Check if new month is before habit start month
                                const habitStart = habit.start_date ? new Date(habit.start_date) : null;
                                if (habitStart) {
                                  const startMonth = new Date(habitStart.getFullYear(), habitStart.getMonth(), 1);
                                  if (newMonth >= startMonth) {
                                    setHabitSelectedMonth(prev => ({ ...prev, [habit.id]: newMonth }));
                                    await loadHabitMonthDays(habit.id, newMonth);
                                  }
                                } else {
                                  setHabitSelectedMonth(prev => ({ ...prev, [habit.id]: newMonth }));
                                  await loadHabitMonthDays(habit.id, newMonth);
                                }
                              }}
                              disabled={(() => {
                                const habitStart = habit.start_date ? new Date(habit.start_date) : null;
                                if (!habitStart) return false;
                                const startMonth = new Date(habitStart.getFullYear(), habitStart.getMonth(), 1);
                                const currentMonth = habitSelectedMonth[habit.id] || new Date();
                                const prevMonth = new Date(currentMonth);
                                prevMonth.setMonth(prevMonth.getMonth() - 1);
                                return prevMonth < startMonth;
                              })()}
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '12px',
                                backgroundColor: (() => {
                                  const habitStart = habit.start_date ? new Date(habit.start_date) : null;
                                  if (!habitStart) return '#4299e1';
                                  const startMonth = new Date(habitStart.getFullYear(), habitStart.getMonth(), 1);
                                  const currentMonth = habitSelectedMonth[habit.id] || new Date();
                                  const prevMonth = new Date(currentMonth);
                                  prevMonth.setMonth(prevMonth.getMonth() - 1);
                                  return prevMonth < startMonth ? '#e2e8f0' : '#4299e1';
                                })(),
                                color: (() => {
                                  const habitStart = habit.start_date ? new Date(habit.start_date) : null;
                                  if (!habitStart) return 'white';
                                  const startMonth = new Date(habitStart.getFullYear(), habitStart.getMonth(), 1);
                                  const currentMonth = habitSelectedMonth[habit.id] || new Date();
                                  const prevMonth = new Date(currentMonth);
                                  prevMonth.setMonth(prevMonth.getMonth() - 1);
                                  return prevMonth < startMonth ? '#a0aec0' : 'white';
                                })(),
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: '600',
                                cursor: (() => {
                                  const habitStart = habit.start_date ? new Date(habit.start_date) : null;
                                  if (!habitStart) return 'pointer';
                                  const startMonth = new Date(habitStart.getFullYear(), habitStart.getMonth(), 1);
                                  const currentMonth = habitSelectedMonth[habit.id] || new Date();
                                  const prevMonth = new Date(currentMonth);
                                  prevMonth.setMonth(prevMonth.getMonth() - 1);
                                  return prevMonth < startMonth ? 'not-allowed' : 'pointer';
                                })()
                              }}
                            >
                              ← Previous
                            </button>
                            
                            <div style={{ 
                              fontSize: '14px', 
                              color: '#2d3748', 
                              fontWeight: '700',
                              padding: '6px 20px',
                              backgroundColor: '#edf2f7',
                              borderRadius: '6px',
                              border: '2px solid #cbd5e0'
                            }}>
                              {(habitSelectedMonth[habit.id] || new Date()).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                            </div>
                            
                            <button
                              className="btn btn-sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const today = new Date();
                                const currentMonth = habitSelectedMonth[habit.id] || new Date();
                                const newMonth = new Date(currentMonth);
                                newMonth.setMonth(newMonth.getMonth() + 1);
                                // Don't allow navigating beyond current month
                                if (newMonth <= today) {
                                  setHabitSelectedMonth(prev => ({ ...prev, [habit.id]: newMonth }));
                                  await loadHabitMonthDays(habit.id, newMonth);
                                }
                              }}
                              disabled={(() => {
                                const today = new Date();
                                const currentMonth = habitSelectedMonth[habit.id] || new Date();
                                const nextMonth = new Date(currentMonth);
                                nextMonth.setMonth(nextMonth.getMonth() + 1);
                                return nextMonth.getFullYear() > today.getFullYear() || 
                                       (nextMonth.getFullYear() === today.getFullYear() && nextMonth.getMonth() > today.getMonth());
                              })()}
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '12px',
                                backgroundColor: (() => {
                                  const today = new Date();
                                  const currentMonth = habitSelectedMonth[habit.id] || new Date();
                                  const nextMonth = new Date(currentMonth);
                                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                                  const disabled = nextMonth.getFullYear() > today.getFullYear() || 
                                         (nextMonth.getFullYear() === today.getFullYear() && nextMonth.getMonth() > today.getMonth());
                                  return disabled ? '#e2e8f0' : '#4299e1';
                                })(),
                                color: (() => {
                                  const today = new Date();
                                  const currentMonth = habitSelectedMonth[habit.id] || new Date();
                                  const nextMonth = new Date(currentMonth);
                                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                                  const disabled = nextMonth.getFullYear() > today.getFullYear() || 
                                         (nextMonth.getFullYear() === today.getFullYear() && nextMonth.getMonth() > today.getMonth());
                                  return disabled ? '#a0aec0' : 'white';
                                })(),
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: '600',
                                cursor: (() => {
                                  const today = new Date();
                                  const currentMonth = habitSelectedMonth[habit.id] || new Date();
                                  const nextMonth = new Date(currentMonth);
                                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                                  const disabled = nextMonth.getFullYear() > today.getFullYear() || 
                                         (nextMonth.getFullYear() === today.getFullYear() && nextMonth.getMonth() > today.getMonth());
                                  return disabled ? 'not-allowed' : 'pointer';
                                })()
                              }}
                            >
                              Next →
                            </button>
                          </div>
                          
                          {/* All dates in one horizontal line */}
                          <div style={{ 
                            display: 'flex',
                            flexWrap: 'nowrap',
                            gap: '4px',
                            overflowX: 'auto',
                            paddingBottom: '4px'
                          }}>
                            {(() => {
                              const habitMonth = habitSelectedMonth[habit.id] || new Date();
                              const year = habitMonth.getFullYear();
                              const month = habitMonth.getMonth();
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              
                              const daysInMonth = new Date(year, month + 1, 0).getDate();
                              const cells = [];
                              
                              // Add cells for each day of the month (1-31)
                              for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
                                const dayData = habitMonthDays[habit.id].find((d: any) => d.dayNum === dayNum);
                                
                                // Check if this is the habit start date
                                const habitStartDate = habit.start_date ? new Date(habit.start_date) : null;
                                const isStartDate = habitStartDate && 
                                  habitStartDate.getDate() === dayNum && 
                                  habitStartDate.getMonth() === habitMonth.getMonth() && 
                                  habitStartDate.getFullYear() === habitMonth.getFullYear();
                                
                                // Determine color and symbol
                                let bgColor = '#e2e8f0'; // Gray - not entered or future date
                                let symbol = '';
                                let textColor = '#718096';
                                
                                if (dayData?.beforeStart) {
                                  // Gray box before habit start date
                                  bgColor = '#e2e8f0';
                                  symbol = '';
                                } else if (dayData?.exists) {
                                  // Has entry or auto-marked as failed
                                  bgColor = dayData.isSuccessful ? '#48bb78' : '#fc8181'; // Green or Red
                                  symbol = dayData.isSuccessful ? '✓' : '✗';
                                  textColor = 'white';
                                }
                                
                                const cellDate = new Date(year, month, dayNum);
                                cellDate.setHours(0, 0, 0, 0);
                                const isToday = cellDate.getTime() === today.getTime();
                                
                                let tooltip = `${dayData?.dayName || ''}, ${habitMonth.toLocaleString('en-US', { month: 'short' })} ${dayNum}`;
                                if (dayData?.beforeStart) {
                                  tooltip += ': Before habit start';
                                } else if (dayData?.exists) {
                                  tooltip += dayData.isSuccessful ? ': Done ✓' : ': Missed ✗';
                                } else {
                                  tooltip += ': Future date';
                                }
                                
                                cells.push(
                                  <div 
                                    key={dayNum}
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '2px',
                                      minWidth: '32px'
                                    }}
                                    title={tooltip}
                                  >
                                    <div style={{ 
                                      fontSize: isStartDate ? '8px' : '9px', 
                                      color: isStartDate ? '#2b6cb0' : '#718096',
                                      fontWeight: isToday || isStartDate ? '700' : '500',
                                      height: '12px'
                                    }}>
                                      {isStartDate ? 'Start' : dayNum}
                                    </div>
                                    <div style={{
                                      width: '32px',
                                      height: '32px',
                                      backgroundColor: bgColor,
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: textColor,
                                      fontSize: '16px',
                                      fontWeight: 'bold',
                                      boxShadow: isToday ? '0 0 0 2px #4299e1' : '0 1px 2px rgba(0,0,0,0.1)',
                                      border: isToday ? '2px solid white' : 'none',
                                      cursor: dayData?.beforeStart || cellDate > today ? 'default' : 'pointer'
                                    }}>
                                      {symbol}
                                    </div>
                                  </div>
                                );
                              }
                              
                              return cells;
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Info boxes: Single row layout with streak, date, and buttons */}
                      <div style={{ 
                        display: 'flex', 
                        gap: '10px',
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        {/* Auto-tracked info - two line box */}
                        {habit.linked_task_id && habit.linked_task_name ? (
                          <div style={{ 
                            padding: '8px 12px', 
                            backgroundColor: '#e6fffa',
                            border: '1px solid #81e6d9',
                            borderRadius: '6px',
                            fontSize: '11px',
                            color: '#234e52',
                            fontWeight: '600',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                          }}>
                            <div style={{ fontSize: '9px', opacity: 0.8 }}>Linked Task:</div>
                            <div>🔗 {habit.linked_task_name}</div>
                          </div>
                        ) : null}

                        {/* Streak info box - one horizontal line, compact */}
                        <div style={{ 
                          padding: '10px 14px',
                          backgroundColor: '#fef5e7',
                          border: '2px solid #f9e79f',
                          borderRadius: '8px',
                          fontSize: '15px',
                          color: '#7d6608',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          whiteSpace: 'nowrap'
                        }}>
                          <div><span style={{ fontSize: '13px', opacity: 0.8 }}>Current:</span> {habit.stats?.current_streak || 0}</div>
                          <div><span style={{ fontSize: '13px', opacity: 0.8 }}>Best:</span> {habit.stats?.longest_streak || 0}</div>
                          <div><span style={{ fontSize: '13px', opacity: 0.8 }}>Overall:</span> {habit.stats?.success_rate || 0}%</div>
                        </div>

                        {/* Success rates - Week and Month */}
                        <div style={{ 
                          padding: '10px 14px',
                          backgroundColor: '#f0fdf4',
                          border: '2px solid #bbf7d0',
                          borderRadius: '8px',
                          fontSize: '15px',
                          color: '#166534',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          whiteSpace: 'nowrap'
                        }}>
                          <div><span style={{ fontSize: '13px', opacity: 0.8 }}>This Week:</span> {habit.stats?.week_success_rate !== undefined ? habit.stats.week_success_rate : 0}%</div>
                          <div><span style={{ fontSize: '13px', opacity: 0.8 }}>This Month:</span> {habit.stats?.month_success_rate !== undefined ? habit.stats.month_success_rate : 0}%</div>
                        </div>

                        {/* Start date and Days info - one horizontal line, same size */}
                        <div style={{ 
                          padding: '10px 14px',
                          backgroundColor: '#f0f4ff',
                          border: '2px solid #c3dafe',
                          borderRadius: '8px',
                          fontSize: '15px',
                          color: '#2c5282',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          whiteSpace: 'nowrap'
                        }}>
                          <div><span style={{ fontSize: '13px', opacity: 0.8 }}>Start:</span> {parseDateString(habit.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          <div><span style={{ fontSize: '13px', opacity: 0.8 }}>Days:</span> {Math.floor((new Date().getTime() - parseDateString(habit.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1}</div>
                        </div>

                        {/* Date selector and Done/Missed buttons in one row for manual habits */}
                        {!habit.linked_task_id && (
                          <div style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '4px 8px',
                            backgroundColor: '#f7fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px'
                          }}>
                            <input 
                              type="date"
                              value={habitMarkDate[habit.id] || formatDateForInput(new Date())}
                              onChange={(e) => {
                                e.stopPropagation();
                                setHabitMarkDate({ ...habitMarkDate, [habit.id]: e.target.value });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              max={formatDateForInput(new Date())}
                              style={{
                                padding: '4px 6px',
                                border: '1px solid #cbd5e0',
                                fontSize: '11px',
                                borderRadius: '4px',
                                backgroundColor: 'white'
                              }}
                            />
                            <button
                              className="btn btn-sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const dateStr = habitMarkDate[habit.id] || formatDateForInput(new Date());
                                await handleMarkHabitEntry(habit.id, dateStr, true);
                              }}
                              style={{ 
                                padding: '4px 10px',
                                backgroundColor: '#48bb78',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              ✓ Done
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const dateStr = habitMarkDate[habit.id] || formatDateForInput(new Date());
                                await handleMarkHabitEntry(habit.id, dateStr, false);
                              }}
                              style={{ 
                                padding: '4px 10px',
                                backgroundColor: '#fc8181',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              ✗ Missed
                            </button>
                          </div>
                        )}

                        {/* Action buttons - Edit, Mark Complete, Delete - with gap */}
                        <div style={{ display: 'flex', gap: '4px', marginLeft: '16px' }}>
                          <button
                            className="btn btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingHabit(habit);
                              setShowAddHabitModal(true);
                            }}
                            style={{ 
                              padding: '3px 8px', 
                              fontSize: '11px',
                              backgroundColor: '#667eea',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                            title="Edit habit"
                          >
                            ✏️ Edit
                          </button>
                          {!habit.end_date && (
                            <button
                              className="btn btn-sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Mark habit "${habit.name}" as completed? This will set an end date to today.`)) {
                                  try {
                                    const today = new Date().toISOString().split('T')[0];
                                    const updatePayload = {
                                      name: habit.name,
                                      description: habit.description,
                                      pillar_id: habit.pillar_id,
                                      category_id: habit.category_id,
                                      subcategory_id: habit.subcategory_id,
                                      start_date: habit.start_date,
                                      end_date: today,
                                      is_active: false,
                                      tracking_mode: habit.tracking_mode,
                                      period_type: habit.period_type,
                                      target_count: habit.target_count,
                                      target_comparison: habit.target_comparison,
                                      linked_task_id: habit.linked_task_id,
                                      session_target_value: habit.session_target_value,
                                      session_target_unit: habit.session_target_unit
                                    };
                                    await api.put(`/api/habits/${habit.id}`, updatePayload);
                                    await loadHabits();
                                    alert('🎉 Congratulations! Habit marked as complete!');
                                  } catch (err: any) {
                                    console.error('Error completing habit:', err);
                                    const errorMsg = err.response?.data?.detail || err.message || JSON.stringify(err);
                                    alert('Failed to complete habit: ' + errorMsg);
                                  }
                                }
                              }}
                              style={{ 
                                padding: '3px 8px', 
                                fontSize: '11px',
                                backgroundColor: '#48bb78',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: '600'
                              }}
                              title="Mark habit as done/complete"
                            >
                              ✅ Done
                            </button>
                          )}
                          <button
                            className="btn btn-sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm(`Complete habit "${habit.name}"? It will be moved to Completed Habits.`)) {
                                try {
                                  // Set end_date to mark as completed instead of deleting
                                  const today = new Date().toISOString().split('T')[0];
                                  const updatePayload = {
                                    name: habit.name,
                                    description: habit.description,
                                    pillar_id: habit.pillar_id,
                                    category_id: habit.category_id,
                                    subcategory_id: habit.subcategory_id,
                                    start_date: habit.start_date,
                                    end_date: today,
                                    is_active: false,
                                    tracking_mode: habit.tracking_mode,
                                    period_type: habit.period_type,
                                    target_count: habit.target_count,
                                    target_comparison: habit.target_comparison,
                                    linked_task_id: habit.linked_task_id,
                                    session_target_value: habit.session_target_value,
                                    session_target_unit: habit.session_target_unit
                                  };
                                  await api.put(`/api/habits/${habit.id}`, updatePayload);
                                  await loadHabits();
                                  alert('✅ Habit moved to Completed section!');
                                } catch (err: any) {
                                  console.error('Error completing habit:', err);
                                  const errorMsg = err.response?.data?.detail || err.message || JSON.stringify(err);
                                  alert('Failed to complete habit: ' + errorMsg);
                                }
                              }
                            }}
                            style={{ 
                              padding: '3px 8px', 
                              fontSize: '11px',
                              backgroundColor: '#fc8181',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                            title="Move to completed habits"
                          >
                            ✅ Complete
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}

              {/* Completed Habits Section */}
              {completedHabits.length > 0 && (
              <div style={{ marginTop: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#718096' }}>
                    ✨ Completed Habits
                  </h3>
                  <button
                    onClick={() => setShowCompletedHabits(!showCompletedHabits)}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: '#e2e8f0',
                      color: '#4a5568',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {showCompletedHabits ? '▼ Hide' : '▶ Show'} ({completedHabits.length})
                  </button>
                </div>
                {showCompletedHabits && (
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                  gap: '20px',
                  width: '100%'
                }}>
                  {completedHabits.map((habit: any) => {
                      const pillarColor = 
                        habit.pillar_name === 'Hard Work' ? '#4299e1' :
                        habit.pillar_name === 'Calmness' ? '#48bb78' :
                        habit.pillar_name === 'Family' ? '#9f7aea' : '#718096';

                      return (
                        <div
                          key={habit.id}
                          style={{
                            padding: '20px',
                            borderRadius: '8px',
                            border: '2px solid #e2e8f0',
                            backgroundColor: '#f7fafc',
                            cursor: 'default',
                            opacity: 0.8
                          }}
                        >
                          {/* Habit Name and Pillar Badge */}
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', flex: 1 }}>
                                {habit.name}
                              </h3>
                              {habit.pillar_name && (
                                <span style={{
                                  padding: '4px 10px',
                                  backgroundColor: pillarColor,
                                  color: 'white',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  flexShrink: 0
                                }}>
                                  {habit.pillar_name}
                                  {habit.category_name && `: ${habit.category_name}`}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Completion Info */}
                          <div style={{ 
                            display: 'flex', 
                            gap: '8px',
                            alignItems: 'center',
                            marginBottom: '12px',
                            flexWrap: 'nowrap'
                          }}>
                            {/* Completion date */}
                            <div style={{ 
                              padding: '6px 10px',
                              backgroundColor: '#e6fffa',
                              border: '1px solid #81e6d9',
                              borderRadius: '4px',
                              fontSize: '10px',
                              color: '#234e52',
                              whiteSpace: 'nowrap',
                              fontWeight: '600'
                            }}>
                              ✅ Completed: {parseDateString(habit.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>

                            {/* Final stats */}
                            <div style={{ 
                              padding: '6px 10px',
                              backgroundColor: '#fef5e7',
                              border: '1px solid #f9e79f',
                              borderRadius: '4px',
                              fontSize: '10px',
                              color: '#7d6608',
                              whiteSpace: 'nowrap',
                              fontWeight: '600'
                            }}>
                              🔥 {habit.stats?.current_streak || 0} | 🏆 {habit.stats?.longest_streak || 0} | ✅ {habit.stats?.success_rate || 0}%
                            </div>

                            {/* Duration */}
                            <div style={{ 
                              padding: '6px 10px',
                              backgroundColor: '#f0f4ff',
                              border: '1px solid #c3dafe',
                              borderRadius: '4px',
                              fontSize: '10px',
                              color: '#2c5282',
                              whiteSpace: 'nowrap',
                              fontWeight: '600'
                            }}>
                              📊 {Math.floor((parseDateString(habit.end_date).getTime() - parseDateString(habit.start_date).getTime()) / (1000 * 60 * 60 * 24))} days total
                            </div>

                            {/* Reactivate button */}
                            <button
                              className="btn btn-sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Reactivate habit "${habit.name}"? This will make it active again.`)) {
                                  try {
                                    console.log('Reactivating habit:', habit.id, habit.name);
                                    
                                    // Create update payload
                                    const updatePayload = {
                                      name: habit.name,
                                      description: habit.description,
                                      pillar_id: habit.pillar_id,
                                      category_id: habit.category_id,
                                      subcategory_id: habit.subcategory_id,
                                      start_date: habit.start_date,
                                      end_date: null,  // Remove end date
                                      is_active: true,  // Set to active
                                      tracking_mode: habit.tracking_mode,
                                      period_type: habit.period_type,
                                      target_count: habit.target_count,
                                      target_comparison: habit.target_comparison,
                                      linked_task_id: habit.linked_task_id,
                                      session_target_value: habit.session_target_value,
                                      session_target_unit: habit.session_target_unit
                                    };
                                    
                                    console.log('Update payload:', updatePayload);
                                    const response = await api.put(`/api/habits/${habit.id}`, updatePayload);
                                    console.log('Reactivate response:', response);
                                    
                                    // Reload all habits
                                    await loadHabits();
                                    
                                    alert(`✅ Success! "${habit.name}" has been reactivated!`);
                                  } catch (err: any) {
                                    console.error('Error reactivating habit:', err);
                                    console.error('Error details:', err.response?.data);
                                    const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
                                    alert('Failed to reactivate habit: ' + errorMsg);
                                  }
                                }
                              }}
                              style={{ 
                                padding: '5px 10px', 
                                fontSize: '11px',
                                backgroundColor: '#4299e1',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                marginLeft: 'auto'
                              }}
                              title="Reactivate habit"
                            >
                              ♻️ Reactivate
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
                )}
              </div>
            )}
            </>
          )}
        </div>
      ) : filteredTasks.length === 0 && activeTab !== 'today' ? (
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
                {activeTab === 'daily' && (
                  <span style={{ 
                    marginLeft: '12px', 
                    fontSize: '14px', 
                    fontWeight: 'normal', 
                    color: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    ({getPillarTimeAllocations()})
                  </span>
                )}
              </h3>
              <div className="tasks-table-container daily-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
                <table className="tasks-table daily-table">
                  <thead>
                    <tr>
                      <th className={`col-task sticky-col sticky-col-1 ${focusedCell && focusedCell.col === -1 ? 'focused-column' : hoveredColumn === -1 ? 'column-highlight' : ''}`} style={{ minWidth: '250px', width: '250px' }}>Task</th>
                      <th className="col-time sticky-col sticky-col-2" style={{ left: '250px', minWidth: '120px', width: '120px' }}>Spent Time</th>
                      {hourLabels.map(hour => (
                        <th 
                          key={hour.index} 
                          className={`col-hour ${focusedCell && focusedCell.col === hour.index ? 'focused-column' : hoveredColumn === hour.index ? 'column-highlight' : ''}`}
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
                      // Check daily status for completed/NA for this specific date
                      const dailyStatus = dailyStatuses.get(task.id);
                      const isDailyCompleted = dailyStatus?.is_completed;
                      const isDailyNA = dailyStatus?.is_na;
                      
                      const rowClassName = isDailyCompleted ? 'completed-row' : isDailyNA ? 'na-row' : '';
                      const isFocusedRow = focusedCell && focusedCell.row === taskIndex;
                      return (
                        <tr 
                          key={task.id} 
                          className={`${rowClassName} ${isFocusedRow ? 'focused-row' : ''}`}
                          style={
                            isDailyCompleted
                              ? { backgroundColor: '#c6f6d5' } 
                              : isDailyNA
                                ? { backgroundColor: '#e2e8f0' }
                                : undefined
                          }
                        >
                          <td 
                            className={`col-task sticky-col sticky-col-1 ${
                              focusedCell && focusedCell.row === taskIndex && focusedCell.col === -1 ? 'focused-cell' :
                              focusedCell && focusedCell.col === -1 ? 'focused-column' :
                              hoveredColumn === -1 ? 'column-highlight' : ''
                            }`}
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
                          
                          {/* Spent Time column - sum of all hours - sticky after Task column */}
                          <td className="col-time sticky-col sticky-col-2" style={{ left: '250px', minWidth: '120px', width: '120px', maxWidth: '120px', position: 'sticky', background: 'white', zIndex: 100 }}>
                            <strong>
                              {hourLabels.reduce((sum, hour) => sum + getHourlyTime(task.id, hour.index), 0)} min
                            </strong>
                          </td>
                          
                          {/* 24 hourly columns */}
                          {hourLabels.map(hour => {
                            const displayValue = getHourlyTime(task.id, hour.index);
                            
                            return (
                              <td 
                                key={hour.index} 
                                className={`col-hour ${
                                  focusedCell && focusedCell.row === taskIndex && focusedCell.col === hour.index ? 'focused-cell' :
                                  focusedCell && focusedCell.col === hour.index ? 'focused-column' :
                                  hoveredColumn === hour.index ? 'column-highlight' : ''
                                }`}
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
                                  onFocus={(e) => {
                                    handleHourlyTimeFocus(task.id, hour.index, e);
                                    e.target.select();
                                  }}
                                  onBlur={(e) => {
                                    // Auto-blur on scroll to prevent accidental changes
                                  }}
                                  onKeyDown={(e) => {
                                    const input = e.currentTarget;
                                    const row = parseInt(input.dataset.row || '0');
                                    const col = parseInt(input.dataset.col || '0');
                                    
                                    if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      const nextInput = document.querySelector(`input[data-row="${row - 1}"][data-col="${col}"]`) as HTMLInputElement;
                                      if (nextInput) {
                                        nextInput.focus();
                                        nextInput.select();
                                      }
                                    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                      e.preventDefault();
                                      const nextInput = document.querySelector(`input[data-row="${row + 1}"][data-col="${col}"]`) as HTMLInputElement;
                                      if (nextInput) {
                                        nextInput.focus();
                                        nextInput.select();
                                      }
                                    } else if (e.key === 'ArrowLeft') {
                                      e.preventDefault();
                                      const nextInput = document.querySelector(`input[data-row="${row}"][data-col="${col - 1}"]`) as HTMLInputElement;
                                      if (nextInput) {
                                        nextInput.focus();
                                        nextInput.select();
                                      }
                                    } else if (e.key === 'ArrowRight') {
                                      e.preventDefault();
                                      const nextInput = document.querySelector(`input[data-row="${row}"][data-col="${col + 1}"]`) as HTMLInputElement;
                                      if (nextInput) {
                                        nextInput.focus();
                                        nextInput.select();
                                      }
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
                            {dailyStatus?.is_completed ? (
                              <div className="action-buttons">
                                <span className="completed-text">✓ Complete (Hidden)</span>
                                <button 
                                  className="btn-undo"
                                  onClick={() => handleUndoComplete(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Undo - bring task back"
                                >
                                  ↩ Undo
                                </button>
                              </div>
                            ) : dailyStatus?.is_na ? (
                              <div className="action-buttons">
                                <span className="na-text">Inactive</span>
                                <button 
                                  className="btn-undo"
                                  onClick={() => handleUndoComplete(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Undo - bring task back"
                                >
                                  ↩ Undo
                                </button>
                              </div>
                            ) : (
                              <div className="action-buttons">
                                <button 
                                  className="btn-complete"
                                  onClick={() => handleTaskComplete(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Task Complete - won't appear tomorrow"
                                >
                                  Done
                                </button>
                                <button 
                                  className="btn-na"
                                  onClick={() => handleTaskNA(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Mark as Inactive - won't appear tomorrow"
                                >
                                  Inactive
                                </button>
                                {dailyStatus?.is_tracked === false ? (
                                  <button 
                                    className="btn-track"
                                    onClick={() => handleAddToTracking(task.id)}
                                    title="Add to tracking for this date"
                                  >
                                    ➕ Track
                                  </button>
                                ) : (
                                  <button 
                                    className="btn-untrack"
                                    onClick={() => handleRemoveFromTracking(task.id)}
                                    title="Remove from tracking for this date"
                                  >
                                    ➖ Untrack
                                  </button>
                                )}
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
                      // Check if allocated equals spent time
                      const isAllocatedEqualSpent = totalAllocated === totalSpent;
                      
                      return (
                        <tr className="total-row">
                          <td 
                            className={`col-task sticky-col sticky-col-1 ${!isAllocatedEqualSpent ? 'total-mismatch-cell' : ''} ${hoveredColumn === -1 ? 'column-highlight' : ''}`}
                            style={{
                              background: !isAllocatedEqualSpent ? '#fed7d7 !important' : undefined,
                              color: !isAllocatedEqualSpent ? '#c53030' : undefined
                            }}
                          >
                            <strong>Total Time</strong><br/>
                            <small style={{ fontSize: '11px', color: !isAllocatedEqualSpent ? '#c53030' : '#666' }}>
                              Allocated: {totalAllocated} min ({totalHours.toFixed(2)}h)
                            </small>
                          </td>
                          <td 
                            className={`col-time sticky-col sticky-col-2 ${!isAllocatedEqualSpent ? 'total-mismatch-cell' : ''}`}
                            style={{ 
                              left: '250px',
                              background: !isAllocatedEqualSpent ? '#fed7d7 !important' : undefined,
                              color: !isAllocatedEqualSpent ? '#c53030' : undefined,
                              fontWeight: 'bold'
                            }}
                          >
                            <strong>{totalSpent} min</strong>
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

          {/* DAILY ONE TIME TASKS SECTION */}
          <div style={{ marginBottom: '32px' }}>
            <h3 className="task-section-header time-based">
              <span className="emoji">⚡</span>
              <span>Daily: One Time Tasks</span>
            </h3>
            <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
              <table className="tasks-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '250px' }}>Task Name</th>
                    <th className="col-time" style={{ width: '120px' }}>Planned Time</th>
                    <th className="col-time" style={{ width: '150px' }}>Spent Time</th>
                    <th className="col-actions" style={{ width: '180px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks
                    .filter(task => task.is_daily_one_time === true)
                    .filter(task => {
                      // Exclude completed and NA tasks (they show in completed section)
                      const dailyStatus = dailyStatuses.get(task.id);
                      if (dailyStatus && (dailyStatus.is_completed || dailyStatus.is_na)) {
                        return false;
                      }
                      // Filter for simple one-time daily tasks
                      return dailyStatus?.is_tracked !== false;
                    })
                    .slice(0, 10)
                    .map((task) => {
                      const dailyStatus = dailyStatuses.get(task.id);
                      const isDailyCompleted = dailyStatus?.is_completed;
                      const isDailyNA = dailyStatus?.is_na;
                      const spentTime = hourLabels.reduce((sum, hour) => sum + getHourlyTime(task.id, hour.index), 0);
                      
                      return (
                        <tr key={task.id} className={isDailyCompleted ? 'completed-row' : isDailyNA ? 'na-row' : ''}>
                          <td style={{ padding: '8px', width: '250px' }}>
                            <div 
                              className="task-name task-link"
                              onClick={() => handleTaskClick(task.id)}
                              style={{ cursor: 'pointer' }}
                              title="Click to edit"
                            >
                              {task.name}
                            </div>
                          </td>
                          <td className="col-time" style={{ width: '120px' }}>
                            {task.allocated_minutes} min
                          </td>
                          <td className="col-time" style={{ width: '120px' }}>
                            <input
                              type="number"
                              min="0"
                              value={spentTime || ''}
                              onChange={(e) => {
                                // Store in first hour slot (0) for simplicity
                                handleHourlyTimeChange(task.id, 0, e.target.value);
                              }}
                              onFocus={(e) => e.target.select()}
                              disabled={isDailyCompleted || isDailyNA || isFutureDate(selectedDate)}
                              className="hour-input"
                              style={{
                                width: '70px',
                                padding: '4px 8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                textAlign: 'center'
                              }}
                            />
                            <span style={{ marginLeft: '4px' }}>min</span>
                          </td>
                          <td className="col-actions" style={{ width: '180px' }}>
                            {isDailyCompleted ? (
                              <div className="action-buttons">
                                <span className="completed-text">✓ Complete (Hidden)</span>
                                <button 
                                  className="btn-undo"
                                  onClick={() => handleUndoComplete(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Undo - bring task back"
                                >
                                  ↩ Undo
                                </button>
                              </div>
                            ) : isDailyNA ? (
                              <div className="action-buttons">
                                <span className="na-text">Inactive</span>
                                <button 
                                  className="btn-undo"
                                  onClick={() => handleUndoComplete(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Undo - bring task back"
                                >
                                  ↩ Undo
                                </button>
                              </div>
                            ) : (
                              <div className="action-buttons">
                                <button 
                                  className="btn-complete"
                                  onClick={() => handleTaskComplete(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Task Complete - won't appear tomorrow"
                                >
                                  Done
                                </button>
                                <button 
                                  className="btn-na"
                                  onClick={() => handleTaskNA(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Mark as Inactive - won't appear tomorrow"
                                >
                                  Inactive
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {filteredTasks.filter(task => task.task_type === TaskType.TIME && task.follow_up_frequency === 'daily').length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                        No one-time daily tasks. Click "Add Task" to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* COUNT-BASED TASKS TABLE */}
          {countBasedTasks.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header count-based">
                <span className="emoji">🔢</span>
                <span>Count-Based Tasks</span>
              </h3>
              <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
                <table className="tasks-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '250px' }}>Task</th>
                      <th className="col-time" style={{ width: '100px' }}>Target</th>
                      <th className="col-time" style={{ width: '150px' }}>Completed</th>
                      <th className="col-actions" style={{ width: '240px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countBasedTasks.map((task, taskIndex) => {
                      // Check daily status for completed/NA for this specific date
                      const dailyStatus = dailyStatuses.get(task.id);
                      const isDailyCompleted = dailyStatus?.is_completed;
                      const isDailyNA = dailyStatus?.is_na;
                      const rowClassName = isDailyCompleted ? 'completed-row' : isDailyNA ? 'na-row' : '';
                      // For count tasks, store in hour 0
                      const value = getHourlyTime(task.id, 0);
                      const target = task.target_value || 0;
                      const isComplete = value >= target;
                      
                      return (
                        <tr key={task.id} className={rowClassName}>
                          <td style={{ padding: '8px', width: '250px' }}>
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
                              className="hour-input count-based-input"
                              style={{ maxWidth: '80px' }}
                              value={value || ''}
                              data-row={taskIndex}
                              data-col="0"
                              data-task-id={task.id}
                              onChange={(e) => handleHourlyTimeChange(task.id, 0, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onWheel={(e) => {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }}
                              onKeyDown={(e) => {
                                const input = e.currentTarget;
                                const row = parseInt(input.getAttribute('data-row') || '0');
                                
                                if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  const allInputs = Array.from(document.querySelectorAll('.count-based-input')) as HTMLInputElement[];
                                  const currentIndex = allInputs.findIndex(inp => inp === input);
                                  if (currentIndex > 0) {
                                    allInputs[currentIndex - 1].focus();
                                  }
                                } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                  e.preventDefault();
                                  const allInputs = Array.from(document.querySelectorAll('.count-based-input')) as HTMLInputElement[];
                                  const currentIndex = allInputs.findIndex(inp => inp === input);
                                  if (currentIndex < allInputs.length - 1) {
                                    allInputs[currentIndex + 1].focus();
                                  }
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
                            {dailyStatus?.is_completed ? (
                              <div className="action-buttons">
                                <span className="completed-text">✓ Complete (Hidden)</span>
                                <button 
                                  className="btn-undo"
                                  onClick={() => handleUndoComplete(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Undo - bring task back"
                                >
                                  ↩ Undo
                                </button>
                              </div>
                            ) : dailyStatus?.is_na ? (
                              <div className="action-buttons">
                                <span className="na-text">Inactive</span>
                                <button 
                                  className="btn-undo"
                                  onClick={() => handleUndoComplete(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Undo - bring task back"
                                >
                                  ↩ Undo
                                </button>
                              </div>
                            ) : (
                              <div className="action-buttons">
                                <button 
                                  className="btn-complete"
                                  onClick={() => handleTaskComplete(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Task Complete - won't appear tomorrow"
                                >
                                  Done
                                </button>
                                <button 
                                  className="btn-na"
                                  onClick={() => handleTaskNA(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Mark as Inactive - won't appear tomorrow"
                                >
                                  Inactive
                                </button>
                                {dailyStatus?.is_tracked === false ? (
                                  <button 
                                    className="btn-track"
                                    onClick={() => handleAddToTracking(task.id)}
                                    title="Add to tracking for this date"
                                  >
                                    ➕ Track
                                  </button>
                                ) : (
                                  <button 
                                    className="btn-untrack"
                                    onClick={() => handleRemoveFromTracking(task.id)}
                                    title="Remove from tracking for this date"
                                  >
                                    🗑️ Delete
                                  </button>
                                )}
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
                <table className="tasks-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '250px' }}>Task</th>
                      <th className="col-time" style={{ width: '100px' }}>Yes ✓</th>
                      <th className="col-actions" style={{ width: '200px' }}>Done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booleanTasks.map((task, taskIndex) => {
                      // Check daily status for completed/NA for this specific date
                      const dailyStatus = dailyStatuses.get(task.id);
                      const isDailyCompleted = dailyStatus?.is_completed;
                      const isDailyNA = dailyStatus?.is_na;
                      
                      const rowClassName = isDailyCompleted ? 'completed-row' : isDailyNA ? 'na-row' : '';
                      // For boolean tasks, store in hour 0
                      const value = getHourlyTime(task.id, 0);
                      const isChecked = value > 0;
                      
                      return (
                        <tr 
                          key={task.id} 
                          className={rowClassName}
                          style={
                            isDailyCompleted
                              ? { backgroundColor: '#c6f6d5' } 
                              : isDailyNA
                                ? { backgroundColor: '#e2e8f0' }
                                : undefined
                          }
                        >
                          <td style={{ padding: '8px', width: '250px' }}>
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
                              disabled={dailyStatus?.is_completed || dailyStatus?.is_na || isFutureDate(selectedDate)}
                              style={{ 
                                width: '20px', 
                                height: '20px', 
                                cursor: 'pointer' 
                              }}
                            />
                          </td>
                          
                          <td className="col-actions">
                            {dailyStatus?.is_completed ? (
                              <div className="action-buttons">
                                <span className="completed-text">✓ Done (Hidden)</span>
                                <button 
                                  className="btn-undo"
                                  onClick={() => handleUndoComplete(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Undo - bring task back"
                                >
                                  ↩ Undo
                                </button>
                              </div>
                            ) : dailyStatus?.is_na ? (
                              <div className="action-buttons">
                                <span className="na-text">Inactive (Hidden)</span>
                                <button 
                                  className="btn-undo"
                                  onClick={() => handleUndoComplete(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Undo - bring task back"
                                >
                                  ↩ Undo
                                </button>
                              </div>
                            ) : (
                              <div className="action-buttons">
                                <button 
                                  className="btn-complete"
                                  onClick={() => handleTaskComplete(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Done - Task complete, won't appear tomorrow"
                                >
                                  Done
                                </button>
                                <button 
                                  className="btn-na"
                                  onClick={() => handleTaskNA(task.id)}
                                  disabled={isFutureDate(selectedDate)}
                                  title="Inactive - Mark inactive, won't appear tomorrow"
                                >
                                  Inactive
                                </button>
                                {dailyStatus?.is_tracked === false ? (
                                  <button 
                                    className="btn-track"
                                    onClick={() => handleAddToTracking(task.id)}
                                    title="Add to tracking for this date"
                                  >
                                    ➕ Track
                                  </button>
                                ) : (
                                  <button 
                                    className="btn-untrack"
                                    onClick={() => handleRemoveFromTracking(task.id)}
                                    title="Remove from tracking for this date"
                                  >
                                    ➖ Untrack
                                  </button>
                                )}
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

          {/* Incomplete Days Alert */}
          {(() => {
            console.log('🔍 Incomplete Days Check:', {
              activeTab,
              incompleteDaysLoaded,
              incompleteDaysLength: incompleteDays.length,
              shouldShow: activeTab === 'daily' && incompleteDaysLoaded && incompleteDays.length > 0
            });
            return null;
          })()}
          {activeTab === 'daily' && incompleteDaysLoaded && incompleteDays.length > 0 && (
            <div className="incomplete-days-section">
              <div className="incomplete-days-alert">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3>⚠️ Incomplete Days ({incompleteDays.length})</h3>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setShowIgnoredDays(!showIgnoredDays)}
                    style={{ fontSize: '14px', padding: '6px 12px' }}
                  >
                    {showIgnoredDays ? 'Hide' : 'View'} Ignored Days ({ignoredDays.length})
                  </button>
                </div>
                <p>These days need attention - Allocated time doesn't match Spent time:</p>
                <div className="incomplete-days-list">
                  {incompleteDays.slice(0, 10).map((day: any) => (
                    <div key={day.entry_date} className="incomplete-day-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        className="incomplete-day-link"
                        style={{ flex: 1 }}
                        onClick={(e) => {
                          e.preventDefault();
                          const dateStr = day.entry_date.split('T')[0];
                          const [year, month, dayNum] = dateStr.split('-').map(Number);
                          const newDate = new Date(year, month - 1, dayNum);
                          newDate.setHours(0, 0, 0, 0);
                          
                          setActiveTab('daily');
                          setSelectedDate(newDate);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <span className="day-date">{formatDate(day.entry_date)}</span>
                        <span className="day-stats">
                          Allocated: {day.total_allocated} min | 
                          Spent: {day.total_spent} min | 
                          <strong className="missing"> Missing: {day.difference} min</strong>
                        </span>
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          const reason = prompt('Reason for ignoring this day (optional):\n(e.g., "Travel", "Sick day", "Holiday")');
                          if (reason !== null) {
                            handleIgnoreDay(day.entry_date, reason || undefined);
                          }
                        }}
                        style={{ 
                          marginLeft: '10px', 
                          padding: '4px 12px', 
                          fontSize: '13px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Ignore
                      </button>
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

          {/* Ignored Days Section */}
          {showIgnoredDays && ignoredDays.length > 0 && (
            <div className="ignored-days-section" style={{ marginTop: '20px' }}>
              <div className="ignored-days-alert" style={{ 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                padding: '20px'
              }}>
                <h3 style={{ color: '#495057', marginBottom: '10px' }}>🏖️ Ignored Days ({ignoredDays.length})</h3>
                <p style={{ color: '#6c757d', marginBottom: '15px' }}>Days marked as travel, sick leave, holidays, etc.</p>
                <div className="ignored-days-list">
                  {ignoredDays.map((day: any) => (
                    <div key={day.entry_date} className="ignored-day-item" style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '12px',
                      backgroundColor: 'white',
                      border: '1px solid #e9ecef',
                      borderRadius: '6px',
                      marginBottom: '10px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#212529', marginBottom: '4px' }}>
                          {formatDate(day.entry_date)}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6c757d' }}>
                          {day.ignore_reason ? (
                            <span>Reason: <em>{day.ignore_reason}</em></span>
                          ) : (
                            <span style={{ fontStyle: 'italic' }}>No reason specified</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#adb5bd', marginTop: '4px' }}>
                          Allocated: {day.total_allocated} min | Spent: {day.total_spent} min
                          {day.ignored_at && ` | Ignored: ${new Date(day.ignored_at).toLocaleDateString()}`}
                        </div>
                      </div>
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          if (confirm('Restore this day to incomplete list?')) {
                            handleUnignoreDay(day.entry_date);
                          }
                        }}
                        style={{ 
                          marginLeft: '10px', 
                          padding: '6px 14px', 
                          fontSize: '13px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Unignore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Completed Daily Tasks Section */}
          {(() => {
            const completedToday = filteredTasks.filter(t => {
              const status = dailyStatuses.get(t.id);
              // Check both daily status completion AND global task completion
              const isCompletedViaStatus = status && status.is_completed;
              const isCompletedGlobally = t.is_completed;
              
              if (t.name.includes('Testing a project task')) {
                console.log('🔍 Testing task check:', {
                  name: t.name,
                  taskId: t.id,
                  hasStatus: !!status,
                  status: status,
                  isCompletedViaStatus,
                  isCompletedGlobally,
                  willShow: isCompletedViaStatus || isCompletedGlobally
                });
              }
              
              return isCompletedViaStatus || isCompletedGlobally;
            });
            
            console.log('Daily tab - Total filteredTasks:', filteredTasks.length);
            console.log('Daily tab - Completed today:', completedToday.length, completedToday.map(t => t.name));
            console.log('Daily tab - All daily statuses:', Array.from(dailyStatuses.entries()).map(([id, status]) => ({
              taskId: id,
              taskName: filteredTasks.find(t => t.id === id)?.name,
              isCompleted: status.is_completed,
              isNA: status.is_na
            })));
            
            // Debug: Check for inactive tasks
            const inactiveTasks = filteredTasks.filter(t => !t.is_active);
            if (inactiveTasks.length > 0) {
              console.log('⚠️ Found INACTIVE tasks in filteredTasks:', inactiveTasks.map(t => ({ name: t.name, id: t.id, is_active: t.is_active, is_completed: t.is_completed })));
            }
            
            // Debug: Check which task is "anothe task 3"
            const anotherTask3 = filteredTasks.find(t => t.name.includes('anothe task 3'));
            if (anotherTask3) {
              const status = dailyStatuses.get(anotherTask3.id);
              console.log('🔍 Found "anothe task 3" in filteredTasks:', {
                id: anotherTask3.id,
                is_active: anotherTask3.is_active,
                is_completed: anotherTask3.is_completed,
                hasStatus: !!status,
                statusIsCompleted: status?.is_completed,
                willShowInCompleted: (status && status.is_completed) || anotherTask3.is_completed
              });
            } else {
              // Task not in filteredTasks - check if it exists in tasks array at all
              const taskInAll = tasks.find(t => t.name.includes('anothe task 3'));
              if (taskInAll) {
                const status = dailyStatuses.get(taskInAll.id);
                console.log('❌ "anothe task 3" NOT in filteredTasks but exists in tasks array:', {
                  id: taskInAll.id,
                  is_active: taskInAll.is_active,
                  is_completed: taskInAll.is_completed,
                  hasStatus: !!status,
                  statusIsCompleted: status?.is_completed,
                  reason: !taskInAll.is_active ? 'is_active = false' : (taskInAll.is_completed ? 'is_completed = true (other tabs)' : 'unknown')
                });
              }
            }
            
            // Always show section if we're on daily tab, even if empty (for debugging)
            // if (completedToday.length === 0) return null;
            
            return (
              <div style={{ marginTop: '40px' }}>
                <h3 
                  onClick={() => setShowCompletedDailyTasks(!showCompletedDailyTasks)}
                  style={{ 
                    marginBottom: '15px', 
                    color: '#059669', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    userSelect: 'none',
                    fontSize: '18px',
                    fontWeight: '600',
                    backgroundColor: '#d1fae5',
                    padding: '12px 16px',
                    borderRadius: '8px'
                  }}
                >
                  {showCompletedDailyTasks ? '▼' : '▶'} ✅ Completed Tasks ({completedToday.length})
                </h3>
                {showCompletedDailyTasks && (
                  <div style={{ 
                    marginTop: '12px',
                    opacity: 0.85,
                    backgroundColor: '#f0fdf4',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '2px solid #86efac'
                  }}>
                    {completedToday.map(task => {
                      const status = dailyStatuses.get(task.id);
                      return (
                        <div 
                          key={task.id}
                          style={{
                            padding: '12px 16px',
                            marginBottom: '8px',
                            backgroundColor: '#ffffff',
                            borderRadius: '6px',
                            border: '1px solid #86efac',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontSize: '14px', 
                              fontWeight: '600', 
                              color: '#065f46',
                              textDecoration: 'line-through',
                              marginBottom: '4px'
                            }}>
                              ✅ {task.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#059669' }}>
                              {task.pillar_name} - {task.category_name}
                              {task.allocated_minutes > 0 && (
                                <span style={{ marginLeft: '12px' }}>
                                  ⏱️ {task.allocated_minutes} minutes
                                </span>
                              )}
                              {status?.completed_at && (
                                <span style={{ marginLeft: '12px' }}>
                                  ⏰ Completed: {new Date(status.completed_at).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              if (confirm(`Restore "${task.name}" back to active tasks?`)) {
                                try {
                                  // Format date as YYYY-MM-DD
                                  const dateStr = selectedDate instanceof Date 
                                    ? selectedDate.toISOString().split('T')[0]
                                    : selectedDate;
                                  
                                  // Reset task status (undo completed/NA)
                                  await api.post(`/api/daily-task-status/${task.id}/reset?status_date=${dateStr}`);
                                  
                                  // Reload statuses
                                  await loadDailyStatuses(selectedDate);
                                  await loadTasks();
                                } catch (err: any) {
                                  console.error('Error restoring task:', err);
                                  alert('Failed to restore task: ' + (err.response?.data?.detail || err.message));
                                }
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '500'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                          >
                            ↩️ Restore
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
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
                  <thead style={{ 
                    display: 'table-header-group', 
                    visibility: 'visible',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    borderBottom: '2px solid #5a67d8'
                  }}>
                    <tr>
                      <th className="col-task sticky-col sticky-col-1" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#667eea' }}>Task</th>
                      <th className="col-time sticky-col sticky-col-2" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#4299e1' }}>Ideal<br/>Average/Day</th>
                      <th className="col-time sticky-col sticky-col-3" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#48bb78' }}>Actual<br/>Average/Day</th>
                      <th className="col-time sticky-col sticky-col-4" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#ed8936' }}>Needed<br/>Average/Day</th>
                      {weekDays.map(day => (
                        <th key={day.index} className="col-hour" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>{day.label}</th>
                      ))}
                      <th className="col-status" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeBasedTasks.map((task) => {
                      const totalSpent = weekDays.reduce((sum, day) => sum + getWeeklyTime(task.id, day.index), 0);
                      const weeklyTarget = task.allocated_minutes * 7;
                      
                      // Calculate days elapsed and actual average
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const weekStart = new Date(selectedWeekStart);
                      weekStart.setHours(0, 0, 0, 0);
                      const weekEnd = new Date(weekStart);
                      weekEnd.setDate(weekEnd.getDate() + 6);
                      
                      let daysElapsed = 1; // Default to at least 1 day
                      if (today >= weekStart) {
                        if (today <= weekEnd) {
                          // Current week: count days from week start to today (inclusive)
                          const diffTime = today.getTime() - weekStart.getTime();
                          daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        } else {
                          // Past week: all 7 days
                          daysElapsed = 7;
                        }
                      }
                      
                      const avgSpentPerDay = Math.round(totalSpent / daysElapsed);
                      const remaining = weeklyTarget - totalSpent;
                      
                      // Calculate days remaining (INCLUDING today)
                      let daysRemaining = 0;
                      if (today >= weekStart && today <= weekEnd) {
                        const diffTime = weekEnd.getTime() - today.getTime();
                        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      }
                      
                      const avgRemainingPerDay = daysRemaining > 0 ? Math.round(remaining / daysRemaining) : 0;
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
                          
                          <td className={`col-time sticky-col sticky-col-2 ${colorClass}`} style={{ textAlign: 'center' }}>
                            {task.allocated_minutes} min
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-3 ${colorClass}`} style={{ textAlign: 'center' }}>
                            {avgSpentPerDay} min
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-4 ${colorClass}`} style={{ textAlign: 'center' }}>
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
                            {/* Show badge if completed/NA via Daily */}
                            {task.is_completed && task.follow_up_frequency === 'daily' ? (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '12px'
                              }}>
                                <span style={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: 'white',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                                }}>
                                  ✓ Completed via Daily
                                </span>
                              </div>
                            ) : !task.is_active && task.follow_up_frequency === 'daily' ? (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '12px'
                              }}>
                                <span style={{
                                  background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                                  color: 'white',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  boxShadow: '0 2px 4px rgba(156, 163, 175, 0.3)'
                                }}>
                                  ⊘ NA via Daily
                                </span>
                              </div>
                            ) : (
                              <div className="action-buttons">
                                <button 
                                  className={`btn-complete ${weeklyTaskStatuses[task.id]?.is_completed ? 'active' : ''}`}
                                  onClick={() => handleWeeklyTaskComplete(task.id)}
                                  title="Mark as completed for this week only"
                                >
                                  COMPLETED
                                </button>
                                <button 
                                  className={`btn-na ${weeklyTaskStatuses[task.id]?.is_na ? 'active' : ''}`}
                                  onClick={() => handleWeeklyTaskNA(task.id)}
                                  title="Mark as NA for this week only"
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
                  <thead style={{ 
                    display: 'table-header-group', 
                    visibility: 'visible',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    borderBottom: '2px solid #5a67d8'
                  }}>
                    <tr>
                      <th className="col-task sticky-col sticky-col-1" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#667eea' }}>Task</th>
                      <th className="col-time sticky-col sticky-col-2" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#4299e1' }}>Ideal<br/>Average/Day</th>
                      <th className="col-time sticky-col sticky-col-3" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#48bb78' }}>Actual<br/>Average/Day</th>
                      <th className="col-time sticky-col sticky-col-4" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#ed8936' }}>Needed<br/>Average/Day</th>
                      {weekDays.map(day => (
                        <th key={day.index} className="col-hour" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>{day.label}</th>
                      ))}
                      <th className="col-status" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countBasedTasks.map((task) => {
                      const totalCount = weekDays.reduce((sum, day) => {
                        return sum + (getWeeklyTime(task.id, day.index) || 0);
                      }, 0);
                      const weeklyTarget = (task.target_value || 0) * 7;
                      
                      // Calculate days elapsed and actual average
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const weekStart = new Date(selectedWeekStart);
                      weekStart.setHours(0, 0, 0, 0);
                      const weekEnd = new Date(weekStart);
                      weekEnd.setDate(weekEnd.getDate() + 6);
                      
                      let daysElapsed = 1; // Default to at least 1 day
                      if (today >= weekStart) {
                        if (today <= weekEnd) {
                          // Current week: count days from week start to today (inclusive)
                          const diffTime = today.getTime() - weekStart.getTime();
                          daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        } else {
                          // Past week: all 7 days
                          daysElapsed = 7;
                        }
                      }
                      
                      const avgCountPerDay = Math.round((totalCount / daysElapsed) * 10) / 10; // Round to 1 decimal
                      const remaining = weeklyTarget - totalCount;
                      
                      // Calculate days remaining (INCLUDING today)
                      let daysRemaining = 0;
                      if (today >= weekStart && today <= weekEnd) {
                        const diffTime = weekEnd.getTime() - today.getTime();
                        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      }
                      
                      const avgRemainingPerDay = daysRemaining > 0 ? Math.round((remaining / daysRemaining) * 10) / 10 : 0;
                      
                      // Check weekly status for completed/NA
                      const weeklyStatus = weeklyTaskStatuses[task.id];
                      const isWeeklyCompleted = weeklyStatus?.is_completed;
                      const isWeeklyNA = weeklyStatus?.is_na;
                      
                      const isComplete = totalCount >= weeklyTarget;
                      const colorClass = getWeeklyRowColorClass(task);
                      const rowClassName = isWeeklyCompleted ? 'completed-row' : isWeeklyNA ? 'na-row' : (isComplete ? 'completed-row' : '');
                      
                      const bgColor = isWeeklyCompleted ? '#c6f6d5' : isWeeklyNA ? '#e2e8f0' : undefined;
                      
                      return (
                        <tr 
                          key={task.id} 
                          className={rowClassName}
                          style={bgColor ? { backgroundColor: bgColor } : undefined}
                        >
                          <td className="col-task sticky-col sticky-col-1" style={bgColor ? { backgroundColor: bgColor } : undefined}>
                            <div className="task-name">
                              {task.name}
                              <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>
                            </div>
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-2 ${colorClass}`} style={{ textAlign: 'center' }}>
                            {task.target_value || 0} {task.unit}
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-3 ${colorClass}`} style={{ textAlign: 'center' }}>
                            {avgCountPerDay} {task.unit}
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-4 ${colorClass}`} style={{ textAlign: 'center' }}>
                            {avgRemainingPerDay} {task.unit}
                          </td>
                          
                          {weekDays.map(day => {
                            const dayCount = getWeeklyTime(task.id, day.index);
                            return (
                              <td key={day.index} className="col-hour" style={{ 
                                backgroundColor: bgColor || (dayCount > 0 ? '#e6ffed' : '#fff'),
                                textAlign: 'center',
                                fontSize: '12px'
                              }}>
                                {dayCount || '-'}
                              </td>
                            );
                          })}
                          
                          <td className="col-status" style={bgColor ? { backgroundColor: bgColor } : undefined}>
                            {/* Show badge if completed/NA via Daily */}
                            {task.is_completed && task.follow_up_frequency === 'daily' ? (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '12px'
                              }}>
                                <span style={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: 'white',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                                }}>
                                  ✓ Completed via Daily
                                </span>
                              </div>
                            ) : !task.is_active && task.follow_up_frequency === 'daily' ? (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '12px'
                              }}>
                                <span style={{
                                  background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                                  color: 'white',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  boxShadow: '0 2px 4px rgba(156, 163, 175, 0.3)'
                                }}>
                                  ⊘ NA via Daily
                                </span>
                              </div>
                            ) : (
                              <div className="action-buttons">
                                {/* Add Edit button for all tasks in Weekly tab */}
                                <button 
                                  className="btn-edit"
                                  onClick={() => handleEditRegularTask(task)}
                                  title="Edit task"
                                >
                                  EDIT
                                </button>
                                <button 
                                  className={`btn-complete ${weeklyTaskStatuses[task.id]?.is_completed ? 'active' : ''}`}
                                  onClick={() => handleWeeklyTaskComplete(task.id)}
                                  title="Mark as completed for this week only"
                                >
                                  COMPLETED
                                </button>
                                <button 
                                  className={`btn-na ${weeklyTaskStatuses[task.id]?.is_na ? 'active' : ''}`}
                                  onClick={() => handleWeeklyTaskNA(task.id)}
                                  title="Mark as NA for this week only"
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
                <span className="subtitle">(Auto-calculated from Daily)</span>
              </h3>
              <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
                <table className="tasks-table daily-table">
                  <thead style={{ 
                    display: 'table-header-group', 
                    visibility: 'visible',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    borderBottom: '2px solid #5a67d8'
                  }}>
                    <tr>
                      <th className="col-task sticky-col sticky-col-1" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#667eea' }}>Task</th>
                      <th className="col-time sticky-col sticky-col-2" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#4299e1' }}>Days Completed</th>
                      <th className="col-time sticky-col sticky-col-3" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#48bb78' }}>Completion Rate</th>
                      <th className="col-time sticky-col sticky-col-4" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#ed8936' }}>Current Streak</th>
                      {weekDays.map(day => (
                        <th key={day.index} className="col-hour" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>{day.label}</th>
                      ))}
                      <th className="col-status" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Actions</th>
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
                            {/* Show badge if completed/NA via Daily */}
                            {task.is_completed && task.follow_up_frequency === 'daily' ? (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '12px'
                              }}>
                                <span style={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: 'white',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                                }}>
                                  ✓ Completed via Daily
                                </span>
                              </div>
                            ) : !task.is_active && task.follow_up_frequency === 'daily' ? (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '12px'
                              }}>
                                <span style={{
                                  background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                                  color: 'white',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  boxShadow: '0 2px 4px rgba(156, 163, 175, 0.3)'
                                }}>
                                  ⊘ NA via Daily
                                </span>
                              </div>
                            ) : (
                              <div className="action-buttons">
                                {/* Add Edit button for all tasks in Weekly tab */}
                                <button 
                                  className="btn-edit"
                                  onClick={() => handleEditRegularTask(task)}
                                  title="Edit task"
                                >
                                  EDIT
                                </button>
                                <button 
                                  className={`btn-complete ${weeklyTaskStatuses[task.id]?.is_completed ? 'active' : ''}`}
                                  onClick={() => handleWeeklyTaskComplete(task.id)}
                                  title="Mark as completed for this week only"
                                >
                                  COMPLETED
                                </button>
                                <button 
                                  className={`btn-na ${weeklyTaskStatuses[task.id]?.is_na ? 'active' : ''}`}
                                  onClick={() => handleWeeklyTaskNA(task.id)}
                                  title="Mark as NA for this week only"
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
      ) : activeTab === 'monthly' ? (
        /* MONTHLY TAB: Three separate tables with aggregated data from daily */
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
                  <thead style={{ 
                    display: 'table-header-group', 
                    visibility: 'visible',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    borderBottom: '2px solid #5a67d8'
                  }}>
                    <tr>
                      <th className="col-task sticky-col sticky-col-1" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#667eea' }}>Task</th>
                      <th className="col-time sticky-col sticky-col-2" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#4299e1' }}>Ideal<br/>Average/Day</th>
                      <th className="col-time sticky-col sticky-col-3" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#48bb78' }}>Actual<br/>Average/Day</th>
                      <th className="col-time sticky-col sticky-col-4" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#ed8936' }}>Needed<br/>Average/Day</th>
                      {(() => {
                        const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
                        const days = [];
                        for (let i = 1; i <= daysInMonth; i++) {
                          days.push(<th key={i} className="col-hour" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>{i}</th>);
                        }
                        return days;
                      })()}
                      <th className="col-status" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeBasedTasks.map((task) => {
                      const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
                      let totalSpent = 0;
                      for (let day = 1; day <= daysInMonth; day++) {
                        totalSpent += getMonthlyTime(task.id, day);
                      }
                      
                      const monthlyTarget = task.allocated_minutes * daysInMonth;
                      
                      // Calculate days elapsed and actual average
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const monthStart = new Date(selectedMonthStart);
                      monthStart.setHours(0, 0, 0, 0);
                      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
                      monthEnd.setHours(0, 0, 0, 0);
                      
                      let daysElapsed = 1; // Default to at least 1 day
                      if (today >= monthStart) {
                        if (today <= monthEnd) {
                          // Current month: count days from month start to today (inclusive)
                          const diffTime = today.getTime() - monthStart.getTime();
                          daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        } else {
                          // Past month: all days in month
                          daysElapsed = daysInMonth;
                        }
                      }
                      
                      const avgSpentPerDay = Math.round(totalSpent / daysElapsed);
                      const remaining = monthlyTarget - totalSpent;
                      
                      // Calculate days remaining (INCLUDING today)
                      let daysRemaining = 0;
                      if (today >= monthStart && today <= monthEnd) {
                        const diffTime = monthEnd.getTime() - today.getTime();
                        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      }
                      
                      const avgRemainingPerDay = daysRemaining > 0 ? Math.round(remaining / daysRemaining) : 0;
                      const isComplete = totalSpent >= monthlyTarget;
                      const colorClass = getMonthlyRowColorClass(task);
                      const rowClassName = isComplete ? 'completed-row' : '';
                      
                      return (
                        <tr key={task.id} className={rowClassName}>
                          <td className={`col-task sticky-col sticky-col-1 ${colorClass}`}>
                            <div className="task-name">
                              {task.name}
                              <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>
                            </div>
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-2 ${colorClass}`} style={{ textAlign: 'center' }}>
                            {task.allocated_minutes} min
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-3 ${colorClass}`} style={{ textAlign: 'center' }}>
                            {avgSpentPerDay} min
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-4 ${colorClass}`} style={{ textAlign: 'center' }}>
                            {avgRemainingPerDay} min
                          </td>
                          
                          {(() => {
                            const days = [];
                            for (let day = 1; day <= daysInMonth; day++) {
                              const dayTotal = getMonthlyTime(task.id, day);
                              days.push(
                                <td key={day} className="col-hour" style={{ 
                                  backgroundColor: dayTotal > 0 ? '#e6ffed' : '#fff',
                                  textAlign: 'center',
                                  fontSize: '12px'
                                }}>
                                  {dayTotal || '-'}
                                </td>
                              );
                            }
                            return days;
                          })()}
                          
                          <td className="col-status">
                            {/* Show badge if completed/NA via Daily */}
                            {task.is_completed && task.follow_up_frequency === 'daily' ? (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '12px'
                              }}>
                                <span style={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: 'white',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                                }}>
                                  ✓ Completed via Daily
                                </span>
                              </div>
                            ) : !task.is_active && task.follow_up_frequency === 'daily' ? (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '12px'
                              }}>
                                <span style={{
                                  background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                                  color: 'white',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  boxShadow: '0 2px 4px rgba(156, 163, 175, 0.3)'
                                }}>
                                  ⊘ NA via Daily
                                </span>
                              </div>
                            ) : (
                              <div className="action-buttons">
                                <button 
                                  className={`btn-complete ${monthlyTaskStatuses[task.id]?.is_completed ? 'active' : ''}`}
                                  onClick={() => handleMonthlyTaskComplete(task.id)}
                                  title="Mark as completed for this month only"
                                >
                                  COMPLETED
                                </button>
                                <button 
                                  className={`btn-na ${monthlyTaskStatuses[task.id]?.is_na ? 'active' : ''}`}
                                  onClick={() => handleMonthlyTaskNA(task.id)}
                                  title="Mark as NA for this month only"
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

          {/* MANUAL ENTRY TASKS TABLE */}
          {filteredTasks.filter(task => task.task_type !== TaskType.TIME && task.follow_up_frequency !== 'daily').length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="task-section-header">
                <span className="emoji">✏️</span>
                <span>Manual Entry Tasks</span>
              </h3>
              <div className="tasks-table-container" style={{ borderRadius: '0 0 8px 8px' }}>
                <table className="tasks-table daily-table">
                  <thead style={{ 
                    display: 'table-header-group', 
                    visibility: 'visible',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    borderBottom: '2px solid #5a67d8'
                  }}>
                    <tr>
                      <th className="col-task sticky-col sticky-col-1" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#667eea' }}>Task</th>
                      <th className="col-time sticky-col sticky-col-2" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#4299e1' }}>Allocated</th>
                      <th className="col-time sticky-col sticky-col-3" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#48bb78' }}>Spent<br/>(Average)</th>
                      <th className="col-time sticky-col sticky-col-4" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#ed8936' }}>Needed<br/>Average/Day</th>
                      {(() => {
                        const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
                        const days = [];
                        for (let i = 1; i <= daysInMonth; i++) {
                          days.push(<th key={i} className="col-hour" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>{i}</th>);
                        }
                        return days;
                      })()}
                      <th className="col-status" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.filter(task => task.task_type !== TaskType.TIME && task.follow_up_frequency !== 'daily').map((task) => {
                      const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
                      let totalSpent = 0;
                      for (let day = 1; day <= daysInMonth; day++) {
                        totalSpent += getMonthlyTime(task.id, day);
                      }
                      
                      // Calculate monthly target
                      let monthlyTarget = 0;
                      if (task.task_type === TaskType.COUNT) {
                        if (task.follow_up_frequency === 'weekly') {
                          monthlyTarget = Math.round((task.target_value || 0) * (daysInMonth / 7));
                        } else {
                          monthlyTarget = task.target_value || 0;
                        }
                      } else {
                        if (task.follow_up_frequency === 'weekly') {
                          monthlyTarget = Math.round(task.allocated_minutes * (daysInMonth / 7));
                        } else {
                          monthlyTarget = task.allocated_minutes;
                        }
                      }
                      
                      // Calculate days elapsed and actual average
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const monthStart = new Date(selectedMonthStart);
                      monthStart.setHours(0, 0, 0, 0);
                      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
                      monthEnd.setHours(0, 0, 0, 0);
                      
                      let daysElapsed = 1;
                      if (today >= monthStart) {
                        if (today <= monthEnd) {
                          const diffTime = today.getTime() - monthStart.getTime();
                          daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        } else {
                          daysElapsed = daysInMonth;
                        }
                      }
                      
                      const avgSpentPerDay = Math.round(totalSpent / daysElapsed);
                      const remaining = monthlyTarget - totalSpent;
                      
                      // Calculate days remaining (INCLUDING today)
                      let daysRemaining = 0;
                      if (today >= monthStart && today <= monthEnd) {
                        const diffTime = monthEnd.getTime() - today.getTime();
                        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      }
                      
                      const avgRemainingPerDay = daysRemaining > 0 ? Math.round(remaining / daysRemaining) : 0;
                      
                      const monthlyStatus = monthlyTaskStatuses[task.id];
                      const isMonthlyCompleted = monthlyStatus?.is_completed;
                      const isMonthlyNA = monthlyStatus?.is_na;
                      const colorClass = getMonthlyRowColorClass(task);
                      const rowClassName = isMonthlyCompleted ? 'completed-row' : isMonthlyNA ? 'na-row' : '';
                      const bgColor = isMonthlyCompleted ? '#c6f6d5' : isMonthlyNA ? '#e2e8f0' : undefined;
                      
                      return (
                        <tr key={task.id} className={rowClassName} style={bgColor ? { backgroundColor: bgColor } : undefined}>
                          <td className={`col-task sticky-col sticky-col-1 ${colorClass}`} style={bgColor ? { backgroundColor: bgColor } : undefined}>
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
                          
                          <td className={`col-time sticky-col sticky-col-2 ${colorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
                            {formatTaskTarget(task, true, true)}
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-3 ${colorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
                            {formatTaskValue(task, avgSpentPerDay)}
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-4 ${colorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
                            {formatTaskValue(task, avgRemainingPerDay)}
                          </td>
                          
                          {(() => {
                            const days = [];
                            for (let day = 1; day <= daysInMonth; day++) {
                              const dayTotal = getMonthlyTime(task.id, day);
                              const isBoolean = task.task_type === TaskType.BOOLEAN;
                              
                              days.push(
                                <td key={day} className={`col-hour ${colorClass}`} style={bgColor ? { backgroundColor: bgColor } : undefined}>
                                  {isBoolean ? (
                                    <input
                                      type="checkbox"
                                      checked={dayTotal > 0}
                                      onChange={(e) => handleMonthlyTimeChange(task.id, day, e.target.checked ? '1' : '0')}
                                      disabled={isMonthlyCompleted || isMonthlyNA}
                                      className="hour-input"
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={dayTotal || ''}
                                      onChange={(e) => handleMonthlyTimeChange(task.id, day, e.target.value)}
                                      disabled={isMonthlyCompleted || isMonthlyNA}
                                      placeholder="-"
                                      className="hour-input"
                                    />
                                  )}
                                </td>
                              );
                            }
                            return days;
                          })()}
                          
                          <td className="col-status" style={bgColor ? { backgroundColor: bgColor } : undefined}>
                            <div className="action-buttons">
                              <button 
                                className={`btn-complete ${isMonthlyCompleted ? 'active' : ''}`}
                                onClick={() => handleMonthlyTaskComplete(task.id)}
                                title="Mark as completed for this month only"
                              >
                                COMPLETED
                              </button>
                              <button 
                                className={`btn-na ${isMonthlyNA ? 'active' : ''}`}
                                onClick={() => handleMonthlyTaskNA(task.id)}
                                title="Mark as NA for this month only"
                              >
                                NA
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
                  <thead style={{ 
                    display: 'table-header-group', 
                    visibility: 'visible',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    borderBottom: '2px solid #5a67d8'
                  }}>
                    <tr>
                      <th className="col-task sticky-col sticky-col-1" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'left', background: '#667eea' }}>Task</th>
                      <th className="col-time sticky-col sticky-col-2" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#4299e1' }}>Ideal<br/>Average/Day</th>
                      <th className="col-time sticky-col sticky-col-3" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#48bb78' }}>Actual<br/>Average/Day</th>
                      <th className="col-time sticky-col sticky-col-4" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', background: '#ed8936' }}>Needed<br/>Average/Day</th>
                      {(() => {
                        const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
                        const days = [];
                        for (let i = 1; i <= daysInMonth; i++) {
                          days.push(<th key={i} className="col-hour" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>{i}</th>);
                        }
                        return days;
                      })()}
                      <th className="col-status" style={{ color: '#ffffff', padding: '12px 8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countBasedTasks.map((task) => {
                      const daysInMonth = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate();
                      let totalCount = 0;
                      for (let day = 1; day <= daysInMonth; day++) {
                        totalCount += getMonthlyTime(task.id, day);
                      }
                      
                      const monthlyTarget = (task.target_value || 0) * daysInMonth;
                      
                      // Calculate days elapsed and actual average
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const monthStart = new Date(selectedMonthStart);
                      monthStart.setHours(0, 0, 0, 0);
                      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
                      monthEnd.setHours(23, 59, 59, 999);
                      
                      let daysElapsed = 1;
                      if (today >= monthStart) {
                        if (today <= monthEnd) {
                          daysElapsed = today.getDate();
                        } else {
                          daysElapsed = daysInMonth;
                        }
                      }
                      
                      const avgCountPerDay = Math.round((totalCount / daysElapsed) * 10) / 10;
                      const remaining = monthlyTarget - totalCount;
                      
                      let daysRemaining = 0;
                      if (today >= monthStart && today <= monthEnd) {
                        daysRemaining = daysInMonth - today.getDate() + 1;
                      }
                      
                      const avgRemainingPerDay = daysRemaining > 0 ? Math.round((remaining / daysRemaining) * 10) / 10 : 0;
                      
                      const monthlyStatus = monthlyTaskStatuses[task.id];
                      const isMonthlyCompleted = monthlyStatus?.is_completed;
                      const isMonthlyNA = monthlyStatus?.is_na;
                      
                      const isComplete = totalCount >= monthlyTarget;
                      const colorClass = getMonthlyRowColorClass(task);
                      const rowClassName = isMonthlyCompleted ? 'completed-row' : isMonthlyNA ? 'na-row' : (isComplete ? 'completed-row' : '');
                      const bgColor = isMonthlyCompleted ? '#c6f6d5' : isMonthlyNA ? '#e2e8f0' : undefined;
                      
                      return (
                        <tr key={task.id} className={rowClassName} style={bgColor ? { backgroundColor: bgColor } : undefined}>
                          <td className={`col-task sticky-col sticky-col-1 ${colorClass}`} style={bgColor ? { backgroundColor: bgColor } : undefined}>
                            <div className="task-name">
                              {task.name}
                              <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Daily)</span>
                            </div>
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-2 ${colorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
                            {task.target_value || 0} {task.unit}
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-3 ${colorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
                            {avgCountPerDay} {task.unit}
                          </td>
                          
                          <td className={`col-time sticky-col sticky-col-4 ${colorClass}`} style={{ textAlign: 'center', ...(bgColor ? { backgroundColor: bgColor } : {}) }}>
                            {avgRemainingPerDay} {task.unit}
                          </td>
                          
                          {(() => {
                            const days = [];
                            for (let day = 1; day <= daysInMonth; day++) {
                              const dayCount = getMonthlyTime(task.id, day);
                              days.push(
                                <td key={day} className={`col-hour ${colorClass}`} style={{ 
                                  backgroundColor: bgColor || (dayCount > 0 ? '#e6ffed' : '#fff'),
                                  textAlign: 'center',
                                  fontSize: '12px'
                                }}>
                                  {dayCount || '-'}
                                </td>
                              );
                            }
                            return days;
                          })()}
                          
                          <td className="col-status" style={bgColor ? { backgroundColor: bgColor } : undefined}>
                            <div className="action-buttons">
                              <button 
                                className={`btn-complete ${isMonthlyCompleted ? 'active' : ''}`}
                                onClick={() => handleMonthlyTaskComplete(task.id)}
                                title="Mark as completed for this month only"
                              >
                                COMPLETED
                              </button>
                              <button 
                                className={`btn-na ${isMonthlyNA ? 'active' : ''}`}
                                onClick={() => handleMonthlyTaskNA(task.id)}
                                title="Mark as NA for this month only"
                              >
                                NA
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
          )}
        </>
      ) : (
        /* OTHER TABS: Keep existing single table */
        <>
          {/* Habits & Challenges Section moved to bottom of Today tab - see after Needs Attention section */}
          {activeTab === 'never-show-here' && (todaysHabits.length > 0 || todaysChallenges.length > 0) && (
            <div style={{ marginBottom: '30px' }}>
              {/* Active Habits Section */}
              {todaysHabits.length > 0 && (
                <div style={{ marginBottom: '25px' }}>
                  <h3 style={{ marginBottom: '15px', color: '#2d3748', fontSize: '22px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>🔥</span>
                    <span>Active Habits Today</span>
                    <span style={{ fontSize: '14px', fontWeight: '400', color: '#718096' }}>({todaysHabits.length})</span>
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                    {todaysHabits.map(habit => (
                      <div
                        key={habit.id}
                        style={{
                          background: 'linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)',
                          border: `2px solid ${habit.pillar_color || '#e2e8f0'}`,
                          borderRadius: '12px',
                          padding: '16px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                        }}
                      >
                        {/* Header */}
                        <div style={{ marginBottom: '10px' }}>
                          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#2d3748', marginBottom: '4px' }}>
                            {habit.name}
                          </h4>
                          {habit.pillar_name && (
                            <div style={{ fontSize: '12px', color: '#718096', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: habit.pillar_color || '#cbd5e0', display: 'inline-block' }}></span>
                              {habit.pillar_name}
                              {habit.category_name && ` • ${habit.category_name}`}
                            </div>
                          )}
                        </div>

                        {/* Streak Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', fontWeight: '600', color: habit.current_streak > 0 ? '#f56565' : '#a0aec0' }}>
                            <span style={{ fontSize: '18px' }}>🔥</span>
                            <span>{habit.current_streak} days</span>
                          </div>
                          {habit.longest_streak > 0 && (
                            <div style={{ fontSize: '12px', color: '#718096' }}>
                              Best: {habit.longest_streak}
                            </div>
                          )}
                        </div>

                        {/* Target Info */}
                        {habit.target_value && (
                          <div style={{ fontSize: '13px', color: '#4a5568', marginTop: '6px' }}>
                            Target: {habit.target_value} {habit.session_target_unit || 'min'} {habit.target_comparison === 'at_least' ? '(minimum)' : habit.target_comparison === 'at_most' ? '(maximum)' : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Challenges Section */}
              {todaysChallenges.length > 0 && (
                <div>
                  <h3 style={{ marginBottom: '15px', color: '#2d3748', fontSize: '22px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>🎯</span>
                    <span>Active Challenges</span>
                    <span style={{ fontSize: '14px', fontWeight: '400', color: '#718096' }}>({todaysChallenges.length})</span>
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '15px' }}>
                    {todaysChallenges.map(challenge => {
                      const statusColors = {
                        on_track: '#48bb78',
                        at_risk: '#ed8936',
                        behind: '#f56565'
                      };
                      const statusLabels = {
                        on_track: '🟢 On Track',
                        at_risk: '🟡 At Risk',
                        behind: '🔴 Behind'
                      };
                      
                      return (
                        <div
                          key={challenge.id}
                          style={{
                            background: 'linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)',
                            border: `2px solid ${challenge.pillar_color || '#e2e8f0'}`,
                            borderRadius: '12px',
                            padding: '16px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                          }}
                        >
                          {/* Header */}
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#2d3748' }}>
                                {challenge.name}
                              </h4>
                              <span style={{ fontSize: '12px', fontWeight: '600', color: statusColors[challenge.status_indicator as keyof typeof statusColors] || '#718096', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                {statusLabels[challenge.status_indicator as keyof typeof statusLabels] || challenge.status_indicator}
                              </span>
                            </div>
                            {challenge.pillar_name && (
                              <div style={{ fontSize: '12px', color: '#718096', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: challenge.pillar_color || '#cbd5e0', display: 'inline-block' }}></span>
                                {challenge.pillar_name}
                                {challenge.category_name && ` • ${challenge.category_name}`}
                              </div>
                            )}
                          </div>

                          {/* Progress Bar */}
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#4a5568', marginBottom: '4px' }}>
                              <span>Progress</span>
                              <span style={{ fontWeight: '600' }}>{challenge.progress_percentage.toFixed(0)}%</span>
                            </div>
                            <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ 
                                height: '100%', 
                                width: `${Math.min(challenge.progress_percentage, 100)}%`,
                                background: `linear-gradient(90deg, ${challenge.pillar_color || '#4299e1'} 0%, ${challenge.pillar_color ? challenge.pillar_color + 'dd' : '#3182ce'} 100%)`,
                                transition: 'width 0.3s ease'
                              }}></div>
                            </div>
                          </div>

                          {/* Challenge Stats */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
                            <div>
                              <span style={{ color: '#718096' }}>Days Remaining:</span>
                              <span style={{ fontWeight: '600', color: '#2d3748', marginLeft: '4px' }}>{challenge.days_remaining}</span>
                            </div>
                            <div>
                              <span style={{ color: '#718096' }}>Current Streak:</span>
                              <span style={{ fontWeight: '600', color: '#2d3748', marginLeft: '4px' }}>{challenge.current_streak}</span>
                            </div>
                          </div>

                          {/* Target Progress */}
                          <div style={{ fontSize: '13px', color: '#4a5568', marginBottom: '12px' }}>
                            {challenge.challenge_type === 'daily_streak' && (
                              <span>{challenge.completed_days} / {challenge.target_days} days completed</span>
                            )}
                            {challenge.challenge_type === 'count_based' && (
                              <span>{challenge.current_count} / {challenge.target_count} {challenge.unit}</span>
                            )}
                            {challenge.challenge_type === 'accumulation' && (
                              <span>{challenge.current_value.toFixed(1)} / {challenge.target_value} {challenge.unit}</span>
                            )}
                          </div>

                          {/* Log Today Button */}
                          <button
                            onClick={async () => {
                              try {
                                await api.post(`/api/challenges/${challenge.id}/log-today?is_completed=true`);
                                loadTodaysChallenges();
                              } catch (err) {
                                console.error('Error logging challenge:', err);
                              }
                            }}
                            disabled={challenge.completed_today}
                            style={{
                              width: '100%',
                              padding: '8px',
                              backgroundColor: challenge.completed_today ? '#e2e8f0' : (challenge.pillar_color || '#4299e1'),
                              color: challenge.completed_today ? '#718096' : '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: challenge.completed_today ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => {
                              if (!challenge.completed_today) {
                                e.currentTarget.style.opacity = '0.9';
                              }
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.opacity = '1';
                            }}
                          >
                            {challenge.completed_today ? '✓ Logged Today' : '+ Log Today'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task Breakdown Panel - Today Tab */}
          {activeTab === 'today' && (() => {
            // Count tasks from different sections ON TODAY TAB
            const projectCount = projectTasksDueToday.length;
            const goalCount = goalTasksDueToday.length;
            const miscCount = miscTasksDueToday.length;
            const importantCount = importantTasksDueToday.length;
            
            // Count today's habits and challenges
            const habitsCount = todaysHabits.length + todaysChallenges.length;
            
            // Count upcoming tasks (next 7 days + this month)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const next7Days = new Date(today);
            next7Days.setDate(next7Days.getDate() + 7);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            
            const upcomingCount = tasks.filter(task => {
              if (!task.is_active || task.is_completed || !task.due_date) return false;
              const dueDate = parseDateString(task.due_date);
              dueDate.setHours(0, 0, 0, 0);
              return dueDate > today && dueDate <= monthEnd;
            }).length;
            
            // Count Needs Attention tasks on Today tab
            const weeklyNeedsAttentionCount = tasksNeedingAttention.filter(item => 
              item.reason === 'weekly' && (!item.task.priority || item.task.priority > 3)
            ).length;
            const monthlyNeedsAttentionCount = tasksNeedingAttention.filter(item => 
              item.reason === 'monthly' && (!item.task.priority || item.task.priority > 3)
            ).length;
            const quarterlyNeedsAttentionCount = tasksNeedingAttention.filter(item => 
              item.reason === 'quarterly' && (!item.task.priority || item.task.priority > 3)
            ).length;
            const yearlyNeedsAttentionCount = tasksNeedingAttention.filter(item => 
              item.reason === 'yearly' && (!item.task.priority || item.task.priority > 3)
            ).length;
            
            // Calculate total using the same filtered counts as displayed
            const totalTasks = projectCount + goalCount + miscCount + importantCount + habitsCount + weeklyNeedsAttentionCount + monthlyNeedsAttentionCount + quarterlyNeedsAttentionCount + yearlyNeedsAttentionCount;

            // Scroll to section helper
            const scrollToSection = (sectionId: string) => {
              const element = document.getElementById(sectionId);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            };

            return (
              <div id="today-tab-tasks" style={{
                backgroundColor: '#ffffff',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '16px',
                marginTop: '20px',
                border: '2px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                scrollMarginTop: '80px'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#2d3748' }}>
                  📈 Overdue Tasks: Today's Tab
                </h4>
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap',
                  fontSize: '13px'
                }}>
                  {/* Total */}
                  <div style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    fontWeight: '600',
                    border: '2px solid #2563eb'
                  }}>
                    Total: {totalTasks}
                  </div>

                  {/* Project Tasks */}
                  {projectCount > 0 && (
                  <button
                    onClick={() => scrollToSection('project-tasks-section')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#f0f9ff',
                      color: '#0c4a6e',
                      fontWeight: '500',
                      border: '1px solid #bae6fd',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = '#e0f2fe';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = '#f0f9ff';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    📋 Projects: {projectCount}
                  </button>
                  )}

                  {/* Goal Tasks */}
                  {goalCount > 0 && (
                  <button
                    onClick={() => scrollToSection('goal-tasks-section')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#f0fdf4',
                      color: '#14532d',
                      fontWeight: '500',
                      border: '1px solid #bbf7d0',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = '#dcfce7';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = '#f0fdf4';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    🎯 Goals: {goalCount}
                  </button>
                  )}

                  {/* Misc Tasks */}
                  {miscCount > 0 && (
                  <button
                    onClick={() => scrollToSection('misc-tasks-section')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#faf5ff',
                      color: '#581c87',
                      fontWeight: '500',
                      border: '1px solid #e9d5ff',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = '#f3e8ff';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = '#faf5ff';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    📝 Misc: {miscCount}
                  </button>
                  )}

                  {/* Important Tasks */}
                  {importantCount > 0 && (
                  <button
                    onClick={() => scrollToSection('important-tasks-section')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#fffbeb',
                      color: '#78350f',
                      fontWeight: '500',
                      border: '1px solid #fde68a',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = '#fef3c7';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = '#fffbeb';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    ⚡ Important: {importantCount}
                  </button>
                  )}

                  {/* Habits */}
                  {habitsCount > 0 && (
                  <button
                    onClick={() => scrollToSection('habits-section')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#fef2f2',
                      color: '#7f1d1d',
                      fontWeight: '500',
                      border: '1px solid #fecaca',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = '#fee2e2';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = '#fef2f2';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    💪 Habits: {habitsCount}
                  </button>
                  )}
                  
                  {/* Weekly Needs Attention */}
                  {weeklyNeedsAttentionCount > 0 && (
                    <button
                      onClick={() => scrollToSection('weekly-needs-attention-section')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        fontWeight: '500',
                        border: '1px solid #fca5a5',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = '#fecaca';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = '#fee2e2';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      ⚠️ Weekly: {weeklyNeedsAttentionCount}
                    </button>
                  )}
                  
                  {/* Monthly Needs Attention */}
                  {monthlyNeedsAttentionCount > 0 && (
                    <button
                      onClick={() => scrollToSection('monthly-needs-attention-section')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        backgroundColor: '#fed7aa',
                        color: '#7c2d12',
                        fontWeight: '500',
                        border: '1px solid #fdba74',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = '#fdba74';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = '#fed7aa';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      📊 Monthly: {monthlyNeedsAttentionCount}
                    </button>
                  )}
                  
                  {/* Quarterly Needs Attention */}
                  {quarterlyNeedsAttentionCount > 0 && (
                    <button
                      onClick={() => scrollToSection('quarterly-needs-attention-section')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        backgroundColor: '#e9d5ff',
                        color: '#581c87',
                        fontWeight: '500',
                        border: '1px solid #d8b4fe',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = '#d8b4fe';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = '#e9d5ff';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      📅 Quarterly: {quarterlyNeedsAttentionCount}
                    </button>
                  )}
                  
                  {/* Yearly Needs Attention */}
                  {yearlyNeedsAttentionCount > 0 && (
                    <button
                      onClick={() => scrollToSection('yearly-needs-attention-section')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        backgroundColor: '#dbeafe',
                        color: '#1e3a8a',
                        fontWeight: '500',
                        border: '1px solid #93c5fd',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = '#bfdbfe';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = '#dbeafe';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      📆 Yearly: {yearlyNeedsAttentionCount}
                    </button>
                  )}

                  {/* Upcoming (not part of total) */}
                  {upcomingCount > 0 && (
                  <button
                    onClick={() => scrollToSection('upcoming-tasks-section')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#f5f5f5',
                      color: '#404040',
                      fontWeight: '500',
                      border: '1px solid #d4d4d4',
                      opacity: 0.8,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = '#e5e5e5';
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                      e.currentTarget.style.opacity = '0.8';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    📅 Upcoming: {upcomingCount}
                  </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Monthly Planning Overview Panel - Today Tab */}
          {activeTab === 'today' && (() => {
            // Gather all tasks from Today tab (excluding Upcoming Tasks section)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const allTodayTasks = [
              ...projectTasksDueToday,
              ...goalTasksDueToday,
              ...miscTasksDueToday,
              ...overdueOneTimeTasks.map(ot => tasks.find(t => t.id === ot.task_id)).filter(Boolean)
            ].filter(task => !task.is_completed); // Exclude completed tasks from counts

            // Group by due date month
            const tasksByMonth: Record<string, typeof allTodayTasks> = {};
            
            allTodayTasks.forEach(task => {
              if (task && task.due_date) {
                const datePart = task.due_date.split('T')[0];
                const dueDate = parseDateString(datePart);
                const key = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
                
                if (!tasksByMonth[key]) {
                  tasksByMonth[key] = [];
                }
                tasksByMonth[key].push(task);
              }
            });

            // Sort months chronologically
            const sortedMonths = Object.entries(tasksByMonth)
              .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

            if (sortedMonths.length === 0) return null;

            const now = new Date();
            const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            return (
              <div style={{
                backgroundColor: '#f7fafc',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '20px',
                marginTop: '20px',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#2d3748' }}>
                  📊 Overdue Tasks: Monthly
                </h4>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  fontSize: '13px'
                }}>
                  {/* All Tasks badge */}
                  <button
                    onClick={() => setSelectedTodayMonth(null)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: selectedTodayMonth === null ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                      backgroundColor: selectedTodayMonth === null ? '#eff6ff' : '#ffffff',
                      color: selectedTodayMonth === null ? '#1e40af' : '#64748b',
                      cursor: 'pointer',
                      fontWeight: selectedTodayMonth === null ? '600' : '500',
                      fontSize: '13px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      if (selectedTodayMonth !== null) {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#94a3b8';
                      }
                    }}
                    onMouseLeave={e => {
                      if (selectedTodayMonth !== null) {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }
                    }}
                  >
                    🗂️ All Tasks ({allTodayTasks.length})
                  </button>

                  {/* Month badges */}
                  {sortedMonths.map(([monthKey, tasks]) => {
                    const [year, month] = monthKey.split('-');
                    const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                    const label = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    const completed = tasks.filter(t => t.is_completed).length;
                    const total = tasks.length;
                    const isPast = monthKey < currentMonthKey;
                    const isCurrent = monthKey === currentMonthKey;
                    const isFuture = monthKey > currentMonthKey;
                    const hasIncomplete = completed < total;

                    let bgColor = '#ffffff';
                    let borderColor = '#cbd5e1';
                    let textColor = '#64748b';
                    let statusEmoji = '';

                    if (selectedTodayMonth === monthKey) {
                      bgColor = '#eff6ff';
                      borderColor = '#3b82f6';
                      textColor = '#1e40af';
                    } else if (isPast && hasIncomplete) {
                      bgColor = '#fef2f2';
                      borderColor = '#fca5a5';
                      textColor = '#991b1b';
                      statusEmoji = '⚠️ ';
                    } else if (isCurrent) {
                      bgColor = '#f0fdf4';
                      borderColor = '#86efac';
                      textColor = '#166534';
                      statusEmoji = '📌 ';
                    } else if (isFuture) {
                      bgColor = '#fef9c3';
                      borderColor = '#fde047';
                      textColor = '#854d0e';
                      statusEmoji = '📅 ';
                    }

                    return (
                      <button
                        key={monthKey}
                        onClick={() => setSelectedTodayMonth(selectedTodayMonth === monthKey ? null : monthKey)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: selectedTodayMonth === monthKey ? '2px solid #3b82f6' : `1px solid ${borderColor}`,
                          backgroundColor: bgColor,
                          color: textColor,
                          cursor: 'pointer',
                          fontWeight: selectedTodayMonth === monthKey ? '600' : '500',
                          fontSize: '13px',
                          opacity: isPast && hasIncomplete ? 0.9 : 1,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                          if (selectedTodayMonth !== monthKey) {
                            e.currentTarget.style.opacity = '0.8';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (selectedTodayMonth !== monthKey) {
                            e.currentTarget.style.opacity = isPast && hasIncomplete ? '0.9' : '1';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }
                        }}
                      >
                        {statusEmoji}{label} ({total})
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Main tasks table - hidden for Today tab which has its own layout */}
          {activeTab !== 'today' && (
          <div className="tasks-table-container" style={activeTab === 'today' ? { marginTop: '20px' } : {}}>
            <table className={`tasks-table ${activeTab === 'yearly' ? 'daily-table' : ''}`}>
            <thead>
              <tr>
                {activeTab === 'today' && <th style={{ width: '40px', textAlign: 'center' }}>☐</th>}
                <th className="col-task sticky-col sticky-col-1">Task</th>
                {activeTab === 'today' && <th className="col-priority" style={{ width: '80px' }}>Priority</th>}
                {activeTab === 'yearly' ? (
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
                    <th className="col-status">Actions</th>
                  </>
                ) : (
                  <>
                    <th className="col-time">Allocated</th>
                    {activeTab !== 'today' && <th className="col-time">Spent</th>}
                    {activeTab !== 'today' && <th className="col-time">Remaining</th>}
                    <th className="col-status">Actions</th>
                    {activeTab !== 'today' && <th className="col-due">Due Date</th>}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {(() => {
                console.log('📊 Rendering yearly table tbody. filteredTasks.length:', filteredTasks.length, 'activeTab:', activeTab);
                return null;
              })()}
              {filteredTasks.map((task, taskIndex) => {
                // Check if this task has any daily/monthly aggregates (meaning it came from daily/monthly tab)
                const hasWeeklyDailyAggregates = activeTab === 'weekly' && weekDays.some(day => isFromDailyAggregate(task.id, day.index));
                const hasMonthlyDailyAggs = activeTab === 'monthly' && hasMonthlyDailyAggregates(task.id);
                const hasYearlyMonthlyAggs = activeTab === 'yearly' && hasYearlyMonthlyAggregates(task.id);
                const hasDailyAggregates = hasWeeklyDailyAggregates || hasMonthlyDailyAggs || hasYearlyMonthlyAggs;
                
                // Add section headers for weekly/monthly/yearly tabs
                const shouldShowSectionHeader = (activeTab === 'weekly' || activeTab === 'monthly' || activeTab === 'yearly') && taskIndex === 0 || 
                  (taskIndex > 0 && task.task_type !== filteredTasks[taskIndex - 1].task_type);
                
                let sectionHeader = null;
                if (shouldShowSectionHeader && (activeTab === 'weekly' || activeTab === 'monthly' || activeTab === 'yearly')) {
                  const taskTypeCount = filteredTasks.filter(t => t.task_type === task.task_type).length;
                  const colSpan = activeTab === 'weekly' ? 11 : 
                                  activeTab === 'monthly' ? (new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth() + 1, 0).getDate() + 4) : 
                                  16; // yearly
                  
                  let sectionName = '';
                  let sectionEmoji = '';
                  let sectionClass = '';
                  
                  if (task.task_type === TaskType.TIME) {
                    sectionName = 'Time-Based Tasks';
                    sectionEmoji = '⏱️';
                    sectionClass = 'time-based';
                  } else if (task.task_type === TaskType.COUNT) {
                    sectionName = 'Count-Based Tasks';
                    sectionEmoji = '🔢';
                    sectionClass = 'count-based';
                  } else if (task.task_type === TaskType.BOOLEAN) {
                    sectionName = 'Yes/No Tasks';
                    sectionEmoji = '✅';
                    sectionClass = 'boolean-based';
                  } else {
                    sectionName = 'Other Tasks';
                    sectionEmoji = '📋';
                  }
                  
                  sectionHeader = (
                    <tr key={`section-${task.task_type}-${taskIndex}`} className="task-type-section-header">
                      <td colSpan={colSpan} className={`section-header-cell ${sectionClass}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '14px', padding: '8px 0' }}>
                          <span style={{ fontSize: '18px' }}>{sectionEmoji}</span>
                          <span>{sectionName}</span>
                          <span style={{ fontSize: '12px', color: '#666', fontWeight: '400' }}>({taskTypeCount} tasks)</span>
                        </div>
                      </td>
                    </tr>
                  );
                }
                
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
                
                // For Today tab: Add color class for overdue tasks (uses due_date or created_at)
                const dueDateClass = activeTab === 'today' ? getTaskColorClass(task) : '';
                
                // Calculate background color for sticky columns
                const bgColor = isWeeklyCompleted || isMonthlyCompleted || isYearlyCompleted 
                  ? '#c6f6d5' 
                  : isWeeklyNA || isMonthlyNA || isYearlyNA 
                    ? '#e2e8f0'
                    : undefined;
                
                return (
                <React.Fragment key={`task-fragment-${task.id}`}>
                {sectionHeader}
                <tr 
                  key={task.id} 
                  className={`${rowClassName} ${dueDateClass} ${focusedCell && focusedCell.row === taskIndex ? 'focused-row' : ''}`}
                  style={
                    isWeeklyCompleted || isMonthlyCompleted || isYearlyCompleted 
                      ? { backgroundColor: '#c6f6d5' } 
                      : isWeeklyNA || isMonthlyNA || isYearlyNA 
                        ? { backgroundColor: '#e2e8f0' }
                        : undefined
                  }
                >
                  {activeTab === 'today' && (
                    <td style={{ textAlign: 'center', width: '40px' }}>
                      <input 
                        type="checkbox" 
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                        onChange={(e) => {
                          // Handle checkbox change - you can add completion logic here
                          if (e.target.checked) {
                            handleComplete(task.id);
                          }
                        }}
                      />
                    </td>
                  )}
                  <td 
                    className={`col-task sticky-col sticky-col-1 ${colorClass} ${
                      focusedCell && focusedCell.row === taskIndex && focusedCell.col === -1 ? 'focused-cell' :
                      focusedCell && focusedCell.col === -1 ? 'focused-column' :
                      hoveredColumn === -1 ? 'column-highlight' : ''
                    }`} 
                    style={bgColor ? { backgroundColor: bgColor } : undefined}
                    onMouseEnter={() => setHoveredColumn(-1)}
                    onMouseLeave={() => setHoveredColumn(null)}
                  >
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
                      {activeTab === 'today' && (
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#4299e1', fontWeight: '600' }}>
                          ({task.allocated_minutes} min)
                        </span>
                      )}
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
                          <td 
                            key={hour.index} 
                            className={`col-hour ${
                              focusedCell && focusedCell.row === taskIndex && focusedCell.col === hour.index ? 'focused-cell' :
                              focusedCell && focusedCell.col === hour.index ? 'focused-column' :
                              hoveredColumn === hour.index ? 'column-highlight' : ''
                            }`}
                            data-col={hour.index}
                            onMouseEnter={() => setHoveredColumn(hour.index)}
                            onMouseLeave={() => setHoveredColumn(null)}
                          >
                            {isBoolean ? (
                              <input
                                type="checkbox"
                                className="hour-input"
                                checked={displayValue > 0}
                                onChange={(e) => handleHourlyTimeChange(task.id, hour.index, e.target.checked ? '1' : '0')}
                                onBlur={handleHourlyTimeBlur}
                                onFocus={(e) => {
                                  const input = e.currentTarget;
                                  const row = taskIndex;
                                  const col = hour.index;
                                  setFocusedCell({ row, col });
                                }}
                                title={isSleepCol ? "Mark sleep hours as done" : "Mark as done"}
                                style={{ cursor: 'pointer' }}
                                disabled={isFutureDate(selectedDate)}
                                data-row={taskIndex}
                                data-col={hour.index}
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
                          
                          // Calculate days remaining in the week (INCLUDING today)
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const weekStart = new Date(selectedWeekStart);
                          weekStart.setHours(0, 0, 0, 0);
                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekEnd.getDate() + 6); // Saturday
                          
                          let daysRemaining = 0;
                          if (today >= weekStart && today <= weekEnd) {
                            // Current week: days from TODAY to end of week (inclusive of today)
                            const diffTime = weekEnd.getTime() - today.getTime();
                            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include today
                            
                            // DEBUG: Log calculation - ALWAYS for Cloud task
                            if (task.name && task.name.toLowerCase().includes('cloud')) {
                              console.log('='.repeat(80));
                              console.log('🔍 WEEKLY TAB CALCULATION - ' + task.name);
                              console.log('='.repeat(80));
                              console.log('Today:', today.toISOString().split('T')[0]);
                              console.log('Week: ', weekStart.toISOString().split('T')[0], 'to', weekEnd.toISOString().split('T')[0]);
                              console.log('Daily Target:', dailyTarget, 'min');
                              console.log('Weekly Target:', weeklyTarget, 'min');
                              console.log('Total Spent:', totalSpent, 'min');
                              console.log('Remaining:', remaining, 'min');
                              console.log('Days Remaining (including today):', daysRemaining);
                              console.log('NEEDED AVERAGE/DAY:', Math.round(remaining / daysRemaining), 'min');
                              console.log('='.repeat(80));
                            }
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
                        const cellColorClass = getWeeklyCellColorClass(task, day.index);
                        return (
                          <td key={day.index} className={`col-hour ${cellColorClass || colorClass}`}>
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
                      {/* Actions column at the end - Always show buttons like daily tab */}
                      <td className="col-status">
                        <div className="action-buttons">
                          <button 
                            className={`btn-complete ${weeklyTaskStatuses[task.id]?.is_completed ? 'active' : ''}`}
                            onClick={() => handleWeeklyTaskComplete(task.id)}
                            title="Mark as completed for this week only"
                          >
                            COMPLETED
                          </button>
                          <button 
                            className={`btn-na ${weeklyTaskStatuses[task.id]?.is_na ? 'active' : ''}`}
                            onClick={() => handleWeeklyTaskNA(task.id)}
                            title="Mark as NA for this week only"
                          >
                            NA
                          </button>
                        </div>
                      </td>
                    </>
                  ) : activeTab === 'monthly' ? (
                    <>
                      {/* Allocated column */}
                      <td className={`col-time sticky-col sticky-col-2 ${getMonthlyRowColorClass(task)}`} style={bgColor ? { backgroundColor: bgColor } : undefined}>
                        {formatTaskTarget(task, true, true)}
                      </td>
                      {/* Spent column - average per day till today */}
                      <td className={`col-time sticky-col sticky-col-3 ${getMonthlyRowColorClass(task)}`} style={bgColor ? { backgroundColor: bgColor } : undefined}>
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
                      <td className={`col-time sticky-col sticky-col-4 ${getMonthlyRowColorClass(task)}`} style={bgColor ? { backgroundColor: bgColor } : undefined}>
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
                          
                          // Calculate days remaining in the month (INCLUDING today)
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const monthStart = new Date(selectedMonthStart);
                          monthStart.setHours(0, 0, 0, 0);
                          const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
                          monthEnd.setHours(0, 0, 0, 0);
                          
                          let daysRemaining = 0;
                          if (today >= monthStart && today <= monthEnd) {
                            // Current month: days from TODAY to end of month (inclusive of today)
                            const diffTime = monthEnd.getTime() - today.getTime();
                            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include today
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
                          const cellColorClass = getMonthlyCellColorClass(task, day);
                          days.push(
                            <td key={day} className={`col-hour ${cellColorClass || colorClass}`}>
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
                      {/* Actions column at the end - Always show buttons like daily tab */}
                      <td className="col-status">
                        {/* Show badge if completed/NA via Daily */}
                        {task.is_completed && task.follow_up_frequency === 'daily' ? (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: '8px',
                            fontSize: '12px'
                          }}>
                            <span style={{
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: 'white',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                            }}>
                              ✓ Completed via Daily
                            </span>
                          </div>
                        ) : !task.is_active && task.follow_up_frequency === 'daily' ? (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: '8px',
                            fontSize: '12px'
                          }}>
                            <span style={{
                              background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                              color: 'white',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              boxShadow: '0 2px 4px rgba(156, 163, 175, 0.3)'
                            }}>
                              ⊘ NA via Daily
                            </span>
                          </div>
                        ) : (
                          <div className="action-buttons">
                            <button 
                              className={`btn-complete ${monthlyTaskStatuses[task.id]?.is_completed ? 'active' : ''}`}
                              onClick={() => handleMonthlyTaskComplete(task.id)}
                              title="Mark as completed for this month only"
                            >
                              COMPLETED
                            </button>
                            <button 
                              className={`btn-na ${monthlyTaskStatuses[task.id]?.is_na ? 'active' : ''}`}
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
                        console.log('🔵 Rendering yearly months for task:', task.name);
                        const months = [];
                        const isBoolean = task.task_type === TaskType.BOOLEAN;
                        // If task has ANY monthly aggregates, disable ALL months for this task
                        const isTaskFromOtherTabs = hasYearlyMonthlyAggregates(task.id);
                        
                        for (let month = 1; month <= 12; month++) {
                          const timeValue = getYearlyTime(task.id, month);
                          const monthColorClass = getYearlyMonthColorClass(task, month);
                          console.log('  Month', month, 'colorClass:', monthColorClass);
                          months.push(
                            <td key={month} className={`col-hour ${monthColorClass}`}>
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
                      {/* Actions column at the end - Always show buttons like daily tab */}
                      <td className="col-status">
                        <div className="action-buttons">
                          <button 
                            className={`btn-complete ${yearlyTaskStatuses[task.id]?.is_completed ? 'active' : ''}`}
                            onClick={() => handleYearlyStatusChange(task.id, true, false)}
                            title="Mark as completed for this year only"
                          >
                            COMPLETED
                          </button>
                          <button 
                            className={`btn-na ${yearlyTaskStatuses[task.id]?.is_na ? 'active' : ''}`}
                            onClick={() => handleYearlyStatusChange(task.id, false, true)}
                            title="Mark as NA for this year only"
                          >
                            NA
                          </button>
                        </div>
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
                            {activeTab === 'today' && (
                              task.priority && task.priority <= 3 ? (
                                <button 
                                  className="btn btn-sm"
                                  onClick={() => handleMoveToToday(task.id, 'task')}
                                  style={{
                                    backgroundColor: '#f59e0b',
                                    color: 'white',
                                    padding: '6px 12px',
                                    marginRight: '8px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                  title="Move back to Today tab (P4)"
                                >
                                  ← Today
                                </button>
                              ) : (
                                <button 
                                  className="btn btn-sm"
                                  onClick={() => handleMoveToNow(task.id, 'task')}
                                  style={{
                                    backgroundColor: '#dc2626',
                                    color: 'white',
                                    padding: '6px 12px',
                                    marginRight: '8px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                  title="Move to NOW tab (P1)"
                                >
                                  → NOW
                                </button>
                              )
                            )}
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
                          {task.due_date ? parseDateString(task.due_date).toLocaleDateString() : '-'}
                        </td>
                      )}
                    </>
                  )}
                </tr>
                </React.Fragment>
              );
              })}
            </tbody>
            <tfoot>
              {activeTab === 'daily' && (() => {
                // Only count tasks that are being tracked on this date
                const totalAllocated = filteredTasks
                  .filter(task => {
                    const status = dailyStatuses.get(task.id);
                    // If no status record exists, task is tracked by default
                    // If status exists, check is_tracked flag
                    return !status || status.is_tracked !== false;
                  })
                  .reduce((sum, task) => sum + task.allocated_minutes, 0);
                const totalSpent = filteredTasks
                  .filter(task => {
                    const status = dailyStatuses.get(task.id);
                    return !status || status.is_tracked !== false;
                  })
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
      )} {/* End of main tasks table - hidden for Today tab */}
        </>
      )}

      {/* ========== TODAY TAB SECTIONS ========== */}
      {activeTab === 'today' && (
        <div style={{ marginTop: '30px' }}>
          
          {/* Today's Only Tasks Section - Always show header if there are any tasks */}
          {todaysOnlyTasks.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <div 
                onClick={() => setTodayTabSections(prev => ({ ...prev, todaysOnlyTasks: !prev.todaysOnlyTasks }))}
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  padding: '14px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⏰</span>
                  <span>Today's Only Tasks ({todaysOnlyTasks.length})</span>
                </h3>
                <span style={{ fontSize: '20px', color: '#ffffff' }}>
                  {todayTabSections.todaysOnlyTasks ? '▼' : '▶'}
                </span>
              </div>

              {todayTabSections.todaysOnlyTasks && (
                <div style={{ marginTop: '12px', overflowX: 'auto' }}>
                  <table className="tasks-table" style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #3b82f6' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '3px solid #3b82f6' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#475569', borderRight: '2px solid #3b82f6' }}>Task Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#475569', borderRight: '2px solid #3b82f6' }}>Pillar - Category</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#475569', width: '120px', borderRight: '2px solid #3b82f6' }}>Time (min)</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#475569', width: '150px', borderRight: '2px solid #3b82f6' }}>Due Date</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#475569', width: '200px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todaysOnlyTasks.map(task => {
                        const isCompleted = task.is_completed;
                        const baseBackgroundColor = isCompleted ? '#d1fae5' : '#fff'; // Green for completed, white for active
                        const hoverBackgroundColor = isCompleted ? '#a7f3d0' : '#f1f5f9';
                        
                        return (
                        <tr 
                          key={task.id}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            backgroundColor: baseBackgroundColor,
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBackgroundColor}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = baseBackgroundColor}
                        >
                          <td style={{ 
                            padding: '12px', 
                            fontSize: '14px', 
                            fontWeight: '600', 
                            color: '#1e293b', 
                            borderRight: '2px solid #3b82f6', 
                            background: 'inherit',
                            textDecoration: isCompleted ? 'line-through' : 'none'
                          }}>
                            {task.name}
                          </td>
                          <td style={{ padding: '12px', fontSize: '13px', color: '#64748b', borderRight: '2px solid #3b82f6', background: 'inherit' }}>
                            {task.pillar_name} - {task.category_name}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#64748b', borderRight: '2px solid #3b82f6', background: 'inherit' }}>
                            {task.allocated_minutes || 0}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', borderRight: '2px solid #3b82f6', background: 'inherit' }}>
                            <input 
                              type="date"
                              value={task.due_date ? task.due_date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const newDate = e.target.value;
                                if (!newDate) return;
                                
                                console.log('=== Date Update Debug ===');
                                console.log('Input value (what you selected):', newDate);
                                console.log('Current task.due_date:', task.due_date);
                                console.log('Task ID:', task.id, 'Name:', task.name);
                                
                                try {
                                  // Use the correct endpoint based on task type
                                  if (task.project_id) {
                                    console.log('Using project endpoint');
                                    await api.put(`/api/projects/tasks/${task.id}`, { due_date: newDate });
                                  } else if (task.goal_id) {
                                    console.log('Using goal endpoint');
                                    await api.put(`/api/life-goals/tasks/${task.id}`, { due_date: newDate });
                                  } else {
                                    console.log('Using misc task endpoint, sending:', { due_date: newDate });
                                    await api.put(`/api/tasks/${task.id}`, { due_date: newDate });
                                  }
                                  
                                  console.log('Update successful, refreshing...');
                                  // Refresh the tasks list and use fresh data
                                  const freshTasks = await loadTasks();
                                  await loadTodaysOnlyTasks(freshTasks);
                                  const updatedTask = freshTasks.find(t => t.id === task.id);
                                  console.log('Refresh complete - Task due_date now:', updatedTask?.due_date);
                                } catch (err: any) {
                                  console.error('Error updating due date:', err);
                                  console.error('Error details:', err.response?.data);
                                  alert('Failed to update due date: ' + (err.response?.data?.detail || err.message));
                                }
                              }}
                              style={{
                                border: '1px solid #cbd5e1',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                width: '130px',
                                backgroundColor: '#fff',
                                color: '#475569'
                              }}
                              title="Click to change due date"
                            />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', background: 'inherit' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                onClick={() => handleMoveToNow(task.id, 'task')}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  backgroundColor: '#dc2626',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                              >
                                NOW
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedTaskId(task.id);
                                  setIsTaskFormOpen(true);
                                }}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleToggleTaskCompletion(task.id, task.is_completed)}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  backgroundColor: isCompleted ? '#f59e0b' : '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                              >
                                {isCompleted ? 'Undo' : 'Done'}
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete this task?')) {
                                    try {
                                      await api.delete(`/api/tasks/${task.id}`);
                                      const freshTasks = await loadTasks();
                                      await loadTodaysOnlyTasks(freshTasks);
                                    } catch (err: any) {
                                      console.error('Error deleting task:', err);
                                      alert('Failed to delete task: ' + (err.response?.data?.detail || err.message));
                                    }
                                  }
                                }}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Helper function to filter tasks by selected month */}
          {activeTab === 'today' && (() => {
            // Create filter function
            const filterByMonth = (task: any) => {
              if (!selectedTodayMonth) return true; // Show all if no month selected
              
              // Important tasks don't have due_date, always show them (they have their own overdue logic)
              if (task.ideal_gap_days !== undefined) return true;
              
              if (!task.due_date) return false; // Hide other tasks without due dates
              
              const dueDate = parseDateString(task.due_date);
              const taskMonthKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
              return taskMonthKey === selectedTodayMonth;
            };

            // Store filter function in a variable accessible to sections below
            (window as any).__todayTabMonthFilter = filterByMonth;
            return null;
          })()}

          {/* Project Tasks Due Today & Overdue Section */}
          {(() => {
            const filterByMonth = (window as any).__todayTabMonthFilter || (() => true);
            // Don't filter out completed tasks - backend returns them only if completed today (visible until midnight)
            const filteredTasks = projectTasksDueToday.filter(t => (!t.priority || t.priority > 3) && filterByMonth(t));
            
            return filteredTasks.length > 0 && (
            <div id="project-tasks-section" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <div 
                onClick={() => setTodayTabSections(prev => ({ ...prev, projectTasksDueToday: !prev.projectTasksDueToday }))}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  padding: '14px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📋</span>
                  <span>Project Tasks Due Today & Overdue ({filteredTasks.length})</span>
                </h3>
                <span style={{ fontSize: '20px', color: '#ffffff' }}>
                  {todayTabSections.projectTasksDueToday ? '▼' : '▶'}
                </span>
              </div>

              {todayTabSections.projectTasksDueToday && (
                <div style={{ marginTop: '12px', overflowX: 'auto' }}>
                  <table className="tasks-table" style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #3b82f6' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#eff6ff', borderBottom: '3px solid #3b82f6' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#1e40af', borderRight: '2px solid #3b82f6' }}>Task Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#1e40af', width: '200px', borderRight: '2px solid #3b82f6' }}>Project</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1e40af', width: '150px', borderRight: '2px solid #3b82f6' }}>Target Date</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#1e40af', width: '200px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => {
                        const dueDateClass = getDueDateColorClass(task.due_date);
                        const isOverdue = dueDateClass.includes('overdue'); // Only 'overdue', not 'urgent'
                        const isCompleted = task.is_completed;
                        const rowBgColor = isCompleted ? 'repeating-linear-gradient(45deg, #d1fae5, #d1fae5 10px, #a7f3d0 10px, #a7f3d0 20px)' : (isOverdue ? '#fee2e2' : '#fff');
                        const rowHoverColor = isCompleted ? 'repeating-linear-gradient(45deg, #a7f3d0, #a7f3d0 10px, #6ee7b7 10px, #6ee7b7 20px)' : (isOverdue ? '#fecaca' : '#f1f5f9');
                        
                        return (
                          <tr 
                            key={task.id}
                            style={{
                              borderBottom: '1px solid #e2e8f0',
                              backgroundColor: rowBgColor,
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = rowHoverColor}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rowBgColor}
                          >
                            <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600', color: '#1e293b', borderRight: '2px solid #3b82f6', background: 'inherit', textDecoration: task.is_completed ? 'line-through' : 'none' }}>
                              {task.name}
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px', color: '#64748b', borderRight: '2px solid #3b82f6', background: 'inherit' }}>
                              📂 {task.project_name || `Project #${task.project_id}`}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', borderRight: '2px solid #3b82f6', background: 'inherit' }}>
                              <input 
                                type="date"
                                value={task.due_date ? formatDateForInput(parseDateString(task.due_date)) : ''}
                                onChange={(e) => handleUpdateTaskDueDate(task.id, e.target.value)}
                                style={{
                                  border: '1px solid #cbd5e1',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  backgroundColor: isOverdue ? '#fee2e2' : '#fff',
                                  color: isOverdue ? '#dc2626' : '#475569'
                                }}
                                title="Click to change due date"
                              />
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', background: 'inherit' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleMoveToNow(task.id, 'project')}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    backgroundColor: '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                  }}
                                >
                                  NOW
                                </button>
                                <button
                                  onClick={() => handleEditTask(task)}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleToggleTaskCompletion(task.id, task.is_completed, 'project')}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                  }}
                                >
                                  Done
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            );
          })()}

          {/* Goal Tasks Due Today & Overdue Section */}
          {(() => {
            const filterByMonth = (window as any).__todayTabMonthFilter || (() => true);
            // Don't filter out completed tasks - backend returns them only if completed today (visible until midnight)
            const filteredTasks = goalTasksDueToday.filter(t => (!t.priority || t.priority > 3) && filterByMonth(t));
            
            return filteredTasks.length > 0 && (
            <div id="goal-tasks-section" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <div 
                onClick={() => setTodayTabSections(prev => ({ ...prev, goalTasksDueToday: !prev.goalTasksDueToday }))}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  padding: '14px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎯</span>
                  <span>Goal Tasks Due Today & Overdue ({goalTasksDueToday.filter(t => !t.is_completed && (!t.priority || t.priority > 3)).length})</span>
                </h3>
                <span style={{ fontSize: '20px', color: '#ffffff' }}>
                  {todayTabSections.goalTasksDueToday ? '▼' : '▶'}
                </span>
              </div>

              {todayTabSections.goalTasksDueToday && (
                <div style={{ marginTop: '12px', overflowX: 'auto' }}>
                  <table className="tasks-table" style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #3b82f6' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#d1fae5', borderBottom: '3px solid #3b82f6' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#065f46', borderRight: '2px solid #3b82f6' }}>
                          Task Name
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#065f46', width: '200px', borderRight: '2px solid #3b82f6' }}>
                          Goal
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#065f46', width: '150px', borderRight: '2px solid #3b82f6' }}>
                          Target Date
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#065f46', width: '200px' }}>
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => {
                        const dueDateClass = getDueDateColorClass(task.due_date);
                        const isOverdue = dueDateClass.includes('overdue'); // Only 'overdue', not 'urgent'
                        const isCompleted = task.is_completed;
                        const rowBgColor = isCompleted ? 'repeating-linear-gradient(45deg, #d1fae5, #d1fae5 10px, #a7f3d0 10px, #a7f3d0 20px)' : (isOverdue ? '#fee2e2' : '#fff');
                        const rowHoverColor = isCompleted ? 'repeating-linear-gradient(45deg, #a7f3d0, #a7f3d0 10px, #6ee7b7 10px, #6ee7b7 20px)' : (isOverdue ? '#fecaca' : '#f1f5f9');
                        
                        return (
                          <tr 
                            key={`goal-${task.id}`}
                            style={{ 
                              backgroundColor: rowBgColor,
                              borderBottom: '1px solid #e2e8f0',
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = rowHoverColor}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rowBgColor}
                          >
                            <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: '#2d3748', borderRight: '2px solid #3b82f6', background: 'inherit', textDecoration: task.is_completed ? 'line-through' : 'none' }}>
                              {task.name}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b', borderRight: '2px solid #3b82f6', background: 'inherit' }}>
                              🎯 {task.goal_name || `Goal #${task.goal_id}`}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', borderRight: '2px solid #3b82f6', background: 'inherit' }}>
                              <input 
                                type="date"
                                value={task.due_date ? formatDateForInput(parseDateString(task.due_date)) : ''}
                                onChange={(e) => handleUpdateGoalTaskDueDate(task.id, e.target.value)}
                                style={{
                                  border: '1px solid #cbd5e1',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  backgroundColor: isOverdue ? '#fee2e2' : '#fff',
                                  color: isOverdue ? '#dc2626' : '#475569',
                                  cursor: 'pointer'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', background: 'inherit' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                                <button
                                  onClick={() => handleMoveToNow(task.id, 'goal')}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    backgroundColor: '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                  }}
                                >
                                  NOW
                                </button>
                                <button
                                  onClick={() => handleEditTask(task)}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleToggleGoalTaskCompletion(task.id, task.is_completed)}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                  }}
                                >
                                  Done
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            );
          })()}

          {/* Misc Tasks Due Today & Overdue Section */}
          {(() => {
            const filterByMonth = (window as any).__todayTabMonthFilter || (() => true);
            const filteredTasks = miscTasksDueToday.filter(t => filterByMonth(t));
            
            return filteredTasks.length > 0 && (
            <div id="misc-tasks-section" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <div 
                onClick={() => setTodayTabSections(prev => ({ ...prev, miscTasksDueToday: !prev.miscTasksDueToday }))}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  padding: '14px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📁</span>
                  <span>Misc Tasks: Due Today & Overdue ({filteredTasks.length})</span>
                </h3>
                <span style={{ fontSize: '20px', color: '#ffffff' }}>
                  {todayTabSections.miscTasksDueToday ? '▼' : '▶'}
                </span>
              </div>

              {todayTabSections.miscTasksDueToday && (
                <div style={{ marginTop: '12px', overflowX: 'auto' }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#2d3748', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                          Task Name
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#2d3748', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                          Category
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#2d3748', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                          Due Date
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#2d3748', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                          Status
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#2d3748', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => {
                        const isOverdue = (task.daysOverdue || 0) > 0;
                        
                        return (
                          <tr 
                            key={task.id}
                            style={{
                              borderBottom: '1px solid #e2e8f0',
                              borderLeft: isOverdue ? '4px solid #dc2626' : '4px solid #8b5cf6',
                              backgroundColor: '#ffffff',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f7fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                          >
                            <td style={{ padding: '12px 16px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: '#2d3748' }}>
                                {task.name}
                              </div>
                              {task.description && (
                                <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>
                                  {task.description}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '12px', color: '#718096' }}>
                                📁 {task.group_name}
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', border: '1px solid #e2e8f0' }}>
                              {task.due_date ? (
                                <input
                                  type="date"
                                  value={task.due_date.split('T')[0]}
                                  onChange={async (e) => {
                                    const newDate = e.target.value;
                                    if (!newDate) return;
                                    try {
                                      await api.put(`/api/tasks/${task.id}`, { 
                                        due_date: newDate + 'T00:00:00'
                                      });
                                      await loadMiscTaskGroups();
                                      await loadMiscTasksDueToday();
                                    } catch (err: any) {
                                      console.error('Error updating due date:', err);
                                      alert('Failed to update due date');
                                    }
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    border: `1px solid ${isOverdue ? '#dc2626' : '#cbd5e0'}`,
                                    borderRadius: '4px',
                                    backgroundColor: isOverdue ? '#fee2e2' : '#ffffff',
                                    color: isOverdue ? '#dc2626' : '#2d3748',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                  }}
                                />
                              ) : (
                                <button
                                  onClick={() => {
                                    const today = new Date();
                                    const todayStr = formatDateForInput(today);
                                    api.put(`/api/tasks/${task.id}`, { 
                                      due_date: todayStr + 'T00:00:00'
                                    }).then(() => {
                                      loadMiscTaskGroups();
                                      loadMiscTasksDueToday();
                                    }).catch(err => {
                                      console.error('Error setting due date:', err);
                                      alert('Failed to set due date');
                                    });
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    border: '1px solid #cbd5e0',
                                    borderRadius: '4px',
                                    backgroundColor: '#f7fafc',
                                    color: '#718096',
                                    cursor: 'pointer',
                                    fontStyle: 'italic'
                                  }}
                                >
                                  Set due date
                                </button>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', border: '1px solid #e2e8f0' }}>
                              {isOverdue ? (
                                <span style={{ 
                                  fontSize: '12px', 
                                  color: '#dc2626', 
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  ⚠️ {task.daysOverdue} {(task.daysOverdue || 0) === 1 ? 'day' : 'days'} overdue
                                </span>
                              ) : (
                                <span style={{ 
                                  fontSize: '12px', 
                                  color: '#10b981', 
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  ✓ Due today
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveToNow(task.id, 'task');
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    backgroundColor: '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '700'
                                  }}
                                >
                                  NOW
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedTaskId(task.id);
                                    setIsTaskFormOpen(true);
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.put(`/api/tasks/${task.id}`, { is_completed: true });
                                      await loadMiscTaskGroups();
                                    } catch (err) {
                                      alert('Failed to mark task as complete');
                                    }
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                  }}
                                >
                                  Done
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            );
          })()}

          {/* Important Tasks Due Today & Overdue Section */}
          {(() => {
            const filterByMonth = (window as any).__todayTabMonthFilter || (() => true);
            const filteredTasks = importantTasksDueToday.filter(t => filterByMonth(t));
            
            // Only show section if there are tasks
            if (filteredTasks.length === 0) return null;
            
            return (
            <div id="important-tasks-section" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <div 
                onClick={() => setTodayTabSections(prev => ({ ...prev, importantTasksDueToday: !prev.importantTasksDueToday }))}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  padding: '14px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚡</span>
                  <span>Important Tasks: Due Today & Overdue ({filteredTasks.length})</span>
                </h3>
                <span style={{ fontSize: '20px', color: '#ffffff' }}>
                  {todayTabSections.importantTasksDueToday ? '▼' : '▶'}
                </span>
              </div>

              {todayTabSections.importantTasksDueToday && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse',
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '13px', color: '#4a5568' }}>Task Name</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '13px', color: '#4a5568', width: '120px' }}>Check Every</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '13px', color: '#4a5568', width: '150px' }}>Status</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '13px', color: '#4a5568', width: '140px' }}>Last Check</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '13px', color: '#4a5568', width: '180px' }}>Mark as Done</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTasks.map((task) => {
                            const isRed = task.status === 'red';
                            const isGray = task.status === 'gray';
                            
                            return (
                              <tr 
                                key={task.id}
                                style={{
                                  borderBottom: '1px solid #e2e8f0',
                                  backgroundColor: isRed ? '#fef2f2' : isGray ? '#f9fafb' : '#fff'
                                }}
                              >
                                <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '500', color: '#2d3748' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ 
                                      fontSize: '16px',
                                      color: isRed ? '#dc2626' : isGray ? '#f59e0b' : '#10b981'
                                    }}>
                                      {isRed ? '🔴' : isGray ? '🟡' : '🟢'}
                                    </span>
                                    <span>{task.name}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', color: '#4a5568' }}>
                                  <span style={{ 
                                    display: 'inline-block',
                                    padding: '4px 8px',
                                    backgroundColor: '#edf2f7',
                                    borderRadius: '4px',
                                    fontWeight: '600'
                                  }}>
                                    {task.ideal_gap_days} days
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px' }}>
                                  <span style={{ 
                                    color: isRed ? '#dc2626' : isGray ? '#f59e0b' : '#10b981',
                                    fontWeight: '600'
                                  }}>
                                    {task.message}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', color: '#718096' }}>
                                  {task.last_check_date ? new Date(task.last_check_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  <input
                                    type="date"
                                    defaultValue={new Date().toISOString().split('T')[0]}
                                    max={new Date().toISOString().split('T')[0]}
                                    onChange={async (e) => {
                                      if (e.target.value && confirm(`Mark "${task.name}" as checked on ${new Date(e.target.value).toLocaleDateString()}?`)) {
                                        try {
                                          await api.post(`/api/important-tasks/${task.id}/check`, {
                                            check_date: e.target.value
                                          });
                                          await loadImportantTasksDueToday();
                                          // Reset the date input
                                          e.target.value = new Date().toISOString().split('T')[0];
                                        } catch (err) {
                                          alert('Failed to mark task as checked');
                                        }
                                      }
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      fontSize: '13px',
                                      border: '1px solid #cbd5e0',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      backgroundColor: '#fff'
                                    }}
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
            </div>
            );
          })()}

          {/* Needs Attention Section - Only show in Today tab */}
          {activeTab === 'today' && (() => {
            // Filter out tasks that are in NOW (priority 1-3) - they should only show in NOW tab
            const weeklyTasks = tasksNeedingAttention.filter(item => 
              item.reason === 'weekly' && (!item.task.priority || item.task.priority > 3)
            );
            const monthlyTasks = tasksNeedingAttention.filter(item => 
              item.reason === 'monthly' && (!item.task.priority || item.task.priority > 3)
            );
            const quarterlyTasks = tasksNeedingAttention.filter(item => 
              item.reason === 'quarterly' && (!item.task.priority || item.task.priority > 3)
            );
            const yearlyTasks = tasksNeedingAttention.filter(item => 
              item.reason === 'yearly' && (!item.task.priority || item.task.priority > 3)
            );
            
            // Motivational quotes that rotate daily
            const motivationalQuotes = [
              "💪 Today's effort = Tomorrow's freedom. Catch up now, coast later!",
              "🎯 Small daily wins compound into massive yearly gains.",
              "🔥 Discipline today = Regret avoided tomorrow.",
              "⚡ The best time to catch up? Right now. The second best? Never comes.",
              "🚀 Every minute you invest today is a minute you don't owe tomorrow.",
              "💎 Consistency beats intensity. Get back on track today!",
              "⏰ Future you will thank present you for catching up now."
            ];
            
            // Pick quote based on day of year (consistent for the day)
            const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
            const todaysQuote = motivationalQuotes[dayOfYear % motivationalQuotes.length];
            
            return (
              <>
                {/* Weekly Tasks Needing Attention */}
                {weeklyTasks.length > 0 && (
                  <div id="weekly-needs-attention-section" style={{ marginTop: '30px', marginBottom: '20px', scrollMarginTop: '80px' }}>
                    {/* Motivational Quote */}
                    <div style={{
                      padding: '12px 20px',
                      backgroundColor: '#fff3cd',
                      border: '2px solid #ffc107',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      textAlign: 'center',
                      fontSize: '15px',
                      fontWeight: '500',
                      color: '#856404',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      {todaysQuote}
                    </div>
                    
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 6px rgba(255, 107, 107, 0.3)',
                      }}
                      onClick={() => setTodayTabSections(prev => ({ ...prev, weeklyNeedsAttention: !prev.weeklyNeedsAttention }))}
                    >
                      <h3 style={{ margin: 0, color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
                        🚨 Needs Attention - Weekly Tasks ({weeklyTasks.length} {weeklyTasks.length === 1 ? 'task' : 'tasks'})
                      </h3>
                      <span style={{ fontSize: '20px', color: '#ffffff' }}>
                        {todayTabSections.weeklyNeedsAttention ? '▼' : '▶'}
                      </span>
                    </div>

                    {todayTabSections.weeklyNeedsAttention && (
                      <div style={{ marginTop: '12px' }}>
                        {weeklyTasks.map((item, index) => (
                          <div 
                            key={item.task.id}
                            style={{
                              marginBottom: '6px',
                              padding: '10px 14px',
                              backgroundColor: '#fff',
                              border: '1px solid #ffcccc',
                              borderLeft: '4px solid #e53e3e',
                              borderRadius: '4px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            {/* Line 1: Task name, Need Today prominently displayed */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '600', color: '#2d3748', minWidth: '200px' }}>
                                {item.task.name}
                              </span>
                              {item.weeklyIssue && (
                                <span style={{ fontSize: '14px', color: '#dc2626', fontWeight: '600' }}>
                                  Need <strong>{item.weeklyIssue.neededToday} {item.task.task_type === TaskType.TIME ? 'min' : item.task.unit || ''}</strong> today (Ideal: {item.weeklyIssue.dailyTarget}, Lagged: {item.weeklyIssue.deficit || 0}, {item.weeklyIssue.totalDays - item.weeklyIssue.redDays} days left)
                                </span>
                              )}
                              {item.monthlyIssue && !item.weeklyIssue && (
                                <span style={{ fontSize: '14px', color: '#d97706', fontWeight: '600' }}>
                                  Need <strong>{item.monthlyIssue.neededToday} {item.task.task_type === TaskType.TIME ? 'min' : item.task.unit || ''}</strong> today (Ideal: {item.monthlyIssue.dailyTarget}, {item.monthlyIssue.percentBehind}% behind)
                                </span>
                              )}
                              {(() => {
                                const priority = item.task.priority;
                                const isInNOW = priority && priority <= 3;
                                return (
                                  <>
                                    {isInNOW ? (
                                      <button 
                                        className="btn btn-sm btn-warning"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveToToday(item.task.id, 'task');
                                        }}
                                        title="Task is in NOW - move back to Today (P5)"
                                        style={{ marginLeft: 'auto' }}
                                      >
                                        ← Today
                                      </button>
                                    ) : (
                                      <button 
                                        className="btn btn-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveToNow(item.task.id, 'task');
                                        }}
                                        title="Move to NOW tab (P1)"
                                        style={{
                                          marginLeft: 'auto',
                                          backgroundColor: '#dc2626',
                                          color: 'white',
                                          padding: '6px 12px',
                                          fontSize: '12px',
                                          borderRadius: '6px',
                                          border: 'none',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        → NOW
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            
                            {/* Line 2: Category, frequency badge, and detailed stats */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '11px', color: '#718096', minWidth: '200px' }}>
                                {item.task.pillar_name} - {item.task.category_name}
                              </span>
                              <span style={{ 
                                fontSize: '10px', 
                                padding: '2px 6px', 
                                backgroundColor: '#e2e8f0', 
                                borderRadius: '10px',
                                color: '#4a5568'
                              }}>
                                {item.task.follow_up_frequency === 'daily' ? 'Daily' : item.task.follow_up_frequency === 'weekly' ? 'Weekly' : 'Monthly'}
                              </span>
                              {item.weeklyIssue && (
                                <span style={{ fontSize: '12px', color: '#718096' }}>
                                  Target: <strong style={{ color: '#e53e3e' }}>{item.weeklyIssue.dailyTarget}</strong> |
                                  Current: <strong style={{ color: '#10b981' }}>{item.weeklyIssue.currentAverage}</strong> |
                                  Need Today: <strong style={{ color: '#dc2626' }}>{item.weeklyIssue.neededToday}</strong> {item.task.task_type === TaskType.TIME ? 'min' : item.task.unit || ''} |
                                  📅 {item.weeklyIssue.redDays}/{item.weeklyIssue.totalDays} red | Lag: {item.weeklyIssue.deficit || 0}
                                </span>
                              )}
                              <button
                                onClick={() => setActiveTab('weekly')}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  marginLeft: 'auto'
                                }}
                              >
                                View Weekly →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Monthly Tasks Needing Attention */}
                {monthlyTasks.length > 0 && (
                  <div id="monthly-needs-attention-section" style={{ marginBottom: '20px', scrollMarginTop: '80px' }}>
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 6px rgba(245, 158, 11, 0.3)',
                      }}
                      onClick={() => setTodayTabSections(prev => ({ ...prev, monthlyNeedsAttention: !prev.monthlyNeedsAttention }))}
                    >
                      <h3 style={{ margin: 0, color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
                        📊 Needs Attention - Monthly Tasks ({monthlyTasks.length} {monthlyTasks.length === 1 ? 'task' : 'tasks'})
                      </h3>
                      <span style={{ fontSize: '20px', color: '#ffffff' }}>
                        {todayTabSections.monthlyNeedsAttention ? '▼' : '▶'}
                      </span>
                    </div>

                    {todayTabSections.monthlyNeedsAttention && (
                      <div style={{ marginTop: '12px' }}>
                        {monthlyTasks.map((item, index) => (
                          <div 
                            key={item.task.id}
                            style={{
                              marginBottom: '6px',
                              padding: '10px 14px',
                              backgroundColor: '#fff',
                              border: '1px solid #bbdefb',
                              borderLeft: '4px solid #2196f3',
                              borderRadius: '4px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            {/* Line 1: Task name, Need Today prominently displayed */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '600', color: '#2d3748', minWidth: '200px' }}>
                                {item.task.name}
                              </span>
                              {item.monthlyIssue && (
                                <span style={{ fontSize: '14px', color: '#d97706', fontWeight: '600' }}>
                                  Need <strong>{item.monthlyIssue.neededToday} {item.task.task_type === TaskType.TIME ? 'min' : item.task.unit || ''}</strong> today (Ideal: {item.monthlyIssue.dailyTarget}, {item.monthlyIssue.percentBehind}% behind)
                                </span>
                              )}
                              {(() => {
                                const priority = item.task.priority;
                                const isInNOW = priority && priority <= 3;
                                return (
                                  <>
                                    {isInNOW ? (
                                      <button 
                                        className="btn btn-sm btn-warning"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveToToday(item.task.id, 'task');
                                        }}
                                        title="Task is in NOW - move back to Today (P5)"
                                        style={{ marginLeft: 'auto' }}
                                      >
                                        ← Today
                                      </button>
                                    ) : (
                                      <button 
                                        className="btn btn-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveToNow(item.task.id, 'task');
                                        }}
                                        title="Move to NOW tab (P1)"
                                        style={{
                                          marginLeft: 'auto',
                                          backgroundColor: '#dc2626',
                                          color: 'white',
                                          padding: '6px 12px',
                                          fontSize: '12px',
                                          borderRadius: '6px',
                                          border: 'none',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        → NOW
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            
                            {/* Line 2: Category, frequency badge, and detailed stats */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '11px', color: '#718096', minWidth: '200px' }}>
                                {item.task.pillar_name} - {item.task.category_name}
                              </span>
                              <span style={{ 
                                fontSize: '10px', 
                                padding: '2px 6px', 
                                backgroundColor: '#e2e8f0', 
                                borderRadius: '10px',
                                color: '#4a5568'
                              }}>
                                {item.task.follow_up_frequency === 'daily' ? 'Daily' : item.task.follow_up_frequency === 'weekly' ? 'Weekly' : 'Monthly'}
                              </span>
                              {item.monthlyIssue && (
                                <span style={{ fontSize: '12px', color: '#718096' }}>
                                  Target: <strong style={{ color: '#f59e0b' }}>{item.monthlyIssue.dailyTarget}</strong> |
                                  Current: <strong style={{ color: '#10b981' }}>{item.monthlyIssue.currentAverage}</strong> |
                                  📊 {Math.round(item.monthlyIssue.totalSpent)}/{Math.round(item.monthlyIssue.expectedTarget)}
                                </span>
                              )}
                              <button
                                onClick={() => setActiveTab('monthly')}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  marginLeft: 'auto'
                                }}
                              >
                                View Monthly →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Quarterly Tasks Needing Attention */}
                {quarterlyTasks.length > 0 && (
                  <div id="quarterly-needs-attention-section" style={{ marginTop: '30px', marginBottom: '20px', scrollMarginTop: '80px' }}>
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 6px rgba(139, 92, 246, 0.3)',
                      }}
                      onClick={() => setTodayTabSections(prev => ({ ...prev, quarterlyNeedsAttention: !prev.quarterlyNeedsAttention }))}
                    >
                      <h3 style={{ margin: 0, color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
                        📅 Needs Attention - Quarterly Tasks ({quarterlyTasks.length} {quarterlyTasks.length === 1 ? 'task' : 'tasks'})
                      </h3>
                      <span style={{ fontSize: '20px', color: '#ffffff' }}>
                        {todayTabSections.quarterlyNeedsAttention ? '▼' : '▶'}
                      </span>
                    </div>

                    {todayTabSections.quarterlyNeedsAttention && (
                      <div style={{ marginTop: '12px' }}>
                        {quarterlyTasks.map((item, index) => (
                          <div 
                            key={item.task.id}
                            style={{
                              marginBottom: '6px',
                              padding: '10px 14px',
                              backgroundColor: '#fff',
                              border: '1px solid #ddd6fe',
                              borderLeft: '4px solid #8b5cf6',
                              borderRadius: '4px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            {/* Line 1: Task name, Need Today prominently displayed */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '600', color: '#2d3748', minWidth: '200px' }}>
                                {item.task.name}
                              </span>
                              {item.quarterlyIssue && (
                                <span style={{ fontSize: '14px', color: '#8b5cf6', fontWeight: '600' }}>
                                  Need <strong>{item.quarterlyIssue.neededToday} {item.task.task_type === TaskType.TIME ? 'min' : item.task.unit || ''}</strong> today (Ideal: {item.quarterlyIssue.dailyTarget}, Lagged: {item.quarterlyIssue.deficit || 0}, {item.quarterlyIssue.daysLeft} days left)
                                </span>
                              )}
                              {(() => {
                                const priority = item.task.priority;
                                const isInNOW = priority && priority <= 3;
                                return (
                                  <>
                                    {isInNOW ? (
                                      <button 
                                        className="btn btn-sm btn-warning"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveToToday(item.task.id, 'task');
                                        }}
                                        title="Task is in NOW - move back to Today (P5)"
                                        style={{ marginLeft: 'auto' }}
                                      >
                                        ← Today
                                      </button>
                                    ) : (
                                      <button 
                                        className="btn btn-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveToNow(item.task.id, 'task');
                                        }}
                                        title="Move to NOW tab (P1)"
                                        style={{
                                          marginLeft: 'auto',
                                          backgroundColor: '#dc2626',
                                          color: 'white',
                                          padding: '6px 12px',
                                          fontSize: '12px',
                                          borderRadius: '6px',
                                          border: 'none',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        → NOW
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            
                            {/* Line 2: Category, frequency badge, and detailed stats */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '11px', color: '#718096', minWidth: '200px' }}>
                                {item.task.pillar_name} - {item.task.category_name}
                              </span>
                              <span style={{ 
                                fontSize: '10px', 
                                padding: '2px 6px', 
                                backgroundColor: '#e2e8f0', 
                                borderRadius: '10px',
                                color: '#4a5568'
                              }}>
                                {item.task.follow_up_frequency === 'daily' ? 'Daily' : item.task.follow_up_frequency === 'weekly' ? 'Weekly' : item.task.follow_up_frequency === 'monthly' ? 'Monthly' : 'Quarterly'}
                              </span>
                              {item.quarterlyIssue && (
                                <span style={{ fontSize: '12px', color: '#718096' }}>
                                  Target: <strong style={{ color: '#8b5cf6' }}>{item.quarterlyIssue.dailyTarget}</strong> |
                                  Current: <strong style={{ color: '#10b981' }}>{item.quarterlyIssue.currentAverage}</strong> |
                                  Need Today: <strong style={{ color: '#8b5cf6' }}>{item.quarterlyIssue.neededToday}</strong> {item.task.task_type === TaskType.TIME ? 'min' : item.task.unit || ''} |
                                  📅 Q{item.quarterlyIssue.quarter} | Lag: {item.quarterlyIssue.deficit || 0}
                                </span>
                              )}
                              <button
                                onClick={() => setActiveTab('quarterly')}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  backgroundColor: '#8b5cf6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  marginLeft: 'auto'
                                }}
                              >
                                View Quarterly →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Yearly Tasks Needing Attention */}
                {yearlyTasks.length > 0 && (
                  <div id="yearly-needs-attention-section" style={{ marginTop: '30px', marginBottom: '20px', scrollMarginTop: '80px' }}>
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 6px rgba(6, 182, 212, 0.3)',
                      }}
                      onClick={() => setTodayTabSections(prev => ({ ...prev, yearlyNeedsAttention: !prev.yearlyNeedsAttention }))}
                    >
                      <h3 style={{ margin: 0, color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
                        📆 Needs Attention - Yearly Tasks ({yearlyTasks.length} {yearlyTasks.length === 1 ? 'task' : 'tasks'})
                      </h3>
                      <span style={{ fontSize: '20px', color: '#ffffff' }}>
                        {todayTabSections.yearlyNeedsAttention ? '▼' : '▶'}
                      </span>
                    </div>

                    {todayTabSections.yearlyNeedsAttention && (
                      <div style={{ marginTop: '12px' }}>
                        {yearlyTasks.map((item, index) => (
                          <div 
                            key={item.task.id}
                            style={{
                              marginBottom: '6px',
                              padding: '10px 14px',
                              backgroundColor: '#fff',
                              border: '1px solid #cffafe',
                              borderLeft: '4px solid #06b6d4',
                              borderRadius: '4px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            {/* Line 1: Task name, Need Today prominently displayed */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '600', color: '#2d3748', minWidth: '200px' }}>
                                {item.task.name}
                              </span>
                              {item.yearlyIssue && (
                                <span style={{ fontSize: '14px', color: '#06b6d4', fontWeight: '600' }}>
                                  Need <strong>{item.yearlyIssue.neededToday} {item.task.task_type === TaskType.TIME ? 'min' : item.task.unit || ''}</strong> today (Ideal: {item.yearlyIssue.dailyTarget}, Lagged: {item.yearlyIssue.deficit || 0}, {item.yearlyIssue.daysLeft} days left)
                                </span>
                              )}
                              {(() => {
                                const priority = item.task.priority;
                                const isInNOW = priority && priority <= 3;
                                return (
                                  <>
                                    {isInNOW ? (
                                      <button 
                                        className="btn btn-sm btn-warning"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveToToday(item.task.id, 'task');
                                        }}
                                        title="Task is in NOW - move back to Today (P5)"
                                        style={{ marginLeft: 'auto' }}
                                      >
                                        ← Today
                                      </button>
                                    ) : (
                                      <button 
                                        className="btn btn-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveToNow(item.task.id, 'task');
                                        }}
                                        title="Move to NOW tab (P1)"
                                        style={{
                                          marginLeft: 'auto',
                                          backgroundColor: '#dc2626',
                                          color: 'white',
                                          padding: '6px 12px',
                                          fontSize: '12px',
                                          borderRadius: '6px',
                                          border: 'none',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        → NOW
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            
                            {/* Line 2: Category, frequency badge, and detailed stats */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '11px', color: '#718096', minWidth: '200px' }}>
                                {item.task.pillar_name} - {item.task.category_name}
                              </span>
                              <span style={{ 
                                fontSize: '10px', 
                                padding: '2px 6px', 
                                backgroundColor: '#e2e8f0', 
                                borderRadius: '10px',
                                color: '#4a5568'
                              }}>
                                {item.task.follow_up_frequency === 'daily' ? 'Daily' : item.task.follow_up_frequency === 'weekly' ? 'Weekly' : item.task.follow_up_frequency === 'monthly' ? 'Monthly' : 'Yearly'}
                              </span>
                              {item.yearlyIssue && (
                                <span style={{ fontSize: '12px', color: '#718096' }}>
                                  Target: <strong style={{ color: '#06b6d4' }}>{item.yearlyIssue.dailyTarget}</strong> |
                                  Current: <strong style={{ color: '#10b981' }}>{item.yearlyIssue.currentAverage}</strong> |
                                  Need Today: <strong style={{ color: '#06b6d4' }}>{item.yearlyIssue.neededToday}</strong> {item.task.task_type === TaskType.TIME ? 'min' : item.task.unit || ''} |
                                  📅 {item.yearlyIssue.daysElapsed} days | Lag: {item.yearlyIssue.deficit || 0}
                                </span>
                              )}
                              <button
                                onClick={() => setActiveTab('yearly')}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  backgroundColor: '#06b6d4',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  marginLeft: 'auto'
                                }}
                              >
                                View Yearly →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}

          {/* Today's Challenges Section */}
          {todaysChallenges.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <div 
                style={{
                  background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                  padding: '14px 20px',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🚀</span>
                  <span>Today's Challenges ({todaysChallenges.length})</span>
                </h3>
              </div>

              <div style={{ marginTop: '12px' }}>
                {todaysChallenges.map((challenge) => (
                  <div 
                    key={challenge.id}
                    style={{
                      marginBottom: '8px',
                      padding: '12px 16px',
                      backgroundColor: '#fff',
                      border: '1px solid #fbcfe8',
                      borderLeft: '4px solid #ec4899',
                      borderRadius: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '600', color: '#2d3748', flex: 1 }}>
                        {challenge.name}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={async () => {
                            if (!challenge.completed_today) {
                              try {
                                await api.post(`/api/challenges/${challenge.id}/log`, {
                                  log_date: new Date().toISOString().split('T')[0],
                                  value: 1
                                });
                                await loadTodaysChallenges();
                              } catch (err) {
                                alert('Failed to log challenge');
                              }
                            }
                          }}
                          disabled={challenge.completed_today}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: challenge.completed_today ? '#9ca3af' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: challenge.completed_today ? 'not-allowed' : 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          {challenge.completed_today ? '✓ Logged Today' : 'Log Today'}
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096' }}>
                      🚀 Day {challenge.days_elapsed + 1}/{challenge.days_total} | Progress: {challenge.progress_percentage}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

          {/* Compact Habits & Challenges - Bottom of Today Tab */}
      {activeTab === 'today' && (todaysHabits.length > 0 || todaysChallenges.length > 0) && (
        <div id="habits-section" style={{ marginTop: '30px', marginBottom: '20px', scrollMarginTop: '80px' }}>
          {/* Compact Active Habits */}
          {todaysHabits.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div
                onClick={() => setTodayTabSections(prev => ({ ...prev, todaysHabits: !prev.todaysHabits }))}
                style={{
                  marginBottom: '12px',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontSize: '22px' }}>🔥</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff' }}>
                        Habits Needing Attention
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '400', opacity: 0.9, color: '#ffffff' }}>
                        ({todaysHabits.length})
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '400', opacity: 0.85, color: '#ffffff' }}>
                      2+ consecutive days missed, weekly avg &lt;60%, or monthly avg &lt;40%
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '20px', color: '#ffffff' }}>
                  {todayTabSections.todaysHabits ? '▼' : '▶'}
                </span>
              </div>
              
              {todayTabSections.todaysHabits && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {todaysHabits
                    .sort((a, b) => {
                      // Sort by pillar-category hierarchy first
                      const keyA = `${a.pillar_name || 'Other'}|${a.category_name || 'Other'}`;
                      const keyB = `${b.pillar_name || 'Other'}|${b.category_name || 'Other'}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      
                      // If same hierarchy, sort alphabetically by name
                      return a.name.localeCompare(b.name);
                    })
                    .map(habit => {
                    const isInNOW = nowHabits.has(habit.id);
                    return (
                  <div
                    key={habit.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '14px 16px',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)',
                      border: `2px solid ${habit.pillar_color || '#e2e8f0'}`,
                      borderRadius: '8px',
                      minHeight: '80px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateX(4px)';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    }}
                  >
                    {/* Name and progress info */}
                    <div style={{ flex: 1, minWidth: 0, paddingLeft: '12px' }}>
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '6px'
                      }}>
                        <span style={{
                          fontSize: '15px', 
                          fontWeight: '600',
                          color: '#2d3748',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {habit.name}
                        </span>
                        {/* Target Info Badge */}
                        <span style={{
                          fontSize: '12px',
                          color: '#2563eb',
                          backgroundColor: '#eff6ff',
                          padding: '3px 10px',
                          borderRadius: '10px',
                          border: '1px solid #bfdbfe',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          fontWeight: '600'
                        }}>
                          {(() => {
                            // Show target with unit
                            if (habit.target_value) {
                              const unit = habit.session_target_unit || 
                                          (habit.habit_type === 'time_based' ? 'min' : 
                                           habit.habit_type === 'count_based' ? 'times' : 'units');
                              return `${habit.target_value} ${unit}/day`;
                            }
                            // Fallback to frequency info
                            if (habit.target_frequency === 'daily') return 'Daily';
                            if (habit.target_frequency === 'weekly') return `${habit.target_count_per_period || 1}x/week`;
                            if (habit.target_frequency === 'monthly') return `${habit.target_count_per_period || 1}x/month`;
                            return habit.target_frequency;
                          })()}
                        </span>
                      </div>
                      
                      {/* Monthly progress boxes - Shows entire month in one scrollable line */}
                      <div style={{ 
                        display: 'flex',
                        gap: '3px',
                        alignItems: 'center',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        marginBottom: '4px',
                        paddingBottom: '2px',
                        scrollbarWidth: 'thin'
                      }}>
                        {habit.monthly_completion && habit.monthly_completion.map((completed, index) => {
                          let bgColor = '#e2e8f0'; // Default gray (not applicable or not done)
                          let borderColor = '#cbd5e0';
                          let tooltip = 'Not completed';
                          let displayText = String(index + 1); // Default: day number
                          
                          // Check if this day is the habit start date
                          const habitStartDate = habit.start_date ? new Date(habit.start_date) : null;
                          const isStartDate = habitStartDate && (index + 1) === habitStartDate.getDate();
                          
                          if (completed === null) {
                            bgColor = '#f3f4f6'; // Light gray for not applicable
                            borderColor = '#d1d5db';
                            tooltip = 'Before habit started';
                            if (isStartDate) {
                              displayText = 'Start';
                              tooltip = 'Habit started';
                              bgColor = '#3b82f6'; // Blue for start date
                              borderColor = '#2563eb';
                            }
                          } else if (completed === true) {
                            bgColor = '#10b981'; // Green for completed
                            borderColor = '#059669';
                            tooltip = 'Completed ✓';
                            if (isStartDate) displayText = 'Start';
                          } else if (completed === false) {
                            bgColor = '#ef4444'; // Red for missed
                            borderColor = '#dc2626';
                            tooltip = 'Missed ✗';
                            if (isStartDate) displayText = 'Start';
                          }
                          
                          const today = new Date();
                          const isToday = (index + 1) === today.getDate();
                          
                          return (
                            <div
                              key={index}
                              style={{
                                minWidth: '22px',
                                width: '22px',
                                height: '22px',
                                backgroundColor: bgColor,
                                border: `1px solid ${borderColor}`,
                                borderRadius: '3px',
                                transition: 'all 0.2s ease',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: isStartDate ? '6px' : '8px',
                                fontWeight: '600',
                                color: completed !== null || isStartDate ? 'white' : '#9ca3af',
                                boxShadow: isToday ? '0 0 0 2px #4299e1' : 'none',
                                position: 'relative'
                              }}
                              title={`Day ${index + 1}: ${tooltip}`}
                            >
                              {displayText}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Summary stats */}
                      <div style={{
                        fontSize: '12px',
                        color: '#718096',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        {habit.completed_days_this_month !== undefined && habit.total_days_this_month !== undefined && (
                          <span>
                            <strong style={{ color: '#10b981' }}>{habit.completed_days_this_month}/{habit.total_days_this_month}</strong> days this month
                          </span>
                        )}
                        {habit.stats && (
                          <span>
                            • Week: <strong style={{ 
                              color: (habit.stats.week_success_rate ?? 0) >= 80 ? '#10b981' : 
                                     (habit.stats.week_success_rate ?? 0) >= 60 ? '#f59e0b' : '#ef4444' 
                            }}>
                              {habit.stats.week_success_rate ?? 0}%
                            </strong>, Month: <strong style={{ 
                              color: (habit.stats.month_success_rate ?? 0) >= 80 ? '#10b981' : 
                                     (habit.stats.month_success_rate ?? 0) >= 40 ? '#f59e0b' : '#ef4444' 
                            }}>
                              {habit.stats.month_success_rate ?? 0}%
                            </strong>, Overall: <strong style={{ 
                              color: (habit.stats.success_rate ?? 0) >= 80 ? '#10b981' : 
                                     (habit.stats.success_rate ?? 0) >= 50 ? '#f59e0b' : '#ef4444' 
                            }}>
                              {habit.stats.success_rate ?? 0}%
                            </strong>
                          </span>
                        )}
                        {habit.current_streak > 0 && (
                          <span>
                            • 🔥 <strong style={{ color: '#f59e0b' }}>{habit.current_streak}</strong> day streak
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Warning indicator for missed days */}
                    {(() => {
                      const missedDays = habit.total_days_this_month && habit.completed_days_this_month 
                        ? habit.total_days_this_month - habit.completed_days_this_month 
                        : 0;
                      
                      if (missedDays > 0) {
                        return (
                          <div style={{
                            padding: '6px 12px',
                            backgroundColor: '#dc2626',
                            color: '#fef08a',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)'
                          }}>
                            <span>⚠️</span>
                            <span>{missedDays} MISSED</span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* "IN NOW" badge indicator */}
                    {isInNOW && (
                      <div style={{
                        padding: '6px 12px',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: '700',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: '2px solid #dc2626',
                        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)'
                      }}>
                        <span>🔥</span>
                        <span>IN NOW</span>
                      </div>
                    )}

                    {/* NOW/Today button for habits */}
                    {isInNOW ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveHabitToToday(habit.id);
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          flexShrink: 0
                        }}
                        title="Move back to Today section"
                      >
                        ← Today
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveHabitToNow(habit.id);
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          flexShrink: 0
                        }}
                        title="Move to NOW section"
                      >
                        NOW
                      </button>
                    )}

                    {/* Pillar and Category badge at the end */}
                    {habit.pillar_name && (
                      <div style={{
                        padding: '4px 10px',
                        backgroundColor: habit.pillar_color,
                        color: '#ffffff',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        flexShrink: 0,
                        whiteSpace: 'nowrap'
                      }}>
                        {habit.pillar_name}{habit.category_name ? `: ${habit.category_name}` : ''}
                      </div>
                    )}
                  </div>
                  );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Compact Active Challenges */}
          {todaysChallenges.length > 0 && (
            <div>
              <h3 style={{ 
                marginBottom: '12px', 
                color: '#2d3748', 
                fontSize: '18px', 
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>🚀</span>
                <span>Today's Challenges</span>
                <span style={{ fontSize: '13px', fontWeight: '400', color: '#718096' }}>({todaysChallenges.length})</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {todaysChallenges.map(challenge => {
                  const statusColors: Record<string, string> = {
                    'on_track': '#10b981',
                    'at_risk': '#f59e0b', 
                    'behind': '#ef4444'
                  };
                  const statusColor = statusColors[challenge.status_indicator] || '#6b7280';
                  const statusEmoji = challenge.status_indicator === 'on_track' ? '🟢' : 
                                     challenge.status_indicator === 'at_risk' ? '🟡' : '🔴';

                  return (
                    <div
                      key={challenge.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '14px 16px',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)',
                        border: `2px solid ${challenge.pillar_color || '#e2e8f0'}`,
                        borderRadius: '8px',
                        minHeight: '80px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateX(4px)';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateX(0)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                      }}
                    >
                      {/* Status emoji */}
                      <div style={{ fontSize: '20px', flexShrink: 0, marginTop: '2px' }}>
                        {statusEmoji}
                      </div>

                      {/* Name and progress */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '6px'
                        }}>
                          <span style={{
                            fontSize: '15px', 
                            fontWeight: '600',
                            color: '#2d3748',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {challenge.name}
                          </span>
                          {/* Target/Criteria Badge */}
                          <span style={{
                            padding: '3px 10px',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            {challenge.challenge_type === 'accumulation' && challenge.target_value && challenge.unit ? 
                              `${(challenge.target_value / challenge.days_total).toFixed(1)} ${challenge.unit}/day` :
                            challenge.challenge_type === 'daily_streak' && challenge.target_days ?
                              `Daily ${challenge.target_days}d` :
                            challenge.challenge_type === 'count_based' && challenge.target_count ?
                              `${challenge.target_count}x in ${challenge.days_total}d` :
                              `${challenge.days_total} days`}
                          </span>
                        </div>
                        
                        {/* Progress bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <div style={{
                            flex: 1,
                            height: '8px',
                            backgroundColor: '#e2e8f0',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            position: 'relative'
                          }}>
                            <div style={{
                              width: `${Math.min(challenge.progress_percentage, 100)}%`,
                              height: '100%',
                              backgroundColor: statusColor,
                              transition: 'width 0.3s ease',
                              borderRadius: '4px'
                            }} />
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: statusColor, flexShrink: 0 }}>
                            {Math.round(challenge.progress_percentage)}%
                          </span>
                        </div>
                        
                        {/* Stats summary */}
                        <div style={{
                          fontSize: '11px',
                          color: '#718096',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          {/* Show different stats based on challenge type */}
                          {challenge.challenge_type === 'accumulation' && challenge.unit && (
                            <>
                              <span>
                                <strong style={{ color: '#4a5568' }}>{challenge.current_value.toFixed(1)}</strong>
                                /{challenge.target_value} {challenge.unit}
                              </span>
                              {challenge.daily_average && challenge.daily_average > 0 && (
                                <span>
                                  • <strong style={{ color: '#10b981' }}>{challenge.daily_average.toFixed(1)}</strong> {challenge.unit}/day avg
                                </span>
                              )}
                            </>
                          )}
                          {challenge.challenge_type === 'daily_streak' && (
                            <span>
                              <strong style={{ color: '#4a5568' }}>{challenge.completed_days}</strong>
                              /{challenge.target_days} days completed
                            </span>
                          )}
                          {challenge.challenge_type === 'count_based' && (
                            <span>
                              <strong style={{ color: '#4a5568' }}>{challenge.current_count}</strong>
                              /{challenge.target_count} times
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right side badges container - stacked vertically */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        alignItems: 'flex-end',
                        flexShrink: 0
                      }}>
                        {/* Pillar and Category badge on top */}
                        {challenge.pillar_name && (
                          <div style={{
                            padding: '4px 10px',
                            backgroundColor: challenge.pillar_color || '#718096',
                            color: '#ffffff',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap'
                          }}>
                            {challenge.pillar_name}{challenge.category_name ? `: ${challenge.category_name}` : ''}
                          </div>
                        )}

                        {/* Status badges row */}
                        <div style={{
                          display: 'flex',
                          gap: '6px',
                          alignItems: 'center'
                        }}>
                          {/* Warning indicator - if behind or at risk */}
                          {(challenge.status_indicator === 'behind' || challenge.status_indicator === 'at_risk') && (
                            <div style={{
                              padding: '4px 10px',
                              backgroundColor: challenge.status_indicator === 'behind' ? '#dc2626' : '#f59e0b',
                              color: '#fef08a',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: challenge.status_indicator === 'behind' ? 
                                '0 2px 4px rgba(220, 38, 38, 0.3)' : '0 2px 4px rgba(245, 158, 11, 0.3)'
                            }}>
                              <span>⚠️</span>
                              <span>{challenge.status_indicator === 'behind' ? 'BEHIND!' : 'AT RISK'}</span>
                            </div>
                          )}

                          {/* Status badge - only show if on track (others have warning) */}
                          {challenge.status_indicator === 'on_track' && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              backgroundColor: `${statusColor}15`,
                              border: `1px solid ${statusColor}`,
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: statusColor
                            }}>
                              On Track
                            </div>
                          )}

                          {/* Days remaining badge */}
                          <div style={{
                            padding: '4px 10px',
                            backgroundColor: '#f3f4f6',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#4b5563',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>⏱</span>
                            <span>{challenge.days_remaining}d left</span>
                          </div>

                          {/* Today's completion status indicator */}
                          {challenge.completed_today && (
                            <div style={{
                              padding: '4px 10px',
                              backgroundColor: '#d1fae5',
                              border: '1px solid #10b981',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#065f46',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span>✓</span>
                              <span>Done Today</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Tasks Section */}
          {(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const oneWeekFromNow = new Date(today);
            oneWeekFromNow.setDate(today.getDate() + 7);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

            // Filter tasks with due dates in the next 7 days (excluding today)
            const upcomingWeekTasks = tasks.filter(task => {
              if (!task.due_date || !task.is_active || task.is_completed) return false;
              const dueDate = parseDateString(task.due_date);
              dueDate.setHours(0, 0, 0, 0);
              return dueDate > today && dueDate <= oneWeekFromNow;
            }).sort((a, b) => {
              const dateA = new Date(a.due_date!);
              const dateB = new Date(b.due_date!);
              if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
              }
              return (a.priority || 5) - (b.priority || 5);
            });

            // Filter tasks due this month (beyond next 7 days)
            const upcomingMonthTasks = tasks.filter(task => {
              if (!task.due_date || !task.is_active || task.is_completed) return false;
              const dueDate = parseDateString(task.due_date);
              dueDate.setHours(0, 0, 0, 0);
              return dueDate > oneWeekFromNow && dueDate <= endOfMonth;
            }).sort((a, b) => {
              const dateA = new Date(a.due_date!);
              const dateB = new Date(b.due_date!);
              if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
              }
              return (a.priority || 5) - (b.priority || 5);
            });

            const hasUpcomingTasks = upcomingWeekTasks.length > 0 || upcomingMonthTasks.length > 0;

            if (!hasUpcomingTasks) return null;

            return (
              <div id="upcoming-tasks-section" style={{ marginTop: '24px', scrollMarginTop: '80px' }}>
                <div
                  onClick={() => setTodayTabSections(prev => ({ ...prev, upcomingTasks: !prev.upcomingTasks }))}
                  style={{
                    marginBottom: '12px',
                    padding: '14px 20px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    userSelect: 'none'
                  }}
                >
                  <h3 style={{ 
                    margin: 0,
                    color: '#ffffff', 
                    fontSize: '18px', 
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>📅</span>
                    <span>Upcoming Tasks</span>
                    <span style={{ fontSize: '13px', fontWeight: '400', opacity: 0.9 }}>
                      ({upcomingWeekTasks.length + upcomingMonthTasks.length})
                    </span>
                  </h3>
                  <span style={{ fontSize: '20px', color: '#ffffff' }}>
                    {todayTabSections.upcomingTasks ? '▼' : '▶'}
                  </span>
                </div>

                {todayTabSections.upcomingTasks && (
                  <div>
                    {/* Next 7 Days */}
                    {upcomingWeekTasks.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div
                      onClick={() => setTodayTabSections(prev => ({ ...prev, upcomingNext7Days: !prev.upcomingNext7Days }))}
                      style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#4a5568',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        padding: '8px 12px',
                        backgroundColor: '#f7fafc',
                        borderRadius: '6px',
                        userSelect: 'none'
                      }}
                    >
                      <span>🔜</span>
                      <span>Next 7 Days</span>
                      <span style={{ fontSize: '12px', fontWeight: '400', color: '#718096' }}>
                        ({upcomingWeekTasks.length})
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: '16px' }}>
                        {todayTabSections.upcomingNext7Days ? '▼' : '▶'}
                      </span>
                    </div>
                    {todayTabSections.upcomingNext7Days && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {upcomingWeekTasks.map(task => {
                        const dueDate = new Date(task.due_date!);
                        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const urgencyColor = daysUntilDue <= 2 ? '#ef4444' : daysUntilDue <= 4 ? '#f59e0b' : '#10b981';
                        
                        return (
                          <div
                            key={task.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '12px 16px',
                              background: 'linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)',
                              border: '1px solid #e2e8f0',
                              borderLeft: `4px solid ${urgencyColor}`,
                              borderRadius: '8px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                            }}
                          >
                            {/* Priority indicator */}
                            <div style={{
                              minWidth: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              backgroundColor: task.priority && task.priority <= 3 ? '#fee2e2' : 
                                              task.priority && task.priority <= 7 ? '#fef3c7' : '#f3f4f6',
                              border: `2px solid ${task.priority && task.priority <= 3 ? '#ef4444' : 
                                                    task.priority && task.priority <= 7 ? '#f59e0b' : '#9ca3af'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: task.priority && task.priority <= 3 ? '#dc2626' : 
                                     task.priority && task.priority <= 7 ? '#d97706' : '#6b7280',
                              flexShrink: 0
                            }}>
                              {task.priority || 5}
                            </div>

                            {/* Task info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontSize: '14px', 
                                fontWeight: '600',
                                color: '#2d3748',
                                marginBottom: '4px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {task.name}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#718096',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                {task.pillar_name && (
                                  <span>{task.pillar_name}{task.category_name ? ` › ${task.category_name}` : ''}</span>
                                )}
                                {task.task_type === 'time' && task.allocated_minutes > 0 && (
                                  <span>• {task.allocated_minutes} min</span>
                                )}
                              </div>
                            </div>

                            {/* Due date picker */}
                            <input
                              type="date"
                              value={task.due_date ? formatDateForInput(parseDateString(task.due_date)) : ''}
                              onChange={async (e) => {
                                const newDate = e.target.value;
                                if (!newDate) return;
                                try {
                                  await api.patch(`/api/tasks/${task.id}`, { due_date: newDate });
                                  await loadTasks();
                                } catch (err: any) {
                                  console.error('Error updating due date:', err);
                                  alert('Failed to update due date');
                                }
                              }}
                              style={{
                                padding: '6px 10px',
                                fontSize: '12px',
                                border: `1px solid ${urgencyColor}`,
                                borderRadius: '6px',
                                backgroundColor: `${urgencyColor}15`,
                                color: urgencyColor,
                                fontWeight: '600',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            />

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveToNow(task.id, 'task');
                                }}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  backgroundColor: '#dc2626',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                              >
                                NOW
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTaskId(task.id);
                                  setIsTaskFormOpen(true);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm('Are you sure you want to delete this task?')) {
                                    try {
                                      await api.delete(`/api/tasks/${task.id}`);
                                      await loadTasks();
                                    } catch (err: any) {
                                      console.error('Error deleting task:', err);
                                      alert('Failed to delete task');
                                    }
                                  }
                                }}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    )}
                  </div>
                )}

                {/* This Month */}
                {upcomingMonthTasks.length > 0 && (
                  <div>
                    <div
                      onClick={() => setTodayTabSections(prev => ({ ...prev, upcomingThisMonth: !prev.upcomingThisMonth }))}
                      style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#4a5568',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        padding: '8px 12px',
                        backgroundColor: '#f7fafc',
                        borderRadius: '6px',
                        userSelect: 'none'
                      }}
                    >
                      <span>📆</span>
                      <span>This Month</span>
                      <span style={{ fontSize: '12px', fontWeight: '400', color: '#718096' }}>
                        ({upcomingMonthTasks.length})
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: '16px' }}>
                        {todayTabSections.upcomingThisMonth ? '▼' : '▶'}
                      </span>
                    </div>
                    {todayTabSections.upcomingThisMonth && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {upcomingMonthTasks.map(task => {
                        const dueDate = new Date(task.due_date!);
                        
                        return (
                          <div
                            key={task.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '12px 16px',
                              background: 'linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                            }}
                          >
                            {/* Priority indicator */}
                            <div style={{
                              minWidth: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              backgroundColor: task.priority && task.priority <= 3 ? '#fee2e2' : 
                                              task.priority && task.priority <= 7 ? '#fef3c7' : '#f3f4f6',
                              border: `2px solid ${task.priority && task.priority <= 3 ? '#ef4444' : 
                                                    task.priority && task.priority <= 7 ? '#f59e0b' : '#9ca3af'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: task.priority && task.priority <= 3 ? '#dc2626' : 
                                     task.priority && task.priority <= 7 ? '#d97706' : '#6b7280',
                              flexShrink: 0
                            }}>
                              {task.priority || 5}
                            </div>

                            {/* Task info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontSize: '14px', 
                                fontWeight: '600',
                                color: '#2d3748',
                                marginBottom: '4px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {task.name}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#718096',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                {task.pillar_name && (
                                  <span>{task.pillar_name}{task.category_name ? ` › ${task.category_name}` : ''}</span>
                                )}
                                {task.task_type === 'time' && task.allocated_minutes > 0 && (
                                  <span>• {task.allocated_minutes} min</span>
                                )}
                              </div>
                            </div>

                            {/* Due date picker */}
                            <input
                              type="date"
                              value={task.due_date ? formatDateForInput(parseDateString(task.due_date)) : ''}
                              onChange={async (e) => {
                                const newDate = e.target.value;
                                if (!newDate) return;
                                try {
                                  await api.patch(`/api/tasks/${task.id}`, { due_date: newDate });
                                  await loadTasks();
                                } catch (err: any) {
                                  console.error('Error updating due date:', err);
                                  alert('Failed to update due date');
                                }
                              }}
                              style={{
                                padding: '6px 10px',
                                fontSize: '12px',
                                border: '1px solid #9ca3af',
                                borderRadius: '6px',
                                backgroundColor: '#f3f4f6',
                                color: '#4b5563',
                                fontWeight: '600',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            />

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveToNow(task.id, 'task');
                                }}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  backgroundColor: '#dc2626',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                              >
                                NOW
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTaskId(task.id);
                                  setIsTaskFormOpen(true);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm('Are you sure you want to delete this task?')) {
                                    try {
                                      await api.delete(`/api/tasks/${task.id}`);
                                      await loadTasks();
                                    } catch (err: any) {
                                      console.error('Error deleting task:', err);
                                      alert('Failed to delete task');
                                    }
                                  }
                                }}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    )}
                  </div>
                )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ===== MODALS TEMPORARILY DISABLED FOR FILE SIZE =====
       * Will be extracted to separate TaskModals.tsx component
       * All 15 modals (~2800 lines) will be properly refactored
       * Temporarily use browser prompts for data entry if needed
       */}
      
      {/* TODO: Extract these modals to TaskModals.tsx:
       * 1. AddWeeklyTask, 2. AddMonthlyTask, 3. AddYearlyTask
       * 4. AddOneTimeTask, 5. AddProject, 6. AddMilestone
       * 7. EditMilestone, 8. AddTask, 9. EditTask
       * 10. AddMiscGroup, 11. AddMiscTask, 12. AddWish
       * 13. WishDetails, 14. AddHabit, 15. MilestoneDetail
       */}

      {/* Edit Task Modal */}
      {showEditTaskModal && editingTask && (
        <div className="modal-overlay" onClick={() => setShowEditTaskModal(false)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Edit Task</h2>
            <form onSubmit={handleUpdateTask}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Task Name *
                </label>
                <input
                  type="text"
                  value={editingTask.name}
                  onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Milestone
                </label>
                <select
                  value={editingTask.milestone_id || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, milestone_id: e.target.value ? parseInt(e.target.value) : null })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">No Milestone</option>
                  {projectMilestones
                    .filter(m => m.project_id === editingTask.project_id)
                    .map(milestone => (
                      <option key={milestone.id} value={milestone.id}>
                        {milestone.name}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={editingTask.due_date ? editingTask.due_date.split('T')[0] : ''}
                  onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value || null })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Priority
                </label>
                <select
                  value={editingTask.priority}
                  onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const parentTask = editingTask;
                    setShowEditTaskModal(false);
                    // Open Add Task modal with parent task set
                    setEditingTask(parentTask);
                    setShowAddTaskModal(true);
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#805ad5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                  title="Add a subtask under this task"
                >
                  ➕ Add Subtask
                </button>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditTaskModal(false);
                      setEditingTask(null);
                    }}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      backgroundColor: '#e2e8f0',
                      color: '#2d3748',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      backgroundColor: '#4299e1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Regular Task Modal (for non-project tasks) */}
      {showEditRegularTaskModal && editingRegularTask && (
        <div className="modal-overlay" onClick={() => setShowEditRegularTaskModal(false)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Edit Task</h2>
            <form onSubmit={handleUpdateRegularTask}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Task Name *
                </label>
                <input
                  type="text"
                  value={editingRegularTask.name}
                  onChange={(e) => setEditingRegularTask({ ...editingRegularTask, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  value={editingRegularTask.description || ''}
                  onChange={(e) => setEditingRegularTask({ ...editingRegularTask, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {editingRegularTask.task_type === TaskType.TIME && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    {editingRegularTask.follow_up_frequency === 'weekly' ? 'Weekly' : 
                     editingRegularTask.follow_up_frequency === 'monthly' ? 'Monthly' : 
                     editingRegularTask.follow_up_frequency === 'quarterly' ? 'Quarterly' : 
                     editingRegularTask.follow_up_frequency === 'yearly' ? 'Yearly' : 'Daily'} Target (minutes)
                  </label>
                  <input
                    type="number"
                    value={editingRegularTask.allocated_minutes || 0}
                    onChange={(e) => setEditingRegularTask({ ...editingRegularTask, allocated_minutes: parseInt(e.target.value) || 0 })}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditRegularTaskModal(false);
                    setEditingRegularTask(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#e2e8f0',
                    color: '#2d3748',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#4299e1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Milestone Modal */}
      {showEditProjectMilestoneModal && editingMilestone && (
        <div className="modal-overlay" onClick={() => setShowEditProjectMilestoneModal(false)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Edit Milestone</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!editingMilestone) return;
              
              try {
                await api.put(`/api/projects/milestones/${editingMilestone.id}`, {
                  name: editingMilestone.name,
                  description: editingMilestone.description,
                  target_date: editingMilestone.target_date,
                  is_completed: editingMilestone.is_completed
                });
                
                setShowEditProjectMilestoneModal(false);
                setEditingMilestone(null);
                
                // Refresh data
                if (selectedProject) {
                  await loadProjectMilestones(selectedProject.id);
                  await loadProjects();
                }
              } catch (err: any) {
                console.error('Error updating milestone:', err);
                alert('Failed to update milestone: ' + (err.response?.data?.detail || err.message));
              }
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Milestone Name *
                </label>
                <input
                  type="text"
                  value={editingMilestone.name}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  value={editingMilestone.description || ''}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Target Date *
                </label>
                <input
                  type="date"
                  value={editingMilestone.target_date ? editingMilestone.target_date.split('T')[0] : ''}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, target_date: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingMilestone.is_completed}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, is_completed: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 'bold' }}>Mark as Completed</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditProjectMilestoneModal(false);
                    setEditingMilestone(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#e2e8f0',
                    color: '#2d3748',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#4299e1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProjectModal && (
        <div className="modal-overlay" onClick={() => setShowAddProjectModal(false)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#fff8f0',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '16px 20px',
              borderRadius: '8px',
              marginBottom: '24px',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
            }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '22px' }}>🚀 Add New Project</h2>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              try {
                const projectData: any = {
                  name: formData.get('name'),
                  description: formData.get('description'),
                  status: formData.get('status')
                };
                
                // Add optional fields if they have values
                if (projectFormGoalId) projectData.goal_id = projectFormGoalId;
                if (projectFormPillarId) projectData.pillar_id = projectFormPillarId;
                if (projectFormCategoryId) projectData.category_id = projectFormCategoryId;
                
                const startDate = formData.get('start_date');
                if (startDate) projectData.start_date = startDate;
                
                const targetDate = formData.get('target_completion_date');
                if (targetDate) projectData.target_completion_date = targetDate;
                
                await api.post('/api/projects/', projectData);
                setShowAddProjectModal(false);
                // Reset form state
                setProjectFormGoalId(null);
                setProjectFormPillarId(null);
                setProjectFormCategoryId(null);
                setProjectFormSubCategoryId(null);
                await loadProjects();
              } catch (err: any) {
                console.error('Error creating project:', err);
                alert('Failed to create project: ' + (err.response?.data?.detail || err.message));
              }
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                padding: '10px 16px',
                borderRadius: '6px',
                marginBottom: '16px',
                boxShadow: '0 2px 6px rgba(240, 147, 251, 0.2)'
              }}>
                <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>📝 Project Details</span>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Project Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Life Goal Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  🎯 Link to Life Goal (Optional)
                </label>
                <select
                  name="goal_id"
                  value={projectFormGoalId || ''}
                  onChange={(e) => setProjectFormGoalId(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">-- No Goal --</option>
                  {lifeGoals
                    .filter(g => g.status !== 'completed' && g.status !== 'cancelled')
                    .map(goal => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Pillar/Category Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  🏛️ Pillar & Category (Optional)
                </label>
                <PillarCategorySelector
                  selectedPillarId={projectFormPillarId}
                  selectedCategoryId={projectFormCategoryId}
                  selectedSubCategoryId={projectFormSubCategoryId}
                  onPillarChange={setProjectFormPillarId}
                  onCategoryChange={setProjectFormCategoryId}
                  onSubCategoryChange={setProjectFormSubCategoryId}
                />
              </div>

              {/* Date Fields */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    📅 Start Date
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    🎯 Target Completion
                  </label>
                  <input
                    type="date"
                    name="target_completion_date"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                padding: '10px 16px',
                borderRadius: '6px',
                marginBottom: '16px',
                marginTop: '20px',
                boxShadow: '0 2px 6px rgba(67, 233, 123, 0.2)'
              }}>
                <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>⚡ Status</span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Status
                </label>
                <select
                  name="status"
                  defaultValue="active"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddProjectModal(false)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#e2e8f0',
                    color: '#2d3748',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#48bb78',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Milestone Modal */}
      {showAddProjectMilestoneModal && selectedProject && (
        <div className="modal-overlay" onClick={() => setShowAddProjectMilestoneModal(false)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Add New Milestone</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              await handleCreateProjectMilestone({
                name: formData.get('name'),
                description: formData.get('description'),
                target_date: formData.get('target_date')
              });
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Milestone Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Target Date *
                </label>
                <input
                  type="date"
                  name="target_date"
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddProjectMilestoneModal(false)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#e2e8f0',
                    color: '#2d3748',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#48bb78',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Create Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Project Task Modal */}
      {showAddTaskModal && selectedProject && (
        <div className="modal-overlay" onClick={() => setShowAddTaskModal(false)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#f0f9ff',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              padding: '16px 20px',
              borderRadius: '8px',
              marginBottom: '24px',
              boxShadow: '0 2px 8px rgba(79, 172, 254, 0.3)'
            }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '22px' }}>
                ✅ {editingTask?.id ? `Add Subtask to "${editingTask.name}"` : 'Add New Project Task'}
              </h2>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              try {
                await api.post(`/api/projects/${selectedProject.id}/tasks`, {
                  name: formData.get('name'),
                  description: formData.get('description'),
                  milestone_id: formData.get('milestone_id') || null,
                  due_date: formData.get('due_date') || null,
                  priority: formData.get('priority'),
                  parent_task_id: editingTask?.id || null
                });
                setShowAddTaskModal(false);
                setEditingTask(null);
                await loadProjectTasks(selectedProject.id);
              } catch (err: any) {
                console.error('Error creating task:', err);
                alert('Failed to create task: ' + (err.response?.data?.detail || err.message));
              }
            }}>
              {editingTask?.id && (
                <div style={{ 
                  marginBottom: '16px', 
                  padding: '12px', 
                  backgroundColor: '#e6f3ff', 
                  borderRadius: '4px',
                  border: '1px solid #b3d9ff'
                }}>
                  <strong>Parent Task:</strong> {editingTask.name}
                </div>
              )}

              <div style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                padding: '10px 16px',
                borderRadius: '6px',
                marginBottom: '16px',
                boxShadow: '0 2px 6px rgba(240, 147, 251, 0.2)'
              }}>
                <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>📋 Task Information</span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Task Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                padding: '10px 16px',
                borderRadius: '6px',
                marginBottom: '16px',
                marginTop: '20px',
                boxShadow: '0 2px 6px rgba(67, 233, 123, 0.2)'
              }}>
                <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>🎯 Planning & Priority</span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Milestone
                </label>
                <select
                  name="milestone_id"
                  defaultValue={editingTask?.milestone_id || ''}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">No Milestone</option>
                  {projectMilestones
                    .filter(m => m.project_id === selectedProject.id)
                    .map(milestone => (
                      <option key={milestone.id} value={milestone.id}>
                        {milestone.name}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  name="due_date"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Priority
                </label>
                <select
                  name="priority"
                  defaultValue="medium"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTaskModal(false);
                    setEditingTask(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#e2e8f0',
                    color: '#2d3748',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#48bb78',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {editingTask?.id ? 'Create Subtask' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Milestone Detail Modal */}
      {showMilestoneDetailModal && selectedMilestone && (
        <div className="modal-overlay" onClick={() => setShowMilestoneDetailModal(false)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ marginTop: 0, marginBottom: '8px' }}>{selectedMilestone.name}</h2>
                {selectedMilestone.description && (
                  <p style={{ color: '#666', marginTop: 0 }}>{selectedMilestone.description}</p>
                )}
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '14px' }}>
                  <span style={{ color: '#666' }}>
                    <strong>Target Date:</strong> {parseDateString(selectedMilestone.target_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span style={{ 
                    color: selectedMilestone.is_completed ? '#48bb78' : '#ed8936',
                    fontWeight: 'bold'
                  }}>
                    {selectedMilestone.is_completed ? '✓ Completed' : '○ In Progress'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowMilestoneDetailModal(false)}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  backgroundColor: '#e2e8f0',
                  color: '#2d3748',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Close
              </button>
            </div>

            <h3 style={{ marginBottom: '12px', color: '#2d3748' }}>
              Tasks in this Milestone ({projectTasks.filter(t => t.milestone_id === selectedMilestone.id).length})
            </h3>

            {projectTasks.filter(t => t.milestone_id === selectedMilestone.id && !t.parent_task_id).length === 0 ? (
              <p style={{ color: '#999', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
                No tasks assigned to this milestone yet.
              </p>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                {projectTasks
                  .filter(t => t.milestone_id === selectedMilestone.id && !t.parent_task_id)
                  .map((task, index) => {
                    const renderTask = (t: ProjectTaskData, level: number = 0): JSX.Element => {
                      const subtasks = projectTasks.filter(st => st.parent_task_id === t.id);
                      const hasSubtasks = subtasks.length > 0;
                      const indentPx = level * 30;
                      
                      return (
                        <React.Fragment key={t.id}>
                          <div style={{ 
                            padding: '12px 16px',
                            borderBottom: '1px solid #e2e8f0',
                            backgroundColor: level === 0 ? '#fff' : '#f7fafc',
                            paddingLeft: `${16 + indentPx}px`
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <input
                                type="checkbox"
                                checked={t.is_completed}
                                onChange={() => handleToggleProjectTask(t.id, !t.is_completed)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                              />
                              {hasSubtasks && (
                                <span 
                                  onClick={() => toggleTaskExpansion(t.id)}
                                  style={{ cursor: 'pointer', fontSize: '12px', userSelect: 'none' }}
                                >
                                  {expandedTasks.has(t.id) ? '▼' : '▶'}
                                </span>
                              )}
                              <div style={{ flex: 1 }}>
                                <div style={{ 
                                  fontWeight: level === 0 ? '600' : '500',
                                  color: t.is_completed ? '#999' : '#2d3748',
                                  textDecoration: t.is_completed ? 'line-through' : 'none',
                                  marginBottom: '4px'
                                }}>
                                  {t.name}
                                </div>
                                {t.description && (
                                  <div style={{ fontSize: '13px', color: '#718096' }}>
                                    {t.description}
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '12px' }}>
                                  {t.due_date && (
                                    <span style={{ 
                                      color: parseDateString(t.due_date) < new Date() && !t.is_completed ? '#f56565' : '#666'
                                    }}>
                                      📅 Due: {parseDateString(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                  <span style={{ 
                                    color: t.priority === 'high' ? '#f56565' : t.priority === 'medium' ? '#ed8936' : '#48bb78'
                                  }}>
                                    Priority: {t.priority}
                                  </span>
                                  {hasSubtasks && (
                                    <span style={{ color: '#805ad5' }}>
                                      📋 {subtasks.filter(st => st.is_completed).length}/{subtasks.length} subtasks
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleEditTask(t)}
                                style={{
                                  padding: '4px 12px',
                                  fontSize: '12px',
                                  backgroundColor: '#4299e1',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                          {hasSubtasks && expandedTasks.has(t.id) && (
                            <>
                              {subtasks.map(st => renderTask(st, level + 1))}
                            </>
                          )}
                        </React.Fragment>
                      );
                    }

                    return renderTask(task);
                  })}
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowMilestoneDetailModal(false);
                  setEditingMilestone(selectedMilestone);
                  setShowEditProjectMilestoneModal(true);
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  backgroundColor: '#4299e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Edit Milestone
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete milestone "${selectedMilestone.name}"?`)) {
                    handleDeleteProjectMilestone(selectedMilestone.id);
                    setShowMilestoneDetailModal(false);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  backgroundColor: '#f56565',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Delete Milestone
              </button>
            </div>
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
                      if (task.follow_up_frequency !== 'daily') return false;
                      if (weeklyTaskStatuses[task.id]) return false;
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      if (task.is_completed && task.completed_at) {
                        const completedDate = new Date(task.completed_at);
                        completedDate.setHours(0, 0, 0, 0);
                        if (completedDate.getTime() === today.getTime()) return true;
                        return false;
                      }
                      
                      if (!task.is_active && task.na_marked_at) {
                        const naMarkedDate = new Date(task.na_marked_at);
                        naMarkedDate.setHours(0, 0, 0, 0);
                        if (naMarkedDate.getTime() === today.getTime()) return true;
                        return false;
                      }
                      
                      return task.is_active;
                    })
                    .sort((a, b) => {
                      const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                      const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      
                      const taskOrderA = taskNameOrder[a.name || ''] || 999;
                      const taskOrderB = taskNameOrder[b.name || ''] || 999;
                      
                      if (taskOrderA !== taskOrderB) {
                        return taskOrderA - taskOrderB;
                      }
                      
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
                      if (task.follow_up_frequency !== 'daily') return false;
                      if (monthlyTaskStatuses[task.id]) return false;
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      if (task.is_completed && task.completed_at) {
                        const completedDate = new Date(task.completed_at);
                        completedDate.setHours(0, 0, 0, 0);
                        if (completedDate.getTime() === today.getTime()) return true;
                        return false;
                      }
                      
                      if (!task.is_active && task.na_marked_at) {
                        const naMarkedDate = new Date(task.na_marked_at);
                        naMarkedDate.setHours(0, 0, 0, 0);
                        if (naMarkedDate.getTime() === today.getTime()) return true;
                        return false;
                      }
                      
                      return task.is_active;
                    })
                    .sort((a, b) => {
                      const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                      const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      
                      const taskOrderA = taskNameOrder[a.name || ''] || 999;
                      const taskOrderB = taskNameOrder[b.name || ''] || 999;
                      
                      if (taskOrderA !== taskOrderB) {
                        return taskOrderA - taskOrderB;
                      }
                      
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
                      if (task.follow_up_frequency !== 'weekly') return false;
                      if (monthlyTaskStatuses[task.id]) return false;
                      if (task.is_completed) return false;
                      return task.is_active;
                    })
                    .sort((a, b) => {
                      const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                      const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      
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

      {/* Add Yearly Task Modal */}
      {showAddYearlyTaskModal && (
        <div className="modal-overlay" onClick={() => setShowAddYearlyTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {console.log('📋 Add Yearly Task SELECTION MODAL is rendering')}
            <div className="modal-header">
              <h2>Add Yearly Task</h2>
              <button className="btn-close" onClick={() => setShowAddYearlyTaskModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '15px', color: '#666' }}>
                Select an existing task to track for this year:
              </p>
              
              <div className="form-group">
                <label htmlFor="dailyTaskSelectYearly">Select from Daily Tasks:</label>
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
                      if (task.follow_up_frequency !== 'daily') return false;
                      if (yearlyTaskStatuses[task.id]) return false;
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      if (task.is_completed && task.completed_at) {
                        const completedDate = new Date(task.completed_at);
                        completedDate.setHours(0, 0, 0, 0);
                        if (completedDate.getTime() === today.getTime()) return true;
                        return false;
                      }
                      
                      if (!task.is_active && task.na_marked_at) {
                        const naMarkedDate = new Date(task.na_marked_at);
                        naMarkedDate.setHours(0, 0, 0, 0);
                        if (naMarkedDate.getTime() === today.getTime()) return true;
                        return false;
                      }
                      
                      return task.is_active;
                    })
                    .sort((a, b) => {
                      const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                      const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      
                      const taskOrderA = taskNameOrder[a.name || ''] || 999;
                      const taskOrderB = taskNameOrder[b.name || ''] || 999;
                      
                      if (taskOrderA !== taskOrderB) {
                        return taskOrderA - taskOrderB;
                      }
                      
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
                <label htmlFor="weeklyTaskSelectYearly">Select from Weekly Tasks:</label>
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
                      const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                      const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      
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
                <label htmlFor="monthlyTaskSelectYearly">Select from Monthly Tasks:</label>
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
                      const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                      const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      
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
                      const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
                      const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
                      const orderA = hierarchyOrder[keyA] || 999;
                      const orderB = hierarchyOrder[keyB] || 999;
                      
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      
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
      
      {/* Task Form Modal - for Daily and Today tabs */}
      <TaskForm
        isOpen={isTaskFormOpen}
        taskId={selectedTaskId || undefined}
        defaultParentTaskId={miscSubtaskParentId || undefined}
        defaultFrequency={miscSubtaskParentId ? FollowUpFrequency.MISC : undefined}
        onClose={() => {
          setIsTaskFormOpen(false);
          setMiscSubtaskParentId(null);
        }}
        onSuccess={async () => {
          const freshTasks = await loadTasks();
          await loadTodaysOnlyTasks(freshTasks);
          if (activeTab === 'misc') {
            await loadMiscTaskGroups();
          }
          setIsTaskFormOpen(false);
          setMiscSubtaskParentId(null);
        }}
      />

      {/* Add Habit Modal */}
      <AddHabitModal 
        show={showAddHabitModal}
        onClose={() => {
          setShowAddHabitModal(false);
          setEditingHabit(null);
        }}
        onSuccess={loadHabits}
        editingHabit={editingHabit}
      />

      {/* Add Misc Task Modal - Same as Project Task Modal */}
      {showAddMiscTaskModal && (
        <div className="modal-overlay" onClick={() => {
          console.log('Closing Misc Task modal');
          setShowAddMiscTaskModal(false);
        }} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#f0f9ff',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              padding: '16px 20px',
              borderRadius: '8px',
              marginBottom: '24px',
              boxShadow: '0 2px 8px rgba(79, 172, 254, 0.3)'
            }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '22px' }}>
                ✅ {editingMiscTask?.id ? `Add Subtask to "${editingMiscTask.name}"` : 'Add New Misc Task'}
              </h2>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              try {
                const dueDate = formData.get('due_date');
                const priorityValue = formData.get('priority');
                
                const taskPayload: any = {
                  name: formData.get('name'),
                  description: formData.get('description') || '',
                  // If creating a subtask, inherit pillar/category from parent
                  pillar_id: editingMiscTask?.pillar_id || 1,
                  category_id: editingMiscTask?.category_id || 1,
                  task_type: 'time',
                  allocated_minutes: 30,
                  follow_up_frequency: 'misc',
                  separately_followed: false,
                  is_daily_one_time: false,
                  priority: priorityValue ? parseInt(priorityValue as string) : 5
                };

                // Only add parent_task_id if creating a subtask
                if (editingMiscTask?.id) {
                  taskPayload.parent_task_id = editingMiscTask.id;
                }

                // Only add due_date if it's provided
                if (dueDate && dueDate !== '') {
                  // Convert date string to ISO datetime format (add time component)
                  taskPayload.due_date = dueDate + 'T00:00:00';
                }

                console.log('Creating misc task with payload:', taskPayload);
                await api.post('/api/tasks/', taskPayload);
                setShowAddMiscTaskModal(false);
                setEditingMiscTask(null);
                await loadMiscTaskGroups();
              } catch (err: any) {
                console.error('Error creating misc task:', err);
                console.error('Error response:', err.response);
                console.error('Error data:', err.response?.data);
                console.error('Error detail array:', err.response?.data?.detail);
                
                let errorMessage = 'Unknown error occurred';
                if (err.response?.data) {
                  const data = err.response.data;
                  
                  // Handle FastAPI validation errors (detail is an array)
                  if (Array.isArray(data.detail)) {
                    console.log('Validation errors:', data.detail);
                    errorMessage = data.detail.map((item: any) => {
                      console.log('Error item:', item);
                      const field = item.loc ? item.loc.join(' -> ') : 'unknown field';
                      return `${field}: ${item.msg}`;
                    }).join('\n');
                  } 
                  // Handle string detail
                  else if (data.detail) {
                    errorMessage = data.detail;
                  }
                  // Handle object detail
                  else if (typeof data === 'object') {
                    errorMessage = JSON.stringify(data, null, 2);
                  } 
                  // Handle string data
                  else {
                    errorMessage = String(data);
                  }
                } else if (err.message) {
                  errorMessage = err.message;
                }
                
                alert('Failed to create task:\n' + errorMessage);
              }
            }}>
              {editingMiscTask?.id && (
                <div style={{ 
                  marginBottom: '16px', 
                  padding: '12px', 
                  backgroundColor: '#e6f3ff', 
                  borderRadius: '4px',
                  border: '1px solid #b3d9ff'
                }}>
                  <strong>Parent Task:</strong> {editingMiscTask.name}
                </div>
              )}

              <div style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                padding: '10px 16px',
                borderRadius: '6px',
                marginBottom: '16px',
                boxShadow: '0 2px 6px rgba(240, 147, 251, 0.2)'
              }}>
                <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>📋 Task Information</span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Task Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                padding: '10px 16px',
                borderRadius: '6px',
                marginBottom: '16px',
                marginTop: '20px',
                boxShadow: '0 2px 6px rgba(67, 233, 123, 0.2)'
              }}>
                <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>🎯 Planning & Priority</span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  name="due_date"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Priority
                </label>
                <select
                  name="priority"
                  defaultValue="5"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="1">1 - Highest</option>
                  <option value="2">2 - High</option>
                  <option value="3">3 - Medium-High</option>
                  <option value="4">4 - Medium</option>
                  <option value="5">5 - Normal</option>
                  <option value="6">6 - Medium-Low</option>
                  <option value="7">7 - Low</option>
                  <option value="8">8 - Very Low</option>
                  <option value="9">9 - Minimal</option>
                  <option value="10">10 - Lowest</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMiscTaskModal(false);
                    setEditingMiscTask(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#e2e8f0',
                    color: '#2d3748',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#48bb78',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {editingMiscTask?.id ? 'Create Subtask' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

