/**
 * Small building blocks shared by the Challenges widget view, list view and detail modal
 */

import React, { useState } from 'react';
import {
  Challenge,
  ChallengeEntry,
  LogPayload,
  STATUS_META,
  addDaysToString,
  dayCellStyle,
  dayCellText,
  dayState,
  entryValueOf,
  fmtAmount,
  fmtNumber,
  fmtShortDate,
  isHoursUnit,
  isSynced,
  parseLocalDate,
  todayString,
  unitOf,
} from './challengeUtils';

/* ───────────────────────── Inline rename ───────────────────────── */

interface InlineNameProps {
  value: string;
  onSave: (name: string) => Promise<void> | void;
  className?: string;
}

/** Click the pencil (or double-click the text) to rename in place; Enter saves, Esc cancels */
export const InlineName: React.FC<InlineNameProps> = ({ value, onSave, className }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const start = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
  };

  const commit = async () => {
    const next = draft.trim();
    if (saving) return;
    if (!next || next === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        className="ch-name-input"
        autoFocus
        onFocus={(e) => e.target.select()}
        value={draft}
        maxLength={255}
        disabled={saving}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className={`ch-name ${className || ''}`}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={start}
      title="Double-click to rename"
    >
      <span className="ch-name-text">{value}</span>
      <button type="button" className="ch-rename-btn" onClick={start} title="Rename" aria-label="Rename challenge">
        ✏️
      </button>
    </span>
  );
};

/* ───────────────────────── Progress ring ───────────────────────── */

interface ProgressRingProps {
  percent: number;
  color: string;
  size?: number;
  stroke?: number;
  label?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({ percent, color, size = 84, stroke = 9, label }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="ch-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${Math.round(clamped)}% complete`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="ch-ring-label">
        <strong>{Math.round(clamped)}%</strong>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
};

/* ───────────────────────── Day cells ───────────────────────── */

const dayTitle = (c: Challenge, date: string, value: number): string => {
  const state = dayState(c, value, date);
  const unit = isHoursUnit(c.unit) ? '' : ` ${unitOf(c)}`;
  let what: string;
  if (c.challenge_type === 'daily_streak') what = state === 'hit' ? 'done ✓' : state === 'missed' ? 'missed ✗' : 'not done';
  else if (state === 'future') what = '';
  else {
    what = `${fmtAmount(c, value)}${unit}`;
    if (c.daily_target) {
      const note = state === 'hit' ? ' ✓' : state === 'partial' ? ` (min ${fmtAmount(c, c.daily_target)})` : '';
      what += note;
    }
  }
  return `${fmtShortDate(date)}${what ? ': ' + what : ''}`;
};

interface DayStripProps {
  challenge: Challenge;
  onDayClick?: (date: string) => void;
}

/** Last two weeks at a glance - one small square per day */
export const DayStrip: React.FC<DayStripProps> = ({ challenge, onDayClick }) => {
  const today = todayString();
  if (challenge.recent_days.length === 0) return null;
  return (
    <div className="ch-strip" aria-label="Recent days">
      {challenge.recent_days.map((day) => {
        const state = dayState(challenge, day.value, day.date);
        return (
          <button
            key={day.date}
            type="button"
            className={`ch-strip-cell ${day.date === today ? 'is-today' : ''}`}
            style={dayCellStyle(challenge, state, day.value)}
            title={dayTitle(challenge, day.date, day.value)}
            onClick={(e) => {
              e.stopPropagation();
              onDayClick?.(day.date);
            }}
          >
            {dayCellText(challenge, state, day.value)}
          </button>
        );
      })}
    </div>
  );
};

interface PeriodGridProps {
  challenge: Challenge;
  entries: ChallengeEntry[];
  onDayClick: (date: string) => void;
}

/** Every day of the challenge in calendar weeks - small squares, date and value tucked inside */
export const PeriodGrid: React.FC<PeriodGridProps> = ({ challenge, entries, onDayClick }) => {
  const today = todayString();
  const byDate = new Map(entries.map((e) => [e.entry_date, e]));
  const days: string[] = [];
  for (let i = 0; i < challenge.days_total; i++) days.push(addDaysToString(challenge.start_date, i));
  const leading = parseLocalDate(challenge.start_date).getDay();

  return (
    <div className="ch-period">
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
        <div key={i} className="ch-period-head">{d}</div>
      ))}
      {Array.from({ length: leading }).map((_, i) => <div key={`pad-${i}`} />)}
      {days.map((date) => {
        const entry = byDate.get(date);
        const value = entryValueOf(challenge, entry);
        const state = dayState(challenge, value, date);
        return (
          <button
            key={date}
            type="button"
            disabled={state === 'future'}
            className={`ch-period-cell ${date === today ? 'is-today' : ''} ${state === 'future' ? 'is-future' : ''} ${entry?.note ? 'has-note' : ''}`}
            style={state === 'future' ? undefined : dayCellStyle(challenge, state, value)}
            title={dayTitle(challenge, date, value)}
            onClick={() => onDayClick(date)}
          >
            <span className="ch-period-date">{parseLocalDate(date).getDate()}</span>
            <span className="ch-period-value">{dayCellText(challenge, state, value)}</span>
          </button>
        );
      })}
    </div>
  );
};

