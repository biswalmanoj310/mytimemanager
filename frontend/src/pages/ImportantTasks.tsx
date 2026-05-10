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

// Helper to generate hash code for strings (for uncategorized tasks)
String.prototype.hashCode = function() {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

declare global {
  interface String {
    hashCode(): number;
  }
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
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [expandedCompletedCategories, setExpandedCompletedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load expanded state from localStorage
    const savedExpanded = localStorage.getItem('importantTasksExpanded');
    if (savedExpanded) {
      setExpandedTasks(new Set(JSON.parse(savedExpanded)));
    }
    const savedExpandedCategories = localStorage.getItem('importantTasksExpandedCategories');
    if (savedExpandedCategories) {
      setExpandedCategories(new Set(JSON.parse(savedExpandedCategories)));
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

  /**
   * Count total tasks including all children recursively
   */
  const countTasksWithChildren = (tasks: ImportantTask[]): number => {
    let count = 0;
    tasks.forEach(task => {
      if (task.is_active !== false) count++; // count only active tasks in the header badge
      if (task.children && task.children.length > 0) {
        count += countTasksWithChildren(task.children);
      }
    });
    return count;
  };

  const loadImportantTasks = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/important-tasks');
      const allTasksData = response.data;

      // Build full task map from ALL tasks (active and completed) so that
      // completed children are placed under their parent rather than floating.
      const taskMap = new Map<number, any>();
      allTasksData.forEach((task: any) => {
        taskMap.set(task.id, { ...task, children: [] });
      });

      // Attach every child to its parent regardless of active/completed status.
      // Root tasks split by is_active: active → tasks state, completed → completedTasks state.
      const rootActiveTasks: any[] = [];
      const rootCompletedTasks: any[] = [];
      allTasksData.forEach((task: any) => {
        if (task.parent_id) {
          const parent = taskMap.get(task.parent_id);
          if (parent) {
            parent.children.push(taskMap.get(task.id)!);
          } else {
            // Orphan (parent not found) – treat as root
            if (task.is_active) rootActiveTasks.push(taskMap.get(task.id)!);
            else rootCompletedTasks.push(taskMap.get(task.id)!);
          }
        } else {
          if (task.is_active) rootActiveTasks.push(taskMap.get(task.id)!);
          else rootCompletedTasks.push(taskMap.get(task.id)!);
        }
      });

      setTasks(rootActiveTasks);
      // Sort completed root tasks by last_check_date descending (most recent first)
      const sortedCompleted = [...rootCompletedTasks].sort((a, b) => {
        const dateA = a.last_check_date ? new Date(a.last_check_date).getTime() : 0;
        const dateB = b.last_check_date ? new Date(b.last_check_date).getTime() : 0;
        return dateB - dateA;
      });
      setCompletedTasks(sortedCompleted);
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

    const allTasks = flattenTasks(tasks).filter((t: any) => t.is_active); // only count active tasks
    const overdueTasks = allTasks.filter(t => t.diff < 0);
    const onTimeTasks = allTasks.filter(t => t.diff >= 0);
    const totalGap = allTasks.reduce((sum, t) => sum + (t.ideal_gap_days || 0), 0);
    const idealAverage = allTasks.length > 0 ? Math.round(totalGap / allTasks.length) : 0;
    
    // Find task with highest negative diff (most overdue task)
    let highestGapDays = 0;
    let highestGapTaskId = null;
    if (allTasks.length > 0) {
      const mostOverdueTask = allTasks.reduce((worst, t) => 
        t.diff < worst.diff ? t : worst
      );
      // Show as positive number (absolute value of most negative diff)
      highestGapDays = Math.abs(Math.min(0, mostOverdueTask.diff));
      highestGapTaskId = highestGapDays > 0 ? mostOverdueTask.id : null;
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
        // Always keep completed children (is_active=false) — shown with strikethrough under parent
        if (!task.is_active) return true;
        if (task.status === filterStatus) return true;
        if (task.children && task.children.length > 0) {
          task.children = filterByStatus(task.children);
          // Keep parent if any active children survived the filter
          return task.children.some((c: ImportantTask) => c.is_active);
        }
        return false;
      });
    };
    
    return filterByStatus(JSON.parse(JSON.stringify(tasks)));
  };

  const findTaskInHierarchy = (taskList: ImportantTask[], id: number): ImportantTask | null => {
    for (const task of taskList) {
      if (task.id === id) return task;
      if (task.children && task.children.length > 0) {
        const found = findTaskInHierarchy(task.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleMarkDone = async (taskId: number) => {
    // Block only if task has ACTIVE sub-tasks (completed children are fine)
    const task = findTaskInHierarchy(tasks, taskId);
    if (task && task.children) {
      const activeChildren = task.children.filter((c: ImportantTask) => c.is_active);
      if (activeChildren.length > 0) {
        alert(`Cannot mark "${task.name}" as done.\n\nIt has ${activeChildren.length} active sub-task(s) that must be completed first.`);
        return;
      }
    }

    try {
      // Use local date format (YYYY-MM-DD) instead of UTC ISO string
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const localDateString = `${year}-${month}-${day}`;
      
      await axios.post(`http://localhost:8000/api/important-tasks/${taskId}/check`, {
        check_date: localDateString
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
    // Block only if task has ACTIVE sub-tasks (completed children are fine)
    const task = findTaskInHierarchy(tasks, taskId);
    if (task && task.children) {
      const activeChildren = task.children.filter((c: ImportantTask) => c.is_active);
      if (activeChildren.length > 0) {
        alert(`Cannot delete "${task.name}".\n\nIt has ${activeChildren.length} active sub-task(s) that must be completed or deleted first.`);
        return;
      }
    }

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
    // Extract just the date portion (YYYY-MM-DD) to avoid timezone issues
    // This handles both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS" formats
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    // Create date using local timezone components
    const date = new Date(year, month - 1, day);
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
    // Completed child under a still-active parent: render with strikethrough/done styling
    if (!task.is_active) {
      const currentNumber = ++index.count;
      return (
        <React.Fragment key={task.id}>
          <tr style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #bbf7d0', height: '35px', opacity: 0.88 }}>
            <td className="col-number" style={{ textAlign: 'center', color: '#bbb', fontSize: '12px' }}>{currentNumber}</td>
            <td className="col-date" style={{ fontSize: '12px', color: '#9ca3af' }}>{formatDate(task.start_date || task.created_at)}</td>
            <td className="col-task-name" style={{ paddingLeft: `${level * 20 + 8}px` }}>
              {level > 0 && <span style={{ marginRight: '8px', color: '#999', fontSize: '14px' }}>⟶</span>}
              <span style={{ marginRight: '6px' }}>✅</span>
              <span style={{ textDecoration: 'line-through', color: '#6b7280', fontSize: '13px' }}>{task.name}</span>
              <span style={{ marginLeft: '6px', fontSize: '10px', color: '#15803d', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>done</span>
            </td>
            <td className="col-date" style={{ textAlign: 'center', fontSize: '12px', color: '#15803d', fontWeight: '600' }}>
              {formatDate(task.last_check_date) !== '-' ? formatDate(task.last_check_date) : '—'}
            </td>
            <td className="col-number" style={{ textAlign: 'center', color: '#9ca3af' }}>{task.ideal_gap_days}</td>
            <td className="col-number" />
            <td className="col-number" />
            <td className="col-action" style={{ textAlign: 'center' }}>
              <button
                onClick={() => handleUndoComplete(task.id)}
                title="Move back to active"
                style={{ padding: '3px 8px', fontSize: '11px', fontWeight: '600', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >↩ Undo</button>
            </td>
          </tr>
        </React.Fragment>
      );
    }

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
          title="Click to highlight the most overdue task (highest negative diff)"
        >
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
            {metrics.highest_gap_days}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Most Overdue (days)
          </div>
        </div>
      </div>

      {/* Category-Based Sections (Collapsible) */}
      {(() => {
        // Define hierarchy order (same as Daily tab)
        const hierarchyOrder: { [key: string]: number } = {
          // Hard Work
          'Hard Work|Office-Tasks': 1,
          'Hard Work|Learning': 2,
          'Hard Work|Confidence': 3,
          // Calmness
          'Calmness|Yoga': 4,
          'Calmness|Sleep': 5,
          // Family
          'Family|My Tasks': 6,
          'Family|Home Tasks': 7,
          'Family|Time Waste': 8,
        };

        // Group tasks by category
        const tasksByCategory = getFilteredTasks().reduce((acc, task) => {
          const categoryName = task.category_name || 'Uncategorized';
          if (!acc[categoryName]) {
            acc[categoryName] = [];
          }
          acc[categoryName].push(task);
          return acc;
        }, {} as Record<string, ImportantTask[]>);

        // Sort categories by hierarchy order (same as Daily tab)
        const sortedCategories = Object.keys(tasksByCategory).sort((a, b) => {
          const aPillarName = tasksByCategory[a][0]?.pillar_name || '';
          const bPillarName = tasksByCategory[b][0]?.pillar_name || '';
          const keyA = `${aPillarName}|${a}`;
          const keyB = `${bPillarName}|${b}`;
          const orderA = hierarchyOrder[keyA] || 999;
          const orderB = hierarchyOrder[keyB] || 999;
          return orderA - orderB;
        });

        return sortedCategories.map(categoryName => {
          const categoryTasks = tasksByCategory[categoryName];
          const category = categories.find(c => c.name === categoryName);
          const categoryId = category?.id || categoryName.hashCode(); // Use hash for uncategorized
          const isExpanded = expandedCategories.has(categoryId);
          
          // Get pillar color for the category
          const pillar = category ? pillars.find(p => p.id === category.pillar_id) : null;
          const pillarName = categoryTasks[0]?.pillar_name || 'Unknown';
          let pillarColor = '#718096';
          let pillarIcon = '📋';
          
          if (pillarName === 'Hard Work') {
            pillarColor = '#2563eb';
            pillarIcon = '💼';
          } else if (pillarName === 'Calmness') {
            pillarColor = '#16a34a';
            pillarIcon = '🧘';
          } else if (pillarName === 'Family') {
            pillarColor = '#9333ea';
            pillarIcon = '👨‍👩‍👦';
          }

          return (
            <div key={categoryId} style={{ marginBottom: '20px' }}>
              <div 
                onClick={() => {
                  const newExpanded = new Set(expandedCategories);
                  if (isExpanded) {
                    newExpanded.delete(categoryId);
                  } else {
                    newExpanded.add(categoryId);
                  }
                  setExpandedCategories(newExpanded);
                  localStorage.setItem('importantTasksExpandedCategories', JSON.stringify(Array.from(newExpanded)));
                }}
                style={{ 
                  fontSize: '17px', 
                  fontWeight: '600', 
                  color: pillarColor, 
                  marginBottom: isExpanded ? '15px' : '0', 
                  paddingBottom: '8px', 
                  borderBottom: isExpanded ? `2px solid ${pillarColor}` : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 15px',
                  background: isExpanded ? 'transparent' : '#f7fafc',
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <span>
                  {isExpanded ? '▼' : '▶'} {pillarIcon} {categoryName} ({countTasksWithChildren(categoryTasks)})
                  {(() => {
                    const countOverdue = (tasks: ImportantTask[]): number => tasks.reduce((sum, t) => {
                      const selfOverdue = t.status === 'red' ? 1 : 0;
                      const childOverdue = t.children ? countOverdue(t.children) : 0;
                      return sum + selfOverdue + childOverdue;
                    }, 0);
                    const overdue = countOverdue(categoryTasks);
                    return overdue > 0 ? (
                      <span style={{ marginLeft: '10px', fontSize: '13px', fontWeight: '700', color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: '10px' }}>
                        ⚠ Overdue: {overdue}
                      </span>
                    ) : null;
                  })()}
                </span>
                <span style={{ fontSize: '13px', color: '#666', fontWeight: 'normal' }}>
                  {pillarName}
                </span>
              </div>
              
              {isExpanded && (
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
                        return categoryTasks.map(task => renderTask(task, 0, counter));
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        });
      })()}

      {/* Completed Tasks Section */}
      {completedTasks.length > 0 && (
        <div style={{ marginTop: '48px' }}>
          {/* Section Header */}
          <div
            onClick={() => setShowCompletedSection(!showCompletedSection)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              background: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)',
              borderRadius: '10px',
              border: '1px solid #b2dfdb',
              cursor: 'pointer',
              userSelect: 'none',
              marginBottom: showCompletedSection ? '20px' : '0',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              transition: 'box-shadow 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>✅</span>
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#155724' }}>
                Completed Important Tasks
              </span>
              <span style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#fff',
                backgroundColor: '#28a745',
                borderRadius: '12px',
                padding: '2px 10px',
                minWidth: '28px',
                textAlign: 'center'
              }}>
                {completedTasks.reduce((n: number, t: ImportantTask) => n + 1 + (t.children ? t.children.length : 0), 0)}
              </span>
            </div>
            <span style={{ fontSize: '18px', color: '#155724', fontWeight: 'bold' }}>
              {showCompletedSection ? '▲' : '▼'}
            </span>
          </div>

          {showCompletedSection && (() => {
            const hierarchyOrder: { [key: string]: number } = {
              'Hard Work|Office-Tasks': 1,
              'Hard Work|Learning': 2,
              'Hard Work|Confidence': 3,
              'Calmness|Yoga': 4,
              'Calmness|Sleep': 5,
              'Family|My Tasks': 6,
              'Family|Home Tasks': 7,
              'Family|Time Waste': 8,
            };

            const completedByCategory = completedTasks.reduce((acc, task) => {
              const key = task.category_name || 'Uncategorized';
              if (!acc[key]) acc[key] = [];
              acc[key].push(task);
              return acc;
            }, {} as Record<string, ImportantTask[]>);

            const sortedCats = Object.keys(completedByCategory).sort((a, b) => {
              const aPillar = completedByCategory[a][0]?.pillar_name || '';
              const bPillar = completedByCategory[b][0]?.pillar_name || '';
              const orderA = hierarchyOrder[`${aPillar}|${a}`] || 999;
              const orderB = hierarchyOrder[`${bPillar}|${b}`] || 999;
              return orderA - orderB;
            });

            const toggleCompletedCategory = (key: string) => {
              setExpandedCompletedCategories(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedCats.map(catName => {
                  const catTasks = completedByCategory[catName];
                  const pillarName = catTasks[0]?.pillar_name || '';
                  let pillarColor = '#718096';
                  let pillarBg = '#f7fafc';
                  let pillarIcon = '📋';
                  if (pillarName === 'Hard Work') { pillarColor = '#2563eb'; pillarBg = '#eff6ff'; pillarIcon = '💼'; }
                  else if (pillarName === 'Calmness') { pillarColor = '#16a34a'; pillarBg = '#f0fdf4'; pillarIcon = '🧘'; }
                  else if (pillarName === 'Family') { pillarColor = '#9333ea'; pillarBg = '#faf5ff'; pillarIcon = '👨‍👩‍👦'; }

                  const isCatExpanded = expandedCompletedCategories.has(catName);

                  return (
                    <div key={catName} style={{
                      border: `1px solid ${pillarColor}30`,
                      borderRadius: '10px',
                      overflow: 'hidden',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                    }}>
                      {/* Category Header - clickable */}
                      <div
                        onClick={() => toggleCompletedCategory(catName)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 16px',
                          backgroundColor: pillarBg,
                          borderLeft: `5px solid ${pillarColor}`,
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '16px' }}>{pillarIcon}</span>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: pillarColor }}>{catName}</span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: 'white',
                            backgroundColor: pillarColor,
                            borderRadius: '10px',
                            padding: '1px 8px'
                          }}>{catTasks.length}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '11px', color: '#999' }}>{pillarName}</span>
                          <span style={{ fontSize: '14px', color: pillarColor, fontWeight: 'bold' }}>
                            {isCatExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>

                      {/* Category Tasks Table */}
                      {isCatExpanded && (
                        <div style={{ backgroundColor: '#fff' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ backgroundColor: `${pillarColor}12` }}>
                                <th style={{ padding: '8px 12px', textAlign: 'center', color: '#666', fontWeight: '600', width: '40px', borderBottom: `2px solid ${pillarColor}30` }}>#</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#333', fontWeight: '600', borderBottom: `2px solid ${pillarColor}30` }}>Task Name</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center', color: '#666', fontWeight: '600', width: '120px', borderBottom: `2px solid ${pillarColor}30` }}>Start Date</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center', color: '#15803d', fontWeight: '700', width: '140px', borderBottom: `2px solid ${pillarColor}30` }}>✅ Done On</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center', color: '#666', fontWeight: '600', width: '90px', borderBottom: `2px solid ${pillarColor}30` }}>Gap (days)</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center', color: '#666', fontWeight: '600', width: '80px', borderBottom: `2px solid ${pillarColor}30` }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {catTasks.map((task, idx) => (
                                <React.Fragment key={task.id}>
                                  <tr
                                    style={{
                                      backgroundColor: idx % 2 === 0 ? '#fafffe' : '#f0fdf4',
                                      borderBottom: '1px solid #e6f4ea',
                                      transition: 'background 0.15s'
                                    }}
                                  >
                                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#bbb', fontSize: '12px' }}>{idx + 1}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: '#15803d', fontSize: '13px' }}>✓</span>
                                        <span style={{ textDecoration: 'line-through', color: '#6b7280', fontSize: '13px' }}>{task.name}</span>
                                        {task.children && task.children.length > 0 && (
                                          <span style={{ fontSize: '10px', color: '#15803d', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                            {task.children.length} sub-task{task.children.length > 1 ? 's' : ''}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                                      {formatDate(task.start_date || task.created_at)}
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      <span style={{
                                        fontWeight: '600',
                                        color: '#15803d',
                                        fontSize: '13px',
                                        background: '#dcfce7',
                                        padding: '2px 8px',
                                        borderRadius: '6px'
                                      }}>
                                        {formatDate(task.last_check_date) !== '-' ? formatDate(task.last_check_date) : '—'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                                      {task.ideal_gap_days}d
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      <button
                                        onClick={() => handleUndoComplete(task.id)}
                                        title="Move back to active"
                                        style={{
                                          padding: '3px 10px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          backgroundColor: '#6b7280',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ↩ Undo
                                      </button>
                                    </td>
                                  </tr>
                                  {/* Completed children nested under their completed parent */}
                                  {task.children && task.children.map((child: ImportantTask) => (
                                    <tr key={child.id} style={{ backgroundColor: '#f0fff4', borderBottom: '1px solid #bbf7d0', borderLeft: '5px solid #86efac' }}>
                                      <td style={{ padding: '6px 12px', textAlign: 'center', color: '#86efac', fontSize: '15px' }}>↳</td>
                                      <td style={{ padding: '6px 12px 6px 28px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ color: '#15803d', fontSize: '12px' }}>✓</span>
                                          <span style={{ textDecoration: 'line-through', color: '#6b7280', fontSize: '12px' }}>{child.name}</span>
                                          <span style={{ fontSize: '10px', color: '#aaa', fontStyle: 'italic', background: '#f3f4f6', padding: '1px 5px', borderRadius: '4px' }}>sub-task</span>
                                        </div>
                                      </td>
                                      <td style={{ padding: '6px 12px', textAlign: 'center', color: '#9ca3af', fontSize: '11px' }}>{formatDate(child.start_date || child.created_at)}</td>
                                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                                        <span style={{ fontWeight: '600', color: '#15803d', fontSize: '12px', background: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                                          {formatDate(child.last_check_date) !== '-' ? formatDate(child.last_check_date) : '—'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '6px 12px', textAlign: 'center', color: '#9ca3af', fontSize: '11px' }}>{child.ideal_gap_days}d</td>
                                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                                        <button
                                          onClick={() => handleUndoComplete(child.id)}
                                          title="Move sub-task back to active"
                                          style={{ padding: '2px 8px', fontSize: '10px', fontWeight: '600', backgroundColor: '#9ca3af', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >↩ Undo</button>
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
