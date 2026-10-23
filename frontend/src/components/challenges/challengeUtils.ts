/**
 * Shared types, constants and helpers for the Challenges page
 * (widget view, list view, detail + log modals)
 */

import { formatDateForInput } from '../../utils/dateHelpers';

export type ChallengeType = 'daily_streak' | 'count_based' | 'accumulation';
export type ChallengeStatus = 'active' | 'completed' | 'failed' | 'abandoned';
export type StatusIndicator =
  | 'on_track' | 'at_risk' | 'behind' | 'not_started' | 'just_started'
  | 'completed' | 'failed' | 'abandoned';

export interface RecentDay {
  date: string;
  value: number;
  completed: boolean;
}

export interface Challenge {
  id: number;
  name: string;
  description: string | null;
  challenge_type: ChallengeType;
  start_date: string;
  end_date: string;
  target_days: number | null;
  target_count: number | null;
  target_value: number | null;
  unit: string | null;
  daily_target: number | null;
  required_days: number | null;
  difficulty: string | null;
  reward: string | null;
  why_reason: string | null;
  pillar_id: number | null;
  pillar_name: string | null;
  pillar_color: string | null;
  category_id: number | null;
  category_name: string | null;
  sub_category_id: number | null;
  linked_task_id: number | null;
  linked_task_name: string | null;
  goal_id: number | null;
  goal_name: string | null;
  project_id: number | null;
  project_name: string | null;
  auto_sync: boolean;
  can_graduate_to_habit: boolean;
  graduated_habit_id: number | null;
  current_streak: number;
  longest_streak: number;
  completed_days: number;
  current_count: number;
  current_value: number;
  status: ChallengeStatus;
  is_completed: boolean;
  completion_date: string | null;
  // Live metrics computed by the backend
  days_total: number;
  days_elapsed: number;
  days_remaining: number;
  has_started: boolean;
  target: number | null;
  current: number;
  progress_percentage: number;
  expected_percentage: number;
  status_indicator: StatusIndicator;
  is_on_track: boolean;
  completed_today: boolean;
  today_value: number | null;
  todays_target: number | null;
  today_remaining: number | null;
  needed_per_day: number;
  days_behind: number;
  unrealistic_pace: boolean;
  daily_average: number;
  projected_percentage: number | null;
  success_rate: number;
  days_required: number;
  missed_days: number;
  allowed_misses: number;
  recent_days: RecentDay[];
}

export interface ChallengeEntry {
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

export interface LogPayload {
  entry_date: string;
  is_completed: boolean;
  count_value?: number | null;
  numeric_value?: number | null;
  note?: string | null;
  mood?: string | null;
}

export const TYPE_META: Record<ChallengeType, { icon: string; label: string; hint: string }> = {
  daily_streak: { icon: '🔥', label: 'Daily Streak', hint: 'Show up every day' },
  count_based: { icon: '🎯', label: 'Count', hint: 'Hit a number of times' },
  accumulation: { icon: '📈', label: 'Accumulate', hint: 'Build up a total' },
};

export const STATUS_META: Record<StatusIndicator, { label: string; emoji: string; bg: string; text: string; bar: string }> = {
  on_track: { label: 'On Track', emoji: '🟢', bg: '#dcfce7', text: '#166534', bar: '#059669' },
  at_risk: { label: 'At Risk', emoji: '🟡', bg: '#fef9c3', text: '#b45309', bar: '#f59e0b' },
  behind: { label: 'Behind', emoji: '🔴', bg: '#fee2e2', text: '#dc2626', bar: '#ef4444' },
  not_started: { label: 'Not Started', emoji: '⏳', bg: '#f1f5f9', text: '#64748b', bar: '#94a3b8' },
  just_started: { label: 'Just Started', emoji: '🌱', bg: '#e0f2fe', text: '#0369a1', bar: '#38bdf8' },
  completed: { label: 'Completed', emoji: '🏆', bg: '#dcfce7', text: '#059669', bar: '#059669' },
  failed: { label: 'Ended', emoji: '🌱', bg: '#ffedd5', text: '#c2410c', bar: '#fb923c' },
  abandoned: { label: 'Abandoned', emoji: '💤', bg: '#f3f4f6', text: '#6b7280', bar: '#9ca3af' },
};

// Same three-pillar palette used on the Goals page
export const PILLAR_STYLES: Record<string, { bg: string; text: string; accent: string; icon: string }> = {
  'Hard Work': { bg: '#dbeafe', text: '#1d4ed8', accent: '#3b82f6', icon: '💼' },
  Calmness: { bg: '#dcfce7', text: '#166534', accent: '#10b981', icon: '🧘' },
  Family: { bg: '#f3e8ff', text: '#7e22ce', accent: '#8b5cf6', icon: '👨‍👩‍👦' },
};

export const pillarStyle = (name: string | null) =>
  (name && PILLAR_STYLES[name]) || { bg: '#f1f5f9', text: '#475569', accent: '#94a3b8', icon: '📍' };

export const MOODS: { value: string; emoji: string; label: string }[] = [
  { value: 'great', emoji: '😄', label: 'Great' },
  { value: 'good', emoji: '🙂', label: 'Good' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'struggled', emoji: '😓', label: 'Struggled' },
];

export const todayString = (): string => formatDateForInput(new Date());

export const addDaysToString = (value: string, days: number): string => {
  const d = parseLocalDate(value);
  d.setDate(d.getDate() + days);
  return formatDateForInput(d);
};

/** Parse 'YYYY-MM-DD' as a local date (new Date('YYYY-MM-DD') is UTC and shifts the day) */
export const parseLocalDate = (value: string): Date => {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const fmtDate = (value: string): string =>
  parseLocalDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const fmtShortDate = (value: string): string =>
  parseLocalDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const fmtNumber = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '0';
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) < 10 ? 2 : 1 });
};

