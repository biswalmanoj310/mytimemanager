import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import { useTaskContext } from '../contexts/TaskContext';
import './MyDayDesign.css';

interface Profile {
  name: string;
  display_name: string;
  size_kb: number;
  is_current: boolean;
}

interface CurrentProfile {
  profile: string;
  display_name: string;
  size_kb: number;
  is_production: boolean;
  production_backup_exists: boolean;
}

interface Pillar {
  id: number;
  name: string;
  allocated_minutes: number;
  description?: string;
}

interface Category {
  id: number;
  name: string;
  pillar_id: number;
  pillar_name?: string;
}

const PILLAR_ICONS: Record<string, string> = {
  'Hard Work': '💼',
  'Calmness': '🧘',
  'Family': '👨‍👩‍👦'
};

const MyDayDesign: React.FC = () => {
  const { refreshAll } = useTaskContext();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  // Active section
  const [activeSection, setActiveSection] = useState<'pillars' | 'categories' | 'profiles'>('pillars');
  
  // Pillar states
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [isAddingPillar, setIsAddingPillar] = useState(false);
  const [editingPillar, setEditingPillar] = useState<Pillar | null>(null);
  const [newPillar, setNewPillar] = useState({ name: '', allocated_minutes: 480, description: '' });
  
  // Category states
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', pillar_id: 0 });

  useEffect(() => {
    loadPillars();
    loadCategories();
    loadProfiles();
    loadCurrentProfile();
  }, []);

  // Pillar Management Functions
  const loadPillars = async () => {
    try {
      const response = await apiClient.get('/api/pillars/');
      setPillars(response.data);
    } catch (error) {
      console.error('Error loading pillars:', error);
    }
  };

  const handleCreatePillar = async () => {
    if (!newPillar.name.trim()) {
      setMessage({ text: 'Pillar name is required', type: 'error' });
      return;
    }

    try {
      await apiClient.post('/api/pillars/', newPillar);
      setMessage({ text: 'Pillar created successfully!', type: 'success' });
      setNewPillar({ name: '', allocated_minutes: 480, description: '' });
      setIsAddingPillar(false);
      await loadPillars();
      await refreshAll();
    } catch (error: any) {
      setMessage({ text: error.response?.data?.detail || 'Failed to create pillar', type: 'error' });
    }
  };

  const handleUpdatePillar = async () => {
    if (!editingPillar) return;

    try {
      await apiClient.put(`/api/pillars/${editingPillar.id}`, {
        name: editingPillar.name,
        allocated_minutes: editingPillar.allocated_minutes,
        description: editingPillar.description
      });
      setMessage({ text: 'Pillar updated successfully!', type: 'success' });
      setEditingPillar(null);
      await loadPillars();
      await refreshAll();
    } catch (error: any) {
      setMessage({ text: error.response?.data?.detail || 'Failed to update pillar', type: 'error' });
    }
  };

  const handleDeletePillar = async (pillarId: number, pillarName: string) => {
    if (!confirm(`Delete pillar "${pillarName}"? This will also delete all associated categories and tasks.`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/pillars/${pillarId}`);
      setMessage({ text: 'Pillar deleted successfully!', type: 'success' });
      await loadPillars();
      await refreshAll();
    } catch (error: any) {
      setMessage({ text: error.response?.data?.detail || 'Failed to delete pillar', type: 'error' });
    }
  };

  // Category Management Functions
  const loadCategories = async () => {
    try {
      const response = await apiClient.get('/api/categories/');
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim() || newCategory.pillar_id === 0) {
      setMessage({ text: 'Category name and pillar are required', type: 'error' });
      return;
    }

    try {
      await apiClient.post('/api/categories/', newCategory);
      setMessage({ text: 'Category created successfully!', type: 'success' });
      setNewCategory({ name: '', pillar_id: 0 });
      setIsAddingCategory(false);
      await loadCategories();
      await refreshAll();
    } catch (error: any) {
      setMessage({ text: error.response?.data?.detail || 'Failed to create category', type: 'error' });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    try {
      await apiClient.put(`/api/categories/${editingCategory.id}`, {
        name: editingCategory.name,
        pillar_id: editingCategory.pillar_id
      });
      setMessage({ text: 'Category updated successfully!', type: 'success' });
      setEditingCategory(null);
      await loadCategories();
      await refreshAll();
    } catch (error: any) {
      setMessage({ text: error.response?.data?.detail || 'Failed to update category', type: 'error' });
    }
  };

  const handleDeleteCategory = async (categoryId: number, categoryName: string) => {
    if (!confirm(`Delete category "${categoryName}"? This will also delete all associated tasks.`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/categories/${categoryId}`);
      setMessage({ text: 'Category deleted successfully!', type: 'success' });
      await loadCategories();
      await refreshAll();
    } catch (error: any) {
      setMessage({ text: error.response?.data?.detail || 'Failed to delete category', type: 'error' });
    }
  };

  // Profile Management Functions
  const loadProfiles = async () => {
    try {
      const response = await apiClient.get('/api/profiles/profiles');
      setProfiles(response.data.profiles || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const loadCurrentProfile = async () => {
    try {
      const response = await apiClient.get('/api/profiles/current');
      setCurrentProfile(response.data);
    } catch (error) {
      console.error('Error loading current profile:', error);
    }
  };

  const handleSwitchProfile = async (profileName: string) => {
    if (!confirm(`Switch to ${profileName === 'production' ? 'YOUR production data' : `${profileName}'s test data`}?\n\nApp will reload automatically.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post(`/api/profiles/switch/${profileName}`);
      setMessage({
        text: response.data.message,
        type: 'success'
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      setMessage({
        text: error.response?.data?.detail || 'Failed to switch profile',
        type: 'error'
      });
      setLoading(false);
    }
  };

  return (
    <div className="my-day-design-container">
      <div className="design-header">
        <h1>🎨 My Day Design</h1>
        <p className="subtitle">Configure your life structure and database profiles</p>
      </div>

      {/* Section Tabs */}
      <div className="section-tabs">
        <button 
          className={`tab-button ${activeSection === 'pillars' ? 'active' : ''}`}
          onClick={() => setActiveSection('pillars')}
        >
          🏛️ Pillars
        </button>
        <button 
          className={`tab-button ${activeSection === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveSection('categories')}
        >
          📁 Categories
        </button>
        <button 
          className={`tab-button ${activeSection === 'profiles' ? 'active' : ''}`}
          onClick={() => setActiveSection('profiles')}
        >
          🔄 Database Profiles
        </button>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
          <button className="close-message" onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Pillars Section */}
      {activeSection === 'pillars' && (
        <div className="section-content">
          <div className="section-header">
            <h2>🏛️ Life Pillars (3 × 8-hour blocks)</h2>
            <button className="add-button" onClick={() => setIsAddingPillar(true)}>
              ➕ Add Pillar
            </button>
          </div>

          {isAddingPillar && (
            <div className="form-card">
              <h3>Create New Pillar</h3>
              <div className="form-group">
                <label>Pillar Name *</label>
                <input
                  type="text"
                  value={newPillar.name}
                  onChange={(e) => setNewPillar({ ...newPillar, name: e.target.value })}
                  placeholder="e.g., Hard Work, Calmness, Family"
                />
              </div>
              <div className="form-group">
                <label>Allocated Minutes (per day) *</label>
                <input
                  type="number"
                  value={newPillar.allocated_minutes}
                  onChange={(e) => setNewPillar({ ...newPillar, allocated_minutes: parseInt(e.target.value) || 0 })}
                  placeholder="480 (8 hours)"
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={newPillar.description}
                  onChange={(e) => setNewPillar({ ...newPillar, description: e.target.value })}
                  placeholder="Brief description of this pillar..."
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button className="save-button" onClick={handleCreatePillar}>Create Pillar</button>
                <button className="cancel-button" onClick={() => setIsAddingPillar(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="items-grid">
            {pillars.map((pillar) => (
              <div key={pillar.id} className="item-card">
                {editingPillar?.id === pillar.id ? (
                  <>
                    <input
                      type="text"
                      value={editingPillar.name}
                      onChange={(e) => setEditingPillar({ ...editingPillar, name: e.target.value })}
                      className="edit-input"
                    />
                    <input
                      type="number"
                      value={editingPillar.allocated_minutes}
                      onChange={(e) => setEditingPillar({ ...editingPillar, allocated_minutes: parseInt(e.target.value) || 0 })}
                      className="edit-input"
                      placeholder="Minutes"
                    />
                    <textarea
                      value={editingPillar.description || ''}
                      onChange={(e) => setEditingPillar({ ...editingPillar, description: e.target.value })}
                      className="edit-textarea"
                      placeholder="Description"
                      rows={2}
                    />
                    <div className="card-actions">
                      <button className="save-btn" onClick={handleUpdatePillar}>✓ Save</button>
                      <button className="cancel-btn" onClick={() => setEditingPillar(null)}>✗ Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="item-header">
                      <span className="item-icon">{PILLAR_ICONS[pillar.name] || '🏛️'}</span>
                      <h3>{pillar.name}</h3>
                    </div>
                    <p className="item-meta">
                      {pillar.allocated_minutes} minutes ({(pillar.allocated_minutes / 60).toFixed(1)} hours/day)
                    </p>
                    {pillar.description && <p className="item-description">{pillar.description}</p>}
                    <div className="card-actions">
                      <button className="edit-btn" onClick={() => setEditingPillar(pillar)}>✏️ Edit</button>
                      <button className="delete-btn" onClick={() => handleDeletePillar(pillar.id, pillar.name)}>🗑️ Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {pillars.length === 0 && !isAddingPillar && (
            <div className="empty-state">
              <p>No pillars yet. Create your first pillar to structure your day!</p>
            </div>
          )}
        </div>
      )}

      {/* Categories Section */}
      {activeSection === 'categories' && (
        <div className="section-content">
          <div className="section-header">
            <h2>📁 Categories (organized under pillars)</h2>
            <button className="add-button" onClick={() => setIsAddingCategory(true)}>
              ➕ Add Category
            </button>
          </div>

          {isAddingCategory && (
            <div className="form-card">
              <h3>Create New Category</h3>
              <div className="form-group">
                <label>Category Name *</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="e.g., Development, Exercise, Kids"
                />
              </div>
              <div className="form-group">
                <label>Pillar *</label>
                <select
                  value={newCategory.pillar_id}
                  onChange={(e) => setNewCategory({ ...newCategory, pillar_id: parseInt(e.target.value) })}
                >
                  <option value={0}>-- Select Pillar --</option>
                  {pillars.map((pillar) => (
                    <option key={pillar.id} value={pillar.id}>
                      {PILLAR_ICONS[pillar.name] || '🏛️'} {pillar.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button className="save-button" onClick={handleCreateCategory}>Create Category</button>
                <button className="cancel-button" onClick={() => setIsAddingCategory(false)}>Cancel</button>
              </div>
            </div>
          )}

          {pillars.map((pillar) => {
            const pillarCategories = categories.filter(cat => cat.pillar_id === pillar.id);
            if (pillarCategories.length === 0) return null;

            return (
              <div key={pillar.id} className="pillar-section">
                <h3 className="pillar-title">
                  {PILLAR_ICONS[pillar.name] || '🏛️'} {pillar.name}
                </h3>
                <div className="items-grid">
                  {pillarCategories.map((category) => (
                    <div key={category.id} className="item-card">
                      {editingCategory?.id === category.id ? (
                        <>
                          <input
                            type="text"
                            value={editingCategory.name}
                            onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                            className="edit-input"
                          />
                          <select
                            value={editingCategory.pillar_id}
                            onChange={(e) => setEditingCategory({ ...editingCategory, pillar_id: parseInt(e.target.value) })}
                            className="edit-select"
                          >
                            {pillars.map((p) => (
                              <option key={p.id} value={p.id}>
                                {PILLAR_ICONS[p.name] || '🏛️'} {p.name}
                              </option>
                            ))}
                          </select>
                          <div className="card-actions">
                            <button className="save-btn" onClick={handleUpdateCategory}>✓ Save</button>
                            <button className="cancel-btn" onClick={() => setEditingCategory(null)}>✗ Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="item-header">
                            <span className="item-icon">📁</span>
                            <h4>{category.name}</h4>
                          </div>
                          <p className="item-meta">
                            Under: {PILLAR_ICONS[pillar.name] || '🏛️'} {pillar.name}
                          </p>
                          <div className="card-actions">
                            <button className="edit-btn" onClick={() => setEditingCategory(category)}>✏️ Edit</button>
                            <button className="delete-btn" onClick={() => handleDeleteCategory(category.id, category.name)}>🗑️ Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {categories.length === 0 && !isAddingCategory && (
            <div className="empty-state">
              <p>No categories yet. Create categories to organize tasks under pillars!</p>
            </div>
          )}
        </div>
      )}

      {/* Profiles Section */}
      {activeSection === 'profiles' && (
        <div className="section-content">
          <div className="section-header">
            <h2>🔄 Database Profiles</h2>
          </div>

          {/* Current Profile */}
          {currentProfile && (
            <div className={`current-profile-card ${currentProfile.is_production ? 'production' : 'test'}`}>
              <div className="profile-info">
                <div className="profile-icon">
                  {currentProfile.is_production ? '👤' : '🧪'}
                </div>
                <div className="profile-details">
                  <h3>Current: {currentProfile.display_name}</h3>
                  <p className="profile-size">{currentProfile.size_kb.toFixed(2)} KB</p>
                  {!currentProfile.is_production && (
                    <p className="warning-text">⚠️ Test mode - Your production data is safe</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Available Profiles */}
          <h3 className="subsection-title">Available Profiles</h3>
          <div className="profiles-grid">
            {profiles.map((profile) => (
              <div 
                key={profile.name}
                className={`profile-card ${profile.is_current ? 'active' : ''}`}
              >
                <div className="profile-header">
                  <div className="profile-icon-small">
                    {profile.name === 'production' ? '👤' : '🧪'}
                  </div>
                  <h3>{profile.display_name}</h3>
                  {profile.is_current && <span className="active-badge">Active</span>}
                </div>
                
                <div className="profile-stats">
                  <span>{profile.size_kb.toFixed(2)} KB</span>
                </div>

                {!profile.is_current && (
                  <button
                    className="switch-button"
                    onClick={() => handleSwitchProfile(profile.name)}
                    disabled={loading}
                  >
                    {loading ? 'Switching...' : 'Switch'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Import Instructions */}
          <div className="info-box">
            <h3>📥 Import Test Database</h3>
            <p>To test with family member's data:</p>
            <code>./import_database.sh daughter ~/Downloads/backup.db.gz</code>
            <p className="hint">Then refresh this page to see the new profile.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyDayDesign;
