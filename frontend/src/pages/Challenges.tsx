/**
 * Challenges Page
 * Time-bound personal experiments (7-90 days) that build new behaviours.
 *
 * Mirrors the Goals page: hero with status chips, pillar summary strip,
 * collapsible sections, and a widget (card) view / list view toggle.
 * Challenges linked to a Daily-tab task mirror that task automatically.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { AddChallengeModal } from '../components/AddChallengeModal';
import { ChallengeCard } from '../components/challenges/ChallengeCard';
import { ChallengeListView } from '../components/challenges/ChallengeListView';
import { ChallengeLogModal } from '../components/challenges/ChallengeLogModal';
import { ChallengeDetailModal } from '../components/challenges/ChallengeDetailModal';
import {
  Challenge,
  ChallengeActions,
  LogPayload,
  PILLAR_STYLES,
  errorMessage,
  isSynced,
  needsActionToday,
  pillarStyle,
} from '../components/challenges/challengeUtils';
import './Challenges.css';

type Filter = 'all' | 'on_track' | 'just_started' | 'at_risk' | 'behind' | 'today' | 'synced' | 'completed' | 'ended';

const QUOTES = [
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
  { text: "Make it so easy you can't say no.", author: 'BJ Fogg' },
  { text: 'Never miss twice. Missing once is an accident; missing twice is the start of a new habit.', author: 'James Clear' },
  { text: 'All big things come from small beginnings. The seed of every habit is a single, tiny decision.', author: 'James Clear' },
];

const celebrate = () => {
  confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
  setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 } }), 250);
  setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 } }), 400);
};

export default function Challenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);

  const [listView, setListView] = useState(() => localStorage.getItem('listView_challenges') === 'true');
  const [filter, setFilter] = useState<Filter>('all');
  const [pillarFilter, setPillarFilter] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState({ completed: false, ended: true });
  const [quoteIndex, setQuoteIndex] = useState(0);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const [logTarget, setLogTarget] = useState<{ challenge: Challenge; date: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Challenge | null>(null);

  const previousStatus = useRef<Map<number, string>>(new Map());

  const notify = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ text, kind });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  // The list endpoint recalculates active challenges from the Daily tab before answering
  const load = useCallback(async () => {
    try {
      const data = await api.get<Challenge[]>('/api/challenges/');
      const list = Array.isArray(data) ? data : [];
      const justCompleted = list.filter(
        (c) => c.status === 'completed' && previousStatus.current.get(c.id) === 'active'
      );
      previousStatus.current = new Map(list.map((c) => [c.id, c.status]));
      setChallenges(list);
      setError(null);
      setVersion((v) => v + 1);
      if (justCompleted.length > 0) {
        celebrate();
        notify(`🏆 Challenge completed: ${justCompleted[0].name}!`);
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to load challenges'));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setQuoteIndex((i) => (i + 1) % QUOTES.length), 9000);
    return () => clearInterval(timer);
  }, []);

  /* ───────────── actions ───────────── */

  // Runs an API call, refreshes the list and reports the outcome via toast; never throws
  const run = useCallback(
    async (work: () => Promise<unknown>, success?: string): Promise<boolean> => {
      try {
        await work();
        await load();
        if (success) notify(success);
        return true;
      } catch (err) {
        notify(errorMessage(err, 'Something went wrong'), 'error');
        return false;
      }
    },
    [load, notify]
  );

  const actions: ChallengeActions = useMemo(
    () => ({
      onOpen: (c) => setSelectedId(c.id),
      onEdit: (c) => {
        setEditing(c);
        setShowForm(true);
      },
      onRename: async (c, name) => { await run(() => api.put(`/api/challenges/${c.id}`, { name }), 'Renamed'); },
      onQuickLog: async (c, payload: LogPayload) => { await run(() => api.post(`/api/challenges/${c.id}/log`, payload)); },
      onLogDay: (c, date) => setLogTarget({ challenge: c, date }),
      onRepeat: (c) => {
        if (!window.confirm(`Start a fresh run of "${c.name}" from today? Progress starts at zero.`)) return;
        run(() => api.post(`/api/challenges/${c.id}/repeat`), 'New run started — find it under Active');
      },
      onReopen: (c) => {
        if (!window.confirm(`Reopen "${c.name}"? It continues with your existing progress; the end date moves to today if it already passed.`)) return;
        run(() => api.post(`/api/challenges/${c.id}/reopen`), 'Challenge reopened');
      },
      onGraduate: (c) => {
        if (!window.confirm(`Turn "${c.name}" into a permanent daily habit?`)) return;
        run(() => api.post(`/api/challenges/${c.id}/graduate`, {}), '⬆️ Added to your Habits');
      },
      onComplete: (c) => {
        if (!window.confirm(`Mark "${c.name}" as finished?`)) return;
        run(() => api.post(`/api/challenges/${c.id}/complete`)).then((ok) => ok && celebrate());
      },
      onAbandon: (c) => {
        if (!window.confirm(`Abandon "${c.name}"? It stays in your history as a learning.`)) return;
        run(() => api.post(`/api/challenges/${c.id}/abandon`), 'Moved to Learnings');
      },
      onDelete: (c) => {
        if (!window.confirm(`Delete "${c.name}" and all its entries? This cannot be undone.`)) return;
        setSelectedId((id) => (id === c.id ? null : id));
        run(() => api.delete(`/api/challenges/${c.id}`), 'Challenge deleted');
      },
    }),
    [run]
  );

  const saveLog = async (payload: LogPayload) => {
    if (!logTarget) return;
    const ok = await run(() => api.post(`/api/challenges/${logTarget.challenge.id}/log`, payload), 'Saved');
    if (!ok) throw new Error('Failed to save');
  };

  /* ───────────── derived data ───────────── */

  const counts = useMemo(() => {
    const active = challenges.filter((c) => c.status === 'active');
    const countBy = (indicator: string) => active.filter((c) => c.status_indicator === indicator).length;
    return {
      total: challenges.length,
      active: active.length,
      onTrack: countBy('on_track'),
      justStarted: countBy('just_started'),
      atRisk: countBy('at_risk'),
      behind: countBy('behind'),
      today: active.filter(needsActionToday).length,
      synced: challenges.filter(isSynced).length,
      completed: challenges.filter((c) => c.status === 'completed').length,
      ended: challenges.filter((c) => c.status === 'failed' || c.status === 'abandoned').length,
    };
  }, [challenges]);

  const matches = useCallback(
    (c: Challenge): boolean => {
      if (pillarFilter && (c.pillar_name || 'Other') !== pillarFilter) return false;
      switch (filter) {
        case 'on_track':
        case 'just_started':
        case 'at_risk':
        case 'behind':
          return c.status === 'active' && c.status_indicator === filter;
        case 'today': return needsActionToday(c);
        case 'synced': return isSynced(c);
        case 'completed': return c.status === 'completed';
        case 'ended': return c.status === 'failed' || c.status === 'abandoned';
        default: return true;
      }
    },
    [filter, pillarFilter]
  );

  const active = challenges.filter((c) => c.status === 'active' && matches(c));
  const completed = challenges.filter((c) => c.status === 'completed' && matches(c));
  const ended = challenges.filter((c) => (c.status === 'failed' || c.status === 'abandoned') && matches(c));

  const pillarTiles = useMemo(() => {
    const names = [...Object.keys(PILLAR_STYLES)];
    if (challenges.some((c) => !c.pillar_name || !PILLAR_STYLES[c.pillar_name])) names.push('Other');
    return names.map((name) => {
      const mine = challenges.filter((c) => (PILLAR_STYLES[c.pillar_name || ''] ? c.pillar_name : 'Other') === name);
      const open = mine.filter((c) => c.status === 'active');
      const avg = open.length ? Math.round(open.reduce((s, c) => s + c.progress_percentage, 0) / open.length) : null;
      return { name, style: pillarStyle(name), active: open.length, total: mine.length, avg };
    });
  }, [challenges]);

  const activeByPillar = useMemo(() => {
    const order = [...Object.keys(PILLAR_STYLES), 'Other'];
    const groups = new Map<string, Challenge[]>();
    active.forEach((c) => {
      const key = PILLAR_STYLES[c.pillar_name || ''] ? (c.pillar_name as string) : 'Other';
      groups.set(key, [...(groups.get(key) || []), c]);
    });
    return order.filter((k) => groups.has(k)).map((k) => ({ name: k, items: groups.get(k)! }));
  }, [active]);

  const selected = selectedId !== null ? challenges.find((c) => c.id === selectedId) || null : null;

  /* ───────────── render helpers ───────────── */

  const renderItems = (items: Challenge[]) =>
    listView ? (
      <ChallengeListView challenges={items} actions={actions} version={version} />
    ) : (
      <div className="ch-grid">
        {items.map((c) => <ChallengeCard key={c.id} challenge={c} actions={actions} />)}
      </div>
    );

  const chip = (key: Filter, label: string, count?: number, tone = '') => (
    <button
      key={key}
      type="button"
      className={`ch-chip ${tone} ${filter === key ? 'is-active' : ''}`}
      onClick={() => setFilter(filter === key && key !== 'all' ? 'all' : key)}
    >
      {label}{count !== undefined ? `: ${count}` : ''}
    </button>
  );

  if (loading) return <div className="challenges-container"><p>Loading challenges…</p></div>;
  if (error) {
    return (
      <div className="challenges-container">
        <p className="ch-error">{error}</p>
        <button className="btn-primary" onClick={load}>Retry</button>
      </div>
    );
  }

  const nothingToShow = active.length + completed.length + ended.length === 0;

  return (
    <div className="challenges-container">
      {toast && <div className={`ch-toast ${toast.kind === 'error' ? 'is-error' : ''}`}>{toast.text}</div>}

      {/* Hero */}
      <div className="ch-hero">
        <div className="ch-hero-main">
          <div className="ch-hero-title">
            <h1>🎯 Challenges</h1>
            {chip('all', `Total`, counts.total, 'is-total')}
            {chip('on_track', 'On Track', counts.onTrack)}
            {counts.justStarted > 0 && chip('just_started', '🌱 Just Started', counts.justStarted)}
            {chip('at_risk', 'At Risk', counts.atRisk)}
            {chip('behind', 'Behind', counts.behind)}
            {chip('completed', 'Completed', counts.completed)}
            {chip('ended', 'Ended', counts.ended)}
          </div>
          <div className="ch-hero-filters">
            <span>Quick view:</span>
            {chip('today', `⚡ Needs action today (${counts.today})`)}
            {chip('synced', `📡 Synced from Daily tab (${counts.synced})`)}
          </div>
          <div className="ch-hero-focus">
            {counts.active === 0
              ? 'Start a small experiment — 7 days is enough to learn something about yourself.'
              : counts.today === 0
                ? '🎉 Every active challenge has its win for today. Well done!'
                : `🔥 ${counts.today} challenge${counts.today === 1 ? '' : 's'} waiting for today's win — small actions count.`}
          </div>
          <div className="ch-hero-quote">"{QUOTES[quoteIndex].text}" — {QUOTES[quoteIndex].author}</div>
        </div>
        <div className="ch-hero-buttons">
          <button type="button" className="ch-hero-btn ch-hero-add" onClick={() => { setEditing(null); setShowForm(true); }}>
            ➕ Add Challenge
          </button>
          <button
            type="button"
            className={`ch-hero-btn ch-hero-toggle ${listView ? 'is-active' : ''}`}
            onClick={() => setListView((prev) => {
              const next = !prev;
              localStorage.setItem('listView_challenges', String(next));
              return next;
            })}
          >
            📋 {listView ? 'Card View' : 'List View'}
          </button>
        </div>
      </div>

      {/* Pillar strip */}
      <div className="ch-pillars">
        {pillarTiles.map((p) => (
          <button
            key={p.name}
            type="button"
            className={`ch-pillar-tile ${pillarFilter === p.name ? 'is-active' : ''}`}
            onClick={() => setPillarFilter(pillarFilter === p.name ? null : p.name)}
            style={{ ['--accent' as any]: p.style.accent }}
          >
            <span className="ch-pillar-icon">{p.style.icon}</span>
            <span>
              <strong>{p.name}</strong>
              <small>
                {p.active} active{p.avg !== null ? ` · ${p.avg}% avg` : ''}
              </small>
            </span>
          </button>
        ))}
        <div className="ch-pillar-tile ch-pillar-total">
          <span className="ch-pillar-icon">🎯</span>
          <span><strong>Total Challenges</strong><small>{counts.total} · {counts.active} active</small></span>
        </div>
      </div>

      {nothingToShow && (
        <div className="empty-state ch-empty">
          <h3>🎯 {counts.total === 0 ? 'No challenges yet' : 'Nothing matches this view'}</h3>
          <p>
            {counts.total === 0
              ? 'Challenges are low-pressure experiments: "Let me try this for 7 days." Finish one and it can graduate into a habit.'
              : 'Try another filter, or clear the filters to see everything.'}
          </p>
          {counts.total === 0
            ? <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>Create Your First Challenge</button>
            : <button className="btn-primary" onClick={() => { setFilter('all'); setPillarFilter(null); }}>Clear filters</button>}
        </div>
      )}

      {/* Active */}
      {active.length === 0 && counts.total > 0 && filter === 'all' && !pillarFilter && (
        <section className="ch-section">
          <div className="ch-section-bar is-active-bar">🔥 Active Challenges (0)</div>
          <div className="empty-state ch-empty">
            <h3>🌱 Nothing active right now</h3>
            <p>Start a fresh experiment, or give an earlier one another go from your Learnings — a second attempt with a smaller target often sticks.</p>
            <div className="ch-empty-actions">
              <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>➕ Start a challenge</button>
              {counts.ended > 0 && (
                <button className="btn-cancel" onClick={() => setCollapsed((s) => ({ ...s, ended: false }))}>🌱 Review learnings</button>
              )}
            </div>
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section className="ch-section">
          <div className="ch-section-bar is-active-bar">🔥 Active Challenges ({active.length})</div>
          {listView ? (
            renderItems(active)
          ) : (
            activeByPillar.map((group) => {
              const style = pillarStyle(group.name);
              return (
                <div key={group.name} className="ch-group">
                  <div className="ch-group-title" style={{ borderColor: style.accent, color: style.text }}>
                    {style.icon} {group.name} <small>({group.items.length})</small>
                  </div>
                  {renderItems(group.items)}
                </div>
              );
            })
          )}
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section className="ch-section">
          <button
            type="button"
            className="ch-section-bar is-completed-bar"
            onClick={() => setCollapsed((s) => ({ ...s, completed: !s.completed }))}
          >
            <span>🏆 Wins: Completed ({completed.length})</span>
            <span>{collapsed.completed ? '▶' : '▼'}</span>
          </button>
          {!collapsed.completed && renderItems(completed)}
        </section>
      )}

      {/* Ended */}
      {ended.length > 0 && (
        <section className="ch-section">
          <button
            type="button"
            className="ch-section-bar is-ended-bar"
            onClick={() => setCollapsed((s) => ({ ...s, ended: !s.ended }))}
          >
            <span>🌱 Learnings: Ended ({ended.length})</span>
            <span>{collapsed.ended ? '▶' : '▼'}</span>
          </button>
          {!collapsed.ended && renderItems(ended)}
        </section>
      )}

      {selected && (
        <ChallengeDetailModal
          challenge={selected}
          actions={actions}
          version={version}
          onClose={() => setSelectedId(null)}
        />
      )}

      {logTarget && (
        <ChallengeLogModal
          challenge={challenges.find((c) => c.id === logTarget.challenge.id) || logTarget.challenge}
          date={logTarget.date}
          onClose={() => setLogTarget(null)}
          onSave={saveLog}
        />
      )}

      <AddChallengeModal
        show={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        onSuccess={async () => {
          setShowForm(false);
          setEditing(null);
          await load();
        }}
        editingChallenge={editing as any}
      />
    </div>
  );
}
