/**
 * Add Habit Modal Component
 * Enhanced with Pillar and Category support
 * Supports 4 tracking modes: daily_streak, occurrence, occurrence_with_value, aggregate
 * 
 * Now uses reusable components:
 * - PillarCategorySelector for organization
 * - TaskSelector for task linking with frequency filtering
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PillarCategorySelector } from './PillarCategorySelector';
import { TaskSelector } from './TaskSelector';

interface AddHabitModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingHabit?: any; // Habit to edit (if provided, modal is in edit mode)
}

// Pillar/Category/Task interfaces now in reusable components

interface LifeGoal {
  id: number;
  name: string;
  category?: string;
  start_date?: string;
  target_date?: string;
  status?: string;
}

interface Wish {
  id: number;
  title: string; // Wishes use 'title' not 'name'
  description?: string;
  category?: string;
  dream_type?: string;
}

export const AddHabitModal: React.FC<AddHabitModalProps> = ({ show, onClose, onSuccess, editingHabit }) => {
  // Life Goals and Wishes data (still manual for now, can be componentized later)
  const [lifeGoals, setLifeGoals] = useState<LifeGoal[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  
  // UI state
  const [trackingMode, setTrackingMode] = useState('daily_streak');
  const [habitType, setHabitType] = useState('boolean');
  const [selectedPillar, setSelectedPillar] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showTaskLink, setShowTaskLink] = useState(false);
  const [showGoalLink, setShowGoalLink] = useState(false);
  const [showWishLink, setShowWishLink] = useState(false);

  useEffect(() => {
    if (show) {
      // Only load Life Goals and Wishes (Pillar/Category/Task now handled by reusable components)
      loadLifeGoals();
      loadWishes();
      
      // If editing, preload the habit data
      if (editingHabit) {
        setTrackingMode(editingHabit.tracking_mode || 'daily_streak');
        setHabitType(editingHabit.habit_type || 'boolean');
        setSelectedPillar(editingHabit.pillar_id || null);
        setSelectedCategory(editingHabit.category_id || null);
        setSelectedTaskId(editingHabit.linked_task_id || null);
        setShowTaskLink(!!editingHabit.linked_task_id);
        setShowGoalLink(!!editingHabit.life_goal_id);
        setShowWishLink(!!editingHabit.wish_id);
        
        // Wait for DOM to be ready then populate hidden fields
        setTimeout(() => {
          const pillarInput = document.querySelector('input[name="pillar_id"]') as HTMLInputElement;
          if (pillarInput && editingHabit.pillar_id) pillarInput.value = String(editingHabit.pillar_id);
          
          const categoryInput = document.querySelector('input[name="category_id"]') as HTMLInputElement;
          if (categoryInput && editingHabit.category_id) categoryInput.value = String(editingHabit.category_id);
          
          const subCategoryInput = document.querySelector('input[name="sub_category_id"]') as HTMLInputElement;
          if (subCategoryInput && editingHabit.sub_category_id) subCategoryInput.value = String(editingHabit.sub_category_id);
        }, 100);
      } else {
        // Reset to defaults when creating new habit
        setTrackingMode('daily_streak');
        setHabitType('boolean');
        setSelectedPillar(null);
        setSelectedCategory(null);
        setSelectedTaskId(null);
        setShowTaskLink(false);
        setShowGoalLink(false);
        setShowWishLink(false);
      }
    }
  }, [show, editingHabit]);

  // Pillar/Category/Task loading is now handled by reusable components

  const loadLifeGoals = async () => {
    try {
      const response: any = await api.get('/api/life-goals/');
      setLifeGoals(response.data as LifeGoal[]);
    } catch (error) {
      console.error('Error loading life goals:', error);
      setLifeGoals([]);
    }
  };

  const loadWishes = async () => {
    try {
      const response: any = await api.get('/api/wishes/');
      setWishes(response.data as Wish[]);
    } catch (error) {
      console.error('Error loading wishes:', error);
      setWishes([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const periodType = formData.get('period_type') as string;
    
    // Calculate end_date based on monitoring duration
    const monitoringDays = formData.get('monitoring_duration_days') as string;
    const startDate = new Date();
    let endDate: string | undefined = undefined;
    
    if (monitoringDays) {
      const daysToAdd = parseInt(monitoringDays);
      const end = new Date(startDate);
      end.setDate(end.getDate() + daysToAdd);
      endDate = end.toISOString().split('T')[0];
    }
    
    const habitData: any = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      habit_type: formData.get('habit_type') as string,
      target_frequency: 'daily', // Auto-set based on tracking mode
      is_positive: formData.get('is_positive') === 'true',
      why_reason: formData.get('why_reason') as string || undefined,
      linked_task_id: formData.get('linked_task_id') ? parseInt(formData.get('linked_task_id') as string) : undefined,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate,
      // Use state values directly instead of form data for pillar/category
      pillar_id: selectedPillar || undefined,
      category_id: selectedCategory || undefined,
      sub_category_id: formData.get('sub_category_id') ? parseInt(formData.get('sub_category_id') as string) : undefined,
      life_goal_id: formData.get('life_goal_id') ? parseInt(formData.get('life_goal_id') as string) : undefined,
      wish_id: formData.get('wish_id') ? parseInt(formData.get('wish_id') as string) : undefined,
    };

    // Debug: Log the data being sent
    console.log('Submitting habit data:', {
      pillar_id: habitData.pillar_id,
      category_id: habitData.category_id,
      selectedPillar,
      selectedCategory,
      isEditing: !!editingHabit
    });

    // Add fields based on tracking mode
    if (trackingMode === 'daily_streak') {
      habitData.period_type = 'daily';
      habitData.tracking_mode = 'daily_streak';
      habitData.target_value = formData.get('target_value') ? parseInt(formData.get('target_value') as string) : undefined;
      habitData.target_comparison = formData.get('target_comparison') as string || 'at_least';
    } else if (trackingMode === 'occurrence') {
      habitData.period_type = periodType;
      habitData.tracking_mode = 'occurrence';
      habitData.target_count_per_period = parseInt(formData.get('target_count_per_period') as string);
    } else if (trackingMode === 'occurrence_with_value') {
      habitData.period_type = periodType;
      habitData.tracking_mode = 'occurrence_with_value';
      habitData.target_count_per_period = parseInt(formData.get('target_count_per_period') as string);
      habitData.session_target_value = parseInt(formData.get('session_target_value') as string);
      habitData.session_target_unit = formData.get('session_target_unit') as string;
      habitData.target_comparison = formData.get('target_comparison') as string || 'at_least';
    } else if (trackingMode === 'aggregate') {
      habitData.period_type = periodType;
      habitData.tracking_mode = 'aggregate';
      habitData.aggregate_target = parseInt(formData.get('aggregate_target') as string);
      habitData.session_target_unit = formData.get('session_target_unit') as string;
    }

    try {
      if (editingHabit) {
        // Update existing habit
        await api.put(`/api/habits/${editingHabit.id}`, habitData);
      } else {
        // Create new habit
        await api.post('/api/habits/', habitData);
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(`Error ${editingHabit ? 'updating' : 'creating'} habit:`, error);
      alert(`Failed to ${editingHabit ? 'update' : 'create'} habit: ` + (error.response?.data?.detail || error.message));
    }
  };

  if (!show) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
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
      }}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff5f8',
          padding: '24px',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}
      >
        <div style={{
          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          padding: '16px 20px',
          borderRadius: '8px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(250, 112, 154, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '22px' }}>
            {editingHabit ? '✏️ Edit Habit' : '🌱 Add New Habit'}
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.3)',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: 'white',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '10px 16px',
            borderRadius: '6px',
            marginBottom: '16px',
            boxShadow: '0 2px 6px rgba(102, 126, 234, 0.2)'
          }}>
            <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>✨ Basic Information</span>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Habit Name *
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={editingHabit?.name || ''}
              placeholder="e.g., Morning Meditation, Read 30 minutes"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              defaultValue={editingHabit?.description || ''}
              placeholder="What does this habit involve?"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
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
              <strong>🎯 Organize Your Habit</strong>
              <small style={{ display: 'block', color: '#666', marginTop: '4px' }}>
                Align with your life pillars (Hard Work, Calmness, Family)
              </small>
            </div>
            <PillarCategorySelector
              selectedPillarId={selectedPillar || null}
              selectedCategoryId={selectedCategory || null}
              onPillarChange={(id) => {
                setSelectedPillar(id);
                // Store for form submission
                const input = document.querySelector('input[name="pillar_id_hidden"]') as HTMLInputElement;
                if (input) input.value = id ? String(id) : '';
              }}
              onCategoryChange={(id) => {
                setSelectedCategory(id);
                // Store for form submission
                const input = document.querySelector('input[name="category_id_hidden"]') as HTMLInputElement;
                if (input) input.value = id ? String(id) : '';
              }}
              onSubCategoryChange={(id) => {
                // Store for form submission
                const input = document.querySelector('input[name="sub_category_id_hidden"]') as HTMLInputElement;
                if (input) input.value = id ? String(id) : '';
              }}
              showSubCategory={true}
              required={false}
            />
            {/* Hidden inputs for form submission */}
            <input type="hidden" name="pillar_id" className="pillar_id_hidden" />
            <input type="hidden" name="category_id" className="category_id_hidden" />
            <input type="hidden" name="sub_category_id" className="sub_category_id_hidden" />
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            padding: '10px 16px',
            borderRadius: '6px',
            marginBottom: '16px',
            marginTop: '20px',
            boxShadow: '0 2px 6px rgba(79, 172, 254, 0.2)'
          }}>
            <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>📊 Tracking Configuration</span>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Tracking Mode *
            </label>
            <select
              name="tracking_mode"
              value={trackingMode}
              onChange={(e) => setTrackingMode(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              required
            >
              <option value="daily_streak">Daily Streak (Traditional - track every day)</option>
              <option value="occurrence">Weekly/Monthly Occurrences (e.g., Gym 4x/week)</option>
              <option value="occurrence_with_value">Weekly/Monthly with Values (e.g., Gym 4x/week, 45+ min each)</option>
              <option value="aggregate">Weekly/Monthly Aggregate (e.g., Read 300 pages/week total)</option>
            </select>
            <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
              Daily Streak = Track every day with streaks<br/>
              Occurrences = Do it X times per week/month<br/>
              With Values = Track time/count for each session<br/>
              Aggregate = Hit total target (flexible distribution)
            </small>
          </div>

          {/* Period Type - Only for non-daily modes */}
          {trackingMode !== 'daily_streak' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Period *
              </label>
              <select
                name="period_type"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          )}

          {/* Daily Streak Fields */}
          {trackingMode === 'daily_streak' && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Habit Type *
                </label>
                <select
                  name="habit_type"
                  value={habitType}
                  onChange={(e) => setHabitType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                  required
                >
                  <option value="boolean">Yes/No (Did I do it?)</option>
                  <option value="time_based">Time-based (minutes)</option>
                  <option value="count_based">Count-based (reps/pages/etc)</option>
                </select>
              </div>

              {habitType !== 'boolean' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    Daily Target
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="number"
                      name="target_value"
                      min="1"
                      defaultValue={editingHabit?.target_value || ''}
                      placeholder="e.g., 30 for 30 minutes"
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    />
                    <select
                      name="target_comparison"
                      defaultValue={editingHabit?.target_comparison || 'at_least'}
                      style={{
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    >
                      <option value="at_least">At least</option>
                      <option value="at_most">At most</option>
                      <option value="exactly">Exactly</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Occurrence Fields */}
          {trackingMode === 'occurrence' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Target Count *
              </label>
              <input
                type="number"
                name="target_count_per_period"
                min="1"
                required
                defaultValue={editingHabit?.target_count_per_period || ''}
                placeholder="e.g., 4 for 4 times per week"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                How many times per week/month?
              </small>
            </div>
          )}

          {/* Occurrence with Value Fields */}
          {trackingMode === 'occurrence_with_value' && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Target Count *
                </label>
                <input
                  type="number"
                  name="target_count_per_period"
                  min="1"
                  required
                  placeholder="e.g., 4 for 4 sessions per week"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
                <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                  How many sessions per week/month?
                </small>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Target per Session *
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="number"
                    name="session_target_value"
                    min="1"
                    required
                    placeholder="e.g., 45 for 45 minutes"
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                  <input
                    type="text"
                    name="session_target_unit"
                    required
                    placeholder="Unit (min/pages/km)"
                    style={{
                      width: '120px',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                  <select
                    name="target_comparison"
                    style={{
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  >
                    <option value="at_least">At least</option>
                    <option value="at_most">At most</option>
                    <option value="exactly">Exactly</option>
                  </select>
                </div>
                <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                  Each session should meet this target
                </small>
              </div>
            </>
          )}

          {/* Aggregate Fields */}
          {trackingMode === 'aggregate' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Total Target *
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="number"
                  name="aggregate_target"
                  min="1"
                  required
                  placeholder="e.g., 300 for 300 pages"
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
                <input
                  type="text"
                  name="session_target_unit"
                  required
                  placeholder="Unit (pages/km/min)"
                  style={{
                    width: '150px',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
              <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                Total to achieve by end of week/month (flexible distribution)
              </small>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Goal Type *
            </label>
            <select
              name="is_positive"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              required
            >
              <option value="true">Build (Do this habit)</option>
              <option value="false">Break (Avoid this habit)</option>
            </select>
            <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
              Build = success when you do it. Break = success when you don't do it.
            </small>
          </div>

          {/* Optional: Monitor Existing Task */}
          <div style={{ 
            marginBottom: '16px', 
            padding: '12px', 
            border: '1px solid #e0e0e0', 
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontWeight: 'bold', margin: 0 }}>
                📋 Monitor an Existing Task (Optional)
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
                  selectedTaskId={selectedTaskId}
                  onTaskChange={(taskId) => {
                    setSelectedTaskId(taskId);
                    // Also store for form submission
                    const input = document.querySelector('.linked_task_id_hidden') as HTMLInputElement;
                    if (input) input.value = taskId ? String(taskId) : '';
                  }}
                  defaultFrequency="daily"
                  filterByPillar={selectedPillar || undefined}
                  filterByCategory={selectedCategory || undefined}
                  showFrequencyFilter={true}
                  required={false}
                  placeholder="-- None --"
                  showTaskDetails={true}
                />
                <input type="hidden" name="linked_task_id" className="linked_task_id_hidden" />
                <small style={{ color: '#666', display: 'block', marginTop: '8px' }}>
                  💡 Auto-sync habit completion from task time entries
                </small>
              </div>
            )}
          </div>

          {/* Optional: Link to Life Goal */}
          <div style={{ 
            marginBottom: '16px', 
            padding: '12px', 
            border: '1px solid #e0e0e0', 
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontWeight: 'bold', margin: 0 }}>
                Link to Life Goal (Optional)
              </label>
              <button
                type="button"
                onClick={() => setShowGoalLink(!showGoalLink)}
                style={{
                  padding: '4px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: showGoalLink ? '#007bff' : 'white',
                  color: showGoalLink ? 'white' : '#333',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {showGoalLink ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {showGoalLink && (
              <div>
                <select
                  name="life_goal_id"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">-- None --</option>
                  {lifeGoals && lifeGoals.length > 0 ? (
                    lifeGoals.map(goal => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name} {goal.category && `(${goal.category})`}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No life goals available</option>
                  )}
                </select>
                <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                  Connect this habit to a bigger life goal (1-year, 3-year, 5-year, 10-year)
                </small>
              </div>
            )}
          </div>

          {/* Optional: Link to Dream/Wish */}
          <div style={{ 
            marginBottom: '20px', 
            padding: '12px', 
            border: '1px solid #e0e0e0', 
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontWeight: 'bold', margin: 0 }}>
                Link to Dream/Wish (Optional)
              </label>
              <button
                type="button"
                onClick={() => setShowWishLink(!showWishLink)}
                style={{
                  padding: '4px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: showWishLink ? '#007bff' : 'white',
                  color: showWishLink ? 'white' : '#333',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {showWishLink ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {showWishLink && (
              <div>
                <select
                  name="wish_id"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">-- None --</option>
                  {wishes && wishes.length > 0 ? (
                    wishes.map(wish => (
                      <option key={wish.id} value={wish.id}>
                        {wish.title}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No wishes available</option>
                  )}
                </select>
                <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                  Link to a long-term dream or aspiration
                </small>
              </div>
            )}
          </div>

          {/* Monitoring Duration */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              How long to monitor this habit?
            </label>
            <select
              name="monitoring_duration_days"
              defaultValue="90"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="21">21 days (Build Foundation)</option>
              <option value="30">30 days (1 Month)</option>
              <option value="60">60 days (2 Months)</option>
              <option value="90">90 days (3 Months - Recommended)</option>
              <option value="180">180 days (6 Months)</option>
              <option value="365">365 days (1 Year)</option>
              <option value="">Ongoing (No end date)</option>
            </select>
            <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
              Research shows it takes 21-66 days to form a habit. 90 days is optimal for lasting change.
            </small>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Why is this important?
            </label>
            <textarea
              name="why_reason"
              rows={2}
              placeholder="Your motivation and reason for building this habit..."
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button 
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#2196f3',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Add Habit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
