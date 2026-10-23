/**
 * Challenge widget (card view) - the at-a-glance version of a challenge:
 * progress ring, today's one-tap action, last two weeks, and a coaching nudge.
 */

import React from 'react';
import {
  Challenge,
  ChallengeActions,
  STATUS_META,
  TYPE_META,
  coachMessage,
  fmtDate,
  fmtAmount,
  fmtDuration,
  fmtNumber,
  fmtShortDate,
  isHoursUnit,
  isSynced,
  parseLocalDate,
  pillarStyle,
  progressLabel,
  todayLine,
  todayString,
  totalLine,
  unitOf,
} from './challengeUtils';
import { DayStrip, InlineName, ProgressRing, StatusBadge, TodayAction } from './ChallengeParts';

interface ChallengeCardProps {
  challenge: Challenge;
  actions: ChallengeActions;
}

/** "Day 5 of 30 · 25 days left", "Starts in 3 days", "Ended Nov 15" */
export const timelineText = (c: Challenge): string => {
  if (c.status === 'completed') return c.completion_date ? `Completed ${fmtShortDate(c.completion_date)}` : 'Completed';
  if (c.status === 'failed' || c.status === 'abandoned') return `Ran ${fmtShortDate(c.start_date)} → ${fmtShortDate(c.end_date)}`;
  if (!c.has_started) {
    const days = Math.round((parseLocalDate(c.start_date).getTime() - parseLocalDate(todayString()).getTime()) / 86400000);
    return `Starts in ${days} day${days === 1 ? '' : 's'}`;
  }
  const left = c.days_remaining === 0 ? 'last day!' : `${c.days_remaining} day${c.days_remaining === 1 ? '' : 's'} left`;
  return `Day ${c.days_elapsed} of ${c.days_total} · ${left}`;
};

