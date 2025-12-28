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
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all' | 'custom'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, year: 0, all: 0 });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  useEffect(() => {
    loadCompletedTasks();
  }, [filterPeriod, startDate, endDate, selectedMonth]);

  const loadCompletedTasks = async () => {
    setLoading(true);
    try {
      let url = `/api/completed-tasks?period=${filterPeriod}`;
      
      // Add date range for custom period
      if (filterPeriod === 'custom' && startDate && endDate) {
        url += `&start_date_str=${startDate}&end_date_str=${endDate}`;
      }
      
      // Handle month selection (convert to custom date range)
      if (selectedMonth && filterPeriod === 'custom') {
        const [year, month] = selectedMonth.split('-');
        const monthStart = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const monthEnd = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`;
        url = `/api/completed-tasks?period=custom&start_date_str=${monthStart}&end_date_str=${monthEnd}`;
      }
      
      const response = await apiClient.get(url);
      setCompletedTasks(response.data.tasks || []);
      setStats(response.data.stats || { today: 0, week: 0, month: 0, year: 0, all: 0 });
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
      </div>

      {/* Filters and Search */}
      <div className="completed-controls">
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filterPeriod === 'today' ? 'active' : ''}`}
            onClick={() => {
              setFilterPeriod('today');
              setSelectedMonth('');
            }}
          >
            Today ({stats.today})
          </button>
          <button 
            className={`filter-btn ${filterPeriod === 'week' ? 'active' : ''}`}
            onClick={() => {
              setFilterPeriod('week');
              setSelectedMonth('');
            }}
          >
            This Week ({stats.week})
          </button>
          <button 
            className={`filter-btn ${filterPeriod === 'month' ? 'active' : ''}`}
            onClick={() => {
              setFilterPeriod('month');
              setSelectedMonth('');
            }}
          >
            This Month ({stats.month})
          </button>
          <button 
            className={`filter-btn ${filterPeriod === 'year' ? 'active' : ''}`}
            onClick={() => {
              setFilterPeriod('year');
              setSelectedMonth('');
            }}
          >
            This Year ({stats.year})
          </button>
          <button 
            className={`filter-btn ${filterPeriod === 'all' ? 'active' : ''}`}
            onClick={() => {
              setFilterPeriod('all');
              setSelectedMonth('');
            }}
          >
            All Time ({stats.all})
          </button>
        </div>

        <div className="custom-filters">
          {/* Month Selector */}
          <div className="month-selector">
            <label>📅 Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setFilterPeriod('custom');
                setStartDate('');
                setEndDate('');
              }}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            />
            {selectedMonth && (
              <span style={{ 
                marginLeft: '8px', 
                fontSize: '14px', 
                fontWeight: '600',
                color: '#4a5568',
                backgroundColor: '#e2e8f0',
                padding: '4px 12px',
                borderRadius: '6px'
              }}>
                {completedTasks.length} tasks
              </span>
            )}
          </div>

          {/* Date Range Selector */}
          <div className="date-range-selector">
            <label>📆 Date Range:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value && endDate) {
                  setFilterPeriod('custom');
                  setSelectedMonth('');
                }
              }}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                marginRight: '8px'
              }}
            />
            <span style={{ margin: '0 4px' }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                if (startDate && e.target.value) {
                  setFilterPeriod('custom');
                  setSelectedMonth('');
                }
              }}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                marginLeft: '8px'
              }}
            />
            {startDate && endDate && (
              <span style={{ 
                marginLeft: '12px', 
                fontSize: '14px', 
                fontWeight: '600',
                color: '#4a5568',
                backgroundColor: '#e2e8f0',
                padding: '4px 12px',
                borderRadius: '6px'
              }}>
                {completedTasks.length} tasks
              </span>
            )}
          </div>

          {/* Search Box */}
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search completed tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
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
