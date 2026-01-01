/**
 * Task Form Component
 * Modal form for creating and editing tasks
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Pillar, Category, SubCategory, Goal, FollowUpFrequency, TaskType } from '../types';
import './TaskForm.css';

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdTaskId?: number) => void;
  taskId?: number;
  defaultFrequency?: FollowUpFrequency;
  defaultWishId?: number;
  defaultParentTaskId?: number;
}

interface TaskFormData {
  name: string;
  description: string;
  pillar_id: number | null;
  category_id: number | null;
  sub_category_id: number | null;
  task_type: TaskType;
  allocated_minutes: number;
  target_value: number | null;
  unit: string;
  follow_up_frequency: FollowUpFrequency;
  separately_followed: boolean;
  is_daily_one_time: boolean;
  is_part_of_goal: boolean;
  goal_id: number | null;
  project_id: number | null;
  related_wish_id: number | null;
  why_reason: string;
  additional_whys: string[];
  due_date: string;
  priority: number;
  parent_task_id: number | null;
  ideal_gap_days?: number;
}

export default function TaskForm({ isOpen, onClose, onSuccess, taskId, defaultFrequency, defaultWishId, defaultParentTaskId }: TaskFormProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    name: '',
    description: '',
    pillar_id: null,
    category_id: null,
    sub_category_id: null,
    task_type: TaskType.TIME,
    allocated_minutes: 60,
    target_value: null,
    unit: '',
    follow_up_frequency: defaultFrequency || FollowUpFrequency.TODAY,
    separately_followed: false,
    is_daily_one_time: false,
    is_part_of_goal: false,
    goal_id: null,
    project_id: null,
    related_wish_id: null,
    why_reason: '',
    additional_whys: [],
    due_date: '',
    priority: 5,
    parent_task_id: defaultParentTaskId || null
  });

  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wishes, setWishes] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Progressive disclosure states
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [showWishSelect, setShowWishSelect] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPillars();
      loadGoals();
      loadWishes();
      loadProjects();
      
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
      const data = await api.get<any[]>('/api/life-goals/');
      console.log('Life goals loaded:', data);
      // Map to Goal structure, using only the fields we need
      const mappedGoals = data.map(lg => ({
        id: lg.id,
        name: lg.name,
        description: lg.description || '',
        is_active: lg.status === 'active'
      })) as Goal[];
      setGoals(mappedGoals);
    } catch (err) {
      console.error('Error loading life goals:', err);
    }
  };

  const loadWishes = async () => {
    try {
      const data = await api.get<any[]>('/api/wishes/');
      console.log('Wishes loaded:', data);
      setWishes(data);
    } catch (err) {
      console.error('Error loading wishes:', err);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await api.get<any[]>('/api/projects/');
      console.log('Projects loaded (raw):', data);
      const activeProjects = data.filter((p: any) => p.status === 'active');
      console.log('Active projects:', activeProjects);
      console.log('All project statuses:', data.map(p => ({ id: p.id, name: p.name, status: p.status })));
      setProjects(activeProjects);
    } catch (err) {
      console.error('Error loading projects:', err);
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
        task_type: data.task_type || TaskType.TIME,
        allocated_minutes: data.allocated_minutes || 60,
        target_value: data.target_value || null,
        unit: data.unit || '',
        follow_up_frequency: data.follow_up_frequency || FollowUpFrequency.TODAY,
        separately_followed: data.separately_followed || false,
        is_daily_one_time: data.is_daily_one_time || false,
        is_part_of_goal: data.is_part_of_goal || false,
        goal_id: data.goal_id || null,
        project_id: data.project_id || null,
        related_wish_id: data.related_wish_id || null,
        why_reason: data.why_reason || '',
        additional_whys: data.additional_whys || [],
        due_date: data.due_date || '',
        priority: data.priority || 5,
      });
      
      // Set progressive disclosure states based on existing data
      setShowProjectSelect(!!data.project_id);
      setShowWishSelect(!!data.related_wish_id);
      
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

    // Validate based on task type
    if (formData.task_type === TaskType.TIME) {
      if (formData.allocated_minutes <= 0) {
        const errorMsg = 'Please enter a valid time allocation (greater than 0 minutes)';
        console.error('Validation error:', errorMsg);
        setError(errorMsg);
        alert(errorMsg);
        return;
      }
    } else if (formData.task_type === TaskType.COUNT) {
      if (!formData.target_value || formData.target_value <= 0) {
        const errorMsg = 'Please enter a valid target count (greater than 0)';
        console.error('Validation error:', errorMsg);
        setError(errorMsg);
        alert(errorMsg);
        return;
      }
      if (!formData.unit || formData.unit.trim() === '') {
        const errorMsg = 'Please enter a unit (e.g., reps, glasses, miles)';
        console.error('Validation error:', errorMsg);
        setError(errorMsg);
        alert(errorMsg);
        return;
      }
    }
    // BOOLEAN type needs no additional validation

    try {
      setLoading(true);
      setError(null);

      const submitData = {
        name: formData.name,
        description: formData.description || undefined,
        pillar_id: formData.pillar_id,
        category_id: formData.category_id,
        sub_category_id: formData.sub_category_id || undefined,
        task_type: formData.task_type,
        allocated_minutes: formData.task_type === TaskType.TIME ? formData.allocated_minutes : 0,
        target_value: formData.task_type === TaskType.COUNT ? formData.target_value : undefined,
        unit: formData.task_type === TaskType.COUNT ? formData.unit : undefined,
        follow_up_frequency: formData.follow_up_frequency,
        separately_followed: formData.separately_followed,
        is_daily_one_time: formData.is_daily_one_time,
        is_part_of_goal: formData.is_part_of_goal,
        goal_id: formData.is_part_of_goal ? formData.goal_id : undefined,
        project_id: formData.project_id || undefined,
        related_wish_id: formData.related_wish_id || undefined,
        parent_task_id: formData.parent_task_id || undefined,
        why_reason: formData.why_reason || undefined,
        additional_whys: formData.additional_whys.filter(w => w.trim()).join('|||') || undefined,
        due_date: formData.due_date ? (formData.due_date.includes('T') ? formData.due_date : `${formData.due_date}T00:00:00`) : undefined,
        priority: formData.priority,
        is_active: true,
        is_completed: false
      };

      console.log('Submitting task data:', submitData);
      
      let response: any;
      let createdTaskId: number | undefined;
      
      if (taskId) {
        // Update existing task
        response = await api.put(`/api/tasks/${taskId}`, submitData);
        console.log('Task updated successfully:', response);
        createdTaskId = taskId;
      } else {
        // Create new task
        response = await api.post('/api/tasks/', submitData);
        console.log('Task created successfully:', response);
        // Extract the task ID from the response
        createdTaskId = response?.data?.id || response?.id;
        
        // If this is an Important Task (ONE_TIME) with ideal_gap_days, create in important_tasks table
        if (formData.follow_up_frequency === FollowUpFrequency.ONE_TIME && formData.ideal_gap_days) {
          try {
            const importantTaskData = {
              name: formData.name,
              description: formData.description || undefined,
              pillar_id: formData.pillar_id || undefined,
              category_id: formData.category_id || undefined,
              sub_category_id: formData.sub_category_id || undefined,
              ideal_gap_days: formData.ideal_gap_days,
              priority: formData.priority
            };
            await api.post('/api/important-tasks/', importantTaskData);
            console.log('Important task tracking created');
          } catch (importantErr) {
            console.error('Failed to create important task tracking:', importantErr);
            // Don't fail the whole operation - task was created successfully
          }
        }
      }
      
      onSuccess(createdTaskId);
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
      task_type: TaskType.TIME,
      allocated_minutes: 60,
      target_value: null,
      unit: '',
      follow_up_frequency: defaultFrequency || FollowUpFrequency.TODAY,
      separately_followed: false,
      is_daily_one_time: false,
      is_part_of_goal: false,
      goal_id: null,
      project_id: null,
      related_wish_id: defaultWishId || null,
      why_reason: '',
      additional_whys: [],
      due_date: '',
      priority: 5
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
          <h2>{taskId ? 'Edit Task' : 'Add New Task'}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="task-form-compact">
          {error && <div className="error-message">{error}</div>}

          {/* Inline: Task Name */}
          <div className="form-row-inline">
            <label htmlFor="name" className="inline-label">Task Name: <span className="required">*</span></label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter task name"
              required
              className="flex-input"
            />
          </div>

          {/* Inline: Description */}
          <div className="form-row-inline">
            <label htmlFor="description" className="inline-label">Description:</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional"
              rows={2}
              className="flex-input"
            />
          </div>

          <div className="section-divider"></div>

          {/* Same row: Pillar and Category */}
          <div className="form-row-dual">
            <div className="form-col">
              <label htmlFor="pillar">Pillar: <span className="required">*</span></label>
              <select
                id="pillar"
                value={formData.pillar_id || ''}
                onChange={(e) => setFormData({ ...formData, pillar_id: Number(e.target.value) })}
                required
              >
                <option value="">Select</option>
                {pillars.map(pillar => (
                  <option key={pillar.id} value={pillar.id}>
                    {pillar.icon} {pillar.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-col">
              <label htmlFor="category">Category: <span className="required">*</span></label>
              <select
                id="category"
                value={formData.category_id || ''}
                onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
                disabled={!formData.pillar_id}
                required
              >
                <option value="">Select</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="section-divider"></div>

          {/* Same row: Follow-up Time and Task Type */}
          <div className="form-row-dual">
            <div className="form-col">
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
                <option value={FollowUpFrequency.ONE_TIME}>Important</option>
                <option value={FollowUpFrequency.MISC}>Misc Task</option>
              </select>
            </div>
            <div className="form-col">
              <label>Task Type: <span className="required">*</span></label>
              <select
                value={formData.task_type}
                onChange={(e) => setFormData({ ...formData, task_type: e.target.value as TaskType })}
                required
              >
                <option value={TaskType.TIME}>⏱️ Time</option>
                <option value={TaskType.COUNT}>🔢 Count</option>
                <option value={TaskType.BOOLEAN}>✅ Yes/No</option>
              </select>
            </div>
          </div>

          {/* Conditional: Time allocated */}
          {formData.task_type === TaskType.TIME && (
            <div className="form-row-inline">
              <label htmlFor="allocated_time" className="inline-label-short">Minutes: <span className="required">*</span></label>
              <input
                type="number"
                id="allocated_time"
                value={formData.allocated_minutes === 0 ? '' : formData.allocated_minutes}
                onChange={(e) => setFormData({ ...formData, allocated_minutes: e.target.value ? Number(e.target.value) : 0 })}
                placeholder="60"
                required
                className="small-input"
              />
              {formData.allocated_minutes > 0 && (
                <span className="inline-hint">{(formData.allocated_minutes / 60).toFixed(1)}h</span>
              )}
            </div>
          )}

          {/* Conditional: Count + Unit */}
          {formData.task_type === TaskType.COUNT && (
            <div className="form-row-dual">
              <div className="form-col">
                <label htmlFor="target_value">Target: <span className="required">*</span></label>
                <input
                  type="number"
                  id="target_value"
                  value={formData.target_value || ''}
                  onChange={(e) => setFormData({ ...formData, target_value: e.target.value ? Number(e.target.value) : null })}
                  placeholder="10"
                  min="1"
                  required
                />
              </div>
              <div className="form-col">
                <label htmlFor="unit">Unit: <span className="required">*</span></label>
                <input
                  type="text"
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="reps, glasses, pages"
                  required
                />
              </div>
            </div>
          )}

          {/* Conditional: Daily One Time checkbox - only for daily tasks */}
          {formData.follow_up_frequency === FollowUpFrequency.DAILY && (
            <div className="form-row-checkbox">
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={formData.is_daily_one_time}
                  onChange={(e) => setFormData({ ...formData, is_daily_one_time: e.target.checked })}
                />
                <span>Is this a Daily One Time Task?</span>
              </label>
            </div>
          )}

          {/* Conditional: Ideal Gap for Important tasks */}
          {formData.follow_up_frequency === FollowUpFrequency.ONE_TIME && (
            <div className="form-row-inline">
              <label htmlFor="ideal_gap_days" className="inline-label-short">Gap (Days): <span className="required">*</span></label>
              <input
                type="number"
                id="ideal_gap_days"
                min="1"
                value={formData.ideal_gap_days || ''}
                onChange={(e) => setFormData({ ...formData, ideal_gap_days: parseInt(e.target.value) || undefined })}
                placeholder="e.g., 45"
                required
                className="small-input"
              />
              <span className="inline-hint">days between checks</span>
            </div>
          )}

          <div className="section-divider"></div>

          {/* Same row: Goal checkbox + dropdown */}
          <div className="form-row-inline">
            <label className="checkbox-inline narrow">
              <input
                type="checkbox"
                checked={formData.is_part_of_goal}
                onChange={(e) => setFormData({ ...formData, is_part_of_goal: e.target.checked, goal_id: null })}
              />
              <span>Goal:</span>
            </label>
            {formData.is_part_of_goal && (
              <select
                value={formData.goal_id || ''}
                onChange={(e) => setFormData({ ...formData, goal_id: Number(e.target.value) || null })}
                className="flex-input-small"
              >
                <option value="">Select goal</option>
                {goals.map(goal => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Same row: Project checkbox + dropdown */}
          <div className="form-row-inline">
            <label className="checkbox-inline narrow">
              <input
                type="checkbox"
                checked={showProjectSelect}
                onChange={(e) => {
                  setShowProjectSelect(e.target.checked);
                  if (!e.target.checked) {
                    setFormData({ ...formData, project_id: null });
                  }
                }}
              />
              <span>Project:</span>
            </label>
            {showProjectSelect && (
              <select
                value={formData.project_id || ''}
                onChange={(e) => setFormData({ ...formData, project_id: Number(e.target.value) || null })}
                className="flex-input-small"
              >
                <option value="">Select project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Same row: Dream checkbox + dropdown */}
          <div className="form-row-inline">
            <label className="checkbox-inline narrow">
              <input
                type="checkbox"
                checked={showWishSelect}
                onChange={(e) => {
                  setShowWishSelect(e.target.checked);
                  if (!e.target.checked) {
                    setFormData({ ...formData, related_wish_id: null });
                  }
                }}
              />
              <span>Dream:</span>
            </label>
            {showWishSelect && (
              <select
                value={formData.related_wish_id || ''}
                onChange={(e) => setFormData({ ...formData, related_wish_id: Number(e.target.value) || null })}
                className="flex-input-small"
              >
                <option value="">Select dream</option>
                {wishes.map(wish => (
                  <option key={wish.id} value={wish.id}>
                    {wish.title} {wish.status === 'exploring' ? '🔬' : '💭'}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="section-divider"></div>

          {/* Optional: Due Date and Priority in same row */}
          <div className="form-row-dual">
            <div className="form-col">
              <label htmlFor="due_date">Due Date:</label>
              <input
                type="date"
                id="due_date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
            <div className="form-col">
              <label htmlFor="priority">Priority:</label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              >
                <option value={1}>1 - Highest</option>
                <option value={2}>2 - Very High</option>
                <option value={3}>3 - High</option>
                <option value={5}>5 - Normal</option>
                <option value={7}>7 - Low</option>
                <option value={10}>10 - Lowest</option>
              </select>
            </div>
          </div>

          {/* Optional: Why field - collapsible */}
          <details className="why-section">
            <summary>💭 Why am I adding this task? (Optional)</summary>
            <input
              type="text"
              value={formData.why_reason}
              onChange={(e) => setFormData({ ...formData, why_reason: e.target.value })}
              placeholder="Explain the purpose..."
              className="why-input"
            />
            {formData.additional_whys.map((why, index) => (
              <div key={index} className="why-field">
                <input
                  type="text"
                  value={why}
                  onChange={(e) => updateWhyField(index, e.target.value)}
                  placeholder={`Why #${index + 2}`}
                />
                <button
                  type="button"
                  className="btn-remove-mini"
                  onClick={() => removeWhyField(index)}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-add-mini"
              onClick={addWhyField}
            >
              + Add deeper why
            </button>
          </details>

          {/* Form Actions */}
          <div className="form-actions-compact">
            <button type="button" className="btn btn-secondary-compact" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary-compact" disabled={loading}>
              {loading ? '...' : (taskId ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
