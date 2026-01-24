/**
 * Add/Edit Life Goal Modal Component
 * Uses reusable PillarCategorySelector component
 * Supports sub-goals, milestones, and comprehensive why statements
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatDateForInput } from '../utils/dateHelpers';
import { PillarCategorySelector } from './PillarCategorySelector';
import { AlertModal } from './AlertModal';

interface LifeGoal {
  id: number;
  name: string;
  parent_goal_id?: number | null;
  start_date: string;
  target_date: string;
  actual_completion_date?: string | null;
  status: string;
  category?: string;
  priority: string;
  why_statements?: string[];
  description?: string;
  progress_percentage: number;
  time_allocated_hours: number;
  time_spent_hours: number;
  pillar_id?: number | null;
  category_id?: number | null;
  sub_category_id?: number | null;
  related_wish_id?: number | null;
}

interface AddGoalModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingGoal?: LifeGoal | null;
  lifeGoals: LifeGoal[];
}

export const AddGoalModal: React.FC<AddGoalModalProps> = ({ 
  show, 
  onClose, 
  onSuccess, 
  editingGoal,
  lifeGoals 
}) => {
  const [pillarId, setPillarId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<number | null>(null);
  const [whyCount, setWhyCount] = useState(3);
  
  // Alert Modal State
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  const [shouldCloseAfterAlert, setShouldCloseAfterAlert] = useState(false);
  
  const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success', closeAfter: boolean = false) => {
    setAlertMessage(message);
    setAlertType(type);
    setAlertModalOpen(true);
    setShouldCloseAfterAlert(closeAfter);
  };
  
  const handleAlertClose = () => {
    setAlertModalOpen(false);
    if (shouldCloseAfterAlert) {
      setShouldCloseAfterAlert(false);
      onSuccess();
      onClose();
    }
  };

  // Initialize values when editing
  useEffect(() => {
    console.log('🎯 Modal useEffect - editingGoal:', editingGoal);
    if (editingGoal) {
      console.log('🎯 editingGoal.related_wish_id:', editingGoal.related_wish_id);
      setPillarId(editingGoal.pillar_id || null);
      setCategoryId(editingGoal.category_id || null);
      setSubCategoryId(editingGoal.sub_category_id || null);
      if (editingGoal.why_statements) {
        setWhyCount(Math.max(3, editingGoal.why_statements.length));
      }
    } else {
      // Reset for new goal
      setPillarId(null);
      setCategoryId(null);
      setSubCategoryId(null);
      setWhyCount(3);
    }
  }, [editingGoal, show]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
        start_date: formData.get('start_date') || formatDateForInput(new Date()),
        target_date: formData.get('target_date'),
        category: formData.get('category') || null,
        priority: formData.get('priority') || 'medium',
        why_statements: whyStatements,
        description: formData.get('description') || null,
        time_allocated_hours: parseFloat(formData.get('time_allocated_hours') as string) || 0,
        // NEW: Pillar/Category linking
        pillar_id: pillarId,
        category_id: categoryId,
        sub_category_id: subCategoryId,
        // Link to dream if provided
        related_wish_id: editingGoal?.related_wish_id || null
      };
      
      console.log('🎯 Saving goal with data:', goalData);
      console.log('🎯 editingGoal:', editingGoal);
      
      if (editingGoal && editingGoal.id) {
        await api.put(`/api/life-goals/${editingGoal.id}`, goalData);
        showAlert('Goal updated successfully!', 'success', true);
      } else {
        await api.post('/api/life-goals/', goalData);
        showAlert('Goal created successfully!', 'success', true);
      }
      
      // Don't close immediately - wait for alert to be dismissed
    } catch (err: any) {
      console.error('Error saving goal:', err);
      const errorMessage = err.response?.data?.detail 
        ? (typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : JSON.stringify(err.response.data.detail))
        : err.message || 'Unknown error';
      showAlert('Failed to save goal: ' + errorMessage, 'error');
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editingGoal ? 'Edit Life Goal' : 'Add New Life Goal'}</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            {/* Goal Name */}
            <div className="form-group">
              <label htmlFor="goal-name">Goal Name *</label>
              <input
                type="text"
                id="goal-name"
                name="name"
                className="form-control"
                required
                placeholder="e.g., Become Director in 2 years"
                defaultValue={editingGoal?.name || ''}
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
                <strong>🎯 Align Your Goal</strong>
                <small style={{ display: 'block', color: '#666', marginTop: '4px' }}>
                  Connect this goal to your life pillars for better focus and motivation
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
                required={false}  // Optional - goals can be aligned to pillars
                layout="vertical"
              />
            </div>

            {/* Old Category (keeping for now for data migration) */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="goal-category">Additional Category Tag</label>
                <select
                  id="goal-category"
                  name="category"
                  className="form-control"
                  defaultValue={editingGoal?.category || ''}
                >
                  <option value="">-- Optional --</option>
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
                  defaultValue={editingGoal?.priority || 'medium'}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="goal-start-date">Start Date *</label>
                <input
                  type="date"
                  id="goal-start-date"
                  name="start_date"
                  className="form-control"
                  required
                  defaultValue={editingGoal?.start_date || formatDateForInput(new Date())}
                />
                <small className="form-text">
                  When did/will you start working on this goal?
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
                  defaultValue={editingGoal?.target_date || ''}
                />
                <small className="form-text">
                  When do you want to achieve this goal?
                </small>
              </div>
            </div>

            {/* Parent Goal (for sub-goals) */}
            <div className="form-group">
              <label htmlFor="goal-parent">Parent Goal (Optional - for sub-goals)</label>
              <select
                id="goal-parent"
                name="parent_goal_id"
                className="form-control"
                defaultValue={editingGoal?.parent_goal_id || ''}
              >
                <option value="">-- None (Root Goal) --</option>
                {lifeGoals
                  .filter(g => !g.parent_goal_id && g.id !== editingGoal?.id)
                  .map(goal => (
                    <option key={goal.id} value={goal.id}>
                      {goal.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Time Allocation */}
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
                defaultValue={editingGoal?.time_allocated_hours || ''}
              />
              <small className="form-text">Total hours you estimate this goal will take</small>
            </div>

            {/* Why Statements */}
            <div className="form-group">
              <label>Why This Goal Matters (Your Motivation)</label>
              {Array.from({ length: whyCount }).map((_, index) => (
                <div key={index} className="why-statement-input" style={{ marginBottom: '8px' }}>
                  <input
                    type="text"
                    name={`why_${index}`}
                    className="form-control"
                    placeholder={`Reason ${index + 1}: e.g., Career growth, Better life balance...`}
                    defaultValue={editingGoal?.why_statements?.[index] || ''}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setWhyCount(whyCount + 1)}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer',
                  marginTop: '8px'
                }}
              >
                + Add Another Why
              </button>
            </div>

            {/* Description */}
            <div className="form-group">
              <label htmlFor="goal-description">Description</label>
              <textarea
                id="goal-description"
                name="description"
                className="form-control"
                rows={3}
                placeholder="Describe your goal in detail..."
                defaultValue={editingGoal?.description || ''}
              />
            </div>

            {/* Actions */}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingGoal?.id ? 'Update Goal' : 'Create Goal'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Centered Alert Modal */}
      <AlertModal
        isOpen={alertModalOpen}
        message={alertMessage}
        type={alertType}
        onClose={handleAlertClose}
      />
    </div>
  );
};
