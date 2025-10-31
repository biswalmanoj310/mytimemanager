/**
 * Life Goals Page
 * Manage long-term life goals with OKR/SMART methodology
 * Supports hierarchical goals, milestones, task linking, and progress tracking
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Tasks.css'; // Reuse the same CSS for now
import { Task } from '../types';

// Life Goals interfaces
interface LifeGoalData {
  id: number;
  name: string;
  parent_goal_id: number | null;
  start_date: string;
  target_date: string;
  actual_completion_date: string | null;
  status: string; // not_started, in_progress, on_track, at_risk, behind, completed, abandoned
  category: string | null;
  priority: string;
  why_statements: string[]; // Array of strings
  description: string | null;
  progress_percentage: number;
  time_allocated_hours: number;
  time_spent_hours: number;
  days_remaining: number | null;
  created_at: string;
  updated_at: string | null;
}

interface MilestoneData {
  id: number;
  goal_id: number;
  name: string;
  description: string | null;
  target_date: string;
  actual_completion_date: string | null;
  is_completed: boolean;
  metric: string | null;
  order: number;
  created_at: string;
}

interface GoalTaskLinkData {
  id: number;
  goal_id: number;
  task_id: number;
  task_type: string;
  time_allocated_hours: number;
  notes: string | null;
  created_at: string;
  task?: Task; // Populated task data
}

interface GoalTaskData {
  id: number;
  goal_id: number;
  name: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  task_type: string; // 'time', 'count', 'boolean'
  target_value: number | null;
  current_value: number;
  unit: string | null;
  allocated_minutes: number | null;
  time_allocated_hours: number;
  time_spent_hours: number;
  priority: string;
  order: number;
  created_at: string;
  updated_at: string | null;
}

interface TaskPerformance {
  task_link_id: number;
  task_id: number;
  task_name: string;
  task_type: string;
  actual_count: number;
  expected_count: number;
  completion_percentage: number;
  status: 'green' | 'yellow' | 'red';
  completion_dates: string[];
}

interface GoalProjectData {
  id: number;
  goal_id: number;
  name: string;
  description: string | null;
  status: 'green' | 'yellow' | 'red';
  overall_percentage: number;
  task_performances: TaskPerformance[];
  created_at: string;
  updated_at: string;
}

// Project Task Node Component (for hierarchical task display)
interface ProjectTaskData {
  id: number;
  project_id: number;
  parent_task_id: number | null;
  name: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  is_completed: boolean;
  completed_at: string | null;
  order: number;
  created_at: string;
  updated_at: string;
}

interface ProjectTaskNodeProps {
  task: ProjectTaskData;
  level: number;
  projectId: number;
  allTasks: ProjectTaskData[];
  expandedTasks: Set<number>;
  onToggleExpand: (taskId: number) => void;
  onToggleComplete: (taskId: number, currentStatus: boolean) => void;
  onDelete: (taskId: number) => void;
  onEdit: (task: ProjectTaskData) => void;
}

const ProjectTaskNode = ({
  task,
  level,
  projectId,
  allTasks,
  expandedTasks,
  onToggleExpand,
  onToggleComplete,
  onDelete,
  onEdit
}: ProjectTaskNodeProps) => {
  const subTasks = allTasks.filter(t => t.parent_task_id === task.id);
  const hasSubTasks = subTasks.length > 0;
  const isExpanded = expandedTasks.has(task.id);

  const getDueDateColorClass = (dueDate: string | null): string => {
    if (!dueDate) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'due-today';
    if (diffDays === 1) return 'due-tomorrow';
    if (diffDays <= 3) return 'due-soon';
    return '';
  };

  const dueDateClass = getDueDateColorClass(task.due_date);

  return (
    <div className={`task-node level-${level}`} style={{ marginLeft: `${level * 20}px` }}>
      <div className={`task-row ${dueDateClass} ${task.is_completed ? 'completed' : ''}`} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px',
        backgroundColor: task.is_completed ? '#f7fafc' : 'white',
        borderRadius: '4px',
        marginBottom: '4px'
      }}>
        <div className="task-checkbox">
          <input
            type="checkbox"
            checked={task.is_completed}
            onChange={() => onToggleComplete(task.id, task.is_completed)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
        </div>
        
        <div className="task-expand" style={{ width: '20px' }}>
          {hasSubTasks && (
            <button 
              className="btn-expand"
              onClick={() => onToggleExpand(task.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0',
                fontSize: '14px'
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
        </div>
        
        <div className="task-content" style={{ flex: 1, minWidth: 0 }}>
          <span 
            className={`task-name ${task.is_completed ? 'strikethrough' : ''}`}
            style={{ 
              textDecoration: task.is_completed ? 'line-through' : 'none',
              color: task.is_completed ? '#a0aec0' : '#2d3748',
              fontSize: '14px'
            }}
          >
            {task.name}
          </span>
          {task.description && (
            <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>
              {task.description}
            </div>
          )}
        </div>
        
        {task.due_date && (
          <div className={`task-due-date ${dueDateClass}`} style={{ fontSize: '12px', color: '#718096' }}>
            {new Date(task.due_date).toLocaleDateString()}
          </div>
        )}
        
        <div className={`task-priority priority-${task.priority}`} style={{
          fontSize: '11px',
          padding: '2px 6px',
          borderRadius: '3px',
          backgroundColor: task.priority === 'high' ? '#fed7d7' : task.priority === 'medium' ? '#feebc8' : '#e6fffa',
          color: task.priority === 'high' ? '#c53030' : task.priority === 'medium' ? '#c05621' : '#234e52'
        }}>
          {task.priority}
        </div>
        
        <div className="task-actions" style={{ display: 'flex', gap: '4px' }}>
          <button 
            className="btn btn-sm btn-primary"
            onClick={() => onEdit(task)}
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            Edit
          </button>
          <button 
            className="btn btn-sm btn-danger"
            onClick={() => onDelete(task.id)}
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            Delete
          </button>
        </div>
      </div>
      
      {hasSubTasks && isExpanded && (
        <div className="task-children">
          {subTasks.map(subTask => (
            <ProjectTaskNode
              key={subTask.id}
              task={subTask}
              level={level + 1}
              projectId={projectId}
              allTasks={allTasks}
              expandedTasks={expandedTasks}
              onToggleExpand={onToggleExpand}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Wishes interfaces
interface WishData {
  id: number;
  title: string;
  description?: string;
  category?: string;
  dream_type?: string;
  estimated_timeframe?: string;
  estimated_cost?: number;
  priority: string;
  why_important?: string;
  emotional_impact?: string;
  life_area?: string;
  image_url?: string;
  status: string;
  is_active: boolean;
  stats?: {
    days_dreaming: number;
    reflections_count: number;
    exploration_steps_total: number;
    exploration_steps_completed: number;
    exploration_progress: number;
    inspirations_count: number;
    average_clarity_score?: number;
  };
}

type TabType = 'goals' | 'wishes';

export default function Goals() {
  // Navigation
  const navigate = useNavigate();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('goals');
  
  // Goals State
  const [lifeGoals, setLifeGoals] = useState<LifeGoalData[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<LifeGoalData | null>(null);
  const [goalMilestones, setGoalMilestones] = useState<MilestoneData[]>([]);
  const [goalTasks, setGoalTasks] = useState<GoalTaskData[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<GoalTaskLinkData[]>([]);
  const [goalProjects, setGoalProjects] = useState<any[]>([]); // Standalone projects
  const [goalTrackingProjects, setGoalTrackingProjects] = useState<GoalProjectData[]>([]); // NEW: Tracking dashboards
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false);
  const [showAddGoalTaskModal, setShowAddGoalTaskModal] = useState(false);
  const [showLinkTaskModal, setShowLinkTaskModal] = useState(false);
  const [showCreateTrackingProjectModal, setShowCreateTrackingProjectModal] = useState(false); // NEW
  const [createAsProject, setCreateAsProject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  
  // Wishes State
  const [wishes, setWishes] = useState<WishData[]>([]);
  const [selectedWish, setSelectedWish] = useState<WishData | null>(null);
  const [showAddWishModal, setShowAddWishModal] = useState(false);
  const [showWishDetailsModal, setShowWishDetailsModal] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState<string>('');

  // Project management state
  interface ProjectTaskData {
    id: number;
    project_id: number;
    parent_task_id: number | null;
    name: string;
    description: string | null;
    due_date: string | null;
    priority: string;
    is_completed: boolean;
    completed_at: string | null;
    order: number;
    created_at: string;
    updated_at: string;
  }
  
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [projectTasks, setProjectTasks] = useState<ProjectTaskData[]>([]);
  const [expandedProjectTasks, setExpandedProjectTasks] = useState<Set<number>>(new Set());
  const [showAddProjectTaskModal, setShowAddProjectTaskModal] = useState(false);
  const [showEditProjectTaskModal, setShowEditProjectTaskModal] = useState(false);
  const [selectedProjectForTask, setSelectedProjectForTask] = useState<number | null>(null);
  const [editingProjectTask, setEditingProjectTask] = useState<ProjectTaskData | null>(null);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'goals') {
      loadLifeGoals();
    } else if (activeTab === 'wishes') {
      loadWishes();
    }
  }, [activeTab]);

  // Load tasks when task type is selected
  const loadTasksByType = async (taskType: string) => {
    try {
      setSelectedTaskType(taskType);
      if (!taskType) {
        setAvailableTasks([]);
        return;
      }
      
      const response = await api.get<Task[]>('/api/tasks/');
      const filtered = response.filter((task: Task) => {
        if (taskType === 'daily') return task.follow_up_frequency === 'daily';
        if (taskType === 'weekly') return task.follow_up_frequency === 'weekly';
        if (taskType === 'monthly') return task.follow_up_frequency === 'monthly';
        return false;
      });
      setAvailableTasks(filtered);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setAvailableTasks([]);
    }
  };

  // API Functions
  
  // Wish / Dream Board functions
  const loadWishes = async () => {
    try {
      const response: any = await api.get('/api/wishes/');
      const data = response.data || response;
      const wishesList = Array.isArray(data) ? data : [];
      console.log('Loaded wishes from API:', wishesList);
      setWishes(wishesList);
    } catch (err: any) {
      console.error('Error loading wishes:', err);
      setWishes([]);
    }
  };

  const handleCreateWish = async (wishData: any) => {
    try {
      await api.post('/api/wishes/', wishData);
      await loadWishes();
      setShowAddWishModal(false);
    } catch (err: any) {
      console.error('Error creating wish:', err);
      alert('Failed to create wish: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleArchiveWish = async (wishId: number) => {
    if (!confirm('Archive this wish? You can view archived wishes later.')) {
      return;
    }

    try {
      await api.delete(`/api/wishes/${wishId}/archive`);
      await loadWishes();
      setSelectedWish(null);
      setShowWishDetailsModal(false);
    } catch (err: any) {
      console.error('Error archiving wish:', err);
      alert('Failed to archive wish: ' + (err.response?.data?.detail || err.message));
    }
  };
  
  const loadLifeGoals = async () => {
    try {
      setLoading(true);
      const response = await api.get<LifeGoalData[]>('/api/life-goals/');
      console.log('Life goals loaded:', response);
      setLifeGoals(response);
    } catch (error) {
      console.error('Error loading life goals:', error);
      alert('Failed to load life goals');
    } finally {
      setLoading(false);
    }
  };

  const loadGoalDetails = async (goalId: number) => {
    try {
      console.log('Loading goal details for goalId:', goalId);
      const [goal, milestones, tasks, linkedTasks, projects] = await Promise.all([
        api.get<LifeGoalData>(`/api/life-goals/${goalId}`),
        api.get<MilestoneData[]>(`/api/life-goals/${goalId}/milestones`),
        api.get<GoalTaskData[]>(`/api/life-goals/${goalId}/tasks`),
        api.get<GoalTaskLinkData[]>(`/api/life-goals/${goalId}/linked-tasks`),
        api.get<any[]>(`/api/life-goals/${goalId}/projects`)
      ]);
      
      console.log('Goal details loaded successfully:', { goal, milestones, tasks, linkedTasks, projects });
      setSelectedGoal(goal);
      setGoalMilestones(milestones);
      setGoalTasks(tasks);
      setLinkedTasks(linkedTasks);
      setGoalProjects(projects);
      
      // Load tracking projects separately (optional - won't fail if endpoint doesn't work)
      try {
        const trackingProjects = await api.get<GoalProjectData[]>(`/api/life-goals/${goalId}/goal-projects`);
        setGoalTrackingProjects(trackingProjects);
        console.log('Tracking projects loaded:', trackingProjects);
      } catch (trackingError) {
        console.warn('Could not load tracking projects (feature may not be ready):', trackingError);
        setGoalTrackingProjects([]); // Set empty array if tracking projects fail
      }
    } catch (error: any) {
      console.error('Error loading goal details:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      alert(`Failed to load goal details: ${error.message}`);
    }
  };

  const handleCreateLifeGoal = async (goalData: any) => {
    try {
      await api.post('/api/life-goals/', goalData);
      await loadLifeGoals();
      setShowAddGoalModal(false);
    } catch (error) {
      console.error('Error creating life goal:', error);
      alert('Failed to create goal');
    }
  };

  const handleUpdateLifeGoal = async (goalId: number, updates: any) => {
    try {
      await api.put(`/api/life-goals/${goalId}`, updates);
      await loadLifeGoals();
      if (selectedGoal?.id === goalId) {
        await loadGoalDetails(goalId);
      }
    } catch (error) {
      console.error('Error updating life goal:', error);
      alert('Failed to update goal');
    }
  };

  const handleDeleteLifeGoal = async (goalId: number) => {
    if (!window.confirm('Are you sure you want to delete this goal? This will also delete all its sub-goals, milestones, and tasks.')) {
      return;
    }
    try {
      await api.delete(`/api/life-goals/${goalId}`);
      await loadLifeGoals();
      if (selectedGoal?.id === goalId) {
        setSelectedGoal(null);
      }
    } catch (error) {
      console.error('Error deleting life goal:', error);
      alert('Failed to delete goal');
    }
  };

  const handleCreateMilestone = async (goalId: number, milestoneData: any) => {
    try {
      await api.post(`/api/life-goals/${goalId}/milestones`, milestoneData);
      await loadGoalDetails(goalId);
      setShowAddMilestoneModal(false);
    } catch (error) {
      console.error('Error creating milestone:', error);
      alert('Failed to create milestone');
    }
  };

  const handleToggleMilestone = async (milestoneId: number, isCompleted: boolean) => {
    try {
      await api.put(`/api/life-goals/milestones/${milestoneId}`, { is_completed: isCompleted });
      if (selectedGoal) {
        await loadGoalDetails(selectedGoal.id);
      }
    } catch (error) {
      console.error('Error toggling milestone:', error);
      alert('Failed to update milestone');
    }
  };

  const handleDeleteMilestone = async (milestoneId: number) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) {
      return;
    }
    try {
      await api.delete(`/api/life-goals/milestones/${milestoneId}`);
      if (selectedGoal) {
        await loadGoalDetails(selectedGoal.id);
      }
    } catch (error) {
      console.error('Error deleting milestone:', error);
      alert('Failed to delete milestone');
    }
  };

  const handleLinkTask = async (
    goalId: number, 
    taskId: number, 
    taskType: string, 
    timeAllocated?: number, 
    notes?: string,
    linkStartDate?: string,
    expectedFrequency?: string
  ) => {
    try {
      await api.post(`/api/life-goals/${goalId}/link-task`, {
        task_id: taskId,
        task_type: taskType,
        time_allocated_hours: timeAllocated,
        notes: notes,
        link_start_date: linkStartDate,
        expected_frequency: expectedFrequency || taskType  // Default to task type
      });
      await loadGoalDetails(goalId);
      setShowLinkTaskModal(false);
      setSelectedTaskType('');
      setAvailableTasks([]);
    } catch (error) {
      console.error('Error linking task:', error);
      alert('Failed to link task');
    }
  };

  const handleNavigateToTask = (taskType: string) => {
    // Navigate to Tasks page with the appropriate tab
    const tabMap: { [key: string]: string } = {
      'daily': 'daily',
      'weekly': 'weekly',
      'monthly': 'monthly',
      'quarterly': 'quarterly',
      'yearly': 'yearly',
      'onetime': 'onetime'
    };
    
    const tab = tabMap[taskType] || 'daily';
    navigate(`/tasks?tab=${tab}`);
  };

  const handleUnlinkTask = async (linkId: number) => {
    if (!window.confirm('Are you sure you want to unlink this task?')) {
      return;
    }
    try {
      await api.delete(`/api/life-goals/task-links/${linkId}`);
      if (selectedGoal) {
        await loadGoalDetails(selectedGoal.id);
      }
    } catch (error) {
      console.error('Error unlinking task:', error);
      alert('Failed to unlink task');
    }
  };

  const handleCreateGoalTask = async (goalId: number, taskData: any) => {
    try {
      await api.post(`/api/life-goals/${goalId}/tasks`, taskData);
      await loadGoalDetails(goalId);
      setShowAddGoalTaskModal(false);
    } catch (error) {
      console.error('Error creating goal task:', error);
      alert('Failed to create task');
    }
  };

  // Project Task Management Functions
  const loadProjectTasks = async (projectId: number) => {
    try {
      const response: any = await api.get(`/api/projects/${projectId}/tasks`);
      const data = response.data || response;
      
      // Keep tasks from other projects and add/update tasks for this project
      setProjectTasks(prevTasks => {
        const otherProjectTasks = prevTasks.filter(t => t.project_id !== projectId);
        const newTasks = Array.isArray(data) ? data : [];
        return [...otherProjectTasks, ...newTasks];
      });
    } catch (err: any) {
      console.error('Error loading project tasks:', err);
      alert('Failed to load project tasks: ' + (err.response?.data?.detail || err.message));
    }
  };

  const toggleProjectExpansion = async (projectId: number) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
        // Load tasks when expanding
        loadProjectTasks(projectId);
      }
      return newSet;
    });
  };

  const toggleProjectTaskExpansion = (taskId: number) => {
    setExpandedProjectTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleCreateProjectTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectForTask) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    
    try {
      await api.post(`/api/projects/${selectedProjectForTask}/tasks`, {
        name: formData.get('name'),
        description: formData.get('description') || null,
        parent_task_id: formData.get('parent_task_id') ? Number(formData.get('parent_task_id')) : null,
        due_date: formData.get('due_date') || null,
        priority: formData.get('priority') || 'medium',
        order: 0
      });
      
      await loadProjectTasks(selectedProjectForTask);
      if (selectedGoal) {
        await loadGoalDetails(selectedGoal.id); // Refresh to update project progress
      }
      setShowAddProjectTaskModal(false);
      setSelectedProjectForTask(null);
    } catch (err: any) {
      console.error('Error creating project task:', err);
      alert('Failed to create task: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUpdateProjectTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectTask) return;

    try {
      await api.put(`/api/projects/tasks/${editingProjectTask.id}`, {
        name: editingProjectTask.name,
        description: editingProjectTask.description,
        due_date: editingProjectTask.due_date,
        priority: editingProjectTask.priority
      });
      
      setShowEditProjectTaskModal(false);
      await loadProjectTasks(editingProjectTask.project_id);
      if (selectedGoal) {
        await loadGoalDetails(selectedGoal.id); // Refresh to update project progress
      }
      setEditingProjectTask(null);
    } catch (err: any) {
      console.error('Error updating project task:', err);
      alert('Failed to update task: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleToggleProjectTaskCompletion = async (taskId: number, currentStatus: boolean) => {
    try {
      await api.put(`/api/projects/tasks/${taskId}`, {
        is_completed: !currentStatus
      });
      
      // Find the task to get its project_id
      const task = projectTasks.find(t => t.id === taskId);
      if (task) {
        await loadProjectTasks(task.project_id);
        if (selectedGoal) {
          await loadGoalDetails(selectedGoal.id); // Refresh to update project progress
        }
      }
    } catch (err: any) {
      console.error('Error toggling task completion:', err);
      alert('Failed to update task: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteProjectTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task and all its sub-tasks?')) {
      return;
    }

    try {
      await api.delete(`/api/projects/tasks/${taskId}`);
      
      // Find the task to get its project_id
      const task = projectTasks.find(t => t.id === taskId);
      if (task) {
        await loadProjectTasks(task.project_id);
        if (selectedGoal) {
          await loadGoalDetails(selectedGoal.id); // Refresh to update project progress
        }
      }
    } catch (err: any) {
      console.error('Error deleting project task:', err);
      alert('Failed to delete task: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEditProjectTask = (task: ProjectTaskData) => {
    setEditingProjectTask(task);
    setShowEditProjectTaskModal(true);
  };

  const getProjectTasksByParentId = (parentId: number | null, projectId: number): ProjectTaskData[] => {
    return projectTasks
      .filter(t => t.project_id === projectId && t.parent_task_id === parentId)
      .sort((a, b) => a.order - b.order);
  };

  const handleUpdateGoalTask = async (taskId: number, updates: any) => {
    try {
      await api.put(`/api/life-goals/tasks/${taskId}`, updates);
      if (selectedGoal) {
        await loadGoalDetails(selectedGoal.id);
      }
    } catch (error) {
      console.error('Error updating goal task:', error);
      alert('Failed to update task');
    }
  };

  const handleDeleteGoalTask = async (taskId: number) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }
    try {
      await api.delete(`/api/life-goals/tasks/${taskId}`);
      if (selectedGoal) {
        await loadGoalDetails(selectedGoal.id);
      }
    } catch (error) {
      console.error('Error deleting goal task:', error);
      alert('Failed to delete task');
    }
  };

  const handleBackToGoals = () => {
    setSelectedGoal(null);
    setGoalMilestones([]);
    setGoalTasks([]);
    setLinkedTasks([]);
  };

  if (loading) {
    return (
      <div className="page-container">
        <h1>Life Goals</h1>
        <p>Loading goals...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1>Life Goals & Dreams</h1>
      <p className="page-description">
        Track your aspirations from pressure-free dreams to committed goals with milestones and action plans.
      </p>

      {/* Tab Navigation */}
      <div className="tabs-container" style={{ marginBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '0' }}>
          <button
            className={`tab ${activeTab === 'goals' ? 'active' : ''}`}
            onClick={() => setActiveTab('goals')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: activeTab === 'goals' ? '#3b82f6' : 'transparent',
              color: activeTab === 'goals' ? 'white' : '#64748b',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: activeTab === 'goals' ? '600' : '400',
              transition: 'all 0.2s'
            }}
          >
            🎯 Committed Goals
          </button>
          <button
            className={`tab ${activeTab === 'wishes' ? 'active' : ''}`}
            onClick={() => setActiveTab('wishes')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: activeTab === 'wishes' ? '#3b82f6' : 'transparent',
              color: activeTab === 'wishes' ? 'white' : '#64748b',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: activeTab === 'wishes' ? '600' : '400',
              transition: 'all 0.2s'
            }}
          >
            ✨ Dream Board
          </button>
        </div>
      </div>

      {activeTab === 'wishes' ? (
        /* Wishes Tab - Dream Board */
        <div className="wishes-container" style={{ padding: '20px' }}>
          <div className="wishes-header" style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '28px', marginBottom: '10px' }}>✨ Your Dream Board</h2>
            <p style={{ color: '#666', fontSize: '16px', marginBottom: '20px' }}>
              A pressure-free space for your aspirations and dreams. No deadlines, no guilt – just possibilities.
            </p>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowAddWishModal(true)}
              style={{ padding: '12px 24px', fontSize: '16px' }}
            >
              ➕ Add New Wish
            </button>
          </div>

          {wishes.length === 0 ? (
            <div className="empty-state" style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              backgroundColor: '#f7fafc',
              borderRadius: '12px'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>💭</div>
              <h3 style={{ fontSize: '24px', marginBottom: '10px', color: '#2d3748' }}>
                No dreams yet
              </h3>
              <p style={{ fontSize: '16px', color: '#718096', marginBottom: '20px', maxWidth: '500px', margin: '0 auto 20px' }}>
                What would you love to do, have, or become? Travel the world? Learn a new skill? 
                Create something meaningful? This is your space to dream without limits.
              </p>
              <p style={{ fontSize: '14px', color: '#a0aec0', fontStyle: 'italic', marginTop: '20px' }}>
                "A goal is a dream with a deadline" – Napoleon Hill
                <br/>
                Start with the dream.
              </p>
            </div>
          ) : (
            <div className="wishes-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
              gap: '24px'
            }}>
              {wishes.map((wish) => {
                // Determine card background based on category
                const categoryColors: Record<string, string> = {
                  travel: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  financial: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  personal: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  career: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                  health: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  relationship: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
                  learning: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                  lifestyle: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                };
                const bgGradient = categoryColors[wish.category || ''] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                
                // Status styling
                const statusColors: Record<string, { bg: string, text: string }> = {
                  dreaming: { bg: '#e3f2fd', text: '#1976d2' },
                  exploring: { bg: '#f3e5f5', text: '#7b1fa2' },
                  planning: { bg: '#fff3e0', text: '#f57c00' },
                  ready_to_commit: { bg: '#e8f5e9', text: '#388e3c' },
                  converted: { bg: '#e0f2f1', text: '#00897b' },
                };
                const statusStyle = statusColors[wish.status] || statusColors.dreaming;
                
                return (
                  <div 
                    key={wish.id} 
                    className="wish-card"
                    style={{
                      borderRadius: '16px',
                      overflow: 'hidden',
                      backgroundColor: 'white',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      border: '2px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-8px)';
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    }}
                    onClick={() => {
                      setSelectedWish(wish);
                      setShowWishDetailsModal(true);
                    }}
                  >
                    {/* Gradient header */}
                    <div style={{
                      background: bgGradient,
                      padding: '24px 20px',
                      color: 'white',
                      position: 'relative'
                    }}>
                      {/* Priority indicator */}
                      {wish.priority === 'burning_desire' && (
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          fontSize: '24px'
                        }}>
                          🔥
                        </div>
                      )}
                      
                      <h3 style={{ 
                        margin: '0 0 8px 0', 
                        fontSize: '22px', 
                        fontWeight: '700',
                        textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}>
                        {wish.title}
                      </h3>
                      
                      {wish.estimated_timeframe && (
                        <div style={{ 
                          fontSize: '13px', 
                          opacity: 0.95,
                          fontWeight: '500'
                        }}>
                          ⏰ {wish.estimated_timeframe.replace('_', ' ').replace('-', '-')}
                        </div>
                      )}
                    </div>

                    {/* Card content */}
                    <div style={{ padding: '20px' }}>
                      {/* Description */}
                      {wish.description && (
                        <p style={{ 
                          margin: '0 0 16px 0', 
                          fontSize: '15px', 
                          color: '#4a5568',
                          lineHeight: '1.6'
                        }}>
                          {wish.description.length > 120 
                            ? wish.description.substring(0, 120) + '...' 
                            : wish.description}
                        </p>
                      )}

                      {/* Why it matters */}
                      {wish.why_important && (
                        <div style={{
                          backgroundColor: '#fef5e7',
                          padding: '12px',
                          borderRadius: '8px',
                          marginBottom: '16px',
                          borderLeft: '3px solid #f39c12'
                        }}>
                          <div style={{ fontSize: '12px', color: '#856404', fontWeight: '600', marginBottom: '4px' }}>
                            💫 Why this matters:
                          </div>
                          <p style={{ 
                            margin: 0, 
                            fontSize: '13px', 
                            color: '#856404',
                            lineHeight: '1.5'
                          }}>
                            {wish.why_important.length > 100 
                              ? wish.why_important.substring(0, 100) + '...' 
                              : wish.why_important}
                          </p>
                        </div>
                      )}

                      {/* Stats */}
                      {wish.stats && (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '8px',
                          marginBottom: '16px',
                          padding: '12px',
                          backgroundColor: '#f7fafc',
                          borderRadius: '8px'
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4a5568' }}>
                              {wish.stats.days_dreaming || 0}
                            </div>
                            <div style={{ fontSize: '11px', color: '#718096' }}>
                              days dreaming
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4a5568' }}>
                              {wish.stats.reflections_count || 0}
                            </div>
                            <div style={{ fontSize: '11px', color: '#718096' }}>
                              reflections
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4a5568' }}>
                              {wish.stats.exploration_progress || 0}%
                            </div>
                            <div style={{ fontSize: '11px', color: '#718096' }}>
                              explored
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Status badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.text,
                          textTransform: 'capitalize'
                        }}>
                          {wish.status.replace('_', ' ')}
                        </span>
                        
                        {wish.category && (
                          <span style={{ fontSize: '12px', color: '#a0aec0' }}>
                            {wish.category === 'travel' && '🌍'} 
                            {wish.category === 'financial' && '💰'}
                            {wish.category === 'personal' && '🌱'}
                            {wish.category === 'career' && '💼'}
                            {wish.category === 'health' && '💪'}
                            {wish.category === 'relationship' && '❤️'}
                            {wish.category === 'learning' && '📚'}
                            {wish.category === 'lifestyle' && '🏡'}
                            {' '}{wish.category}
                          </span>
                        )}
                      </div>

                      {/* Quick actions */}
                      <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="btn btn-sm"
                          style={{
                            flex: 1,
                            padding: '8px',
                            fontSize: '13px',
                            backgroundColor: '#edf2f7',
                            color: '#4a5568',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                          onClick={() => {
                            setSelectedWish(wish);
                            setShowWishDetailsModal(true);
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#edf2f7'}
                        >
                          💫 Details
                        </button>
                        <button 
                          className="btn btn-sm"
                          style={{
                            flex: 1,
                            padding: '8px',
                            fontSize: '13px',
                            backgroundColor: '#bee3f8',
                            color: '#2c5282',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                          onClick={async () => {
                            const text = prompt("What are your thoughts about this dream?");
                            if (text) {
                              try {
                                await api.post(`/api/wishes/${wish.id}/reflections`, {
                                  reflection_text: text,
                                  mood: 'inspired'
                                });
                                await loadWishes();
                              } catch (err) {
                                console.error('Error adding reflection:', err);
                              }
                            }
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#90cdf4'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#bee3f8'}
                        >
                          ✍️ Reflect
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Goals Tab - Committed Goals */
        <div className="goals-container">
        {!selectedGoal ? (
          /* Goals List View */
          <>
            <div className="goals-header">
              <button 
                className="btn btn-primary" 
                onClick={() => setShowAddGoalModal(true)}
                style={{ marginBottom: '20px' }}
              >
                ➕ Add Life Goal
              </button>
            </div>

            {lifeGoals.length === 0 ? (
              <div className="empty-state">
                <h3>🎯 No Life Goals Yet</h3>
                <p>Start your journey by defining your first long-term goal!</p>
                <p style={{ marginTop: '20px', color: '#718096' }}>
                  Life goals help you focus on what truly matters - whether it's career advancement, 
                  health improvement, financial independence, or personal development.
                </p>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setShowAddGoalModal(true)}
                  style={{ marginTop: '20px' }}
                >
                  Create Your First Goal
                </button>
              </div>
            ) : (
              <div className="goals-grid">
                {lifeGoals
                  .filter(goal => !goal.parent_goal_id) // Only show root goals
                  .map(goal => {
                    return (
                      <div
                        key={goal.id}
                        className="goal-card"
                      >
                        <div className="goal-card-header">
                          <h3>{goal.name}</h3>
                        </div>

                        <div className="goal-card-body">
                          <div className="goal-dates-row">
                            {goal.start_date && (
                              <div className="goal-date-item">
                                <strong>Start:</strong> {new Date(goal.start_date).toLocaleDateString()}
                              </div>
                            )}
                            {goal.target_date && (
                              <div className="goal-date-item">
                                <strong>Target:</strong> {new Date(goal.target_date).toLocaleDateString()}
                                {goal.days_remaining !== null && (
                                  <span className="days-remaining-badge">
                                    {goal.days_remaining > 0 
                                      ? `${goal.days_remaining} days left`
                                      : `${Math.abs(goal.days_remaining)} days overdue`}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="goal-progress">
                            <div className="progress-label">
                              Progress: <strong>{goal.progress_percentage?.toFixed(0) || 0}%</strong>
                            </div>
                            <div className="progress-bar-container">
                              <div 
                                className="progress-bar-fill"
                                style={{ 
                                  width: `${goal.progress_percentage || 0}%`,
                                  backgroundColor: 
                                    goal.status === 'on_track' ? '#48bb78' :
                                    goal.status === 'at_risk' ? '#ed8936' :
                                    goal.status === 'behind' ? '#f56565' :
                                    '#cbd5e0'
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="goal-card-footer">
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              setSelectedGoal(goal);
                              loadGoalDetails(goal.id);
                            }}
                          >
                            View Details
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleDeleteLifeGoal(goal.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        ) : (
          /* Goal Detail View - Full Page */
          <div className="goal-detail-page">
            <div className="goal-detail-header">
              <button
                className="btn btn-secondary"
                onClick={handleBackToGoals}
              >
                ← Back to All Goals
              </button>
              <div className="goal-header-info">
                <h2>{selectedGoal.name}</h2>
                <div className="goal-header-meta">
                  <span className={`status-badge status-${selectedGoal.status}`}>
                    {selectedGoal.status.replace('_', ' ').toUpperCase()}
                  </span>
                  {selectedGoal.category && (
                    <span className="category-badge">{selectedGoal.category}</span>
                  )}
                  {selectedGoal.priority && (
                    <span className={`priority-badge priority-${selectedGoal.priority}`}>
                      {selectedGoal.priority.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="goal-detail-body">
              {/* Goal Summary Card */}
              <div className="goal-summary-card">
                <div className="summary-row">
                  <div className="summary-item">
                    <label>Start Date</label>
                    <span>{selectedGoal.start_date ? new Date(selectedGoal.start_date).toLocaleDateString() : 'Not set'}</span>
                  </div>
                  <div className="summary-item">
                    <label>Target Date</label>
                    <span>
                      {selectedGoal.target_date ? new Date(selectedGoal.target_date).toLocaleDateString() : 'Not set'}
                      {selectedGoal.days_remaining !== null && (
                        <small className={selectedGoal.days_remaining < 0 ? 'text-danger' : 'text-muted'}>
                          {' '}({selectedGoal.days_remaining > 0 
                            ? `${selectedGoal.days_remaining} days left`
                            : `${Math.abs(selectedGoal.days_remaining)} days overdue`})
                        </small>
                      )}
                    </span>
                  </div>
                  <div className="summary-item">
                    <label>Progress</label>
                    <div className="progress-inline">
                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar-fill"
                          style={{ 
                            width: `${selectedGoal.progress_percentage || 0}%`,
                            backgroundColor: 
                              selectedGoal.status === 'on_track' ? '#48bb78' :
                              selectedGoal.status === 'at_risk' ? '#ed8936' :
                              selectedGoal.status === 'behind' ? '#f56565' :
                              '#cbd5e0'
                          }}
                        />
                      </div>
                      <span className="progress-text">{selectedGoal.progress_percentage?.toFixed(0) || 0}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Why Statements */}
              {selectedGoal.why_statements && selectedGoal.why_statements.length > 0 && (
                <div className="goal-section why-section">
                  <h3>💡 Why This Goal Matters</h3>
                  <ul className="why-statements-list">
                    {selectedGoal.why_statements.map((why, index) => (
                      <li key={index}>{why}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Description */}
              {selectedGoal.description && (
                <div className="goal-section description-section">
                  <h3>📝 Description</h3>
                  <p>{selectedGoal.description}</p>
                </div>
              )}

              {/* Milestones */}
              <div className="goal-section milestones-section">
                <div className="section-header">
                  <h3>🎯 Milestones</h3>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowAddMilestoneModal(true)}
                  >
                    ➕ Add Milestone
                  </button>
                </div>
                {goalMilestones.length === 0 ? (
                  <div className="empty-section">
                    <p>No milestones yet. Add checkpoints to track your progress!</p>
                  </div>
                ) : (
                  <div className="milestones-list">
                    {goalMilestones.map(milestone => (
                      <div key={milestone.id} className={`milestone-item ${milestone.is_completed ? 'completed' : ''}`}>
                        <input
                          type="checkbox"
                          checked={milestone.is_completed}
                          onChange={(e) => handleToggleMilestone(milestone.id, e.target.checked)}
                        />
                        <div className="milestone-content">
                          <strong>{milestone.name}</strong>
                          {milestone.target_date && (
                            <span className="milestone-date">
                              📅 {new Date(milestone.target_date).toLocaleDateString()}
                            </span>
                          )}
                          {milestone.description && (
                            <p className="milestone-description">{milestone.description}</p>
                          )}
                        </div>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteMilestone(milestone.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Goal-Specific Tasks */}
              <div className="goal-section tasks-section">
                <div className="section-header">
                  <h3>✅ Goal Tasks</h3>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowAddGoalTaskModal(true)}
                  >
                    ➕ Add Task
                  </button>
                </div>
                {goalTasks.length === 0 ? (
                  <div className="empty-section">
                    <p>No goal-specific tasks. Add tasks that belong uniquely to this goal!</p>
                  </div>
                ) : (
                  <div className="goal-tasks-list">
                    {goalTasks.map(task => {
                      const taskType = task.task_type || 'time';
                      let progressInfo = '';
                      
                      if (taskType === 'count' && task.target_value) {
                        progressInfo = `${task.current_value || 0}/${task.target_value} ${task.unit || ''}`;
                      } else if (taskType === 'time' && task.allocated_minutes) {
                        progressInfo = `${task.allocated_minutes} minutes allocated`;
                      } else if (taskType === 'boolean') {
                        progressInfo = task.is_completed ? '✅ Done' : '⏳ Pending';
                      }
                      
                      return (
                        <div key={task.id} className={`goal-task-item ${task.is_completed ? 'completed' : ''}`}>
                          <input
                            type="checkbox"
                            checked={task.is_completed}
                            onChange={(e) => handleUpdateGoalTask(task.id, { is_completed: e.target.checked })}
                          />
                          <div className="goal-task-content">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong>{task.name}</strong>
                              <span className="task-type-badge" style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                backgroundColor: taskType === 'time' ? '#edf2f7' : 
                                               taskType === 'count' ? '#e6f7ff' : '#f0f5ff',
                                color: '#4a5568'
                              }}>
                                {taskType === 'time' ? '⏱️ TIME' : taskType === 'count' ? '🔢 COUNT' : '✅ YES/NO'}
                              </span>
                            </div>
                            {progressInfo && (
                              <span style={{ color: '#718096', fontSize: '14px', marginTop: '4px' }}>
                                {progressInfo}
                              </span>
                            )}
                            {task.due_date && (
                              <span className="task-due-date">
                                📅 Due: {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                            {task.description && <p className="task-description">{task.description}</p>}
                          </div>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteGoalTask(task.id)}
                          >
                            Delete
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Linked Tasks */}
              <div className="goal-section linked-section">
                <div className="section-header">
                  <h3>🔗 Linked Tasks</h3>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowLinkTaskModal(true)}
                  >
                    🔗 Link Task
                  </button>
                </div>
                {linkedTasks.length === 0 ? (
                  <div className="empty-section">
                    <p>No linked tasks. Connect existing daily/weekly/monthly tasks to this goal!</p>
                  </div>
                ) : (
                  <div className="linked-tasks-list">
                    {linkedTasks.map((link: any) => {
                      const completionPercentage = link.completion_percentage || 0;
                      const recentTrend = link.recent_trend || 0;
                      const trendColor = recentTrend >= 80 ? '#48bb78' : recentTrend >= 60 ? '#ed8936' : '#e53e3e';
                      
                      return (
                        <div key={link.id} className="linked-task-item">
                          <div 
                            className="linked-task-content clickable" 
                            onClick={() => handleNavigateToTask(link.task_type)}
                            title="Click to view this task"
                          >
                            <div className="linked-task-header">
                              <strong>{link.task?.name || 'Task'} →</strong>
                              <span className="task-type-badge">{link.task_type}</span>
                            </div>
                            
                            {link.link_start_date && (
                              <div className="linked-task-stats">
                                <div className="stat-row">
                                  <span className="stat-label">Tracking since:</span>
                                  <span className="stat-value">
                                    {new Date(link.link_start_date).toLocaleDateString()} 
                                    ({link.days_tracked} days)
                                  </span>
                                </div>
                                
                                <div className="stat-row progress-row">
                                  <span className="stat-label">Overall Progress:</span>
                                  <div className="stat-progress">
                                    <div className="progress-bar-container">
                                      <div 
                                        className="progress-bar-fill" 
                                        style={{ 
                                          width: `${completionPercentage}%`,
                                          backgroundColor: completionPercentage >= 70 ? '#48bb78' : completionPercentage >= 40 ? '#ed8936' : '#e53e3e'
                                        }} 
                                      />
                                    </div>
                                    <span className="progress-text">
                                      {link.completion_count}/{link.expected_count} ({completionPercentage.toFixed(1)}%)
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="stat-row">
                                  <span className="stat-label">Last 30 days:</span>
                                  <span className="stat-value" style={{ color: trendColor, fontWeight: 600 }}>
                                    {recentTrend.toFixed(1)}% 
                                    {recentTrend >= completionPercentage ? ' 📈' : ' 📉'}
                                  </span>
                                </div>
                                
                                {link.last_completed && (
                                  <div className="stat-row">
                                    <span className="stat-label">Last completed:</span>
                                    <span className="stat-value">
                                      {new Date(link.last_completed).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {link.notes && <p className="task-notes">💭 {link.notes}</p>}
                          </div>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleUnlinkTask(link.id)}
                          >
                            Unlink
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Goal Projects Section - Tracking Dashboards */}
              <div className="goal-section goal-projects-section">
                <div className="section-header">
                  <h3>📊 Performance Tracking</h3>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowCreateTrackingProjectModal(true)}
                  >
                    ➕ Create Tracking Dashboard
                  </button>
                </div>
                <p style={{ color: '#718096', fontSize: '14px', marginBottom: '16px' }}>
                  Monitor daily/weekly/monthly task performance against your goals with time-bounded tracking and visual progress indicators.
                </p>
                {goalTrackingProjects.length === 0 ? (
                  <div className="empty-section">
                    <p>No tracking dashboards yet. Create one to monitor task completion frequency and performance!</p>
                  </div>
                ) : (
                  <div className="tracking-projects-list">
                    {goalTrackingProjects.map((trackingProject) => {
                      const statusColor = trackingProject.status === 'green' ? '#48bb78' : 
                                         trackingProject.status === 'yellow' ? '#ed8936' : '#e53e3e';
                      const statusEmoji = trackingProject.status === 'green' ? '🟢' : 
                                         trackingProject.status === 'yellow' ? '🟡' : '🔴';
                      
                      return (
                        <div 
                          key={trackingProject.id} 
                          className="tracking-project-card"
                          style={{ borderLeft: `4px solid ${statusColor}` }}
                        >
                          <div className="tracking-project-header">
                            <div>
                              <strong>{statusEmoji} {trackingProject.name}</strong>
                              {trackingProject.description && (
                                <p style={{ color: '#718096', fontSize: '14px', marginTop: '4px' }}>
                                  {trackingProject.description}
                                </p>
                              )}
                            </div>
                            <div className="tracking-project-overall">
                              <span style={{ fontSize: '24px', fontWeight: 'bold', color: statusColor }}>
                                {trackingProject.overall_percentage.toFixed(0)}%
                              </span>
                              <span style={{ fontSize: '12px', color: '#718096' }}>Overall</span>
                            </div>
                          </div>
                          
                          <div className="task-performances">
                            {trackingProject.task_performances.map((perf) => {
                              const perfColor = perf.status === 'green' ? '#48bb78' : 
                                               perf.status === 'yellow' ? '#ed8936' : '#e53e3e';
                              const perfEmoji = perf.status === 'green' ? '✅' : 
                                               perf.status === 'yellow' ? '⚠️' : '❌';
                              
                              return (
                                <div key={perf.task_link_id} className="task-performance-row">
                                  <div className="task-performance-info">
                                    <span className="task-name">{perfEmoji} {perf.task_name}</span>
                                    <span className="task-type-badge" style={{ 
                                      backgroundColor: perf.task_type === 'daily' ? '#edf2f7' : 
                                                      perf.task_type === 'weekly' ? '#e6f7ff' : '#f0f5ff'
                                    }}>
                                      {perf.task_type}
                                    </span>
                                  </div>
                                  <div className="task-performance-stats">
                                    <span className="completion-count">
                                      {perf.actual_count}/{perf.expected_count} completed
                                    </span>
                                    <div className="performance-bar-container">
                                      <div 
                                        className="performance-bar-fill" 
                                        style={{ 
                                          width: `${Math.min(perf.completion_percentage, 100)}%`,
                                          backgroundColor: perfColor
                                        }} 
                                      />
                                    </div>
                                    <span className="performance-percentage" style={{ color: perfColor, fontWeight: 'bold' }}>
                                      {perf.completion_percentage.toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Projects Section */}
              <div className="goal-section projects-section">
                <div className="section-header">
                  <h3>📁 Projects</h3>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowAddGoalTaskModal(true)}
                  >
                    ➕ Add Task/Project
                  </button>
                </div>
                <p style={{ color: '#718096', fontSize: '14px', marginBottom: '16px' }}>
                  Complex tasks created as projects appear here. Click to view full project details with sub-tasks.
                </p>
                {goalProjects.length === 0 ? (
                  <div className="empty-section">
                    <p>No projects yet. Create a task as a project when it needs sub-tasks or detailed management!</p>
                  </div>
                ) : (
                  <div className="goal-projects-list">
                    {goalProjects.map((project: any) => {
                      const completionPercentage = project.completion_percentage || 0;
                      const progressColor = completionPercentage >= 80 ? '#48bb78' : 
                                           completionPercentage >= 50 ? '#ed8936' : '#e53e3e';
                      const isExpanded = expandedProjects.has(project.id);
                      const tasks = projectTasks.filter(t => t.project_id === project.id);
                      
                      return (
                        <div key={project.id} className="project-card">
                          <div className="project-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                className="btn-expand"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleProjectExpansion(project.id);
                                }}
                                style={{ 
                                  background: 'none',
                                  border: 'none',
                                  fontSize: '16px',
                                  cursor: 'pointer',
                                  padding: '4px 8px'
                                }}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                              <strong>{project.name}</strong>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`status-badge status-${project.status}`}>
                                {project.status.replace('_', ' ').toUpperCase()}
                              </span>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Navigating to project:', project.id, project.name);
                                  navigate(`/tasks?tab=projects&project=${project.id}`);
                                }}
                                title="Open in Tasks page"
                              >
                                Open Full View →
                              </button>
                            </div>
                          </div>
                          
                          {project.description && (
                            <p className="project-description">{project.description}</p>
                          )}
                          
                          <div className="project-stats">
                            <div className="stat-row">
                              <span className="stat-label">Tasks:</span>
                              <span className="stat-value">
                                {project.completed_tasks}/{project.total_tasks} completed
                              </span>
                            </div>
                            
                            <div className="stat-row progress-row">
                              <span className="stat-label">Progress:</span>
                              <div className="stat-progress">
                                <div className="progress-bar-container">
                                  <div 
                                    className="progress-bar-fill" 
                                    style={{ 
                                      width: `${completionPercentage}%`,
                                      backgroundColor: progressColor
                                    }} 
                                  />
                                </div>
                                <span className="progress-text">{completionPercentage.toFixed(1)}%</span>
                              </div>
                            </div>
                            
                            {project.target_completion_date && (
                              <div className="stat-row">
                                <span className="stat-label">Target:</span>
                                <span className="stat-value">
                                  {new Date(project.target_completion_date).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Expanded Tasks Section */}
                          {isExpanded && (
                            <div className="project-tasks-section" style={{ 
                              marginTop: '16px', 
                              paddingTop: '16px', 
                              borderTop: '1px solid #e2e8f0' 
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Tasks</h4>
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProjectForTask(project.id);
                                    setShowAddProjectTaskModal(true);
                                  }}
                                >
                                  ➕ Add Task
                                </button>
                              </div>
                              
                              {tasks.length === 0 ? (
                                <p style={{ color: '#718096', fontSize: '14px', fontStyle: 'italic' }}>
                                  No tasks yet. Click "Add Task" to create one.
                                </p>
                              ) : (
                                <div className="project-tasks-tree">
                                  {getProjectTasksByParentId(null, project.id).map((task) => (
                                    <ProjectTaskNode
                                      key={task.id}
                                      task={task}
                                      level={0}
                                      projectId={project.id}
                                      allTasks={tasks}
                                      expandedTasks={expandedProjectTasks}
                                      onToggleExpand={toggleProjectTaskExpansion}
                                      onToggleComplete={handleToggleProjectTaskCompletion}
                                      onDelete={handleDeleteProjectTask}
                                      onEdit={handleEditProjectTask}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {/* Add/Edit Life Goal Modal */}
      {showAddGoalModal && (
        <div className="modal-overlay" onClick={() => setShowAddGoalModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Life Goal</h2>
              <button className="btn-close" onClick={() => setShowAddGoalModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                // Collect why statements
                const whyStatements: string[] = [];
                let whyIndex = 0;
                while (true) {
                  const whyValue = formData.get(`why_${whyIndex}`);
                  if (whyValue && typeof whyValue === 'string' && whyValue.trim()) {
                    whyStatements.push(whyValue.trim());
                    whyIndex++;
                  } else {
                    break;
                  }
                }
                
                try {
                  const goalData = {
                    name: formData.get('name'),
                    parent_goal_id: formData.get('parent_goal_id') ? parseInt(formData.get('parent_goal_id') as string) : null,
                    start_date: formData.get('start_date') || new Date().toISOString().split('T')[0],
                    target_date: formData.get('target_date'),
                    category: formData.get('category') || null,
                    priority: formData.get('priority') || 'medium',
                    why_statements: whyStatements,
                    description: formData.get('description') || null,
                    time_allocated_hours: parseFloat(formData.get('time_allocated_hours') as string) || 0
                  };
                  
                  await handleCreateLifeGoal(goalData);
                } catch (err: any) {
                  console.error('Error creating goal:', err);
                  alert('Failed to create goal: ' + (err.response?.data?.detail || err.message));
                }
              }}>
                <div className="form-group">
                  <label htmlFor="goal-name">Goal Name *</label>
                  <input
                    type="text"
                    id="goal-name"
                    name="name"
                    className="form-control"
                    required
                    placeholder="e.g., Become Director in 2 years"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="goal-category">Category</label>
                    <select
                      id="goal-category"
                      name="category"
                      className="form-control"
                    >
                      <option value="">-- Select Category --</option>
                      <option value="career">Career</option>
                      <option value="health">Health</option>
                      <option value="financial">Financial</option>
                      <option value="personal">Personal</option>
                      <option value="learning">Learning</option>
                      <option value="relationships">Relationships</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="goal-priority">Priority</label>
                    <select
                      id="goal-priority"
                      name="priority"
                      className="form-control"
                      defaultValue="medium"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="goal-start-date">Start Date *</label>
                    <input
                      type="date"
                      id="goal-start-date"
                      name="start_date"
                      className="form-control"
                      required
                      defaultValue={new Date().toISOString().split('T')[0]}
                    />
                    <small className="form-text">
                      When did/will you start working on this goal? (Editable - can be in the past)
                    </small>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="goal-target-date">Target Date *</label>
                    <input
                      type="date"
                      id="goal-target-date"
                      name="target_date"
                      className="form-control"
                      required
                    />
                    <small className="form-text">
                      When do you want to achieve this goal?
                    </small>
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="goal-parent">Parent Goal (Optional - for sub-goals)</label>
                  <select
                    id="goal-parent"
                    name="parent_goal_id"
                    className="form-control"
                  >
                    <option value="">-- None (Root Goal) --</option>
                    {lifeGoals
                      .filter(g => !g.parent_goal_id) // Only show root goals as potential parents
                      .map(goal => (
                        <option key={goal.id} value={goal.id}>
                          {goal.name}
                        </option>
                      ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="goal-time-allocated">Estimated Time (hours)</label>
                  <input
                    type="number"
                    id="goal-time-allocated"
                    name="time_allocated_hours"
                    className="form-control"
                    min="0"
                    step="0.5"
                    placeholder="e.g., 100"
                  />
                  <small className="form-text">Total hours you estimate this goal will take</small>
                </div>
                
                <div className="form-group">
                  <label>Why This Goal Matters (Your Motivation)</label>
                  <div id="why-statements-container">
                    <div className="why-statement-input">
                      <input
                        type="text"
                        name="why_0"
                        className="form-control"
                        placeholder="Reason 1: e.g., Career growth and better compensation"
                      />
                    </div>
                    <div className="why-statement-input">
                      <input
                        type="text"
                        name="why_1"
                        className="form-control"
                        placeholder="Reason 2: e.g., Leadership experience"
                      />
                    </div>
                    <div className="why-statement-input">
                      <input
                        type="text"
                        name="why_2"
                        className="form-control"
                        placeholder="Reason 3: e.g., Opportunity to make bigger impact"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ marginTop: '8px' }}
                    onClick={() => {
                      const container = document.getElementById('why-statements-container');
                      if (container) {
                        const currentCount = container.children.length;
                        const newInput = document.createElement('div');
                        newInput.className = 'why-statement-input';
                        newInput.innerHTML = `
                          <input
                            type="text"
                            name="why_${currentCount}"
                            class="form-control"
                            placeholder="Reason ${currentCount + 1}"
                          />
                        `;
                        container.appendChild(newInput);
                      }
                    }}
                  >
                    ➕ Add Another Reason
                  </button>
                </div>
                
                <div className="form-group">
                  <label htmlFor="goal-description">Description / Notes</label>
                  <textarea
                    id="goal-description"
                    name="description"
                    className="form-control"
                    rows={4}
                    placeholder="Additional details, action plan, or notes about this goal..."
                  />
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={() => setShowAddGoalModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Milestone Modal */}
      {showAddMilestoneModal && selectedGoal && (
        <div className="modal-overlay" onClick={() => setShowAddMilestoneModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Milestone to {selectedGoal.name}</h2>
              <button className="btn-close" onClick={() => setShowAddMilestoneModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                try {
                  await handleCreateMilestone(selectedGoal.id, {
                    name: formData.get('name'),
                    description: formData.get('description') || null,
                    start_date: formData.get('start_date') || null,
                    target_date: formData.get('target_date') || null,
                    metric: formData.get('metric') || null,
                    order: 0
                  });
                } catch (err: any) {
                  console.error('Error creating milestone:', err);
                }
              }}>
                <div className="form-group">
                  <label htmlFor="milestone-name">Milestone Name *</label>
                  <input
                    type="text"
                    id="milestone-name"
                    name="name"
                    className="form-control"
                    required
                    placeholder="e.g., Get promoted to Manager"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="milestone-start-date">Start Date</label>
                    <input
                      type="date"
                      id="milestone-start-date"
                      name="start_date"
                      className="form-control"
                      defaultValue={new Date().toISOString().split('T')[0]}
                    />
                    <small className="form-text">
                      When did/will you start working on this milestone?
                    </small>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="milestone-target-date">Target Date *</label>
                    <input
                      type="date"
                      id="milestone-target-date"
                      name="target_date"
                      className="form-control"
                      required
                    />
                    <small className="form-text">
                      When should this milestone be completed?
                    </small>
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="milestone-metric">Success Metric (Optional)</label>
                  <input
                    type="text"
                    id="milestone-metric"
                    name="metric"
                    className="form-control"
                    placeholder="e.g., 80% completion rate"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="milestone-description">Description</label>
                  <textarea
                    id="milestone-description"
                    name="description"
                    className="form-control"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={() => setShowAddMilestoneModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Add Milestone
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Goal Task Modal */}
      {showAddGoalTaskModal && selectedGoal && (
        <div className="modal-overlay" onClick={() => {
          setShowAddGoalTaskModal(false);
          setCreateAsProject(false);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Task to {selectedGoal.name}</h2>
              <button className="btn-close" onClick={() => {
                setShowAddGoalTaskModal(false);
                setCreateAsProject(false);
              }}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                try {
                  if (createAsProject) {
                    // Create as a new Project linked to this goal
                    const startDate = formData.get('start_date') as string;
                    const dueDate = formData.get('due_date') as string;
                    const projectData = {
                      name: formData.get('name'),
                      description: formData.get('description') || '',
                      goal_id: selectedGoal.id,
                      start_date: startDate || new Date().toISOString().split('T')[0],  // Just the date part YYYY-MM-DD
                      target_completion_date: dueDate || null,  // Already in YYYY-MM-DD format from date input
                      status: 'not_started',
                      is_active: true
                    };
                    
                    await api.post('/api/projects/', projectData);
                    alert('Project created successfully! View it in the Projects section below.');
                    setShowAddGoalTaskModal(false);
                    setCreateAsProject(false);
                    await loadGoalDetails(selectedGoal.id);
                  } else {
                    // Create as a simple goal task
                    const taskType = formData.get('task_type') as string || 'time';
                    const taskData: any = {
                      name: formData.get('name'),
                      description: formData.get('description') || null,
                      start_date: formData.get('start_date') || null,
                      due_date: formData.get('due_date') || null,
                      priority: formData.get('priority') || 'medium',
                      task_type: taskType,
                      order: 0
                    };
                    
                    // Add type-specific fields
                    if (taskType === 'count') {
                      taskData.target_value = parseInt(formData.get('target_value') as string) || null;
                      taskData.unit = formData.get('unit') || null;
                    } else if (taskType === 'time') {
                      taskData.time_allocated_hours = parseFloat(formData.get('time_allocated_hours') as string) || 0;
                    }
                    // BOOLEAN type needs no additional fields
                    
                    await handleCreateGoalTask(selectedGoal.id, taskData);
                  }
                } catch (err: any) {
                  console.error('Error creating task/project:', err);
                  alert('Failed to create task/project');
                }
              }}>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={createAsProject}
                      onChange={(e) => setCreateAsProject(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontWeight: 600, color: '#2d3748' }}>
                      Create as Project (for complex tasks with sub-tasks)
                    </span>
                  </label>
                  <small className="form-text">
                    Check this if the task needs multiple sub-tasks or detailed project management
                  </small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="goal-task-name">
                    {createAsProject ? 'Project Name *' : 'Task Name *'}
                  </label>
                  <input
                    type="text"
                    id="goal-task-name"
                    name="name"
                    className="form-control"
                    required
                    placeholder={createAsProject ? 'e.g., Build Personal Website' : 'e.g., Complete leadership course'}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="goal-task-description">Description</label>
                  <textarea
                    id="goal-task-description"
                    name="description"
                    className="form-control"
                    rows={3}
                    placeholder={createAsProject ? 'Project description and objectives' : 'Optional task description'}
                  />
                </div>
                
                {!createAsProject && (
                  <div className="form-group">
                    <label htmlFor="goal-task-type">Task Type *</label>
                    <select
                      id="goal-task-type"
                      name="task_type"
                      className="form-control"
                      defaultValue="time"
                      onChange={(e) => {
                        const form = e.target.form;
                        if (form) {
                          const targetField = form.querySelector('#goal-task-target') as HTMLDivElement;
                          const timeField = form.querySelector('#goal-task-time-field') as HTMLDivElement;
                          if (e.target.value === 'count') {
                            targetField?.style.setProperty('display', 'block');
                            timeField?.style.setProperty('display', 'none');
                          } else if (e.target.value === 'time') {
                            targetField?.style.setProperty('display', 'none');
                            timeField?.style.setProperty('display', 'block');
                          } else {
                            targetField?.style.setProperty('display', 'none');
                            timeField?.style.setProperty('display', 'none');
                          }
                        }
                      }}
                    >
                      <option value="time">⏱️ Time-based (track hours/minutes)</option>
                      <option value="count">🔢 Count-based (track numbers)</option>
                      <option value="boolean">✅ Yes/No (simple completion)</option>
                    </select>
                    <small className="form-text">
                      Choose how you want to measure this task
                    </small>
                  </div>
                )}
                
                {!createAsProject && (
                  <div id="goal-task-target" className="form-group" style={{ display: 'none' }}>
                    <label>Target *</label>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 1 }}>
                        <input
                          type="number"
                          name="target_value"
                          className="form-control"
                          min="1"
                          placeholder="e.g., 5"
                        />
                      </div>
                      <div className="form-group" style={{ flex: 2 }}>
                        <input
                          type="text"
                          name="unit"
                          className="form-control"
                          placeholder="e.g., courses, deals, books"
                        />
                      </div>
                    </div>
                    <small className="form-text">
                      Example: "5 courses" or "10 sales deals"
                    </small>
                  </div>
                )}
                
                <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="goal-task-start-date">
                          {createAsProject ? 'Start Date' : 'Start Date'}
                        </label>
                        <input
                          type="date"
                          id="goal-task-start-date"
                          name="start_date"
                          className="form-control"
                          defaultValue={new Date().toISOString().split('T')[0]}
                        />
                        <small className="form-text">
                          When did/will you start working on this?
                        </small>
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="goal-task-due-date">
                          {createAsProject ? 'Target Completion Date' : 'Due Date'}
                        </label>
                        <input
                          type="date"
                          id="goal-task-due-date"
                          name="due_date"
                          className="form-control"
                        />
                      </div>
                    </div>
                
                {!createAsProject && (
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="goal-task-priority">Priority</label>
                      <select
                        id="goal-task-priority"
                        name="priority"
                        className="form-control"
                        defaultValue="medium"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {!createAsProject && (
                  <div id="goal-task-time-field" className="form-group">
                    <label htmlFor="goal-task-time">Estimated Time (hours)</label>
                    <input
                      type="number"
                      id="goal-task-time"
                      name="time_allocated_hours"
                      className="form-control"
                      min="0"
                      step="0.5"
                      placeholder="e.g., 2.5"
                    />
                    <small className="form-text">
                      Or use minutes for more precision
                    </small>
                  </div>
                )}
                
                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowAddGoalTaskModal(false);
                      setCreateAsProject(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {createAsProject ? 'Create Project' : 'Add Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Link Task Modal */}
      {showLinkTaskModal && selectedGoal && (
        <div className="modal-overlay" onClick={() => {
          setShowLinkTaskModal(false);
          setSelectedTaskType('');
          setAvailableTasks([]);
        }}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Link Task to {selectedGoal.name}</h2>
              <button className="btn-close" onClick={() => {
                setShowLinkTaskModal(false);
                setSelectedTaskType('');
                setAvailableTasks([]);
              }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '20px', color: '#718096' }}>
                Link existing tasks from your Daily, Weekly, or Monthly tabs to this goal.
                This helps track how your routine tasks contribute to long-term goals.
              </p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                try {
                  const taskId = parseInt(formData.get('task_id') as string);
                  const taskType = selectedTaskType;
                  const timeAllocated = parseFloat(formData.get('time_allocated_hours') as string) || 0;
                  const notes = (formData.get('notes') as string) || undefined;
                  const linkStartDate = (formData.get('link_start_date') as string) || undefined;
                  const expectedFrequency = selectedTaskType;  // Use the task type as frequency
                  
                  await handleLinkTask(
                    selectedGoal.id, 
                    taskId, 
                    taskType, 
                    timeAllocated, 
                    notes,
                    linkStartDate,
                    expectedFrequency
                  );
                  setSelectedTaskType('');
                  setAvailableTasks([]);
                } catch (err: any) {
                  console.error('Error linking task:', err);
                }
              }}>
                <div className="form-group">
                  <label htmlFor="link-task-type">Task Type *</label>
                  <select
                    id="link-task-type"
                    name="task_type"
                    className="form-control"
                    required
                    value={selectedTaskType}
                    onChange={(e) => loadTasksByType(e.target.value)}
                  >
                    <option value="">-- Select Task Type --</option>
                    <option value="daily">Daily Tasks</option>
                    <option value="weekly">Weekly Tasks</option>
                    <option value="monthly">Monthly Tasks</option>
                  </select>
                  <small className="form-text">
                    First select the task frequency to see available tasks
                  </small>
                </div>
                
                {selectedTaskType && (
                  <div className="form-group">
                    <label htmlFor="link-task-id">Select Task *</label>
                    <select
                      id="link-task-id"
                      name="task_id"
                      className="form-control"
                      required
                    >
                      <option value="">-- Select a Task --</option>
                      {availableTasks.map(task => (
                        <option key={task.id} value={task.id}>
                          {task.name} {task.pillar_name ? `(${task.pillar_name})` : ''}
                        </option>
                      ))}
                    </select>
                    <small className="form-text">
                      {availableTasks.length === 0 
                        ? 'No tasks found. Create some tasks in the Tasks page first.'
                        : `Found ${availableTasks.length} ${selectedTaskType} task${availableTasks.length !== 1 ? 's' : ''}`}
                    </small>
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="link-time-allocated">Time Allocated (hours)</label>
                  <input
                    type="number"
                    id="link-time-allocated"
                    name="time_allocated_hours"
                    className="form-control"
                    min="0"
                    step="0.5"
                    placeholder="e.g., 5"
                  />
                  <small className="form-text">
                    How many hours per week/month do you spend on this task for this goal?
                  </small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="link-start-date">Tracking Start Date</label>
                  <input
                    type="date"
                    id="link-start-date"
                    name="link_start_date"
                    className="form-control"
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                  <small className="form-text">
                    From when should we start tracking completion for this task? (Defaults to today)
                  </small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="link-notes">Notes</label>
                  <textarea
                    id="link-notes"
                    name="notes"
                    className="form-control"
                    rows={2}
                    placeholder="Optional notes about how this task relates to the goal"
                  />
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowLinkTaskModal(false);
                      setSelectedTaskType('');
                      setAvailableTasks([]);
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={!selectedTaskType || availableTasks.length === 0}
                  >
                    Link Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Tracking Project Modal */}
      {showCreateTrackingProjectModal && selectedGoal && (
        <div className="modal-overlay" onClick={() => setShowCreateTrackingProjectModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Performance Tracking Dashboard</h2>
              <button className="btn-close" onClick={() => setShowCreateTrackingProjectModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                try {
                  // Step 1: Create the tracking project
                  const projectName = formData.get('project_name') as string;
                  const projectDescription = formData.get('project_description') as string;
                  
                  const trackingProject = await api.post<GoalProjectData>(
                    `/api/life-goals/${selectedGoal.id}/goal-projects`,
                    {
                      name: projectName,
                      description: projectDescription
                    }
                  );

                  // Step 2: Link each selected task with tracking parameters
                  const taskCheckboxes = formData.getAll('selected_tasks');
                  
                  for (const taskIdStr of taskCheckboxes) {
                    const taskId = parseInt(taskIdStr as string);
                    const taskType = formData.get(`task_type_${taskId}`) as string;
                    const trackStart = formData.get(`track_start_${taskId}`) as string;
                    const trackEnd = formData.get(`track_end_${taskId}`) as string;
                    const freqValue = parseInt(formData.get(`freq_value_${taskId}`) as string);
                    const freqUnit = formData.get(`freq_unit_${taskId}`) as string;
                    const notes = (formData.get(`notes_${taskId}`) as string) || undefined;

                    await api.post(
                      `/api/life-goals/goal-projects/${trackingProject.id}/tasks`,
                      {
                        task_id: taskId,
                        task_type: taskType,
                        track_start_date: trackStart,
                        track_end_date: trackEnd,
                        expected_frequency_value: freqValue,
                        expected_frequency_unit: freqUnit,
                        notes: notes
                      }
                    );
                  }

                  // Reload goal details
                  await loadGoalDetails(selectedGoal.id);
                  setShowCreateTrackingProjectModal(false);
                  alert('Tracking dashboard created successfully!');
                } catch (err: any) {
                  console.error('Error creating tracking project:', err);
                  alert(`Failed to create tracking project: ${err.response?.data?.detail || err.message}`);
                }
              }}>
                <div className="form-group">
                  <label htmlFor="tracking-project-name">Dashboard Name *</label>
                  <input
                    type="text"
                    id="tracking-project-name"
                    name="project_name"
                    className="form-control"
                    required
                    placeholder="e.g., Weight Loss Routine"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tracking-project-description">Description</label>
                  <textarea
                    id="tracking-project-description"
                    name="project_description"
                    className="form-control"
                    rows={2}
                    placeholder="Optional description of what this dashboard tracks"
                  />
                </div>

                <div className="form-group">
                  <label>Select Tasks to Track</label>
                  <small className="form-text" style={{ display: 'block', marginBottom: '12px' }}>
                    Choose daily/weekly/monthly tasks and set tracking parameters for each.
                  </small>
                  
                  {/* Load tasks when modal opens */}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginBottom: '16px' }}
                    onClick={async () => {
                      try {
                        const [daily, weekly, monthly] = await Promise.all([
                          api.get<Task[]>('/api/tasks/daily'),
                          api.get<Task[]>('/api/tasks/weekly'),
                          api.get<Task[]>('/api/tasks/monthly')
                        ]);
                        setAvailableTasks([
                          ...daily.map(t => ({ ...t, type: 'daily' })),
                          ...weekly.map(t => ({ ...t, type: 'weekly' })),
                          ...monthly.map(t => ({ ...t, type: 'monthly' }))
                        ]);
                      } catch (err) {
                        console.error('Error loading tasks:', err);
                      }
                    }}
                  >
                    Load Available Tasks
                  </button>

                  {availableTasks.length > 0 && (
                    <div className="tracking-tasks-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      {availableTasks.map((task: any) => (
                        <div key={`${task.type}-${task.id}`} className="tracking-task-item" style={{
                          padding: '16px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          marginBottom: '12px',
                          background: '#f7fafc'
                        }}>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                name="selected_tasks"
                                value={task.id}
                              />
                              <strong>{task.name}</strong>
                              <span className="task-type-badge" style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                backgroundColor: task.type === 'daily' ? '#edf2f7' : 
                                                task.type === 'weekly' ? '#e6f7ff' : '#f0f5ff',
                                color: '#4a5568'
                              }}>
                                {task.type}
                              </span>
                            </label>
                          </div>

                          <input type="hidden" name={`task_type_${task.id}`} value={task.type} />

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                            <div>
                              <label style={{ fontSize: '12px', color: '#718096' }}>Track Start Date</label>
                              <input
                                type="date"
                                name={`track_start_${task.id}`}
                                className="form-control"
                                defaultValue={selectedGoal.start_date}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', color: '#718096' }}>Track End Date</label>
                              <input
                                type="date"
                                name={`track_end_${task.id}`}
                                className="form-control"
                                defaultValue={selectedGoal.target_date}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                            <div>
                              <label style={{ fontSize: '12px', color: '#718096' }}>Expected Frequency</label>
                              <input
                                type="number"
                                name={`freq_value_${task.id}`}
                                className="form-control"
                                defaultValue={task.type === 'daily' ? '1' : task.type === 'weekly' ? '1' : '1'}
                                min="1"
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', color: '#718096' }}>Per</label>
                              <select name={`freq_unit_${task.id}`} className="form-control">
                                <option value="per_day" selected={task.type === 'daily'}>Per Day</option>
                                <option value="per_week" selected={task.type === 'weekly'}>Per Week</option>
                                <option value="per_month" selected={task.type === 'monthly'}>Per Month</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ marginTop: '12px' }}>
                            <label style={{ fontSize: '12px', color: '#718096' }}>Notes (Optional)</label>
                            <input
                              type="text"
                              name={`notes_${task.id}`}
                              className="form-control"
                              placeholder="e.g., Target: 6 times per week"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowCreateTrackingProjectModal(false);
                      setAvailableTasks([]);
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={availableTasks.length === 0}
                  >
                    Create Dashboard
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Project Task Modal */}
      {showAddProjectTaskModal && selectedProjectForTask && (
        <div className="modal-overlay" onClick={() => setShowAddProjectTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Task to Project</h2>
              <button className="btn-close" onClick={() => setShowAddProjectTaskModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateProjectTask}>
                <div className="form-group">
                  <label htmlFor="task-name">Task Name *</label>
                  <input
                    type="text"
                    id="task-name"
                    name="name"
                    className="form-control"
                    required
                    placeholder="e.g., Complete Module 1"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="task-description">Description</label>
                  <textarea
                    id="task-description"
                    name="description"
                    className="form-control"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="task-parent">Parent Task (for sub-tasks)</label>
                  <select
                    id="task-parent"
                    name="parent_task_id"
                    className="form-control"
                    onChange={(e) => {
                      console.log('Parent task selection changed:', e.target.value);
                    }}
                  >
                    <option value="">-- None (Root Task) --</option>
                    {(() => {
                      const filteredTasks = projectTasks.filter(t => t.project_id === selectedProjectForTask);
                      console.log('All project tasks:', projectTasks);
                      console.log('Selected project for task:', selectedProjectForTask);
                      console.log('Filtered tasks for parent dropdown:', filteredTasks);
                      return filteredTasks.map(task => (
                        <option key={task.id} value={task.id}>
                          {'  '.repeat(task.parent_task_id ? 1 : 0)}{task.name}
                        </option>
                      ));
                    })()}
                  </select>
                  <small className="form-text">
                    Select a parent task to create a sub-task
                  </small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="task-due-date">Due Date</label>
                  <input
                    type="date"
                    id="task-due-date"
                    name="due_date"
                    className="form-control"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="task-priority">Priority</label>
                  <select
                    id="task-priority"
                    name="priority"
                    className="form-control"
                    defaultValue="medium"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowAddProjectTaskModal(false);
                      setSelectedProjectForTask(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Add Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Task Modal */}
      {showEditProjectTaskModal && editingProjectTask && (
        <div className="modal-overlay" onClick={() => setShowEditProjectTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Task</h2>
              <button className="btn-close" onClick={() => setShowEditProjectTaskModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpdateProjectTask}>
                <div className="form-group">
                  <label htmlFor="edit-task-name">Task Name *</label>
                  <input
                    type="text"
                    id="edit-task-name"
                    className="form-control"
                    value={editingProjectTask.name}
                    onChange={(e) => setEditingProjectTask({...editingProjectTask, name: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-task-description">Description</label>
                  <textarea
                    id="edit-task-description"
                    className="form-control"
                    rows={2}
                    value={editingProjectTask.description || ''}
                    onChange={(e) => setEditingProjectTask({...editingProjectTask, description: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-task-due-date">Due Date</label>
                  <input
                    type="date"
                    id="edit-task-due-date"
                    className="form-control"
                    value={editingProjectTask.due_date?.split('T')[0] || ''}
                    onChange={(e) => setEditingProjectTask({...editingProjectTask, due_date: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-task-priority">Priority</label>
                  <select
                    id="edit-task-priority"
                    className="form-control"
                    value={editingProjectTask.priority || 'medium'}
                    onChange={(e) => setEditingProjectTask({...editingProjectTask, priority: e.target.value})}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowEditProjectTaskModal(false);
                      setEditingProjectTask(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Wish Modal */}
      {showAddWishModal && (
        <div className="modal-overlay" onClick={() => setShowAddWishModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>✨ Create New Wish</h2>
              <button className="btn-close" onClick={() => setShowAddWishModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                const wishData: any = {
                  title: formData.get('title') as string,
                  description: formData.get('description') as string || undefined,
                  category: formData.get('category') as string || undefined,
                  dream_type: formData.get('dream_type') as string || undefined,
                  estimated_timeframe: formData.get('estimated_timeframe') as string || undefined,
                  estimated_cost: formData.get('estimated_cost') ? parseFloat(formData.get('estimated_cost') as string) : undefined,
                  priority: formData.get('priority') as string || 'medium',
                  why_important: formData.get('why_important') as string || undefined,
                  emotional_impact: formData.get('emotional_impact') as string || undefined,
                  life_area: formData.get('life_area') as string || undefined,
                  image_url: formData.get('image_url') as string || undefined,
                  inspiration_notes: formData.get('inspiration_notes') as string || undefined,
                  status: 'dreaming',
                  is_active: true,
                };

                await handleCreateWish(wishData);
              }}>
                <div className="form-group">
                  <label htmlFor="title">Dream Title *</label>
                  <input 
                    type="text" 
                    id="title" 
                    name="title" 
                    placeholder="What's your dream?" 
                    required 
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea 
                    id="description" 
                    name="description" 
                    rows={3}
                    placeholder="Describe your wish in more detail..."
                    style={{ fontSize: '14px' }}
                  ></textarea>
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label htmlFor="category">Category</label>
                    <select id="category" name="category">
                      <option value="">Select category...</option>
                      <option value="travel">🌍 Travel & Adventure</option>
                      <option value="financial">💰 Financial</option>
                      <option value="personal">🌱 Personal Growth</option>
                      <option value="career">💼 Career</option>
                      <option value="health">💪 Health & Fitness</option>
                      <option value="relationship">❤️ Relationships</option>
                      <option value="learning">📚 Learning</option>
                      <option value="lifestyle">🏡 Lifestyle</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="dream_type">Type</label>
                    <select id="dream_type" name="dream_type">
                      <option value="">Select type...</option>
                      <option value="experience">🎭 Experience</option>
                      <option value="acquisition">🎁 Acquisition</option>
                      <option value="achievement">🏆 Achievement</option>
                      <option value="transformation">🦋 Transformation</option>
                    </select>
                  </div>
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label htmlFor="estimated_timeframe">Timeframe</label>
                    <select id="estimated_timeframe" name="estimated_timeframe">
                      <option value="">When do you imagine...</option>
                      <option value="someday">Someday (no rush)</option>
                      <option value="1-2 years">1-2 years</option>
                      <option value="2-5 years">2-5 years</option>
                      <option value="5+ years">5+ years</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="priority">Priority</label>
                    <select id="priority" name="priority" defaultValue="medium">
                      <option value="low">Low priority</option>
                      <option value="medium">Medium priority</option>
                      <option value="high">High priority</option>
                      <option value="burning_desire">🔥 Burning desire!</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="estimated_cost">Estimated Cost (optional)</label>
                  <input 
                    type="number" 
                    id="estimated_cost" 
                    name="estimated_cost" 
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="why_important">Why does this matter to you?</label>
                  <textarea 
                    id="why_important" 
                    name="why_important" 
                    rows={3}
                    placeholder="Viktor Frankl said: 'Those who have a why can bear almost any how.' What's your why?"
                    style={{ fontSize: '14px', fontStyle: 'italic' }}
                  ></textarea>
                  <small style={{ color: '#718096', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    This is your emotional anchor – it helps you understand what truly drives this dream.
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="emotional_impact">How will you feel when you achieve this?</label>
                  <textarea 
                    id="emotional_impact" 
                    name="emotional_impact" 
                    rows={2}
                    placeholder="Proud? Free? Fulfilled? Describe the feeling..."
                    style={{ fontSize: '14px' }}
                  ></textarea>
                </div>

                <div className="form-group">
                  <label htmlFor="inspiration_notes">Inspiration & Ideas</label>
                  <textarea 
                    id="inspiration_notes" 
                    name="inspiration_notes" 
                    rows={2}
                    placeholder="Any thoughts, inspirations, or ideas that sparked this wish..."
                    style={{ fontSize: '14px' }}
                  ></textarea>
                </div>

                <div className="form-group">
                  <label htmlFor="image_url">Image URL (optional)</label>
                  <input 
                    type="url" 
                    id="image_url" 
                    name="image_url" 
                    placeholder="https://example.com/inspiring-image.jpg"
                  />
                  <small style={{ color: '#718096', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Add a visual representation of your dream to keep it vivid in your mind.
                  </small>
                </div>

                <div style={{ 
                  marginTop: '24px', 
                  padding: '16px', 
                  backgroundColor: '#ebf8ff', 
                  borderRadius: '8px',
                  borderLeft: '4px solid #3182ce'
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#2c5282', lineHeight: '1.6' }}>
                    <strong>💡 Remember:</strong> This is a pressure-free space. No deadlines, no commitments yet. 
                    Just give yourself permission to dream. You can always explore, reflect, and eventually 
                    convert this into a committed goal when you're ready.
                  </p>
                </div>

                <div className="modal-footer" style={{ marginTop: '24px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowAddWishModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    ✨ Create Wish
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Wish Details Modal */}
      {showWishDetailsModal && selectedWish && (
        <div className="modal-overlay" onClick={() => setShowWishDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>✨ {selectedWish.title}</h2>
              <button className="btn-close" onClick={() => setShowWishDetailsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Header section with status and actions */}
              <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    backgroundColor: selectedWish.status === 'dreaming' ? '#e3f2fd' : 
                                    selectedWish.status === 'exploring' ? '#f3e5f5' :
                                    selectedWish.status === 'planning' ? '#fff3e0' :
                                    selectedWish.status === 'ready_to_commit' ? '#e8f5e9' : '#e0f2f1',
                    color: selectedWish.status === 'dreaming' ? '#1976d2' : 
                          selectedWish.status === 'exploring' ? '#7b1fa2' :
                          selectedWish.status === 'planning' ? '#f57c00' :
                          selectedWish.status === 'ready_to_commit' ? '#388e3c' : '#00897b',
                    textTransform: 'capitalize'
                  }}>
                    {selectedWish.status.replace('_', ' ')}
                  </span>
                  
                  {selectedWish.category && (
                    <span style={{ fontSize: '14px', color: '#718096' }}>
                      {selectedWish.category === 'travel' && '🌍'} 
                      {selectedWish.category === 'financial' && '💰'}
                      {selectedWish.category === 'personal' && '🌱'}
                      {selectedWish.category === 'career' && '💼'}
                      {selectedWish.category === 'health' && '💪'}
                      {selectedWish.category === 'relationship' && '❤️'}
                      {selectedWish.category === 'learning' && '📚'}
                      {selectedWish.category === 'lifestyle' && '🏡'}
                      {' '}{selectedWish.category}
                    </span>
                  )}
                  
                  {selectedWish.priority === 'burning_desire' && (
                    <span style={{ fontSize: '20px' }}>🔥</span>
                  )}
                </div>
                
                {selectedWish.description && (
                  <p style={{ margin: '12px 0', fontSize: '15px', color: '#4a5568', lineHeight: '1.6' }}>
                    {selectedWish.description}
                  </p>
                )}

                {selectedWish.estimated_timeframe && (
                  <div style={{ fontSize: '14px', color: '#718096', marginTop: '8px' }}>
                    ⏰ Estimated timeframe: <strong>{selectedWish.estimated_timeframe.replace('_', ' ')}</strong>
                  </div>
                )}

                {selectedWish.estimated_cost && (
                  <div style={{ fontSize: '14px', color: '#718096', marginTop: '4px' }}>
                    💵 Estimated cost: <strong>${selectedWish.estimated_cost.toLocaleString()}</strong>
                  </div>
                )}
              </div>

              {/* Why it matters section */}
              {selectedWish.why_important && (
                <div style={{
                  backgroundColor: '#fef5e7',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  borderLeft: '4px solid #f39c12'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#856404', fontWeight: '600' }}>
                    💫 Why this matters to you:
                  </h4>
                  <p style={{ margin: 0, fontSize: '14px', color: '#856404', lineHeight: '1.6' }}>
                    {selectedWish.why_important}
                  </p>
                </div>
              )}

              {/* Emotional impact section */}
              {selectedWish.emotional_impact && (
                <div style={{
                  backgroundColor: '#f0f9ff',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  borderLeft: '4px solid #3b82f6'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e40af', fontWeight: '600' }}>
                    ✨ How you'll feel:
                  </h4>
                  <p style={{ margin: 0, fontSize: '14px', color: '#1e40af', lineHeight: '1.6' }}>
                    {selectedWish.emotional_impact}
                  </p>
                </div>
              )}

              {/* Stats section */}
              {selectedWish.stats && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '16px',
                  marginBottom: '24px',
                  padding: '16px',
                  backgroundColor: '#f7fafc',
                  borderRadius: '8px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4a5568' }}>
                      {selectedWish.stats.days_dreaming || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                      Days Dreaming
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4a5568' }}>
                      {selectedWish.stats.reflections_count || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                      Reflections
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4a5568' }}>
                      {selectedWish.stats.exploration_steps_completed || 0}/{selectedWish.stats.exploration_steps_total || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                      Exploration Steps
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4a5568' }}>
                      {selectedWish.stats.inspirations_count || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                      Inspirations
                    </div>
                  </div>
                  {selectedWish.stats.average_clarity_score && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4a5568' }}>
                        {selectedWish.stats.average_clarity_score.toFixed(1)}/10
                      </div>
                      <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                        Clarity Score
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginBottom: '24px'
              }}>
                <button 
                  className="btn"
                  style={{
                    padding: '12px',
                    backgroundColor: '#bee3f8',
                    color: '#2c5282',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                  onClick={async () => {
                    const text = prompt("What are your thoughts about this dream? How do you feel about it right now?");
                    if (text) {
                      const moodOptions = ['excited', 'uncertain', 'determined', 'doubtful', 'inspired'];
                      const mood = prompt(`How would you describe your mood? (${moodOptions.join(', ')})`);
                      const clarityStr = prompt("How clear is this wish to you now? (1-10, where 10 is crystal clear)");
                      const clarity = clarityStr ? parseInt(clarityStr) : undefined;
                      
                      try {
                        await api.post(`/api/wishes/${selectedWish.id}/reflections`, {
                          reflection_text: text,
                          mood: mood || 'inspired',
                          clarity_score: clarity
                        });
                        await loadWishes();
                        const updated: any = await api.get(`/api/wishes/${selectedWish.id}`);
                        setSelectedWish(updated.data || updated);
                      } catch (err) {
                        console.error('Error adding reflection:', err);
                        alert('Failed to add reflection');
                      }
                    }
                  }}
                >
                  ✍️ Add Reflection
                </button>

                <button 
                  className="btn"
                  style={{
                    padding: '12px',
                    backgroundColor: '#c6f6d5',
                    color: '#22543d',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                  onClick={async () => {
                    const title = prompt("What small step can you take to explore this wish?");
                    if (title) {
                      const typeOptions = ['research', 'save_money', 'learn_skill', 'explore', 'connect'];
                      const type = prompt(`What type of step is this? (${typeOptions.join(', ')})`);
                      
                      try {
                        await api.post(`/api/wishes/${selectedWish.id}/steps`, {
                          step_title: title,
                          step_type: type || 'research'
                        });
                        await loadWishes();
                        const updated: any = await api.get(`/api/wishes/${selectedWish.id}`);
                        setSelectedWish(updated.data || updated);
                      } catch (err) {
                        console.error('Error adding exploration step:', err);
                        alert('Failed to add exploration step');
                      }
                    }
                  }}
                >
                  🔍 Add Exploration Step
                </button>

                <button 
                  className="btn"
                  style={{
                    padding: '12px',
                    backgroundColor: '#fef3c7',
                    color: '#78350f',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                  onClick={async () => {
                    const title = prompt("What inspired you? (article title, quote, person, etc.)");
                    if (title) {
                      const url = prompt("URL (if applicable):");
                      const typeOptions = ['article', 'video', 'photo', 'quote', 'story', 'person'];
                      const type = prompt(`What type of inspiration? (${typeOptions.join(', ')})`);
                      
                      try {
                        await api.post(`/api/wishes/${selectedWish.id}/inspirations`, {
                          title: title,
                          url: url || undefined,
                          inspiration_type: type || 'article'
                        });
                        await loadWishes();
                        const updated: any = await api.get(`/api/wishes/${selectedWish.id}`);
                        setSelectedWish(updated.data || updated);
                      } catch (err) {
                        console.error('Error adding inspiration:', err);
                        alert('Failed to add inspiration');
                      }
                    }
                  }}
                >
                  💡 Add Inspiration
                </button>

                {selectedWish.status === 'ready_to_commit' && (
                  <button 
                    className="btn"
                    style={{
                      padding: '12px',
                      backgroundColor: '#d1fae5',
                      color: '#065f46',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                    onClick={() => {
                      alert('Convert to Goal feature coming soon! This will create a Life Goal from your wish.');
                    }}
                  >
                    🎯 Convert to Goal
                  </button>
                )}
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <button 
                  className="btn btn-secondary"
                  onClick={async () => {
                    if (confirm('Are you sure you want to archive this wish? You can view archived wishes later.')) {
                      await handleArchiveWish(selectedWish.id);
                      setShowWishDetailsModal(false);
                    }
                  }}
                  style={{ color: '#e53e3e' }}
                >
                  🗄️ Archive
                </button>
                
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowWishDetailsModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

