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
  wish_title?: string;
  created_at?: string;
  days_old: number;
  postpone_count: number;
}

interface AgeDistribution {
  le7: number;
  le15: number;
  le30: number;
  le60: number;
  le90: number;
  gt90: number;
}

interface UpcomingResponse {
  view: string;
  start_date: string;
  end_date: string;
  project_tasks: UpcomingTask[];
  goal_tasks: UpcomingTask[];
  important_tasks: UpcomingTask[];
  misc_tasks: UpcomingTask[];
  dream_tasks: UpcomingTask[];
  available_months: Array<{
    year: number;
    month: number;
    label: string;
    count: number;
  }>;
  next_week_count: number;
  next_month_count: number;
  all_tasks_count: number;
  age_distribution: AgeDistribution;
  longest_tasks: UpcomingTask[];
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
  const [ageFilter, setAgeFilter] = useState<string | null>(null);
  // Sub-task suggestion modal state
  const [subtaskModal, setSubtaskModal] = useState<{
    visible: boolean;
    parentTaskId: number | null;
    parentTaskName: string;
    parentPillarId?: number;
    parentCategoryId?: number;
    parentFrequency?: string;
  }>({ visible: false, parentTaskId: null, parentTaskName: '' });
  const [subtaskName, setSubtaskName] = useState('');

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
        : `/api/tasks/${taskId}`;
      
