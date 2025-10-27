import { useState, useEffect } from 'react';
import apiClient from '../services/api';
import './Completed.css';

interface CompletedTask {
  id: number;
  name: string;
  description?: string;
  completed_at: string;
  task_type: 'daily' | 'project' | 'goal';
  category_name?: string;
  project_name?: string;
  goal_name?: string;
  pillar_name?: string;
  priority?: string;
  due_date?: string;
}

interface GroupedTasks {
  [key: string]: CompletedTask[];
}

function Completed() {
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, all: 0 });

  useEffect(() => {
    loadCompletedTasks();
  }, [filterPeriod]);

  const loadCompletedTasks = async () => {
    setLoading(true);
    try {
      // Load completed tasks based on period
      const response = await apiClient.get(`/api/completed-tasks?period=${filterPeriod}`);
      setCompletedTasks(response.data.tasks || []);
      setStats(response.data.stats || { today: 0, week: 0, month: 0, all: 0 });
    } catch (error) {
      console.error('Error loading completed tasks:', error);
      setCompletedTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const groupTasksByDate = (tasks: CompletedTask[]): GroupedTasks => {
    const filtered = tasks.filter(task => 
      task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const grouped: GroupedTasks = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filtered.forEach(task => {
      const completedDate = new Date(task.completed_at);
      completedDate.setHours(0, 0, 0, 0);

      let groupKey: string;
      const diffDays = Math.floor((today.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        groupKey = '📅 Today';
      } else if (diffDays === 1) {
        groupKey = '📅 Yesterday';
      } else if (diffDays <= 7) {
        groupKey = `📅 ${completedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`;
      } else {
        groupKey = `📅 ${completedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
      }

      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(task);
    });

    return grouped;
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'daily': return '📝';
      case 'project': return '📋';
      case 'goal': return '🎯';
      default: return '✓';
    }
  };

  const getPriorityClass = (priority?: string) => {
    if (!priority) return '';
    return `priority-${priority.toLowerCase()}`;
  };

  const groupedTasks = groupTasksByDate(completedTasks);

  return (
    <div className="completed-container">
      <div className="completed-header">
        <div className="header-title">
          <h1>✅ Completed Tasks</h1>
          <p>Your accomplishment journal - track what you've achieved!</p>
        </div>

        {/* Stats Cards */}
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-number">{stats.today}</div>
            <div className="stat-label">Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.week}</div>
            <div className="stat-label">This Week</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.month}</div>
            <div className="stat-label">This Month</div>
          </div>
          <div className="stat-card highlight">
            <div className="stat-number">{stats.all}</div>
            <div className="stat-label">All Time</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="completed-controls">
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filterPeriod === 'today' ? 'active' : ''}`}
            onClick={() => setFilterPeriod('today')}
          >
            Today
          </button>
          <button 
            className={`filter-btn ${filterPeriod === 'week' ? 'active' : ''}`}
            onClick={() => setFilterPeriod('week')}
          >
            This Week
          </button>
          <button 
            className={`filter-btn ${filterPeriod === 'month' ? 'active' : ''}`}
            onClick={() => setFilterPeriod('month')}
          >
            This Month
          </button>
          <button 
            className={`filter-btn ${filterPeriod === 'all' ? 'active' : ''}`}
            onClick={() => setFilterPeriod('all')}
          >
            All Time
          </button>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search completed tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Completed Tasks List */}
      <div className="completed-content">
        {loading ? (
          <div className="loading-state">Loading completed tasks...</div>
        ) : Object.keys(groupedTasks).length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No completed tasks found</h3>
            <p>Complete some tasks and they'll appear here!</p>
          </div>
        ) : (
          Object.entries(groupedTasks).map(([dateGroup, tasks]) => (
            <div key={dateGroup} className="task-group">
              <div className="group-header">
                <h3>{dateGroup}</h3>
                <span className="task-count">{tasks.length} tasks</span>
              </div>

              <div className="tasks-list">
                {tasks.map((task) => (
                  <div key={`${task.task_type}-${task.id}`} className="completed-task-card">
                    <div className="task-icon">
                      {getTaskIcon(task.task_type)}
                    </div>
                    
                    <div className="task-details">
                      <div className="task-name">
                        <span className="strikethrough">{task.name}</span>
                        {task.priority && (
                          <span className={`task-priority ${getPriorityClass(task.priority)}`}>
                            {task.priority}
                          </span>
                        )}
                      </div>
                      
                      {task.description && (
                        <div className="task-description">{task.description}</div>
                      )}
                      
                      <div className="task-meta">
                        <span className="task-type-badge">
                          {task.task_type === 'daily' && '📝 Daily Task'}
                          {task.task_type === 'project' && `📋 ${task.project_name || 'Project'}`}
                          {task.task_type === 'goal' && `🎯 ${task.goal_name || 'Goal'}`}
                        </span>
                        
                        {task.category_name && (
                          <span className="task-category">
                            📂 {task.category_name}
                          </span>
                        )}
                        
                        {task.pillar_name && (
                          <span className="task-pillar">
                            🏛️ {task.pillar_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="task-completion-info">
                      <div className="completion-time">
                        ✓ {new Date(task.completed_at).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </div>
                      {task.due_date && (
                        <div className="due-date-info">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Motivational Footer */}
      {!loading && completedTasks.length > 0 && (
        <div className="motivation-footer">
          <div className="motivation-message">
            {stats.today > 0 && `🎉 Great job! You completed ${stats.today} task${stats.today > 1 ? 's' : ''} today!`}
            {stats.today === 0 && stats.week > 0 && `💪 You've completed ${stats.week} tasks this week. Keep it up!`}
            {stats.today === 0 && stats.week === 0 && `🚀 Ready to complete some tasks today?`}
          </div>
        </div>
      )}
    </div>
  );
}

export default Completed;
