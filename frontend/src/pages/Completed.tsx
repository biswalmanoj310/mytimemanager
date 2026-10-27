import { useState, useEffect, useMemo } from 'react';
import apiClient from '../services/api';
import {
  CompletedCharts, KpiStrip, TrendSelector, CompletedAnalytics, Dimension, TrendToggles,
  HISTORY_OPTIONS, TYPE_META,
} from '../components/CompletedCharts';
import './Completed.css';

interface CompletedTask {
  id: number;
  name: string;
  description?: string;
  completed_at: string;
  task_type: string;
  source_table: 'task' | 'project_task' | 'wish_task';
  status?: 'completed' | 'na' | 'deleted';
  category_name?: string;
  project_name?: string;
  pillar_name?: string;
  priority?: string | number;
  due_date?: string;
  created_at?: string;
}

interface Stats {
  today: number;
  week: number;
  month: number;
  year: number;
  last_7_days: number;
  last_30_days: number;
  all: number;
}

type Period = 'today' | 'week' | 'month' | 'year' | 'last_7_days' | 'last_30_days' | 'all' | 'custom';
type View = 'list' | 'graphs';

const EMPTY_STATS: Stats = { today: 0, week: 0, month: 0, year: 0, last_7_days: 0, last_30_days: 0, all: 0 };

const PILLAR_COLORS: Record<string, string> = {
  'Hard Work': '#2563eb',
  'Calmness': '#16a34a',
  'Family': '#9333ea',
};
const PILLAR_ICONS: Record<string, string> = {
  'Hard Work': '💼',
  'Calmness': '🧘',
  'Family': '👨‍👩‍👦',
};

const getPillarColor = (name?: string) => PILLAR_COLORS[name || ''] || '#718096';
const getPillarIcon = (name?: string) => PILLAR_ICONS[name || ''] || '📋';

const PERIOD_BUTTONS: { key: Period; label: string; statKey: keyof Stats }[] = [
  { key: 'year', label: 'Year', statKey: 'year' },
  { key: 'last_7_days', label: '7d', statKey: 'last_7_days' },
  { key: 'last_30_days', label: '30d', statKey: 'last_30_days' },
  { key: 'all', label: 'All', statKey: 'all' },
];

const PREFS_KEY = 'completedPagePrefs';

function loadPrefs(): { historyDays: number; toggles: TrendToggles } {
  const fallback = { historyDays: 56, toggles: { day: false, week: true, month: true } };
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return {
      historyDays: HISTORY_OPTIONS.some(h => h.days === raw.historyDays) ? raw.historyDays : fallback.historyDays,
      toggles: { ...fallback.toggles, ...(raw.toggles || {}) },
    };
  } catch {
    return fallback;
  }
}

