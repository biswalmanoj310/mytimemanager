import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import apiClient from '../services/api';
import { formatDateForInput, getWeekStart } from '../utils/dateHelpers';
import { useCustomRowOrder } from '../hooks/useCustomRowOrder';
import RowOrderResetButton from './RowOrderResetButton';
import EntitySelector from './EntitySelector';
import { fetchDailyCompletionDates, isDailyTabTask } from '../utils/dailyTabTasks';

// ─── Types ────────────────────────────────────────────────────────
type Period   = 'day' | 'week' | 'month' | 'year';
type ViewType = 'pillar' | 'category' | 'task' | 'one_time';
type Display  = 'time' | 'percent';
type ChartMode = 'share' | 'plan';

// allocPerDay = planned minutes per day (0 when unknown)
interface DistItem { id: string; name: string; minutes: number; allocPerDay: number; color: string; pillar?: string; category?: string; }

// ─── Daily tab hierarchy order (mirrors HourlyTaskTimeline) ────────
const PILLAR_ORDER   = ['Hard Work', 'Calmness', 'Family'];
const CATEGORY_ORDER = ['Office-Tasks', 'Learning', 'Confidence', 'Yoga', 'Sleep', 'My Tasks', 'Home Tasks', 'Time Waste', 'Screen Time'];

// ─── Colors (mirrors HourlyTaskTimeline) ─────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  'Office-Tasks': '#16a34a',
  'Learning':     '#eab308',
  'Confidence':   '#f97316',
  'Yoga':         '#4ade80',
  'Sleep':        '#a3e635',
  'My Tasks':     '#f59e0b',
  'Home Tasks':   '#8b5cf6',
  'Time Waste':   '#dc2626',
  'Screen Time':  '#dc2626',
};
const PILLAR_COLORS: Record<string, string> = {
  'Hard Work': '#16a34a',
  'Calmness':  '#a3e635',
  'Family':    '#8b5cf6',
};
const FALLBACK_PALETTE = ['#3b82f6','#ec4899','#14b8a6','#a855f7','#fb923c','#0ea5e9','#d946ef','#64748b'];
// Per-task colours (no reds); Time Waste / Screen Time tasks cycle through the red family instead
const TASK_COLORS = ['#3b82f6','#16a34a','#eab308','#8b5cf6','#14b8a6','#ec4899','#f97316','#64748b','#0ea5e9','#84cc16','#a855f7','#06b6d4','#d946ef','#65a30d'];
const CEILING_TASK_COLORS = ['#dc2626','#9f1239','#ea580c','#b45309'];

function isDeepRed(n: string) {
  const l = n.toLowerCase();
  return l.includes('waste') || l.includes('screen') || l.includes('relaxing');
}
function getCatColor(cat: string) {
  if (!cat) return '#94a3b8';
  if (isDeepRed(cat)) return '#dc2626';
  return CATEGORY_COLORS[cat] || '#64748b';
}
function getPillarColor(p: string) { return PILLAR_COLORS[p] || '#64748b'; }

// ─── Helpers ──────────────────────────────────────────────────────
function fmtShort(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Custom outside label ─────────────────────────────────────────
const RADIAN = Math.PI / 180;
function CustomLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, value, name, totalMins, display } = props;
  const pct = totalMins > 0 ? Math.round((value / totalMins) * 100) : 0;
  if (pct < 4) return null; // skip tiny slices

  const r = outerRadius + 32;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const anchor = x > cx ? 'start' : 'end';
  const label = display === 'percent' ? `${pct}%` : fmtShort(value);
  const shortName = name.length > 14 ? name.slice(0, 13) + '…' : name;

  return (
    <g>
      <text x={x} y={y - 7} textAnchor={anchor} fill="#1e293b" fontSize={11} fontWeight={700}>{label}</text>
      <text x={x} y={y + 6} textAnchor={anchor} fill="#6b7280" fontSize={10}>{shortName}</text>
    </g>
  );
}

const DAY_MS = 86400000;
const SELECTOR_NOUN: Record<ViewType, string> = { pillar: 'pillars', category: 'categories', task: 'tasks', one_time: 'one-time tasks' };

// Picked items per view, kept separate from Detailed Trend Analysis; empty list = show everything
const SELECTION_KEY = 'timedist:selection';
const EMPTY_SELECTION: Record<ViewType, string[]> = { pillar: [], category: [], task: [], one_time: [] };

function loadSelection(): Record<ViewType, string[]> {
  try {
    const raw = JSON.parse(localStorage.getItem(SELECTION_KEY) || 'null');
    return raw ? { ...EMPTY_SELECTION, ...raw } : EMPTY_SELECTION;
  } catch {
    return EMPTY_SELECTION;
  }
}

