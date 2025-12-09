import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Tasks.css';

interface ImportantTask {
  id: number;
  name: string;
  description?: string;
  pillar_id: number;
  pillar_name?: string;
  category_id: number;
  category_name?: string;
  sub_category_id?: number;
  ideal_gap_days: number;
  last_check_date?: string;
  start_date?: string;
  check_history?: string;
  priority?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  parent_id?: number;
  children?: ImportantTask[];
}

interface ImportantTaskWithCalculations extends ImportantTask {
  days_since_check: number;
  diff: number;
  week_number: number;
  status: 'green' | 'gray' | 'red';
}

interface SummaryMetrics {
  total_tasks: number;
  overdue_tasks: number;
  ideal_average: number;
  highest_gap_task?: ImportantTaskWithCalculations;
}

const ImportantTasks: React.FC = () => {
  const [tasks, setTasks] = useState<ImportantTaskWithCalculations[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadImportantTasks();
  }, []);

  const loadImportantTasks = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/important-tasks');
      const tasksWithCalculations = response.data.map((task: ImportantTask) => 
        calculateTaskMetrics(task)
      );
      
      // Organize into hierarchy
      const taskMap = new Map<number, ImportantTaskWithCalculations>();
      tasksWithCalculations.forEach((task: ImportantTaskWithCalculations) => {
        taskMap.set(task.id, { ...task, children: [] });
      });

      const rootTasks: ImportantTaskWithCalculations[] = [];
      tasksWithCalculations.forEach((task: ImportantTaskWithCalculations) => {
        if (task.parent_id) {
          const parent = taskMap.get(task.parent_id);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(taskMap.get(task.id)!);
          }
        } else {
          rootTasks.push(taskMap.get(task.id)!);
        }
      });

      setTasks(rootTasks);
      setLoading(false);
    } catch (error) {
      console.error('Error loading important tasks:', error);
      setLoading(false);
    }
  };

  const calculateTaskMetrics = (task: ImportantTask): ImportantTaskWithCalculations => {
    const today = new Date();
    const lastCheck = task.last_check_date ? new Date(task.last_check_date) : new Date(task.start_date || task.created_at);
    
    const daysSinceCheck = Math.floor((today.getTime() - lastCheck.getTime()) / (1000 * 60 * 60 * 24));
    const diff = task.ideal_gap_days - daysSinceCheck;
    
    let status: 'green' | 'gray' | 'red';
    if (diff > 5) {
      status = 'green';
    } else if (diff >= 0) {
      status = 'gray';
    } else {
      status = 'red';
    }

    // Calculate week number (simple: week of year)
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);

    return {
      ...task,
      days_since_check: daysSinceCheck,
      diff,
      week_number: weekNumber,
      status
    };
  };

  const calculateSummaryMetrics = (): SummaryMetrics => {
    const flattenTasks = (tasks: ImportantTaskWithCalculations[]): ImportantTaskWithCalculations[] => {
      let result: ImportantTaskWithCalculations[] = [];
      tasks.forEach(task => {
        result.push(task);
        if (task.children && task.children.length > 0) {
          result = result.concat(flattenTasks(task.children as ImportantTaskWithCalculations[]));
        }
      });
      return result;
    };

    const allTasks = flattenTasks(tasks);
    const overdueTasks = allTasks.filter(t => t.diff < 0);
    const totalGap = allTasks.reduce((sum, t) => sum + t.ideal_gap_days, 0);
    const idealAverage = allTasks.length > 0 ? Math.round(totalGap / allTasks.length) : 0;
    const highestGapTask = allTasks.length > 0 
      ? allTasks.reduce((max, t) => t.ideal_gap_days > max.ideal_gap_days ? t : max)
      : undefined;

    return {
      total_tasks: allTasks.length,
      overdue_tasks: overdueTasks.length,
      ideal_average: idealAverage,
      highest_gap_task: highestGapTask
    };
  };

  const handleMarkDone = async (taskId: number) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await axios.put(`http://localhost:8000/api/important-tasks/${taskId}/check`, {
        check_date: today
      });
      await loadImportantTasks();
    } catch (error) {
      console.error('Error marking task as done:', error);
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await axios.delete(`http://localhost:8000/api/important-tasks/${taskId}`);
      await loadImportantTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const toggleExpand = (taskId: number) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getRowClassName = (status: 'green' | 'gray' | 'red'): string => {
    if (status === 'green') return 'important-task-green';
    if (status === 'gray') return 'important-task-gray';
    return 'important-task-red';
  };

  const renderTask = (task: ImportantTaskWithCalculations, level: number = 0) => {
    const hasChildren = task.children && task.children.length > 0;
    const isExpanded = expandedTasks.has(task.id);

    return (
      <React.Fragment key={task.id}>
        <tr className={getRowClassName(task.status)}>
          <td className="col-date">
            {formatDate(task.start_date || task.created_at)}
          </td>
          <td className="col-task-name" style={{ paddingLeft: `${level * 20 + 8}px` }}>
            {hasChildren && (
              <button 
                onClick={() => toggleExpand(task.id)}
                style={{ 
                  marginRight: '8px', 
                  padding: '2px 6px', 
                  background: 'none', 
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {task.name}
          </td>
          <td className="col-date">
            {formatDate(task.last_check_date || task.start_date || task.created_at)}
          </td>
          <td className="col-number" style={{ textAlign: 'center' }}>
            {task.ideal_gap_days}
          </td>
          <td className="col-number" style={{ textAlign: 'center' }}>
            {task.days_since_check}
          </td>
          <td className="col-number" style={{ textAlign: 'center', fontWeight: 'bold' }}>
            {task.diff > 0 ? `+${task.diff}` : task.diff}
          </td>
          <td className="col-number" style={{ textAlign: 'center' }}>
            Week {task.week_number}
          </td>
          <td className="col-action">
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
              <button 
                className="btn-complete"
                onClick={() => handleMarkDone(task.id)}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                DONE
              </button>
              <button 
                className="btn-edit"
                onClick={() => console.log('Edit task:', task.id)}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                EDIT
              </button>
              <button 
                className="btn-delete"
                onClick={() => handleDelete(task.id)}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                DELETE
              </button>
            </div>
          </td>
        </tr>
        {hasChildren && isExpanded && task.children!.map(child => renderTask(child as ImportantTaskWithCalculations, level + 1))}
      </React.Fragment>
    );
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading important tasks...</div>;
  }

  const metrics = calculateSummaryMetrics();

  return (
    <div className="important-tasks-container">
      {/* Summary Metrics */}
      <div className="summary-metrics" style={{ 
        display: 'flex', 
        gap: '20px', 
        marginBottom: '20px', 
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div className="metric-card" style={{ flex: 1, padding: '10px', backgroundColor: 'white', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c' }}>{metrics.total_tasks}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Total Tasks</div>
        </div>
        <div className="metric-card" style={{ flex: 1, padding: '10px', backgroundColor: 'white', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{metrics.overdue_tasks}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Overdue Tasks</div>
        </div>
        <div className="metric-card" style={{ flex: 1, padding: '10px', backgroundColor: 'white', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{metrics.ideal_average}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Ideal Average (days)</div>
        </div>
        <div className="metric-card" style={{ flex: 1, padding: '10px', backgroundColor: 'white', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>
            {metrics.highest_gap_task ? metrics.highest_gap_task.name.substring(0, 20) + '...' : '-'}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Highest Gap ({metrics.highest_gap_task?.ideal_gap_days || 0} days)
          </div>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="tasks-table-container">
        <table className="tasks-table important-tasks-table">
          <thead>
            <tr>
              <th className="col-date">Start Date</th>
              <th className="col-task-name">Task Name</th>
              <th className="col-date">Updated Date</th>
              <th className="col-number">Target Gap</th>
              <th className="col-number">Days</th>
              <th className="col-number">Diff</th>
              <th className="col-number">Week</th>
              <th className="col-action">Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  No important tasks yet. Click "Add Important Task" to get started.
                </td>
              </tr>
            ) : (
              tasks.map(task => renderTask(task))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ImportantTasks;
