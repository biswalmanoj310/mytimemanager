/**
 * Challenge detail modal - the full story of one challenge:
 * every day of the period, stats, pace, journal notes and all actions.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import {
  Challenge,
  ChallengeActions,
  ChallengeEntry,
  MOODS,
  STATUS_META,
  TYPE_META,
  coachMessage,
  fmtAmount,
  fmtDate,
  fmtNumber,
  isHoursUnit,
  fmtShortDate,
  isSynced,
  pillarStyle,
  progressLabel,
  totalLine,
  unitOf,
} from './challengeUtils';
import { InlineName, PeriodGrid, ProgressRing, StatusBadge } from './ChallengeParts';
import { ChallengeActionBar, paceText, timelineText } from './ChallengeCard';

interface ChallengeDetailModalProps {
  challenge: Challenge;
  actions: ChallengeActions;
  onClose: () => void;
  /** Bumped by the page after every change so entries are re-fetched */
  version: number;
}

export const ChallengeDetailModal: React.FC<ChallengeDetailModalProps> = ({ challenge: c, actions, onClose, version }) => {
  const [entries, setEntries] = useState<ChallengeEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ChallengeEntry[]>(`/api/challenges/${c.id}/entries?start_date=${c.start_date}&end_date=${c.end_date}`)
      .then((data) => !cancelled && setEntries(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Error loading challenge entries:', err));
    return () => { cancelled = true; };
  }, [c.id, c.start_date, c.end_date, version]);

  const pillar = pillarStyle(c.pillar_name);
  const meta = STATUS_META[c.status_indicator] || STATUS_META.on_track;
  const unit = unitOf(c);
  const counting = c.challenge_type !== 'daily_streak';
  const pace = paceText(c);
  const journal = entries
    .filter((e) => e.note || e.mood)
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date));

  const tiles: { label: string; value: string; sub?: string }[] = [
    { label: 'Day', value: `${c.days_elapsed}/${c.days_total}`, sub: c.status === 'active' ? `${c.days_remaining} left` : undefined },
    c.daily_target
      ? { label: 'Days hit', value: `${c.completed_days}/${c.days_required}`, sub: c.allowed_misses > 0 ? `${c.allowed_misses} misses allowed` : 'every day' }
      : { label: 'Active days', value: String(c.completed_days), sub: `${Math.round(c.success_rate)}%` },
    { label: 'Streak', value: `🔥 ${c.current_streak}`, sub: `best ${c.longest_streak}` },
    counting
      ? { label: 'Daily avg', value: fmtAmount(c, c.daily_average), sub: isHoursUnit(c.unit) ? undefined : unit }
      : { label: 'Target', value: `${c.target_days ?? c.days_total} days`, sub: `${Math.round(c.expected_percentage)}% of time used` },
  ];
  if (c.daily_target) {
    tiles.push({ label: 'Minimum', value: fmtAmount(c, c.daily_target), sub: isHoursUnit(c.unit) ? 'per day' : `${unit}/day` });
  } else if (counting && c.status === 'active' && c.projected_percentage !== null) {
    tiles.push({ label: 'On pace for', value: `${Math.round(c.projected_percentage)}%`, sub: 'of target' });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-wide ch-detail" onClick={(e) => e.stopPropagation()}>
        <div className="ch-modal-header">
          <div className="ch-detail-title">
            <span className="ch-type-icon">{TYPE_META[c.challenge_type].icon}</span>
            <div>
              <InlineName value={c.name} onSave={(name) => actions.onRename(c, name)} />
              <div className="ch-card-sub">
                {c.pillar_name && (
                  <span className="ch-pillar-tag" style={{ background: pillar.bg, color: pillar.text }}>
                    {pillar.icon} {c.pillar_name}
                  </span>
                )}
                {c.category_name && <span>{c.category_name}</span>}
                <span>{TYPE_META[c.challenge_type].label}</span>
                {c.difficulty && <span className={`ch-diff ch-diff-${c.difficulty}`}>{c.difficulty}</span>}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="ch-detail-top">
            <ProgressRing percent={c.progress_percentage} color={meta.bar} size={76} stroke={8} />
            <div className="ch-detail-summary">
              <div className="ch-progress-label" style={{ fontSize: '1.1rem' }}>{progressLabel(c)}</div>
              {totalLine(c) && <div className="ch-muted">📊 {totalLine(c)}</div>}
              <div className="ch-muted">📅 {timelineText(c)} · {fmtDate(c.start_date)} → {fmtDate(c.end_date)}</div>
              <div style={{ marginTop: 2 }}><StatusBadge challenge={c} /></div>
              {pace && <div className="ch-pace">{pace}</div>}
            </div>
          </div>

          <p className="ch-coach">{coachMessage(c)}</p>

          <div className="ch-tiles">
            {tiles.map((t) => (
              <div key={t.label} className="ch-tile">
                <div className="ch-tile-label">{t.label}</div>
                <div className="ch-tile-value">{t.value}</div>
                {t.sub && <div className="ch-tile-sub">{t.sub}</div>}
              </div>
            ))}
          </div>

          {(c.description || c.why_reason || c.reward) && (
            <div className="ch-detail-notes">
              {c.description && <p>{c.description}</p>}
              {c.why_reason && <div className="ch-why">💡 Why: {c.why_reason}</div>}
              {c.reward && <div className="ch-reward">🎁 Reward: {c.reward}</div>}
            </div>
          )}

          {(c.goal_name || c.project_name || c.linked_task_name) && (
            <div className="ch-links">
              {c.goal_name && <span>🎯 Goal: {c.goal_name}</span>}
              {c.project_name && <span>📁 Project: {c.project_name}</span>}
              {c.linked_task_name && (
                <span>{isSynced(c) ? '📡 Synced from Daily tab:' : '📋 Task:'} {c.linked_task_name}</span>
              )}
            </div>
          )}

          <h3 className="ch-h3">📅 Every day</h3>
          <PeriodGrid challenge={c} entries={entries} onDayClick={(date) => actions.onLogDay(c, date)} />
          <div className="ch-legend">
            <span><i style={{ background: '#48bb78' }} /> {c.daily_target ? 'minimum reached' : 'done'}</span>
            {c.daily_target && <span><i style={{ background: '#f6ad55' }} /> partial</span>}
            <span><i style={{ background: '#fc8181' }} /> missed</span>
            <span><i style={{ background: '#e2e8f0' }} /> not yet</span>
            <span><i className="is-today" /> today</span>
          </div>

          <h3 className="ch-h3">📝 Journal ({journal.length})</h3>
          {journal.length === 0 ? (
            <p className="ch-muted">
              No notes yet. Click a day above and jot down what helped or got in the way — reflection is what turns experiments into learning.
            </p>
          ) : (
            <div className="entries-list">
              {journal.map((e) => (
                <div key={`${e.id}-${e.entry_date}`} className="entry-item">
                  <div className="entry-date">{fmtShortDate(e.entry_date)}</div>
                  <div className="entry-data">{e.note || <span className="ch-muted">—</span>}</div>
                  <div className="entry-mood">{MOODS.find((m) => m.value === e.mood)?.emoji}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer ch-detail-footer">
          <ChallengeActionBar challenge={c} actions={actions} hideDetails />
          {c.status === 'active' && (
            <button type="button" className="ch-btn ch-btn-soft" onClick={() => actions.onAbandon(c)}>💤 Abandon</button>
          )}
          <button className="btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
