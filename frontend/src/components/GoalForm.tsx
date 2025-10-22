/**
 * Goal Form Component
 * Modal form for creating and editing goals
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Pillar, Category, SubCategory, GoalTimePeriod } from '../types';
import './GoalForm.css';

interface GoalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  goalId?: number;
}

interface GoalFormData {
  name: string;
  description: string;
  pillar_id: number | null;
  category_id: number | null;
  sub_category_id: number | null;
  goal_time_period: GoalTimePeriod;
  allocated_hours: number;
  why_reason: string;
  additional_whys: string[];
  start_date: string;
  end_date: string;
}

export default function GoalForm({ isOpen, onClose, onSuccess }: GoalFormProps) {
  const [formData, setFormData] = useState<GoalFormData>({
    name: '',
    description: '',
    pillar_id: null,
    category_id: null,
    sub_category_id: null,
    goal_time_period: 'MONTH' as GoalTimePeriod,
    allocated_hours: 0,
    why_reason: '',
    additional_whys: [],
    start_date: '',
    end_date: ''
  });

  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load pillars on mount
  useEffect(() => {
    if (isOpen) {
      loadPillars();
    }
  }, [isOpen]);

  // Load categories when pillar changes
  useEffect(() => {
    if (formData.pillar_id) {
      loadCategories(formData.pillar_id);
    } else {
      setCategories([]);
      setSubCategories([]);
      setFormData(prev => ({ ...prev, category_id: null, sub_category_id: null }));
    }
  }, [formData.pillar_id]);

  // Load subcategories when category changes
  useEffect(() => {
    if (formData.category_id) {
      loadSubCategories(formData.category_id);
    } else {
      setSubCategories([]);
      setFormData(prev => ({ ...prev, sub_category_id: null }));
    }
  }, [formData.category_id]);

  const loadPillars = async () => {
    try {
      const response: any = await api.get('/api/pillars/');
      setPillars(response);
    } catch (error) {
      console.error('Failed to load pillars:', error);
    }
  };  const loadCategories = async (pillarId: number) => {
    try {
      const response: any = await api.get(`/api/pillars/${pillarId}/categories`);
      setCategories(response.data as Category[]);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadSubCategories = async (categoryId: number) => {
    try {
      const response: any = await api.get(`/api/categories/${categoryId}/subcategories`);
      setSubCategories(response.data as SubCategory[]);
    } catch (err) {
      console.error('Error loading subcategories:', err);
    }
  };

  const handleInputChange = (field: keyof GoalFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const addWhyField = () => {
    setFormData(prev => ({
      ...prev,
      additional_whys: [...prev.additional_whys, '']
    }));
  };

  const updateWhyField = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      additional_whys: prev.additional_whys.map((why, i) => i === index ? value : why)
    }));
  };

  const removeWhyField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additional_whys: prev.additional_whys.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Goal name is required');
      return;
    }

    if (!formData.pillar_id) {
      setError('Please select a pillar');
      return;
    }

    if (!formData.category_id) {
      setError('Please select a category');
      return;
    }

    if (formData.allocated_hours <= 0) {
      setError('Allocated hours must be greater than 0');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        pillar_id: formData.pillar_id,
        category_id: formData.category_id,
        sub_category_id: formData.sub_category_id || null,
        goal_time_period: formData.goal_time_period,
        allocated_hours: formData.allocated_hours,
        why_reason: formData.why_reason || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null
      };

      await api.post('/api/goals/', payload);
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        name: '',
        description: '',
        pillar_id: null,
        category_id: null,
        sub_category_id: null,
        goal_time_period: 'MONTH' as GoalTimePeriod,
        allocated_hours: 0,
        why_reason: '',
        additional_whys: [],
        start_date: '',
        end_date: ''
      });
    } catch (err: any) {
      console.error('Error creating goal:', err);
      setError(err.response?.data?.detail || 'Failed to create goal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getPillarIcon = (iconName: string) => {
    const icons: { [key: string]: string } = {
      'health': '🏃',
      'relationships': '❤️',
      'career': '💼',
      'personal_growth': '🌱',
      'finances': '💰',
      'spirituality': '🙏',
      'recreation': '🎮'
    };
    return icons[iconName.toLowerCase()] || '📌';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Goal</h2>
          <p className="inspirational-quote">
            "The future belongs to those who believe in the beauty of their dreams."
            <span className="quote-author">— Eleanor Roosevelt</span>
          </p>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="goal-form">
          {error && <div className="error-message">{error}</div>}

          {/* Goal Name */}
          <div className="form-group">
            <label htmlFor="name">Goal Name: <span className="required">*</span></label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter your inspiring goal"
              required
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">Description:</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe your vision for this goal"
              rows={3}
            />
          </div>

          {/* Pillar */}
          <div className="form-group">
            <label htmlFor="pillar">Pillar: <span className="required">*</span></label>
            <select
              id="pillar"
              value={formData.pillar_id || ''}
              onChange={(e) => handleInputChange('pillar_id', e.target.value ? parseInt(e.target.value) : null)}
              required
            >
              <option value="">Select a pillar</option>
              {pillars.map(pillar => (
                <option key={pillar.id} value={pillar.id}>
                  {getPillarIcon(pillar.icon || 'default')} {pillar.name}
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
              onChange={(e) => handleInputChange('category_id', e.target.value ? parseInt(e.target.value) : null)}
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
            {!formData.pillar_id && <span className="help-text">Select a pillar first</span>}
          </div>

          {/* Sub-Category - Hidden since we don't use subcategories */}
          {/* 
          <div className="form-group">
            <label htmlFor="sub_category">Sub-Category:</label>
            <select
              id="sub_category"
              value={formData.sub_category_id || ''}
              onChange={(e) => handleInputChange('sub_category_id', e.target.value ? parseInt(e.target.value) : null)}
              disabled={!formData.category_id}
            >
              <option value="">Select a sub-category (optional)</option>
              {subCategories.map(subCategory => (
                <option key={subCategory.id} value={subCategory.id}>
                  {subCategory.name}
                </option>
              ))}
            </select>
            {!formData.category_id && <span className="help-text">Select a category first</span>}
          </div>
          */}

          {/* Goal Time Period */}
          <div className="form-group">
            <label htmlFor="goal_time_period">Goal Time Period: <span className="required">*</span></label>
            <select
              id="goal_time_period"
              value={formData.goal_time_period}
              onChange={(e) => handleInputChange('goal_time_period', e.target.value as GoalTimePeriod)}
              required
            >
              <option value="WEEK">Weekly Goal</option>
              <option value="MONTH">Monthly Goal</option>
              <option value="QUARTER">Quarterly Goal</option>
              <option value="YEAR">Yearly Goal</option>
            </select>
          </div>

          {/* Allocated Hours */}
          <div className="form-group">
            <label htmlFor="allocated_hours">
              Allocated Hours: <span className="required">*</span>
            </label>
            <input
              type="number"
              id="allocated_hours"
              value={formData.allocated_hours}
              onChange={(e) => handleInputChange('allocated_hours', parseFloat(e.target.value) || 0)}
              min="0"
              step="0.5"
              required
            />
            <span className="help-text">
              Total hours you'll dedicate to this goal
            </span>
          </div>

          {/* Start Date */}
          <div className="form-group">
            <label htmlFor="start_date">Start Date:</label>
            <input
              type="date"
              id="start_date"
              value={formData.start_date}
              onChange={(e) => handleInputChange('start_date', e.target.value)}
            />
          </div>

          {/* End Date */}
          <div className="form-group">
            <label htmlFor="end_date">Target End Date:</label>
            <input
              type="date"
              id="end_date"
              value={formData.end_date}
              onChange={(e) => handleInputChange('end_date', e.target.value)}
            />
          </div>

          {/* Why Reason */}
          <div className="form-group">
            <label htmlFor="why_reason">Why is this goal important to you?</label>
            <textarea
              id="why_reason"
              value={formData.why_reason}
              onChange={(e) => handleInputChange('why_reason', e.target.value)}
              placeholder="Your motivation and purpose behind this goal"
              rows={3}
            />
          </div>

          {/* Additional Whys */}
          {formData.additional_whys.map((why, index) => (
            <div key={index} className="additional-why">
              <div className="form-group">
                <label htmlFor={`additional_why_${index}`}>Additional Why {index + 1}:</label>
                <div className="input-with-button">
                  <textarea
                    id={`additional_why_${index}`}
                    value={why}
                    onChange={(e) => updateWhyField(index, e.target.value)}
                    placeholder="Dig deeper into your motivation"
                    rows={2}
                  />
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => removeWhyField(index)}
                    title="Remove this why"
                  >
                    &times;
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button type="button" className="btn-add-why" onClick={addWhyField}>
            + Add Another Why
          </button>

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
