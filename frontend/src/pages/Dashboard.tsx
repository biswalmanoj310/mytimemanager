/**
 * Dashboard Page
 * Main dashboard with overview of tasks, goals, and time tracking
 */

import { useEffect, useState } from 'react';
import { api } from '../services/api';
import TaskForm from '../components/TaskForm';
import GoalForm from '../components/GoalForm';
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

interface DashboardData {
  summary: GoalsSummary;
  by_pillar: Record<string, PillarData>;
  by_time_period?: any;
  top_performing?: any[];
  needs_attention?: any[];
  recently_completed?: any[];
}

const PILLAR_ICONS: Record<string, string> = {
  'Hard Work': '💼',
  'Calmness': '🧘',
  'Family': '👨‍👩‍👦'
};

const PILLAR_COLORS: Record<string, string> = {
  'Hard Work': '#3B82F6',
  'Calmness': '#10B981',
  'Family': '#F59E0B'
};

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
  const [loading, setLoading] = useState(!TEST_MODE);
  const [error, setError] = useState<string | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  
  console.log('[Dashboard] Component initialized, TEST_MODE:', TEST_MODE);

  const loadDashboardData = async () => {
    console.log('[Dashboard] Starting to load dashboard data...');
    setLoading(true);
    setError(null);
    
    try {
      console.log('[Dashboard] Calling API: /api/dashboard/goals/overview');
      const dashboardData = await api.get<DashboardData>('/api/dashboard/goals/overview');
      console.log('[Dashboard] Data received:', dashboardData);
      console.log('[Dashboard] Data type:', typeof dashboardData);
      
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
        <h1>Dashboard</h1>
        <p className="subtitle">Welcome to MyTimeManager - Your CANI journey starts here</p>
      </header>

      {/* Overall Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Goals</div>
          <div className="stat-value">{summary.total_goals || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Goals</div>
          <div className="stat-value">{summary.active_goals || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed Goals</div>
          <div className="stat-value">{summary.completed_goals || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completion Rate</div>
          <div className="stat-value">{(summary.completion_rate || 0).toFixed(1)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overall Progress</div>
          <div className="stat-value">{(summary.overall_progress || 0).toFixed(1)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Hours Spent / Allocated</div>
          <div className="stat-value">
            {(summary.total_spent_hours || 0).toFixed(1)} / {(summary.total_allocated_hours || 0).toFixed(1)}
          </div>
        </div>
      </div>

      {/* Pillar Stats */}
      <section className="pillar-section">
        <h2>Three Pillars Overview</h2>
        <div className="pillar-cards">
          {by_pillar && Object.entries(by_pillar).map(([pillarName, pillarData]) => (
            <div key={pillarName} className="pillar-card">
              <div className="pillar-header">
                <span className="pillar-icon">{PILLAR_ICONS[pillarName] || '📊'}</span>
                <h3>{pillarName}</h3>
              </div>
              <div className="pillar-stats">
                <div className="pillar-stat">
                  <span className="label">Goals:</span>
                  <span className="value">{pillarData.active || 0} / {pillarData.count || 0}</span>
                </div>
                <div className="pillar-stat">
                  <span className="label">Completed:</span>
                  <span className="value">{pillarData.completed || 0}</span>
                </div>
                <div className="pillar-stat">
                  <span className="label">Hours:</span>
                  <span className="value">
                    {(pillarData.spent_hours || 0).toFixed(1)} / {(pillarData.allocated_hours || 0).toFixed(1)}
                  </span>
                </div>
                <div className="pillar-stat">
                  <span className="label">Progress:</span>
                  <span className="value">{(pillarData.progress || 0).toFixed(1)}%</span>
                </div>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${Math.min(pillarData.progress || 0, 100)}%`,
                    backgroundColor: PILLAR_COLORS[pillarName] || '#6B7280'
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-buttons">
          <button className="action-btn" onClick={() => setIsTaskFormOpen(true)}>
            <span>➕</span>
            <span>Add Task</span>
          </button>
          <button className="action-btn" onClick={() => setIsGoalFormOpen(true)}>
            <span>🎯</span>
            <span>Create Goal</span>
          </button>
          <button className="action-btn">
            <span>⏱️</span>
            <span>Track Time</span>
          </button>
          <button className="action-btn">
            <span>📊</span>
            <span>View Analytics</span>
          </button>
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
    </div>
  );
}