interface MonthCalendarProps {
  challenge: Challenge;
  entries: ChallengeEntry[];
  onDayClick: (date: string) => void;
}

/**
 * Habit-page style calendar: month navigation and one row of day squares
 * (date above, ✓ / ✗ / amount inside). Used in the list view's expanded row.
 */
export const MonthCalendar: React.FC<MonthCalendarProps> = ({ challenge, entries, onDayClick }) => {
  const start = parseLocalDate(challenge.start_date);
  const end = parseLocalDate(challenge.end_date);
  const today = parseLocalDate(todayString());
  const firstMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  // Open on the month that matters: this month while running, the last month once finished
  const anchor = today < start ? start : today > end ? end : today;
  const [month, setMonth] = useState(new Date(anchor.getFullYear(), anchor.getMonth(), 1));

  const canGoBack = month > firstMonth;
  const canGoForward = month < lastMonth;
  const shift = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  const byDate = new Map(entries.map((e) => [e.entry_date, e]));
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let dn = 1; dn <= daysInMonth; dn++) {
    const date = new Date(month.getFullYear(), month.getMonth(), dn);
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(dn).padStart(2, '0')}`;
    const outside = date < start || date > end;
    const isStart = date.getTime() === start.getTime();
    const isEnd = date.getTime() === end.getTime();
    const isToday = date.getTime() === today.getTime();
    const value = entryValueOf(challenge, byDate.get(key));
    const state = outside ? 'future' : dayState(challenge, value, key);
    const style = outside ? { background: '#f1f5f9', color: '#cbd5e1' } : dayCellStyle(challenge, state, value);
    cells.push(
      <div key={key} className="ch-month-day" title={outside ? '' : dayTitle(challenge, key, value)}>
        <div className={`ch-month-num ${isToday ? 'is-today' : ''}`}>
          {isEnd ? '🏁' : isStart ? 'Start' : dn}
        </div>
        <button
          type="button"
          disabled={outside || state === 'future'}
          className={`ch-month-cell ${isToday ? 'is-today' : ''}`}
          style={style}
          onClick={(e) => {
            e.stopPropagation();
            onDayClick(key);
          }}
        >
          {outside ? '' : dayCellText(challenge, state, value)}
        </button>
      </div>
    );
  }

  return (
    <div className="ch-month" onClick={(e) => e.stopPropagation()}>
      <div className="ch-month-nav">
        <button type="button" className="ch-nav-btn" disabled={!canGoBack} onClick={() => shift(-1)}>← Previous</button>
        <span className="ch-nav-label">{month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span>
        <button type="button" className="ch-nav-btn" disabled={!canGoForward} onClick={() => shift(1)}>Next →</button>
      </div>
      <div className="ch-month-days">{cells}</div>
    </div>
  );
};

/* ───────────────────────── Badges ───────────────────────── */

export const StatusBadge: React.FC<{ challenge: Challenge }> = ({ challenge }) => {
  const meta = STATUS_META[challenge.status_indicator] || STATUS_META.on_track;
  return (
    <span className="ch-badge" style={{ background: meta.bg, color: meta.text }}>
      {meta.emoji} {meta.label}
    </span>
  );
};

/* ───────────────────────── Today's one-tap action ───────────────────────── */

interface TodayActionProps {
  challenge: Challenge;
  onQuickLog: (c: Challenge, payload: LogPayload) => Promise<void>;
  /** Single tight line for table rows */
  compact?: boolean;
}

/**
 * The lowest-friction way to log today (BJ Fogg: make the behaviour tiny):
 * a tick for streaks, +1 for counts, an amount box for totals.
 * Synced challenges are read-only - the Daily tab is the source of truth.
 */
export const TodayAction: React.FC<TodayActionProps> = ({ challenge: c, onQuickLog, compact }) => {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  if (c.status !== 'active' || !c.has_started) return null;

  const today = todayString();
  const current = c.today_value || 0;
  const unit = isHoursUnit(c.unit) ? '' : unitOf(c);
  const counting = c.challenge_type === 'count_based';

  const run = async (payload: LogPayload) => {
    setBusy(true);
    try {
      await onQuickLog(c, payload);
      setAmount('');
    } finally {
      setBusy(false);
    }
  };

  // Count challenges store whole numbers, amounts (minutes, km...) can be fractional
  const valueFor = (total: number): LogPayload => ({
    entry_date: today,
    is_completed: total > 0,
    ...(counting ? { count_value: Math.round(total) } : { numeric_value: total }),
  });

  const goalText = c.daily_target ? ` / ${fmtAmount(c, c.daily_target)}` : '';

  if (isSynced(c)) {
    return (
      <div className="ch-today ch-today-synced" onClick={(e) => e.stopPropagation()}>
        <span>
          📡 {c.challenge_type === 'daily_streak'
            ? (c.completed_today ? 'Done today' : 'Not logged today')
            : `${fmtAmount(c, current)}${goalText} ${unit} today`.trim()}
        </span>
        <small>from Daily tab ({c.linked_task_name})</small>
      </div>
    );
  }

  if (c.challenge_type === 'daily_streak') {
    return (
      <div className="ch-today" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          disabled={busy}
          className={`ch-btn ${c.completed_today ? 'ch-btn-done' : 'ch-btn-primary'}`}
          onClick={() => run({ entry_date: today, is_completed: !c.completed_today })}
        >
          {c.completed_today ? '✅ Done today — undo' : '✓ Mark done today'}
        </button>
      </div>
    );
  }

  const parsed = parseFloat(amount);
  const canAdd = !Number.isNaN(parsed) && parsed > 0;
  const add = () => canAdd && run(valueFor(current + parsed));
  const hitMinimum = !!c.daily_target && current < c.daily_target;

  return (
    <div className={`ch-today ${compact ? 'is-compact' : ''}`} onClick={(e) => e.stopPropagation()}>
      <span className="ch-today-value">
        {compact ? '' : 'Today: '}<strong>{fmtAmount(c, current)}</strong>{goalText} {unit}
      </span>
      {hitMinimum && (
        <button type="button" disabled={busy} className="ch-btn ch-btn-primary" onClick={() => run(valueFor(c.daily_target!))}>
          ✓ Hit {fmtAmount(c, c.daily_target)}
        </button>
      )}
      {counting && !c.daily_target && (
        <>
          <button type="button" disabled={busy} className="ch-btn ch-btn-primary" onClick={() => run(valueFor(current + 1))}>+1</button>
          {current > 0 && (
            <button type="button" disabled={busy} className="ch-btn ch-btn-ghost" title="Remove one" onClick={() => run(valueFor(current - 1))}>−1</button>
          )}
        </>
      )}
      <input
        type="number"
        min="0"
        step="any"
        className="ch-today-input"
        placeholder={`+ ${isHoursUnit(c.unit) ? 'hours' : unit || 'amount'}`}
        value={amount}
        disabled={busy}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      <button type="button" disabled={busy || !canAdd} className={`ch-btn ${canAdd ? 'ch-btn-primary' : 'ch-btn-ghost'}`} onClick={add}>
        Add
      </button>
    </div>
  );
};