function daysInclusive(s: string, e: string) {
  const diff = new Date(e + 'T00:00:00').getTime() - new Date(s + 'T00:00:00').getTime();
  return Math.max(1, Math.round(diff / DAY_MS) + 1);
}

// Time Waste / Screen Time: the allocation is a ceiling, so going over is the bad direction
function isCeiling(item: DistItem) {
  return isDeepRed(item.name) || isDeepRed(item.category || '');
}

function utilStyle(util: number, ceiling: boolean) {
  if (ceiling) return util > 100 ? { fg: '#dc2626', bg: '#fee2e2' } : { fg: '#166534', bg: '#dcfce7' };
  if (util >= 100) return { fg: '#166534', bg: '#dcfce7' };
  if (util >= 60)  return { fg: '#1d4ed8', bg: '#dbeafe' };
  return { fg: '#475569', bg: '#f1f5f9' };
}

function deltaColor(delta: number, ceiling: boolean) {
  if (delta >= 0) return ceiling ? '#dc2626' : '#16a34a';
  return ceiling ? '#16a34a' : '#64748b';
}

// ─── Data loading ─────────────────────────────────────────────────
function sortItems(items: DistItem[], viewType: ViewType): DistItem[] {
  if (viewType === 'pillar') {
    return items.sort((a, b) => {
      const pa = PILLAR_ORDER.indexOf(a.name);
      const pb = PILLAR_ORDER.indexOf(b.name);
      return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    });
  }
  if (viewType === 'category') {
    return items.sort((a, b) => {
      const ca = CATEGORY_ORDER.indexOf(a.name);
      const cb = CATEGORY_ORDER.indexOf(b.name);
      return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
    });
  }
  // task / one_time: pillar → category
  return items.sort((a, b) => {
    const pa = PILLAR_ORDER.indexOf(a.pillar || '');
    const pb = PILLAR_ORDER.indexOf(b.pillar || '');
    if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    const ca = CATEGORY_ORDER.indexOf(a.category || '');
    const cb = CATEGORY_ORDER.indexOf(b.category || '');
    return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
  });
}

async function fetchItems(viewType: ViewType, start: string, end: string): Promise<DistItem[]> {
  let items: DistItem[] = [];

  if (viewType === 'pillar') {
    const res = await apiClient.get(`/api/analytics/pillar-distribution?start_date=${start}&end_date=${end}`);
    items = (res.data.pillars || [])
      .map((p: any) => ({
        id: `p:${p.pillar_name}`,
        name: p.pillar_name,
        minutes: Math.round(p.spent_hours * 60),
        allocPerDay: Math.round((p.allocated_hours || 0) * 60),
        color: getPillarColor(p.pillar_name),
      }));

  } else if (viewType === 'category') {
    const res = await apiClient.get(`/api/analytics/category-breakdown?start_date=${start}&end_date=${end}`);
    items = (res.data.categories || [])
      .map((c: any) => ({
        id: `c:${c.category_name}`,
        name: c.category_name,
        minutes: Math.round(c.spent_hours * 60),
        allocPerDay: Math.round((c.allocated_hours || 0) * 60),
        color: getCatColor(c.category_name),
      }));

  } else {
    const [tasksRes, entriesRes, completionDates] = await Promise.all([
      apiClient.get('/api/tasks?limit=1000&is_active=true&is_completed=false'),
      apiClient.get(`/api/daily-time?start_date=${start}&end_date=${end}`),
      fetchDailyCompletionDates(),
    ]);
    const allTasks: any[] = tasksRes.data || [];
    const entries: any[] = entriesRes.data || [];

    // Same list as the Daily tab / Detailed Trend picker; Task = time-based + one-time together
    const filtered = allTasks.filter((t: any) =>
      isDailyTabTask(t, 'one_time', completionDates) ||
      (viewType === 'task' && isDailyTabTask(t, 'time', completionDates)));

    const taskSet = new Set(filtered.map((t: any) => t.id));
    const spentMap = new Map<number, number>();
    entries.forEach((e: any) => {
      if (taskSet.has(e.task_id))
        spentMap.set(e.task_id, (spentMap.get(e.task_id) || 0) + e.minutes);
    });

    items = filtered
      .map((t: any) => ({
        id: `t:${t.id}`,
        name: t.name,
        minutes: spentMap.get(t.id) || 0,
        allocPerDay: t.allocated_minutes || 0,
        color: '',
        pillar:   t.pillar_name   || '',
        category: t.category_name || '',
      }));
  }

  const sorted = sortItems(items, viewType);
  if (viewType === 'task' || viewType === 'one_time') {
    // One colour per task (by list position) so two tasks in the same category never look alike
    let normal = 0, ceiling = 0;
    sorted.forEach(it => {
      it.color = isCeiling(it)
        ? CEILING_TASK_COLORS[ceiling++ % CEILING_TASK_COLORS.length]
        : TASK_COLORS[normal++ % TASK_COLORS.length];
    });
  }
  return sorted;
}

