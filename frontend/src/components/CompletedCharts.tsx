import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';

export interface SeriesPoint {
  label: string;
  start: string;
  total: number;
  by_type: Record<string, number>;
  by_pillar: Record<string, number>;
  by_category: Record<string, number>;
}

export interface CompletedOptions {
  types: Record<string, number>;
  pillars: Record<string, number>;
  categories: Record<string, number>;
}

export interface CompletedAnalytics {
  daily: SeriesPoint[];
  weekly: SeriesPoint[];
  monthly: SeriesPoint[];
  options: CompletedOptions;
  by_type: Record<string, number>;
  by_pillar: Record<string, number>;
  by_category: Record<string, number>;
  weekday: number[];
  insights: {
    total: number;
    this_week: number;
    last_week: number;
    week_delta_pct: number | null;
    this_month: number;
    last_month: number;
    month_delta_pct: number | null;
    avg_per_week: number;
    on_time_pct: number | null;
    on_time_total: number;
  };
}

export type Dimension = 'types' | 'categories' | 'pillars';
export interface TrendToggles { day: boolean; week: boolean; month: boolean }

// How far back the trend charts look; weeks/months size the weekly and monthly series to match
export const HISTORY_OPTIONS = [
  { days: 56, weeks: 8, months: 3, label: 'Last 8 Weeks (default)' },
  { days: 91, weeks: 13, months: 4, label: 'Last 3 Months' },
  { days: 182, weeks: 26, months: 7, label: 'Last 6 Months' },
  { days: 365, weeks: 52, months: 13, label: 'Last 12 Months' },
];

export const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  today: { label: 'Today', icon: '🎯', color: '#ef4444' },
  daily: { label: 'Daily', icon: '📝', color: '#0ea5e9' },
  weekly: { label: 'Weekly', icon: '📅', color: '#14b8a6' },
  monthly: { label: 'Monthly', icon: '🗓', color: '#84cc16' },
  quarterly: { label: 'Quarterly', icon: '🗓', color: '#a78bfa' },
  yearly: { label: 'Yearly', icon: '📆', color: '#78716c' },
  one_time: { label: 'Important', icon: '⭐', color: '#eab308' },
  misc: { label: 'Misc', icon: '🎨', color: '#f97316' },
  project: { label: 'Project', icon: '📋', color: '#6366f1' },
  dream: { label: 'Dream', icon: '✨', color: '#d946ef' },
};
export const TYPE_ORDER = ['today', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'one_time', 'misc', 'project', 'dream'];
const ALWAYS_SHOWN_TYPES = ['misc', 'project', 'dream'];

export const PILLAR_COLORS: Record<string, string> = {
  'Hard Work': '#2563eb',
  'Calmness': '#16a34a',
  'Family': '#9333ea',
  'Other': '#94a3b8',
};
const PILLAR_ORDER = ['Hard Work', 'Calmness', 'Family'];

const CATEGORY_PALETTE = ['#0ea5e9', '#f97316', '#10b981', '#e11d48', '#8b5cf6', '#eab308', '#14b8a6'];
const SERIES_COLORS = ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f56565', '#38b2ac'];

const typeColor = (t: string) => TYPE_META[t]?.color || '#94a3b8';
const typeLabel = (t: string) => TYPE_META[t]?.label || t;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TOTAL_KEY = '__total';

function formatDelta(pct: number | null, current: number) {
  if (pct === null) return current > 0 ? { text: 'new', cls: 'up' } : { text: '–', cls: 'flat' };
  if (pct === 0) return { text: '0%', cls: 'flat' };
  return { text: `${pct > 0 ? '▲' : '▼'}${Math.abs(pct).toFixed(0)}%`, cls: pct > 0 ? 'up' : 'down' };
}

function formatShortDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── KPI strip: Today / Week / Month double as period selectors for the list ──
export function KpiStrip({ data, activePeriod, onSelectPeriod }: {
  data: CompletedAnalytics | null;
  activePeriod?: string;
  onSelectPeriod?: (period: 'today' | 'week' | 'month') => void;
}) {
  if (!data) return <div className="kpi-strip kpi-loading">Loading…</div>;
  const i = data.insights;
  const today = data.daily.length ? data.daily[data.daily.length - 1].total : 0;
  const wd = formatDelta(i.week_delta_pct, i.this_week);
  const md = formatDelta(i.month_delta_pct, i.this_month);

  const periodProps = (p: 'today' | 'week' | 'month') =>
    onSelectPeriod
      ? { onClick: () => onSelectPeriod(p), className: `kpi kpi-click${activePeriod === p ? ' kpi-active' : ''}`, role: 'button' as const }
      : { className: 'kpi' };

  return (
    <div className="kpi-strip">
      <div {...periodProps('today')} title="Show today's list">
        <span className="kpi-val">{today}</span><span className="kpi-lbl">Today</span>
      </div>
      <div {...periodProps('week')} title={`Last week: ${i.last_week}`}>
        <span className="kpi-val">{i.this_week}</span>
        <span className="kpi-lbl">Week <b className={`delta ${wd.cls}`}>{wd.text}</b></span>
      </div>
      <div {...periodProps('month')} title={`Last month: ${i.last_month}`}>
        <span className="kpi-val">{i.this_month}</span>
        <span className="kpi-lbl">Month <b className={`delta ${md.cls}`}>{md.text}</b></span>
      </div>
      <div className="kpi" title="Average tasks completed per full week in the selected history">
        <span className="kpi-val">{i.avg_per_week}</span><span className="kpi-lbl">Avg/wk</span>
      </div>
      <div
        className="kpi"
        title={i.on_time_pct === null
          ? 'No tasks with a due date in this range'
          : `${i.on_time_total} tasks with a due date; share finished on or before it`}
      >
        <span className="kpi-val">{i.on_time_pct === null ? '–' : `${i.on_time_pct}%`}</span>
        <span className="kpi-lbl">On time</span>
      </div>
    </div>
  );
}

