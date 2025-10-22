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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading dashboard data...');
      const dashboardData = await api.get<DashboardData>('/api/dashboard/goals/overview');
      console.log('Dashboard data loaded:', dashboardData);
      
      setData(dashboardData);
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      console.error('Error details:', err.response?.data);
      setError(err.response?.data?.detail || err.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Always show loading first on initial mount
  if (loading || !data) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // Show error state
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
