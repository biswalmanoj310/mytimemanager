/**
 * Challenge list view - sortable table in the same style as the Goals list view.
 * Click a row to expand the last two weeks, coaching nudge and actions.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import {
  Challenge,
  ChallengeActions,
  ChallengeEntry,
  STATUS_META,
  TYPE_META,
  coachMessage,
  isSynced,
  pillarStyle,
  progressLabel,
  totalLine,
} from './challengeUtils';
import { InlineName, MonthCalendar, StatusBadge, TodayAction } from './ChallengeParts';
import { ChallengeActionBar, timelineText } from './ChallengeCard';

type SortKey = 'name' | 'status' | 'progress' | 'streak' | 'left' | 'pillar' | 'category';

// Same pillar/category order as the Goals list
const HIERARCHY_ORDER: Record<string, number> = {
  'Hard Work|Office-Tasks': 1, 'Hard Work|Learning': 2, 'Hard Work|Confidence': 3,
  'Calmness|Yoga': 4, 'Calmness|Sleep': 5,
  'Family|My Tasks': 6, 'Family|Home Tasks': 7, 'Family|Time Waste': 8,
};

const STATUS_ORDER: Record<string, number> = {
  behind: 0, at_risk: 1, just_started: 2, on_track: 3, not_started: 4, completed: 5, failed: 6, abandoned: 7,
};

interface ChallengeListViewProps {
  challenges: Challenge[];
  actions: ChallengeActions;
  /** Bumped by the page after every change so open calendars re-fetch their entries */
  version: number;
}

/** Expanded row: habit-style month calendar, quick numbers, coaching and actions */
const ExpandedRow: React.FC<{ challenge: Challenge; actions: ChallengeActions; version: number }> = ({ challenge: c, actions, version }) => {
  const [entries, setEntries] = useState<ChallengeEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ChallengeEntry[]>(`/api/challenges/${c.id}/entries?start_date=${c.start_date}&end_date=${c.end_date}`)
      .then((data) => !cancelled && setEntries(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Error loading challenge entries:', err));
    return () => { cancelled = true; };
  }, [c.id, c.start_date, c.end_date, version]);

  return (
    <div className="ch-expanded" onClick={(e) => e.stopPropagation()}>
      <MonthCalendar challenge={c} entries={entries} onDayClick={(date) => actions.onLogDay(c, date)} />
      <div className="ch-expanded-info">
        <div className="ch-info-box">
          <span>Current: <b>{c.status === 'active' ? c.current_streak : '—'}</b></span>
          <span>Best: <b>{c.longest_streak}</b></span>
          <span>Days hit: <b>{c.completed_days}</b></span>
          <span>Overall: <b>{Math.round(c.progress_percentage)}%</b></span>
        </div>
        {totalLine(c) && <div className="ch-info-box is-total">📊 {totalLine(c)}</div>}
        {c.goal_name && <span className="ch-chip-link">🎯 {c.goal_name}</span>}
        {c.project_name && <span className="ch-chip-link">📁 {c.project_name}</span>}
        {c.linked_task_name && <span className="ch-chip-link">{isSynced(c) ? '📡' : '📋'} {c.linked_task_name}</span>}
      </div>
      <p className="ch-coach">{coachMessage(c)}</p>
      {c.why_reason && <div className="ch-why">💡 {c.why_reason}</div>}
      <ChallengeActionBar challenge={c} actions={actions} />
    </div>
  );
};

const COLUMNS: { label: string; sort?: SortKey; width?: string }[] = [
  { label: '#', width: '36px' },
  { label: 'Challenge', sort: 'name', width: '260px' },
  { label: 'Status', sort: 'status', width: '110px' },
  { label: 'Progress', sort: 'progress', width: '190px' },
  { label: 'Today', width: '230px' },
  { label: 'Streak', sort: 'streak', width: '80px' },
  { label: 'Timeline', sort: 'left', width: '150px' },
  { label: 'Pillar', sort: 'pillar', width: '120px' },
  { label: 'Category', sort: 'category', width: '110px' },
  { label: '', width: '84px' },
];