// ── Selector panel shared by the list and graph views (same look as Detailed Trend Analysis) ──
export function TrendSelector({ view, dimension, onDimension, selection, onSelection, options, historyDays, onHistory }: {
  view: 'list' | 'graphs';
  dimension: Dimension;
  onDimension: (d: Dimension) => void;
  selection: string[];
  onSelection: (s: string[]) => void;
  options?: CompletedOptions;
  historyDays: number;
  onHistory: (days: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const items = useMemo(() => {
    if (!options) return [] as { key: string; label: string; color: string; count: number }[];
    if (dimension === 'types') {
      return TYPE_ORDER
        .filter(t => ALWAYS_SHOWN_TYPES.includes(t) || (options.types[t] || 0) > 0 || selection.includes(t))
        .map(t => ({ key: t, label: `${TYPE_META[t].icon} ${TYPE_META[t].label}`, color: TYPE_META[t].color, count: options.types[t] || 0 }));
    }
    if (dimension === 'pillars') {
      const keys = Object.keys(options.pillars).sort((a, b) => {
        const ia = PILLAR_ORDER.indexOf(a), ib = PILLAR_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      return keys.map(k => ({ key: k, label: k, color: PILLAR_COLORS[k] || '#94a3b8', count: options.pillars[k] }));
    }
    return Object.entries(options.categories)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => ({ key: k, label: k, color: '#48bb78', count: n }));
  }, [options, dimension, selection]);

  const dimLabel = dimension === 'types' ? 'Task Types' : dimension === 'categories' ? 'Categories' : 'Pillars';
  const toggle = (key: string) =>
    onSelection(selection.includes(key) ? selection.filter(k => k !== key) : [...selection, key]);

  return (
    <div className="trend-section">
      <div className="trend-head">
        <h2>{view === 'graphs' ? '📊 Detailed Trend Analysis' : '🔎 Filter Tasks'}</h2>
        {view === 'graphs' && (
          <label className="trend-history">
            History:
            <select value={historyDays} onChange={(e) => onHistory(Number(e.target.value))}>
              {HISTORY_OPTIONS.map(h => <option key={h.days} value={h.days}>{h.label}</option>)}
            </select>
          </label>
        )}
        <div className="trend-dims">
          {([['types', '✓ Types'], ['categories', '📁 Categories'], ['pillars', '🎯 Pillars']] as [Dimension, string][]).map(([d, label]) => (
            <button key={d} className={dimension === d ? 'active' : ''} onClick={() => onDimension(d)}>{label}</button>
          ))}
        </div>
      </div>
      <p className="trend-desc">
        {view === 'graphs'
          ? 'Select task types, categories, or pillars to compare their completions over time — leave empty to see everything.'
          : 'Select task types, categories, or pillars to filter the list — leave empty to see everything.'}
      </p>

      <div className="trend-selector">
        <label className="trend-selector-title" onClick={() => setExpanded(e => !e)}>
          Select {dimLabel}:
          <span className={`trend-caret${expanded ? '' : ' closed'}`}>▼</span>
          {selection.length > 0 && (
            <button className="link-btn" onClick={(e) => { e.stopPropagation(); onSelection([]); }}>✕ Clear ({selection.length})</button>
          )}
        </label>
        {expanded && (
          <div className="trend-pills">
            {items.map(it => {
              const on = selection.includes(it.key);
              return (
                <label key={it.key} className={`trend-pill${on ? ' on' : ''}`} style={on ? { background: it.color, borderColor: it.color } : undefined}>
                  <input type="checkbox" checked={on} onChange={() => toggle(it.key)} />
                  {it.label}
                  <span className="pill-count">{it.count}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Trend helpers (mirror the Analytics page's linear trend + arrowhead badge) ──
function linearTrend(values: number[]): number[] {
  const n = values.length;
  if (n < 2) return values;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  values.forEach((v, i) => { num += (i - xMean) * (v - yMean); den += (i - xMean) ** 2; });
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return values.map((_, i) => slope * i + intercept);
}

function trendBadge(cx: number, cy: number, up: boolean, label: string) {
  const width = label.length * 5.5 + 6;
  return (
    <g transform={`translate(${cx + 12}, ${up ? cy - 16 : cy + 16})`}>
      <rect x={-2} y={-9} width={width} height={14} rx={4} fill="#f1f5f9" stroke="#cbd5e0" strokeWidth={0.5} />
      <text x={width / 2 - 1} y={1} textAnchor="middle" fontSize={9} fontWeight={600} fill="#64748b">{label}</text>
    </g>
  );
}

function arrowDot(count: number, key: string, color: string, label?: string) {
  let prev: { cx: number; cy: number } | null = null;
  return (props: any) => {
    const { cx, cy, index } = props;
    if (index !== count - 1) {
      prev = { cx, cy };
      return <g key={`d-${key}-${index}`} />;
    }
    const up = prev ? cy < prev.cy : false;
    const rotation = prev ? Math.atan2(cy - prev.cy, cx - prev.cx) * (180 / Math.PI) : 0;
    return (
      <g key={`arrow-${key}`}>
        <g transform={`translate(${cx}, ${cy}) rotate(${rotation})`}>
          <path d="M -7 0 H 5 M 1 -4 L 6 0 L 1 4" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        {label && trendBadge(cx, cy, up, label)}
      </g>
    );
  };
}

// ── Heatmap: last N days, Sunday-first columns ───────────────────────
function Heatmap({ daily }: { daily: SeriesPoint[] }) {
  const { columns, max } = useMemo(() => {
    const cols: (SeriesPoint | null)[][] = [];
    if (daily.length === 0) return { columns: cols, max: 0 };
    const first = new Date(daily[0].start + 'T00:00:00');
    let col: (SeriesPoint | null)[] = Array(first.getDay()).fill(null);
    daily.forEach(p => {
      col.push(p);
      if (col.length === 7) { cols.push(col); col = []; }
    });
    if (col.length) { while (col.length < 7) col.push(null); cols.push(col); }
    return { columns: cols, max: Math.max(1, ...daily.map(d => d.total)) };
  }, [daily]);

  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));

  return (
    <div className="heatmap">
      <div className="heatmap-days">
        {WEEKDAYS.map((d, idx) => <span key={d}>{idx % 2 === 1 ? d : ''}</span>)}
      </div>
      <div className="heatmap-grid">
        {columns.map((c, ci) => (
          <div key={ci} className="heatmap-col">
            {c.map((p, ri) => (
              <div
                key={ri}
                className={`heat-cell ${p ? `lv${level(p.total)}` : 'empty'}`}
                title={p ? `${formatShortDate(p.start)}: ${p.total} completed` : ''}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Donut({ title, data, colorFor, labelFor, onSelect }: {
  title: string;
  data: Record<string, number>;
  colorFor: (k: string) => string;
  labelFor: (k: string) => string;
  onSelect?: (k: string) => void;
}) {
  const rows = Object.entries(data).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {total === 0 ? <div className="chart-empty">No data</div> : (
        <div className="donut-wrap">
          <div className="donut-chart">
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={rows.map(([k, v]) => ({ key: k, name: labelFor(k), value: v }))}
                  dataKey="value" isAnimationActive={false} innerRadius={32} outerRadius={54} paddingAngle={1} stroke="none"
                  onClick={(d: any) => onSelect?.(d.key)} cursor={onSelect ? 'pointer' : undefined}>
                  {rows.map(([k]) => <Cell key={k} fill={colorFor(k)} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, padding: '4px 8px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">{total}</div>
          </div>
          <ul className="legend">
            {rows.map(([k, v]) => (
              <li key={k} onClick={() => onSelect?.(k)} className={onSelect ? 'clickable' : ''}>
                <i style={{ background: colorFor(k) }} />
                <span>{labelFor(k)}</span>
                <b>{v}</b>
                <em>{Math.round((v / total) * 100)}%</em>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Keep the donut readable: top 6 categories, the rest folded into "Others"
function topCategories(by: Record<string, number>, limit = 6): Record<string, number> {
  const sorted = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const out: Record<string, number> = {};
  sorted.slice(0, limit).forEach(([k, v]) => { out[k] = v; });
  const rest = sorted.slice(limit).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) out['Others'] = rest;
  return out;
}

function coachMessage(data: CompletedAnalytics): string {
  const i = data.insights;
  const today = data.daily.length ? data.daily[data.daily.length - 1].total : 0;
  if (i.week_delta_pct !== null && i.week_delta_pct > 0) {
    return `📈 Up ${i.week_delta_pct.toFixed(0)}% vs last week — small wins are compounding. Keep going!`;
  }
  if (i.week_delta_pct !== null && i.week_delta_pct < 0) {
    return `🌱 ${Math.abs(i.week_delta_pct).toFixed(0)}% below last week. Pick the one task that matters most and start there.`;
  }
  if (i.on_time_pct !== null && i.on_time_pct < 50 && i.on_time_total >= 5) {
    return `⏰ Only ${i.on_time_pct}% of your dated tasks were finished by their due date — try more realistic due dates.`;
  }
  if (today > 0) return `🎉 ${today} task${today !== 1 ? 's' : ''} done today — nice progress!`;
  return '🚀 A fresh start: complete one small task to build momentum.';
}

// ── Graph view body ──────────────────────────────────────────────────
export function CompletedCharts({ data, loading, dimension, selection, historyDays, toggles, onToggle, onTypeSelect }: {
  data: CompletedAnalytics | null;
  loading: boolean;
  dimension: Dimension;
  selection: string[];
  historyDays: number;
  toggles: TrendToggles;
  onToggle: (key: keyof TrendToggles) => void;
  onTypeSelect: (type: string) => void;
}) {
  const history = HISTORY_OPTIONS.find(h => h.days === historyDays) || HISTORY_OPTIONS[0];

  // One series per selected item; with nothing selected, a single "All completed" series
  const series = useMemo(() => {
    const keys = selection.length ? selection : [TOTAL_KEY];
    return keys.map((k, idx) => {
      const color = k === TOTAL_KEY ? '#4299e1'
        : dimension === 'types' ? typeColor(k)
        : dimension === 'pillars' ? (PILLAR_COLORS[k] || '#94a3b8')
        : SERIES_COLORS[idx % SERIES_COLORS.length];
      const name = k === TOTAL_KEY ? 'All completed' : dimension === 'types' ? typeLabel(k) : k;
      return { key: k, dataKey: `s${idx}`, trendKey: `t${idx}`, name, color };
    });
  }, [selection, dimension]);

  const buildRows = (points: SeriesPoint[], lastLabel?: string) => {
    const bucketOf = (p: SeriesPoint) => (dimension === 'types' ? p.by_type : dimension === 'pillars' ? p.by_pillar : p.by_category);
    const rows: any[] = points.map((p, i) => {
      const row: any = { label: lastLabel && i === points.length - 1 ? lastLabel : p.label, start: p.start };
      series.forEach(s => { row[s.dataKey] = s.key === TOTAL_KEY ? p.total : (bucketOf(p)[s.key] || 0); });
      return row;
    });
    series.forEach(s => {
      linearTrend(rows.map(r => r[s.dataKey])).forEach((v, i) => { rows[i][s.trendKey] = v; });
    });
    return rows;
  };

  const dailyRows = useMemo(() => (data ? buildRows(data.daily.slice(-history.days)) : []), [data, series, history.days]);
  const weeklyRows = useMemo(() => (data ? buildRows(data.weekly.slice(-history.weeks), 'This Week') : []), [data, series, history.weeks]);
  const monthlyRows = useMemo(() => (data ? buildRows(data.monthly.slice(-history.months), 'This Month') : []), [data, series, history.months]);

  if (loading && !data) return <div className="loading-state">Loading charts…</div>;
  if (!data) return <div className="empty-state"><h3>No chart data</h3></div>;

  const names = series.map(s => s.name).join(' vs ');
  const categoryData = topCategories(data.by_category || {});
  const categoryKeys = Object.keys(categoryData);
  const categoryColor = (k: string) =>
    k === 'Others' || k === 'Uncategorized' ? '#94a3b8' : CATEGORY_PALETTE[categoryKeys.indexOf(k) % CATEGORY_PALETTE.length];
  const weekdayRows = WEEKDAYS.map((d, idx) => ({ day: d, count: data.weekday[idx] }));
  const maxWeekday = Math.max(...data.weekday);
  const windowLabel = `last ${history.weeks} wks`;
  const multi = series.length > 1;
  const tooltipStyle = { fontSize: 12, padding: '6px 8px' };

  const renderBarsSection = (rows: any[], title: string) => (
    <div className="trend-chart-block">
      <h3>{names} — {title}</h3>
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={rows} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" interval={0} tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} domain={[0, "auto"]} allowDataOverflow tick={{ fontSize: 10 }} label={{ value: 'Tasks completed', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [Math.round(v * 10) / 10, n]} />
          {multi && <Legend wrapperStyle={{ fontSize: 10 }} />}
          {series.flatMap(s => {
            const first = rows.length ? rows[0][s.trendKey] : 0;
            const last = rows.length ? rows[rows.length - 1][s.trendKey] : 0;
            const delta = last - first;
            const label = rows.length > 1 ? `(${delta >= 0 ? '+' : ''}${delta.toFixed(1)})` : undefined;
            return [
              <Bar key={`b-${s.dataKey}`} dataKey={s.dataKey} name={s.name} fill={s.color} radius={[6, 6, 0, 0]} isAnimationActive={false}
                label={{ position: 'top', fontSize: 11, fontWeight: 600, formatter: (v: number) => (v > 0 ? v : '') }} />,
              <Line key={`l-${s.trendKey}`} type="monotone" dataKey={s.trendKey} name={`${s.name} trend`} stroke={s.color} strokeWidth={2}
                dot={arrowDot(rows.length, s.trendKey, s.color, label)} activeDot={false} legendType="none" isAnimationActive={false} />,
            ];
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="charts-panel">
      <div className="coach-msg">{coachMessage(data)}</div>

      <div className="trend-section">
        <div className="trend-toggles">
          {([['day', 'Day-over-Day'], ['week', 'Week-over-Week'], ['month', 'Month-over-Month']] as [keyof TrendToggles, string][]).map(([k, label]) => (
            <button key={k} className={`toggle-month-btn${toggles[k] ? ' active' : ''}`} onClick={() => onToggle(k)}>
              {toggles[k] ? '✓' : '✗'} {label}
            </button>
          ))}
          {loading && <span className="trend-loading">⏳ Loading trend data…</span>}
        </div>

        {!toggles.day && !toggles.week && !toggles.month && (
          <div className="chart-empty">Turn on Day-, Week- or Month-over to see a trend chart.</div>
        )}

        {toggles.day && (
          <div className="trend-chart-block">
            <h3>{names} — Daily Tasks Completed ({dailyRows.length} Days)</h3>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={dailyRows} margin={{ top: 20, right: 30, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" angle={-45} textAnchor="end" height={40} tick={{ fontSize: 10 }} interval={Math.max(0, Math.ceil(dailyRows.length / 20) - 1)} />
                <YAxis allowDecimals={false} domain={[0, "auto"]} allowDataOverflow tick={{ fontSize: 10 }} label={{ value: 'Tasks completed', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                <Tooltip contentStyle={tooltipStyle} />
                {multi && <Legend wrapperStyle={{ fontSize: 10 }} />}
                {series.map(s => (
                  <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name} stroke={s.color} strokeWidth={2}
                    dot={{ r: dailyRows.length > 60 ? 1.5 : 3 }} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {toggles.week && renderBarsSection(weeklyRows, `Weekly Tasks Completed (${weeklyRows.length} Weeks)`)}
        {toggles.month && renderBarsSection(monthlyRows, `Monthly Tasks Completed (${monthlyRows.length} Months)`)}
      </div>

      <div className="charts-row">
        <Donut title={`By task type · ${windowLabel}`} data={data.by_type} colorFor={typeColor} labelFor={typeLabel} onSelect={onTypeSelect} />
        <Donut title={`By pillar · ${windowLabel}`} data={data.by_pillar} colorFor={k => PILLAR_COLORS[k] || '#94a3b8'} labelFor={k => k} />
        <Donut title={`By category · ${windowLabel}`} data={categoryData} colorFor={categoryColor} labelFor={k => k} />
      </div>

      <div className="charts-row charts-row-2">
        <div className="chart-card">
          <div className="chart-title">Best weekdays · {windowLabel}</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={weekdayRows} margin={{ top: 6, right: 4, left: -26, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, padding: '4px 8px' }} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="count" name="Completed" isAnimationActive={false} radius={[3, 3, 0, 0]}>
                {weekdayRows.map(r => <Cell key={r.day} fill={r.count === maxWeekday && maxWeekday > 0 ? '#16a34a' : '#a5b4fc'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <div className="chart-title">Consistency map · last 12 weeks <span className="chart-sub">darker = more completions</span></div>
          <Heatmap daily={data.daily.slice(-84)} />
        </div>
      </div>
    </div>
  );
}
