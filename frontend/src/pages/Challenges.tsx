/**
 * Challenges Page
 * Time-bound personal challenges (7-30 days)
 * Fun experiments to build new behaviors
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './Challenges.css';

interface Challenge {
  id: number;
  name: string;
  description: string | null;
  challenge_type: 'daily_streak' | 'count_based' | 'accumulation';
  start_date: string;
  end_date: string;
  target_days: number | null;
  target_count: number | null;
  target_value: number | null;
  unit: string | null;
  current_streak: number;
  longest_streak: number;
  completed_days: number;
  current_count: number;
  current_value: number;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  is_completed: boolean;
  completion_date: string | null;
  difficulty: string | null;
  reward: string | null;
  why_reason: string | null;
  pillar_id: number | null;
  can_graduate_to_habit: boolean;
  graduated_habit_id: number | null;
  created_at: string;
  updated_at: string | null;
}

interface ChallengeEntry {
  id: number;
  challenge_id: number;
  entry_date: string;
  is_completed: boolean;
  count_value: number;
  numeric_value: number;
  note: string | null;
  mood: string | null;
  created_at: string;
}

interface ChallengeStats {
  challenge_id: number;
  challenge_name: string;
  challenge_type: string;
  status: string;
  days_elapsed: number;
  days_remaining: number;
  total_days: number;
  completed_days: number;
  completion_rate: number;
  current_streak: number;
  longest_streak: number;
  current_count: number;
  target_count: number | null;
  current_value: number;
  target_value: number | null;
  success_rate: number;
  is_on_track: boolean;
  is_completed: boolean;
}

export default function Challenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [challengeStats, setChallengeStats] = useState<ChallengeStats | null>(null);
  const [challengeEntries, setChallengeEntries] = useState<ChallengeEntry[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [logCompleted, setLogCompleted] = useState(false);
  const [logCountValue, setLogCountValue] = useState<number>(0);
  const [logNumericValue, setLogNumericValue] = useState<number>(0);
  const [logNote, setLogNote] = useState<string>('');
  const [logMood, setLogMood] = useState<string>('good');

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/api/challenges/');
      setChallenges(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load challenges');
      console.error('Error fetching challenges:', err);
      setChallenges([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchChallengeStats = async (challengeId: number) => {
    try {
      const data = await api.get<ChallengeStats>(`/api/challenges/${challengeId}/stats`);
      setChallengeStats(data);
    } catch (err: any) {
      console.error('Error fetching challenge stats:', err);
    }
  };

  const fetchChallengeEntries = async (challengeId: number) => {
    try {
      const data = await api.get<ChallengeEntry[]>(`/api/challenges/${challengeId}/entries`);
      setChallengeEntries(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching challenge entries:', err);
    }
  };

  const handleChallengeClick = async (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    await fetchChallengeStats(challenge.id);
    await fetchChallengeEntries(challenge.id);
  };

  const openLogModal = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setShowLogModal(true);
    setLogDate(new Date().toISOString().split('T')[0]);
    setLogCompleted(false);
    setLogCountValue(0);
    setLogNumericValue(0);
    setLogNote('');
    setLogMood('good');
  };

  const handleLogEntry = async () => {
    if (!selectedChallenge) return;

    try {
      const entryData: any = {
        entry_date: logDate,
        is_completed: logCompleted,
        note: logNote || null,
        mood: logMood || null,
      };

      if (selectedChallenge.challenge_type === 'count_based') {
        entryData.count_value = logCountValue;
      } else if (selectedChallenge.challenge_type === 'accumulation') {
        entryData.numeric_value = logNumericValue;
      }

      await api.post(`/api/challenges/${selectedChallenge.id}/log`, entryData);
      
      // Refresh data
      await fetchChallenges();
      if (selectedChallenge) {
        await fetchChallengeStats(selectedChallenge.id);
        await fetchChallengeEntries(selectedChallenge.id);
      }
      
      setShowLogModal(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to log entry');
    }
  };

  const handleCompleteChallenge = async (challengeId: number) => {
    if (!confirm('Mark this challenge as completed?')) return;

    try {
      await api.post(`/api/challenges/${challengeId}/complete`);
      await fetchChallenges();
      if (selectedChallenge?.id === challengeId) {
        setSelectedChallenge(null);
        setChallengeStats(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to complete challenge');
    }
  };

  const handleRepeatChallenge = async (challengeId: number) => {
    if (!confirm('Create a new challenge with the same settings? This will start a fresh challenge today.')) return;

    try {
      await api.post(`/api/challenges/${challengeId}/repeat`);
      await fetchChallenges();
      alert('Challenge repeated successfully! Check your active challenges.');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to repeat challenge');
    }
  };

  const handleGraduateToHabit = async (challengeId: number) => {
    if (!confirm('Graduate this challenge to a permanent habit?')) return;

    try {
      await api.post(`/api/challenges/${challengeId}/graduate`, {});
      alert('Challenge graduated to habit successfully!');
      await fetchChallenges();
      if (selectedChallenge?.id === challengeId) {
        setSelectedChallenge(null);
        setChallengeStats(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to graduate challenge');
    }
  };

  const getChallengeTypeIcon = (type: string): string => {
    switch (type) {
      case 'daily_streak': return '🔥';
      case 'count_based': return '🎯';
      case 'accumulation': return '📈';
      default: return '✨';
    }
  };

  const getDifficultyColor = (difficulty: string | null): string => {
    switch (difficulty) {
      case 'easy': return '#107C10';
      case 'medium': return '#FFB900';
      case 'hard': return '#D13438';
      default: return '#605E5C';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return '#0078D4';
      case 'completed': return '#107C10';
      case 'failed': return '#D13438';
      case 'abandoned': return '#8A8886';
      default: return '#605E5C';
    }
  };

  const renderStreakVisualization = (current: number, longest: number) => {
    const flames = '🔥'.repeat(Math.min(current, 7));
    return (
      <div className="streak-visualization">
        <div className="streak-flames">{flames}</div>
        <div className="streak-text">
          {current} day streak {longest > current && `(Best: ${longest})`}
        </div>
      </div>
    );
  };

  const renderProgressBar = (current: number, target: number, unit: string = '') => {
    const percentage = Math.min((current / target) * 100, 100);
    return (
      <div className="challenge-progress">
        <div className="challenge-progress-bar">
          <div 
            className="challenge-progress-fill" 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="challenge-progress-text">
          {current} / {target} {unit} ({percentage.toFixed(0)}%)
        </div>
      </div>
    );
  };

  // Inspirational quotes for the hero section
  const inspirationalQuotes = [
    { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
    { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
    { text: "Make it so easy you can't say no.", author: "BJ Fogg" },
    { text: "Change might not be fast and it isn't always easy. But with time and effort, almost any habit can be reshaped.", author: "Charles Duhigg" },
    { text: "All big things come from small beginnings. The seed of every habit is a single, tiny decision.", author: "James Clear" },
  ];

  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % inspirationalQuotes.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Handle loading and error states
  if (loading) {
    return <div className="challenges-container"><p>Loading challenges...</p></div>;
  }

  if (error) {
    return <div className="challenges-container"><p className="error">{error}</p></div>;
  }

  // Filter challenges by status
  const activeChallenges = challenges.filter(c => c.status === 'active');
  const completedChallenges = challenges.filter(c => c.status === 'completed');

  return (
    <div className="challenges-container">
      <div className="challenges-hero">
        <h1>🎯 Challenges</h1>
        <p className="challenges-subtitle">Time-bound experiments to build new behaviors</p>
        <div className="inspirational-quote">
          <p className="quote-text">"{inspirationalQuotes[currentQuoteIndex].text}"</p>
          <p className="quote-author">— {inspirationalQuotes[currentQuoteIndex].author}</p>
        </div>
      </div>

      {/* Create New Challenge Button */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <button 
          className="btn-primary"
          style={{
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
          }}
          onClick={() => setShowCreateModal(true)}
        >
          ➕ Create New Challenge
        </button>
      </div>

      {/* Active Challenges */}
      <section className="challenges-section">
        <h2>Active Challenges ({activeChallenges.length})</h2>
        <div className="challenges-grid">
          {activeChallenges.length === 0 ? (
            <p className="empty-message">No active challenges. Start a new challenge!</p>
          ) : (
            activeChallenges.map((challenge) => {
              const daysElapsed = Math.floor(
                (new Date().getTime() - new Date(challenge.start_date).getTime()) / (1000 * 60 * 60 * 24)
              );
              const daysRemaining = Math.ceil(
                (new Date(challenge.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );

              return (
                <div 
                  key={challenge.id} 
                  className={`challenge-card challenge-${challenge.difficulty || 'medium'}`}
                  onClick={() => handleChallengeClick(challenge)}
                >
                  <div className="challenge-card-header">
                    <div className="challenge-icon">{getChallengeTypeIcon(challenge.challenge_type)}</div>
                    <h3>{challenge.name}</h3>
                    {challenge.difficulty && (
                      <span 
                        className="challenge-difficulty"
                        style={{ backgroundColor: getDifficultyColor(challenge.difficulty) }}
                      >
                        {challenge.difficulty}
                      </span>
                    )}
                  </div>

                  {challenge.description && (
                    <p className="challenge-description">{challenge.description}</p>
                  )}

                  {/* Streak visualization for daily_streak */}
                  {challenge.challenge_type === 'daily_streak' && (
                    renderStreakVisualization(challenge.current_streak, challenge.longest_streak)
                  )}

                  {/* Progress bar for count_based */}
                  {challenge.challenge_type === 'count_based' && challenge.target_count && (
                    renderProgressBar(challenge.current_count, challenge.target_count, challenge.unit || '')
                  )}

                  {/* Progress bar for accumulation */}
                  {challenge.challenge_type === 'accumulation' && challenge.target_value && (
                    renderProgressBar(challenge.current_value, challenge.target_value, challenge.unit || '')
                  )}

                  <div className="challenge-meta">
                    <div className="challenge-days">
                      📅 Day {daysElapsed + 1} of {daysElapsed + daysRemaining + 1} ({daysRemaining} days left)
                    </div>
                    <div className="challenge-completion">
                      ✅ {challenge.completed_days} days completed
                    </div>
                  </div>

                  {challenge.why_reason && (
                    <div className="challenge-why">
                      💡 <em>{challenge.why_reason}</em>
                    </div>
                  )}

                  <div className="challenge-actions">
                    <button 
                      className="btn-log-entry"
                      onClick={(e) => {
                        e.stopPropagation();
                        openLogModal(challenge);
                      }}
                    >
                      📝 Log Today
                    </button>
                    {challenge.can_graduate_to_habit && challenge.is_completed && (
                      <button
                        className="btn-graduate"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGraduateToHabit(challenge.id);
                        }}
                      >
                        ⬆️ Graduate to Habit
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Completed Challenges */}
      {completedChallenges.length > 0 && (
        <section className="challenges-section">
          <h2>Completed Challenges ({completedChallenges.length})</h2>
          <div className="challenges-grid">
            {completedChallenges.map((challenge) => (
              <div 
                key={challenge.id} 
                className="challenge-card challenge-completed"
                onClick={() => handleChallengeClick(challenge)}
              >
                <div className="challenge-card-header">
                  <div className="challenge-icon">{getChallengeTypeIcon(challenge.challenge_type)}</div>
                  <h3>{challenge.name}</h3>
                  <span className="challenge-status-completed">✅ Completed</span>
                </div>

                {challenge.challenge_type === 'daily_streak' && (
                  <div className="challenge-completion-info">
                    🔥 Longest streak: {challenge.longest_streak} days
                  </div>
                )}

                {challenge.graduated_habit_id && (
                  <div className="challenge-graduated">
                    ⬆️ Graduated to Habit #{challenge.graduated_habit_id}
                  </div>
                )}

                <div className="challenge-card-actions">
                  <button
                    className="btn-repeat"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRepeatChallenge(challenge.id);
                    }}
                  >
                    🔄 Repeat Challenge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Log Entry Modal */}
      {showLogModal && selectedChallenge && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Log Entry: {selectedChallenge.name}</h2>
              <button className="modal-close" onClick={() => setShowLogModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              {selectedChallenge.challenge_type === 'daily_streak' && (
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={logCompleted}
                      onChange={(e) => setLogCompleted(e.target.checked)}
                    />
                    {' '}Did you complete this today?
                  </label>
                </div>
              )}

              {selectedChallenge.challenge_type === 'count_based' && (
                <div className="form-group">
                  <label>Count ({selectedChallenge.unit})</label>
                  <input
                    type="number"
                    value={logCountValue}
                    onChange={(e) => setLogCountValue(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              )}

              {selectedChallenge.challenge_type === 'accumulation' && (
                <div className="form-group">
                  <label>Value ({selectedChallenge.unit})</label>
                  <input
                    type="number"
                    step="0.1"
                    value={logNumericValue}
                    onChange={(e) => setLogNumericValue(parseFloat(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Mood</label>
                <select value={logMood} onChange={(e) => setLogMood(e.target.value)}>
                  <option value="great">😄 Great</option>
                  <option value="good">🙂 Good</option>
                  <option value="okay">😐 Okay</option>
                  <option value="struggled">😓 Struggled</option>
                </select>
              </div>

              <div className="form-group">
                <label>Note (optional)</label>
                <textarea
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                  placeholder="Any reflections or notes..."
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowLogModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleLogEntry}>
                Log Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Challenge Details Modal */}
      {selectedChallenge && !showLogModal && (
        <div className="modal-overlay" onClick={() => setSelectedChallenge(null)}>
          <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedChallenge.name}</h2>
              <button className="modal-close" onClick={() => setSelectedChallenge(null)}>×</button>
            </div>

            <div className="modal-body">
              {challengeStats && (
                <div className="challenge-stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{challengeStats.days_elapsed}</div>
                    <div className="stat-label">Days Elapsed</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{challengeStats.days_remaining}</div>
                    <div className="stat-label">Days Remaining</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{challengeStats.completed_days}</div>
                    <div className="stat-label">Days Completed</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{(challengeStats.completion_rate * 100).toFixed(0)}%</div>
                    <div className="stat-label">Completion Rate</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{(challengeStats.success_rate * 100).toFixed(0)}%</div>
                    <div className="stat-label">Success Rate</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{challengeStats.is_on_track ? '✅' : '⚠️'}</div>
                    <div className="stat-label">On Track</div>
                  </div>
                </div>
              )}

              <h3>Recent Entries</h3>
              {challengeEntries.length === 0 ? (
                <p>No entries yet. Start logging!</p>
              ) : (
                <div className="entries-list">
                  {challengeEntries.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="entry-item">
                      <div className="entry-date">
                        {new Date(entry.entry_date).toLocaleDateString()}
                      </div>
                      <div className="entry-data">
                        {selectedChallenge.challenge_type === 'daily_streak' && (
                          <span>{entry.is_completed ? '✅ Done' : '❌ Missed'}</span>
                        )}
                        {selectedChallenge.challenge_type === 'count_based' && (
                          <span>{entry.count_value} {selectedChallenge.unit}</span>
                        )}
                        {selectedChallenge.challenge_type === 'accumulation' && (
                          <span>{entry.numeric_value} {selectedChallenge.unit}</span>
                        )}
                      </div>
                      {entry.mood && (
                        <div className="entry-mood">
                          {entry.mood === 'great' && '😄'}
                          {entry.mood === 'good' && '🙂'}
                          {entry.mood === 'okay' && '😐'}
                          {entry.mood === 'struggled' && '😓'}
                        </div>
                      )}
                      {entry.note && (
                        <div className="entry-note">{entry.note}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setSelectedChallenge(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Challenge Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Challenge</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              
              const challengeType = formData.get('challenge_type') as string;
              const startDate = formData.get('start_date') as string;
              const durationDays = parseInt(formData.get('duration_days') as string);
              
              // Calculate end date
              const endDate = new Date(startDate);
              endDate.setDate(endDate.getDate() + durationDays);
              
              const challengeData: any = {
                name: formData.get('name') as string,
                description: formData.get('description') as string || null,
                challenge_type: challengeType,
                start_date: startDate,
                end_date: endDate.toISOString().split('T')[0],
                difficulty: formData.get('difficulty') as string || 'medium',
                why_reason: formData.get('why_reason') as string || null,
              };

              // Add type-specific fields
              if (challengeType === 'daily_streak') {
                challengeData.target_days = durationDays;
              } else if (challengeType === 'count_based') {
                challengeData.target_count = parseInt(formData.get('target_count') as string);
                challengeData.unit = formData.get('unit') as string;
              } else if (challengeType === 'accumulation') {
                challengeData.target_value = parseFloat(formData.get('target_value') as string);
                challengeData.unit = formData.get('unit') as string;
              }

              try {
                await api.post('/api/challenges/', challengeData);
                await fetchChallenges();
                setShowCreateModal(false);
                // Reset form would happen automatically on modal close
              } catch (err: any) {
                alert(err.response?.data?.detail || 'Failed to create challenge');
              }
            }}>
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
                  />
                </div>

                {/* Challenge Type */}
                <div className="form-group">
                  <label htmlFor="challenge_type">Challenge Type *</label>
                  <select
                    id="challenge_type"
                    name="challenge_type"
                    required
                    onChange={(e) => {
                      const type = e.target.value;
                      const targetFields = document.getElementById('target-fields');
                      if (targetFields) {
                        targetFields.style.display = type === 'daily_streak' ? 'none' : 'block';
                      }
                    }}
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
                <div id="target-fields" style={{ display: 'none' }}>
                  <div className="form-group">
                    <label htmlFor="target_count">Daily Target *</label>
                    <input
                      type="number"
                      id="target_count"
                      name="target_count"
                      min="1"
                      placeholder="e.g., 20, 10000"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="target_value">Total Target (for accumulation type)</label>
                    <input
                      type="number"
                      id="target_value"
                      name="target_value"
                      min="1"
                      step="0.1"
                      placeholder="e.g., 600 (for 600 minutes total)"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="unit">Unit</label>
                    <input
                      type="text"
                      id="unit"
                      name="unit"
                      placeholder="e.g., pushups, pages, minutes, steps"
                    />
                  </div>
                </div>

                {/* Start Date and Duration */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="start_date">Start Date *</label>
                    <input
                      type="date"
                      id="start_date"
                      name="start_date"
                      required
                      defaultValue={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="duration_days">Duration (days) *</label>
                    <input
                      type="number"
                      id="duration_days"
                      name="duration_days"
                      required
                      min="1"
                      max="365"
                      defaultValue="21"
                      placeholder="e.g., 21, 30, 66"
                    />
                    <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                      21 days = habit formation, 66 days = deeply ingrained
                    </small>
                  </div>
                </div>

                {/* Difficulty */}
                <div className="form-group">
                  <label htmlFor="difficulty">Difficulty</label>
                  <select id="difficulty" name="difficulty">
                    <option value="easy">Easy - Gentle start</option>
                    <option value="medium" selected>Medium - Moderate effort</option>
                    <option value="hard">Hard - Real challenge</option>
                  </select>
                </div>

                {/* Why Reason */}
                <div className="form-group">
                  <label htmlFor="why_reason">Why is this important to you?</label>
                  <textarea
                    id="why_reason"
                    name="why_reason"
                    rows={2}
                    placeholder="Your motivation will keep you going..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button"
                  className="btn-cancel" 
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Challenge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