// ─── Component ────────────────────────────────────────────────────
export default function TimeDistributionChart() {
  const today = formatDateForInput(new Date());

  const [period,   setPeriod]   = useState<Period>('week');
  const [offset,   setOffset]   = useState(0);
  const [viewType, setViewType] = useState<ViewType>('category');
  const [display,  setDisplay]  = useState<Display>('time');
  const [chartMode, setChartMode] = useState<ChartMode>('share');
  const [allItems, setAllItems] = useState<DistItem[]>([]);
  const [selection, setSelection] = useState<Record<ViewType, string[]>>(loadSelection);
  const [selectorOpen, setSelectorOpen] = useState(false);
  // Baseline minutes/day per item id: 30 days before today (Day view) or the previous full period
  const [refPerDay, setRefPerDay] = useState<Map<string, number>>(new Map());
  const [loading,  setLoading]  = useState(true);
  const rowOrder = useCustomRowOrder(`analytics:timedist:${viewType}`);

  // Reset offset when period changes
  useEffect(() => { setOffset(0); }, [period]);

  // Compute date range + navigation label (weeks start on Sunday via getWeekStart); ref* = baseline range for comparison
  const { start, end, navLabel, refStart, refEnd } = useMemo(() => {
    const base = new Date(today + 'T00:00:00');
    const fmt = formatDateForInput;

    if (period === 'day') {
      const d = new Date(base); d.setDate(d.getDate() + offset);
      const ds = fmt(d);
      const lbl = offset === 0 ? 'Today' : offset === -1 ? 'Yesterday'
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      // Baseline: the 30 days before this day
      const rs = new Date(d); rs.setDate(rs.getDate() - 30);
      const re = new Date(d); re.setDate(re.getDate() - 1);
      return { start: ds, end: ds, navLabel: lbl, refStart: fmt(rs), refEnd: fmt(re) };
    }

    if (period === 'week') {
      const ws = getWeekStart(base); ws.setDate(ws.getDate() + offset * 7);
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      const cap = we > base ? base : we;
      const lbl = offset === 0 ? 'This Week' : offset === -1 ? 'Last Week'
        : `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const rs = new Date(ws); rs.setDate(rs.getDate() - 7);
      const re = new Date(ws); re.setDate(re.getDate() - 1);
      return { start: fmt(ws), end: fmt(cap), navLabel: lbl, refStart: fmt(rs), refEnd: fmt(re) };
    }

    if (period === 'month') {
      const ms = new Date(base.getFullYear(), base.getMonth() + offset, 1);
      const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0);
      const cap = me > base ? base : me;
      const rs = new Date(ms.getFullYear(), ms.getMonth() - 1, 1);
      const re = new Date(ms.getFullYear(), ms.getMonth(), 0);
      return {
        start: fmt(ms), end: fmt(cap),
        navLabel: ms.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        refStart: fmt(rs), refEnd: fmt(re),
      };
    }

    // year
    const yr = base.getFullYear() + offset;
    const ys = new Date(yr, 0, 1);
    const ye = new Date(yr, 11, 31);
    const cap = ye > base ? base : ye;
    return {
      start: fmt(ys), end: fmt(cap), navLabel: String(yr),
      refStart: fmt(new Date(yr - 1, 0, 1)), refEnd: fmt(new Date(yr - 1, 11, 31)),
    };
  }, [period, offset, today]);

  const days = daysInclusive(start, end);
  const refDays = daysInclusive(refStart, refEnd);

  // Fetch the period and its baseline whenever the date range or view type changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const [items, refItems] = await Promise.all([
          fetchItems(viewType, start, end),
          fetchItems(viewType, refStart, refEnd).catch(() => [] as DistItem[]),
        ]);
        if (cancelled) return;
        setAllItems(items);
        setRefPerDay(new Map(refItems.map(i => [i.id, i.minutes / refDays])));
      } catch (err) {
        console.error('TimeDistributionChart error', err);
        if (!cancelled) setAllItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [start, end, refStart, refEnd, refDays, viewType]);

  const selected = selection[viewType];
  useEffect(() => { localStorage.setItem(SELECTION_KEY, JSON.stringify(selection)); }, [selection]);

  // Only items with tracked time are charted; a non-empty selection narrows them further
  const data = useMemo(
    () => allItems.filter(i => i.minutes > 0 && (selected.length === 0 || selected.includes(i.id))),
    [allItems, selected],
  );
  const rows = useMemo(() => rowOrder.applyOrder(data), [data, rowOrder.applyOrder]);

  // perDay: average per day over the elapsed days (Day view: the day itself). Compared with the baseline for the ▲/▼ delta.
  const metricsOf = (item: DistItem) => {
    const perDay = item.minutes / days;
    const ref = refPerDay.get(item.id) || 0;
    const delta = ref > 0 ? ((perDay - ref) / ref) * 100 : null;
    const util = item.allocPerDay > 0 ? (perDay / item.allocPerDay) * 100 : null;
    return { perDay, ref, delta, util, ceiling: isCeiling(item) };
  };
  const isDay = period === 'day';

  const totalMins = data.reduce((s, d) => s + d.minutes, 0);
  const totalH = Math.floor(totalMins / 60);
  const totalM = totalMins % 60;

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'day',   label: 'Daily'   },
    { key: 'week',  label: 'Weekly'  },
    { key: 'month', label: 'Monthly' },
    { key: 'year',  label: 'Yearly'  },
  ];

  const VIEWS: { key: ViewType; label: string }[] = [
    { key: 'pillar',   label: '🎯 Pillar'   },
    { key: 'category', label: '📂 Category' },
    { key: 'task',     label: '✅ Task'     },
    { key: 'one_time', label: '📌 One-Time' },
  ];

  return (
    <div className="time-dist-card">
      {/* ── Header ── */}
      <div className="time-dist-header">
        <h2>⏱️ Time Distribution</h2>
        <div className="time-dist-header-right">
          {/* Period buttons */}
          <div className="time-dist-btngroup">
            {PERIODS.map(p => (
              <button
                key={p.key}
                className={`time-dist-pill${period === p.key ? ' active' : ''}`}
                onClick={() => setPeriod(p.key)}
              >{p.label}</button>
            ))}
          </div>
          {/* Navigation */}
          <div className="time-dist-nav">
            <button className="time-dist-nav-btn" onClick={() => setOffset(o => o - 1)}>‹</button>
            <span className="time-dist-nav-label">{navLabel}</span>
            <button
              className="time-dist-nav-btn"
              onClick={() => setOffset(o => Math.min(o + 1, 0))}
              disabled={offset === 0}
            >›</button>
          </div>
        </div>
      </div>

      {/* ── Sub-controls ── */}
      <div className="time-dist-subbar">
        <div className="time-dist-btngroup">
          {VIEWS.map(v => (
            <button
              key={v.key}
              className={`time-dist-pill${viewType === v.key ? ' active' : ''}`}
              onClick={() => setViewType(v.key)}
            >{v.label}</button>
          ))}
        </div>
        <div className="time-dist-btngroup">
          <button className={`time-dist-pill${display === 'time' ? ' active' : ''}`} onClick={() => setDisplay('time')}>⏱ Time</button>
          <button className={`time-dist-pill${display === 'percent' ? ' active' : ''}`} onClick={() => setDisplay('percent')}>% Percent</button>
        </div>
        <div className="time-dist-btngroup">
          <button className={`time-dist-pill${chartMode === 'share' ? ' active' : ''}`} onClick={() => setChartMode('share')} title="Where did my time go (share of total)">🍩 Share</button>
          <button className={`time-dist-pill${chartMode === 'plan' ? ' active' : ''}`} onClick={() => setChartMode('plan')} title="How much of the planned time did I use">🎯 Plan</button>
        </div>
      </div>

      {/* ── Picker: narrow the chart and totals to chosen items ── */}
      <EntitySelector
        title={`Choose ${SELECTOR_NOUN[viewType]} (none selected = all)`}
        noun={SELECTOR_NOUN[viewType]}
        expanded={selectorOpen}
        onToggleExpanded={() => setSelectorOpen(o => !o)}
        selected={selected}
        onChange={next => setSelection(s => ({ ...s, [viewType]: next }))}
        options={allItems.map(i => ({ key: i.id, label: i.name }))}
      />

      {/* ── Body ── */}
      {loading ? (
        <div className="time-dist-empty">Loading...</div>
      ) : data.length === 0 ? (
        <div className="time-dist-empty">
          {selected.length > 0 ? 'No time tracked for the selected items in this period.' : 'No time tracked for this period.'}
        </div>
      ) : (
        <div className="time-dist-body">
          {chartMode === 'plan' ? (
            <div className="time-dist-plan">
              <div className="time-dist-plan-note">
                {isDay ? 'Today' : 'Average per day'} ÷ planned time per day. The line marks 100%.
              </div>
              {rows.filter(r => r.allocPerDay > 0).map(item => {
                const m = metricsOf(item);
                const util = m.util ?? 0;
                const st = utilStyle(util, m.ceiling);
                return (
                  <div key={item.id} className="time-dist-plan-row">
                    <span className="time-dist-plan-name" title={item.name}>{item.name}</span>
                    <div className="time-dist-plan-track">
                      <div className="time-dist-plan-fill" style={{ width: `${Math.min(util, 150) / 150 * 100}%`, background: st.fg }} />
                      <div className="time-dist-plan-marker" />
                    </div>
                    <span className="time-dist-plan-pct" style={{ color: st.fg }}>{Math.round(util)}%</span>
                  </div>
                );
              })}
              {!rows.some(r => r.allocPerDay > 0) && (
                <div className="time-dist-empty">No planned time is set for these items.</div>
              )}
            </div>
          ) : (
          <div className="time-dist-chart-wrap">
            <PieChart width={430} height={340}>
              <Pie
                data={data}
                cx={210}
                cy={165}
                startAngle={90}
                endAngle={-270}
                innerRadius={90}
                outerRadius={130}
                paddingAngle={2}
                dataKey="minutes"
                nameKey="name"
                labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                label={(props: any) => <CustomLabel {...props} totalMins={totalMins} display={display} />}
                isAnimationActive={true}
              >
                {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              {/* Center: total time */}
              <text x={210} y={152} textAnchor="middle" fill="#dc2626" fontSize={36} fontWeight={800}>
                {totalH}<tspan fontSize={16} fontWeight={600}>h</tspan>
              </text>
              <text x={210} y={182} textAnchor="middle" fill="#dc2626" fontSize={24} fontWeight={700}>
                {totalM}<tspan fontSize={13} fontWeight={500}>m</tspan>
              </text>
            </PieChart>
          </div>
          )}

          {/* Table: drag rows to reorder */}
          <div className="time-dist-legend-panel">
            <div className="time-dist-grid time-dist-grid-head">
              <span>{VIEWS.find(v => v.key === viewType)?.label.replace(/^\S+\s/, '')}</span>
              <span>Plan/day</span>
              <span>Total</span>
              <span>{isDay ? 'Usual/day (30d)' : 'Avg/day'}</span>
              <span>Used</span>
            </div>
            {rows.map(item => {
              const pct = totalMins > 0 ? Math.round((item.minutes / totalMins) * 100) : 0;
              const m = metricsOf(item);
              const st = m.util !== null ? utilStyle(m.util, m.ceiling) : null;
              const secondVal = isDay ? m.ref : m.perDay;
              return (
                <div key={item.id} className="time-dist-legend-row time-dist-grid" {...rowOrder.rowProps(item.id, rows)}>
                  <div className="time-dist-legend-left">
                    <span className="time-dist-legend-dot" style={{ background: item.color }} />
                    <span className="time-dist-legend-name" title={item.name}>{item.name}</span>
                  </div>
                  <span className="time-dist-legend-meta">{item.allocPerDay > 0 ? fmtShort(item.allocPerDay) : '—'}</span>
                  <span className="time-dist-legend-meta">
                    {display === 'time'
                      ? <><strong>{fmtShort(item.minutes)}</strong> · {pct}%</>
                      : <strong>{pct}%</strong>
                    }
                  </span>
                  <span className="time-dist-legend-meta">
                    <strong>{secondVal > 0 ? fmtShort(Math.round(secondVal)) : '—'}</strong>
                    {m.delta !== null && Math.abs(m.delta) >= 1 && (
                      <span className="time-dist-delta" style={{ color: deltaColor(m.delta, m.ceiling) }}
                        title={isDay ? 'Today vs your usual day' : 'Avg/day vs the previous period'}>
                        {m.delta >= 0 ? ' ▲' : ' ▼'}{Math.abs(Math.round(m.delta))}%
                      </span>
                    )}
                    {period === 'year' && <span className="time-dist-sub">{fmtShort(Math.round(m.perDay * 7))}/wk</span>}
                  </span>
                  <span className="time-dist-legend-meta">
                    {m.util !== null && st
                      ? <span className="time-dist-chip" style={{ color: st.fg, background: st.bg }}>{Math.round(m.util)}%</span>
                      : '—'}
                  </span>
                </div>
              );
            })}
            <RowOrderResetButton visible={rowOrder.isCustom} onReset={rowOrder.reset} />
          </div>
        </div>
      )}
    </div>
  );
}
