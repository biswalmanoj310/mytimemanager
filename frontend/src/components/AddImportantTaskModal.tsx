import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Pillar {
  id: number;
  name: string;
  icon: string;
}

interface Category {
  id: number;
  name: string;
  pillar_id: number;
}

interface SubCategory {
  id: number;
  name: string;
  category_id: number;
}

interface AddImportantTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskAdded: () => void;
}

const AddImportantTaskModal: React.FC<AddImportantTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskAdded
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pillar_id: '',
    category_id: '',
    sub_category_id: '',
    ideal_gap_days: '',
    priority: '5'
  });

  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [filteredSubCategories, setFilteredSubCategories] = useState<SubCategory[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadPillarsAndCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.pillar_id) {
      const filtered = categories.filter(c => c.pillar_id === parseInt(formData.pillar_id));
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories([]);
    }
    setFormData(prev => ({ ...prev, category_id: '', sub_category_id: '' }));
  }, [formData.pillar_id, categories]);

  useEffect(() => {
    if (formData.category_id) {
      const filtered = subCategories.filter(sc => sc.category_id === parseInt(formData.category_id));
      setFilteredSubCategories(filtered);
    } else {
      setFilteredSubCategories([]);
    }
    setFormData(prev => ({ ...prev, sub_category_id: '' }));
  }, [formData.category_id, subCategories]);

  const loadPillarsAndCategories = async () => {
    try {
      const [pillarsRes, categoriesRes, subCategoriesRes] = await Promise.all([
        axios.get('http://localhost:8000/api/pillars'),
        axios.get('http://localhost:8000/api/categories'),
        axios.get('http://localhost:8000/api/sub-categories')
      ]);
      setPillars(pillarsRes.data);
      setCategories(categoriesRes.data);
      setSubCategories(subCategoriesRes.data);
    } catch (error) {
      console.error('Error loading pillars and categories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await axios.post('http://localhost:8000/api/important-tasks/', {
        name: formData.name,
        description: formData.description || null,
        pillar_id: formData.pillar_id ? parseInt(formData.pillar_id) : null,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        sub_category_id: formData.sub_category_id ? parseInt(formData.sub_category_id) : null,
        ideal_gap_days: parseInt(formData.ideal_gap_days),
        priority: parseInt(formData.priority)
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        pillar_id: '',
        category_id: '',
        sub_category_id: '',
        ideal_gap_days: '',
        priority: '5'
      });

      onTaskAdded();
      onClose();
    } catch (error) {
      console.error('Error creating important task:', error);
      alert('Failed to create important task');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <h2>Add Important Task</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Task Name *</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Check bank account"
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Optional details about this task"
              style={{ width: '100%', padding: '8px', fontSize: '14px', resize: 'vertical' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="ideal_gap_days">Ideal Gap (Days) *</label>
            <input
              type="number"
              id="ideal_gap_days"
              value={formData.ideal_gap_days}
              onChange={(e) => setFormData({ ...formData, ideal_gap_days: e.target.value })}
              required
              min="1"
              placeholder="e.g., 45 for checking every 45 days"
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            />
            <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
              How many days between checks? (e.g., 7, 30, 45, 90)
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="pillar">Pillar</label>
            <select
              id="pillar"
              value={formData.pillar_id}
              onChange={(e) => setFormData({ ...formData, pillar_id: e.target.value })}
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            >
              <option value="">Select Pillar (Optional)</option>
              {pillars.map(pillar => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.icon} {pillar.name}
                </option>
              ))}
            </select>
          </div>

          {formData.pillar_id && (
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
              >
                <option value="">Select Category (Optional)</option>
                {filteredCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.category_id && filteredSubCategories.length > 0 && (
            <div className="form-group">
              <label htmlFor="sub_category">Sub-Category</label>
              <select
                id="sub_category"
                value={formData.sub_category_id}
                onChange={(e) => setFormData({ ...formData, sub_category_id: e.target.value })}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
              >
                <option value="">Select Sub-Category (Optional)</option>
                {filteredSubCategories.map(subCategory => (
                  <option key={subCategory.id} value={subCategory.id}>
                    {subCategory.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="priority">Priority (1-10)</label>
            <input
              type="number"
              id="priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              min="1"
              max="10"
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            />
            <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
              1 = Highest priority, 10 = Lowest priority
            </small>
          </div>

          <div className="modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              Create Task
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddImportantTaskModal;
