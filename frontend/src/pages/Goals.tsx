/**
 * Life Goals Page
 * Manage long-term life goals with OKR/SMART methodology
 * Supports hierarchical goals, milestones, task linking, and progress tracking
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import './Goals.css'; // Goals page styling
import { Task } from '../types';
import confetti from 'canvas-confetti';
import TaskForm from '../components/TaskForm';
import { AddGoalModal } from '../components/AddGoalModal';
import { PillarCategorySelector } from '../components/PillarCategorySelector';
import { RelatedChallengesList } from '../components/RelatedChallengesList';
import { AlertModal } from '../components/AlertModal';

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
  stats?: {
    milestones?: {
      total: number;
      completed: number;
      goal_milestones?: { total: number; completed: number };
      project_milestones?: { total: number; completed: number };
    };
    goal_tasks?: { total: number; completed: number };
    project_tasks?: { total: number; completed: number };
    all_tasks?: { total: number; completed: number };
    linked_tasks?: { total: number };
  };
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
  parent_task_id: number | null; // For hierarchical task structure
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
  milestone_id: number | null;
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
  linked_goal_id?: number;
  achieved_at?: string;
  achievement_notes?: string;
  released_at?: string;
  release_reason?: string;
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

// Wish Activities Component - Shows tasks, projects, goals for a wish
const WishActivitiesSection = ({ selectedWish }: { selectedWish: WishData }) => {
  const [activities, setActivities] = useState<{ tasks: any[], projects: any[], goals: any[], reflections: any[], explorationSteps: any[], completedItems: any[] }>({ 
    tasks: [], projects: [], goals: [], reflections: [], explorationSteps: [], completedItems: [] 
  });
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const reloadActivities = async () => {
    try {
      setLoading(true);
      const [allTasks, allProjects, allGoals, allReflections, allSteps] = await Promise.all([
        api.get('/api/tasks/').catch(() => []),
        api.get('/api/projects/').catch(() => []),
        api.get('/api/life-goals/?include_completed=true').catch(() => []),
        api.get(`/api/wishes/${selectedWish.id}/reflections`).catch(() => []),
        api.get(`/api/wishes/${selectedWish.id}/steps`).catch(() => [])
      ]);
      
      // Filter by related_wish_id (same pattern as loadWishStats)
      const tasks = (Array.isArray(allTasks) ? allTasks : []).filter((t: any) => t.related_wish_id === selectedWish.id);
      const projects = (Array.isArray(allProjects) ? allProjects : []).filter((p: any) => p.related_wish_id === selectedWish.id);
      const goals = (Array.isArray(allGoals) ? allGoals : []).filter((g: any) => g.related_wish_id === selectedWish.id);
      const reflections = Array.isArray(allReflections) ? allReflections : [];
      const explorationSteps = Array.isArray(allSteps) ? allSteps : [];
      
      const activeTasks = tasks.filter((t: any) => !t.is_completed && t.is_active !== false);
      const activeProjects = projects.filter((p: any) => p.status !== 'completed');
      const activeGoals = goals.filter((g: any) => g.status !== 'completed' && g.status !== 'abandoned');
      const activeSteps = explorationSteps.filter((s: any) => !s.is_completed);
      const completedItems = [
        ...tasks.filter((t: any) => t.is_completed).map((t: any) => ({ ...t, type: 'task', name: t.task_name || t.name })),
        ...projects.filter((p: any) => p.status === 'completed').map((p: any) => ({ ...p, type: 'project', name: p.project_name || p.name })),
        ...goals.filter((g: any) => g.status === 'completed').map((g: any) => ({ ...g, type: 'goal', name: g.goal_name || g.name })),
        ...explorationSteps.filter((s: any) => s.is_completed).map((s: any) => ({ ...s, type: 'step', name: s.step_title || s.name }))
      ];
      
      setActivities({ tasks: activeTasks, projects: activeProjects, goals: activeGoals, reflections, explorationSteps: activeSteps, completedItems });
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadActivities();
  }, [selectedWish.id]);

  if (loading) return <div style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>Loading activities...</div>;

  // Show empty state if no activities
  if (activities.tasks.length === 0 && activities.projects.length === 0 && activities.goals.length === 0 && activities.reflections.length === 0 && activities.explorationSteps.length === 0 && activities.completedItems.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>
        No tasks, projects, goals, or reflections linked to this dream yet. Use the buttons above to add activities!
      </div>
    );
  }

  const handleCompleteGoal = async (goalId: number) => {
    if (confirm('Mark this goal as complete?')) {
      try {
        // Optimistic update - move to completed immediately
        setActivities(prev => {
          const goal = prev.goals.find(g => g.id === goalId);
          if (!goal) return prev;
          
          return {
            ...prev,
            goals: prev.goals.filter(g => g.id !== goalId),
            completedItems: [...prev.completedItems, { ...goal, type: 'goal', status: 'completed', actual_completion_date: new Date().toISOString().split('T')[0] }]
          };
        });
        
        await api.put(`/api/life-goals/${goalId}`, { status: 'completed', actual_completion_date: new Date().toISOString().split('T')[0] });
        showToast('Goal completed! 🎉', 'success');
      } catch (err) {
        console.error('Error completing goal:', err);
        showToast('Failed to complete goal', 'error');
        await reloadActivities();
      }
    }
  };

  const handleCompleteProject = async (projectId: number) => {
    if (confirm('Mark this project as complete?')) {
      try {
        // Optimistic update - move to completed immediately
        setActivities(prev => {
          const project = prev.projects.find(p => p.id === projectId);
          if (!project) return prev;
          
          return {
            ...prev,
            projects: prev.projects.filter(p => p.id !== projectId),
            completedItems: [...prev.completedItems, { ...project, type: 'project', status: 'completed', is_completed: true, completed_at: new Date().toISOString() }]
          };
        });
        
        await api.put(`/api/projects/${projectId}`, { status: 'completed', is_completed: true, completed_at: new Date().toISOString() });
        showToast('Project completed! 🎉', 'success');
      } catch (err) {
        console.error('Error completing project:', err);
        showToast('Failed to complete project', 'error');
        await reloadActivities();
      }
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    if (confirm('Mark this task as complete?')) {
      try {
        // Optimistic update - move to completed immediately
        setActivities(prev => {
          const task = prev.tasks.find(t => t.id === taskId);
          if (!task) return prev;
          
          return {
            ...prev,
            tasks: prev.tasks.filter(t => t.id !== taskId),
            completedItems: [...prev.completedItems, { ...task, type: 'task', is_completed: true, completed_at: new Date().toISOString() }]
          };
        });
        
        await api.post(`/api/tasks/${taskId}/complete`);
        showToast('Task completed! ✅', 'success');
      } catch (err) {
        console.error('Error completing task:', err);
        showToast('Failed to complete task', 'error');
        await reloadActivities();
      }
    }
  };

  const handleDeleteReflection = async (reflectionId: number) => {
    if (confirm('Archive this reflection? It will be moved to the completed section.')) {
      try {
        // Optimistic update - move to completed
        setActivities(prev => {
          const reflection = prev.reflections.find(r => r.id === reflectionId);
          if (!reflection) return prev;
          
          return {
            ...prev,
            reflections: prev.reflections.filter(r => r.id !== reflectionId),
            completedItems: [...prev.completedItems, { ...reflection, type: 'reflection', name: reflection.reflection_text?.substring(0, 50) + '...', completed_at: new Date().toISOString() }]
          };
        });
        
        // Note: Backend doesn't have archive field yet, so we're just removing from UI
        // In a future update, we can add an 'is_archived' field to reflections table
        showToast('Reflection archived! 📦', 'success');
      } catch (err) {
        console.error('Error archiving reflection:', err);
        showToast('Failed to archive reflection', 'error');
        await reloadActivities();
      }
    }
  };

  const handleCompleteStep = async (stepId: number) => {
    try {
      // Optimistic update - move to completed immediately
      setActivities(prev => {
        const step = prev.explorationSteps.find(s => s.id === stepId);
        if (!step) return prev;
        
        return {
          ...prev,
          explorationSteps: prev.explorationSteps.filter(s => s.id !== stepId),
          completedItems: [...prev.completedItems, { ...step, type: 'step', is_completed: true, completed_at: new Date().toISOString() }]
        };
      });
      
      await api.put(`/api/wishes/${selectedWish.id}/steps/${stepId}`, { is_completed: true, completed_at: new Date().toISOString() });
      showToast('Step completed! ✅', 'success');
    } catch (err) {
      console.error('Error completing step:', err);
      showToast('Failed to complete step', 'error');
      await reloadActivities();
    }
  };

  const handleDeleteStep = async (stepId: number) => {
    try {
      // Optimistic update - move to completed immediately
      setActivities(prev => {
        const step = prev.explorationSteps.find(s => s.id === stepId);
        if (!step) return prev;
        
        return {
          ...prev,
          explorationSteps: prev.explorationSteps.filter(s => s.id !== stepId),
          completedItems: [...prev.completedItems, { ...step, type: 'step', is_completed: true, completed_at: new Date().toISOString() }]
        };
      });
      
      await api.put(`/api/wishes/${selectedWish.id}/steps/${stepId}`, { is_completed: true, completed_at: new Date().toISOString() });
      showToast('Step completed! ✅', 'success');
    } catch (err) {
      console.error('Error completing step:', err);
      showToast('Failed to complete step', 'error');
      await reloadActivities();
    }
  };

  const handleRestoreGoal = async (goalId: number) => {
    try {
      // Optimistic update - move item immediately
      setActivities(prev => {
        const completedGoal = prev.completedItems.find(item => item.type === 'goal' && item.id === goalId);
        if (!completedGoal) return prev;
        
        return {
          ...prev,
          goals: [...prev.goals, { ...completedGoal, status: 'not_started', actual_completion_date: null }],
          completedItems: prev.completedItems.filter(item => !(item.type === 'goal' && item.id === goalId))
        };
      });
      
      await api.put(`/api/life-goals/${goalId}`, { status: 'not_started', actual_completion_date: null });
      showToast('Goal restored! 🔄', 'success');
    } catch (err) {
      console.error('Error restoring goal:', err);
      showToast('Failed to restore goal', 'error');
      await reloadActivities(); // Reload on error to revert
    }
  };

  const handleRestoreProject = async (projectId: number) => {
    try {
      // Optimistic update - move item immediately
      setActivities(prev => {
        const completedProject = prev.completedItems.find(item => item.type === 'project' && item.id === projectId);
        if (!completedProject) return prev;
        
        return {
          ...prev,
          projects: [...prev.projects, { ...completedProject, status: 'not_started', is_completed: false, completed_at: null }],
          completedItems: prev.completedItems.filter(item => !(item.type === 'project' && item.id === projectId))
        };
      });
      
      await api.put(`/api/projects/${projectId}`, { status: 'not_started', is_completed: false, completed_at: null });
      showToast('Project restored! 🔄', 'success');
    } catch (err) {
      console.error('Error restoring project:', err);
      showToast('Failed to restore project', 'error');
      await reloadActivities(); // Reload on error to revert
    }
  };

  const handleRestoreTask = async (taskId: number) => {
    try {
      // Optimistic update - move item immediately
      setActivities(prev => {
        const completedTask = prev.completedItems.find(item => item.type === 'task' && item.id === taskId);
        if (!completedTask) return prev;
        
        return {
          ...prev,
          tasks: [...prev.tasks, { ...completedTask, is_completed: false, completed_at: null }],
          completedItems: prev.completedItems.filter(item => !(item.type === 'task' && item.id === taskId))
        };
      });
      
      await api.put(`/api/tasks/${taskId}`, { is_completed: false, completed_at: null });
      showToast('Task restored! 🔄', 'success');
    } catch (err) {
      console.error('Error restoring task:', err);
      showToast('Failed to restore task', 'error');
      await reloadActivities(); // Reload on error to revert
    }
  };

  const handleRestoreStep = async (stepId: number) => {
    try {
      // Optimistic update - move item immediately
      setActivities(prev => {
        const completedStep = prev.completedItems.find(item => item.type === 'step' && item.id === stepId);
        if (!completedStep) return prev;
        
        return {
          ...prev,
          explorationSteps: [...prev.explorationSteps, { ...completedStep, is_completed: false, completed_at: null }],
          completedItems: prev.completedItems.filter(item => !(item.type === 'step' && item.id === stepId))
        };
      });
      
      await api.put(`/api/wishes/${selectedWish.id}/steps/${stepId}`, { is_completed: false, completed_at: null });
      showToast('Step restored! 🔄', 'success');
    } catch (err) {
      console.error('Error restoring step:', err);
      showToast('Failed to restore step', 'error');
      await reloadActivities(); // Reload on error to revert
    }
  };

  const handleRestoreReflection = async (reflectionId: number) => {
    try {
      // Optimistic update - move back to reflections
      setActivities(prev => {
        const archivedReflection = prev.completedItems.find(item => item.type === 'reflection' && item.id === reflectionId);
        if (!archivedReflection) return prev;
        
        return {
          ...prev,
          reflections: [...prev.reflections, archivedReflection],
          completedItems: prev.completedItems.filter(item => !(item.type === 'reflection' && item.id === reflectionId))
        };
      });
      
      // Note: Backend doesn't support unarchive yet, just update UI
      showToast('Reflection restored! 🔄', 'success');
    } catch (err) {
      console.error('Error restoring reflection:', err);
      showToast('Failed to restore reflection', 'error');
      await reloadActivities();
    }
  };

  // Helper to render circular progress
  const CircularProgress = ({ percentage, size = 50 }: { percentage: number, size?: number }) => {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    
    return (
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle 
          cx={size/2} cy={size/2} r={radius} fill="none" 
          stroke={percentage === 100 ? '#10b981' : '#fbbf24'} 
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <text 
          x="50%" y="50%" 
          textAnchor="middle" 
          dy="0.3em" 
          transform={`rotate(90 ${size/2} ${size/2})`}
          style={{ fontSize: '12px', fontWeight: '700', fill: percentage === 100 ? '#10b981' : '#78350f' }}
        >
          {percentage}%
        </text>
      </svg>
    );
  };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {/* Active Goals - Dashboard Style */}
      {activities.goals.length > 0 && (
        <div style={{ padding: '14px', background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderRadius: '10px', border: '2px solid #fbbf24' }}>
          <h5 style={{ fontSize: '15px', fontWeight: '700', color: '#78350f', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🎯 Active Goals ({activities.goals.length})
          </h5>
          <div style={{ display: 'grid', gap: '12px' }}>
            {activities.goals.map((goal: any) => (
              <div key={goal.id} style={{ 
                padding: '14px', 
                background: 'white', 
                borderRadius: '8px', 
                border: '1px solid #fbbf24',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* Progress Circle */}
                  <div style={{ flexShrink: 0 }}>
                    <CircularProgress percentage={goal.progress_percentage || 0} size={55} />
                  </div>
                  
                  {/* Goal Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#78350f', marginBottom: '6px' }}>{goal.name}</div>
                    <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '6px' }}>
                      {goal.target_date && <>📅 {new Date(goal.target_date).toLocaleDateString()}</>}
                      {goal.days_remaining !== undefined && (
                        <span style={{ marginLeft: '8px', color: goal.days_remaining < 7 ? '#dc2626' : '#92400e' }}>
                          ({goal.days_remaining} days left)
                        </span>
                      )}
                    </div>
                    {goal.stats && (
                      <div style={{ fontSize: '11px', color: '#a16207', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {goal.stats.time_allocated_hours > 0 && <span>⏱️ {goal.stats.time_allocated_hours}h allocated</span>}
                        {goal.stats.total_milestones > 0 && (
                          <span>🎯 {goal.stats.completed_milestones}/{goal.stats.total_milestones} milestones</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                    <button 
                      onClick={() => handleCompleteGoal(goal.id)}
                      style={{ 
                        padding: '6px 12px', 
                        background: '#10b981', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px', 
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        whiteSpace: 'nowrap'
                      }}
                      title="Mark as complete"
                    >
                      ✓ Complete
                    </button>
                    <button 
                      onClick={() => navigate('/goals')}
                      style={{ 
                        padding: '6px 12px', 
                        background: '#6b7280', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px', 
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                      title="View/Edit"
                    >
                      → View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Projects - Dashboard Style */}
      {activities.projects.length > 0 && (
        <div style={{ padding: '14px', background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', borderRadius: '10px', border: '2px solid #3b82f6' }}>
          <h5 style={{ fontSize: '15px', fontWeight: '700', color: '#1e40af', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📁 Active Projects ({activities.projects.length})
          </h5>
          <div style={{ display: 'grid', gap: '12px' }}>
            {activities.projects.map((project: any) => (
              <div key={project.id} style={{ 
                padding: '14px', 
                background: 'white', 
                borderRadius: '8px', 
                border: '1px solid #3b82f6',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* Progress Circle */}
                  <div style={{ flexShrink: 0 }}>
                    <CircularProgress percentage={project.progress?.progress_percentage || 0} size={55} />
                  </div>
                  
                  {/* Project Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e40af', marginBottom: '6px' }}>{project.name}</div>
                    <div style={{ fontSize: '12px', color: '#1e3a8a', marginBottom: '6px' }}>
                      Status: <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>{(project.status || 'not_started').replace('_', ' ')}</span>
                      {project.target_completion_date && (
                        <span style={{ marginLeft: '8px' }}>📅 {new Date(project.target_completion_date).toLocaleDateString()}</span>
                      )}
                    </div>
                    {project.progress && (
                      <div style={{ fontSize: '11px', color: '#1e40af', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span>📋 {project.progress.completed_tasks}/{project.progress.total_tasks} tasks</span>
                        {project.milestone_progress?.total_milestones > 0 && (
                          <span>🎯 {project.milestone_progress.completed_milestones}/{project.milestone_progress.total_milestones} milestones</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                    <button 
                      onClick={() => handleCompleteProject(project.id)}
                      style={{ 
                        padding: '6px 12px', 
                        background: '#10b981', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px', 
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        whiteSpace: 'nowrap'
                      }}
                      title="Mark as complete"
                    >
                      ✓ Complete
                    </button>
                    <button 
                      onClick={() => navigate('/projects')}
                      style={{ 
                        padding: '6px 12px', 
                        background: '#6b7280', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px', 
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                      title="View/Edit"
                    >
                      → View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Tasks */}
      {activities.tasks.length > 0 && (
        <div style={{ padding: '14px', background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', borderRadius: '10px', border: '2px solid #10b981' }}>
          <h5 style={{ fontSize: '15px', fontWeight: '700', color: '#065f46', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ✅ Active Tasks ({activities.tasks.length})
          </h5>
          <div style={{ display: 'grid', gap: '8px' }}>
            {activities.tasks.map((task: any) => (
              <div key={task.id} style={{ 
                padding: '10px 12px', 
                background: 'white', 
                borderRadius: '6px', 
                border: '1px solid #10b981',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#064e3b' }}>{task.name}</span>
                  {task.allocated_minutes && <span style={{ fontSize: '12px', color: '#047857', marginLeft: '8px' }}>({task.allocated_minutes} min)</span>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    onClick={() => handleCompleteTask(task.id)}
                    style={{ 
                      padding: '3px 8px', 
                      background: '#10b981', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                    title="Complete task"
                  >
                    ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reflections */}
      {activities.reflections.length > 0 && (
        <div style={{ padding: '14px', background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', borderRadius: '10px', border: '2px solid #a855f7' }}>
          <h5 style={{ fontSize: '15px', fontWeight: '700', color: '#6b21a8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💭 Reflections ({activities.reflections.length})
          </h5>
          <div style={{ display: 'grid', gap: '10px' }}>
            {activities.reflections.map((reflection: any) => (
              <div key={reflection.id} style={{ 
                padding: '12px', 
                background: 'white', 
                borderRadius: '6px', 
                border: '1px solid #a855f7',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '600', marginBottom: '4px' }}>
                    {new Date(reflection.reflection_date).toLocaleDateString()}
                    {reflection.mood && ` • ${reflection.mood}`}
                    {reflection.clarity_score && ` • Clarity: ${reflection.clarity_score}/10`}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b21a8' }}>{reflection.reflection_text}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button 
                    onClick={() => handleDeleteReflection(reflection.id)}
                    style={{ 
                      padding: '4px 8px', 
                      background: '#ef4444', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                    title="Delete reflection"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exploration Steps */}
      {activities.explorationSteps.length > 0 && (
        <div style={{ padding: '14px', background: 'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)', borderRadius: '10px', border: '2px solid #8b5cf6' }}>
          <h5 style={{ fontSize: '15px', fontWeight: '700', color: '#5b21b6', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔍 Exploration Steps ({activities.explorationSteps.length})
          </h5>
          <div style={{ display: 'grid', gap: '8px' }}>
            {activities.explorationSteps.map((step: any) => (
              <div key={step.id} style={{ 
                padding: '10px 12px', 
                background: 'white', 
                borderRadius: '6px', 
                border: '1px solid #8b5cf6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#5b21b6', marginBottom: '2px' }}>{step.step_title}</div>
                  {step.step_description && (
                    <div style={{ fontSize: '12px', color: '#7c3aed' }}>{step.step_description}</div>
                  )}
                  {step.step_type && (
                    <div style={{ fontSize: '11px', color: '#8b5cf6', marginTop: '4px', fontStyle: 'italic' }}>
                      Type: {step.step_type}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button 
                    onClick={() => handleCompleteStep(step.id)}
                    style={{ 
                      padding: '4px 8px', 
                      background: '#10b981', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                    title="Complete step"
                  >
                    ✓
                  </button>
                  <button 
                    onClick={() => handleDeleteStep(step.id)}
                    style={{ 
                      padding: '4px 8px', 
                      background: '#ef4444', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                    title="Delete step"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Items (Expandable) */}
      {activities.completedItems.length > 0 && (
        <div style={{ padding: '14px', background: '#f9fafb', borderRadius: '10px', border: '2px solid #d1d5db' }}>
          <div 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setShowCompleted(!showCompleted)}
          >
            <h5 style={{ fontSize: '15px', fontWeight: '700', color: '#6b7280', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              ✓ Completed ({activities.completedItems.length})
            </h5>
            <span style={{ fontSize: '18px', color: '#6b7280' }}>{showCompleted ? '▼' : '▶'}</span>
          </div>
          {showCompleted && (
            <div style={{ display: 'grid', gap: '6px', marginTop: '12px' }}>
              {activities.completedItems.map((item: any) => (
                <div key={`${item.type}-${item.id}`} style={{ 
                  fontSize: '13px', 
                  color: '#6b7280', 
                  padding: '8px 12px', 
                  background: 'white', 
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <span>{item.type === 'task' ? '✅' : item.type === 'project' ? '📁' : item.type === 'step' ? '🔍' : item.type === 'reflection' ? '💭' : '🎯'}</span>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: '600', 
                      color: '#9ca3af', 
                      textTransform: 'uppercase',
                      backgroundColor: '#f3f4f6',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {item.type}
                    </span>
                    <span style={{ textDecoration: 'line-through' }}>{item.name}</span>
                    {item.completed_at && (
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {new Date(item.completed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.type === 'goal') handleRestoreGoal(item.id);
                      else if (item.type === 'project') handleRestoreProject(item.id);
                      else if (item.type === 'task') handleRestoreTask(item.id);
                      else if (item.type === 'step') handleRestoreStep(item.id);
                      else if (item.type === 'reflection') handleRestoreReflection(item.id);
                    }}
                    style={{ 
                      padding: '4px 8px', 
                      background: '#3b82f6', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                    title="Restore"
                  >
                    🔄 Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Goal Task Node Component (similar to TaskNode for Misc Tasks)
const GoalTaskNode: React.FC<{
  task: GoalTaskData;
  allTasks: GoalTaskData[];
  onToggleComplete: (taskId: number, currentStatus: boolean) => void;
  onDelete: (taskId: number) => void;
  onAddSubtask: (parentTask: GoalTaskData) => void;
  onEdit: (task: GoalTaskData) => void;
  level?: number;
}> = ({ task, allTasks, onToggleComplete, onDelete, onAddSubtask, onEdit, level = 0 }) => {
  // Persist expand/collapse state in localStorage
  const expandStateKey = `goal-task-expand-${task.id}`;
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem(expandStateKey);
    return saved !== null ? saved === 'true' : false; // Default collapsed
  });
  
  // Date edit state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // Auto-open date picker when input is shown
  useEffect(() => {
    if (showDatePicker && dateInputRef.current) {
      dateInputRef.current.showPicker?.();
    }
  }, [showDatePicker]);
  
  const toggleExpand = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem(expandStateKey, String(newState));
  };
  
  const handleDateChange = async (newDate: string) => {
    try {
      const response = await fetch(`/api/life-goals/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ due_date: newDate || null })
      });
      if (response.ok) {
        task.due_date = newDate;
        setShowDatePicker(false);
        window.location.reload(); // Refresh to show updated date
      }
    } catch (error) {
      console.error('Failed to update due date:', error);
    }
  };
  
  const subtasks = allTasks.filter(t => t.parent_task_id === task.id);
  const hasSubtasks = subtasks.length > 0;
  
  // Check if task or any subtask is overdue
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const isOverdue = (t: GoalTaskData) => {
    if (!t.due_date || t.is_completed) return false;
    const dueDate = new Date(t.due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  };
  
  const hasOverdueSubtask = (taskId: number): boolean => {
    const children = allTasks.filter(t => t.parent_task_id === taskId);
    return children.some(child => isOverdue(child) || hasOverdueSubtask(child.id));
  };
  
  const taskIsOverdue = isOverdue(task);
  const hasOverdueChild = hasOverdueSubtask(task.id);
  const anySubtaskIncomplete = subtasks.some(st => !st.is_completed);
  
  // Determine background color
  let backgroundColor = 'white';
  if (taskIsOverdue || hasOverdueChild) {
    backgroundColor = '#fee2e2'; // Red for overdue
  } else if (task.is_completed && !anySubtaskIncomplete) {
    backgroundColor = '#d1fae5'; // Brighter green for completed
  }
  
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
    <div style={{ marginLeft: `${level * 30}px` }}>
      <div 
        className={`goal-task-item ${task.is_completed ? 'completed' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '8px 12px',
          background: backgroundColor,
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          marginBottom: '6px'
        }}
      >
        {/* Expand/Collapse Button */}
        {hasSubtasks && (
          <button
            onClick={toggleExpand}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              fontSize: '14px',
              color: '#666'
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        {!hasSubtasks && <div style={{ width: '22px' }}></div>}
        
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={task.is_completed}
          onChange={() => onToggleComplete(task.id, task.is_completed)}
          style={{ marginTop: '4px', cursor: 'pointer' }}
        />
        
        {/* Task Content */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <strong style={{ fontSize: '14px', color: task.is_completed ? '#059669' : '#2d3748' }}>
              {task.name}
            </strong>
            <span style={{
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
            <div style={{ color: '#718096', fontSize: '13px', marginBottom: '4px' }}>
              {progressInfo}
            </div>
          )}
          {task.description && (
            <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0' }}>
              {task.description}
            </p>
          )}
        </div>
        
        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* Due Date Button with inline picker */}
          {!showDatePicker ? (
            <button
              className="btn btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowDatePicker(true);
              }}
              style={{ 
                padding: '4px 10px', 
                fontSize: '11px',
                background: task.due_date ? (taskIsOverdue ? '#fee2e2' : '#fef3c7') : '#f3f4f6',
                color: task.due_date ? (taskIsOverdue ? '#dc2626' : '#92400e') : '#6b7280',
                border: '1px solid',
                borderColor: task.due_date ? (taskIsOverdue ? '#fca5a5' : '#fde68a') : '#d1d5db',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
              title="Click to change due date"
            >
              📅 {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
            </button>
          ) : (
            <input
              ref={dateInputRef}
              type="date"
              defaultValue={task.due_date || ''}
              onChange={(e) => handleDateChange(e.target.value)}
              onBlur={() => setShowDatePicker(false)}
              autoFocus
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                border: '2px solid #3b82f6',
                borderRadius: '4px',
                fontWeight: '600'
              }}
            />
          )}
          
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onEdit(task)}
            style={{ padding: '4px 12px', fontSize: '12px' }}
            title="Edit task"
          >
            ✏️ Edit
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onAddSubtask(task)}
            style={{ padding: '4px 12px', fontSize: '12px' }}
            title="Add subtask"
          >
            ➕ Sub
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => onDelete(task.id)}
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            Delete
          </button>
        </div>
      </div>
      
      {/* Render Subtasks */}
      {isExpanded && hasSubtasks && (
        <div>
          {subtasks.map(subtask => (
            <GoalTaskNode
              key={subtask.id}
              task={subtask}
              allTasks={allTasks}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              onEdit={onEdit}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Goals() {
  // Navigation
  const navigate = useNavigate();
  const location = useLocation();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('goals');
  
  // Alert Modal State
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  
  // Helper function to show centered alert
  const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setAlertMessage(message);
    setAlertType(type);
    setAlertModalOpen(true);
  };
  
  // Section collapse state with localStorage persistence
  const [collapsedSections, setCollapsedSections] = useState<{[key: string]: boolean}>(() => {
    const saved = localStorage.getItem('goalDetailSectionsCollapsed');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    // Default: all sections collapsed on first visit
    return {
      'goal-tasks': true,
      'projects': true,
      'milestones': true,
      'description': true,
      'why-statements': true,
      'supporting-tasks': true,
      'linked-tasks': true,
      'tracking-projects': true,
      'challenges': true
    };
  });
  
  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => {
      const newState = { ...prev, [sectionKey]: !prev[sectionKey] };
      localStorage.setItem('goalDetailSectionsCollapsed', JSON.stringify(newState));
      return newState;
    });
  };
  
  // Goals State
  const [lifeGoals, setLifeGoals] = useState<LifeGoalData[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<LifeGoalData | null>(null);
  const [editingGoal, setEditingGoal] = useState<LifeGoalData | null>(null);
  const [goalMilestones, setGoalMilestones] = useState<MilestoneData[]>([]);
  const [goalTasks, setGoalTasks] = useState<GoalTaskData[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<GoalTaskLinkData[]>([]);
  const [goalProjects, setGoalProjects] = useState<any[]>([]); // Standalone projects
  const [goalTrackingProjects, setGoalTrackingProjects] = useState<GoalProjectData[]>([]); // NEW: Tracking dashboards
  const [goalChallenges, setGoalChallenges] = useState<{direct_challenges: any[], project_challenges: any[]} | null>(null); // Challenges related to goal
  
  // Pillars and Categories for organization
  const [goalPillars, setGoalPillars] = useState<any[]>([]);
  const [goalCategories, setGoalCategories] = useState<any[]>([]);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false);
  const [showAddGoalTaskModal, setShowAddGoalTaskModal] = useState(false);
  const [editingGoalTask, setEditingGoalTask] = useState<GoalTaskData | null>(null); // For adding subtasks
  const [showLinkTaskModal, setShowLinkTaskModal] = useState(false);
  const [showCreateTrackingProjectModal, setShowCreateTrackingProjectModal] = useState(false); // NEW
  const [showLinkProjectsModal, setShowLinkProjectsModal] = useState(false); // Link projects to milestone
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneData | null>(null); // Selected milestone for linking
  const [createAsProject, setCreateAsProject] = useState(false);
  const [showAddProjectToGoalModal, setShowAddProjectToGoalModal] = useState(false); // Dedicated Add Project modal
  const [goalProjectPillarId, setGoalProjectPillarId] = useState<number | null>(null);
  
  // Category collapse state for goals list view - load from localStorage, default all collapsed
  const [collapsedGoalCategories, setCollapsedGoalCategories] = useState<{[key: string]: boolean}>(() => {
    const saved = localStorage.getItem('collapsedGoalSections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse collapsedGoalSections from localStorage:', e);
      }
    }
    // Default: all sections collapsed (true = collapsed, undefined = collapsed)
    // Categories will use format: "Hard Work|Office-Tasks", "Hard Work|Learning", etc.
    return {};
  });
  const [goalProjectCategoryId, setGoalProjectCategoryId] = useState<number | null>(null);
  const [goalProjectSubCategoryId, setGoalProjectSubCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  
  // Wishes State
  const [wishes, setWishes] = useState<WishData[]>([]);
  const [selectedWish, setSelectedWish] = useState<WishData | null>(null);
  const [showAddWishModal, setShowAddWishModal] = useState(false);
  const [showWishDetailsModal, setShowWishDetailsModal] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState<string>('');
  const [wishStats, setWishStats] = useState<{[key: number]: {projects: number, tasks: number, goals: number}}>({});
  
  // Wish form pillar/category state
  const [wishPillarId, setWishPillarId] = useState<number | null>(null);
  const [wishCategoryId, setWishCategoryId] = useState<number | null>(null);
  const [wishSubCategoryId, setWishSubCategoryId] = useState<number | null>(null);

  // Project management state
  interface ProjectTaskData {
    id: number;
    project_id: number;
    parent_task_id: number | null;
    milestone_id: number | null;
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

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Exploration modal state
  const [showAddExplorationModal, setShowAddExplorationModal] = useState(false);
  const [currentExplorationWish, setCurrentExplorationWish] = useState<WishData | null>(null);
  const [explorationSteps, setExplorationSteps] = useState<any[]>([]);
  
  // Inline creation modals from exploration
  const [showInlineProjectModal, setShowInlineProjectModal] = useState(false);
  const [showInlineTaskModal, setShowInlineTaskModal] = useState(false);
  const [showInlineGoalModal, setShowInlineGoalModal] = useState(false);
  
  // Add Reflection modal state
  const [showAddReflectionModal, setShowAddReflectionModal] = useState(false);
  
  // Add Exploration Step modal state (from wish details)
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  
  // Dream insights modal state
  const [showDreamInsightsModal, setShowDreamInsightsModal] = useState(false);
  const [dreamInsights, setDreamInsights] = useState<any>(null);
  
  // Task Form modal state (for adding tasks from dream activities)
  const [showTaskFormModal, setShowTaskFormModal] = useState(false);
  const [taskFormWishId, setTaskFormWishId] = useState<number | null>(null);

  // Load exploration steps for a wish
  const loadExplorationSteps = async (wishId: number) => {
    try {
      const response: any = await api.get(`/api/wishes/${wishId}/steps`);
      const steps = response.data || response;
      setExplorationSteps(Array.isArray(steps) ? steps : []);
    } catch (err) {
      console.error('Error loading exploration steps:', err);
      setExplorationSteps([]);
    }
  };

  // Load exploration steps when wish details modal is opened
  useEffect(() => {
    if (selectedWish && showWishDetailsModal) {
      loadExplorationSteps(selectedWish.id);
    } else {
      setExplorationSteps([]);
    }
  }, [selectedWish, showWishDetailsModal]);

  // 🎉 Celebration confetti when achieved dreams exist
  useEffect(() => {
    const achievedDreams = wishes.filter(w => w.status === 'achieved');
    if (achievedDreams.length > 0 && activeTab === 'wishes') {
      // Small celebratory burst when section is visible
      setTimeout(() => {
        confetti({
          particleCount: 30,
          spread: 50,
          origin: { y: 0.4 },
          colors: ['#ffd700', '#fef3c7', '#fde68a'],
          startVelocity: 20,
          gravity: 0.8
        });
      }, 300);
    }
  }, [wishes, activeTab]);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000); // Increased to 4 seconds
  };

  // Load data based on active tab
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    
    if (tab === 'wishes') {
      setActiveTab('wishes');
      loadWishes();
    } else {
      setActiveTab('goals');
      loadLifeGoals();
    }
  }, [location.search]);

  // Handle URL parameter for goal detail view
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const goalId = params.get('goal');
    
    if (goalId && lifeGoals.length > 0) {
      const goal = lifeGoals.find(g => g.id === parseInt(goalId));
      if (goal) {
        setSelectedGoal(goal);
        loadGoalDetails(parseInt(goalId));
      }
    } else if (!goalId && selectedGoal) {
      // User clicked back button - clear selected goal
      setSelectedGoal(null);
    }
  }, [location.search, lifeGoals]);

  // Save scroll position on scroll
  useEffect(() => {
    const saveScrollPosition = () => {
      sessionStorage.setItem('goalsScrollPosition', String(window.scrollY));
    };

    window.addEventListener('scroll', saveScrollPosition);
    
    return () => {
      window.removeEventListener('scroll', saveScrollPosition);
      saveScrollPosition();
    };
  }, []);

  // Restore scroll position after content loads
  useEffect(() => {
    if (!loading && lifeGoals.length > 0) {
      const savedScrollPosition = sessionStorage.getItem('goalsScrollPosition');
      if (savedScrollPosition) {
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(savedScrollPosition));
        });
      }
    }
  }, [loading, lifeGoals.length]);

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
      setLoading(true);
      const response: any = await api.get('/api/wishes/');
      const data = response.data || response;
      const wishesList = Array.isArray(data) ? data : [];
      console.log('Loaded wishes from API:', wishesList);
      setWishes(wishesList);
      
      // Load stats for each wish
      await loadWishStats(wishesList);
    } catch (err: any) {
      console.error('Error loading wishes:', err);
      setWishes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWishStats = async (wishesList: WishData[]) => {
    try {
      const stats: {[key: number]: {projects: number, tasks: number, goals: number}} = {};
      
      // Load all projects, tasks, and goals in parallel
      const [allProjects, allTasks, allGoals] = await Promise.all([
        api.get('/api/projects/').catch(() => []),
        api.get('/api/tasks/').catch(() => []),
        api.get('/api/life-goals/?include_completed=true').catch(() => [])
      ]);
      
      // Count for each wish
      for (const wish of wishesList) {
        const projects = (Array.isArray(allProjects) ? allProjects : []).filter((p: any) => p.related_wish_id === wish.id);
        const tasks = (Array.isArray(allTasks) ? allTasks : []).filter((t: any) => t.related_wish_id === wish.id);
        const goals = (Array.isArray(allGoals) ? allGoals : []).filter((g: any) => g.related_wish_id === wish.id);
        
        stats[wish.id] = {
          projects: projects.length,
          tasks: tasks.length,
          goals: goals.length
        };
      }
      
      setWishStats(stats);
    } catch (err) {
      console.error('Error loading wish stats:', err);
    }
  };

  // Dream card color themes
  const dreamThemes = [
    { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: '#667eea', symbol: '🌟', frame: '4px double' },
    { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', border: '#f093fb', symbol: '💫', frame: '4px ridge' },
    { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', border: '#4facfe', symbol: '✨', frame: '4px groove' },
    { gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', border: '#43e97b', symbol: '🌈', frame: '4px solid' },
    { gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', border: '#fa709a', symbol: '🎯', frame: '4px double' },
    { gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', border: '#30cfd0', symbol: '🚀', frame: '4px ridge' },
    { gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', border: '#a8edea', symbol: '💎', frame: '4px groove' },
    { gradient: 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)', border: '#ff9a56', symbol: '🔥', frame: '4px solid' },
    { gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)', border: '#fbc2eb', symbol: '🎨', frame: '4px double' },
    { gradient: 'linear-gradient(135deg, #fdcbf1 0%, #e6dee9 100%)', border: '#fdcbf1', symbol: '🌺', frame: '4px ridge' }
  ];

  const getDreamTheme = (wishId: number) => {
    return dreamThemes[wishId % dreamThemes.length];
  };

  const handleCreateWish = async (wishData: any) => {
    try {
      await api.post('/api/wishes/', wishData);
      await loadWishes();
      setShowAddWishModal(false);
      showToast('✨ Dream created successfully!', 'success');
    } catch (err: any) {
      console.error('Error creating wish:', err);
      showToast('Failed to create wish: ' + (err.response?.data?.detail || err.message), 'error');
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
      showAlert('Failed to archive wish: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleUpdateWishStatus = async (wishId: number, newStatus: string) => {
    try {
      await api.put(`/api/wishes/${wishId}`, { status: newStatus });
      await loadWishes();
      if (selectedWish && selectedWish.id === wishId) {
        const updated: any = await api.get(`/api/wishes/${wishId}`);
        setSelectedWish(updated.data || updated);
      }
    } catch (err: any) {
      console.error('Error updating wish status:', err);
      showAlert('Failed to update status: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };
  
  const loadLifeGoals = async () => {
    try {
      setLoading(true);
      const [goalsResponse, pillarsResponse, categoriesResponse] = await Promise.all([
        api.get<LifeGoalData[]>('/api/life-goals/?include_completed=true'),
        api.get<any[]>('/api/pillars/'),
        api.get<any[]>('/api/categories/')
      ]);
      console.log('Life goals loaded:', goalsResponse);
      console.log('Pillars loaded:', pillarsResponse);
      console.log('Categories loaded:', categoriesResponse);
      setLifeGoals(goalsResponse);
      setGoalPillars(pillarsResponse);
      setGoalCategories(categoriesResponse);
    } catch (error) {
      console.error('Error loading life goals:', error);
      showAlert('Failed to load life goals', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadGoalDetails = async (goalId: number) => {
    try {
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
      
      // Load challenges related to this goal
      try {
        const challenges = await api.get<{direct_challenges: any[], project_challenges: any[]}>(`/api/life-goals/${goalId}/challenges`);
        setGoalChallenges(challenges);
        console.log('Goal challenges loaded:', challenges);
      } catch (challengesError) {
        console.warn('Could not load goal challenges:', challengesError);
        setGoalChallenges(null); // Set null if challenges fail
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
      showAlert('Failed to update goal', 'error');
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
      showAlert('Failed to delete goal', 'error');
    }
  };

  const handleCreateMilestone = async (goalId: number, milestoneData: any) => {
    try {
      await api.post(`/api/life-goals/${goalId}/milestones`, milestoneData);
      await loadGoalDetails(goalId);
      setShowAddMilestoneModal(false);
    } catch (error) {
      console.error('Error creating milestone:', error);
      showAlert('Failed to create milestone', 'error');
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
      showAlert('Failed to update milestone', 'error');
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
      showAlert('Failed to delete milestone', 'error');
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
      showAlert('Failed to link task', 'error');
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
      'one_time': 'onetime',
      'onetime': 'onetime'
    };
    
    const tab = tabMap[taskType] || 'onetime';
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
      showAlert('Failed to unlink task', 'error');
    }
  };

  const handleCreateGoalTask = async (goalId: number, taskData: any) => {
    try {
      await api.post(`/api/life-goals/${goalId}/tasks`, taskData);
      await loadGoalDetails(goalId);
      setShowAddGoalTaskModal(false);
    } catch (error) {
      console.error('Error creating goal task:', error);
      showAlert('Failed to create task', 'error');
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
      showAlert('Failed to load project tasks: ' + (err.response?.data?.detail || err.message), 'error');
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
      showAlert('Failed to create task: ' + (err.response?.data?.detail || err.message), 'error');
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
      showAlert('Failed to update task: ' + (err.response?.data?.detail || err.message), 'error');
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
      showAlert('Failed to update task: ' + (err.response?.data?.detail || err.message), 'error');
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
      showAlert('Failed to delete task: ' + (err.response?.data?.detail || err.message), 'error');
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
      showAlert('Failed to update task', 'error');
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
      showAlert('Failed to delete task', 'error');
    }
  };

  const handleBackToGoals = () => {
    setSelectedGoal(null);
    setGoalMilestones([]);
    setGoalTasks([]);
    setLinkedTasks([]);
    navigate('/goals'); // Clear URL parameter
  };

  if (loading) {
    return (
      <div className="page-container">
        <h1>Life Goals</h1>
        <p>Loading goals...</p>
      </div>
    );
  }

  // Render Goal Card Function
  const renderGoalCard = (goal: LifeGoalData, cardIndex: number) => {
    const goalMilestonesTotal = goal.stats?.milestones?.goal_milestones?.total || 0;
    const goalMilestonesCompleted = goal.stats?.milestones?.goal_milestones?.completed || 0;
    
    const projectMilestonesTotal = goal.stats?.milestones?.project_milestones?.total || 0;
    const projectMilestonesCompleted = goal.stats?.milestones?.project_milestones?.completed || 0;
    
    // Use all_tasks which includes goal_tasks + all project tasks (including subtasks)
    const allTasksTotal = goal.stats?.all_tasks?.total || 0;
    const allTasksCompleted = goal.stats?.all_tasks?.completed || 0;
    
    const linkedTasksTotal = goal.stats?.linked_tasks?.total || 0;
    
    const handleViewGoalDetails = (goal: LifeGoalData) => {
      setSelectedGoal(goal);
      loadGoalDetails(goal.id);
      navigate(`/goals?goal=${goal.id}`);
    };

    const handleEditGoal = (goal: LifeGoalData) => {
      setEditingGoal(goal);
      setShowAddGoalModal(true);
    };

    const handleDeleteGoal = async (goalId: number) => {
      if (window.confirm(`Are you sure you want to delete "${goal.name}"?`)) {
        try {
          await api.delete(`/api/life-goals/${goalId}`);
          await loadLifeGoals();
        } catch (err) {
          console.error('Error deleting goal:', err);
        }
      }
    };

    return (
      <div
        key={goal.id}
        className={`goal-card status-${goal.status.replace('_', '-')}`}
        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 24px', minHeight: '110px' }}
        onClick={() => handleViewGoalDetails(goal)}
      >
        {/* Top Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Left: Icon & Title */}
          <div style={{ display: 'flex', gap: '12px', minWidth: '280px', maxWidth: '280px', alignItems: 'center' }}>
            <span style={{ fontSize: '32px', lineHeight: 1 }}>🎯</span>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#2d3748', lineHeight: 1.3 }}>{goal.name}</h3>
              <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>
                {goal.timeframe || 'Long-term'}
              </div>
            </div>
          </div>

          {/* Center: Circular Progress (Goal Milestones, Goal Tasks, Project Milestones, Project Tasks, Projects) */}
          <div style={{ flex: 1, display: 'flex', gap: '32px', alignItems: 'center', justifyContent: 'flex-start' }}>
            {/* Goal Milestones Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <span style={{ fontSize: '13px', color: '#4a5568', fontWeight: '500' }}>🏁 Goal Milestones ({goalMilestonesCompleted}/{goalMilestonesTotal})</span>
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle 
                  cx="40" cy="40" r="32" fill="none" stroke="#ec4899" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - (goalMilestonesTotal > 0 ? goalMilestonesCompleted / goalMilestonesTotal : 0))}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.3s' }}
                />
              </svg>
            </div>
            {/* Goal Tasks Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <span style={{ fontSize: '13px', color: '#4a5568', fontWeight: '500' }}>✅ Goal Tasks ({goal.stats?.linked_tasks?.completed || 0}/{goal.stats?.linked_tasks?.total || 0})</span>
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle 
                  cx="40" cy="40" r="32" fill="none" stroke="#8b5cf6" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - ((goal.stats?.linked_tasks?.total || 0) > 0 ? (goal.stats?.linked_tasks?.completed || 0) / (goal.stats?.linked_tasks?.total || 0) : 0))}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.3s' }}
                />
              </svg>
            </div>
            {/* Project Milestones Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <span style={{ fontSize: '13px', color: '#4a5568', fontWeight: '500' }}>🎯 Project Milestones ({projectMilestonesCompleted}/{projectMilestonesTotal})</span>
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle 
                  cx="40" cy="40" r="32" fill="none" stroke="#f59e0b" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - (projectMilestonesTotal > 0 ? projectMilestonesCompleted / projectMilestonesTotal : 0))}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.3s' }}
                />
              </svg>
            </div>
            {/* Project Tasks Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <span style={{ fontSize: '13px', color: '#4a5568', fontWeight: '500' }}>📊 Project Tasks ({allTasksCompleted}/{allTasksTotal})</span>
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle 
                  cx="40" cy="40" r="32" fill="none" stroke="#10b981" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - (allTasksTotal > 0 ? allTasksCompleted / allTasksTotal : 0))}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.3s' }}
                />
              </svg>
            </div>
            {/* Projects Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <span style={{ fontSize: '13px', color: '#4a5568', fontWeight: '500' }}>📁 Projects ({goal.stats?.goal_projects?.completed || 0}/{goal.stats?.goal_projects?.total || 0})</span>
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle 
                  cx="40" cy="40" r="32" fill="none" stroke="#3b82f6" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - ((goal.stats?.goal_projects?.total || 0) > 0 ? (goal.stats?.goal_projects?.completed || 0) / (goal.stats?.goal_projects?.total || 0) : 0))}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.3s' }}
                />
              </svg>
            </div>
          </div>

          {/* Right: Dates in one compact box */}
          <div style={{ background: '#f8f9fa', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '12px', marginBottom: '6px' }}>
              <label style={{ display: 'block', color: '#718096', marginBottom: '2px', fontSize: '10px' }}>Start</label>
              <input
                type="date"
                value={goal.start_date || ''}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { e.stopPropagation(); handleUpdateLifeGoal(goal.id, { start_date: e.target.value }); }}
                style={{ padding: '3px 6px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '11px', width: '120px' }}
              />
            </div>
            <div style={{ fontSize: '12px' }}>
              <label style={{ display: 'block', color: '#718096', marginBottom: '2px', fontSize: '10px' }}>Target</label>
              <input
                type="date"
                value={goal.target_date || ''}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { e.stopPropagation(); handleUpdateLifeGoal(goal.id, { target_date: e.target.value }); }}
                style={{ padding: '3px 6px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '11px', width: '120px' }}
              />
            </div>
          </div>
        </div>

        {/* Bottom Row: Stats & Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e5e3d0' }}>
          {/* Left: Quick Stats */}
          <div style={{ display: 'flex', gap: '24px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>📊</span>
              <span style={{ color: '#718096' }}>Progress:</span>
              <span style={{ fontWeight: '600', color: '#2d3748' }}>{goal.progress_percentage?.toFixed(0) || 0}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>📁</span>
              <span style={{ color: '#718096' }}>Projects:</span>
              <span style={{ fontWeight: '600', color: '#2d3748' }}>{goal.stats?.goal_projects?.total || 0}</span>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              className="btn btn-primary"
              onClick={(e) => { e.stopPropagation(); handleViewGoalDetails(goal); }}
              style={{ padding: '8px 14px', fontSize: '13px', minWidth: '100px' }}
            >
              👁️ View
            </button>
            <button 
              className="btn btn-secondary"
              onClick={(e) => { e.stopPropagation(); handleEditGoal(goal); }}
              style={{ padding: '8px 14px', fontSize: '13px', minWidth: '100px' }}
            >
              ✏️ Edit
            </button>
            {goal.status !== 'completed' ? (
              <button 
                className="btn btn-success"
                onClick={async (e) => { 
                  e.stopPropagation(); 
                  try {
                    await api.put(`/api/life-goals/${goal.id}`, { 
                      status: 'completed', 
                      actual_completion_date: new Date().toISOString().split('T')[0] 
                    });
                    await loadLifeGoals();
                  } catch (err) {
                    console.error('Error completing goal:', err);
                    showAlert('Failed to complete goal', 'error');
                  }
                }}
                style={{ padding: '8px 14px', fontSize: '13px', minWidth: '100px', backgroundColor: '#10b981', border: 'none' }}
              >
                ✓ Complete
              </button>
            ) : (
              <button 
                className="btn btn-warning"
                onClick={async (e) => { 
                  e.stopPropagation(); 
                  try {
                    await api.put(`/api/life-goals/${goal.id}`, { 
                      status: 'on_track', 
                      actual_completion_date: null 
                    });
                    await loadLifeGoals();
                  } catch (err) {
                    console.error('Error reopening goal:', err);
                    showAlert('Failed to reopen goal', 'error');
                  }
                }}
                style={{ padding: '8px 14px', fontSize: '13px', minWidth: '100px', backgroundColor: '#f59e0b', border: 'none' }}
              >
                ↻ Reopen
              </button>
            )}
            <button 
              className="btn btn-danger"
              onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }}
              style={{ padding: '8px 14px', fontSize: '13px', minWidth: '100px' }}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container">

      {activeTab === 'wishes' ? (
        /* Wishes Tab - Dream Board */
        <div className="wishes-container" style={{ padding: '20px' }}>
          <div className="wishes-header" style={{ 
            marginBottom: '30px',
            background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ffeaa7 100%)',
            padding: '16px 20px',
            borderRadius: '16px',
            border: '4px solid #f59e0b',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative elements */}
            <div style={{ position: 'absolute', left: '10px', top: '10px', fontSize: '32px', opacity: 0.3 }}>🌸</div>
            <div style={{ position: 'absolute', left: '60px', top: '8px', fontSize: '24px', opacity: 0.25 }}>🌺</div>
            <div style={{ position: 'absolute', right: '10px', top: '12px', fontSize: '28px', opacity: 0.3 }}>🌳</div>
            <div style={{ position: 'absolute', right: '55px', bottom: '10px', fontSize: '26px', opacity: 0.25 }}>🦋</div>
            <div style={{ position: 'absolute', left: '45%', bottom: '8px', fontSize: '20px', opacity: 0.2 }}>🌟</div>
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ 
                fontSize: '32px', 
                marginBottom: '8px',
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f59e0b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: '900',
                textShadow: '2px 2px 4px rgba(168, 85, 247, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '36px' }}>✨</span>
                <span>Your Dream Board</span>
                <span style={{ fontSize: '28px' }}>🌈</span>
                <span style={{ fontSize: '24px' }}>💫</span>
              </h2>
              <p style={{ 
                color: '#7c2d12', 
                fontSize: '15px', 
                fontWeight: '600',
                whiteSpace: 'nowrap',
                marginBottom: 0
              }}>
                🌱 A pressure-free space for your aspirations and dreams. No deadlines, no guilt – just possibilities. 🌠
              </p>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowAddWishModal(true)}
              style={{ 
                padding: '14px 28px', 
                fontSize: '16px',
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                border: '2px solid #9333ea',
                color: 'white',
                fontWeight: '700',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)',
                whiteSpace: 'nowrap'
              }}
            >
              ➕ Add New Wish
            </button>
          </div>

          {wishes.length === 0 ? (
            <div className="empty-state" style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
              borderRadius: '16px',
              border: '3px dashed #ced4da'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>💭</div>
              <h3 style={{ fontSize: '28px', marginBottom: '12px', color: '#495057', fontWeight: '800' }}>
                Your Canvas Awaits
              </h3>
              <p style={{ fontSize: '17px', color: '#6c757d', marginBottom: '24px', maxWidth: '600px', margin: '0 auto 24px', lineHeight: '1.6' }}>
                What would you love to do, have, or become? Travel the world? Learn a new skill? 
                Create something meaningful? This is your space to dream without limits.
              </p>
              <p style={{ fontSize: '15px', color: '#868e96', fontStyle: 'italic', padding: '20px', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', maxWidth: '500px', margin: '0 auto' }}>
                "A goal is a dream with a deadline" – Napoleon Hill
                <br/>
                <span style={{ color: '#a855f7', fontWeight: '600' }}>Start with the dream.</span>
              </p>
            </div>
          ) : (
            <>
              {/* � EXPLORING DREAMS SECTION - Move to top */}
              {wishes.filter(w => w.status === 'exploring').length > 0 && (
                <div style={{ marginBottom: '48px' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
                    padding: '20px',
                    borderRadius: '16px',
                    border: '3px solid #14b8a6',
                    marginBottom: '20px'
                  }}>
                    <h2 style={{
                      fontSize: '26px',
                      fontWeight: '900',
                      marginBottom: '8px',
                      background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      🔬 Exploring Dreams ({wishes.filter(w => w.status === 'exploring').length})
                    </h2>
                    <p style={{ color: '#0f766e', fontSize: '15px', margin: 0, fontWeight: '500' }}>
                      💪 Dreams you're actively researching, planning, and preparing - building your path forward!
                    </p>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', 
                    gap: '28px'
                  }}>
                    {wishes.filter(w => w.status === 'exploring').map((wish) => {
                      const theme = getDreamTheme(wish.id);
                      const stats = wishStats[wish.id] || { projects: 0, tasks: 0, goals: 0 };
                      
                      return (
                        <div key={wish.id} style={{
                          background: 'white',
                          borderRadius: '20px',
                          border: theme.frame + ' ' + theme.border,
                          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
                          e.currentTarget.style.boxShadow = '0 15px 40px rgba(0, 0, 0, 0.25)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0) scale(1)';
                          e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.15)';
                        }}>
                          {/* Header with gradient */}
                          <div style={{
                            background: theme.gradient,
                            padding: '24px',
                            position: 'relative',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setSelectedWish(wish);
                            setShowWishDetailsModal(true);
                          }}>
                            <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                              <div style={{ fontSize: '42px', lineHeight: 1 }}>{theme.symbol}</div>
                              <div style={{ flex: 1 }}>
                                <h3 style={{ 
                                  fontSize: '20px', 
                                  fontWeight: '800', 
                                  color: 'white', 
                                  marginBottom: '8px',
                                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                                }}>
                                  {wish.title}
                                </h3>
                                {wish.created_at && (
                                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                                    📅 Started: {new Date(wish.created_at).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Stats Dashboard */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '1px',
                            background: '#e5e7eb',
                            padding: 0
                          }}>
                            <div style={{ 
                              background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', 
                              padding: '16px', 
                              textAlign: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={() => showToast(`${stats.projects} projects linked to this dream`, 'info')}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)'}>
                              <div style={{ fontSize: '28px', fontWeight: '900', color: '#9333ea', marginBottom: '4px' }}>
                                {stats.projects}
                              </div>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                📁 Projects
                              </div>
                            </div>
                            <div style={{ 
                              background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', 
                              padding: '16px', 
                              textAlign: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={() => showToast(`${stats.tasks} tasks linked to this dream`, 'info')}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'}>
                              <div style={{ fontSize: '28px', fontWeight: '900', color: '#f59e0b', marginBottom: '4px' }}>
                                {stats.tasks}
                              </div>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                ✅ Tasks
                              </div>
                            </div>
                            <div style={{ 
                              background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)', 
                              padding: '16px', 
                              textAlign: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={() => showToast(`${stats.goals} goals promoted from this dream`, 'info')}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)'}>
                              <div style={{ fontSize: '28px', fontWeight: '900', color: '#14b8a6', marginBottom: '4px' }}>
                                {stats.goals}
                              </div>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                🎯 Goals
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ padding: '16px', background: '#f9fafb' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                              <button
                                className="btn btn-sm"
                                style={{
                                  padding: '10px',
                                  fontSize: '13px',
                                  background: theme.gradient,
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '10px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                                }}
                                onClick={() => {
                                  setSelectedWish(wish);
                                  setShowWishDetailsModal(true);
                                }}
                              >
                                👁️ View Details
                              </button>
                              <button
                                className="btn btn-sm"
                                style={{
                                  padding: '10px',
                                  fontSize: '13px',
                                  background: 'white',
                                  color: '#374151',
                                  border: '2px solid #d1d5db',
                                  borderRadius: '10px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                                onClick={() => {
                                  setCurrentExplorationWish(wish);
                                  setShowAddExplorationModal(true);
                                }}
                              >
                                ➕ Add Activity
                              </button>
                            </div>
                            <button
                              className="btn btn-sm"
                              style={{
                                width: '100%',
                                padding: '8px',
                                fontSize: '12px',
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                                border: '1px solid #fde68a',
                                borderRadius: '8px',
                                fontWeight: '600'
                              }}
                              onClick={async () => {
                                if (confirm('Move back to Active Dreams (Dreaming status)?')) {
                                  await handleUpdateWishStatus(wish.id, 'dreaming');
                                  showToast('↶ Moved back to active dreams', 'info');
                                }
                              }}
                            >
                              ↶ Back to Active Dreams
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 💭 ACTIVE DREAMS SECTION - Only Dreaming Status */}
              {wishes.filter(w => w.status === 'dreaming').length > 0 && (
                <div style={{ marginBottom: '48px' }}>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: '800',
                    marginBottom: '20px',
                    background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    💭 Active Dreams ({wishes.filter(w => w.status === 'dreaming').length})
                  </h2>
                  <div className="wishes-grid" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', 
                    gap: '28px'
                  }}>
                    {wishes.filter(w => w.status === 'dreaming').map((wish) => {
                const theme = getDreamTheme(wish.id);
                const stats = wishStats[wish.id] || { projects: 0, tasks: 0, goals: 0 };
                
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
                
                // Enhanced Status styling with lifecycle colors
                const statusColors: Record<string, { bg: string, text: string, icon: string, border: string }> = {
                  dreaming: { bg: 'linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 100%)', text: '#7c3aed', icon: '💭', border: '#c084fc' },
                  exploring: { bg: 'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%)', text: '#0d9488', icon: '🔍', border: '#14b8a6' },
                  ready: { bg: 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)', text: '#c2410c', icon: '🔥', border: '#f97316' },
                  moved_to_goal: { bg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', text: '#1e40af', icon: '🚀', border: '#2563eb' },
                  achieved: { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', text: '#92400e', icon: '✨', border: '#eab308' },
                  released: { bg: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', text: '#6b7280', icon: '🕊️', border: '#9ca3af' },
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
                      boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
                      transition: 'all 0.35s ease',
                      border: `${theme.frame} ${theme.border}`,
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 16px 32px rgba(0,0,0,0.18)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
                    }}
                  >
                    {/* Gradient Header with Symbol */}
                    <div style={{
                      background: `linear-gradient(135deg, ${theme.gradient.split('-')[0]} 0%, ${theme.gradient.split('-')[1]} 100%)`,
                      padding: '28px 24px',
                      color: 'white',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      borderBottom: `3px solid ${theme.border}`
                    }}>
                      {/* Dream Symbol */}
                      <div style={{ 
                        fontSize: '42px', 
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                        flexShrink: 0
                      }}>
                        {theme.symbol}
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <h3 style={{ 
                          margin: '0 0 6px 0', 
                          fontSize: '22px', 
                          fontWeight: '800',
                          textShadow: '0 2px 6px rgba(0,0,0,0.25)',
                          letterSpacing: '0.3px'
                        }}>
                          {wish.title}
                        </h3>
                        
                        {wish.created_at && (
                          <div style={{ 
                            fontSize: '13px', 
                            opacity: 0.95,
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <span>📅</span>
                            <span>Started: {new Date(wish.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        )}
                      </div>

                      {/* Priority Badge */}
                      {wish.priority === 'burning_desire' && (
                        <div style={{
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          fontSize: '28px',
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                          animation: 'pulse 2s infinite'
                        }}>
                          🔥
                        </div>
                      )}
                    </div>

                    {/* Stats Dashboard */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '16px',
                      padding: '24px',
                      backgroundColor: '#f9fafb',
                      borderBottom: '2px solid #e5e7eb'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          fontSize: '28px', 
                          fontWeight: '900', 
                          color: '#9333ea',
                          marginBottom: '4px'
                        }}>
                          {stats.projects}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' }}>
                          � Projects
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          fontSize: '28px', 
                          fontWeight: '900', 
                          color: '#f97316',
                          marginBottom: '4px'
                        }}>
                          {stats.tasks}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' }}>
                          ✅ Tasks
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          fontSize: '28px', 
                          fontWeight: '900', 
                          color: '#14b8a6',
                          marginBottom: '4px'
                        }}>
                          {stats.goals}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' }}>
                          🎯 Goals
                        </div>
                      </div>
                    </div>

                    {/* Content Area */}
                    <div style={{ padding: '24px' }}>
                      {/* Description */}
                      {wish.description && (
                        <p style={{ 
                          margin: '0 0 16px 0', 
                          fontSize: '14px', 
                          color: '#4b5563',
                          lineHeight: '1.7',
                          fontWeight: '500'
                        }}>
                          {wish.description.length > 100 
                            ? wish.description.substring(0, 100) + '...' 
                            : wish.description}
                        </p>
                      )}

                      {/* Why it matters */}
                      {wish.why_important && (
                        <div style={{
                          backgroundColor: '#fef5e7',
                          padding: '12px 14px',
                          borderRadius: '10px',
                          marginBottom: '16px',
                          borderLeft: '4px solid #f59e0b',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                          <div style={{ fontSize: '11px', color: '#92400e', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase' }}>
                            💫 Why This Matters
                          </div>
                          <p style={{ 
                            margin: 0, 
                            fontSize: '13px', 
                            color: '#78350f',
                            lineHeight: '1.5',
                            fontWeight: '500'
                          }}>
                            {wish.why_important.length > 100 
                              ? wish.why_important.substring(0, 100) + '...' 
                              : wish.why_important}
                          </p>
                        </div>
                      )}

                      {/* Status & Category */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '800',
                          background: statusStyle.bg,
                          color: statusStyle.text,
                          textTransform: 'uppercase',
                          border: `2px solid ${statusStyle.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                          letterSpacing: '0.5px'
                        }}>
                          <span>{statusStyle.icon}</span>
                          {wish.status.replace('_', ' ')}
                        </span>
                        
                        {wish.category && (
                          <span style={{ 
                            fontSize: '13px', 
                            color: '#6b7280',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <span>
                              {wish.category === 'travel' && '🌍'} 
                              {wish.category === 'goals' && '🎯'}
                              {wish.category === 'financial' && '💰'}
                              {wish.category === 'personal' && '🌱'}
                              {wish.category === 'career' && '💼'}
                              {wish.category === 'health' && '💪'}
                              {wish.category === 'relationship' && '❤️'}
                              {wish.category === 'learning' && '📚'}
                              {wish.category === 'lifestyle' && '🏡'}
                            </span>
                            {wish.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ 
                      padding: '20px 24px 24px', 
                      backgroundColor: '#f9fafb',
                      borderTop: '2px solid #e5e7eb',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      {/* Promote to Goal (for ready status) */}
                      {wish.status === 'ready' && (
                        <button 
                          className="btn btn-sm"
                          style={{
                            width: '100%',
                            padding: '14px',
                            fontSize: '14px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            border: '2px solid #1e40af',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontWeight: '800',
                            boxShadow: '0 4px 10px rgba(37, 99, 235, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            transition: 'all 0.2s ease'
                          }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`🚀 Ready to make "${wish.title}" a committed Life Goal?`)) {
                              try {
                                await api.post(`/api/wishes/${wish.id}/promote-to-goal`);
                                showToast('✨ Dream promoted to Life Goal! Time to make it happen!', 'success');
                                await loadWishes();
                                await loadLifeGoals();
                              } catch (err) {
                                console.error('Error promoting dream:', err);
                                showToast('Failed to promote dream to goal', 'error');
                              }
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.45)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 10px rgba(37, 99, 235, 0.35)';
                          }}
                        >
                          🚀 Promote to Goal
                        </button>
                      )}

                      {/* Main Actions */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          className="btn btn-sm"
                          style={{
                            flex: 1,
                            padding: '12px',
                            fontSize: '13px',
                            background: `linear-gradient(135deg, ${theme.gradient.split('-')[0]} 0%, ${theme.gradient.split('-')[1]} 100%)`,
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWish(wish);
                            setShowWishDetailsModal(true);
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.15)';
                          }}
                        >
                          👁️ View Details
                        </button>
                        
                        <button 
                          className="btn btn-sm"
                          style={{
                            flex: 1,
                            padding: '12px',
                            fontSize: '13px',
                            backgroundColor: 'white',
                            color: '#4b5563',
                            border: '2px solid #d1d5db',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const text = prompt("What are your thoughts about this dream?");
                            if (text) {
                              try {
                                await api.post(`/api/wishes/${wish.id}/reflections`, {
                                  reflection_text: text,
                                  mood: 'inspired'
                                });
                                await loadWishes();
                                showToast('✨ Reflection added!', 'success');
                              } catch (err) {
                                console.error('Error adding reflection:', err);
                                showToast('Failed to add reflection', 'error');
                              }
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.borderColor = '#9ca3af';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.borderColor = '#d1d5db';
                          }}
                        >
                          ✍️ Add Reflection
                        </button>
                      </div>

                      {/* Status Progression */}
                      {wish.status === 'dreaming' && (
                        <button
                          className="btn btn-sm"
                          style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '13px',
                            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                            color: '#92400e',
                            border: '2px solid #fcd34d',
                            borderRadius: '10px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateWishStatus(wish.id, 'exploring');
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          � Start Exploring
                        </button>
                      )}
                    </div>
                  </div>
                );
                    })}
                  </div>
                </div>
              )}

              {/* DUPLICATE SECTION REMOVED - Exploring Dreams is shown at the top now */}
              {false && wishes.filter(w => w.status === 'exploring').length > 0 && (
                <div style={{ marginBottom: '48px' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
                    padding: '20px',
                    borderRadius: '16px',
                    border: '3px solid #14b8a6',
                    marginBottom: '20px'
                  }}>
                    <h2 style={{
                      fontSize: '24px',
                      fontWeight: '800',
                      marginBottom: '8px',
                      background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      🔬 Exploration Zone ({wishes.filter(w => w.status === 'exploring').length})
                    </h2>
                    <p style={{ color: '#0f766e', fontSize: '15px', margin: 0, fontWeight: '500' }}>
                      🌱 Dreams you're actively researching and exploring - no pressure, just curiosity!
                    </p>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
                    gap: '24px'
                  }}>
                    {wishes.filter(w => w.status === 'exploring').map((wish) => (
                      <div key={wish.id} style={{
                        background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
                        padding: '24px',
                        borderRadius: '16px',
                        border: '3px solid #14b8a6',
                        boxShadow: '0 8px 16px rgba(20, 184, 166, 0.2)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                      onClick={() => {
                        setSelectedWish(wish);
                        setShowWishDetailsModal(true);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(20, 184, 166, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 8px 16px rgba(20, 184, 166, 0.2)';
                      }}
                      >
                        <div style={{ marginBottom: '16px' }}>
                          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#0f766e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🔍 {wish.title}
                          </h3>
                          {wish.description && (
                            <p style={{ fontSize: '14px', color: '#0d9488', marginBottom: '12px', lineHeight: '1.5' }}>
                              {wish.description}
                            </p>
                          )}
                        </div>

                        {/* Exploration Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn btn-sm"
                            style={{
                              width: '100%',
                              padding: '10px',
                              fontSize: '14px',
                              background: 'white',
                              color: '#0f766e',
                              border: '2px solid #14b8a6',
                              borderRadius: '10px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px'
                            }}
                            onClick={() => {
                              setCurrentExplorationWish(wish);
                              setShowAddExplorationModal(true);
                            }}
                          >
                            📝 Add Exploration Step
                          </button>
                          
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn btn-sm"
                              style={{
                                flex: 1,
                                padding: '8px',
                                fontSize: '13px',
                                backgroundColor: '#d1fae5',
                                color: '#065f46',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                setSelectedWish(wish);
                                setShowWishDetailsModal(true);
                              }}
                            >
                              📋 View Steps
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{
                                flex: 1,
                                padding: '8px',
                                fontSize: '13px',
                                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleUpdateWishStatus(wish.id, 'ready')}
                            >
                              🔥 I'm Ready!
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* �🚀 DREAMS BECOMING REAL SECTION */}
              {wishes.filter(w => w.status === 'moved_to_goal').length > 0 && (
                <div style={{ marginBottom: '48px' }}>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: '800',
                    marginBottom: '20px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    🚀 Dreams Becoming Real ({wishes.filter(w => w.status === 'moved_to_goal').length})
                  </h2>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
                    gap: '24px'
                  }}>
                    {wishes.filter(w => w.status === 'moved_to_goal').map((wish) => (
                      <div key={wish.id} style={{
                        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                        padding: '24px',
                        borderRadius: '16px',
                        border: '3px solid #2563eb',
                        boxShadow: '0 8px 16px rgba(37, 99, 235, 0.2)'
                      }}>
                        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1e40af', marginBottom: '12px' }}>
                          {wish.title}
                        </h3>
                        <p style={{ fontSize: '14px', color: '#1e3a8a', marginBottom: '16px' }}>
                          This dream is now a committed Life Goal! 🎯
                        </p>
                        <button
                          style={{
                            width: '100%',
                            padding: '12px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            // Navigate to goal detail
                            setActiveTab('goals');
                            navigate('/goals');
                          }}
                        >
                          View Life Goal →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ✨ MANIFESTED DREAMS SECTION - Dreams Come True! */}
              {wishes.filter(w => w.status === 'achieved').length > 0 && (
                <div style={{ marginBottom: '48px' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    padding: '20px',
                    borderRadius: '16px',
                    border: '4px solid #eab308',
                    marginBottom: '20px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Celebratory decorations */}
                    <div style={{ position: 'absolute', left: '15px', top: '10px', fontSize: '32px', opacity: 0.3 }}>🎉</div>
                    <div style={{ position: 'absolute', right: '15px', top: '10px', fontSize: '32px', opacity: 0.3 }}>🏆</div>
                    <div style={{ position: 'absolute', left: '60px', bottom: '10px', fontSize: '28px', opacity: 0.25 }}>⭐</div>
                    <div style={{ position: 'absolute', right: '60px', bottom: '10px', fontSize: '28px', opacity: 0.25 }}>💫</div>
                    
                    <h2 style={{
                      fontSize: '28px',
                      fontWeight: '900',
                      marginBottom: '8px',
                      background: 'linear-gradient(135deg, #eab308 0%, #f59e0b 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                      position: 'relative',
                      zIndex: 1
                    }}>
                      <span style={{ fontSize: '36px' }}>✨</span>
                      <span>Dreams Come True</span>
                      <span style={{ fontSize: '36px' }}>🌟</span>
                    </h2>
                    <p style={{ 
                      textAlign: 'center', 
                      color: '#92400e', 
                      fontSize: '15px', 
                      fontWeight: '600',
                      margin: 0,
                      position: 'relative',
                      zIndex: 1
                    }}>
                      🎊 Celebrating {wishes.filter(w => w.status === 'achieved').length} manifested dream{wishes.filter(w => w.status === 'achieved').length !== 1 ? 's' : ''}! You did it! 🎊
                    </p>
                  </div>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
                    gap: '24px'
                  }}>
                    {wishes.filter(w => w.status === 'achieved').map((wish) => (
                      <div key={wish.id} style={{
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        padding: '24px',
                        borderRadius: '16px',
                        border: '3px solid #eab308',
                        boxShadow: '0 8px 16px rgba(234, 179, 8, 0.3)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '48px', opacity: 0.3 }}>
                          🎉
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#92400e', marginBottom: '8px' }}>
                          {wish.title}
                        </h3>
                        <div style={{ fontSize: '13px', color: '#78350f', fontStyle: 'italic', marginBottom: '12px' }}>
                          Dream manifested! ✨
                        </div>
                        {wish.achievement_notes && (
                          <p style={{ fontSize: '14px', color: '#92400e', lineHeight: '1.6', marginBottom: '16px' }}>
                            {wish.achievement_notes}
                          </p>
                        )}
                        {wish.achieved_at && (
                          <div style={{ fontSize: '12px', color: '#a16207', marginBottom: '12px' }}>
                            📅 Achieved on: {new Date(wish.achieved_at).toLocaleDateString()}
                          </div>
                        )}
                        {/* Undo Button */}
                        <button
                          className="btn btn-sm"
                          style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '13px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            border: '2px solid #eab308',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm('Move this dream back to active status?')) {
                              try {
                                await api.put(`/api/wishes/${wish.id}`, { status: 'dreaming' });
                                showToast('Dream moved back to active dreams', 'info');
                                await loadWishes();
                              } catch (err) {
                                showToast('Failed to update dream', 'error');
                              }
                            }
                          }}
                        >
                          ↶ Move Back to Active
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 🕊️ RELEASED DREAMS SECTION (Collapsible) */}
              {wishes.filter(w => w.status === 'released').length > 0 && (
                <div style={{ marginBottom: '48px' }}>
                  <details>
                    <summary style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#6b7280',
                      cursor: 'pointer',
                      padding: '16px',
                      background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                      borderRadius: '12px',
                      border: '2px solid #d1d5db',
                      marginBottom: '20px',
                      listStyle: 'none'
                    }}>
                      🕊️ Released Dreams ({wishes.filter(w => w.status === 'released').length}) - Released with gratitude
                    </summary>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
                      gap: '24px',
                      opacity: 0.8
                    }}>
                      {wishes.filter(w => w.status === 'released').map((wish) => (
                        <div key={wish.id} style={{
                          background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                          padding: '24px',
                          borderRadius: '16px',
                          border: '2px solid #d1d5db'
                        }}>
                          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
                            {wish.title}
                          </h3>
                          <div style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic', marginBottom: '8px' }}>
                            Released peacefully
                          </div>
                          {wish.release_reason && (
                            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                              {wish.release_reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Goals Tab - Committed Goals */
        <div className="goals-container" style={{
          padding: '24px',
          maxWidth: '1600px',
          margin: '0 auto'
        }}>
        {!selectedGoal ? (
          /* Goals List View */
          <>
            {/* Compact Header with Inline Stats */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px',
              color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>
                  🎯 Life Goals
                </h1>
                <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                  <span style={{ 
                    background: 'rgba(255,255,255,0.2)', 
                    padding: '4px 12px', 
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    Total: {lifeGoals.length}
                  </span>
                  <span style={{ 
                    background: 'rgba(16, 185, 129, 0.3)', 
                    padding: '4px 12px', 
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    On Track: {lifeGoals.filter(g => g.status === 'on_track').length}
                  </span>
                  <span style={{ 
                    background: 'rgba(245, 158, 11, 0.3)', 
                    padding: '4px 12px', 
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    At Risk: {lifeGoals.filter(g => g.status === 'at_risk').length}
                  </span>
                  <span style={{ 
                    background: 'rgba(239, 68, 68, 0.3)', 
                    padding: '4px 12px', 
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    Behind: {lifeGoals.filter(g => g.status === 'behind').length}
                  </span>
                  <span style={{ 
                    background: 'rgba(168, 85, 247, 0.3)', 
                    padding: '4px 12px', 
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    Not Started: {lifeGoals.filter(g => g.status === 'not_started').length}
                  </span>
                  <span style={{ 
                    background: 'rgba(34, 197, 94, 0.3)', 
                    padding: '4px 12px', 
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    Completed: {lifeGoals.filter(g => g.status === 'completed').length}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setActiveTab('wishes');
                    navigate('/goals?tab=wishes');
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    border: '2px solid #d97706',
                    color: '#dc2626',
                    fontWeight: '700',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '15px'
                  }}
                >
                  ✨ Dream Board
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    setEditingGoal(null);
                    setShowAddGoalModal(true);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.25)',
                    border: '2px solid rgba(255,255,255,0.4)',
                    color: 'white',
                    fontWeight: '700',
                    padding: '10px 20px',
                    borderRadius: '8px'
                  }}
                >
                  ➕ Add Life Goal
                </button>
              </div>
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
                  onClick={() => {
                    setEditingGoal(null);
                    setShowAddGoalModal(true);
                  }}
                  style={{ marginTop: '20px' }}
                >
                  Create Your First Goal
                </button>
              </div>
            ) : (
              <>
                {/* Summary Panel - Goal counts by category */}
                {(() => {
                  // Define hierarchy order (same as Projects and Daily tabs)
                  const hierarchyOrder: { [key: string]: number } = {
                    'Hard Work|Office-Tasks': 1,
                    'Hard Work|Learning': 2,
                    'Hard Work|Confidence': 3,
                    'Calmness|Yoga': 4,
                    'Calmness|Sleep': 5,
                    'Family|My Tasks': 6,
                    'Family|Home Tasks': 7,
                    'Family|Time Waste': 8
                  };

                  // Group goals by category (pillar_id + category_id)
                  const goalsByCategory: { [key: string]: LifeGoalData[] } = {};
                  const activeGoals = lifeGoals.filter(g => !g.parent_goal_id && g.status !== 'completed');
                  
                  activeGoals.forEach(goal => {
                    if (goal.pillar_id && goal.category_id) {
                      const pillar = goalPillars.find(p => p.id === goal.pillar_id);
                      const category = goalCategories.find(c => c.id === goal.category_id);
                      if (pillar && category) {
                        const key = `${pillar.name}|${category.name}`;
                        if (!goalsByCategory[key]) {
                          goalsByCategory[key] = [];
                        }
                        goalsByCategory[key].push(goal);
                      }
                    }
                  });

                  // Sort categories by hierarchy
                  const sortedCategories = Object.keys(goalsByCategory).sort((a, b) => {
                    const orderA = hierarchyOrder[a] || 999;
                    const orderB = hierarchyOrder[b] || 999;
                    return orderA - orderB;
                  });

                  return (
                    <div style={{ 
                      marginBottom: '24px',
                      padding: '16px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                      <div style={{ 
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        {sortedCategories.map(categoryKey => {
                          const goals = goalsByCategory[categoryKey];
                          const [pillarName, categoryName] = categoryKey.split('|');
                          
                          // Get pillar emoji
                          const pillarEmojis: { [key: string]: string } = {
                            'Hard Work': '💼',
                            'Calmness': '🧘',
                            'Family': '👨‍👩‍👦'
                          };
                          const emoji = pillarEmojis[pillarName] || '🎯';

                          return (
                            <div 
                              key={categoryKey}
                              style={{
                                padding: '10px 16px',
                                backgroundColor: 'rgba(255,255,255,0.95)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                              }}
                              title={`${pillarName} - ${categoryName}`}
                            >
                              <span style={{ fontSize: '18px' }}>{emoji}</span>
                              <div>
                                <div style={{ 
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: '#2d3748'
                                }}>
                                  {categoryName}
                                </div>
                                <div style={{ 
                                  fontSize: '12px',
                                  color: '#666'
                                }}>
                                  {goals.length} goal{goals.length !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div 
                          style={{
                            padding: '10px 16px',
                            backgroundColor: 'rgba(255,255,255,0.95)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            border: '2px solid #48bb78'
                          }}
                        >
                          <span style={{ fontSize: '18px' }}>🎯</span>
                          <div>
                            <div style={{ 
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#2d3748'
                            }}>
                              Total Goals
                            </div>
                            <div style={{ 
                              fontSize: '20px',
                              fontWeight: '700',
                              color: '#48bb78'
                            }}>
                              {lifeGoals.filter(g => !g.parent_goal_id).length}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Goal Sections - Category-based (matching Projects tab) */}
                {(() => {
                  // Define hierarchy order (same as Projects and Daily tabs)
                  const hierarchyOrder: { [key: string]: number } = {
                    'Hard Work|Office-Tasks': 1,
                    'Hard Work|Learning': 2,
                    'Hard Work|Confidence': 3,
                    'Calmness|Yoga': 4,
                    'Calmness|Sleep': 5,
                    'Family|My Tasks': 6,
                    'Family|Home Tasks': 7,
                    'Family|Time Waste': 8
                  };

                  // Group active goals by category
                  const goalsByCategory: { [key: string]: LifeGoalData[] } = {};
                  const activeGoals = lifeGoals.filter(g => !g.parent_goal_id && g.status !== 'completed');
                  
                  activeGoals.forEach(goal => {
                    if (goal.pillar_id && goal.category_id) {
                      const pillar = goalPillars.find(p => p.id === goal.pillar_id);
                      const category = goalCategories.find(c => c.id === goal.category_id);
                      if (pillar && category) {
                        const key = `${pillar.name}|${category.name}`;
                        if (!goalsByCategory[key]) {
                          goalsByCategory[key] = [];
                        }
                        goalsByCategory[key].push(goal);
                      }
                    }
                  });

                  // Goals without category organization (Goal and Dream Goals)
                  const uncategorizedGoals = activeGoals.filter(g => !g.pillar_id || !g.category_id);

                  // Sort categories by hierarchy
                  const sortedCategories = Object.keys(goalsByCategory).sort((a, b) => {
                    const orderA = hierarchyOrder[a] || 999;
                    const orderB = hierarchyOrder[b] || 999;
                    return orderA - orderB;
                  });

                  return (
                    <>
                      {/* Category Sections */}
                      {sortedCategories.map(categoryKey => {
                        const categoryGoals = goalsByCategory[categoryKey];
                        const [pillarName, categoryName] = categoryKey.split('|');
                        const isCollapsed = collapsedGoalCategories[categoryKey] !== false; // Default collapsed

                        return (
                          <div key={categoryKey} style={{ marginBottom: '32px' }}>
                            <h3 
                              onClick={() => {
                                const newState = { ...collapsedGoalCategories, [categoryKey]: !isCollapsed };
                                setCollapsedGoalCategories(newState);
                                localStorage.setItem('collapsedGoalSections', JSON.stringify(newState));
                              }}
                              style={{
                                fontSize: '18px',
                                fontWeight: '700',
                                color: '#2d3748',
                                marginBottom: '16px',
                                padding: '12px 16px',
                                background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)',
                                borderRadius: '8px',
                                border: '2px solid #e2e8f0',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                              title={`${pillarName} - ${categoryName}`}
                            >
                              <span>{pillarName === 'Hard Work' ? '💼' : pillarName === 'Calmness' ? '🧘' : '👨‍👩‍👦'} {categoryName} ({categoryGoals.length})</span>
                              <span>{isCollapsed ? '▶' : '▼'}</span>
                            </h3>
                            {!isCollapsed && (
                              <div className="goals-grid">
                                {categoryGoals.map((goal, index) => renderGoalCard(goal, index))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Uncategorized Goals (Goal and Dream Goals) */}
                      {uncategorizedGoals.length > 0 && (
                        <div style={{ marginBottom: '32px' }}>
                          <h3 
                            onClick={() => {
                              const newState = { ...collapsedGoalCategories, 'uncategorized': !collapsedGoalCategories['uncategorized'] };
                              setCollapsedGoalCategories(newState);
                              localStorage.setItem('collapsedGoalSections', JSON.stringify(newState));
                            }}
                            style={{
                              fontSize: '18px',
                              fontWeight: '700',
                              color: '#7c3aed',
                              marginBottom: '16px',
                              padding: '12px 16px',
                              background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                              borderRadius: '8px',
                              border: '2px solid #a78bfa',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <span>🌟 Goal and Dream Goals ({uncategorizedGoals.length})</span>
                            <span>{collapsedGoalCategories['uncategorized'] !== false ? '▶' : '▼'}</span>
                          </h3>
                          {collapsedGoalCategories['uncategorized'] === false && (
                            <div className="goals-grid">
                              {uncategorizedGoals.map((goal, index) => renderGoalCard(goal, index))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* 🏆 Completed Section - Achieved */}
                {lifeGoals.filter(g => !g.parent_goal_id && g.status === 'completed').length > 0 && (
                  <div style={{ marginBottom: '32px' }}>
                    <h3 
                      onClick={() => {
                        const newState = { ...collapsedGoalCategories, 'completed': !collapsedGoalCategories['completed'] };
                        setCollapsedGoalCategories(newState);
                        localStorage.setItem('collapsedGoalSections', JSON.stringify(newState));
                      }}
                      style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#059669',
                        marginBottom: '16px',
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                        borderRadius: '8px',
                        border: '2px solid #10b981',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                      <span>🏆 Goals: Completed ({lifeGoals.filter(g => !g.parent_goal_id && g.status === 'completed').length})</span>
                      <span>{collapsedGoalCategories['completed'] ? '▶' : '▼'}</span>
                    </h3>
                    {!collapsedGoalCategories['completed'] && (
                      <div className="goals-grid">
                        {lifeGoals.filter(goal => !goal.parent_goal_id && goal.status === 'completed').map((goal, index) => renderGoalCard(goal, index))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* Goal Detail View - Full Page */
          <div className="goal-detail-page" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
            borderRadius: '16px',
            padding: '24px',
            border: '4px solid #5a67d8'
          }}>
            <div className="goal-detail-header" style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '24px',
              border: '2px solid #3b82f6'
            }}>
              <button
                className="btn btn-secondary"
                onClick={handleBackToGoals}
                style={{
                  background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                  color: 'white',
                  border: '2px solid #6b7280',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  marginBottom: '16px'
                }}
              >
                ← Back to All Goals
              </button>
              
              {/* Goal Name, Dates, and Progress in one row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '16px' }}>
                {/* Goal Name */}
                <div style={{ flex: 1 }}>
                  <h2 style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: 0 }}>{selectedGoal.name}</h2>
                </div>
                
                {/* Dates - editable */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>Start Date</div>
                    <input
                      type="date"
                      value={selectedGoal.start_date || ''}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleUpdateGoal(selectedGoal.id, { start_date: e.target.value });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        background: 'rgba(255,255,255,0.15)',
                        color: 'white'
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>Target Date</div>
                    <input
                      type="date"
                      value={selectedGoal.target_date || ''}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleUpdateGoal(selectedGoal.id, { target_date: e.target.value });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        background: 'rgba(255,255,255,0.15)',
                        color: 'white'
                      }}
                    />
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div style={{ minWidth: '200px' }}>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px', textAlign: 'center' }}>
                    Progress: {selectedGoal.progress_percentage?.toFixed(0) || 0}%
                  </div>
                  <div style={{
                    height: '20px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '2px solid rgba(255,255,255,0.2)'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${selectedGoal.progress_percentage || 0}%`,
                      background: selectedGoal.status === 'on_track' || selectedGoal.status === 'completed' ? 
                        'linear-gradient(90deg, #10b981, #059669)' :
                        selectedGoal.status === 'at_risk' ? 'linear-gradient(90deg, #f59e0b, #d97706)' :
                        selectedGoal.status === 'behind' ? 'linear-gradient(90deg, #ef4444, #dc2626)' :
                        'linear-gradient(90deg, #60a5fa, #3b82f6)',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>
              </div>
              
              {/* Status badges row */}
              <div className="goal-header-meta" style={{ display: 'flex', gap: '12px' }}>
                <span className={`status-badge status-${selectedGoal.status}`} style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '13px',
                  background: selectedGoal.status === 'on_track' || selectedGoal.status === 'completed' ? '#047857' :
                             selectedGoal.status === 'in_progress' ? '#1e40af' : '#4b5563',
                  color: 'white'
                }}>
                  {selectedGoal.status.replace('_', ' ').toUpperCase()}
                </span>
                {selectedGoal.category && (
                  <span className="category-badge" style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '13px',
                    background: '#7c3aed',
                    color: 'white'
                  }}>
                    {typeof selectedGoal.category === 'string' ? selectedGoal.category : (selectedGoal.category as any).name}
                  </span>
                )}
                {selectedGoal.priority && (
                  <span className={`priority-badge priority-${selectedGoal.priority}`} style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '13px',
                    background: selectedGoal.priority === 'high' ? '#dc2626' : 
                               selectedGoal.priority === 'medium' ? '#ea580c' : '#65a30d',
                    color: 'white'
                  }}>
                    {selectedGoal.priority.toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div className="goal-detail-body">
              {/* Goal-Specific Tasks - Moved to top for priority */}
              <div className="goal-section tasks-section" style={{
                background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                padding: '20px',
                borderRadius: '12px',
                border: '3px solid #0ea5e9',
                marginBottom: '20px'
              }}>
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', cursor: 'pointer' }} onClick={() => toggleSection('goal-tasks')}>
                  <h3 style={{ color: '#075985', fontWeight: 'bold', fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{collapsedSections['goal-tasks'] ? '▶' : '▼'}</span>
                    ✅ Goal Tasks ({goalTasks.length})
                  </h3>
                  <button
                    className="btn btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddGoalTaskModal(true);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: 'white',
                      border: '2px solid #075985',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: '600'
                    }}
                  >
                    ➕ Add Task
                  </button>
                </div>
                {!collapsedSections['goal-tasks'] && (
                  <>
                    {goalTasks.length === 0 ? (
                      <div className="empty-section">
                        <p>No goal-specific tasks. Add tasks that belong uniquely to this goal!</p>
                      </div>
                    ) : (
                      <div className="goal-tasks-tree" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {goalTasks.filter(t => !t.parent_task_id).map(task => (
                      <GoalTaskNode
                        key={task.id}
                        task={task}
                        allTasks={goalTasks}
                        onToggleComplete={(taskId, currentStatus) => {
                          // Check for incomplete subtasks before marking complete
                          if (!currentStatus) {
                            const hasIncompleteSubtasks = goalTasks.some(t => 
                              t.parent_task_id === taskId && !t.is_completed
                            );
                            if (hasIncompleteSubtasks) {
                              showAlert('Cannot mark this task as done because it has incomplete subtasks. Please complete all subtasks first.', 'warning');
                              return;
                            }
                          }
                          handleUpdateGoalTask(taskId, { is_completed: !currentStatus });
                        }}
                        onDelete={async (taskId) => {
                          // Check for incomplete subtasks before deleting
                          const hasIncompleteSubtasks = goalTasks.some(t => 
                            t.parent_task_id === taskId && !t.is_completed
                          );
                          if (hasIncompleteSubtasks) {
                            showAlert('Cannot delete this task because it has incomplete subtasks. Please complete or delete all subtasks first.', 'warning');
                            return;
                          }
                          if (window.confirm('Are you sure you want to delete this task and all its subtasks?')) {
                            await handleDeleteGoalTask(taskId);
                          }
                        }}
                        onAddSubtask={(parentTask) => {
                          setEditingGoalTask(parentTask);
                          setShowAddGoalTaskModal(true);
                        }}
                        onEdit={(task) => {
                          setEditingGoalTask(task);
                          setShowAddGoalTaskModal(true);
                        }}
                      />
                    ))}
                  </div>
                    )}
                  </>
                )}
              </div>

              {/* Linked Tasks (Misc/Important Tasks) */}
              <div className="goal-section linked-section" style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                padding: '20px',
                borderRadius: '12px',
                border: '3px solid #f59e0b',
                marginBottom: '20px'
              }}>
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', cursor: 'pointer' }} onClick={(e) => {
                  if (!(e.target as HTMLElement).closest('button')) {
                    toggleSection('linked-tasks');
                  }
                }}>
                  <h3 style={{ color: '#92400e', fontWeight: 'bold', fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{collapsedSections['linked-tasks'] ? '▶' : '▼'}</span>
                    📋 Linked Tasks (Important Tasks)
                  </h3>
                  <button
                    className="btn btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLinkTaskModal(true);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: 'white',
                      border: '2px solid #92400e',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: '600'
                    }}
                  >
                    🔗 Link Task
                  </button>
                </div>

                {!collapsedSections['linked-tasks'] && (
                  <>
                {linkedTasks.length === 0 ? (
                  <div className="empty-section">
                    <p>No linked tasks. Connect existing Important Tasks to this goal!</p>
                  </div>
                ) : (
                  <div>
                    {linkedTasks.map((link: any) => (
                      <div key={link.id} style={{
                        padding: '12px',
                        marginBottom: '8px',
                        background: 'white',
                        borderRadius: '8px',
                        borderLeft: '4px solid #f59e0b',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onClick={() => handleNavigateToTask(link.task_type)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '16px' }}>📌</span>
                            <span style={{ fontWeight: '600', color: '#1f2937', fontSize: '15px' }}>
                              {link.task?.name || 'Task'}
                            </span>
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: '#fef3c7',
                              color: '#92400e',
                              fontWeight: '600'
                            }}>
                              {link.task_type === 'one_time' ? 'Important Task' : link.task_type}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginLeft: '24px' }}>
                            {link.completion_count}/{link.expected_count} completed ({link.completion_percentage?.toFixed(0) || 0}%)
                            {link.link_start_date && (
                              <> • Started: {new Date(link.link_start_date).toLocaleDateString()}</>
                            )}
                            {link.last_completed && (
                              <> • Last: {new Date(link.last_completed).toLocaleDateString()}</>
                            )}
                          </div>
                          {link.notes && (
                            <div style={{ fontSize: '12px', color: '#78716c', fontStyle: 'italic', marginLeft: '24px', marginTop: '4px' }}>
                              💭 {link.notes}
                            </div>
                          )}
                        </div>
                        <button
                          className="btn btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnlinkTask(link.id);
                          }}
                          style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #fca5a5',
                            borderRadius: '6px',
                            fontWeight: '600'
                          }}
                        >
                          Unlink
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                  </>
                )}
              </div>

              {/* Supporting Tasks by Frequency */}
              <div className="goal-section supporting-tasks-section" style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                padding: '20px',
                borderRadius: '12px',
                border: '3px solid #10b981',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', cursor: 'pointer' }} onClick={() => toggleSection('supporting-tasks')}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ color: '#065f46', fontWeight: 'bold', fontSize: '18px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{collapsedSections['supporting-tasks'] ? '▶' : '▼'}</span>
                      📅 Supporting Tasks by Frequency
                    </h3>
                    <div style={{ fontSize: '12px', color: '#059669', fontStyle: 'italic', marginBottom: '12px' }}>
                      Tasks created with Goal link - organized by frequency (Daily, Weekly, etc.)
                    </div>
                  </div>
                </div>

                {!collapsedSections['supporting-tasks'] && (
                  <>
                {linkedTasks.length === 0 ? (
                  <div className="empty-section">
                    <p>No supporting tasks yet. Create tasks and select this goal to track your daily/weekly/monthly efforts!</p>
                  </div>
                ) : (
                  <div>
                    {(() => {
                      // Group linked tasks by frequency - only show active tasks (not 100% complete)
                      const activeTasks = linkedTasks.filter(link => link.completion_percentage !== 100);
                      
                      const tasksByFrequency: Record<string, any[]> = {
                        daily: [],
                        weekly: [],
                        monthly: [],
                        yearly: [],
                        one_time: []
                      };
                      
                      activeTasks.forEach(link => {
                        const freq = link.task_type || 'one_time';
                        if (tasksByFrequency[freq]) {
                          tasksByFrequency[freq].push(link);
                        } else {
                          tasksByFrequency['one_time'].push(link);
                        }
                      });
                      
                      const frequencyOrder = ['daily', 'weekly', 'monthly', 'yearly', 'one_time'];
                      const frequencyLabels: Record<string, string> = {
                        daily: '📆 Daily Tasks',
                        weekly: '📅 Weekly Tasks',
                        monthly: '📊 Monthly Tasks',
                        yearly: '🎯 Yearly Tasks',
                        one_time: '📋 One-Time Tasks'
                      };
                      
                      return frequencyOrder.map(freq => {
                        const tasks = tasksByFrequency[freq];
                        if (tasks.length === 0) return null;
                        
                        return (
                          <div key={freq} style={{ marginBottom: '16px' }}>
                            <h4 style={{ 
                              color: '#065f46', 
                              fontSize: '15px',
                              fontWeight: '700',
                              marginBottom: '8px'
                            }}>
                              {frequencyLabels[freq]}:
                            </h4>
                            <ul style={{ 
                              listStyle: 'none', 
                              padding: 0, 
                              margin: 0,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              {tasks.map(link => (
                                <li key={link.id} style={{
                                  padding: '8px 12px',
                                  background: 'white',
                                  borderRadius: '6px',
                                  borderLeft: '3px solid #10b981',
                                  fontSize: '14px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>•</span>
                                    <span style={{ fontWeight: '600', color: '#1f2937', flex: 1 }}>
                                      {link.task?.name || 'Task'}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                      {link.completion_count}/{link.expected_count} ({link.completion_percentage?.toFixed(0) || 0}%)
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Completed Supporting Tasks Section */}
                {(() => {
                  const completedTasks = linkedTasks.filter(link => link.completion_percentage === 100);
                  
                  if (completedTasks.length === 0) return null;
                  
                  return (
                    <div style={{
                      background: 'rgba(240, 253, 244, 0.5)',
                      padding: '16px',
                      borderRadius: '8px',
                      border: '2px solid #48bb78',
                      marginTop: '16px'
                    }}>
                      <h4 style={{ color: '#065f46', fontWeight: 'bold', fontSize: '15px', marginBottom: '12px' }}>
                        ✅ Completed Supporting Tasks ({completedTasks.length})
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                        {completedTasks.map(link => (
                          <div key={link.id} style={{
                            padding: '10px',
                            background: 'white',
                            borderRadius: '6px',
                            borderLeft: '3px solid #48bb78',
                            fontSize: '13px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span>✅</span>
                              <span style={{ 
                                fontWeight: '600', 
                                color: '#666',
                                textDecoration: 'line-through',
                                flex: 1
                              }}>
                                {link.task?.name || 'Task'}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#718096' }}>
                              {link.task_type} • {link.completion_count}/{link.expected_count} (100%)
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                  </>
                )}
              </div>

              {/* Projects Section */}
              {goalProjects.length > 0 && (
                <div className="goal-section projects-section" style={{
                  background: '#fffef0',
                  padding: '20px',
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}>
                  <div className="section-header" style={{ marginBottom: '16px', cursor: 'pointer' }} onClick={() => toggleSection('projects')}>
                    <h3 style={{ color: '#2d3748', fontWeight: 'bold', fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{collapsedSections['projects'] ? '▶' : '▼'}</span>
                      📁 Projects
                    </h3>
                  </div>
                  {!collapsedSections['projects'] && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {goalProjects.map((project: any) => {
                      const taskProgress = project.completed_tasks || 0;
                      const totalTasks = project.total_tasks || 0;
                      const taskPercentage = totalTasks > 0 ? (taskProgress / totalTasks) * 100 : 0;
                      
                      const milestoneProgress = project.milestones?.filter((m: any) => m.is_completed).length || 0;
                      const totalMilestones = project.milestones?.length || 0;
                      const milestonePercentage = totalMilestones > 0 ? (milestoneProgress / totalMilestones) * 100 : 0;
                      
                      return (
                        <div 
                          key={project.id} 
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '12px', 
                            padding: '16px 24px', 
                            minHeight: '110px',
                            background: '#fffef0',
                            borderRadius: '8px',
                            border: '1px solid #e5e3d0',
                            cursor: 'pointer'
                          }}
                          onClick={() => navigate(`/tasks?tab=projects&project=${project.id}`)}
                        >
                          {/* Top Row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {/* Left: Icon & Title */}
                            <div style={{ display: 'flex', gap: '12px', minWidth: '280px', maxWidth: '280px', alignItems: 'center' }}>
                              <span style={{ fontSize: '32px', lineHeight: 1 }}>📊</span>
                              <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#2d3748', lineHeight: 1.3 }}>{project.name}</h3>
                                <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>
                                  {project.is_completed ? '✅ Completed' : '▶️ ' + (project.status || 'not_started').replace('_', ' ')}
                                </div>
                              </div>
                            </div>

                            {/* Center: Circular Progress (Tasks & Milestones side by side) */}
                            <div style={{ flex: 1, display: 'flex', gap: '32px', alignItems: 'center', justifyContent: 'flex-start' }}>
                              {/* Task Progress Circle */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '13px', color: '#4a5568', fontWeight: '500' }}>📋 Tasks</span>
                                  <span style={{ fontSize: '16px', color: '#2d3748', fontWeight: '700' }}>{taskProgress}/{totalTasks}</span>
                                </div>
                                <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                                  <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                                  <circle 
                                    cx="40" 
                                    cy="40" 
                                    r="32" 
                                    fill="none" 
                                    stroke="#10b981" 
                                    strokeWidth="8"
                                    strokeDasharray={`${2 * Math.PI * 32}`}
                                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - taskPercentage / 100)}`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.3s' }}
                                  />
                                </svg>
                              </div>
                              {/* Milestone Progress Circle */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '13px', color: '#4a5568', fontWeight: '500' }}>🎯 Milestones</span>
                                  <span style={{ fontSize: '16px', color: '#2d3748', fontWeight: '700' }}>{milestoneProgress}/{totalMilestones}</span>
                                </div>
                                <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                                  <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                                  <circle 
                                    cx="40" 
                                    cy="40" 
                                    r="32" 
                                    fill="none" 
                                    stroke="#3b82f6" 
                                    strokeWidth="8"
                                    strokeDasharray={`${2 * Math.PI * 32}`}
                                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - milestonePercentage / 100)}`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.3s' }}
                                  />
                                </svg>
                              </div>
                            </div>

                            {/* Right: Dates & Days Left */}
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <div style={{ fontSize: '12px' }}>
                                <div style={{ marginBottom: '8px' }}>
                                  <label style={{ display: 'block', color: '#718096', marginBottom: '2px', fontSize: '11px' }}>Start</label>
                                  <input
                                    type="date"
                                    value={project.start_date || ''}
                                    onChange={(e) => { e.stopPropagation(); /* Add update handler if needed */ }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ padding: '4px 8px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '11px', width: '120px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', color: '#718096', marginBottom: '2px', fontSize: '11px' }}>Target End</label>
                                  <input
                                    type="date"
                                    value={project.target_completion_date || ''}
                                    onChange={(e) => { e.stopPropagation(); /* Add update handler if needed */ }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ padding: '4px 8px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '11px', width: '120px' }}
                                  />
                                </div>
                              </div>
                              {project.target_completion_date && (() => {
                                const daysLeft = Math.ceil((new Date(project.target_completion_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                const isOverdue = daysLeft < 0;
                                return (
                                  <div style={{ textAlign: 'center', padding: '12px 16px', backgroundColor: isOverdue ? '#fee2e2' : '#dbeafe', borderRadius: '8px', minWidth: '85px' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700', color: isOverdue ? '#dc2626' : '#2563eb', lineHeight: 1 }}>{Math.abs(daysLeft)}</div>
                                    <div style={{ fontSize: '10px', color: '#718096', textTransform: 'uppercase', marginTop: '4px' }}>{isOverdue ? 'overdue' : 'days left'}</div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Bottom Row: Stats */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e5e3d0' }}>
                            <div style={{ display: 'flex', gap: '24px', fontSize: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '14px' }}>⏳</span>
                                <span style={{ color: '#718096' }}>Active Tasks:</span>
                                <span style={{ fontWeight: '600', color: '#2d3748' }}>{totalTasks - taskProgress}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '14px' }}>✅</span>
                                <span style={{ color: '#718096' }}>Completed:</span>
                                <span style={{ fontWeight: '600', color: '#10b981' }}>{taskProgress}</span>
                              </div>
                            </div>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/tasks?tab=projects&project=${project.id}`);
                              }}
                              style={{ minWidth: '100px', padding: '8px 14px', fontSize: '13px' }}
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              )}

              {/* Milestones */}
              <div className="goal-section milestones-section" style={{
                background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                padding: '20px',
                borderRadius: '12px',
                border: '3px solid #10b981',
                marginBottom: '20px'
              }}>
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', cursor: 'pointer' }} onClick={(e) => {
                  if (!(e.target as HTMLElement).closest('button')) {
                    toggleSection('milestones');
                  }
                }}>
                  <h3 style={{ color: '#065f46', fontWeight: 'bold', fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{collapsedSections['milestones'] ? '▶' : '▼'}</span>
                    🎯 Milestones
                  </h3>
                  <button
                    className="btn btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddMilestoneModal(true);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      color: 'white',
                      border: '2px solid #065f46',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: '600'
                    }}
                  >
                    ➕ Add Milestone
                  </button>
                </div>

                {!collapsedSections['milestones'] && (
                  <>
                {/* Milestone Breakdown Summary */}
                {selectedGoal?.stats?.milestones && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '12px',
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.6)',
                    borderRadius: '8px',
                    border: '2px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#047857', marginBottom: '4px' }}>Total Milestones</div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#065f46' }}>
                        {selectedGoal.stats.milestones.completed}/{selectedGoal.stats.milestones.total}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '2px solid rgba(16, 185, 129, 0.3)', paddingLeft: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#047857', marginBottom: '4px' }}>Goal Milestones</div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#065f46' }}>
                        {selectedGoal.stats.milestones.goal_milestones?.completed || 0}/{selectedGoal.stats.milestones.goal_milestones?.total || 0}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '2px solid rgba(16, 185, 129, 0.3)', paddingLeft: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#047857', marginBottom: '4px' }}>Project Milestones</div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#065f46' }}>
                        {selectedGoal.stats.milestones.project_milestones?.completed || 0}/{selectedGoal.stats.milestones.project_milestones?.total || 0}
                      </div>
                    </div>
                  </div>
                )}

                {goalMilestones.length === 0 ? (
                  <div className="empty-section">
                    <p>No milestones yet. Add checkpoints to track your progress!</p>
                  </div>
                ) : (
                  <div className="milestones-list">
                    {goalMilestones.map(milestone => {
                      // Count linked projects and tasks for this milestone
                      const linkedProjectsCount = goalProjects.filter((p: any) => p.goal_milestone_id === milestone.id).length;
                      
                      return (
                      <div key={milestone.id} className={`milestone-item ${milestone.is_completed ? 'completed' : ''}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        background: 'white',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        border: '2px solid #d1fae5'
                      }}>
                        <input
                          type="checkbox"
                          checked={milestone.is_completed}
                          onChange={(e) => handleToggleMilestone(milestone.id, e.target.checked)}
                          style={{ width: '20px', height: '20px' }}
                        />
                        <div className="milestone-content" style={{ flex: 1 }}>
                          <strong style={{ color: '#065f46', fontSize: '16px' }}>{milestone.name}</strong>
                          {milestone.target_date && (
                            <span className="milestone-date" style={{ marginLeft: '12px', color: '#047857', fontSize: '14px' }}>
                              📅 {new Date(milestone.target_date).toLocaleDateString()}
                            </span>
                          )}
                          {linkedProjectsCount > 0 && (
                            <span style={{ marginLeft: '12px', padding: '2px 8px', background: '#d1fae5', borderRadius: '4px', fontSize: '12px', color: '#065f46', fontWeight: '600' }}>
                              🔗 {linkedProjectsCount} project{linkedProjectsCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {milestone.description && (
                            <p className="milestone-description" style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>{milestone.description}</p>
                          )}
                        </div>
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            setSelectedMilestone(milestone);
                            setShowLinkProjectsModal(true);
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            border: '2px solid #1e40af',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontWeight: '600',
                            fontSize: '13px'
                          }}
                        >
                          🔗 Link
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteMilestone(milestone.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontWeight: '600',
                            fontSize: '13px'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )})}
                  </div>
                )}
                  </>
                )}
              </div>

              {/* Goal Projects Section - Tracking Dashboards */}
              <div className="goal-section goal-projects-section">
                <div className="section-header" style={{ cursor: 'pointer' }} onClick={(e) => {
                  if (!(e.target as HTMLElement).closest('button')) {
                    toggleSection('tracking-projects');
                  }
                }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{collapsedSections['tracking-projects'] ? '▶' : '▼'}</span>
                    📊 Performance Tracking
                  </h3>
                  <button
                    className="btn btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateTrackingProjectModal(true);
                    }}
                  >
                    ➕ Create Tracking Dashboard
                  </button>
                </div>

                {!collapsedSections['tracking-projects'] && (
                  <>
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
                  </>
                )}
              </div>

              {/* Why Statements */}
              {selectedGoal.why_statements && selectedGoal.why_statements.length > 0 && (
                <div className="goal-section why-section" style={{
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '3px solid #f59e0b',
                  marginBottom: '20px'
                }}>
                  <h3 style={{ color: '#92400e', fontWeight: 'bold', fontSize: '18px', marginBottom: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => toggleSection('why-statements')}>
                    <span>{collapsedSections['why-statements'] ? '▶' : '▼'}</span>
                    💡 Why This Goal Matters
                  </h3>
                  {!collapsedSections['why-statements'] && (
                  <ul className="why-statements-list" style={{ color: '#78350f', fontSize: '15px' }}>
                    {selectedGoal.why_statements.map((why, index) => (
                      <li key={index}>{why}</li>
                    ))}
                  </ul>
                  )}
                </div>
              )}

              {/* Description */}
              {selectedGoal.description && (
                <div className="goal-section description-section" style={{
                  background: 'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '3px solid #8b5cf6',
                  marginBottom: '20px'
                }}>
                  <h3 style={{ color: '#5b21b6', fontWeight: 'bold', fontSize: '18px', marginBottom: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => toggleSection('description')}>
                    <span>{collapsedSections['description'] ? '▶' : '▼'}</span>
                    📝 Description
                  </h3>
                  {!collapsedSections['description'] && (
                  <p style={{ color: '#4c1d95', fontSize: '15px' }}>{selectedGoal.description}</p>
                  )}
                </div>
              )}
            
            {/* Challenges Section */}
            <div className="goal-section challenges-section">
              <div className="section-header" style={{ cursor: 'pointer' }} onClick={() => toggleSection('challenges')}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{collapsedSections['challenges'] ? '▶' : '▼'}</span>
                  🏆 Challenges
                </h3>
              </div>

              {!collapsedSections['challenges'] && (
              <div className="section-content">
                {goalChallenges && (
                  <RelatedChallengesList
                    directChallenges={goalChallenges.direct_challenges || []}
                    relatedChallenges={goalChallenges.project_challenges || []}
                    title="Related Challenges"
                    emptyMessage="No challenges linked to this goal or its projects yet."
                  />
                )}
                {!goalChallenges && (
                  <p style={{ color: '#718096', fontSize: '14px', fontStyle: 'italic' }}>
                    Loading challenges...
                  </p>
                )}
              </div>
              )}
            </div>
          </div>
          </div>
        )}
        </div>
      )}

      {/* Add Project to Goal Modal */}
      {showAddProjectToGoalModal && selectedGoal && (
        <div className="modal-overlay" onClick={() => {
          setShowAddProjectToGoalModal(false);
          setGoalProjectPillarId(null);
          setGoalProjectCategoryId(null);
          setGoalProjectSubCategoryId(null);
        }} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#fff8f0',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '16px 20px',
              borderRadius: '8px',
              marginBottom: '24px',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
            }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '22px' }}>🚀 Add Project to {selectedGoal.name}</h2>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              try {
                const projectData: any = {
                  name: formData.get('name'),
                  description: formData.get('description') || '',
                  goal_id: selectedGoal.id,  // Pre-filled with current goal
                  start_date: formData.get('start_date') || new Date().toISOString().split('T')[0],
                  target_completion_date: formData.get('target_completion_date') || null,
                  status: 'not_started',
                  is_active: true
                };
                
                // Add pillar/category if selected
                if (goalProjectPillarId) projectData.pillar_id = goalProjectPillarId;
                if (goalProjectCategoryId) projectData.category_id = goalProjectCategoryId;
                
                await api.post('/api/projects/', projectData);
                showAlert('Project created successfully!', 'success');
                setShowAddProjectToGoalModal(false);
                // Reset form state
                setGoalProjectPillarId(null);
                setGoalProjectCategoryId(null);
                setGoalProjectSubCategoryId(null);
                await loadGoalDetails(selectedGoal.id);
              } catch (err: any) {
                console.error('Error creating project:', err);
                showAlert('Failed to create project: ' + (err.response?.data?.detail || err.message), 'error');
              }
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                padding: '10px 16px',
                borderRadius: '6px',
                marginBottom: '16px',
                boxShadow: '0 2px 6px rgba(240, 147, 251, 0.2)'
              }}>
                <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>📝 Project Details</span>
              </div>
              
              {/* Goal Info - Read Only */}
              <div style={{ 
                marginBottom: '16px',
                padding: '12px',
                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                borderRadius: '8px',
                border: '2px solid #3b82f6'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e40af', marginBottom: '4px' }}>
                  🎯 Linked to Goal:
                </div>
                <div style={{ fontSize: '14px', color: '#2563eb' }}>
                  {selectedGoal.name}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Project Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g., Build Personal Website"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Project description and objectives"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Pillar/Category Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  🏛️ Pillar & Category (Optional)
                </label>
                <PillarCategorySelector
                  selectedPillarId={goalProjectPillarId}
                  selectedCategoryId={goalProjectCategoryId}
                  selectedSubCategoryId={goalProjectSubCategoryId}
                  onPillarChange={setGoalProjectPillarId}
                  onCategoryChange={setGoalProjectCategoryId}
                  onSubCategoryChange={setGoalProjectSubCategoryId}
                />
              </div>

              {/* Date Fields */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    📅 Start Date
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    🎯 Target Completion
                  </label>
                  <input
                    type="date"
                    name="target_completion_date"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProjectToGoalModal(false);
                    setGoalProjectPillarId(null);
                    setGoalProjectCategoryId(null);
                    setGoalProjectSubCategoryId(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#e2e8f0',
                    color: '#2d3748',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#48bb78',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Life Goal Modal */}
      <AddGoalModal
        show={showAddGoalModal}
        onClose={() => {
          setShowAddGoalModal(false);
          setEditingGoal(null);
        }}
        onSuccess={async () => {
          setShowAddGoalModal(false);
          setEditingGoal(null);
          await loadLifeGoals();
          await loadWishes(); // Refresh wish stats to show new goal count
        }}
        editingGoal={editingGoal as any}
        lifeGoals={lifeGoals as any}
      />

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

      {/* Link Projects to Milestone Modal */}
      {showLinkProjectsModal && selectedMilestone && selectedGoal && (
        <div className="modal-overlay" onClick={() => setShowLinkProjectsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              padding: '16px 20px',
              borderRadius: '12px 12px 0 0'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                🔗 Link Projects & Tasks to Milestone
              </h2>
              <button 
                className="btn-close" 
                onClick={() => setShowLinkProjectsModal(false)}
                style={{ color: 'white', fontSize: '28px' }}
              >×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              {/* Milestone Info */}
              <div style={{
                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '2px solid #3b82f6'
              }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e40af', marginBottom: '4px' }}>
                  {selectedMilestone.name}
                </div>
                {selectedMilestone.target_date && (
                  <div style={{ fontSize: '13px', color: '#2563eb' }}>
                    📅 Target: {new Date(selectedMilestone.target_date).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Projects Section */}
              <div style={{
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '2px solid #38bdf8'
              }}>
                <h4 style={{ color: '#0369a1', marginBottom: '12px', fontSize: '16px', fontWeight: '700' }}>
                  📊 Link Projects
                </h4>
                <p style={{ fontSize: '13px', color: '#0c4a6e', marginBottom: '12px' }}>
                  Associate entire projects with this milestone to track progress
                </p>
                {goalProjects && goalProjects.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {goalProjects.map((project: any) => {
                      const isLinked = project.goal_milestone_id === selectedMilestone.id;
                      return (
                        <div 
                          key={project.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 12px',
                            background: isLinked ? '#e0f2fe' : 'white',
                            borderRadius: '6px',
                            border: isLinked ? '2px solid #0ea5e9' : '2px solid #e5e7eb',
                            cursor: 'pointer'
                          }}
                          onClick={async () => {
                            try {
                              await api.put(`/api/projects/${project.id}`, {
                                goal_milestone_id: isLinked ? null : selectedMilestone.id
                              });
                              // Reload projects
                              const response: any = await api.get(`/api/life-goals/${selectedGoal.id}/projects`);
                              setGoalProjects(response.data);
                            } catch (err) {
                              console.error('Error linking project:', err);
                              showAlert('Failed to link project', 'error');
                            }
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={isLinked}
                            readOnly
                            style={{ marginRight: '10px', width: '18px', height: '18px' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', color: '#0c4a6e' }}>{project.name}</div>
                            {project.description && (
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                {project.description}
                              </div>
                            )}
                          </div>
                          {isLinked && (
                            <span style={{ 
                              padding: '2px 8px', 
                              background: '#0ea5e9', 
                              color: 'white', 
                              borderRadius: '4px', 
                              fontSize: '11px',
                              fontWeight: '600'
                            }}>
                              Linked
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>
                    No projects available. Create projects in the goal detail view first.
                  </p>
                )}
              </div>

              <div className="modal-footer" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '2px solid #e5e7eb' }}>
                <button 
                  type="button"
                  className="btn btn-primary" 
                  onClick={() => setShowLinkProjectsModal(false)}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    border: '2px solid #1e40af',
                    padding: '10px 24px',
                    fontWeight: '600'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Goal Task Modal */}
      {showAddGoalTaskModal && selectedGoal && (
        <div className="modal-overlay" onClick={() => {
          setShowAddGoalTaskModal(false);
          setCreateAsProject(false);
          setEditingGoalTask(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{
                editingGoalTask && editingGoalTask.parent_task_id !== undefined && !editingGoalTask.is_completed 
                  ? `Add Subtask to "${editingGoalTask.name}"`
                  : editingGoalTask 
                  ? `Edit Task: "${editingGoalTask.name}"`
                  : `Add Task to ${selectedGoal.name}`
              }</h2>
              <button className="btn-close" onClick={() => {
                setShowAddGoalTaskModal(false);
                setCreateAsProject(false);
                setEditingGoalTask(null);
              }}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                const isEditMode = editingGoalTask && editingGoalTask.parent_task_id !== undefined && editingGoalTask.is_completed !== undefined;
                const isSubtaskMode = editingGoalTask && !isEditMode;
                
                try {
                  if (isEditMode) {
                    // Update existing task
                    const taskType = formData.get('task_type') as string || 'time';
                    const updateData: any = {
                      name: formData.get('name'),
                      description: formData.get('description') || null,
                      start_date: formData.get('start_date') || null,
                      due_date: formData.get('due_date') || null,
                      priority: formData.get('priority') || 'medium',
                      task_type: taskType
                    };
                    
                    // Add type-specific fields
                    if (taskType === 'count') {
                      updateData.target_value = parseInt(formData.get('target_value') as string) || null;
                      updateData.unit = formData.get('unit') || null;
                    } else if (taskType === 'time') {
                      updateData.time_allocated_hours = parseFloat(formData.get('time_allocated_hours') as string) || 0;
                    }
                    
                    await handleUpdateGoalTask(editingGoalTask.id, updateData);
                    showAlert('Task updated successfully!', 'success');
                    setShowAddGoalTaskModal(false);
                    setEditingGoalTask(null);
                  } else if (createAsProject && !isSubtaskMode) {
                    // Create as a new Project linked to this goal
                    const startDate = formData.get('start_date') as string;
                    const dueDate = formData.get('due_date') as string;
                    const projectData: any = {
                      name: formData.get('name'),
                      description: formData.get('description') || '',
                      goal_id: selectedGoal.id,
                      start_date: startDate || new Date().toISOString().split('T')[0],  // Just the date part YYYY-MM-DD
                      target_completion_date: dueDate || null,  // Already in YYYY-MM-DD format from date input
                      status: 'not_started',
                      is_active: true
                    };
                    
                    // Add pillar/category if selected
                    if (goalProjectPillarId) projectData.pillar_id = goalProjectPillarId;
                    if (goalProjectCategoryId) projectData.category_id = goalProjectCategoryId;
                    
                    await api.post('/api/projects/', projectData);
                    alert('Project created successfully! View it in the Projects section below.');
                    setShowAddGoalTaskModal(false);
                    setCreateAsProject(false);
                    // Reset pillar/category state
                    setGoalProjectPillarId(null);
                    setGoalProjectCategoryId(null);
                    setGoalProjectSubCategoryId(null);
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
                    
                    // Add parent_task_id if this is a subtask
                    if (isSubtaskMode) {
                      taskData.parent_task_id = editingGoalTask.id;
                    }
                    
                    await handleCreateGoalTask(selectedGoal.id, taskData);
                    setEditingGoalTask(null);
                  }
                } catch (err: any) {
                  console.error('Error creating/updating task/project:', err);
                  showAlert('Failed to create/update task/project', 'error');
                }
              }}>
                {!editingGoalTask && (
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
                )}
                
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
                    defaultValue={editingGoalTask?.name || ''}
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
                    defaultValue={editingGoalTask?.description || ''}
                    placeholder={createAsProject ? 'Project description and objectives' : 'Optional task description'}
                  />
                </div>
                
                {createAsProject && (
                  <div className="form-group">
                    <label>🏛️ Pillar & Category (Optional)</label>
                    <PillarCategorySelector
                      selectedPillarId={goalProjectPillarId}
                      selectedCategoryId={goalProjectCategoryId}
                      selectedSubCategoryId={goalProjectSubCategoryId}
                      onPillarChange={setGoalProjectPillarId}
                      onCategoryChange={setGoalProjectCategoryId}
                      onSubCategoryChange={setGoalProjectSubCategoryId}
                    />
                    <small className="form-text">
                      Organize your project by pillar and category for better tracking
                    </small>
                  </div>
                )}
                
                {!createAsProject && (
                  <div className="form-group">
                    <label htmlFor="goal-task-type">Task Type *</label>
                    <select
                      id="goal-task-type"
                      name="task_type"
                      className="form-control"
                      defaultValue={editingGoalTask?.task_type || "time"}
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
                  <div id="goal-task-target" className="form-group" style={{ display: editingGoalTask?.task_type === 'count' ? 'block' : 'none' }}>
                    <label>Target *</label>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 1 }}>
                        <input
                          type="number"
                          name="target_value"
                          className="form-control"
                          min="1"
                          defaultValue={editingGoalTask?.target_value || ''}
                          placeholder="e.g., 5"
                        />
                      </div>
                      <div className="form-group" style={{ flex: 2 }}>
                        <input
                          type="text"
                          name="unit"
                          className="form-control"
                          defaultValue={editingGoalTask?.unit || ''}
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
                          defaultValue={editingGoalTask?.start_date || new Date().toISOString().split('T')[0]}
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
                          defaultValue={editingGoalTask?.due_date || ''}
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
                        defaultValue={editingGoalTask?.priority || "medium"}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {!createAsProject && (
                  <div id="goal-task-time-field" className="form-group" style={{ display: !editingGoalTask || editingGoalTask.task_type === 'time' ? 'block' : 'none' }}>
                    <label htmlFor="goal-task-time">Estimated Time (hours)</label>
                    <input
                      type="number"
                      id="goal-task-time"
                      name="time_allocated_hours"
                      className="form-control"
                      min="0"
                      step="0.5"
                      defaultValue={editingGoalTask?.time_allocated_hours || ''}
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
                    {editingGoalTask && editingGoalTask.parent_task_id !== undefined && editingGoalTask.is_completed !== undefined
                      ? 'Save Changes'
                      : createAsProject
                      ? 'Create Project'
                      : 'Add Task'}
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
                  // Add pillar and category associations
                  pillar_id: wishPillarId || undefined,
                  category_id: wishCategoryId || undefined,
                  sub_category_id: wishSubCategoryId || undefined,
                };

                await handleCreateWish(wishData);
                // Reset form state
                setWishPillarId(null);
                setWishCategoryId(null);
                setWishSubCategoryId(null);
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  boxShadow: '0 2px 6px rgba(102, 126, 234, 0.2)'
                }}>
                  <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>✨ Dream Details</span>
                </div>

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

                <div style={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  marginTop: '20px',
                  boxShadow: '0 2px 6px rgba(240, 147, 251, 0.2)'
                }}>
                  <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>🏷️ Organization</span>
                </div>

                {/* Pillar & Category Selector */}
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '15px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  <div style={{ marginBottom: '10px' }}>
                    <strong style={{ fontSize: '14px', color: '#495057' }}>🎯 Align with Your Life Pillars</strong>
                    <small style={{ display: 'block', color: '#666', marginTop: '4px', fontSize: '13px' }}>
                      Connect this dream to your core life areas (Hard Work, Calmness, Family)
                    </small>
                  </div>
                  <PillarCategorySelector
                    selectedPillarId={wishPillarId}
                    selectedCategoryId={wishCategoryId}
                    onPillarChange={setWishPillarId}
                    onCategoryChange={setWishCategoryId}
                    onSubCategoryChange={setWishSubCategoryId}
                    showSubCategory={false}
                    required={false}
                  />
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  marginTop: '20px',
                  boxShadow: '0 2px 6px rgba(79, 172, 254, 0.2)'
                }}>
                  <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>🎨 Dream Classification</span>
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

                <div style={{
                  background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  marginTop: '20px',
                  boxShadow: '0 2px 6px rgba(67, 233, 123, 0.2)'
                }}>
                  <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>📅 Planning & Resources</span>
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

                <div style={{
                  background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  marginTop: '20px',
                  boxShadow: '0 2px 6px rgba(250, 112, 154, 0.2)'
                }}>
                  <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>💖 Purpose & Motivation</span>
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

                <div style={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  marginTop: '20px',
                  boxShadow: '0 2px 6px rgba(240, 147, 251, 0.2)'
                }}>
                  <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>✨ Inspiration & Vision</span>
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

      {/* 🌟 SIMPLIFIED DREAM DETAILS MODAL */}
      {showWishDetailsModal && selectedWish && (
        <div className="modal-overlay" onClick={() => {
          setShowWishDetailsModal(false);
          setSelectedWish(null);
        }} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            {/* Beautiful Header */}
            <div style={{
              background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f59e0b 100%)',
              padding: '32px',
              borderRadius: '16px 16px 0 0',
              color: 'white',
              position: 'relative'
            }}>
              <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span>✨</span>
                <span>{selectedWish.title}</span>
                {selectedWish.priority === 'burning_desire' && <span style={{ fontSize: '32px' }}>🔥</span>}
              </h2>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                {selectedWish.estimated_timeframe && (
                  <span style={{ fontSize: '14px', opacity: 0.95, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⏰ <strong>{selectedWish.estimated_timeframe.replace('_', ' ')}</strong>
                  </span>
                )}
                {selectedWish.category && (
                  <span style={{ fontSize: '14px', opacity: 0.95, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {selectedWish.category === 'travel' && '🌍'} 
                    {selectedWish.category === 'financial' && '💰'}
                    {selectedWish.category === 'personal' && '🌱'}
                    {selectedWish.category === 'career' && '💼'}
                    {selectedWish.category === 'health' && '💪'}
                    {selectedWish.category === 'relationship' && '❤️'}
                    {selectedWish.category === 'learning' && '📚'}
                    {selectedWish.category === 'lifestyle' && '🏡'}
                    <strong>{selectedWish.category}</strong>
                  </span>
                )}
                {selectedWish.estimated_cost && (
                  <span style={{ fontSize: '14px', opacity: 0.95, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    💵 <strong>${selectedWish.estimated_cost.toLocaleString()}</strong>
                  </span>
                )}
              </div>
              <button className="btn-close" onClick={() => {
                setShowWishDetailsModal(false);
                setSelectedWish(null);
              }} style={{ color: 'white', fontSize: '32px', top: '16px', right: '16px' }}>×</button>
            </div>

            <div className="modal-body" style={{ padding: '32px' }}>
              {/* Description */}
              {selectedWish.description && (
                <p style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#4a5568', lineHeight: '1.7' }}>
                  {selectedWish.description}
                </p>
              )}

              {/* Why & How You'll Feel - Side by Side */}
              {(selectedWish.why_important || selectedWish.emotional_impact) && (
                <div style={{ display: 'grid', gridTemplateColumns: selectedWish.why_important && selectedWish.emotional_impact ? '1fr 1fr' : '1fr', gap: '16px', marginBottom: '24px' }}>
                  {selectedWish.why_important && (
                    <div style={{
                      backgroundColor: '#fef5e7',
                      padding: '20px',
                      borderRadius: '12px',
                      borderLeft: '4px solid #f39c12'
                    }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#856404', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        💫 Why This Matters
                      </h4>
                      <p style={{ margin: 0, fontSize: '15px', color: '#856404', lineHeight: '1.6' }}>
                        {selectedWish.why_important}
                      </p>
                    </div>
                  )}
                  {selectedWish.emotional_impact && (
                    <div style={{
                      backgroundColor: '#f0f9ff',
                      padding: '20px',
                      borderRadius: '12px',
                      borderLeft: '4px solid #3b82f6'
                    }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#1e40af', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        ✨ How You'll Feel
                      </h4>
                      <p style={{ margin: 0, fontSize: '15px', color: '#1e40af', lineHeight: '1.6' }}>
                        {selectedWish.emotional_impact}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actual Task/Project/Goal Lists */}
              <WishActivitiesSection key={`activities-${selectedWish.id}-${Date.now()}`} selectedWish={selectedWish} />

              {/* 📝 ADD ACTIVITIES - Direct Form Access */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ➕ Work Toward This Dream
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  marginBottom: '16px'
                }}>
                  <button 
                    className="btn"
                    style={{
                      padding: '12px',
                      background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
                      color: '#831843',
                      border: '2px solid #ec4899',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                    onClick={() => {
                      setTaskFormWishId(selectedWish.id);
                      setShowWishDetailsModal(false); // Close wish modal
                      setShowTaskFormModal(true);
                    }}
                  >
                    ✅ Add Task
                  </button>

                  <button 
                    className="btn"
                    style={{
                      padding: '12px',
                      background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                      color: '#1e40af',
                      border: '2px solid #3b82f6',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                    onClick={() => {
                      setShowWishDetailsModal(false); // Close wish modal
                      setShowInlineProjectModal(true);
                      setCurrentExplorationWish(selectedWish);
                    }}
                  >
                    📁 Add Project
                  </button>

                  <button 
                    className="btn"
                    style={{
                      padding: '12px',
                      background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                      color: '#065f46',
                      border: '2px solid #10b981',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                    onClick={async () => {
                      const title = prompt("🔍 What exploration step will you take?");
                      if (title) {
                        const description = prompt("Any details? (optional)");
                        try {
                          await api.post(`/api/wishes/${selectedWish.id}/steps`, {
                            step_title: title,
                            step_description: description || undefined,
                            step_type: 'explore'
                          });
                          showToast('✅ Exploration step added!', 'success');
                          await loadExplorationSteps(selectedWish.id);
                          await loadWishes();
                        } catch (err) {
                          showToast('Failed to add step', 'error');
                        }
                      }
                    }}
                  >
                    🔬 Add Step
                  </button>

                  <button 
                    className="btn"
                    style={{
                      padding: '12px',
                      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                      color: '#78350f',
                      border: '2px solid #fbbf24',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                    onClick={() => {
                      console.log('🎯 Button clicked - selectedWish:', selectedWish);
                      console.log('🎯 Setting editingGoal with related_wish_id:', selectedWish.id);
                      setShowWishDetailsModal(false);
                      setEditingGoal({ related_wish_id: selectedWish.id } as any);
                      setShowAddGoalModal(true);
                    }}
                  >
                    🎯 Add Goal
                  </button>
                </div>
              </div>

              {/* REFLECTION & ACHIEVEMENT BUTTONS */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                marginBottom: '16px'
              }}>
                <button 
                  className="btn"
                  style={{
                    padding: '12px',
                    background: 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)',
                    color: '#1e3a8a',
                    border: '2px solid #3b82f6',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                  onClick={async () => {
                    const text = prompt("✍️ What are your thoughts about this dream?");
                    if (text) {
                      try {
                        await api.post(`/api/wishes/${selectedWish.id}/reflections`, {
                          reflection_text: text
                        });
                        showToast('✅ Reflection saved!', 'success');
                        await loadWishes();
                      } catch (err) {
                        showToast('Failed to add reflection', 'error');
                      }
                    }
                  }}
                >
                  ✍️ Reflect
                </button>

                {selectedWish.status !== 'achieved' && selectedWish.status !== 'released' && (
                    <button 
                      className="btn"
                      style={{
                        padding: '12px',
                        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '14px',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                      }}
                      onClick={async () => {
                        const notes = prompt("🎉 Congratulations! How did this dream come true?");
                        if (notes !== null) {
                          try {
                            await api.post(`/api/wishes/${selectedWish.id}/mark-achieved`, null, {
                              params: { achievement_notes: notes || 'Dream manifested!' }
                            });
                            confetti({
                              particleCount: 100,
                              spread: 70,
                              origin: { y: 0.6 },
                              colors: ['#ffd700', '#ff69b4', '#87ceeb', '#98fb98', '#dda0dd']
                            });
                            setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#ffd700', '#ff1493', '#00bfff'] }), 200);
                            setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ffd700', '#ff1493', '#00bfff'] }), 400);
                            showToast('✨ Dream achieved! Celebrating!', 'success');
                            await loadWishes();
                            setShowWishDetailsModal(false);
                          } catch (err) {
                            showToast('Failed to mark as achieved', 'error');
                          }
                        }
                      }}
                    >
                      ✨ Achieved!
                    </button>
                  )}
              </div>

              {/* 🚀 Bottom Actions */}
              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                paddingTop: '16px', 
                borderTop: '2px solid #e2e8f0'
              }}>
                <button 
                  className="btn"
                  onClick={() => {
                    setShowWishDetailsModal(false);
                    setSelectedWish(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    fontSize: '14px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600'
                  }}
                >
                  ← Back to Dreams
                </button>
                <button 
                  className="btn"
                  onClick={async () => {
                    if (confirm('Archive this dream?')) {
                      try {
                        await api.post(`/api/wishes/${selectedWish.id}/release`, null, {
                          params: { release_reason: 'archived' }
                        });
                        showToast('Dream archived', 'info');
                        await loadWishes();
                        setShowWishDetailsModal(false);
                      } catch (err) {
                        showToast('Failed to archive', 'error');
                      }
                    }
                  }}
                  style={{
                    padding: '12px 20px',
                    fontSize: '14px',
                    backgroundColor: '#e2e8f0',
                    color: '#64748b',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600'
                  }}
                >
                  🗄️ Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Exploration Activity Modal */}
      {showAddExplorationModal && currentExplorationWish && (
        <div className="modal-overlay" onClick={() => setShowAddExplorationModal(false)} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              color: 'white'
            }}>
              <h2>🔬 Explore: {currentExplorationWish.title}</h2>
              <button className="btn-close" onClick={() => setShowAddExplorationModal(false)} style={{ color: 'white' }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '24px', color: '#0f766e', fontSize: '15px', fontWeight: '600', background: '#f0fdfa', padding: '12px', borderRadius: '8px', border: '2px solid #5eead4' }}>
                💡 Choose how you want to explore this dream - no pressure, just curiosity!
              </p>
              
              {/* Option Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {/* Simple Step */}
                <button
                  className="btn"
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                    border: '3px solid #0ea5e9',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.3s'
                  }}
                  onClick={() => {
                    const title = prompt("📝 What simple step do you want to take?\n\nExamples:\n• Research online\n• Watch a video\n• Read an article");
                    if (title) {
                      api.post(`/api/wishes/${currentExplorationWish.id}/steps`, {
                        step_title: title,
                        step_type: 'research'
                      }).then(() => {
                        showToast('✅ Exploration step added!', 'success');
                        loadWishes();
                        setShowAddExplorationModal(false);
                      });
                    }
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#0369a1', marginBottom: '4px' }}>Simple Step</div>
                  <div style={{ fontSize: '13px', color: '#0c4a6e' }}>Quick research or learning</div>
                </button>

                {/* Task */}
                <button
                  className="btn"
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    border: '3px solid #eab308',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.3s'
                  }}
                  onClick={() => {
                    setShowAddExplorationModal(false);
                    setCurrentExplorationWish(null);
                    setTaskFormWishId(currentExplorationWish.id);
                    setShowTaskFormModal(true);
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#92400e', marginBottom: '4px' }}>Create Task</div>
                  <div style={{ fontSize: '13px', color: '#78350f' }}>Specific action item</div>
                </button>

                {/* Project */}
                <button
                  className="btn"
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)',
                    border: '3px solid #a78bfa',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.3s'
                  }}
                  onClick={() => {
                    setShowAddExplorationModal(false);
                    setCurrentExplorationWish(null);
                    setNewProject({ ...newProject, related_wish_id: currentExplorationWish.id });
                    setShowAddProjectModal(true);
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📁</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#6d28d9', marginBottom: '4px' }}>Mini Project</div>
                  <div style={{ fontSize: '13px', color: '#5b21b6' }}>Collection of related tasks</div>
                </button>

                {/* Goal */}
                <button
                  className="btn"
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)',
                    border: '3px solid #f87171',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.3s'
                  }}
                  onClick={() => {
                    setShowAddExplorationModal(false);
                    setCurrentExplorationWish(null);
                    setShowAddGoalModal(true);
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎯</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#b91c1c', marginBottom: '4px' }}>Sub-Goal</div>
                  <div style={{ fontSize: '13px', color: '#991b1b' }}>Bigger milestone</div>
                </button>
              </div>

              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setShowAddExplorationModal(false);
                  setCurrentExplorationWish(null);
                }}
                style={{ width: '100%' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Beautiful Add Reflection Modal */}
      {showAddReflectionModal && selectedWish && (
        <div className="modal-overlay" onClick={() => setShowAddReflectionModal(false)} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              padding: '24px',
              borderRadius: '12px 12px 0 0'
            }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '32px' }}>✍️</span>
                <span>Reflect on Your Dream</span>
              </h2>
              <p style={{ margin: '8px 0 0 44px', fontSize: '14px', opacity: 0.9 }}>
                {selectedWish.title}
              </p>
              <button className="btn-close" onClick={() => setShowAddReflectionModal(false)} style={{ color: 'white', top: '20px', right: '20px' }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '32px' }}>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const text = formData.get('reflection_text') as string;
                const mood = formData.get('mood') as string;
                const clarityStr = formData.get('clarity_score') as string;
                const clarity = clarityStr ? parseInt(clarityStr) : undefined;
                
                try {
                  await api.post(`/api/wishes/${selectedWish.id}/reflections`, {
                    reflection_text: text,
                    mood: mood,
                    clarity_score: clarity
                  });
                  showToast('✅ Reflection added!', 'success');
                  await loadWishes();
                  const updated: any = await api.get(`/api/wishes/${selectedWish.id}`);
                  setSelectedWish(updated.data || updated);
                  setShowAddReflectionModal(false);
                } catch (err) {
                  console.error('Error adding reflection:', err);
                  showToast('Failed to add reflection', 'error');
                }
              }}>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label htmlFor="reflection_text" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e40af', fontSize: '15px' }}>
                    💭 Your Thoughts
                  </label>
                  <textarea 
                    id="reflection_text" 
                    name="reflection_text" 
                    rows={5}
                    placeholder="What are you thinking about this dream? How does it make you feel?"
                    required
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '2px solid #bfdbfe',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      transition: 'border 0.3s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#bfdbfe'}
                  ></textarea>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label htmlFor="mood" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e40af', fontSize: '15px' }}>
                    😊 Current Mood
                  </label>
                  <select 
                    id="mood" 
                    name="mood" 
                    required
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '2px solid #bfdbfe',
                      fontSize: '15px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="excited">🎉 Excited - Can't wait to get started!</option>
                    <option value="inspired">✨ Inspired - Feeling motivated</option>
                    <option value="determined">💪 Determined - Ready to make it happen</option>
                    <option value="uncertain">🤔 Uncertain - Not sure yet</option>
                    <option value="doubtful">😕 Doubtful - Having second thoughts</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '32px' }}>
                  <label htmlFor="clarity_score" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e40af', fontSize: '15px' }}>
                    🔍 Clarity Level (1-10)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input 
                      type="range" 
                      id="clarity_score" 
                      name="clarity_score" 
                      min="1" 
                      max="10" 
                      defaultValue="5"
                      style={{
                        flex: 1,
                        height: '8px',
                        borderRadius: '4px',
                        background: 'linear-gradient(to right, #fca5a5, #fde68a, #86efac)',
                        cursor: 'pointer'
                      }}
                      onInput={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        const display = document.getElementById('clarity_display');
                        if (display) display.textContent = val;
                      }}
                    />
                    <span id="clarity_display" style={{
                      minWidth: '32px',
                      textAlign: 'center',
                      fontWeight: '700',
                      fontSize: '18px',
                      color: '#2563eb'
                    }}>5</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                    <span>Fuzzy</span>
                    <span>Crystal Clear</span>
                  </div>
                </div>

                <div className="form-actions" style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowAddReflectionModal(false)}
                    style={{ flex: 1, padding: '14px', fontSize: '15px', fontWeight: '600' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ 
                      flex: 1, 
                      padding: '14px', 
                      fontSize: '15px', 
                      fontWeight: '700',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      border: 'none',
                      color: 'white',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    ✍️ Save Reflection
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Beautiful Add Exploration Step Modal */}
      {showAddStepModal && selectedWish && (
        <div className="modal-overlay" onClick={() => setShowAddStepModal(false)} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '24px',
              borderRadius: '12px 12px 0 0'
            }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '32px' }}>🔍</span>
                <span>Add Exploration Step</span>
              </h2>
              <p style={{ margin: '8px 0 0 44px', fontSize: '14px', opacity: 0.9 }}>
                {selectedWish.title}
              </p>
              <button className="btn-close" onClick={() => setShowAddStepModal(false)} style={{ color: 'white', top: '20px', right: '20px' }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '32px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                padding: '16px',
                borderRadius: '10px',
                border: '2px solid #10b981',
                marginBottom: '24px'
              }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#065f46', fontWeight: '600' }}>
                  💡 Small steps lead to big dreams! What's one thing you can do to learn more?
                </p>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const title = formData.get('step_title') as string;
                const type = formData.get('step_type') as string;
                const description = formData.get('step_description') as string;
                
                try {
                  await api.post(`/api/wishes/${selectedWish.id}/steps`, {
                    step_title: title,
                    step_type: type,
                    step_description: description || undefined
                  });
                  showToast('✅ Exploration step added!', 'success');
                  await loadWishes();
                  const updated: any = await api.get(`/api/wishes/${selectedWish.id}`);
                  setSelectedWish(updated.data || updated);
                  await loadExplorationSteps(selectedWish.id);
                  setShowAddStepModal(false);
                } catch (err) {
                  console.error('Error adding exploration step:', err);
                  showToast('Failed to add exploration step', 'error');
                }
              }}>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label htmlFor="step_type" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#065f46', fontSize: '15px' }}>
                    🎯 Type of Step
                  </label>
                  <select 
                    id="step_type" 
                    name="step_type" 
                    required
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '2px solid #a7f3d0',
                      fontSize: '15px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="research">🔍 Research - Learn more about it</option>
                    <option value="explore">🧭 Explore - Try it out hands-on</option>
                    <option value="learn_skill">📚 Learn Skill - Build knowledge</option>
                    <option value="save_money">💰 Save Money - Financial planning</option>
                    <option value="connect">🤝 Connect - Meet people/network</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label htmlFor="step_title" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#065f46', fontSize: '15px' }}>
                    📝 What will you do?
                  </label>
                  <input 
                    type="text" 
                    id="step_title" 
                    name="step_title" 
                    placeholder="e.g., Watch 3 YouTube videos, Read a book, Talk to someone who's done it..."
                    required
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '2px solid #a7f3d0',
                      fontSize: '15px',
                      transition: 'border 0.3s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                    onBlur={(e) => e.target.style.borderColor = '#a7f3d0'}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '32px' }}>
                  <label htmlFor="step_description" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#065f46', fontSize: '15px' }}>
                    📋 Details (Optional)
                  </label>
                  <textarea 
                    id="step_description" 
                    name="step_description" 
                    rows={3}
                    placeholder="Any specific details, links, or notes..."
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '2px solid #a7f3d0',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  ></textarea>
                </div>

                <div className="form-actions" style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowAddStepModal(false)}
                    style={{ flex: 1, padding: '14px', fontSize: '15px', fontWeight: '600' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ 
                      flex: 1, 
                      padding: '14px', 
                      fontSize: '15px', 
                      fontWeight: '700',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      color: 'white',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    🔍 Add Step
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Dream Insights Modal */}
      {showDreamInsightsModal && dreamInsights && (
        <div className="modal-overlay" onClick={() => setShowDreamInsightsModal(false)} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: 'white'
            }}>
              <h2>📊 {dreamInsights.wish.title}</h2>
              <button className="btn-close" onClick={() => setShowDreamInsightsModal(false)} style={{ color: 'white' }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#4f46e5', marginBottom: '12px' }}>
                🔍 Exploration Steps ({dreamInsights.steps?.length || 0})
              </h3>
              {dreamInsights.steps && dreamInsights.steps.length > 0 ? (
                <div style={{ marginBottom: '24px' }}>
                  {dreamInsights.steps.map((step: any) => (
                    <div key={step.id} style={{
                      padding: '10px',
                      marginBottom: '8px',
                      backgroundColor: step.is_completed ? '#f0fdf4' : '#fef3c7',
                      borderRadius: '8px',
                      border: `2px solid ${step.is_completed ? '#10b981' : '#f59e0b'}`
                    }}>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>
                        {step.is_completed ? '✅' : '⏳'} {step.step_title}
                      </div>
                      {step.step_description && (
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                          {step.step_description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>No exploration steps yet. Start exploring!</p>
              )}

              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#4f46e5', marginBottom: '12px' }}>
                ✍️ Reflections ({dreamInsights.reflections?.length || 0})
              </h3>
              {dreamInsights.reflections && dreamInsights.reflections.length > 0 ? (
                <div style={{ marginBottom: '24px' }}>
                  {dreamInsights.reflections.map((reflection: any) => (
                    <div key={reflection.id} style={{
                      padding: '12px',
                      marginBottom: '8px',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '8px',
                      border: '2px solid #bfdbfe'
                    }}>
                      <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: '1.5' }}>
                        {reflection.reflection_text}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                        {reflection.mood && `Mood: ${reflection.mood}`} • {new Date(reflection.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>No reflections yet. Add your thoughts!</p>
              )}

              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#4f46e5', marginBottom: '12px' }}>
                ✨ Inspirations ({dreamInsights.inspirations?.length || 0})
              </h3>
              {dreamInsights.inspirations && dreamInsights.inspirations.length > 0 ? (
                <div style={{ marginBottom: '24px' }}>
                  {dreamInsights.inspirations.map((inspiration: any) => (
                    <div key={inspiration.id} style={{
                      padding: '12px',
                      marginBottom: '8px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '8px',
                      border: '2px solid #fde68a'
                    }}>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#78350f' }}>
                        {inspiration.title}
                      </div>
                      {inspiration.source_url && (
                        <a href={inspiration.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#2563eb' }}>
                          🔗 View Source
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>No inspirations saved yet.</p>
              )}

              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#8b5cf6', marginBottom: '12px' }}>
                📁 Related Projects ({dreamInsights.projects?.length || 0})
              </h3>
              {dreamInsights.projects && dreamInsights.projects.length > 0 ? (
                <div style={{ marginBottom: '24px' }}>
                  {dreamInsights.projects.map((project: any) => (
                    <div key={project.id} style={{
                      padding: '14px',
                      marginBottom: '10px',
                      backgroundColor: '#f3e8ff',
                      borderRadius: '8px',
                      border: '2px solid #c4b5fd',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9d5ff'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3e8ff'}
                    onClick={() => navigate('/tasks')}
                    >
                      <div style={{ fontWeight: '600', fontSize: '15px', color: '#6d28d9', marginBottom: '4px' }}>
                        {project.name}
                      </div>
                      {project.description && (
                        <div style={{ fontSize: '13px', color: '#7c3aed', marginBottom: '6px' }}>
                          {project.description}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#8b5cf6', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {project.status && <span>📊 {project.status}</span>}
                        {project.start_date && <span>📅 Started: {new Date(project.start_date).toLocaleDateString()}</span>}
                        {project.target_completion_date && <span>🎯 Due: {new Date(project.target_completion_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>No projects linked yet. Create one from the exploration activities!</p>
              )}

              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b', marginBottom: '12px' }}>
                ✅ Related Tasks ({dreamInsights.tasks?.length || 0})
              </h3>
              {dreamInsights.tasks && dreamInsights.tasks.length > 0 ? (
                <div style={{ marginBottom: '24px' }}>
                  {dreamInsights.tasks.map((task: any) => (
                    <div key={task.id} style={{
                      padding: '12px',
                      marginBottom: '8px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '8px',
                      border: '2px solid #fde68a',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef08a'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                    onClick={() => navigate('/tasks')}
                    >
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#92400e', marginBottom: '4px' }}>
                        {task.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#b45309', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {task.follow_up_frequency && <span>🔄 {task.follow_up_frequency}</span>}
                        {task.allocated_minutes && <span>⏰ {task.allocated_minutes} min</span>}
                        {task.is_completed && <span style={{ color: '#059669' }}>✓ Completed</span>}
                        {!task.is_active && !task.is_completed && <span style={{ color: '#dc2626' }}>NA</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>No tasks linked yet. Add tasks through the Tasks page!</p>
              )}

              <button 
                className="btn btn-primary"
                onClick={() => setShowDreamInsightsModal(false)}
                style={{ width: '100%', padding: '12px', fontWeight: '600' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Toast Notification with Icons & Gradients */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: toast.type === 'success' 
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : toast.type === 'error' 
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            : 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
          color: 'white',
          padding: '24px 48px',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 4px rgba(255,255,255,0.2)',
          border: '3px solid rgba(255, 255, 255, 0.4)',
          zIndex: 10000,
          fontSize: '20px',
          fontWeight: '700',
          animation: 'slideIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          minWidth: '350px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px'
        }}>
          <span style={{ fontSize: '32px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -60%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>

      {/* Inline Project Creation Modal from Exploration */}
      {showInlineProjectModal && currentExplorationWish && (
        <div className="modal-overlay" onClick={() => setShowInlineProjectModal(false)} style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
              color: 'white',
              padding: '20px',
              borderRadius: '12px 12px 0 0'
            }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>
                📁 Create Mini Project
              </h2>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
                For Dream: {currentExplorationWish.title}
              </p>
              <button className="btn-close" onClick={() => setShowInlineProjectModal(false)} style={{ color: 'white' }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                try {
                  const goalId = formData.get('goal_id');
                  await api.post('/api/projects/', {
                    name: formData.get('name'),
                    description: formData.get('description') || null,
                    goal_id: goalId && goalId !== '' ? parseInt(goalId as string) : null,
                    related_wish_id: currentExplorationWish.id,
                    start_date: formData.get('start_date') || null,
                    target_completion_date: formData.get('target_completion_date') || null
                  });
                  
                  showToast('✅ Project created and linked to dream!', 'success');
                  setShowInlineProjectModal(false);
                  setCurrentExplorationWish(null);
                  // Optionally reload wish details to show the new project
                } catch (err: any) {
                  console.error('Error creating project:', err);
                  showToast('Failed to create project: ' + (err.response?.data?.detail || err.message), 'error');
                }
              }}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label htmlFor="inline-project-goal" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                    Link to Life Goal (Optional)
                  </label>
                  <select
                    id="inline-project-goal"
                    name="goal_id"
                    className="form-control"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0' }}
                  >
                    <option value="">-- No Goal --</option>
                    {lifeGoals.map(goal => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name}
                      </option>
                    ))}
                  </select>
                  <small style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: '4px' }}>
                    Link this project to a life goal for better tracking
                  </small>
                </div>
                
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label htmlFor="inline-project-name" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                    Project Name *
                  </label>
                  <input
                    type="text"
                    id="inline-project-name"
                    name="name"
                    className="form-control"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0' }}
                    required
                    placeholder="e.g., Learn Python basics for career transition"
                  />
                </div>
                
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label htmlFor="inline-project-description" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                    Description
                  </label>
                  <textarea
                    id="inline-project-description"
                    name="description"
                    className="form-control"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0', resize: 'vertical' }}
                    rows={3}
                    placeholder="Brief description of what this project entails"
                  />
                </div>
                
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label htmlFor="inline-project-start-date" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    id="inline-project-start-date"
                    name="start_date"
                    className="form-control"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0' }}
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                  <small style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: '4px' }}>
                    When did/will you start this project?
                  </small>
                </div>
                
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label htmlFor="inline-project-due-date" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    id="inline-project-due-date"
                    name="target_completion_date"
                    className="form-control"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0' }}
                  />
                  <small style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: '4px' }}>
                    When do you want to complete this project?
                  </small>
                </div>
                
                <div className="modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button 
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowInlineProjectModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                      border: 'none',
                      color: 'white',
                      fontWeight: '600'
                    }}
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Inline Task Creation Modal from Exploration */}
      {showInlineTaskModal && currentExplorationWish && (
        <div className="modal-overlay" onClick={() => setShowInlineTaskModal(false)} style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              color: 'white',
              padding: '20px',
              borderRadius: '12px 12px 0 0'
            }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>
                ✅ Create Task
              </h2>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
                For Dream: {currentExplorationWish.title}
              </p>
              <button className="btn-close" onClick={() => setShowInlineTaskModal(false)} style={{ color: 'white' }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                try {
                  // This is a placeholder - you'll need to adjust based on your task creation API
                  showToast('⚠️ Task creation from dreams requires pillar/category. Please use main Tasks page for now.', 'info');
                  setShowInlineTaskModal(false);
                  setCurrentExplorationWish(null);
                  // Navigate to tasks page
                  navigate('/tasks');
                } catch (err: any) {
                  console.error('Error creating task:', err);
                  showToast('Failed to create task: ' + (err.response?.data?.detail || err.message), 'error');
                }
              }}>
                <p style={{ 
                  background: '#fef3c7', 
                  border: '2px solid #fbbf24', 
                  borderRadius: '8px', 
                  padding: '12px',
                  fontSize: '13px',
                  marginBottom: '20px'
                }}>
                  💡 <strong>Note:</strong> Task creation requires selecting a pillar and category. 
                  You'll be redirected to the Tasks page where you can create a task and link it to this dream.
                </p>
                
                <div className="modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button 
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowInlineTaskModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    className="btn btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                      border: 'none',
                      color: 'white',
                      fontWeight: '600'
                    }}
                    onClick={() => navigate('/tasks')}
                  >
                    Go to Tasks Page
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Inline Goal Creation Modal from Exploration */}
      {showInlineGoalModal && currentExplorationWish && (
        <div className="modal-overlay" onClick={() => setShowInlineGoalModal(false)} style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)',
              color: 'white',
              padding: '20px',
              borderRadius: '12px 12px 0 0'
            }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>
                🎯 Create Life Goal
              </h2>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
                For Dream: {currentExplorationWish.title}
              </p>
              <button className="btn-close" onClick={() => setShowInlineGoalModal(false)} style={{ color: 'white' }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                try {
                  const goalData = {
                    name: formData.get('name'),
                    start_date: formData.get('start_date') || new Date().toISOString().split('T')[0],
                    target_date: formData.get('target_date'),
                    category: formData.get('category') || null,
                    priority: formData.get('priority') || 'medium',
                    description: formData.get('description') || null,
                    time_allocated_hours: 0,
                    why_statements: []
                  };
                  
                  await api.post('/api/life-goals/', goalData);
                  showToast('✅ Goal created successfully!', 'success');
                  setShowInlineGoalModal(false);
                  setCurrentExplorationWish(null);
                  await loadLifeGoals();
                } catch (err: any) {
                  console.error('Error creating goal:', err);
                  showToast('Failed to create goal: ' + (err.response?.data?.detail || err.message), 'error');
                }
              }}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label htmlFor="inline-goal-name" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                    Goal Name *
                  </label>
                  <input
                    type="text"
                    id="inline-goal-name"
                    name="name"
                    className="form-control"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0' }}
                    required
                    placeholder="e.g., Become Director in 2 years"
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label htmlFor="inline-goal-category" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                      Category
                    </label>
                    <select
                      id="inline-goal-category"
                      name="category"
                      className="form-control"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0' }}
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
                    <label htmlFor="inline-goal-priority" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                      Priority
                    </label>
                    <select
                      id="inline-goal-priority"
                      name="priority"
                      className="form-control"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0' }}
                      defaultValue="medium"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label htmlFor="inline-goal-start-date" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                      Start Date *
                    </label>
                    <input
                      type="date"
                      id="inline-goal-start-date"
                      name="start_date"
                      className="form-control"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0' }}
                      required
                      defaultValue={new Date().toISOString().split('T')[0]}
                    />
                    <small style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: '4px' }}>
                      When did/will you start?
                    </small>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="inline-goal-target-date" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                      Target Date *
                    </label>
                    <input
                      type="date"
                      id="inline-goal-target-date"
                      name="target_date"
                      className="form-control"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0' }}
                      required
                    />
                    <small style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: '4px' }}>
                      When do you want to achieve this?
                    </small>
                  </div>
                </div>
                
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label htmlFor="inline-goal-description" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                    Description
                  </label>
                  <textarea
                    id="inline-goal-description"
                    name="description"
                    className="form-control"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0', resize: 'vertical' }}
                    rows={3}
                    placeholder="Brief description of this goal"
                  />
                </div>
                
                <div className="modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button 
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowInlineGoalModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)',
                      border: 'none',
                      color: 'white',
                      fontWeight: '600'
                    }}
                  >
                    Create Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Task Form Modal - for adding tasks from dream activities */}
      {showTaskFormModal && (
        <div style={{ position: 'relative', zIndex: 10000 }}>
          <TaskForm
            isOpen={showTaskFormModal}
            onClose={() => {
              setShowTaskFormModal(false);
              setTaskFormWishId(null);
            }}
            onSuccess={async () => {
              setShowTaskFormModal(false);
              setTaskFormWishId(null);
              // Reload wishes and stats
              await loadWishes();
              // Re-open wish modal if there was a selected wish
              if (selectedWish) {
                const updated = await api.get(`/api/wishes/${selectedWish.id}`);
                setSelectedWish(updated.data || updated);
                setShowWishDetailsModal(true);
              }
            }}
            defaultWishId={taskFormWishId || undefined}
          />
        </div>
      )}
      
      {/* Centered Alert Modal */}
      <AlertModal
        isOpen={alertModalOpen}
        message={alertMessage}
        type={alertType}
        onClose={() => setAlertModalOpen(false)}
      />
    </div>
  );
}

