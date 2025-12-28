/**
 * Upcoming Tasks Tab
 * Shows future tasks in table format matching Today's tab
 * Excludes daily tasks, habits, and challenges
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useTaskContext } from '../contexts/TaskContext';

interface UpcomingTask {
  id: number;
  name: string;
  description?: string;
  due_date: string;
  priority?: number | string;
  category_name?: string;
  frequency?: string;
  allocated_minutes?: number;
  task_type?: string;
  project_name?: string;
  goal_name?: string;
  group_name?: string;
  project_id?: number;
}

interface UpcomingResponse {
  view: string;
  start_date: string;
  end_date: string;
  project_tasks: UpcomingTask[];
  goal_tasks: UpcomingTask[];
  important_tasks: UpcomingTask[];
  misc_tasks: UpcomingTask[];
  available_months: Array<{
    year: number;
    month: number;
    label: string;
    count: number;
  }>;
  next_week_count: number;
  next_month_count: number;
  all_tasks_count: number;
}

export default function UpcomingTasks() {
  const { refreshAll } = useTaskContext();
  const [data, setData] = useState<UpcomingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'week' | 'month' | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskType, setEditingTaskType] = useState<string>('');
  const [editName, setEditName] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [view, selectedMonth]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      
      // If a specific month is selected, use month view
      if (selectedMonth) {
        params.view = 'month';
        params.month = selectedMonth.month;
        params.year = selectedMonth.year;
      } else {
        // Otherwise use the current view (week or all)
        params.view = view;
      }
      
      console.log('Loading upcoming tasks with params:', params);
      const response = await api.get<UpcomingResponse>('/api/upcoming-tasks/', { params });
      console.log('Upcoming tasks response:', response);
      setData(response);
    } catch (error) {
      console.error('Error loading upcoming tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewChange = (newView: 'week' | 'month' | 'all') => {
    // Clear selected month when changing views
    setSelectedMonth(null);
    setView(newView);
  };

  const formatDate = (dateStr: string) => {
    return dateStr.split('T')[0]; // Returns YYYY-MM-DD for input[type="date"]
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const getDueDateColorClass = (dueDateStr: string | null): string => {
    if (!dueDateStr) return '';
    
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'urgent';
    return '';
  };

  const handleUpdateTaskDueDate = async (taskId: number, taskType: string, newDate: string) => {
    if (!newDate) return;
    
    try {
      const endpoint = taskType === 'project' 
        ? `/api/projects/tasks/${taskId}`
        : taskType === 'misc'
        ? `/api/misc-tasks/items/${taskId}`
        : `/api/tasks/${taskId}`;
      
      await api.patch(endpoint, { due_date: newDate });
      await loadData();
      await refreshAll();
    } catch (error) {
      console.error('Error updating task due date:', error);
      alert('Failed to update due date');
    }
  };

  const handleEditTask = async (task: UpcomingTask, taskType: string) => {
    setEditingTaskId(task.id);
    setEditingTaskType(taskType);
    setEditName(task.name);
    setEditDueDate(formatDate(task.due_date));
  };

  const handleSaveEdit = async () => {
    if (!editingTaskId) return;
    
    try {
      const endpoint = editingTaskType === 'project' 
        ? `/api/projects/tasks/${editingTaskId}`
        : editingTaskType === 'misc'
        ? `/api/misc-tasks/items/${editingTaskId}`
        : `/api/tasks/${editingTaskId}`;
      
      await api.patch(endpoint, {
        name: editName,
        due_date: editDueDate
      });
      
      setEditingTaskId(null);
      setEditingTaskType('');
      await loadData();
      await refreshAll();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingTaskType('');
    setEditName('');
    setEditDueDate('');
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const handleCompleteTask = async (taskId: number, taskType: string) => {
    try {
      const endpoint = taskType === 'project' 
        ? `/api/projects/tasks/${taskId}/complete`
        : taskType === 'misc'
        ? `/api/misc-tasks/items/${taskId}/complete`
        : `/api/tasks/${taskId}/complete`;
      
      await api.post(endpoint);
      await loadData();
      await refreshAll();
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to complete task');
    }
  };

  const renderTaskTable = (
    sectionId: string,
    title: string,
    tasks: UpcomingTask[],
    icon: string,
    pillarColor: string,
    taskType: string
  ) => {
    if (tasks.length === 0) return null;

    const sortedTasks = [...tasks].sort((a, b) => 
      new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );

    const isExpanded = expandedSections.has(sectionId);

    return (
      <div style={{ marginBottom: '30px' }}>
        <div 
          onClick={() => toggleSection(sectionId)}
          style={{
            background: `linear-gradient(135deg, ${pillarColor} 0%, ${pillarColor}dd 100%)`,
            padding: '14px 20px',
            borderRadius: '8px',
            marginBottom: isExpanded ? '12px' : '0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            userSelect: 'none'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <h3 style={{ 
            margin: 0, 
            color: '#ffffff', 
            fontSize: '18px', 
            fontWeight: '600', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            justifyContent: 'space-between'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{icon}</span>
              <span>{title} ({sortedTasks.length})</span>
            </span>
            <span style={{ fontSize: '14px' }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          </h3>
        </div>

        {isExpanded && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              border: `2px solid ${pillarColor}` 
            }}>
            <thead>
              <tr style={{ backgroundColor: `${pillarColor}20`, borderBottom: `3px solid ${pillarColor}` }}>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: '600', 
                  color: `${pillarColor}`,
                  borderRight: `2px solid ${pillarColor}` 
                }}>
                  Task Name
                </th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: '600', 
                  color: `${pillarColor}`,
                  width: '200px',
                  borderRight: `2px solid ${pillarColor}` 
                }}>
                  {taskType === 'project' ? 'Project' : taskType === 'misc' ? 'Group' : 'Category'}
                </th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  fontWeight: '600', 
                  color: `${pillarColor}`,
                  width: '150px',
                  borderRight: `2px solid ${pillarColor}` 
                }}>
                  Target Date
                </th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  fontWeight: '600', 
                  color: `${pillarColor}`,
                  width: '200px' 
                }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map((task) => {
                const dueDateClass = getDueDateColorClass(task.due_date);
                const isOverdue = dueDateClass === 'overdue';
                const isEditing = editingTaskId === task.id && editingTaskType === taskType;
                const rowBgColor = isOverdue ? '#fee2e2' : '#fff';
                const rowHoverColor = isOverdue ? '#fecaca' : '#f1f5f9';
                
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
                    <td style={{ 
                      padding: '12px', 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#1e293b', 
                      borderRight: `2px solid ${pillarColor}`,
                      background: 'inherit' 
                    }}>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            fontSize: '14px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontWeight: '600'
                          }}
                          autoFocus
                        />
                      ) : (
                        task.name
                      )}
                    </td>
                    <td style={{ 
                      padding: '12px', 
                      fontSize: '13px', 
                      color: '#64748b', 
                      borderRight: `2px solid ${pillarColor}`,
                      background: 'inherit' 
                    }}>
                      {taskType === 'project' && task.project_name && `📂 ${task.project_name}`}
                      {taskType === 'misc' && task.group_name && `📋 ${task.group_name}`}
                      {taskType === 'goal' && task.goal_name && `🎯 ${task.goal_name}`}
                      {taskType === 'important' && task.category_name}
                    </td>
                    <td style={{ 
                      padding: '8px', 
                      textAlign: 'center', 
                      borderRight: `2px solid ${pillarColor}`,
                      background: 'inherit' 
                    }}>
                      {isEditing ? (
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px'
                          }}
                        />
                      ) : (
                        <input 
                          type="date"
                          value={formatDate(task.due_date)}
                          onChange={(e) => handleUpdateTaskDueDate(task.id, taskType, e.target.value)}
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
                      )}
                    </td>
                    <td style={{ 
                      padding: '8px', 
                      textAlign: 'center', 
                      background: 'inherit' 
                    }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            onClick={handleSaveEdit}
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
                            💾 Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              backgroundColor: '#6b7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            ❌ Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEditTask(task, taskType)}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
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
                            onClick={() => handleCompleteTask(task.id, taskType)}
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
                      )}
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
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading upcoming tasks...</div>;
  }

  if (!data) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>No data available</div>;
  }

  const totalTasks = 
    data.project_tasks.length + 
    data.goal_tasks.length + 
    data.important_tasks.length + 
    data.misc_tasks.length;

  return (
    <div style={{ padding: '20px' }}>
      {/* Header with View Toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
            📅 Upcoming Tasks
          </h2>
          {data && (
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
              {formatDateDisplay(data.start_date)} - {formatDateDisplay(data.end_date)} • {totalTasks} tasks
            </p>
          )}
        </div>
      </div>

      {/* Browse Tasks by Week/Month */}
      {data && (
        <div style={{
          marginBottom: '20px',
          padding: '14px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
            🗓️ Browse Tasks
          </h4>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* All Tasks Button */}
            <button
              onClick={() => {
                setSelectedMonth(null);
                setView('all');
              }}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                backgroundColor: view === 'all' && !selectedMonth ? '#3b82f6' : '#fff',
                color: view === 'all' && !selectedMonth ? '#fff' : '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              📊 All Tasks ({data.all_tasks_count})
            </button>
            
            {/* Next Week Button */}
            <button
              onClick={() => {
                setSelectedMonth(null);
                setView('week');
              }}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                backgroundColor: view === 'week' && !selectedMonth ? '#3b82f6' : '#fff',
                color: view === 'week' && !selectedMonth ? '#fff' : '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              📆 Next Week ({data.next_week_count})
            </button>
            
            {/* Next Month Button */}
            <button
              onClick={() => {
                setSelectedMonth(null);
                setView('month');
              }}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                backgroundColor: view === 'month' && !selectedMonth ? '#3b82f6' : '#fff',
                color: view === 'month' && !selectedMonth ? '#fff' : '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              📅 Next Month ({data.next_month_count})
            </button>
            
            {/* Specific Month Buttons */}
            {data.available_months.map(month => (
              <button
                key={`${month.year}-${month.month}`}
                onClick={() => {
                  setSelectedMonth({ year: month.year, month: month.month });
                  setView('month');
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  backgroundColor: 
                    selectedMonth?.year === month.year && selectedMonth?.month === month.month
                      ? '#3b82f6'
                      : '#fff',
                  color:
                    selectedMonth?.year === month.year && selectedMonth?.month === month.month
                      ? '#fff'
                      : '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                {month.label} ({month.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {totalTasks === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '2px dashed #d1d5db'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#374151' }}>
            No Upcoming Tasks
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            All caught up! No tasks scheduled for this period.
          </p>
        </div>
      )}

      {/* Render tasks by type (matching Today's tab) */}
      {data.project_tasks.length > 0 && renderTaskTable(
        'project-tasks',
        '📋 Project Tasks',
        data.project_tasks,
        '📋',
        '#3b82f6',
        'project'
      )}
      
      {data.goal_tasks.length > 0 && renderTaskTable(
        'goal-tasks',
        '🎯 Goal Tasks',
        data.goal_tasks,
        '🎯',
        '#8b5cf6',
        'goal'
      )}
      
      {data.important_tasks.length > 0 && renderTaskTable(
        'important-tasks',
        '⭐ Important Tasks',
        data.important_tasks,
        '⭐',
        '#f59e0b',
        'important'
      )}
      
      {data.misc_tasks.length > 0 && renderTaskTable(
        'misc-tasks',
        '📁 Misc Tasks',
        data.misc_tasks,
        '📁',
        '#10b981',
        'misc'
      )}
    </div>
  );
}