      await api.put(endpoint, { due_date: newDate });
      await loadData();
      await refreshAll();
    } catch (error) {
      console.error('Error updating task due date:', error);
      alert('Failed to update due date');
    }
  };

  const handleDeleteTask = async (taskId: number, taskType: string, taskName: string) => {
    if (!confirm(`Are you sure you want to delete "${taskName}"?`)) {
      return;
    }
    
    try {
      const endpoint = taskType === 'project' 
        ? `/api/projects/tasks/${taskId}`
        : `/api/tasks/${taskId}`;
      
      await api.delete(endpoint);
      await loadData();
      await refreshAll();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
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
        : `/api/tasks/${editingTaskId}`;
      
      await api.put(endpoint, {
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

  // Returns styling config for age badges
  const getAgeBadgeStyle = (daysOld: number): { label: string; bg: string; color: string } => {
    if (daysOld <= 7)  return { label: `${daysOld}d`, bg: '#dcfce7', color: '#15803d' };
    if (daysOld <= 15) return { label: `${daysOld}d`, bg: '#fef9c3', color: '#854d0e' };
    if (daysOld <= 30) return { label: `${daysOld}d`, bg: '#fef3c7', color: '#92400e' };
    if (daysOld <= 60) return { label: `${daysOld}d`, bg: '#ffedd5', color: '#c2410c' };
    if (daysOld <= 90) return { label: `${daysOld}d`, bg: '#fee2e2', color: '#b91c1c' };
    return { label: `${daysOld}d`, bg: '#fce7f3', color: '#be185d' };
  };

  // Row background tint based on age
  const getAgeRowBg = (daysOld: number, isOverdue: boolean): string => {
    if (isOverdue) return '#fee2e2';
    if (daysOld > 90) return '#fff0f5';
    if (daysOld > 60) return '#fff7f0';
    return '#fff';
  };

  const handleCreateSubtask = async () => {
    if (!subtaskName.trim() || !subtaskModal.parentTaskId) return;
    try {
      // Fetch parent task details to clone pillar/category
      const parent = await api.get<any>(`/api/tasks/${subtaskModal.parentTaskId}`);
      await api.post('/api/tasks/', {
        name: subtaskName.trim(),
        pillar_id: parent.pillar_id,
        category_id: parent.category_id,
        follow_up_frequency: parent.follow_up_frequency || 'one_time',
        allocated_minutes: 30,
        parent_task_id: subtaskModal.parentTaskId
      });
      setSubtaskModal({ visible: false, parentTaskId: null, parentTaskName: '' });
      setSubtaskName('');
      await loadData();
      await refreshAll();
    } catch (err) {
      console.error('Error creating sub-task:', err);
      alert('Failed to create sub-task');
    }
  };

  // Filter tasks by age bucket
  const filterByAge = (tasks: UpcomingTask[]): UpcomingTask[] => {
    if (!ageFilter) return tasks;
    return tasks.filter(t => {
      const d = t.days_old || 0;
      if (ageFilter === 'le7')  return d <= 7;
      if (ageFilter === 'le15') return d > 7 && d <= 15;
      if (ageFilter === 'le30') return d > 15 && d <= 30;
      if (ageFilter === 'le60') return d > 30 && d <= 60;
      if (ageFilter === 'le90') return d > 60 && d <= 90;
      if (ageFilter === 'gt90') return d > 90;
      return true;
    });
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
    const filteredTasks = filterByAge(tasks);
    if (filteredTasks.length === 0) return null;

    const sortedTasks = [...filteredTasks].sort((a, b) => 
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
              <span>{title} ({sortedTasks.length}{ageFilter ? ` filtered` : ''})</span>
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
                  width: '80px',
                  borderRight: `2px solid ${pillarColor}` 
                }}>
                  Age
                </th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  fontWeight: '600', 
                  color: `${pillarColor}`,
                  width: '280px' 
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
                const daysOld = task.days_old || 0;
                const rowBgColor = getAgeRowBg(daysOld, isOverdue);
                const rowHoverColor = isOverdue ? '#fecaca' : daysOld > 90 ? '#ffe4ef' : '#f1f5f9';
                const ageBadge = getAgeBadgeStyle(daysOld);
                
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>{task.name}</span>
                          {(task.postpone_count || 0) > 0 && (
                            <span style={{
                              fontSize: '10px',
                              color: (task.postpone_count || 0) >= 3 ? '#be185d' : '#6b7280',
                              fontWeight: 'normal'
                            }}>
                              {(task.postpone_count || 0) >= 3
                                ? `⚠️ Postponed ${task.postpone_count}× — needs attention`
                                : `↩ Postponed ${task.postpone_count}×`}
                            </span>
                          )}
                        </div>
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
                      {taskType === 'dream' && task.wish_title && `💭 ${task.wish_title}`}
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
                    {/* Age cell */}
                    <td style={{
                      padding: '8px',
                      textAlign: 'center',
                      borderRight: `2px solid ${pillarColor}`,
                      background: 'inherit'
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 7px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: ageBadge.bg,
                        color: ageBadge.color,
                        whiteSpace: 'nowrap'
                      }}>
                        {ageBadge.label}
                      </span>
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
                            title="Edit task name and date"
                          >
                            ✏️ Edit
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
                            title="Mark as complete"
                          >
                            ✅ Done
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id, taskType, task.name)}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                            title="Delete task"
                          >
                            🗑️ Delete
                          </button>
                          {(task.postpone_count || 0) >= 3 && (
                            <button
                              onClick={() => setSubtaskModal({
                                visible: true,
                                parentTaskId: task.id,
                                parentTaskName: task.name
                              })}
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                backgroundColor: '#7c3aed',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: '600'
                              }}
                              title="This task has been postponed 3+ times. Break it into smaller sub-tasks!"
                            >
                              🔀 Break it down
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
    data.misc_tasks.length +
    data.dream_tasks.length;

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

      {/* ===== TASK AGE DISTRIBUTION PANEL ===== */}
      {data && totalTasks > 0 && data.age_distribution && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#fafafa',
          borderRadius: '10px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#374151' }}>
              🕰️ Task Age Distribution
            </h4>
            {ageFilter && (
              <button
                onClick={() => setAgeFilter(null)}
                style={{
                  fontSize: '11px', padding: '3px 8px',
                  backgroundColor: '#6b7280', color: 'white',
                  border: 'none', borderRadius: '12px', cursor: 'pointer'
                }}
              >
                ✕ Clear filter
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {([
              { key: 'le7',  label: '≤ 7 days',   bg: '#dcfce7', border: '#86efac', color: '#15803d' },
              { key: 'le15', label: '8–15 days',  bg: '#fef9c3', border: '#fde047', color: '#854d0e' },
              { key: 'le30', label: '16–30 days', bg: '#fef3c7', border: '#fcd34d', color: '#92400e' },
              { key: 'le60', label: '31–60 days', bg: '#ffedd5', border: '#fdba74', color: '#c2410c' },
              { key: 'le90', label: '61–90 days', bg: '#fee2e2', border: '#fca5a5', color: '#b91c1c' },
              { key: 'gt90', label: '> 90 days',  bg: '#fce7f3', border: '#f9a8d4', color: '#be185d' },
            ] as const).map(({ key, label, bg, border, color }) => {
              const count = data.age_distribution[key] || 0;
              const isActive = ageFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setAgeFilter(isActive ? null : key)}
                  disabled={count === 0}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: `2px solid ${isActive ? color : border}`,
                    backgroundColor: isActive ? color : bg,
                    color: isActive ? '#fff' : color,
                    cursor: count === 0 ? 'default' : 'pointer',
                    opacity: count === 0 ? 0.35 : 1,
                    fontWeight: '600',
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    minWidth: '90px'
                  }}
                >
                  <span style={{ fontSize: '18px', fontWeight: '700' }}>{count}</span>
                  <span style={{ fontSize: '11px' }}>{label}</span>
                </button>
              );
            })}
          </div>
          {ageFilter && (
            <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
              Showing tasks in the selected age bucket. Sections with 0 matching tasks are hidden.
            </p>
          )}
        </div>
      )}

      {/* ===== LONGEST WAITING TASKS PANEL ===== */}
      {data && data.longest_tasks && data.longest_tasks.length > 0 && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#fff7f0',
          borderRadius: '10px',
          border: '1px solid #fed7aa',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#9a3412' }}>
            ⏳ Longest Waiting — Top {data.longest_tasks.length} Oldest Tasks
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {data.longest_tasks.map((task, idx) => {
              const badge = getAgeBadgeStyle(task.days_old || 0);
              return (
                <div key={`${task.id}-${idx}`} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px',
                  backgroundColor: '#fff',
                  borderRadius: '6px',
                  border: '1px solid #fed7aa'
                }}>
                  <span style={{
                    width: '22px', height: '22px',
                    borderRadius: '50%',
                    backgroundColor: '#ea580c',
                    color: 'white',
                    fontSize: '11px', fontWeight: '700',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>{idx + 1}</span>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{task.name}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '12px',
                    fontSize: '11px', fontWeight: '700',
                    backgroundColor: badge.bg, color: badge.color,
                    whiteSpace: 'nowrap'
                  }}>{badge.label} old</span>
                  {(task.postpone_count || 0) > 0 && (
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px',
                      fontSize: '11px', fontWeight: '600',
                      backgroundColor: '#f3e8ff', color: '#7c3aed',
                      whiteSpace: 'nowrap'
                    }}>↩ {task.postpone_count}×</span>
                  )}
                </div>
              );
            })}
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

      {data.dream_tasks && data.dream_tasks.length > 0 && renderTaskTable(
        'dream-tasks',
        '💭 Dream Tasks',
        data.dream_tasks,
        '💭',
        '#ec4899',
        'dream'
      )}

      {/* ===== SUB-TASK CREATION MODAL ===== */}
      {subtaskModal.visible && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '28px',
            width: '440px',
            maxWidth: '95vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#1e293b', fontWeight: '700' }}>
              🔀 Break it Down
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              <strong>"{subtaskModal.parentTaskName}"</strong> has been postponed multiple times.
              Creating a focused sub-task can help you make progress!
            </p>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
              Sub-task name
            </label>
            <input
              type="text"
              value={subtaskName}
              onChange={(e) => setSubtaskName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSubtask()}
              placeholder="e.g. 'Research options for first 30 minutes'"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: '20px'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setSubtaskModal({ visible: false, parentTaskId: null, parentTaskName: '' });
                  setSubtaskName('');
                }}
                style={{
                  padding: '8px 18px', fontSize: '13px',
                  backgroundColor: '#f1f5f9', color: '#374151',
                  border: '1px solid #e2e8f0', borderRadius: '8px',
                  cursor: 'pointer', fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSubtask}
                disabled={!subtaskName.trim()}
                style={{
                  padding: '8px 18px', fontSize: '13px',
                  backgroundColor: subtaskName.trim() ? '#7c3aed' : '#c4b5fd',
                  color: 'white',
                  border: 'none', borderRadius: '8px',
                  cursor: subtaskName.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                ✨ Create Sub-task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
