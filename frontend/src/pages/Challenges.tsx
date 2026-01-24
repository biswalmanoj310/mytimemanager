/**
 * Challenges Page
 * Time-bound personal challenges (7-30 days)
 * Fun experiments to build new behaviors
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatDateForInput } from '../utils/dateHelpers';
import './Challenges.css';
import { AddChallengeModal } from '../components/AddChallengeModal';

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
  pillar_name: string | null;
  pillar_color: string | null;
  category_id: number | null;
  category_name: string | null;
  sub_category_name: string | null;
  linked_task_id: number | null;
  linked_task_name: string | null;
  goal_id: number | null;
  goal_name: string | null;
  project_id: number | null;
  project_name: string | null;
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
  const [allChallengeEntries, setAllChallengeEntries] = useState<Map<number, ChallengeEntry[]>>(new Map());
  const [showLogModal, setShowLogModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [logDate, setLogDate] = useState<string>(formatDateForInput(new Date()));
  const [logCompleted, setLogCompleted] = useState(false);
  const [logCountValue, setLogCountValue] = useState<number>(0);
  const [logNumericValue, setLogNumericValue] = useState<number>(0);
  const [logNote, setLogNote] = useState<string>('');
  const [logMood, setLogMood] = useState<string>('good');
  
  // Daily tracking grid states
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [quickLogMinutes, setQuickLogMinutes] = useState<number>(0);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/api/challenges/');
      setChallenges(Array.isArray(data) ? data : []);
      
      // Fetch entries for all challenges
      if (Array.isArray(data)) {
        const entriesMap = new Map<number, ChallengeEntry[]>();
        await Promise.all(
          data.map(async (challenge: Challenge) => {
            try {
              const today = new Date();
              const startDate = new Date(challenge.start_date);
              const entries = await api.get<ChallengeEntry[]>(
                `/api/challenges/${challenge.id}/entries?start_date=${formatDateForInput(startDate)}&end_date=${formatDateForInput(today)}`
              );
              entriesMap.set(challenge.id, Array.isArray(entries) ? entries : []);
            } catch (err) {
              console.error(`Error fetching entries for challenge ${challenge.id}:`, err);
              entriesMap.set(challenge.id, []);
            }
          })
        );
        setAllChallengeEntries(entriesMap);
      }
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

  const fetchChallengeEntries = async (challengeId: number, startDate?: string, endDate?: string) => {
    try {
      let url = `/api/challenges/${challengeId}/entries`;
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (params.toString()) url += `?${params.toString()}`;
      
      const data = await api.get<ChallengeEntry[]>(url);
      setChallengeEntries(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching challenge entries:', err);
    }
  };

  const handleChallengeClick = async (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    await fetchChallengeStats(challenge.id);
    
    // Fetch entries from challenge start date to today
    const today = new Date();
    const startDate = new Date(challenge.start_date);
    
    await fetchChallengeEntries(
      challenge.id,
      formatDateForInput(startDate),
      formatDateForInput(today)
    );
  };

  // Generate array of days from challenge start to today (up to 21 days)
  const getLast14Days = (): string[] => {
    if (!selectedChallenge) return [];
    
    const days: string[] = [];
    const today = new Date();
    const startDate = new Date(selectedChallenge.start_date);
    
    // Calculate days from start to today
    let currentDate = new Date(startDate);
    while (currentDate <= today && days.length < 21) {
      days.push(formatDateForInput(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  // Get entry for a specific date
  const getEntryForDate = (date: string): ChallengeEntry | undefined => {
    return challengeEntries.find(entry => entry.entry_date === date);
  };

  // Handle clicking on a date square
  const handleDateSquareClick = (date: string) => {
    const entry = getEntryForDate(date);
    setSelectedDate(date);
    setQuickLogMinutes(entry?.numeric_value || 0);
    setShowQuickLogModal(true);
  };

  // Handle quick log submit
  const handleQuickLogSubmit = async () => {
    if (!selectedChallenge || !selectedDate) return;

    try {
      await api.post(`/api/challenges/${selectedChallenge.id}/log`, {
        entry_date: selectedDate,
        is_completed: quickLogMinutes > 0,
        count_value: 0,
        numeric_value: quickLogMinutes,
        note: null,
        mood: null
      });

      // Refresh data
      await fetchChallenges();
      await fetchChallengeStats(selectedChallenge.id);
      
      // Refresh entries from challenge start date
      const today = new Date();
      const startDate = new Date(selectedChallenge.start_date);
      await fetchChallengeEntries(
        selectedChallenge.id,
        formatDateForInput(startDate),
        formatDateForInput(today)
      );

      setShowQuickLogModal(false);
    } catch (err: any) {
      console.error('Error logging entry:', err);
      alert(err.response?.data?.detail || 'Failed to log entry');
    }
  };

  const openLogModal = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setShowLogModal(true);
    setLogDate(formatDateForInput(new Date()));
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

  const handleDeleteChallenge = async (challengeId: number) => {
    try {
      await api.delete(`/api/challenges/${challengeId}`);
      await fetchChallenges();
      if (selectedChallenge?.id === challengeId) {
        setSelectedChallenge(null);
        setChallengeStats(null);
      }
      alert('Challenge deleted successfully!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete challenge');
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

  const getGradientColors = (index: number): { start: string; end: string } => {
    const gradients = [
      { start: '#667eea', end: '#764ba2' }, // Purple-Blue
      { start: '#f093fb', end: '#f5576c' }, // Pink-Red
      { start: '#4facfe', end: '#00f2fe' }, // Light Blue-Cyan
      { start: '#43e97b', end: '#38f9d7' }, // Green-Turquoise
      { start: '#fa709a', end: '#fee140' }, // Pink-Yellow
      { start: '#30cfd0', end: '#330867' }, // Cyan-Purple
      { start: '#a8edea', end: '#fed6e3' }, // Mint-Pink
      { start: '#ff9a56', end: '#ff6a88' }, // Orange-Pink
    ];
    return gradients[index % gradients.length];
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
      {/* Compact Header */}
      <div className="challenges-hero" style={{ padding: '1.5rem 2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '0.75rem' }}>
          <h1 style={{ fontSize: '2.5rem', margin: 0 }}>🎯 Challenges</h1>
          <p style={{ fontSize: '1rem', opacity: 0.9, margin: 0 }}>Time-bound experiments to build new behaviors</p>
        </div>
        <div style={{ 
          fontSize: '0.95rem',
          fontStyle: 'italic',
          opacity: 0.85,
          maxWidth: '100%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          "{inspirationalQuotes[currentQuoteIndex].text}" — {inspirationalQuotes[currentQuoteIndex].author}
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
            activeChallenges.map((challenge, index) => {
              const daysElapsed = Math.floor(
                (new Date().getTime() - new Date(challenge.start_date).getTime()) / (1000 * 60 * 60 * 24)
              );
              const daysRemaining = Math.ceil(
                (new Date(challenge.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );

              // Calculate "Today's Target" - what's needed today to achieve ideal average from tomorrow
              let todaysTarget = 0;
              let idealDailyAverage = 0;
              const totalDays = daysElapsed + daysRemaining + 1;
              
              if (challenge.challenge_type === 'accumulation' && challenge.target_value) {
                // Ideal average per day over entire period
                idealDailyAverage = challenge.target_value / totalDays;
                // What we should have achieved by end of today
                const shouldHaveByToday = idealDailyAverage * (daysElapsed + 1);
                // Deficit (what we're behind)
                const deficit = shouldHaveByToday - challenge.current_value;
                // Today's target = ideal + deficit (so tomorrow we're back on ideal average)
                todaysTarget = idealDailyAverage + Math.max(0, deficit);
              } else if (challenge.challenge_type === 'count_based' && challenge.target_count) {
                idealDailyAverage = challenge.target_count / totalDays;
                const shouldHaveByToday = idealDailyAverage * (daysElapsed + 1);
                const deficit = shouldHaveByToday - challenge.current_count;
                todaysTarget = idealDailyAverage + Math.max(0, deficit);
              }

              // Get gradient colors - use pillar color if set, otherwise cycle through predefined gradients
              let gradientStart: string;
              let gradientEnd: string;
              
              if (challenge.pillar_color) {
                gradientStart = challenge.pillar_color;
                gradientEnd = `${challenge.pillar_color}CC`; // Add slight transparency to end
              } else {
                const colors = getGradientColors(index);
                gradientStart = colors.start;
                gradientEnd = colors.end;
              }

              return (
                <div 
                  key={challenge.id} 
                  className={`challenge-card challenge-${challenge.difficulty || 'medium'}`}
                  onClick={() => handleChallengeClick(challenge)}
                  style={{
                    background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
                  }}
                >
                  <div className="challenge-card-header">
                    <div className="challenge-icon">{getChallengeTypeIcon(challenge.challenge_type)}</div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0 }}>{challenge.name}</h3>
                      {/* Pillar:Category - directly under challenge name, aligned with it */}
                      {(challenge.pillar_name || challenge.category_name) && (
                        <div style={{ 
                          fontSize: '11px',
                          color: 'rgba(255, 255, 255, 0.85)',
                          marginTop: '4px',
                          fontWeight: '500'
                        }}>
                          📍 {challenge.pillar_name || 'No Pillar'}: {challenge.category_name || 'No Category'}
                        </div>
                      )}
                    </div>
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

                  {/* Progress bars moved to top */}
                  {challenge.challenge_type === 'daily_streak' && (
                    renderStreakVisualization(challenge.current_streak, challenge.longest_streak)
                  )}
                  {challenge.challenge_type === 'count_based' && challenge.target_count && (
                    renderProgressBar(challenge.current_count, challenge.target_count, challenge.unit || '')
                  )}
                  {challenge.challenge_type === 'accumulation' && challenge.target_value && (
                    renderProgressBar(challenge.current_value, challenge.target_value, challenge.unit || '')
                  )}

                  {/* Today's Target - Prominent Display */}
                  {(challenge.challenge_type === 'accumulation' || challenge.challenge_type === 'count_based') && todaysTarget > 0 && (
                    <div>
                      <div style={{
                        marginTop: '10px',
                        marginBottom: '4px',
                        padding: '10px 14px',
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '8px',
                        border: '2px solid rgba(255, 255, 255, 0.4)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px' }}>🎯</span>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                            Today's Target:
                          </span>
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                          {challenge.challenge_type === 'accumulation' 
                            ? todaysTarget.toFixed(1)
                            : Math.ceil(todaysTarget)
                          } {challenge.unit}
                        </div>
                      </div>
                      <div style={{ 
                        fontSize: '10px', 
                        color: 'rgba(255, 255, 255, 0.75)', 
                        fontStyle: 'italic',
                        marginBottom: '8px',
                        paddingLeft: '4px',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                      }}>
                        💡 Complete this today to achieve ideal average from tomorrow
                      </div>
                    </div>
                  )}

                  {/* Day info in one line below progress bar */}
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#ffffff',
                    fontWeight: '500',
                    marginTop: '8px',
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                  }}>
                    <span>📅 Day {daysElapsed + 1} of {daysElapsed + daysRemaining + 1} ({daysRemaining} days left)</span>
                    <span>✅ {challenge.completed_days} days completed</span>
                  </div>

                  {/* Layout with two square boxes side by side, centered */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', justifyContent: 'center' }}>
                    {/* Progress Stats box on left */}
                    <div style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '8px',
                      padding: '0',
                      minWidth: '145px',
                      flex: '0 0 auto',
                      border: '2px solid rgba(255, 255, 255, 0.4)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        fontSize: '11px', 
                        fontWeight: '700', 
                        color: '#ffffff', 
                        padding: '10px 12px',
                        textAlign: 'center', 
                        letterSpacing: '0.5px',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
                      }}>
                        Progress Stats
                      </div>
                      <div style={{ padding: '12px' }}>
                        {challenge.challenge_type === 'daily_streak' && challenge.target_days && (
                          <div style={{ fontSize: '12px', color: '#ffffff', lineHeight: '1.8', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                            <div style={{ marginBottom: '3px' }}><strong>Target:</strong> {challenge.target_days} days</div>
                            <div style={{ marginBottom: '3px' }}><strong>Done:</strong> {challenge.completed_days} days</div>
                            <div><strong>Freq:</strong> Daily</div>
                          </div>
                        )}
                        {challenge.challenge_type === 'count_based' && challenge.target_count && (
                          <div style={{ fontSize: '12px', color: '#ffffff', lineHeight: '1.8', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                            <div style={{ marginBottom: '3px' }}><strong>Target:</strong> {challenge.target_count} {challenge.unit}</div>
                            <div style={{ marginBottom: '3px' }}><strong>Done:</strong> {challenge.current_count} {challenge.unit}</div>
                            <div><strong>Need:</strong> {Math.ceil((challenge.target_count - challenge.current_count) / Math.max(1, daysRemaining))}/day</div>
                          </div>
                        )}
                        {challenge.challenge_type === 'accumulation' && challenge.target_value && (
                          <div style={{ fontSize: '12px', color: '#ffffff', lineHeight: '1.8', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                            <div style={{ marginBottom: '3px' }}><strong>Target:</strong> {challenge.target_value} {challenge.unit}</div>
                            <div style={{ marginBottom: '3px' }}><strong>Done:</strong> {challenge.current_value.toFixed(1)} {challenge.unit}</div>
                            <div><strong>Need:</strong> {((challenge.target_value - challenge.current_value) / Math.max(1, daysRemaining)).toFixed(1)}/day</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Date Info box on right */}
                    <div style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '8px',
                      padding: '0',
                      minWidth: '145px',
                      flex: '0 0 auto',
                      border: '2px solid rgba(255, 255, 255, 0.4)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        fontSize: '11px', 
                        fontWeight: '700', 
                        color: '#ffffff', 
                        padding: '10px 12px',
                        textAlign: 'center', 
                        letterSpacing: '0.5px',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
                      }}>
                        Date Info
                      </div>
                      <div style={{ padding: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#ffffff', lineHeight: '1.8', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                          <div style={{ marginBottom: '3px' }}>
                            <strong>Start:</strong> {new Date(challenge.start_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(/ /g, '-')}
                          </div>
                          <div style={{ marginBottom: '3px' }}>
                            <strong>End:</strong> {new Date(challenge.end_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(/ /g, '-')}
                          </div>
                          <div>
                            <strong>Days:</strong> {daysElapsed + 1} of {daysElapsed + daysRemaining + 1}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Why reason section below the boxes */}
                  {challenge.why_reason && (
                    <div style={{
                      fontSize: '12px',
                      color: '#ffffff',
                      fontStyle: 'italic',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      borderLeft: '3px solid rgba(255, 255, 255, 0.4)',
                      marginBottom: '12px'
                    }}>
                      💡 {challenge.why_reason}
                    </div>
                  )}

                  {/* Daily Tracking Grid - always visible in card */}
                  {(() => {
                    // Generate dates from challenge start to today (up to 21 days)
                    const days: string[] = [];
                    const today = new Date();
                    const startDate = new Date(challenge.start_date);
                    let currentDate = new Date(startDate);
                    
                    while (currentDate <= today && days.length < 21) {
                      days.push(currentDate.toISOString().split('T')[0]);
                      currentDate.setDate(currentDate.getDate() + 1);
                    }
                    
                    return days.length > 0 ? (
                      <div style={{
                        marginBottom: '12px',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '8px',
                        padding: '12px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                      }}>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: '#ffffff',
                          marginBottom: '10px',
                          textAlign: 'center',
                          letterSpacing: '0.5px',
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                        }}>
                          📊 Daily Activity Tracker
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(7, 1fr)',
                          gap: '8px',
                          justifyContent: 'center',
                          maxWidth: '420px',
                          margin: '0 auto'
                        }}>
                          {days.map(date => {
                            const entries = allChallengeEntries.get(challenge.id) || [];
                            const entry = entries.find(e => e.entry_date === date);
                            const minutes = entry?.numeric_value || 0;
                            const dateObj = new Date(date + 'T00:00:00');
                            const dayNum = dateObj.getDate();
                            const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' });
                            
                            // Color intensity based on minutes (0-120 scale)
                            const intensity = Math.min(minutes / 120, 1);
                            const hasEntry = minutes > 0;
                            
                            return (
                              <div
                                key={date}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <div
                                  onClick={() => {
                                    setSelectedChallenge(challenge);
                                    setSelectedDate(date);
                                    setQuickLogMinutes(minutes);
                                    setShowQuickLogModal(true);
                                  }}
                                  title={`${monthShort} ${dayNum}: ${minutes} min`}
                                  style={{
                                    width: '48px',
                                    height: '48px',
                                    backgroundColor: hasEntry 
                                      ? `rgba(76, 175, 80, ${0.3 + intensity * 0.7})` 
                                      : 'rgba(0, 0, 0, 0.4)',
                                    border: hasEntry 
                                      ? '2px solid rgba(76, 175, 80, 0.8)' 
                                      : '2px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: hasEntry 
                                      ? '0 2px 6px rgba(76, 175, 80, 0.4)' 
                                      : '0 1px 3px rgba(0, 0, 0, 0.3)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                    e.currentTarget.style.boxShadow = hasEntry
                                      ? '0 3px 10px rgba(76, 175, 80, 0.6)'
                                      : '0 2px 6px rgba(255, 255, 255, 0.3)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.boxShadow = hasEntry
                                      ? '0 2px 6px rgba(76, 175, 80, 0.4)'
                                      : '0 1px 3px rgba(0, 0, 0, 0.3)';
                                  }}
                                >
                                  <div style={{
                                    fontSize: hasEntry ? '20px' : '16px',
                                    color: hasEntry ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                                    fontWeight: '700',
                                    lineHeight: '1',
                                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                                  }}>
                                    {hasEntry ? `${Math.round(minutes)}` : '-'}
                                  </div>
                                </div>
                                
                                <div style={{
                                  fontSize: '9px',
                                  color: 'rgba(255, 255, 255, 0.7)',
                                  fontWeight: '600',
                                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                  textAlign: 'center',
                                  lineHeight: '1.2'
                                }}>
                                  {monthShort} {dayNum}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Linked Items Section with better visibility */}
                  {(challenge.goal_name || challenge.project_name || challenge.linked_task_name) && (
                    <div style={{
                      marginBottom: '12px',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      lineHeight: '1.7',
                      borderLeft: '3px solid rgba(255, 255, 255, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.25)'
                    }}>
                      <div style={{ fontWeight: '700', marginBottom: '6px', color: '#ffffff', letterSpacing: '0.3px', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                        🔗 Linked Items:
                      </div>
                      {challenge.goal_name && (
                        <div style={{ marginBottom: '4px', color: '#ffffff', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                          <span style={{ opacity: 0.85, fontWeight: '500' }}>Goal:</span>{' '}
                          <strong>{challenge.goal_name}</strong>
                        </div>
                      )}
                      {challenge.project_name && (
                        <div style={{ marginBottom: '4px', color: '#ffffff', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                          <span style={{ opacity: 0.85, fontWeight: '500' }}>Project:</span>{' '}
                          <strong>{challenge.project_name}</strong>
                        </div>
                      )}
                      {challenge.linked_task_name && (
                        <div style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                          <span style={{ opacity: 0.85, fontWeight: '500' }}>Task:</span>{' '}
                          <strong>{challenge.linked_task_name}</strong>
                        </div>
                      )}
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
                    <button 
                      className="btn-edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingChallenge(challenge);
                        setShowCreateModal(true);
                      }}
                      style={{ marginLeft: '8px', padding: '6px 12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete challenge "${challenge.name}"?`)) {
                          handleDeleteChallenge(challenge.id);
                        }
                      }}
                      style={{ marginLeft: '8px', padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      🗑️ Delete
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
            {completedChallenges.map((challenge, index) => {
              // Get gradient colors - use pillar color if set, otherwise cycle through predefined gradients
              let gradientStart: string;
              let gradientEnd: string;
              
              if (challenge.pillar_color) {
                gradientStart = challenge.pillar_color;
                gradientEnd = `${challenge.pillar_color}CC`;
              } else {
                const colors = getGradientColors(activeChallenges.length + index);
                gradientStart = colors.start;
                gradientEnd = colors.end;
              }
              
              return (
                <div 
                  key={challenge.id} 
                  className="challenge-card challenge-completed"
                  onClick={() => handleChallengeClick(challenge)}
                  style={{
                    background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
                    opacity: 0.75
                  }}
                >
                  <div className="challenge-card-header">
                    <div className="challenge-icon">{getChallengeTypeIcon(challenge.challenge_type)}</div>
                    <h3>{challenge.name}</h3>
                    <span className="challenge-status-completed">✅ Completed</span>
                  </div>

                  {/* Pillar Badge */}
                  {challenge.pillar_name && (
                    <div style={{ 
                      display: 'inline-block',
                      padding: '4px 12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      color: '#ffffff',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      marginBottom: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                      📍 {challenge.pillar_name}
                    </div>
                  )}

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
              );
            })}
          </div>
        </section>
      )}

      {/* Log Entry Modal */}
      {/* Quick Log Modal for Daily Tracking Grid */}
      {showQuickLogModal && selectedChallenge && selectedDate && (
        <div className="modal-overlay" onClick={() => setShowQuickLogModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Log Time: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}</h2>
              <button className="modal-close" onClick={() => setShowQuickLogModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>
                {selectedChallenge.name}
              </div>

              <div className="form-group">
                <label>Minutes Spent</label>
                <input
                  type="number"
                  value={quickLogMinutes}
                  onChange={(e) => setQuickLogMinutes(parseInt(e.target.value) || 0)}
                  min="0"
                  max="1440"
                  placeholder="Enter minutes"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleQuickLogSubmit();
                    }
                  }}
                />
              </div>

              <div style={{ 
                fontSize: '12px', 
                color: '#888', 
                marginTop: '8px',
                fontStyle: 'italic'
              }}>
                💡 Tip: Press Enter to quickly log
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowQuickLogModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleQuickLogSubmit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

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

              {/* Daily Tracking Grid */}
              <div style={{
                marginBottom: '20px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid #dee2e6'
              }}>
                <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>📊 Daily Activity</h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '8px',
                  maxWidth: '500px',
                  margin: '0 auto'
                }}>
                  {getLast14Days().map(date => {
                    const entry = getEntryForDate(date);
                    const minutes = entry?.numeric_value || 0;
                    const dateObj = new Date(date + 'T00:00:00');
                    const dayNum = dateObj.getDate();
                    const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' });
                    
                    // Color intensity based on minutes (0-120 scale)
                    const intensity = Math.min(minutes / 120, 1);
                    const hasEntry = minutes > 0;
                    
                    return (
                      <div
                        key={date}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {/* Square with time */}
                        <div
                          onClick={() => handleDateSquareClick(date)}
                          title={`${monthShort} ${dayNum}: ${minutes} min`}
                          style={{
                            width: '55px',
                            height: '55px',
                            backgroundColor: hasEntry 
                              ? `rgba(76, 175, 80, ${0.3 + intensity * 0.7})` 
                              : '#e9ecef',
                            border: hasEntry 
                              ? '2px solid rgba(76, 175, 80, 0.8)' 
                              : '2px solid #dee2e6',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: hasEntry 
                              ? '0 2px 6px rgba(76, 175, 80, 0.3)' 
                              : '0 1px 3px rgba(0, 0, 0, 0.1)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.08)';
                            e.currentTarget.style.boxShadow = hasEntry
                              ? '0 3px 10px rgba(76, 175, 80, 0.5)'
                              : '0 2px 6px rgba(0, 0, 0, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = hasEntry
                              ? '0 2px 6px rgba(76, 175, 80, 0.3)'
                              : '0 1px 3px rgba(0, 0, 0, 0.1)';
                          }}
                        >
                          {/* Time spent - large in center */}
                          <div style={{
                            fontSize: hasEntry ? '22px' : '18px',
                            color: hasEntry ? '#ffffff' : '#adb5bd',
                            fontWeight: '700',
                            lineHeight: '1'
                          }}>
                            {hasEntry ? `${minutes}` : '-'}
                          </div>
                        </div>
                        
                        {/* Date label below square */}
                        <div style={{
                          fontSize: '10px',
                          color: '#6c757d',
                          fontWeight: '600',
                          textAlign: 'center',
                          lineHeight: '1.2'
                        }}>
                          {monthShort} {dayNum}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

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

      {/* Create/Edit Challenge Modal */}
      <AddChallengeModal
        show={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingChallenge(null);
        }}
        onSuccess={async () => {
          setShowCreateModal(false);
          setEditingChallenge(null);
          await fetchChallenges();
        }}
        editingChallenge={editingChallenge as any}
      />
    </div>
  );
}