export const paceText = (c: Challenge): string | null => {
  if (c.status !== 'active' || !c.has_started || c.challenge_type === 'daily_streak') return null;
  if (c.daily_target) {
    if (c.allowed_misses <= 0) return c.missed_days > 0 ? '⚡ Perfect run is over — keep showing up' : null;
    const left = c.allowed_misses - c.missed_days;
    return left >= 0
      ? `🛟 ${left} of ${c.allowed_misses} allowed misses left`
      : '⚡ Past the allowed misses — finish strong anyway';
  }
  const unit = isHoursUnit(c.unit) ? '' : unitOf(c);
  if (c.current >= (c.target || 0)) return null;
  if (c.unrealistic_pace) {
    return `⚠️ Needs ${fmtDuration(c.needed_per_day * (isHoursUnit(c.unit) ? 60 : 1))}/day — lower the target or extend the date`;
  }
  if (c.projected_percentage !== null && c.projected_percentage >= 100) {
    return `⚡ At this pace you'll finish (${Math.round(c.projected_percentage)}% projected)`;
  }
  const projected = c.projected_percentage !== null ? ` · on pace for ${Math.round(c.projected_percentage)}%` : '';
  const behind = c.days_behind >= 1 ? ` · ${Math.round(c.days_behind)} day${Math.round(c.days_behind) === 1 ? '' : 's'} behind` : '';
  return `⚡ Need ${fmtAmount(c, c.needed_per_day)} ${unit}/day${projected}${behind}`.replace(/\s+\//, '/');
};

export const ChallengeActionBar: React.FC<{
  challenge: Challenge;
  actions: ChallengeActions;
  hideDetails?: boolean;
}> = ({ challenge: c, actions, hideDetails }) => (
  <div className="ch-card-actions" onClick={(e) => e.stopPropagation()}>
    {c.status === 'active' && !isSynced(c) && c.has_started && (
      <button type="button" className="ch-btn ch-btn-soft" onClick={() => actions.onLogDay(c, todayString())}>📝 Log</button>
    )}
    {c.status === 'completed' && (
      <>
        <button type="button" className="ch-btn ch-btn-soft" onClick={() => actions.onRepeat(c)}>🔄 Repeat</button>
        {!c.graduated_habit_id && (
          <button type="button" className="ch-btn ch-btn-soft" onClick={() => actions.onGraduate(c)}>⬆️ Make it a habit</button>
        )}
      </>
    )}
    {(c.status === 'failed' || c.status === 'abandoned') && (
      <>
        <button type="button" className="ch-btn ch-btn-soft" onClick={() => actions.onRepeat(c)}>🔄 Try again</button>
        <button type="button" className="ch-btn ch-btn-soft" title="Continue from where you left off" onClick={() => actions.onReopen(c)}>♻️ Reopen</button>
      </>
    )}
    {!hideDetails && (
      <button type="button" className="ch-btn ch-btn-soft" onClick={() => actions.onOpen(c)}>🔍 Details</button>
    )}
    <button type="button" className="ch-btn ch-btn-soft" onClick={() => actions.onEdit(c)}>✏️ Edit</button>
    {c.status === 'active' && (
      <button type="button" className="ch-btn ch-btn-soft" title="Mark as finished" onClick={() => actions.onComplete(c)}>🏁 Finish</button>
    )}
    <button type="button" className="ch-btn ch-btn-danger" title="Delete challenge" onClick={() => actions.onDelete(c)}>🗑️</button>
  </div>
);

export const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge: c, actions }) => {
  const pillar = pillarStyle(c.pillar_name);
  const meta = STATUS_META[c.status_indicator] || STATUS_META.on_track;
  const todayText = todayLine(c);
  const pace = paceText(c);
  const closed = c.status !== 'active';
  const hasLinks = c.goal_name || c.project_name || c.linked_task_name;

  return (
    <div
      className={`ch-card ${closed ? 'is-closed' : ''}`}
      style={{ ['--accent' as any]: pillar.accent }}
      onClick={() => actions.onOpen(c)}
    >
      <div className="ch-card-header">
        <div className="ch-type-icon" title={TYPE_META[c.challenge_type].label}>{TYPE_META[c.challenge_type].icon}</div>
        <div className="ch-card-title">
          <InlineName value={c.name} onSave={(name) => actions.onRename(c, name)} />
          <div className="ch-card-sub">
            {c.pillar_name && (
              <span className="ch-pillar-tag" style={{ background: pillar.bg, color: pillar.text }}>
                {pillar.icon} {c.pillar_name}
              </span>
            )}
            {c.category_name && <span>{c.category_name}</span>}
            {c.difficulty && <span className={`ch-diff ch-diff-${c.difficulty}`}>{c.difficulty}</span>}
          </div>
        </div>
        <StatusBadge challenge={c} />
      </div>

      <div className="ch-card-main">
        <ProgressRing percent={c.progress_percentage} color={meta.bar} />
        <div className="ch-card-stats">
          <div className="ch-progress-label">{progressLabel(c)}</div>
          {totalLine(c) && <div className="ch-muted">📊 {totalLine(c)}</div>}
          <div className="ch-muted">📅 {timelineText(c)}</div>
          <div className="ch-muted">
            🔥 {c.current_streak}-day streak{c.longest_streak > c.current_streak ? ` (best ${c.longest_streak})` : ''}
            {c.challenge_type !== 'daily_streak' && !c.daily_target && ` · ✅ ${c.completed_days} active days`}
          </div>
          {pace && <div className="ch-pace">{pace}</div>}
        </div>
      </div>

      {c.status === 'active' && todayText && (
        <div className="ch-target">
          🎯 {c.daily_target ? "Today's minimum" : "Today's target"}: <strong>{todayText}</strong>
        </div>
      )}

      <TodayAction challenge={c} onQuickLog={actions.onQuickLog} />

      <DayStrip challenge={c} onDayClick={(date) => actions.onLogDay(c, date)} />

      <p className="ch-coach">{coachMessage(c)}</p>

      {c.why_reason && <div className="ch-why">💡 {c.why_reason}</div>}
      {c.reward && c.status !== 'abandoned' && <div className="ch-reward">🎁 Reward: {c.reward}</div>}

      {hasLinks && (
        <div className="ch-links">
          {c.goal_name && <span title="Linked goal">🎯 {c.goal_name}</span>}
          {c.project_name && <span title="Linked project">📁 {c.project_name}</span>}
          {c.linked_task_name && (
            <span title={isSynced(c) ? 'Synced from the Daily tab' : 'Linked task'}>
              {isSynced(c) ? '📡' : '📋'} {c.linked_task_name}
            </span>
          )}
        </div>
      )}

      <ChallengeActionBar challenge={c} actions={actions} />

      {c.status === 'active' && (
        <div className="ch-card-footnote">
          {fmtDate(c.start_date)} → {fmtDate(c.end_date)}
        </div>
      )}
    </div>
  );
};
