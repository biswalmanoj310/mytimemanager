import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Tasks.css';

interface ImportantTask {
  id: number;
  name: string;
  description?: string;
  pillar_id?: number;
  pillar_name?: string;
  category_id?: number;
  category_name?: string;
  sub_category_id?: number;
  ideal_gap_days: number;
  last_check_date?: string;
  start_date?: string;
  created_at: string;
  priority?: number;
  is_active: boolean;
  parent_id?: number;
  children?: ImportantTask[];
  // Fields from backend calculation
  status: 'green' | 'gray' | 'red';
  days_since_check: number;
  diff: number;
  message: string;
}

interface SummaryMetrics {
  total_tasks: number;
  overdue_tasks: number;
  ideal_average: number;
  highest_gap_days: number;
  on_time_tasks: number;
  highest_gap_task_id: number | null;
}

interface Pillar {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
  pillar_id: number;
}

const ImportantTasks: React.FC = () => {
  const [tasks, setTasks] = useState<ImportantTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<ImportantTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'gray' | 'red'>('all');
  const [editingTask, setEditingTask] = useState<ImportantTask | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [addingSubTaskFor, setAddingSubTaskFor] = useState<number | null>(null);
  const [showAddSubTaskModal, setShowAddSubTaskModal] = useState(false);
  const [showCompletedSection, setShowCompletedSection] = useState(false);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [highestGapTaskId, setHighestGapTaskId] = useState<number | null>(null);

  useEffect(() => {
    // Load expanded state from localStorage
    const savedExpanded = localStorage.getItem('importantTasksExpanded');
    if (savedExpanded) {
      setExpandedTasks(new Set(JSON.parse(savedExpanded)));
    }
    loadImportantTasks();
    loadPillarsAndCategories();
  }, []);

  const loadPillarsAndCategories = async () => {
    try {
      const [pillarsRes, categoriesRes] = await Promise.all([
        axios.get('http://localhost:8000/api/pillars'),
        axios.get('http://localhost:8000/api/categories')
      ]);
      setPillars(pillarsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error loading pillars and categories:', error);
    }
  };

  const loadImportantTasks = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/important-tasks');
      
      console.log('[ImportantTasks] Loaded tasks from API:', response.data);
      
      // Separate active and completed tasks
      const allTasksData = response.data;
      const activeTasks: ImportantTask[] = [];
      const completed: ImportantTask[] = [];
      
      allTasksData.forEach((task: any) => {
        if (task.is_active) {
          activeTasks.push(task);
        } else {
          completed.push(task);
        }
      });
      
      console.log('[ImportantTasks] Active tasks:', activeTasks.length, 'Completed:', completed.length);
      
      // Organize active tasks into hierarchy
      const taskMap = new Map<number, any>();
      activeTasks.forEach((task: any) => {
        taskMap.set(task.id, { ...task, children: [] });
      });

      const rootTasks: any[] = [];
      
      activeTasks.forEach((task: any) => {
        if (task.parent_id) {
          console.log('[ImportantTasks] Found child task:', task.name, 'parent_id:', task.parent_id);
          const parent = taskMap.get(task.parent_id);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(taskMap.get(task.id)!);
            console.log('[ImportantTasks] Added child to parent:', parent.name);
          } else {
            console.warn('[ImportantTasks] Parent not found for task:', task.name, 'parent_id:', task.parent_id);
          }
        } else {
          rootTasks.push(taskMap.get(task.id)!);
        }
      });

      console.log('[ImportantTasks] Root tasks:', rootTasks.length, 'Expanded parents:', Array.from(expandedTasks));
      console.log('[ImportantTasks] Task hierarchy:', rootTasks);

      setTasks(rootTasks);
      setCompletedTasks(completed);
      // Don't modify expandedTasks - keep previous state
      setLoading(false);
    } catch (error) {
      console.error('Error loading important tasks:', error);
      setLoading(false);
    }
  };

  const calculateSummaryMetrics = (): SummaryMetrics => {
    const flattenTasks = (tasks: any[]): any[] => {
      let result: any[] = [];
      tasks.forEach(task => {
        result.push(task);
        if (task.children && task.children.length > 0) {
          result = result.concat(flattenTasks(task.children));
        }
      });
      return result;
    };

    const allTasks = flattenTasks(tasks);
    const overdueTasks = allTasks.filter(t => t.diff < 0);
    const onTimeTasks = allTasks.filter(t => t.diff >= 0);
    const totalGap = allTasks.reduce((sum, t) => sum + (t.ideal_gap_days || 0), 0);
    const idealAverage = allTasks.length > 0 ? Math.round(totalGap / allTasks.length) : 0;
    
    // Find task with highest gap (for active/in progress tasks only)
    let highestGapDays = 0;
    let highestGapTaskId = null;
    if (allTasks.length > 0) {
      const highestTask = allTasks.reduce((max, t) => 
        (t.ideal_gap_days || 0) > (max.ideal_gap_days || 0) ? t : max
      );
      highestGapDays = highestTask.ideal_gap_days || 0;
      highestGapTaskId = highestTask.id;
    }

    return {
      total_tasks: allTasks.length,
      overdue_tasks: overdueTasks.length,
      on_time_tasks: onTimeTasks.length,
      ideal_average: idealAverage,
      highest_gap_days: highestGapDays,
      highest_gap_task_id: highestGapTaskId
    };
  };

  const getFilteredTasks = () => {
    if (filterStatus === 'all') return tasks;
    
    const filterByStatus = (taskList: ImportantTask[]): ImportantTask[] => {
      return taskList.filter(task => {
        if (task.status === filterStatus) {
          return true;
        }
        if (task.children && task.children.length > 0) {
          task.children = filterByStatus(task.children);
          return task.children.length > 0;
        }
        return false;
      });
    };
    
    return filterByStatus(JSON.parse(JSON.stringify(tasks)));
  };

  const handleMarkDone = async (taskId: number) => {
    try {
      const today = new Date().toISOString();
      await axios.post(`http://localhost:8000/api/important-tasks/${taskId}/check`, {
        check_date: today
      });
      
      // Mark as inactive (completed)
      await axios.put(`http://localhost:8000/api/important-tasks/${taskId}`, {
        is_active: false
      });
      
      await loadImportantTasks();
    } catch (error) {
      console.error('Error marking task as done:', error);
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      // Mark as inactive instead of deleting
      await axios.put(`http://localhost:8000/api/important-tasks/${taskId}`, {
        is_active: false
      });
      await loadImportantTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleEdit = (task: ImportantTask) => {
    setEditingTask(task);
    setShowEditModal(true);
  };

  const handleAddSubTask = (parentId: number) => {
    setAddingSubTaskFor(parentId);
    setShowAddSubTaskModal(true);
  };

  const handleUpdateTask = async (taskId: number, updates: any) => {
    try {
      await axios.put(`http://localhost:8000/api/important-tasks/${taskId}`, updates);
      await loadImportantTasks();
      setShowEditModal(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
  };

  const handleUndoComplete = async (taskId: number) => {
    try {
      await axios.put(`http://localhost:8000/api/important-tasks/${taskId}`, {
        is_active: true
      });
      await loadImportantTasks();
    } catch (error) {
      console.error('Error undoing task completion:', error);
      alert('Failed to undo completion');
    }
  };

  const handleUpdateDate = async (taskId: number, newDate: string) => {
    try {
      await axios.post(`http://localhost:8000/api/important-tasks/${taskId}/check`, {
        check_date: newDate
      });
      await loadImportantTasks();
    } catch (error) {
      console.error('Error updating check date:', error);
      alert('Failed to update date');
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
    // Save to localStorage
    localStorage.setItem('importantTasksExpanded', JSON.stringify(Array.from(newExpanded)));
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const hasOverdueChild = (task: ImportantTask): boolean => {
    if (task.status === 'red') return true;
    if (task.children && task.children.length > 0) {
      return task.children.some(child => hasOverdueChild(child));
    }
    return false;
  };

  const getRowClassName = (status: 'green' | 'gray' | 'red'): string => {
    if (status === 'green') return 'important-task-green';
    if (status === 'gray') return 'important-task-gray';
    return 'important-task-red';
  };

  const renderTask = (task: ImportantTask, level: number = 0, index: { count: number } = { count: 0 }) => {
    const hasChildren = task.children && task.children.length > 0;
    const isExpanded = expandedTasks.has(task.id);
    const currentNumber = ++index.count;
    const isHighlighted = highestGapTaskId === task.id;
    
    // If task has overdue children, show parent as overdue too
    const effectiveStatus = hasOverdueChild(task) ? 'red' : task.status;

    return (
      <React.Fragment key={task.id}>
        <tr 
          className={getRowClassName(effectiveStatus)}
          style={{ 
            height: level > 0 ? '35px' : '48px',
            backgroundColor: isHighlighted ? '#fff3cd' : undefined,
            border: isHighlighted ? '2px solid #ffc107' : undefined
          }}
        >
          <td className="col-number" style={{ textAlign: 'center', fontWeight: level === 0 ? 'bold' : 'normal' }}>
            {currentNumber}
          </td>
          <td className="col-date">
            {formatDate(task.start_date || task.created_at)}
          </td>
          <td className="col-task-name" style={{ paddingLeft: `${level * 20 + 8}px` }}>
            {hasChildren ? (
              <button 
                onClick={() => toggleExpand(task.id)}
                style={{ 
                  marginRight: '8px', 
                  padding: '4px 8px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
                title={isExpanded ? 'Click to collapse sub-tasks' : 'Click to expand sub-tasks'}
              >
                {isExpanded ? '▼' : '▶'} {task.children!.length}
              </button>
            ) : level > 0 ? (
              <span style={{ marginRight: '8px', color: '#999', fontSize: '16px' }}>⟶</span>
            ) : null}
            <strong style={{ color: level > 0 ? '#666' : 'inherit' }}>{task.name}</strong>
            {level > 0 && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999', fontStyle: 'italic' }}>(sub-task)</span>}
          </td>
          <td className="col-date">
            <input
              type="date"
              value={task.last_check_date ? task.last_check_date.split('T')[0] : (task.start_date ? task.start_date.split('T')[0] : '')}
              onChange={(e) => handleUpdateDate(task.id, e.target.value)}
              style={{ 
                padding: '4px 8px', 
                fontSize: '13px', 
                width: '130px',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            />
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
                onClick={() => handleEdit(task)}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                EDIT
              </button>
              {!task.parent_id && (
                <button 
                  className="btn-add"
                  onClick={() => handleAddSubTask(task.id)}
                  style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  title="Add a sub-task under this task"
                >
                  + SUB
                </button>
              )}
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
        {hasChildren && isExpanded && task.children!.map((child: ImportantTask) => renderTask(child, level + 1, index))}
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
        <div 
          className="metric-card" 
          style={{ 
            flex: 1, 
            padding: '10px', 
            backgroundColor: 'white', 
            borderRadius: '6px', 
            textAlign: 'center',
            cursor: 'pointer',
            border: filterStatus === 'all' ? '2px solid #3b82f6' : '1px solid #e5e7eb'
          }}
          onClick={() => {
            setFilterStatus('all');
            setHighestGapTaskId(null);
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c' }}>{metrics.total_tasks}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Total Tasks</div>
        </div>
        <div 
          className="metric-card" 
          style={{ 
            flex: 1, 
            padding: '10px', 
            backgroundColor: 'white', 
            borderRadius: '6px', 
            textAlign: 'center',
            cursor: 'pointer',
            border: filterStatus === 'green' ? '2px solid #10b981' : '1px solid #e5e7eb'
          }}
          onClick={() => {
            setFilterStatus('green');
            setHighestGapTaskId(null);
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{metrics.on_time_tasks}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>On Time Tasks</div>
        </div>
        <div 
          className="metric-card" 
          style={{ 
            flex: 1, 
            padding: '10px', 
            backgroundColor: 'white', 
            borderRadius: '6px', 
            textAlign: 'center',
            cursor: 'pointer',
            border: filterStatus === 'red' ? '2px solid #ef4444' : '1px solid #e5e7eb'
          }}
          onClick={() => {
            setFilterStatus('red');
            setHighestGapTaskId(null);
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{metrics.overdue_tasks}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Overdue Tasks</div>
        </div>
        <div className="metric-card" style={{ flex: 1, padding: '10px', backgroundColor: 'white', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{metrics.ideal_average}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Ideal Average (days)</div>
        </div>
        <div 
          className="metric-card" 
          style={{ 
            flex: 1, 
            padding: '10px', 
            backgroundColor: 'white', 
            borderRadius: '6px', 
            textAlign: 'center',
            cursor: 'pointer',
            border: highestGapTaskId ? '2px solid #ffc107' : '1px solid #e5e7eb'
          }}
          onClick={() => {
            setFilterStatus('all');
            setHighestGapTaskId(metrics.highest_gap_task_id);
          }}
          title="Click to highlight the task with highest gap"
        >
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
            {metrics.highest_gap_days}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Highest Gap (days)
          </div>
        </div>
      </div>

      {/* Hard Work Pillar Section */}
      {(() => {
        const pillarTasks = getFilteredTasks().filter(t => t.pillar_name === 'Hard Work');
        if (pillarTasks.length === 0) return null;
        
        return (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#2563eb', marginBottom: '15px', paddingBottom: '8px', borderBottom: '2px solid #3b82f6' }}>
              💼 Hard Work ({pillarTasks.length})
            </h3>
            <div className="tasks-table-container">
              <table className="tasks-table important-tasks-table">
                <thead>
                  <tr>
                    <th className="col-number">#</th>
                    <th className="col-date">Start Date</th>
                    <th className="col-task-name">Task Name</th>
                    <th className="col-date">Updated Date</th>
                    <th className="col-number">Target Gap</th>
                    <th className="col-number">Days</th>
                    <th className="col-number">Diff</th>
                    <th className="col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const counter = { count: 0 };
                    return pillarTasks.map(task => renderTask(task, 0, counter));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Calmness Pillar Section */}
      {(() => {
        const pillarTasks = getFilteredTasks().filter(t => t.pillar_name === 'Calmness');
        if (pillarTasks.length === 0) return null;
        
        return (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#16a34a', marginBottom: '15px', paddingBottom: '8px', borderBottom: '2px solid #22c55e' }}>
              🧘 Calmness ({pillarTasks.length})
            </h3>
            <div className="tasks-table-container">
              <table className="tasks-table important-tasks-table">
                <thead>
                  <tr>
                    <th className="col-number">#</th>
                    <th className="col-date">Start Date</th>
                    <th className="col-task-name">Task Name</th>
                    <th className="col-date">Updated Date</th>
                    <th className="col-number">Target Gap</th>
                    <th className="col-number">Days</th>
                    <th className="col-number">Diff</th>
                    <th className="col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const counter = { count: 0 };
                    return pillarTasks.map(task => renderTask(task, 0, counter));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Family Pillar Section */}
      {(() => {
        const pillarTasks = getFilteredTasks().filter(t => t.pillar_name === 'Family');
        if (pillarTasks.length === 0) return null;
        
        return (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#9333ea', marginBottom: '15px', paddingBottom: '8px', borderBottom: '2px solid #a855f7' }}>
              👨‍👩‍👦 Family ({pillarTasks.length})
            </h3>
            <div className="tasks-table-container">
              <table className="tasks-table important-tasks-table">
                <thead>
                  <tr>
                    <th className="col-number">#</th>
                    <th className="col-date">Start Date</th>
                    <th className="col-task-name">Task Name</th>
                    <th className="col-date">Updated Date</th>
                    <th className="col-number">Target Gap</th>
                    <th className="col-number">Days</th>
                    <th className="col-number">Diff</th>
                    <th className="col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const counter = { count: 0 };
                    return pillarTasks.map(task => renderTask(task, 0, counter));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Completed Tasks Section */}
      {completedTasks.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <h3 
            onClick={() => setShowCompletedSection(!showCompletedSection)}
            style={{ 
              marginBottom: '15px', 
              color: '#666', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              userSelect: 'none'
            }}
          >
            {showCompletedSection ? '▼' : '▶'} Completed Important Tasks ({completedTasks.length})
          </h3>
          {showCompletedSection && (
            <div className="tasks-table-container">
              <table className="tasks-table important-tasks-table">
                <thead>
                  <tr>
                    <th className="col-date">Start Date</th>
                    <th className="col-task-name">Task Name</th>
                    <th className="col-date">Completed Date</th>
                    <th className="col-number">Target Gap</th>
                    <th className="col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {completedTasks.map(task => (
                    <tr key={task.id} style={{ backgroundColor: '#f0f0f0', opacity: 0.7 }}>
                      <td className="col-date">{formatDate(task.start_date || task.created_at)}</td>
                      <td className="col-task-name">{task.name}</td>
                      <td className="col-date">{formatDate(task.last_check_date)}</td>
                      <td className="col-number" style={{ textAlign: 'center' }}>{task.ideal_gap_days}</td>
                      <td className="col-action">
                        <button 
                          className="btn-edit"
                          onClick={() => handleUndoComplete(task.id)}
                          style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#10b981' }}
                        >
                          UNDO
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditModal && editingTask && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>Edit Important Task</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleUpdateTask(editingTask.id, {
                name: formData.get('name'),
                description: formData.get('description'),
                pillar_id: formData.get('pillar_id') ? parseInt(formData.get('pillar_id') as string) : null,
                category_id: formData.get('category_id') ? parseInt(formData.get('category_id') as string) : null,
                start_date: formData.get('start_date') || undefined,
                ideal_gap_days: parseInt(formData.get('ideal_gap_days') as string),
                priority: parseInt(formData.get('priority') as string)
              });
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Task Name *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingTask.name}
                  required
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Description</label>
                <textarea
                  name="description"
                  defaultValue={editingTask.description || ''}
                  rows={3}
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Pillar</label>
                <select
                  name="pillar_id"
                  defaultValue={editingTask.pillar_id || ''}
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="">None</option>
                  {pillars.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Category</label>
                <select
                  name="category_id"
                  defaultValue={editingTask.category_id || ''}
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="">None</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  defaultValue={editingTask.start_date ? editingTask.start_date.split('T')[0] : ''}
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Ideal Gap (Days) *</label>
                <input
                  type="number"
                  name="ideal_gap_days"
                  defaultValue={editingTask.ideal_gap_days}
                  required
                  min="1"
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Priority (1-10)</label>
                <input
                  type="number"
                  name="priority"
                  defaultValue={editingTask.priority || 5}
                  min="1"
                  max="10"
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ padding: '8px 16px', backgroundColor: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Sub-Task Modal */}
      {showAddSubTaskModal && addingSubTaskFor && (
        <div className="modal-overlay" onClick={() => setShowAddSubTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>Add Sub-Task</h2>
              <button className="modal-close" onClick={() => setShowAddSubTaskModal(false)}>×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              try {
                await axios.post('http://localhost:8000/api/important-tasks/', {
                  name: formData.get('name'),
                  description: formData.get('description') || null,
                  pillar_id: formData.get('pillar_id') ? parseInt(formData.get('pillar_id') as string) : null,
                  category_id: formData.get('category_id') ? parseInt(formData.get('category_id') as string) : null,
                  ideal_gap_days: parseInt(formData.get('ideal_gap_days') as string),
                  priority: parseInt(formData.get('priority') as string),
                  parent_id: addingSubTaskFor
                });
                setShowAddSubTaskModal(false);
                setAddingSubTaskFor(null);
                await loadImportantTasks();
              } catch (error) {
                console.error('Error creating sub-task:', error);
                alert('Failed to create sub-task');
              }
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Sub-Task Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Enter sub-task name"
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Description</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Optional description"
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Pillar</label>
                <select
                  name="pillar_id"
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="">None</option>
                  {pillars.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Category</label>
                <select
                  name="category_id"
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="">None</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Ideal Gap (Days) *</label>
                <input
                  type="number"
                  name="ideal_gap_days"
                  required
                  min="1"
                  defaultValue="30"
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Priority (1-10)</label>
                <input
                  type="number"
                  name="priority"
                  min="1"
                  max="10"
                  defaultValue="5"
                  style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddSubTaskModal(false)} style={{ padding: '8px 16px', backgroundColor: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Create Sub-Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportantTasks;
