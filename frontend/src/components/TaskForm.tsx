/**
 * Task Form Component
 * Modal form for creating and editing tasks
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Pillar, Category, SubCategory, Goal, FollowUpFrequency } from '../types';
import './TaskForm.css';

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  taskId?: number;
}

interface TaskFormData {
  name: string;
  description: string;
  pillar_id: number | null;
  category_id: number | null;
  sub_category_id: number | null;
  allocated_minutes: number;
  follow_up_frequency: FollowUpFrequency;
  separately_followed: boolean;
  is_part_of_goal: boolean;
  goal_id: number | null;
  why_reason: string;
  additional_whys: string[];
  due_date: string;
}

export default function TaskForm({ isOpen, onClose, onSuccess, taskId }: TaskFormProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    name: '',
    description: '',
    pillar_id: null,
    category_id: null,
    sub_category_id: null,
    allocated_minutes: 60,
    follow_up_frequency: FollowUpFrequency.TODAY,
    separately_followed: false,
    is_part_of_goal: false,
    goal_id: null,
    why_reason: '',
    additional_whys: [],
    due_date: ''
  });

  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPillars();
      loadGoals();
      
      // Load task data if editing
      if (taskId) {
        loadTask(taskId);
      } else {
        // Reset form for new task
        resetForm();
      }
    }
  }, [isOpen, taskId]);

  useEffect(() => {
    if (formData.pillar_id) {
      loadCategories(formData.pillar_id);
      // Reset dependent fields
      setCategories([]);
      setSubCategories([]);
    } else {
      setCategories([]);
      setSubCategories([]);
    }
  }, [formData.pillar_id]);

  useEffect(() => {
    if (formData.category_id) {
      loadSubCategories(formData.category_id);
      // Reset sub-categories while loading
      setSubCategories([]);
    } else {
      setSubCategories([]);
    }
  }, [formData.category_id]);

  const loadPillars = async () => {
    try {
      const data = await api.get<Pillar[]>('/api/pillars/');
      setPillars(data);
    } catch (err) {
      console.error('Error loading pillars:', err);
    }
  };

  const loadCategories = async (pillarId: number) => {
    try {
      const data = await api.get<Category[]>(`/api/categories?pillar_id=${pillarId}`);
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadSubCategories = async (categoryId: number) => {
    try {
      const data = await api.get<SubCategory[]>(`/api/sub-categories?category_id=${categoryId}`);
      setSubCategories(data);
    } catch (err) {
      console.error('Error loading subcategories:', err);
    }
  };

  const loadGoals = async () => {
    try {
      const data = await api.get<Goal[]>('/api/goals/?is_active=true');
      setGoals(data);
    } catch (err) {
      console.error('Error loading goals:', err);
    }
  };

  const loadTask = async (id: number) => {
    try {
      setLoading(true);
      const data: any = await api.get(`/api/tasks/${id}`);
      
      setFormData({
        name: data.name || '',
        description: data.description || '',
        pillar_id: data.pillar_id || null,
        category_id: data.category_id || null,
        sub_category_id: data.sub_category_id || null,
        allocated_minutes: data.allocated_minutes || 60,
        follow_up_frequency: data.follow_up_frequency || FollowUpFrequency.TODAY,
        separately_followed: data.separately_followed || false,
        is_part_of_goal: data.is_part_of_goal || false,
        goal_id: data.goal_id || null,
        why_reason: data.why_reason || '',
        additional_whys: data.additional_whys || [],
        due_date: data.due_date || '',
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading task:', err);
      setError('Failed to load task');
      setLoading(false);
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submitted! Current form data:', formData);
    
    if (!formData.name || !formData.pillar_id || !formData.category_id) {
      const errorMsg = 'Please fill in all required fields (Task Name, Pillar, Category)';
      console.error('Validation error:', errorMsg);
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    if (formData.allocated_minutes <= 0) {
      const errorMsg = 'Please enter a valid time allocation (greater than 0 minutes)';
      console.error('Validation error:', errorMsg);
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const submitData = {
        name: formData.name,
        description: formData.description || undefined,
        pillar_id: formData.pillar_id,
        category_id: formData.category_id,
        sub_category_id: formData.sub_category_id || undefined,
        allocated_minutes: formData.allocated_minutes,
        follow_up_frequency: formData.follow_up_frequency,
        separately_followed: formData.separately_followed,
        is_part_of_goal: formData.is_part_of_goal,
        goal_id: formData.is_part_of_goal ? formData.goal_id : undefined,
        why_reason: formData.why_reason || undefined,
        additional_whys: formData.additional_whys.filter(w => w.trim()).join('|||') || undefined,
        due_date: formData.due_date || undefined,
        is_active: true,
        is_completed: false
      };

      console.log('Submitting task data:', submitData);
      
      let response;
      if (taskId) {
        // Update existing task
        response = await api.put(`/api/tasks/${taskId}`, submitData);
        console.log('Task updated successfully:', response);
        alert('Task updated successfully!');
      } else {
        // Create new task
        response = await api.post('/api/tasks/', submitData);
        console.log('Task created successfully:', response);
        alert('Task created successfully!');
      }
      
      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Error creating task:', err);
      console.error('Error response:', err.response);
      console.error('Error data:', err.response?.data);
      
      let errorMsg = 'Failed to create task';
      
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          errorMsg = err.response.data.detail.map((e: any) => 
            typeof e === 'object' ? JSON.stringify(e) : e
          ).join(', ');
        } else {
          errorMsg = err.response.data.detail;
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      console.error('Formatted error message:', errorMsg);
      setError(errorMsg);
      alert('Error: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      pillar_id: null,
      category_id: null,
      sub_category_id: null,
      allocated_minutes: 60,
      follow_up_frequency: FollowUpFrequency.TODAY,
      separately_followed: false,
      is_part_of_goal: false,
      goal_id: null,
      why_reason: '',
      additional_whys: [],
      due_date: ''
    });
    setError(null);
  };

  const addWhyField = () => {
    setFormData(prev => ({
      ...prev,
      additional_whys: [...prev.additional_whys, '']
    }));
  };

  const updateWhyField = (index: number, value: string) => {
    const newWhys = [...formData.additional_whys];
    newWhys[index] = value;
    setFormData(prev => ({ ...prev, additional_whys: newWhys }));
  };

  const removeWhyField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additional_whys: prev.additional_whys.filter((_, i) => i !== index)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Task</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="task-form">
          {error && <div className="error-message">{error}</div>}

          {/* Task Name */}
          <div className="form-group">
            <label htmlFor="name">Task Name: <span className="required">*</span></label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter task name"
              required
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">Description:</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional task description"
              rows={2}
            />
          </div>

          {/* Pillar */}
          <div className="form-group">
            <label htmlFor="pillar">Pillar: <span className="required">*</span></label>
            <select
              id="pillar"
              value={formData.pillar_id || ''}
              onChange={(e) => setFormData({ ...formData, pillar_id: Number(e.target.value) })}
              required
            >
              <option value="">Select a pillar</option>
              {pillars.map(pillar => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.icon} {pillar.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div className="form-group">
            <label htmlFor="category">Category: <span className="required">*</span></label>
            <select
              id="category"
              value={formData.category_id || ''}
              onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
              disabled={!formData.pillar_id}
              required
            >
              <option value="">Select a category</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sub-Category - Hidden since we don't use subcategories */}
          {/* 
          <div className="form-group" style={{ display: 'none' }}>
            <label htmlFor="sub_category">Sub-Category:</label>
            <select
              id="sub_category"
              value={formData.sub_category_id || ''}
              onChange={(e) => setFormData({ ...formData, sub_category_id: Number(e.target.value) || null })}
              disabled={!formData.category_id}
            >
              <option value="">Select a sub-category (optional)</option>
              {subCategories.map(subCat => (
                <option key={subCat.id} value={subCat.id}>
                  {subCat.name}
                </option>
              ))}
            </select>
          </div>
          */}

          {/* Time Allocated */}
          <div className="form-group">
            <label htmlFor="allocated_time">Time Allocated (minutes): <span className="required">*</span></label>
            <input
              type="text"
              id="allocated_time"
              value={formData.allocated_minutes === 0 ? '' : formData.allocated_minutes}
              onChange={(e) => {
                const value = e.target.value;
                // Only allow numbers
                if (value === '' || /^\d+$/.test(value)) {
                  setFormData({ ...formData, allocated_minutes: value === '' ? 0 : Number(value) });
                }
              }}
              placeholder="Enter minutes (e.g., 60)"
              required
            />
            {formData.allocated_minutes > 0 && (
              <small className="help-text">
                {(formData.allocated_minutes / 60).toFixed(1)} hours
              </small>
            )}
          </div>

          {/* Follow-up Frequency */}
          <div className="form-group">
            <label htmlFor="follow_up">Follow-up Time: <span className="required">*</span></label>
            <select
              id="follow_up"
              value={formData.follow_up_frequency}
              onChange={(e) => setFormData({ ...formData, follow_up_frequency: e.target.value as FollowUpFrequency })}
              required
            >
              <option value={FollowUpFrequency.TODAY}>Today</option>
              <option value={FollowUpFrequency.DAILY}>Daily</option>
              <option value={FollowUpFrequency.WEEKLY}>Weekly</option>
              <option value={FollowUpFrequency.MONTHLY}>Monthly</option>
              <option value={FollowUpFrequency.QUARTERLY}>Quarterly</option>
              <option value={FollowUpFrequency.YEARLY}>Yearly</option>
              <option value={FollowUpFrequency.ONE_TIME}>One Time</option>
            </select>
          </div>

          {/* Due Date */}
          <div className="form-group">
            <label htmlFor="due_date">Due Date:</label>
            <input
              type="date"
              id="due_date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>

          {/* Separately Followed */}
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.separately_followed}
                onChange={(e) => setFormData({ ...formData, separately_followed: e.target.checked })}
              />
              <span>Separately Followed (no time bound)</span>
            </label>
            <small className="help-text">
              Check this for tasks that are tracked separately without strict time constraints
            </small>
          </div>

          {/* Part of a Goal */}
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.is_part_of_goal}
                onChange={(e) => setFormData({ ...formData, is_part_of_goal: e.target.checked, goal_id: null })}
              />
              <span>Part of a Goal</span>
            </label>
          </div>

          {/* Goal Selection */}
          {formData.is_part_of_goal && (
            <div className="form-group">
              <label htmlFor="goal">Select Goal:</label>
              <select
                id="goal"
                value={formData.goal_id || ''}
                onChange={(e) => setFormData({ ...formData, goal_id: Number(e.target.value) || null })}
              >
                <option value="">Select a goal</option>
                {goals.map(goal => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name} ({goal.goal_time_period})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Why Reason */}
          <div className="form-group">
            <label htmlFor="why_reason">Why I am adding this task:</label>
            <input
              type="text"
              id="why_reason"
              value={formData.why_reason}
              onChange={(e) => setFormData({ ...formData, why_reason: e.target.value })}
              placeholder="Explain why this task is important..."
            />
          </div>

          {/* Additional Whys */}
          {formData.additional_whys.map((why, index) => (
            <div key={index} className="form-group additional-why">
              <label htmlFor={`why_${index}`}>Why #{index + 2}:</label>
              <div className="input-with-button">
                <input
                  type="text"
                  id={`why_${index}`}
                  value={why}
                  onChange={(e) => updateWhyField(index, e.target.value)}
                  placeholder="Dig deeper into the reason..."
                />
                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => removeWhyField(index)}
                  title="Remove this why"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn-add-why"
            onClick={addWhyField}
          >
            + Add Another "Why"
          </button>

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