export const isHoursUnit = (unit: string | null | undefined): boolean =>
  !!unit && ['h', 'hr', 'hrs', 'hour', 'hours'].includes(unit.trim().toLowerCase());

/** 1.5 -> "1h 30m" for hour-based challenges, plain number otherwise */
export const fmtAmount = (c: Pick<Challenge, 'unit'>, n: number | null | undefined): string => {
  if (n === null || n === undefined) return '0';
  if (!isHoursUnit(c.unit)) return fmtNumber(n);
  const totalMinutes = Math.round(n * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const unitOf = (c: Challenge): string => c.unit || (c.challenge_type === 'count_based' ? 'times' : '');

export const isSynced = (c: Challenge): boolean => c.auto_sync && !!c.linked_task_id;

/** 857 minutes -> "14h 17m" */
export const fmtDuration = (minutes: number): string => {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/** "2,189 / 3,600 Minutes", "3 / 5 days", "12 / 20 days" (daily-minimum mode) */
export const progressLabel = (c: Challenge): string => {
  if (c.daily_target || c.challenge_type === 'daily_streak') {
    return `${fmtNumber(c.current)} / ${fmtNumber(c.target)} days`;
  }
  return `${fmtNumber(c.current)} / ${fmtNumber(c.target)} ${unitOf(c)}`.trim();
};

/** Running total for daily-minimum challenges: "240 pushups so far · min 20/day" */
export const totalLine = (c: Challenge): string | null => {
  if (!c.daily_target) return null;
  const total = c.challenge_type === 'count_based' ? c.current_count : c.current_value;
  const unit = unitOf(c);
  return `${fmtAmount(c, total)} ${isHoursUnit(c.unit) ? '' : unit} so far · min ${fmtAmount(c, c.daily_target)}${isHoursUnit(c.unit) ? '' : ' ' + unit}/day`
    .replace(/\s+/g, ' ').trim();
};

/** "45 / 120 Minutes" style line for counting challenges, null for streaks */
export const todayLine = (c: Challenge): string | null => {
  if (c.challenge_type === 'daily_streak' || c.todays_target === null) return null;
  const goal = c.daily_target ? c.todays_target : Math.ceil(c.todays_target);
  const unit = isHoursUnit(c.unit) ? '' : unitOf(c);
  return `${fmtAmount(c, c.today_value || 0)} / ${fmtAmount(c, goal)} ${unit}`.trim();
};

export const isOpen = (c: Challenge): boolean => c.status === 'active';

/** Active challenge that still needs something from the user today (including a quota that is only partly done) */
export const needsActionToday = (c: Challenge): boolean =>
  isOpen(c) && c.has_started && (!c.completed_today || (c.today_remaining ?? 0) > 0);

/**
 * Short coaching line grounded in the habit research the feature is built on:
 * "never miss twice" (James Clear), tiny wins (BJ Fogg), failure as learning (growth mindset).
 */
export const coachMessage = (c: Challenge): string => {
  switch (c.status_indicator) {
    case 'completed':
      return c.graduated_habit_id
        ? '🌟 You turned this experiment into a habit. That is who you are now.'
        : '🏆 You did it! Notice how it felt — could this become a permanent habit?';
    case 'failed':
      return '🌱 Not a failure — an experiment with data. What got in the way? Try again with a smaller target.';
    case 'abandoned':
      return '💤 Paused. Stopping is a valid result; you learned what does not fit right now.';
    case 'not_started':
      return `⏳ Starts ${fmtShortDate(c.start_date)}. Decide now when and where you will do it.`;
    case 'just_started':
      return c.todays_target !== null && !c.daily_target
        ? `🌱 Day one — nothing to judge yet. Hit today's ${fmtAmount(c, Math.ceil(c.todays_target))} ${isHoursUnit(c.unit) ? '' : unitOf(c)} to start on track.`.replace(/\s+\./, '.')
        : '🌱 Day one — nothing to judge yet. A small win today starts you on track.';
    case 'behind':
      if (c.unrealistic_pace) {
        return `⚠️ This target needs ${fmtDuration(c.needed_per_day * (isHoursUnit(c.unit) ? 60 : 1))} every single day — that is not a plan. Lower the total or move the end date, then it becomes winnable.`;
      }
      if (c.daily_target && c.status === 'active' && c.missed_days > c.allowed_misses) {
        return c.completed_today
          ? '💪 Today counts. This run can no longer be perfect — finish it anyway; consistency beats perfection.'
          : '💪 This run can no longer be perfect, and that is fine. Show up today — consistency beats perfection.';
      }
      return c.completed_today
        ? '💪 Today is logged — that is how comebacks start. Never miss twice.'
        : '💪 Never miss twice. One small action today gets you back in the game.';
    case 'at_risk':
      return c.completed_today
        ? '👏 Logged today — you are closing the gap.'
        : '⚡ Slightly behind pace. A solid day today puts you back on track.';
    default:
      if (c.daily_target && !c.completed_today && (c.today_value || 0) > 0) {
        return `⚡ ${fmtAmount(c, c.today_remaining || 0)} ${isHoursUnit(c.unit) ? 'more' : unitOf(c) + ' more'} and today counts.`;
      }
      if (c.completed_today) return '✅ Today is done. Every day is a vote for the person you are becoming.';
      if (c.current_streak >= 3) return `🔥 ${c.current_streak}-day streak! Protect it with a small action today.`;
      return '🙂 On track. Today is still open — a small win counts.';
  }
};

/** 0-1 heat intensity of a tracker cell (total-target challenges shade by how much was done) */
export const cellIntensity = (c: Challenge, value: number): number => {
  if (value <= 0) return 0;
  if (c.challenge_type === 'daily_streak' || c.daily_target) return 1;
  const dailyShare = (c.target || 0) / Math.max(1, c.days_total);
  return dailyShare > 0 ? Math.min(1, 0.35 + (value / dailyShare) * 0.65) : 1;
};

export type DayState = 'hit' | 'partial' | 'missed' | 'empty' | 'future';

/** What a calendar day means for this challenge */
export const dayState = (c: Challenge, value: number, date: string): DayState => {
  const today = todayString();
  if (date > today) return 'future';
  if (c.daily_target) {
    if (value >= c.daily_target - 1e-9) return 'hit';
    if (value > 0) return 'partial';
  } else if (value > 0) {
    return 'hit';
  }
  return date < today ? 'missed' : 'empty';
};

/** Habit-page palette: green done, red missed, grey not yet; amber for a partial day */
export const dayCellStyle = (c: Challenge, state: DayState, value: number): { background: string; color: string } => {
  switch (state) {
    case 'hit': {
      const alpha = c.daily_target || c.challenge_type === 'daily_streak' ? 1 : 0.45 + cellIntensity(c, value) * 0.55;
      return { background: `rgba(72, 187, 120, ${alpha})`, color: alpha > 0.7 ? '#fff' : '#14532d' };
    }
    case 'partial': return { background: '#f6ad55', color: '#fff' };
    case 'missed': return { background: '#fc8181', color: '#fff' };
    default: return { background: '#e2e8f0', color: '#718096' };
  }
};

/** Short text inside a day cell */
export const dayCellText = (c: Challenge, state: DayState, value: number): string => {
  if (c.challenge_type === 'daily_streak') return state === 'hit' ? '✓' : state === 'missed' ? '✗' : '';
  if (value > 0) return isHoursUnit(c.unit) ? fmtNumber(Math.round(value * 10) / 10) : fmtNumber(Math.round(value));
  return state === 'missed' ? '✗' : '';
};

/** The number an entry contributes for this challenge type */
export const entryValueOf = (c: Challenge, entry?: ChallengeEntry): number => {
  if (!entry) return 0;
  if (c.challenge_type === 'count_based') return entry.count_value || 0;
  if (c.challenge_type === 'accumulation') return entry.numeric_value || 0;
  return entry.is_completed ? 1 : 0;
};

export const errorMessage = (err: any, fallback: string): string => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
};

/** Everything a card / list row can ask the page to do */
export interface ChallengeActions {
  onOpen: (c: Challenge) => void;
  onEdit: (c: Challenge) => void;
  onRename: (c: Challenge, name: string) => Promise<void>;
  onQuickLog: (c: Challenge, payload: LogPayload) => Promise<void>;
  onLogDay: (c: Challenge, date: string) => void;
  onRepeat: (c: Challenge) => void;
  onReopen: (c: Challenge) => void;
  onGraduate: (c: Challenge) => void;
  onComplete: (c: Challenge) => void;
  onAbandon: (c: Challenge) => void;
  onDelete: (c: Challenge) => void;
}