// Many records only carry a date (stored as midnight), so don't show a misleading 12:00 AM
function formatTime(iso: string) {
  const d = new Date(iso);
  if (d.getHours() === 0 && d.getMinutes() === 0) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function typeBadge(task: CompletedTask) {
  const meta = TYPE_META[task.task_type];
  const label = meta ? meta.label : task.task_type;
  const icon = meta ? meta.icon : '📌';
  const color = meta ? meta.color : '#718096';
  const detail = (task.task_type === 'project' || task.task_type === 'dream') ? task.project_name : undefined;
  return (
    <span className="type-badge" style={{ color, background: `${color}14`, borderColor: `${color}40` }} title={detail ? `${label}: ${detail}` : label}>
      {icon} {detail ? <span className="type-detail">{detail}</span> : label}
    </span>
  );
}

function Completed() {
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(() =>
    new URLSearchParams(window.location.search).get('view') === 'graphs' ? 'graphs' : 'list'
  );
  const [filterPeriod, setFilterPeriod] = useState<Period>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  // One selection shared by the list and the graphs: pick what to filter/compare by, then the items.
  // Deep links: /completed?types=misc,project (or pillars= / categories=)
  const initialSelection = (): { dimension: Dimension; selection: string[] } => {
    const params = new URLSearchParams(window.location.search);
    const dims: [Dimension, string][] = [['types', 'types'], ['pillars', 'pillars'], ['categories', 'categories']];
    for (const [dim, param] of dims) {
      const raw = params.get(param);
      if (raw) return { dimension: dim, selection: raw.split(',').filter(Boolean) };
    }
    return { dimension: 'types', selection: [] };
  };
  const [dimension, setDimension] = useState<Dimension>(() => initialSelection().dimension);
  const [selection, setSelection] = useState<string[]>(() => initialSelection().selection);
  const [historyDays, setHistoryDays] = useState(() => loadPrefs().historyDays);
  const [toggles, setToggles] = useState<TrendToggles>(() => loadPrefs().toggles);

  const [analytics, setAnalytics] = useState<CompletedAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ historyDays, toggles }));
  }, [historyDays, toggles]);

  useEffect(() => {
    loadCompletedTasks();
  }, [filterPeriod, startDate, endDate, selectedMonth]);

  useEffect(() => {
    loadAnalytics();
  }, [dimension, selection, historyDays]);

  const loadCompletedTasks = async () => {
    setLoading(true);
    try {
      let url = `/api/completed-tasks?period=${filterPeriod}`;

      if (filterPeriod === 'custom' && startDate && endDate) {
        url += `&start_date_str=${startDate}&end_date_str=${endDate}`;
      }

      if (selectedMonth && filterPeriod === 'custom') {
        const [year, month] = selectedMonth.split('-');
        const monthStart = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const monthEnd = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`;
        url = `/api/completed-tasks?period=custom&start_date_str=${monthStart}&end_date_str=${monthEnd}`;
      }

      const response = await apiClient.get(url);
      setCompletedTasks(response.data.tasks || []);
      setStats(response.data.stats || EMPTY_STATS);
    } catch (error) {
      console.error('Error loading completed tasks:', error);
      setCompletedTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const h = HISTORY_OPTIONS.find(o => o.days === historyDays) || HISTORY_OPTIONS[0];
      // The consistency map always needs at least 12 weeks of daily data
      const params = new URLSearchParams({ weeks: String(h.weeks), months: String(h.months), days: String(Math.max(h.days, 84)) });
      if (selection.length) {
        const key = dimension === 'types' ? 'task_types' : dimension === 'pillars' ? 'pillar_names' : 'category_names';
        params.set(key, selection.join(','));
      }
      const response = await apiClient.get(`/api/completed-tasks/analytics?${params.toString()}`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error loading completed analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleRestore = async (task: CompletedTask) => {
    if (!confirm(`Restore "${task.name}" back to active?`)) return;
    try {
      await apiClient.post(`/api/completed-tasks/${task.id}/restore?source_table=${task.source_table}`);
      await Promise.all([loadCompletedTasks(), loadAnalytics()]);
    } catch (err) {
      console.error('Failed to restore task:', err);
      alert('Failed to restore task. Please try again.');
    }
  };

  const changeDimension = (d: Dimension) => {
    setDimension(d);
    setSelection([]);
  };

  // Clicking a type slice in a donut drills into that type
  const selectType = (type: string) => {
    if (dimension !== 'types') {
      setDimension('types');
      setSelection([type]);
    } else {
      setSelection(prev => (prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]));
    }
  };

  const selectPeriod = (p: Period) => {
    setFilterPeriod(p);
    setSelectedMonth('');
    setStartDate('');
    setEndDate('');
  };

  const matchesSelection = (t: CompletedTask) => {
    if (selection.length === 0) return true;
    if (dimension === 'types') return selection.includes(t.task_type);
    if (dimension === 'pillars') return selection.includes(t.pillar_name || 'Other');
    return selection.includes(t.category_name || 'Uncategorized');
  };

  const q = searchQuery.toLowerCase();
  const filteredTasks = useMemo(
    () => completedTasks.filter(t =>
      matchesSelection(t) &&
      (!q || t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.project_name?.toLowerCase().includes(q))
    ),
    [completedTasks, dimension, selection, q]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDateLabel = (completedAt: string): string => {
    const d = new Date(completedAt);
    d.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff <= 6) return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // date → tasks (flat); the pillar is shown per row, and as a header only when one pillar is selected
  const grouped: Record<string, CompletedTask[]> = {};
  filteredTasks.forEach(task => {
    const dateLabel = getDateLabel(task.completed_at);
    if (!grouped[dateLabel]) grouped[dateLabel] = [];
    grouped[dateLabel].push(task);
  });

  const singlePillar = dimension === 'pillars' && selection.length === 1 ? selection[0] : '';

  const setAllDatesCollapsed = (collapsed: boolean) => {
    const next: Record<string, boolean> = {};
    Object.keys(grouped).forEach(k => { next[k] = collapsed; });
    setCollapsedDates(next);
  };

  return (
    <div className="completed-container">
      {/* ── Panel 1: title + view switch ── */}
      <div className="completed-header">
        <h1 title="Completed, skipped (NA) and deleted tasks">✅ Completed</h1>
        {view === 'list' && (
          <input
            type="text"
            className="mini-input search-input"
            placeholder="🔍 Search tasks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        )}
        <div className="seg view-switch">
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>📋 List</button>
          <button className={view === 'graphs' ? 'on' : ''} onClick={() => setView('graphs')}>📊 Graphs</button>
        </div>
      </div>

      {/* ── Panel 2: numbers + period (list only) ── */}
      <div className="summary-panel">
        <KpiStrip
          data={analytics}
          activePeriod={view === 'list' ? filterPeriod : undefined}
          onSelectPeriod={view === 'list' ? selectPeriod : undefined}
        />
        {view === 'list' && (
          <div className="period-row">
            <div className="filter-buttons">
              {PERIOD_BUTTONS.map(btn => (
                <button
                  key={btn.key}
                  className={`filter-btn ${filterPeriod === btn.key ? 'active' : ''}`}
                  onClick={() => selectPeriod(btn.key)}
                >
                  {btn.label} <span className="btn-count">{stats[btn.statKey]}</span>
                </button>
              ))}
            </div>
            <input
              type="month"
              className="mini-input"
              title="Pick a month"
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setFilterPeriod('custom'); setStartDate(''); setEndDate(''); }}
            />
            <div className="date-range">
              <input
                type="date" className="mini-input" title="From"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); if (e.target.value && endDate) { setFilterPeriod('custom'); setSelectedMonth(''); } }}
              />
              <span>→</span>
              <input
                type="date" className="mini-input" title="To"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); if (startDate && e.target.value) { setFilterPeriod('custom'); setSelectedMonth(''); } }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Panel 3: same selector for list and graphs ── */}
      <TrendSelector
        view={view}
        dimension={dimension}
        onDimension={changeDimension}
        selection={selection}
        onSelection={setSelection}
        options={analytics?.options}
        historyDays={historyDays}
        onHistory={setHistoryDays}
      />

      {view === 'graphs' ? (
        <CompletedCharts
          data={analytics}
          loading={analyticsLoading}
          dimension={dimension}
          selection={selection}
          historyDays={historyDays}
          toggles={toggles}
          onToggle={(k) => setToggles(prev => ({ ...prev, [k]: !prev[k] }))}
          onTypeSelect={selectType}
        />
      ) : (
        <div className="completed-content">
          {loading ? (
            <div className="loading-state">Loading…</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3>Nothing here yet</h3>
              <p>Complete or skip some tasks and they'll appear here.</p>
            </div>
          ) : (
            <>
              <div className="list-toolbar">
                <span>{filteredTasks.length} item{filteredTasks.length !== 1 ? 's' : ''}</span>
                <button className="link-btn" onClick={() => setAllDatesCollapsed(true)}>Collapse all</button>
                <button className="link-btn" onClick={() => setAllDatesCollapsed(false)}>Expand all</button>
              </div>
              {Object.entries(grouped).map(([dateLabel, tasks]) => {
                const isDateCollapsed = !!collapsedDates[dateLabel];
                const pillarCounts: Record<string, number> = {};
                tasks.forEach(t => { const p = t.pillar_name || 'Other'; pillarCounts[p] = (pillarCounts[p] || 0) + 1; });
                return (
                  <div key={dateLabel} className="task-group">
                    <div className="group-header" onClick={() => setCollapsedDates(p => ({ ...p, [dateLabel]: !p[dateLabel] }))}>
                      <span className="caret">{isDateCollapsed ? '▶' : '▼'}</span>
                      <span className="group-title">📅 {dateLabel}</span>
                      <span className="inline-count">{tasks.length}</span>
                      <span className="pillar-dots">
                        {Object.entries(pillarCounts).map(([p, n]) => (
                          <span key={p} style={{ color: getPillarColor(p) }} title={`${p}: ${n}`}>
                            {getPillarIcon(p)}{n}
                          </span>
                        ))}
                      </span>
                    </div>

                    {!isDateCollapsed && (
                      <table className="completed-table">
                        <colgroup>
                          <col />
                          <col className="col-type" />
                          <col className="col-cat" />
                          <col className="col-date" />
                          <col className="col-date" />
                          <col className="col-taken" />
                          <col className="col-action" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Task</th><th>Type</th><th>Category</th>
                            <th className="num" title="When the task was created">Started</th>
                            <th className="num" title="Due date">End</th>
                            <th className="num" title="Days from start to completion">Taken</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {singlePillar && (
                            <tr className="pillar-row">
                              <td colSpan={7} style={{ color: getPillarColor(singlePillar), borderLeft: `3px solid ${getPillarColor(singlePillar)}` }}>
                                {getPillarIcon(singlePillar)} {singlePillar} <span className="inline-count muted">{tasks.length}</span>
                              </td>
                            </tr>
                          )}
                          {tasks.map(task => (
                            <TaskRow key={`${task.source_table}-${task.id}`} task={task} onRestore={handleRestore} />
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Calendar-day difference, ignoring time of day
function dayDiff(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

function shortDate(d: Date) {
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: '2-digit' });
}

function TaskRow({ task, onRestore }: { task: CompletedTask; onRestore: (t: CompletedTask) => void }) {
  const isNA = task.status === 'na';
  const isDeleted = task.status === 'deleted';
  const rowCls = isNA ? ' na-task-row' : isDeleted ? ' deleted-task-row' : '';
  const color = getPillarColor(task.pillar_name);

  const done = new Date(task.completed_at);
  const started = task.created_at ? new Date(task.created_at) : null;
  const due = task.due_date ? new Date(`${task.due_date}T00:00:00`) : null;
  const taken = started && !isNA && !isDeleted ? Math.max(0, dayDiff(started, done)) : null;
  const late = due && !isNA && !isDeleted && dayDiff(due, done) > 0;
  const time = formatTime(task.completed_at);

  const tooltip = [task.name, task.description, `${task.pillar_name || 'Other'}${task.category_name ? ` › ${task.category_name}` : ''}`]
    .filter(Boolean).join('\n\n');

  return (
    <tr className={`completed-task-row${rowCls}`} style={{ borderLeft: `3px solid ${color}` }}>
      <td className="name-cell">
        <span className="task-name-text" title={tooltip}>
          {isNA && <span className="na-badge" title="Marked as Not Applicable">⊘ NA</span>}
          {isDeleted && <span className="deleted-badge" title="Task was deleted">🗑 Deleted</span>}
          <span className="pillar-ico" title={task.pillar_name || 'Other'}>{getPillarIcon(task.pillar_name)}</span>
          {task.name}
        </span>
      </td>
      <td className="type-cell">{typeBadge(task)}</td>
      <td className="cat-cell">{task.category_name && <span className="category-badge" title={task.category_name}>{task.category_name}</span>}</td>
      <td className="num date-cell">{started ? shortDate(started) : '–'}</td>
      <td className={`num date-cell${late ? ' late' : ''}`} title={late ? 'Completed after the due date' : undefined}>{due ? shortDate(due) : '–'}</td>
      <td className="num taken-cell" title={`Completed ${done.toLocaleDateString()}${time ? ` ${time}` : ''}`}>
        {taken === null ? '–' : taken === 0 ? 'Same day' : `${taken}d`}
      </td>
      <td className="action-cell">
        <button
          className={`restore-btn${isDeleted ? ' deleted-restore-btn' : isNA ? ' na-restore-btn' : ''}`}
          onClick={() => onRestore(task)}
          title={isDeleted ? 'Restore this deleted task' : isNA ? 'Re-activate this task' : 'Restore this task to active'}
        >
          ↩&#xFE0E;
        </button>
      </td>
    </tr>
  );
}

export default Completed;
