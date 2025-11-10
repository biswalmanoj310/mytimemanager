/**
 * Add/Edit Challenge Modal Component
 * Uses reusable PillarCategorySelector and TaskSelector components
 * Supports multiple challenge types: daily_streak, count_based, accumulation
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PillarCategorySelector } from './PillarCategorySelector';
import { TaskSelector } from './TaskSelector';

interface Challenge {
  id: number;
  name: string;
  description?: string;
  challenge_type: string;
  start_date: string;
  end_date: string;
  target_days?: number;
  target_count?: number;
  target_value?: number;
  unit?: string;
  difficulty: string;
  why_reason?: string;
  pillar_id?: number | null;
  category_id?: number | null;
  sub_category_id?: number | null;
  linked_task_id?: number | null;
  goal_id?: number | null;
  project_id?: number | null;
  is_active: boolean;
  is_completed: boolean;
}

interface AddChallengeModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingChallenge?: Challenge | null;
}

export const AddChallengeModal: React.FC<AddChallengeModalProps> = ({ 
  show, 
  onClose, 
  onSuccess, 
  editingChallenge 
}) => {
  const [pillarId, setPillarId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<number | null>(null);
  const [linkedTaskId, setLinkedTaskId] = useState<number | null>(null);
  const [goalId, setGoalId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [showTaskLink, setShowTaskLink] = useState(false);
  const [challengeType, setChallengeType] = useState('daily_streak');
  const [goals, setGoals] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  // Fetch goals and projects on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching life-goals, projects, tasks...');
        const [goalsData, projectsData, tasksData] = await Promise.all([
          api.get('/api/life-goals/'),  // Use life-goals endpoint instead of goals
          api.get('/api/projects/'),
          api.get('/api/tasks/')
        ]);
        
        // api.get already returns response.data, so these should be arrays
        console.log('Raw goalsData:', goalsData);
        console.log('Raw projectsData:', projectsData);
        console.log('Raw tasksData:', tasksData);
        
        const goals = Array.isArray(goalsData) ? goalsData : [];
        const projects = Array.isArray(projectsData) ? projectsData : [];
        const tasks = Array.isArray(tasksData) ? tasksData : [];
        
        console.log('Total goals:', goals.length);
        console.log('Total projects:', projects.length);
        console.log('Total tasks:', tasks.length);
        
        // Filter for active items - life goals don't have is_active, they have status
        const activeGoals = goals.filter((g: any) => g.status !== 'cancelled' && g.status !== 'completed');
        const activeProjects = projects.filter((p: any) => p.is_active !== false);
        const activeTasks = tasks.filter((t: any) => t.is_active !== false);
        
        console.log('Active goals:', activeGoals.length, activeGoals);
        console.log('Active projects:', activeProjects.length, activeProjects);
        
        setGoals(activeGoals);
        setProjects(activeProjects);
        setTasks(activeTasks);
      } catch (err) {
        console.error('Error fetching goals/projects:', err);
      }
    };
    
    if (show) {
      fetchData();
    }
  }, [show]);

  // Initialize values when editing
  useEffect(() => {
    if (editingChallenge) {
      setPillarId(editingChallenge.pillar_id || null);
      setCategoryId(editingChallenge.category_id || null);
      setSubCategoryId(editingChallenge.sub_category_id || null);
      setLinkedTaskId(editingChallenge.linked_task_id || null);
      setGoalId(editingChallenge.goal_id || null);
      setProjectId(editingChallenge.project_id || null);
      setChallengeType(editingChallenge.challenge_type);
      setShowTaskLink(!!editingChallenge.linked_task_id);
    } else {
      // Reset for new challenge
      setPillarId(null);
      setCategoryId(null);
      setSubCategoryId(null);
      setLinkedTaskId(null);
      setGoalId(null);
      setProjectId(null);
      setChallengeType('daily_streak');
      setShowTaskLink(false);
    }
  }, [editingChallenge, show]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const type = formData.get('challenge_type') as string;
    const startDate = formData.get('start_date') as string;
    const durationDays = parseInt(formData.get('duration_days') as string);
    
    // Calculate end date
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);
    
    const challengeData: any = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      challenge_type: type,
      start_date: startDate,
      end_date: endDate.toISOString().split('T')[0],
      difficulty: formData.get('difficulty') as string || 'medium',
      why_reason: formData.get('why_reason') as string || null,
      // NEW: Pillar/Category/Task/Goal/Project linking
      pillar_id: pillarId,
      category_id: categoryId,
      sub_category_id: subCategoryId,
      linked_task_id: linkedTaskId,
      auto_sync: linkedTaskId ? true : false, // Auto-sync if linked to a task
      goal_id: goalId,
      project_id: projectId
    };

    // Add type-specific fields
    if (type === 'daily_streak') {
      challengeData.target_days = durationDays;
    } else if (type === 'count_based') {
      challengeData.target_count = parseInt(formData.get('target_count') as string);
      challengeData.unit = formData.get('unit') as string;
    } else if (type === 'accumulation') {
      challengeData.target_value = parseFloat(formData.get('target_value') as string);
      challengeData.unit = formData.get('unit') as string;
    }

    try {
      if (editingChallenge) {
        await api.put(`/api/challenges/${editingChallenge.id}`, challengeData);
        alert('Challenge updated successfully!');
      } else {
        await api.post('/api/challenges/', challengeData);
        alert('Challenge created successfully!');
      }
      
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save challenge');
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editingChallenge ? 'Edit Challenge' : 'Create New Challenge'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Challenge Name */}
            <div className="form-group">
              <label htmlFor="name">Challenge Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder="e.g., Morning Meditation, 10K Steps Daily"
                defaultValue={editingChallenge?.name || ''}
              />
            </div>

            {/* Organization: Pillar / Category / SubCategory */}
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '6px',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ marginBottom: '10px' }}>
                <strong>🎯 Challenge Focus Area</strong>
                <small style={{ display: 'block', color: '#666', marginTop: '4px' }}>
                  Which life area does this challenge improve?
                </small>
              </div>
              <PillarCategorySelector
                selectedPillarId={pillarId}
                selectedCategoryId={categoryId}
                selectedSubCategoryId={subCategoryId}
                onPillarChange={setPillarId}
                onCategoryChange={setCategoryId}
                onSubCategoryChange={setSubCategoryId}
                showSubCategory={false}
                required={true}  // Challenges should be focused!
                layout="vertical"
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                rows={2}
                placeholder="What will you do?"
                defaultValue={editingChallenge?.description || ''}
              />
            </div>

            {/* Challenge Type */}
            <div className="form-group">
              <label htmlFor="challenge_type">Challenge Type *</label>
              <select
                id="challenge_type"
                name="challenge_type"
                required
                value={challengeType}
                onChange={(e) => setChallengeType(e.target.value)}
              >
                <option value="daily_streak">Daily Streak (Yes/No)</option>
                <option value="count_based">Count-Based (Number of times)</option>
                <option value="accumulation">Time/Value-Based (Total minutes/hours)</option>
              </select>
              <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                • Daily Streak: Track if you did it each day<br/>
                • Count-Based: Track how many times (pushups, pages, etc.)<br/>
                • Time/Value-Based: Track total time or values
              </small>
            </div>

            {/* Target Fields (hidden for daily_streak) */}
            {challengeType !== 'daily_streak' && (
              <>
                {challengeType === 'count_based' && (
                  <div className="form-group">
                    <label htmlFor="target_count">Daily Target *</label>
                    <input
                      type="number"
                      id="target_count"
                      name="target_count"
                      min="1"
                      placeholder="e.g., 20, 10000"
                      defaultValue={editingChallenge?.target_count || ''}
                      required
                    />
                  </div>
                )}

                {challengeType === 'accumulation' && (
                  <div className="form-group">
                    <label htmlFor="target_value">Total Target *</label>
                    <input
                      type="number"
                      id="target_value"
                      name="target_value"
                      min="1"
                      step="0.1"
                      placeholder="e.g., 600 (for 600 minutes total)"
                      defaultValue={editingChallenge?.target_value || ''}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="unit">Unit *</label>
                  <input
                    type="text"
                    id="unit"
                    name="unit"
                    placeholder="e.g., pushups, pages, minutes, steps"
                    defaultValue={editingChallenge?.unit || ''}
                    required
                  />
                </div>
              </>
            )}

            {/* Start Date and Duration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="start_date">Start Date *</label>
                <input
                  type="date"
                  id="start_date"
                  name="start_date"
                  required
                  defaultValue={editingChallenge?.start_date || new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="form-group">
                <label htmlFor="duration_days">Duration (days) *</label>
                <input
                  type="number"
                  id="duration_days"
                  name="duration_days"
                  min="1"
                  required
                  placeholder="e.g., 30, 66, 90"
                  defaultValue={
                    editingChallenge && editingChallenge.start_date && editingChallenge.end_date
                      ? Math.ceil((new Date(editingChallenge.end_date).getTime() - new Date(editingChallenge.start_date).getTime()) / (1000 * 60 * 60 * 24))
                      : 30
                  }
                />
              </div>
            </div>

            {/* Difficulty */}
            <div className="form-group">
              <label htmlFor="difficulty">Difficulty</label>
              <select
                id="difficulty"
                name="difficulty"
                defaultValue={editingChallenge?.difficulty || 'medium'}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            {/* Optional: Link to Task */}
            <div style={{ 
              marginBottom: '16px', 
              padding: '12px', 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px',
              backgroundColor: '#f9f9f9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold', margin: 0 }}>
                  📋 Track via Daily Task (Optional)
                </label>
                <button
                  type="button"
                  onClick={() => setShowTaskLink(!showTaskLink)}
                  style={{
                    padding: '4px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    background: showTaskLink ? '#007bff' : 'white',
                    color: showTaskLink ? 'white' : '#333',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {showTaskLink ? 'Hide' : 'Show'}
                </button>
              </div>
              
              {showTaskLink && (
                <div style={{ marginTop: '12px' }}>
                  <TaskSelector
                    selectedTaskId={linkedTaskId}
                    onTaskChange={(id) => setLinkedTaskId(id)}
                    filterByPillar={pillarId || undefined}
                    filterByCategory={categoryId || undefined}
                    showFrequencyFilter={true}
                    showTaskDetails={true}
                    placeholder="-- No Task --"
                  />
                </div>
              )}
            </div>

            {/* Optional: Link to Goal */}
            <div style={{ 
              marginBottom: '16px', 
              padding: '12px', 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px',
              backgroundColor: '#f0f8ff'
            }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                🎯 Link to Goal (Optional)
              </label>
              <select
                value={goalId || ''}
                onChange={(e) => setGoalId(e.target.value ? parseInt(e.target.value) : null)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">-- No Goal --</option>
                {goals.map((goal: any) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </select>
              <small style={{ color: '#666', display: 'block', marginTop: '8px' }}>
                💡 Connect this challenge to a larger goal
              </small>
            </div>

            {/* Optional: Link to Project */}
            <div style={{ 
              marginBottom: '16px', 
              padding: '12px', 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px',
              backgroundColor: '#fff8f0'
            }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                📂 Link to Project (Optional)
              </label>
              <select
                value={projectId || ''}
                onChange={(e) => setProjectId(e.target.value ? parseInt(e.target.value) : null)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">-- No Project --</option>
                {projects.map((project: any) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <small style={{ color: '#666', display: 'block', marginTop: '8px' }}>
                💡 Associate this challenge with a project
              </small>
            </div>

            {/* Why Reason */}
            <div className="form-group">
              <label htmlFor="why_reason">Why This Challenge? (Your Motivation)</label>
              <textarea
                id="why_reason"
                name="why_reason"
                rows={2}
                placeholder="What will you gain from completing this challenge?"
                defaultValue={editingChallenge?.why_reason || ''}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingChallenge ? 'Update Challenge' : 'Create Challenge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
