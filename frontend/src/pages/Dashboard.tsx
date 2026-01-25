/**
 * Dashboard Page
 * Main dashboard with overview of tasks, goals, and time tracking
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import TaskForm from '../components/TaskForm';
import GoalForm from '../components/GoalForm';
import { AddChallengeModal } from '../components/AddChallengeModal';
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
      
      const [dashboardData, tasks, projects, habits, pillars, categories, dailyStatuses] = await Promise.all([
        api.get<DashboardData>('/api/dashboard/goals/overview'),
        api.get<any[]>('/api/tasks'),
        api.get<any[]>('/api/projects'),
        api.get<any[]>('/api/habits'),
        api.get<any[]>('/api/pillars'),
        api.get<any[]>('/api/categories'),
        api.get<any[]>(`/api/daily-task-status/date/${todayStr}`)
      ]);
      
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
        
        // Must be TIME type (not COUNT)
        if (task.task_type !== 'time') return false;
        
        // Must NOT be one-time daily task
        if (task.is_daily_one_time) return false;
        
        // Exclude completed/NA tasks for today
        const status = statusMap.get(task.id);
        if (status && (status.is_completed || status.is_na)) return false;
        
        return true;
      });
      
      // Group categories by pillar with DAILY time allocation (from Time-Based Tasks table)
      const pillarCategoryMap: Record<string, Category[]> = {};
      const pillarDailyHours: Record<string, number> = {};
      
      pillars.forEach(pillar => {
        // Calculate DAILY allocated hours for this pillar (from Time-Based Tasks table only)
        const dailyPillarTasks = timeBasedDailyTasks.filter(t => t.pillar_id === pillar.id);
        const dailyPillarAllocated = dailyPillarTasks.reduce((sum, t) => sum + (t.allocated_minutes || 0), 0) / 60;
        pillarDailyHours[pillar.name] = dailyPillarAllocated;
        
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

  useEffect(() => {
    console.log('[Dashboard] useEffect running, about to load data');
    loadDashboardData();
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
          isOpen={isChallengeFormOpen}
          onClose={() => setIsChallengeFormOpen(false)}
          onSuccess={() => {
            setIsChallengeFormOpen(false);
          }}
          challenge={null}
        />
      )}
    </div>
  );
}
