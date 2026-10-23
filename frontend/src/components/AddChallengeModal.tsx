/**
 * Add/Edit Challenge Modal Component
 * Uses reusable PillarCategorySelector and TaskSelector components
 * Supports multiple challenge types: daily_streak, count_based, accumulation
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { addDays, formatDateForInput } from '../utils/dateHelpers';
import { PillarCategorySelector } from './PillarCategorySelector';
import { TaskSelector } from './TaskSelector';

interface Challenge {
  id: number;
  name: string;
  description?: string | null;
  challenge_type: string;
  start_date: string;
  end_date: string;
  target_days?: number | null;
  target_count?: number | null;
  target_value?: number | null;
  unit?: string | null;
  daily_target?: number | null;
  required_days?: number | null;
  difficulty: string | null;
  why_reason?: string | null;
  reward?: string | null;
  pillar_id?: number | null;
  category_id?: number | null;
  sub_category_id?: number | null;
  linked_task_id?: number | null;
  goal_id?: number | null;
  project_id?: number | null;
  is_active?: boolean;
  is_completed: boolean;
}

// Whole days a challenge spans, counting both the start and the end day
const getInclusiveDuration = (start: string, end: string): number => {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const ms = new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime();
  return Math.round(ms / 86400000) + 1;
};

type UnitPreset = 'Hours' | 'Minutes' | 'Other';

const presetFromUnit = (unit?: string | null): UnitPreset => {
  const u = (unit || '').trim().toLowerCase();
  if (['hour', 'hours', 'h', 'hr', 'hrs'].includes(u)) return 'Hours';
  if (['minute', 'minutes', 'min', 'mins'].includes(u)) return 'Minutes';
  return 'Other';
};

// 1.43 hours -> "1h 26m"; everything else -> plain number
const formatQuantity = (n: number, unit: string, preset: UnitPreset): string => {
  if (preset === 'Hours') {
    const totalMinutes = Math.round(n * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const text = Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return `${text} ${unit}`.trim();
};

// Last day of a challenge that starts on `start` and runs `days` days (start day counts)
const endDateFor = (start: string, days: number): string => {
  const [y, m, d] = start.split('-').map(Number);
  return formatDateForInput(addDays(new Date(y, m - 1, d), days - 1));
};

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

  const initialDuration =
    editingChallenge && editingChallenge.start_date && editingChallenge.end_date
      ? getInclusiveDuration(editingChallenge.start_date, editingChallenge.end_date)
      : 30;

  // How a counting challenge is measured
  const [winMode, setWinMode] = useState<'daily' | 'total'>('total');
  const [unitPreset, setUnitPreset] = useState<UnitPreset>('Hours');
  const [unitText, setUnitText] = useState('');
  const [totalTarget, setTotalTarget] = useState('');
  const [dailyMin, setDailyMin] = useState('');
  const [requiredDays, setRequiredDays] = useState('');

  // Start, duration and end date stay in sync: edit any one and the others follow
  const [startDate, setStartDate] = useState(() => formatDateForInput(new Date()));
  const [duration, setDuration] = useState('30');
  const [endDate, setEndDate] = useState(() => endDateFor(formatDateForInput(new Date()), 30));

  const handleStartChange = (value: string) => {
    setStartDate(value);
    const days = parseInt(duration, 10);
    if (value && days >= 1) setEndDate(endDateFor(value, days));
  };

  const handleDurationChange = (value: string) => {
    setDuration(value);
    const days = parseInt(value, 10);
    if (startDate && days >= 1) setEndDate(endDateFor(startDate, days));
  };

  const handleEndChange = (value: string) => {
    setEndDate(value);
    if (startDate && value) {
      const days = getInclusiveDuration(startDate, value);
      if (days >= 1) setDuration(String(days));
    }
  };

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
      setStartDate(editingChallenge.start_date);
      setEndDate(editingChallenge.end_date);
      setDuration(String(initialDuration));
      const preset = editingChallenge.challenge_type === 'accumulation' ? presetFromUnit(editingChallenge.unit) : 'Other';
      setUnitPreset(editingChallenge.challenge_type === 'accumulation' ? preset : 'Other');
      setUnitText(preset === 'Other' ? editingChallenge.unit || '' : '');
      setWinMode(editingChallenge.daily_target ? 'daily' : 'total');
      setDailyMin(editingChallenge.daily_target ? String(editingChallenge.daily_target) : '');
      setRequiredDays(editingChallenge.required_days ? String(editingChallenge.required_days) : '');
      const total = editingChallenge.challenge_type === 'count_based' ? editingChallenge.target_count : editingChallenge.target_value;
      setTotalTarget(!editingChallenge.daily_target && total ? String(total) : '');
    } else {
      // Reset for new challenge
      const today = formatDateForInput(new Date());
      setStartDate(today);
      setDuration('30');
      setEndDate(endDateFor(today, 30));
      setUnitPreset('Hours');
      setUnitText('');
      setWinMode('total');
      setTotalTarget('');
      setDailyMin('');
      setRequiredDays('');
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
    // Either a duration or an end date is enough; an end date wins when both are present
    const typedDays = parseInt(duration, 10);
    const finalEnd = endDate || (startDate && typedDays >= 1 ? endDateFor(startDate, typedDays) : '');
    if (!startDate || !finalEnd) {
      alert('Enter either a duration (days) or an end date.');
      return;
    }
    // Start and end are inclusive, so the duration is the number of calendar days they span
    const durationDays = getInclusiveDuration(startDate, finalEnd);
    if (durationDays < 1) {
      alert('The end date cannot be before the start date.');
      return;
    }
    
    // Explicit nulls so cleared fields are really cleared on update
    const text = (key: string) => ((formData.get(key) as string) || '').trim() || null;
    
    const challengeData: any = {
      name: (formData.get('name') as string).trim(),
      description: text('description'),
      challenge_type: type,
      start_date: startDate,
      end_date: finalEnd,
      difficulty: formData.get('difficulty') as string || 'medium',
      why_reason: text('why_reason'),
      reward: text('reward'),
      // Pillar/Category/Task/Goal/Project linking
      pillar_id: pillarId,
      category_id: categoryId,
      sub_category_id: subCategoryId,
      linked_task_id: linkedTaskId,
      auto_sync: linkedTaskId ? true : false, // Auto-sync if linked to a task
      goal_id: goalId,
      project_id: projectId,
      target_days: null,
      target_count: null,
      target_value: null,
      unit: null,
      daily_target: null,
      required_days: null
    };

    // Add type-specific fields
    if (type === 'daily_streak') {
      // Editing without touching the duration keeps the existing target
      const unchanged = editingChallenge && editingChallenge.target_days && durationDays === initialDuration;
      challengeData.target_days = unchanged ? editingChallenge!.target_days : durationDays;
    } else {
      const unit = type === 'accumulation' && unitPreset !== 'Other' ? unitPreset : unitText.trim();
      if (!unit) {
        alert('Enter the unit you are counting (e.g. pushups, pages, km).');
        return;
      }
      challengeData.unit = unit;

      if (winMode === 'daily') {
        const minimum = parseFloat(dailyMin);
        if (!(minimum > 0)) {
          alert('Enter the minimum you want to reach every day.');
          return;
        }
        const required = parseInt(requiredDays, 10);
        if (required > durationDays) {
          alert(`Days that must count cannot be more than the ${durationDays} days of the challenge.`);
          return;
        }
        challengeData.daily_target = minimum;
        challengeData.required_days = required >= 1 ? required : null;
        // The total over the whole challenge is simply minimum x days
        if (type === 'count_based') challengeData.target_count = Math.max(1, Math.round(minimum * durationDays));
        else challengeData.target_value = minimum * durationDays;
      } else {
        const total = parseFloat(totalTarget);
        if (!(total > 0)) {
          alert('Enter the total you want to reach.');
          return;
        }
        if (type === 'count_based') challengeData.target_count = Math.round(total);
        else challengeData.target_value = total;
      }
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

            {/* Optional: Link to Task - RIGHT AFTER NAME */}
            <div style={{ 
              marginBottom: '16px', 
              padding: '12px', 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px',
              backgroundColor: '#f9f9f9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold', margin: 0 }}>
                  📋 Is this part of a daily/monthly task? (Optional)
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
                <option value="accumulation">Time/Value-Based (hours, minutes, km, pages…)</option>
              </select>
              <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                • Daily Streak: Track if you did it each day<br/>
                • Count-Based: Track how many times (pushups, treks, etc.)<br/>
                • Time/Value-Based: Track time or an amount (study hours, km, pages)
              </small>
            </div>

            {/* How the challenge is measured (counting types only) */}
            {challengeType !== 'daily_streak' && (() => {
              const unitLabel = challengeType === 'accumulation' && unitPreset !== 'Other' ? unitPreset : unitText.trim();
              const preset: UnitPreset = challengeType === 'accumulation' ? unitPreset : 'Other';
              const planDays = endDate && startDate ? getInclusiveDuration(startDate, endDate) : parseInt(duration, 10) || 0;
              const perDayOf = (total: number) => (planDays > 0 ? total / planDays : 0);
              const show = (n: number) => formatQuantity(n, unitLabel.toLowerCase(), preset);
              const warnTooMuch = (perDay: number) =>
                (preset === 'Hours' && perDay > 8) || (preset === 'Minutes' && perDay > 480);

              const total = parseFloat(totalTarget);
              const minimum = parseFloat(dailyMin);
              const required = parseInt(requiredDays, 10);

              return (
                <div className="ch-measure">
                  <div className="ch-measure-title">📐 What are you counting?</div>

                  <div className="ch-unit-row">
                    {challengeType === 'accumulation' ? (
                      <>
                        <select
                          value={unitPreset}
                          onChange={(e) => setUnitPreset(e.target.value as UnitPreset)}
                          aria-label="Unit"
                        >
                          <option value="Hours">Hours</option>
                          <option value="Minutes">Minutes</option>
                          <option value="Other">Other (km, pages, $…)</option>
                        </select>
                        {unitPreset === 'Other' && (
                          <input
                            type="text"
                            value={unitText}
                            placeholder="e.g., km, pages, dollars"
                            onChange={(e) => setUnitText(e.target.value)}
                            required
                          />
                        )}
                      </>
                    ) : (
                      <input
                        type="text"
                        value={unitText}
                        placeholder="e.g., pushups, pages, steps, treks"
                        onChange={(e) => setUnitText(e.target.value)}
                        required
                      />
                    )}
                  </div>
                  {linkedTaskId && challengeType === 'accumulation' && (
                    <small className="ch-measure-hint">
                      📡 Time logged on your linked Daily task is converted to {unitPreset === 'Other' ? 'minutes' : unitPreset.toLowerCase()} automatically.
                    </small>
                  )}

                  <div className="ch-measure-title" style={{ marginTop: 12 }}>🏆 How do you win?</div>

                  <label className={`ch-win-option ${winMode === 'daily' ? 'is-selected' : ''}`}>
                    <input type="radio" name="win_mode" checked={winMode === 'daily'} onChange={() => setWinMode('daily')} />
                    <span className="ch-win-text">
                      Every day at least
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="ch-win-input"
                        value={dailyMin}
                        disabled={winMode !== 'daily'}
                        required={winMode === 'daily'}
                        placeholder="20"
                        onChange={(e) => setDailyMin(e.target.value)}
                      />
                      {unitLabel.toLowerCase() || 'units'}
                    </span>
                    <small>Best for habits: a day only counts once you reach the minimum.</small>
                  </label>

                  <label className={`ch-win-option ${winMode === 'total' ? 'is-selected' : ''}`}>
                    <input type="radio" name="win_mode" checked={winMode === 'total'} onChange={() => setWinMode('total')} />
                    <span className="ch-win-text">
                      A total of
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="ch-win-input"
                        value={totalTarget}
                        disabled={winMode !== 'total'}
                        required={winMode === 'total'}
                        placeholder="100"
                        onChange={(e) => setTotalTarget(e.target.value)}
                      />
                      {unitLabel.toLowerCase() || 'units'} by the end date
                    </span>
                    <small>Best for big goals: spread it however suits you; the page shows the pace you need.</small>
                  </label>

                  {winMode === 'daily' && (
                    <div className="ch-win-extra">
                      <label htmlFor="required_days">Days that must count (optional)</label>
                      <div className="ch-win-extra-row">
                        <input
                          id="required_days"
                          type="number"
                          min="1"
                          max={planDays || undefined}
                          value={requiredDays}
                          placeholder={planDays ? String(planDays) : 'all'}
                          onChange={(e) => setRequiredDays(e.target.value)}
                        />
                        <span>of {planDays || '…'} days — leave empty to require every day</span>
                      </div>
                    </div>
                  )}

                  {/* Live reality check: what does this goal ask of you? */}
                  {planDays > 0 && ((winMode === 'total' && total > 0) || (winMode === 'daily' && minimum > 0)) && (() => {
                    const perDay = winMode === 'total' ? perDayOf(total) : minimum;
                    return (
                      <div className={`ch-preview ${warnTooMuch(perDay) ? 'is-warn' : ''}`}>
                        {winMode === 'total' ? (
                          <>
                            <b>≈ {show(perDay)} per day</b> · ≈ {show(perDay * 7)} per week over {planDays} days
                          </>
                        ) : (
                          <>
                            <b>{show(minimum)} a day</b> × {planDays} days = <b>{show(minimum * planDays)}</b> in total
                            {required >= 1 && required <= planDays && (
                              <> · win with {required} of {planDays} days ({planDays - required} miss{planDays - required === 1 ? '' : 'es'} allowed)</>
                            )}
                          </>
                        )}
                        {warnTooMuch(perDay) && (
                          <div>⚠️ That is more than 8 hours a day — consider a later end date or a smaller target.</div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Start Date, Duration and End Date (linked - edit any one) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="start_date">Start Date *</label>
                <input
                  type="date"
                  id="start_date"
                  name="start_date"
                  required
                  value={startDate}
                  onChange={(e) => handleStartChange(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="duration_days">Duration (days)</label>
                <input
                  type="number"
                  id="duration_days"
                  name="duration_days"
                  min="1"
                  placeholder="e.g., 30, 66, 90"
                  value={duration}
                  onChange={(e) => handleDurationChange(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="end_date">End Date</label>
                <input
                  type="date"
                  id="end_date"
                  name="end_date"
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(e) => handleEndChange(e.target.value)}
                />
              </div>
            </div>
            <small style={{ display: 'block', margin: '-0.75rem 0 1.25rem', color: '#666' }}>
              Fill in either the duration or the end date — the other fills itself in. Start and end days both count.
            </small>

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

            {/* Reward */}
            <div className="form-group">
              <label htmlFor="reward">🎁 Reward for Finishing (optional)</label>
              <input
                type="text"
                id="reward"
                name="reward"
                placeholder="e.g., a movie night, new running shoes"
                defaultValue={editingChallenge?.reward || ''}
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