export const ChallengeListView: React.FC<ChallengeListViewProps> = ({ challenges, actions, version }) => {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expanded, setExpanded] = useState<number | null>(null);

  const rows = useMemo(() => {
    const byHierarchy = (c: Challenge) => HIERARCHY_ORDER[`${c.pillar_name || ''}|${c.category_name || ''}`] ?? 999;
    const compare = (a: Challenge, b: Challenge): number => {
      switch (sortKey) {
        case 'name': return a.name.localeCompare(b.name);
        case 'status': return (STATUS_ORDER[a.status_indicator] ?? 9) - (STATUS_ORDER[b.status_indicator] ?? 9);
        case 'progress': return a.progress_percentage - b.progress_percentage;
        case 'streak': return a.current_streak - b.current_streak;
        case 'left': return a.days_remaining - b.days_remaining;
        case 'pillar': return (a.pillar_name || '').localeCompare(b.pillar_name || '');
        case 'category': return (a.category_name || '').localeCompare(b.category_name || '');
        default:
          return byHierarchy(a) - byHierarchy(b) || a.name.localeCompare(b.name);
      }
    };
    const sorted = [...challenges].sort(compare);
    return sortKey && sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [challenges, sortKey, sortDir]);

  const toggleSort = (key?: SortKey) => {
    if (!key) return;
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="ch-list-wrap">
      <table className="ch-list">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.label}
                style={{ width: col.width, cursor: col.sort ? 'pointer' : 'default' }}
                onClick={() => toggleSort(col.sort)}
              >
                {col.label}
                {col.sort && sortKey === col.sort && (sortDir === 'asc' ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, idx) => {
            const pillar = pillarStyle(c.pillar_name);
            const bar = (STATUS_META[c.status_indicator] || STATUS_META.on_track).bar;
            const isOpenRow = expanded === c.id;
            return (
              <React.Fragment key={c.id}>
                <tr
                  className={`ch-row ch-row-${c.status_indicator} ${c.completed_today ? 'is-done-today' : ''} ${isOpenRow ? 'is-expanded' : ''}`}
                  onClick={() => setExpanded(isOpenRow ? null : c.id)}
                >
                  <td className="ch-cell-index">
                    <span className={`ch-caret ${isOpenRow ? 'is-open' : ''}`}>▶</span>
                    {idx + 1}
                  </td>
                  <td>
                    <div className="ch-list-name">
                      <span title={TYPE_META[c.challenge_type].label}>{TYPE_META[c.challenge_type].icon}</span>
                      <InlineName value={c.name} onSave={(name) => actions.onRename(c, name)} />
                      {isSynced(c) && <span title={`Synced from Daily tab: ${c.linked_task_name}`}>📡</span>}
                    </div>
                  </td>
                  <td><StatusBadge challenge={c} /></td>
                  <td>
                    <div className="ch-list-progress">
                      <div className="ch-bar"><div style={{ width: `${c.progress_percentage}%`, background: bar }} /></div>
                      <strong>{Math.round(c.progress_percentage)}%</strong>
                    </div>
                    <div className="ch-list-sub">{progressLabel(c)}</div>
                  </td>
                  <td>
                    {c.status === 'active' ? <TodayAction challenge={c} onQuickLog={actions.onQuickLog} compact /> : <span className="ch-muted">—</span>}
                  </td>
                  <td className="ch-center">🔥 {c.current_streak}</td>
                  <td className={c.status === 'active' && c.days_remaining <= 3 ? 'ch-urgent' : ''}>{timelineText(c)}</td>
                  <td>
                    {c.pillar_name
                      ? <span className="ch-pillar-tag" style={{ background: pillar.bg, color: pillar.text }}>{pillar.icon} {c.pillar_name}</span>
                      : '—'}
                  </td>
                  <td>{c.category_name || '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="ch-row-actions">
                      <button type="button" className="ch-btn ch-btn-soft" title="Details" onClick={() => actions.onOpen(c)}>🔍</button>
                      <button type="button" className="ch-btn ch-btn-soft" title="Edit" onClick={() => actions.onEdit(c)}>✏️</button>
                    </div>
                  </td>
                </tr>
                {isOpenRow && (
                  <tr className="ch-row-expanded">
                    <td colSpan={COLUMNS.length}>
                      <ExpandedRow challenge={c} actions={actions} version={version} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
