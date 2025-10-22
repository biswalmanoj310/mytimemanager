/**
 * Dashboard Page
 * Main dashboard with overview of tasks, goals, and time tracking
 */

import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { PillarStats, DashboardStats } from '../types';
import './Dashboard.css';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pillarStats, setPillarStats] = useState<PillarStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch dashboard data
      const [statsData, pillarData] = await Promise.all([
        api.get<DashboardStats>('/api/dashboard/goals-overview'),
        api.get<{ pillars: PillarStats[] }>('/api/dashboard/goals-overview?group_by=pillar')
      ]);
      
      setStats(statsData);
      setPillarStats(pillarData.pillars || []);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

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

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="subtitle">Welcome to MyTimeManager - Your CANI journey starts here</p>
      </header>

      {/* Overall Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Goals</div>
            <div className="stat-value">{stats.total_goals}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Goals</div>
            <div className="stat-value">{stats.active_goals}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed Goals</div>
            <div className="stat-value">{stats.completed_goals}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completion Rate</div>
            <div className="stat-value">{stats.completion_rate.toFixed(1)}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Time Utilization</div>
            <div className="stat-value">{stats.time_utilization.toFixed(1)}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Hours Spent / Allocated</div>
            <div className="stat-value">
              {stats.total_spent_hours.toFixed(1)} / {stats.total_allocated_hours.toFixed(1)}
            </div>
          </div>
        </div>
      )}

      {/* Pillar Stats */}
      <section className="pillar-section">
        <h2>Three Pillars Overview</h2>
        <div className="pillar-cards">
          {pillarStats.map((pillar) => (
            <div key={pillar.pillar_id} className="pillar-card">
              <div className="pillar-header">
                <span className="pillar-icon">{pillar.pillar_icon}</span>
                <h3>{pillar.pillar_name}</h3>
              </div>
              <div className="pillar-stats">
                <div className="pillar-stat">
                  <span className="label">Goals:</span>
                  <span className="value">{pillar.active_goals} / {pillar.total_goals}</span>
                </div>
                <div className="pillar-stat">
                  <span className="label">Tasks:</span>
                  <span className="value">{pillar.completed_tasks} / {pillar.total_tasks}</span>
                </div>
                <div className="pillar-stat">
                  <span className="label">Hours:</span>
                  <span className="value">
                    {pillar.spent_hours.toFixed(1)} / {pillar.allocated_hours.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${Math.min((pillar.spent_hours / pillar.allocated_hours) * 100, 100)}%`,
                    backgroundColor: pillar.pillar_color
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
          <button className="action-btn">
            <span>➕</span>
            <span>Add Task</span>
          </button>
          <button className="action-btn">
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
    </div>
  );
}
