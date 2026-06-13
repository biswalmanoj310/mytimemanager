import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import apiClient from '../services/api';
import { formatDateForInput, getWeekStart } from '../utils/dateHelpers';

// ─── Types ────────────────────────────────────────────────────────
type Period   = 'day' | 'week' | 'month' | 'year';
type ViewType = 'pillar' | 'category' | 'task' | 'one_time';
type Display  = 'time' | 'percent';

interface DistItem { name: string; minutes: number; color: string; pillar?: string; category?: string; }

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

// ─── Component ────────────────────────────────────────────────────
export default function TimeDistributionChart() {
  const today = formatDateForInput(new Date());

  const [period,   setPeriod]   = useState<Period>('week');
  const [offset,   setOffset]   = useState(0);
  const [viewType, setViewType] = useState<ViewType>('category');
  const [display,  setDisplay]  = useState<Display>('time');
  const [data,     setData]     = useState<DistItem[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Reset offset when period changes
  useEffect(() => { setOffset(0); }, [period]);

  // Compute date range + navigation label
  const { start, end, navLabel } = useMemo(() => {
    const base = new Date(today + 'T00:00:00');

    if (period === 'day') {
      const d = new Date(base); d.setDate(d.getDate() + offset);
      const ds = formatDateForInput(d);
      const lbl = offset === 0 ? 'Today' : offset === -1 ? 'Yesterday'
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return { start: ds, end: ds, navLabel: lbl };
    }

    if (period === 'week') {
      const ws = getWeekStart(base); ws.setDate(ws.getDate() + offset * 7);
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      const cap = we > base ? base : we;
      const lbl = offset === 0 ? 'This Week' : offset === -1 ? 'Last Week'
        : `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      return { start: formatDateForInput(ws), end: formatDateForInput(cap), navLabel: lbl };
    }

    if (period === 'month') {
      const ms = new Date(base.getFullYear(), base.getMonth() + offset, 1);
      const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0);
      const cap = me > base ? base : me;
      return {
        start: formatDateForInput(ms), end: formatDateForInput(cap),
        navLabel: ms.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      };
    }

    // year
    const yr = base.getFullYear() + offset;
    const ys = new Date(yr, 0, 1);
    const ye = new Date(yr, 11, 31);
    const cap = ye > base ? base : ye;
    return { start: formatDateForInput(ys), end: formatDateForInput(cap), navLabel: String(yr) };
  }, [period, offset, today]);

  // Fetch data whenever date range or view type changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        let items: DistItem[] = [];

        if (viewType === 'pillar') {
          const res = await apiClient.get(`/api/analytics/pillar-distribution?start_date=${start}&end_date=${end}`);
          items = (res.data.pillars || [])
            .filter((p: any) => p.spent_hours > 0)
            .map((p: any) => ({
              name: p.pillar_name,
              minutes: Math.round(p.spent_hours * 60),
              color: getPillarColor(p.pillar_name),
            }));

        } else if (viewType === 'category') {
          const res = await apiClient.get(`/api/analytics/category-breakdown?start_date=${start}&end_date=${end}`);
          items = (res.data.categories || [])
            .filter((c: any) => c.spent_hours > 0)
            .map((c: any) => ({
              name: c.category_name,
              minutes: Math.round(c.spent_hours * 60),
              color: getCatColor(c.category_name),
            }));

        } else {
          // task or one_time
          const [tasksRes, entriesRes] = await Promise.all([
            apiClient.get('/api/tasks?limit=1000&is_active=true'),
            apiClient.get(`/api/daily-time?start_date=${start}&end_date=${end}`),
          ]);
          const allTasks: any[] = tasksRes.data || [];
          const entries: any[] = entriesRes.data || [];

          const filtered = allTasks.filter((t: any) => {
            if (t.task_type?.toUpperCase() !== 'TIME') return false;
            if (!t.is_active) return false;
            if (viewType === 'one_time') return t.is_daily_one_time === true;
            return t.follow_up_frequency === 'daily' && !t.is_daily_one_time;
          });

          const taskSet = new Set(filtered.map((t: any) => t.id));
          const spentMap = new Map<number, number>();
          entries.forEach((e: any) => {
            if (taskSet.has(e.task_id))
              spentMap.set(e.task_id, (spentMap.get(e.task_id) || 0) + e.minutes);
          });

          items = filtered
            .filter((t: any) => (spentMap.get(t.id) || 0) > 0)
            .map((t: any, i: number) => ({
              name: t.name,
              minutes: spentMap.get(t.id) || 0,
              color: (isDeepRed(t.name) || isDeepRed(t.category_name || ''))
                ? '#dc2626'
                : getCatColor(t.category_name || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]),
              pillar:   t.pillar_name   || '',
              category: t.category_name || '',
            }));
        }

        // Sort to match Daily tab hierarchy
        let sorted: DistItem[];
        if (viewType === 'pillar') {
          sorted = items.sort((a, b) => {
            const pa = PILLAR_ORDER.indexOf(a.name);
            const pb = PILLAR_ORDER.indexOf(b.name);
            return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
          });
        } else if (viewType === 'category') {
          sorted = items.sort((a, b) => {
            const ca = CATEGORY_ORDER.indexOf(a.name);
            const cb = CATEGORY_ORDER.indexOf(b.name);
            return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
          });
        } else {
          // task / one_time: pillar → category → name
          sorted = items.sort((a, b) => {
            const pa = PILLAR_ORDER.indexOf(a.pillar || '');
            const pb = PILLAR_ORDER.indexOf(b.pillar || '');
            if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
            const ca = CATEGORY_ORDER.indexOf(a.category || '');
            const cb = CATEGORY_ORDER.indexOf(b.category || '');
            return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
          });
        }
        if (!cancelled) setData(sorted);
      } catch (err) {
        console.error('TimeDistributionChart error', err);
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [start, end, viewType]);

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
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className="time-dist-empty">Loading...</div>
      ) : data.length === 0 ? (
        <div className="time-dist-empty">No time tracked for this period.</div>
      ) : (
        <div className="time-dist-body">
          {/* Donut chart */}
          <div className="time-dist-chart-wrap">
            <PieChart width={460} height={340}>
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

          {/* Legend panel */}
          <div className="time-dist-legend-panel">
            {data.map((item, i) => {
              const pct = totalMins > 0 ? Math.round((item.minutes / totalMins) * 100) : 0;
              return (
                <div key={i} className="time-dist-legend-row">
                  <div className="time-dist-legend-left">
                    <span className="time-dist-legend-dot" style={{ background: item.color }} />
                    <span className="time-dist-legend-name">{item.name}</span>
                  </div>
                  <div className="time-dist-legend-meta">
                    {display === 'time'
                      ? <><strong>{fmtShort(item.minutes)}</strong> · {pct}%</>
                      : <strong>{pct}%</strong>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
