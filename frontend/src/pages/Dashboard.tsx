/**
 * Dashboard Page
 * Main dashboard with overview of tasks, goals, and time tracking
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import TaskForm from '../components/TaskForm';
import GoalForm from '../components/GoalForm';
import { AddChallengeModal } from '../components/AddChallengeModal';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Tooltip, ResponsiveContainer
} from 'recharts';
import './Dashboard.css';

interface GoalsSummary {
  total_goals: number;
  active_goals: number;
  completed_goals: number;
  pending_goals?: number;
  total_allocated_hours: number;
  total_spent_hours: number;
  overall_progress: number;
  completion_rate: number;
}

interface PillarData {
  pillar_id: number;
  count: number;
  active: number;
  completed: number;
  allocated_hours: number;
  spent_hours: number;
  progress: number;
}

interface Category {
  name: string;
  time_allocated: number;
  time_spent: number;
  progress: number;
}

interface DashboardData {
  summary: GoalsSummary;
  by_pillar: Record<string, PillarData>;
  by_time_period?: any;
  top_performing?: any[];
  needs_attention?: any[];
  recently_completed?: any[];
}

interface TaskStats {
  total_tasks: number;
  completed_tasks: number;
  active_tasks: number;
}

interface ProjectStats {
  total_projects: number;
  completed_projects: number;
  active_projects: number;
}

interface HabitStats {
  total_habits: number;
  active_habits: number;
}

const PILLAR_ICONS: Record<string, string> = {
  'Hard Work': '💼',
  'Calmness': '🧘',
  'Family': '👨‍👩‍👦'
};

const PILLAR_COLORS: Record<string, string> = {
  'Hard Work': '#3B82F6',
  'Calmness': '#10B981',
  'Family': '#A855F7'
};

const BACKGROUND_COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Light Blue', value: '#E0F2FE' },
  { name: 'Sky Blue', value: '#BAE6FD' },
  { name: 'Deep Blue', value: '#93C5FD' },
  { name: 'Ocean Blue', value: '#60A5FA' },
  { name: 'Soft Pink', value: '#FCE7F3' },
  { name: 'Rose Pink', value: '#FBCFE8' },
  { name: 'Deep Rose', value: '#F9A8D4' },
  { name: 'Hot Pink', value: '#F472B6' },
  { name: 'Mint Green', value: '#D1FAE5' },
  { name: 'Lime Green', value: '#BBF7D0' },
  { name: 'Emerald', value: '#6EE7B7' },
  { name: 'Lavender', value: '#EDE9FE' },
  { name: 'Purple Light', value: '#DDD6FE' },
  { name: 'Deep Purple', value: '#C4B5FD' },
  { name: 'Violet', value: '#A78BFA' },
  { name: 'Peach', value: '#FED7AA' },
  { name: 'Amber', value: '#FDE68A' },
  { name: 'Orange', value: '#FCD34D' },
  { name: 'Light Gray', value: '#F3F4F6' },
  { name: 'Cool Gray', value: '#E5E7EB' },
  { name: 'Slate', value: '#CBD5E1' },
];

export default function Dashboard() {
  // Test mode - set to true to bypass API and render immediately
  const TEST_MODE = false;
  
  const [data, setData] = useState<DashboardData | null>(TEST_MODE ? {
    summary: {
      total_goals: 0,
      active_goals: 0,
      completed_goals: 0,
      pending_goals: 0,
      total_allocated_hours: 0,
      total_spent_hours: 0,
      overall_progress: 0,
      completion_rate: 0
    },
    by_pillar: {},
    top_performing: [],
    needs_attention: [],
    recently_completed: []
  } : null);
  const [taskStats, setTaskStats] = useState<TaskStats>({ total_tasks: 0, completed_tasks: 0, active_tasks: 0 });
  const [projectStats, setProjectStats] = useState<ProjectStats>({ total_projects: 0, completed_projects: 0, active_projects: 0 });
  const [habitStats, setHabitStats] = useState<HabitStats>({ total_habits: 0, active_habits: 0 });
  const [pillarCategories, setPillarCategories] = useState<Record<string, Category[]>>({});
  const [loading, setLoading] = useState(!TEST_MODE);
  const [error, setError] = useState<string | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [isChallengeFormOpen, setIsChallengeFormOpen] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState(() => {
    return localStorage.getItem('dashboardBgColor') || '#ffffff';
  });

  // Circle-of-life chart data for dashboard
  interface CirclePeriod { label: string; start: string; end: string; data: any[]; }
  const [weekCategoryCircle, setWeekCategoryCircle] = useState<CirclePeriod[]>([]);
  const [monthCategoryCircle, setMonthCategoryCircle] = useState<CirclePeriod[]>([]);
  const [weekTasksCircle, setWeekTasksCircle] = useState<CirclePeriod[]>([]);
  const [monthTasksCircle, setMonthTasksCircle] = useState<CirclePeriod[]>([]);
  const [weekOneTimeCircle, setWeekOneTimeCircle] = useState<CirclePeriod[]>([]);
  const [monthOneTimeCircle, setMonthOneTimeCircle] = useState<CirclePeriod[]>([]);
  const [circleLoading, setCircleLoading] = useState(true);
  const [circlePeriod, setCirclePeriod] = useState<'week'|'month'>('week');

  const navigate = useNavigate();
  
  console.log('[Dashboard] Component initialized, TEST_MODE:', TEST_MODE);

  const loadDashboardData = async () => {
    console.log('[Dashboard] Starting to load dashboard data...');
    setLoading(true);
    setError(null);
    
    try {
      console.log('[Dashboard] Calling API: /api/dashboard/goals/overview');
      
      // Get today's date for Daily tab filtering
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const [dashboardData, tasks, projects, habits, pillars, categories, dailyStatuses, completionDatesResp] = await Promise.all([
        api.get<DashboardData>('/api/dashboard/goals/overview'),
        api.get<any[]>('/api/tasks'),
        api.get<any[]>('/api/projects'),
        api.get<any[]>('/api/habits'),
        api.get<any[]>('/api/pillars'),
        api.get<any[]>('/api/categories'),
        api.get<any[]>(`/api/daily-task-status/date/${todayStr}`),
        api.get<any>('/api/daily-tasks-history/completion-dates').catch(() => ({}))
      ]);

      // Build map of task_id -> completion date string (from daily_task_status history)
      // api.get already unwraps .data, so completionDatesResp is the plain object directly
      const completionDatesData: Record<string, string> = completionDatesResp || {};
      const dailyTaskCompletionDates = new Map<number, string>(
        Object.entries(completionDatesData).map(([id, date]) => [parseInt(id), date as string])
      );
      
      console.log('[Dashboard] Data received:', dashboardData);
      
      // Calculate task stats
      const completedTasks = tasks.filter(t => t.is_completed).length;
      setTaskStats({
        total_tasks: tasks.length,
        completed_tasks: completedTasks,
        active_tasks: tasks.length - completedTasks
      });
      
      // Calculate project stats
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      setProjectStats({
        total_projects: projects.length,
        completed_projects: completedProjects,
        active_projects: projects.filter(p => p.status === 'active').length
      });
      
      // Calculate habit stats
      setHabitStats({
        total_habits: habits.length,
        active_habits: habits.filter(h => h.is_active !== false).length
      });
      
      // Create status map for quick lookup
      const statusMap = new Map(dailyStatuses.map(s => [s.task_id, s]));
      
      // Filter tasks using EXACT same logic as Daily tab's Time-Based Tasks table
      const timeBasedDailyTasks = tasks.filter(task => {
        // Must be daily frequency
        if (task.follow_up_frequency !== 'daily') return false;
        
        // Must be TIME type (not COUNT) - case-insensitive check
        if (task.task_type?.toLowerCase() !== 'time') return false;
        
        // Must NOT be one-time daily task
        if (task.is_daily_one_time) return false;
        
        // Must be active (not globally completed or inactive)
        // Use !== true to catch null/0/false/undefined from SQLite
        if (task.is_completed || task.is_active !== true) return false;
        
        // Exclude completed/NA tasks for today
        const status = statusMap.get(task.id);
        if (status && (status.is_completed || status.is_na)) return false;

        // Exclude tasks completed on a PREVIOUS day via daily_task_status
        // (same logic as Analytics — prevents stale completed tasks from inflating pillar hours)
        const completionDateStr = dailyTaskCompletionDates.get(task.id);
        if (completionDateStr) {
          const [year, month, day] = completionDateStr.split('-').map(Number);
          const completionDate = new Date(year, month - 1, day);
          completionDate.setHours(0, 0, 0, 0);
          const todayMidnight = new Date();
          todayMidnight.setHours(0, 0, 0, 0);
          if (completionDate < todayMidnight) return false;
        }
        
        return true;
      });
      
      // Debug: Log all time-based daily tasks being counted
      console.log('[Dashboard] Total time-based daily tasks:', timeBasedDailyTasks.length);
      console.log('[Dashboard] Time-based daily tasks:', timeBasedDailyTasks.map(t => ({
        id: t.id,
        name: t.name,
        pillar: pillars.find(p => p.id === t.pillar_id)?.name,
        category: categories.find(c => c.id === t.category_id)?.name,
        allocated_minutes: t.allocated_minutes,
        task_type: t.task_type,
        follow_up_frequency: t.follow_up_frequency
      })));
      
      // Group categories by pillar with DAILY time allocation (from Time-Based Tasks table)
      const pillarCategoryMap: Record<string, Category[]> = {};
      const pillarDailyHours: Record<string, number> = {};
      
      pillars.forEach(pillar => {
        // Calculate DAILY allocated hours for this pillar (from Time-Based Tasks table only)
        const dailyPillarTasks = timeBasedDailyTasks.filter(t => t.pillar_id === pillar.id);
        const dailyPillarAllocated = dailyPillarTasks.reduce((sum, t) => sum + (t.allocated_minutes || 0), 0) / 60;
        pillarDailyHours[pillar.name] = dailyPillarAllocated;
        
        // Debug: Log tasks contributing to this pillar's hours
        if (dailyPillarTasks.length > 0) {
          console.log(`[Dashboard] ${pillar.name} tasks:`, dailyPillarTasks.map(t => ({
            name: t.name,
            category: categories.find(c => c.id === t.category_id)?.name,
            allocated_minutes: t.allocated_minutes,
            follow_up_frequency: t.follow_up_frequency,
            task_type: t.task_type,
            is_daily_one_time: t.is_daily_one_time
          })));
          console.log(`[Dashboard] ${pillar.name} total: ${dailyPillarAllocated.toFixed(2)} hours (${dailyPillarAllocated * 60} minutes)`);
        }
        
        const pillarCats = categories
          .filter(c => c.pillar_id === pillar.id)
          .map(cat => {
            // Only count tasks from Time-Based Tasks table for this category
            const dailyCatTasks = timeBasedDailyTasks.filter(t => t.category_id === cat.id);
            const allocated = dailyCatTasks.reduce((sum, t) => sum + (t.allocated_minutes || 0), 0) / 60;
            const spent = dailyCatTasks.reduce((sum, t) => sum + (t.spent_minutes || 0), 0) / 60;
            return {
              name: cat.name,
              time_allocated: allocated,
              time_spent: spent,
              progress: allocated > 0 ? (spent / allocated) * 100 : 0
            };
          })
          .filter(cat => cat.time_allocated > 0); // Only show categories with allocated time
        
        if (pillarCats.length > 0) {
          pillarCategoryMap[pillar.name] = pillarCats;
        }
      });
      setPillarCategories(pillarCategoryMap);
      
      // Store daily hours for pillar display
      (window as any).pillarDailyHours = pillarDailyHours;
      
      // Ensure we have valid data
      if (dashboardData && typeof dashboardData === 'object') {
        console.log('[Dashboard] Setting data, keys:', Object.keys(dashboardData));
        setData(dashboardData);
        console.log('[Dashboard] Data set successfully');
      } else {
        console.error('[Dashboard] Invalid data format:', dashboardData);
        setError('Invalid data format received from server');
      }
    } catch (err: any) {
      console.error('[Dashboard] Error caught:', err);
      console.error('[Dashboard] Error message:', err.message);
      console.error('[Dashboard] Error response:', err.response);
      setError(err.response?.data?.detail || err.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      console.log('[Dashboard] Setting loading to false');
      setLoading(false);
    }
  };

  // ─── Circle-of-Life chart loader ───────────────────────────────────────────
  const loadCircleCharts = async () => {
    setCircleLoading(true);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const weekStart = (d: Date) => {
      const day = d.getDay(); // 0=Sun
      const diff = day === 0 ? -6 : 1 - day; // Monday
      const m = new Date(d); m.setDate(d.getDate() + diff); m.setHours(0,0,0,0); return m;
    };
    const today = new Date();

    try {
      // --- base task lists (active daily tasks) ---
      const [tasksResp, completionResp] = await Promise.all([
        api.get<any[]>('/api/tasks?limit=1000&is_active=true&is_completed=false'),
        api.get<any>('/api/daily-tasks-history/completion-dates').catch(() => ({}))
      ]);
      const tasks: any[] = tasksResp || [];
      const completionDates = new Map<number, string>(
        Object.entries(completionResp || {}).map(([id, dt]) => [parseInt(id), dt as string])
      );
      const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);

      const isStillActive = (task: any) => {
        if (!task.is_active || task.is_completed || task.na_marked_at) return false;
        const cd = completionDates.get(task.id);
        if (cd) {
          const [y,m,d] = cd.split('-').map(Number);
          const cDate = new Date(y,m-1,d); cDate.setHours(0,0,0,0);
          if (cDate < todayMidnight) return false;
        }
        return true;
      };

      const baseTimeTasks = tasks.filter(t =>
        t.follow_up_frequency === 'daily' &&
        t.task_type?.toLowerCase() === 'time' &&
        !t.is_daily_one_time &&
        isStillActive(t)
      );
      const baseOneTimeTasks = tasks.filter(t =>
        t.follow_up_frequency === 'daily' &&
        t.task_type?.toLowerCase() === 'time' &&
        t.is_daily_one_time === true &&
        isStillActive(t)
      );

      const DRAIN = ['Time Waste'];
      const CATEGORY_ORDER = ['Office-Tasks','Learning','Confidence','Yoga','Sleep','My Tasks','Home Tasks','Time Waste'];
      const PILLAR_ORDER = ['Hard Work', 'Calmness', 'Family'];

      const buildRadar = (data: any[], startStr: string, endStr: string, cType: 'category'|'tasks'|'one_time') => {
        const s = new Date(startStr); const e = new Date(endStr);
        const days = Math.max(1, Math.round((e.getTime()-s.getTime())/86400000)+1);
        if (cType === 'category') {
          return (data as any[]).map((c: any) => {
            const raw = c.allocated_hours > 0 ? Math.round((c.spent_hours/days/c.allocated_hours)*100) : 0;
            const isDrain = DRAIN.includes(c.category_name);
            const score = isDrain ? Math.min(100,Math.max(0,200-raw)) : Math.min(100,raw);
            return { name: c.category_name||'Unknown', spent: raw, score, allocated: 100 };
          });
        } else {
          return (data as any[]).map((t: any) => {
            const raw = t.allocated_hours > 0 ? Math.round((t.spent_hours/days/t.allocated_hours)*100) : 0;
            const score = Math.min(100, raw);
            return { name: t.name||'Unknown', spent: raw, score, allocated: 100 };
          });
        }
      };

      const fetchForPeriod = async (startStr: string, endStr: string) => {
        const [catResp, entriesResp] = await Promise.all([
          api.get<any>(`/api/analytics/category-breakdown?start_date=${startStr}&end_date=${endStr}`),
          api.get<any[]>(`/api/daily-time?start_date=${startStr}&end_date=${endStr}`)
        ]);
        const cats: any[] = (catResp.categories || [])
          .filter((c: any) => c.allocated_hours > 0)
          .sort((a: any, b: any) => CATEGORY_ORDER.indexOf(a.category_name)-CATEGORY_ORDER.indexOf(b.category_name));
        const entries: any[] = entriesResp || [];
        const spentMap = new Map<number,number>();
        entries.forEach((e: any) => { spentMap.set(e.task_id,(spentMap.get(e.task_id)||0)+e.minutes); });
        const toTaskRows = (list: any[]) => list
          .filter(t => t.allocated_minutes > 0)
          .sort((a: any, b: any) => {
            const pa = PILLAR_ORDER.indexOf(a.pillar_name || '');
            const pb = PILLAR_ORDER.indexOf(b.pillar_name || '');
            if (pa !== pb) return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
            const ca = CATEGORY_ORDER.indexOf(a.category_name || '');
            const cb = CATEGORY_ORDER.indexOf(b.category_name || '');
            if (ca !== cb) return (ca === -1 ? 999 : ca) - (cb === -1 ? 999 : cb);
            return (a.name || '').localeCompare(b.name || '');
          })
          .map(t => ({ name: t.name, allocated_hours: t.allocated_minutes/60, spent_hours: (spentMap.get(t.id)||0)/60 }));
        return { cats, timeTasks: toTaskRows(baseTimeTasks), oneTimeTasks: toTaskRows(baseOneTimeTasks), startStr, endStr };
      };

      // Build 4 weeks
      const weekPeriods: { label: string; start: string; end: string; data: any[] }[][] = [[],[],[]];
      for (let i = 3; i >= 0; i--) {
        const wStart = weekStart(today);
        wStart.setDate(wStart.getDate() - i*7);
        const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate()+6);
        const actualEnd = wEnd > today ? today : wEnd;
        const startStr = fmt(wStart); const endStr = fmt(actualEnd);
        const label = i===0 ? 'This Week' : i===1 ? 'Last Week' :
          `${wStart.toLocaleString('en-US',{month:'short',day:'numeric'})}–${actualEnd.toLocaleString('en-US',{month:'short',day:'numeric'})}`;
        try {
          const { cats, timeTasks, oneTimeTasks } = await fetchForPeriod(startStr, endStr);
          weekPeriods[0].push({ label, start: startStr, end: endStr, data: buildRadar(cats, startStr, endStr, 'category') });
          weekPeriods[1].push({ label, start: startStr, end: endStr, data: buildRadar(timeTasks, startStr, endStr, 'tasks') });
          weekPeriods[2].push({ label, start: startStr, end: endStr, data: buildRadar(oneTimeTasks, startStr, endStr, 'one_time') });
        } catch {
          weekPeriods[0].push({ label, start: startStr, end: endStr, data: [] });
          weekPeriods[1].push({ label, start: startStr, end: endStr, data: [] });
          weekPeriods[2].push({ label, start: startStr, end: endStr, data: [] });
        }
      }
      setWeekCategoryCircle(weekPeriods[0]);
      setWeekTasksCircle(weekPeriods[1]);
      setWeekOneTimeCircle(weekPeriods[2]);

      // Build 4 months
      const monthPeriods: { label: string; start: string; end: string; data: any[] }[][] = [[],[],[]];
      for (let i = 3; i >= 0; i--) {
        const mStart = new Date(today.getFullYear(), today.getMonth()-i, 1);
        const mEnd = new Date(today.getFullYear(), today.getMonth()-i+1, 0);
        const actualEnd = mEnd > today ? today : mEnd;
        const startStr = fmt(mStart); const endStr = fmt(actualEnd);
        const label = mStart.toLocaleString('en-US',{month:'short',year:'numeric'});
        try {
          const { cats, timeTasks, oneTimeTasks } = await fetchForPeriod(startStr, endStr);
          monthPeriods[0].push({ label, start: startStr, end: endStr, data: buildRadar(cats, startStr, endStr, 'category') });
          monthPeriods[1].push({ label, start: startStr, end: endStr, data: buildRadar(timeTasks, startStr, endStr, 'tasks') });
          monthPeriods[2].push({ label, start: startStr, end: endStr, data: buildRadar(oneTimeTasks, startStr, endStr, 'one_time') });
        } catch {
          monthPeriods[0].push({ label, start: startStr, end: endStr, data: [] });
          monthPeriods[1].push({ label, start: startStr, end: endStr, data: [] });
          monthPeriods[2].push({ label, start: startStr, end: endStr, data: [] });
        }
      }
      setMonthCategoryCircle(monthPeriods[0]);
      setMonthTasksCircle(monthPeriods[1]);
      setMonthOneTimeCircle(monthPeriods[2]);
    } catch (err) {
      console.error('[Dashboard] Error loading circle charts:', err);
    } finally {
      setCircleLoading(false);
    }
  };

  useEffect(() => {
    console.log('[Dashboard] useEffect running, about to load data');
    loadDashboardData();
    loadCircleCharts();
  }, []);
  
  useEffect(() => {
    // Apply background color to body and layout elements
    console.log('[Dashboard] Applying background color:', backgroundColor);
    document.body.style.backgroundColor = backgroundColor;
    
    // Apply to root app element
    const appRoot = document.getElementById('root');
    if (appRoot) {
      appRoot.style.backgroundColor = backgroundColor;
    }
    
    // Apply to layout element (most important!)
    const layoutElement = document.querySelector('.layout');
    if (layoutElement) {
      (layoutElement as HTMLElement).style.backgroundColor = backgroundColor;
    }
    
    // Apply to main-content element
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      (mainContent as HTMLElement).style.backgroundColor = backgroundColor;
    }
    
    localStorage.setItem('dashboardBgColor', backgroundColor);
    
    return () => {
      // Don't reset on unmount - keep the color
      // User can change it next time they visit Dashboard
    };
  }, [backgroundColor]);

  console.log('[Dashboard] Render - loading:', loading, 'error:', error, 'hasData:', !!data);

  // Show loading state
  if (loading) {
    console.log('[Dashboard] Rendering loading state');
    return (
      <div className="dashboard-loading" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
          If this persists, check browser console (F12) for errors
        </p>
      </div>
    );
  }

  // Show error state before checking data
  if (error) {
    return (
      <div className="dashboard-error">
        <p>{error}</p>
        <button onClick={loadDashboardData} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  // If we finished loading but have no data, show error
  if (!data) {
    return (
      <div className="dashboard-error">
        <p>No dashboard data available</p>
        <button onClick={loadDashboardData} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  // Final safety check
  if (!data.summary) {
    return (
      <div className="dashboard-error">
        <p>No dashboard data available</p>
        <button onClick={loadDashboardData} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  const { summary, by_pillar = {} } = data;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 style={{ color: '#3B82F6' }}>Dashboard</h1>
        <p className="subtitle">Welcome to MakingMeHappier - My journey to a balanced, joyful life</p>
      </header>

      {/* ─── Circle of Life Charts ─────────────────────────────────────────── */}
      {(() => {
        const CHART_TYPES = [
          { label: '📁 Category Distribution', desc: 'Categories across pillars', weekData: weekCategoryCircle, monthData: monthCategoryCircle, color: '#4299e1' },
          { label: '⏱️ Time-Based Tasks',       desc: 'Recurring task time',      weekData: weekTasksCircle,    monthData: monthTasksCircle,   color: '#10b981' },
          { label: '🗂️ One-Time Tasks',         desc: 'Projects & one-offs',      weekData: weekOneTimeCircle,  monthData: monthOneTimeCircle, color: '#a855f7' },
        ];

        const RadarCard = ({ period, isNewest, accentColor }: { period: { label: string; start: string; end: string; data: any[] }; isNewest: boolean; accentColor: string }) => {
          const avg = period.data.length ? period.data.reduce((s: number, d: any) => s + d.score, 0) / period.data.length : 0;
          return (
            <div style={{ background: 'white', borderRadius: '12px', padding: '12px', boxShadow: isNewest ? `0 0 0 2px ${accentColor}, 0 4px 12px rgba(0,0,0,0.1)` : '0 2px 8px rgba(0,0,0,0.07)', border: isNewest ? `2px solid ${accentColor}` : '1px solid #e5e7eb', flex: '1', minWidth: '180px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: isNewest ? accentColor : '#374151' }}>{isNewest && '★ '}{period.label}</div>
                {period.data.length > 0 && (
                  <div style={{ fontSize: '11px', fontWeight: '600', color: avg>=80?'#16a34a':avg>=60?'#b45309':'#dc2626', background: avg>=80?'#d1fae5':avg>=60?'#fef3c7':'#fee2e2', padding: '2px 6px', borderRadius: '10px' }}>{Math.round(avg)}%</div>
                )}
              </div>
              {period.data.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '12px' }}>No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={period.data} margin={{ top: 15, right: 25, bottom: 15, left: 25 }}>
                    <PolarGrid strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="name" tick={(props: any) => {
                      const { x, y, payload, textAnchor } = props;
                      const name: string = payload.value;
                      const words = name.split(' ');
                      const lines: string[] = [];
                      let cur = '';
                      words.forEach((w: string) => {
                        if ((cur+(cur?' ':'')+w).length <= 12) { cur = cur?cur+' '+w:w; }
                        else { if (cur) lines.push(cur); cur = w; }
                      });
                      if (cur) lines.push(cur);
                      return (
                        <text x={x} y={y} textAnchor={textAnchor||'middle'} fontSize={9} fontWeight={600} fill="#374151">
                          {lines.map((l: string, i: number) => <tspan key={i} x={x} dy={i===0?0:11}>{l}</tspan>)}
                        </text>
                      );
                    }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Goal" dataKey="allocated" stroke="#276749" fill="#276749" fillOpacity={0.06} strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                    <Radar name="Actual" dataKey="spent" stroke={isNewest ? accentColor : '#93c5fd'} fill={isNewest ? accentColor : '#93c5fd'} fillOpacity={0.4} strokeWidth={2} />
                    <Tooltip formatter={(v: any, n: string) => [`${v}%`, n]} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        };

        return (
          <section style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <h2 style={{ color: '#3B82F6', margin: 0 }}>🔮 Circle of Life</h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setCirclePeriod('week')}
                  style={{ padding: '6px 16px', borderRadius: '8px', border: circlePeriod==='week' ? '2px solid #3B82F6' : '2px solid #e2e8f0', background: circlePeriod==='week' ? '#3B82F6' : 'white', color: circlePeriod==='week' ? 'white' : '#374151', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                >📆 Last 4 Weeks</button>
                <button
                  onClick={() => setCirclePeriod('month')}
                  style={{ padding: '6px 16px', borderRadius: '8px', border: circlePeriod==='month' ? '2px solid #3B82F6' : '2px solid #e2e8f0', background: circlePeriod==='month' ? '#3B82F6' : 'white', color: circlePeriod==='month' ? 'white' : '#374151', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                >📅 Last 4 Months</button>
              </div>
            </div>
            {circleLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>⏳ Loading charts...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {CHART_TYPES.map((ct) => {
                  const activeData = circlePeriod === 'week' ? ct.weekData : ct.monthData;
                  const reversedData = [...activeData].reverse();
                  return (
                    <div key={ct.label} style={{ background: '#f8fafc', borderRadius: '14px', padding: '20px', border: `2px solid ${ct.color}22` }}>
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '17px', fontWeight: '700', color: ct.color }}>{ct.label}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{ct.desc}</div>
                      </div>
                      {/* 4 charts in a row — latest first */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {reversedData.map((p, i) => (
                          <RadarCard key={p.label} period={p} isNewest={i === 0} accentColor={ct.color} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })()}

      {/* Stats in Grouped Panels */}
      <div className="stats-panels-grid">
        {/* Goals Panel */}
        <div className="stats-panel" style={{ border: '4px solid #3B82F6' }}>
          <div className="panel-title" style={{ color: '#3B82F6' }}>🎯 Goals</div>
          <div className="panel-stats">
            <div className="panel-stat-item" style={{ backgroundColor: '#3B82F6' }}>
              <div className="panel-stat-label">Total</div>
              <div className="panel-stat-value">{summary.total_goals || 0}</div>
            </div>
            <div className="panel-stat-item" style={{ backgroundColor: '#60A5FA' }}>
              <div className="panel-stat-label">Active</div>
              <div className="panel-stat-value">{summary.active_goals || 0}</div>
            </div>
            <div className="panel-stat-item" style={{ backgroundColor: '#93C5FD' }}>
              <div className="panel-stat-label">Completed</div>
              <div className="panel-stat-value">{summary.completed_goals || 0}</div>
            </div>
          </div>
        </div>

        {/* Projects Panel */}
        <div className="stats-panel" style={{ border: '4px solid #F59E0B' }}>
          <div className="panel-title" style={{ color: '#F59E0B' }}>📁 Projects</div>
          <div className="panel-stats">
            <div className="panel-stat-item" style={{ backgroundColor: '#F59E0B' }}>
              <div className="panel-stat-label">Total</div>
              <div className="panel-stat-value">{projectStats.total_projects}</div>
            </div>
            <div className="panel-stat-item" style={{ backgroundColor: '#FBBF24' }}>
              <div className="panel-stat-label">Active</div>
              <div className="panel-stat-value">{projectStats.active_projects}</div>
            </div>
            <div className="panel-stat-item" style={{ backgroundColor: '#FCD34D' }}>
              <div className="panel-stat-label">Completed</div>
              <div className="panel-stat-value">{projectStats.completed_projects}</div>
            </div>
          </div>
        </div>

        {/* Tasks Panel */}
        <div className="stats-panel" style={{ border: '4px solid #EC4899' }}>
          <div className="panel-title" style={{ color: '#EC4899' }}>📋 Tasks</div>
          <div className="panel-stats">
            <div className="panel-stat-item" style={{ backgroundColor: '#EC4899' }}>
              <div className="panel-stat-label">Total</div>
              <div className="panel-stat-value">{taskStats.total_tasks}</div>
            </div>
            <div className="panel-stat-item" style={{ backgroundColor: '#F472B6' }}>
              <div className="panel-stat-label">Active</div>
              <div className="panel-stat-value">{taskStats.active_tasks}</div>
            </div>
            <div className="panel-stat-item" style={{ backgroundColor: '#F9A8D4' }}>
              <div className="panel-stat-label">Completed</div>
              <div className="panel-stat-value">{taskStats.completed_tasks}</div>
            </div>
          </div>
        </div>

        {/* Habits Panel */}
        <div className="stats-panel" style={{ border: '4px solid #A855F7' }}>
          <div className="panel-title" style={{ color: '#A855F7' }}>🎨 Habits</div>
          <div className="panel-stats">
            <div className="panel-stat-item" style={{ backgroundColor: '#A855F7' }}>
              <div className="panel-stat-label">Total</div>
              <div className="panel-stat-value">{habitStats.total_habits}</div>
            </div>
            <div className="panel-stat-item" style={{ backgroundColor: '#C084FC' }}>
              <div className="panel-stat-label">Active</div>
              <div className="panel-stat-value">{habitStats.active_habits}</div>
            </div>
            <div className="panel-stat-item" style={{ backgroundColor: '#E9D5FF', color: '#6B21A8' }}>
              <div className="panel-stat-label">Inactive</div>
              <div className="panel-stat-value">{habitStats.total_habits - habitStats.active_habits}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Three Pillars with Categories */}
      <section className="pillars-section">
        <h2 style={{ color: '#3B82F6' }}>📊 Three Pillars Overview (Daily)</h2>
        <div className="stats-panels-grid">
          {['Hard Work', 'Calmness', 'Family'].map((pillarName) => {
            // Get daily allocated hours from window (calculated from Daily tab tasks)
            const dailyHours = (window as any).pillarDailyHours?.[pillarName] || 0;
            
            return (
            <div key={pillarName} className="stats-panel" style={{ border: `4px solid ${PILLAR_COLORS[pillarName]}` }}>
              <div className="panel-title" style={{ color: PILLAR_COLORS[pillarName] }}>
                {PILLAR_ICONS[pillarName] || '📊'} {pillarName} ({dailyHours.toFixed(1)} Hours)
              </div>
              
              {/* Categories Breakdown */}
              {pillarCategories[pillarName] && pillarCategories[pillarName].length > 0 ? (
                <div className="categories-section">
                  <div className="categories-header">Categories (Daily Allocation)</div>
                  {pillarCategories[pillarName].map((category, idx) => {
                    // Generate lighter shades based on index
                    const baseColor = PILLAR_COLORS[pillarName];
                    const opacity = 1 - (idx * 0.15); // Gradually lighter
                    return (
                      <div 
                        key={idx} 
                        className="category-row-simple"
                        style={{ 
                          backgroundColor: baseColor + Math.floor(opacity * 255).toString(16).padStart(2, '0'),
                          color: 'white'
                        }}
                      >
                        <div className="category-name-simple">{category.name}</div>
                        <div className="category-time-simple">{category.time_allocated.toFixed(1)} hrs</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="no-categories">
                  <p>No daily tasks allocated</p>
                  <small>Add tasks in Daily tab → Time-Based Tasks table</small>
                </div>
              )}
            </div>
          );
          })}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="quick-actions">
        <h2>⚡ Quick Actions</h2>
        <div className="action-buttons">
          <button className="action-btn" onClick={() => setIsTaskFormOpen(true)}>
            <span>➕</span>
            <span>Add Task</span>
          </button>
          <button className="action-btn" onClick={() => setIsGoalFormOpen(true)}>
            <span>🎯</span>
            <span>Create Goal</span>
          </button>
          <button className="action-btn" onClick={() => navigate('/tasks?tab=projects&action=add')}>
            <span>📁</span>
            <span>Add Project</span>
          </button>
          <button className="action-btn" onClick={() => navigate('/goals?tab=wishes&action=add')}>
            <span>✨</span>
            <span>Add Dream</span>
          </button>
          <button className="action-btn" onClick={() => setIsChallengeFormOpen(true)}>
            <span>🏆</span>
            <span>Add Challenge</span>
          </button>
          <button className="action-btn" onClick={() => window.location.href = '/my-day-design'}>
            <span>🎨</span>
            <span>My Day Design</span>
          </button>
          <button className="action-btn" onClick={() => window.location.href = '/calendar'}>
            <span>📅</span>
            <span>Calendar</span>
          </button>
          <button className="action-btn" onClick={() => window.location.href = '/time-tracking'}>
            <span>⏱️</span>
            <span>Track Time</span>
          </button>
        </div>
      </section>

      {/* Background Color Selector */}
      <section className="color-selector-section">
        <h3 style={{ color: '#667eea', fontSize: '16px', fontWeight: '600', marginBottom: '16px', textAlign: 'center' }}>
          🎨 Choose Your Background Color
        </h3>
        <div className="color-buttons-grid">
          {BACKGROUND_COLORS.map((color) => (
            <button
              key={color.value}
              className={`color-btn ${backgroundColor === color.value ? 'active' : ''}`}
              style={{ 
                backgroundColor: color.value,
                border: backgroundColor === color.value ? '3px solid #667eea' : '2px solid #d1d5db'
              }}
              onClick={() => setBackgroundColor(color.value)}
              title={color.name}
            >
              {backgroundColor === color.value && <span className="color-checkmark">✓</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Task Form Modal */}
      <TaskForm
        isOpen={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
        onSuccess={() => {
          loadDashboardData();
          setIsTaskFormOpen(false);
        }}
      />

      {/* Goal Form Modal */}
      <GoalForm
        isOpen={isGoalFormOpen}
        onClose={() => setIsGoalFormOpen(false)}
        onSuccess={() => {
          loadDashboardData();
          setIsGoalFormOpen(false);
        }}
      />

      {/* Challenge Form Modal */}
      {isChallengeFormOpen && (
        <AddChallengeModal
          show={true}
          onClose={() => setIsChallengeFormOpen(false)}
          onSuccess={() => {
            setIsChallengeFormOpen(false);
          }}
        />
      )}
    </div>
  );
}
