import { useState, useEffect, useMemo, useRef } from 'react';
import apiClient from '../services/api';
import { formatDateForInput } from '../utils/dateHelpers';

// ─── Types ────────────────────────────────────────────────────────
interface HourlyEntry {
  task_id: number;
  hour: number;
  minutes: number;
  entry_date: string;
}

interface TaskInfo {
  id: number;
  name: string;
  pillar_name: string;
  category_name: string;
  allocated_minutes: number;
}

type ViewMode = 'pillar' | 'category' | 'task';

// ─── Daily tab hierarchy order (for legend / task sorting) ──────
const PILLAR_ORDER   = ['Hard Work', 'Calmness', 'Family'];
const CATEGORY_ORDER = ['Office-Tasks', 'Learning', 'Confidence', 'Yoga', 'Sleep', 'My Tasks', 'Home Tasks', 'Time Waste'];

// ─── Color palettes ───────────────────────────────────────────────
// Hard Work / Office-Tasks → green family
// Time Waste / Screen* / Relaxing* → deep red
const CATEGORY_COLORS: Record<string, string> = {
  'Office-Tasks': '#16a34a', // green  (Hard Work)
  'Learning':     '#eab308', // yellow
  'Confidence':   '#f97316', // orange
  'Yoga':         '#4ade80', // light green (distinct from Office-Tasks dark green)
  'Sleep':        '#a3e635', // lime green (same as Calmness pillar)
  'My Tasks':     '#f59e0b', // amber
  'Home Tasks':   '#8b5cf6', // purple (same as Family pillar)
  'Time Waste':   '#dc2626', // deep red
  'Screen Time':  '#dc2626', // deep red
};

const PILLAR_COLORS: Record<string, string> = {
  'Hard Work': '#16a34a', // green
  'Calmness':  '#a3e635', // lime green (same as Sleep)
  'Family':    '#8b5cf6', // purple (same as Home Tasks)
};

// Per-task palette (used in Task mode) — for non-Hard-Work, non-Family tasks
const TASK_PALETTE = [
  '#eab308','#06b6d4','#f59e0b', // Learning(yellow) / Confidence / My Tasks
  '#10b981','#6366f1','#84cc16', // Yoga / Sleep / other
  '#f97316','#ec4899','#0ea5e9', // extras
  '#14b8a6','#a855f7','#eab308','#7c3aed',
  '#d946ef','#fb923c','#64748b',
];

function isDeepRed(name: string) {
  const l = name.toLowerCase();
  return l.includes('waste') || l.includes('screen') || l.includes('relaxing');
}

function getCategoryColor(cat: string) {
  if (!cat) return '#94a3b8';
  if (isDeepRed(cat)) return '#dc2626';
  // Hard Work categories → green shades
  if (cat === 'Office-Tasks') return '#16a34a';
  return CATEGORY_COLORS[cat] || '#64748b';
}
function getPillarColor(p: string) { return PILLAR_COLORS[p] || '#64748b'; }

// ─── Helpers ──────────────────────────────────────────────────────
function formatHour(h: number) {
  if (h === 0)  return '12am';
  if (h < 12)   return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

function formatDateLabel(dateStr: string, today: string) {
  const diff = Math.round(
    (new Date(today + 'T00:00:00').getTime() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000
  );
  const d = new Date(dateStr + 'T00:00:00');
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue...
  if (diff === 0) return { main: 'Today',     day: dayName };
  if (diff === 1) return { main: 'Yesterday', day: dayName };
  return { main: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), day: dayName };
}

function fmtMins(m: number) {
  if (m >= 60) return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
  return `${m}m`;
}

// Column definitions — first column groups 12am-5am exactly like the Daily tab
type HourColumn = { key: string; label: string; hours: number[] };

function fmtColHour(h: number) {
  if (h === 0)  return '12AM';
  if (h < 12)   return `${h}AM`;
  if (h === 12) return '12PM';
  return `${h - 12}PM`;
}

const HOUR_COLUMNS: HourColumn[] = [
  { key: 'early', label: `12AM\n5AM`, hours: [0, 1, 2, 3, 4] },
  ...Array.from({ length: 19 }, (_, i) => {
    const start = i + 5;
    const end   = i + 6;
    return {
      key:   String(start),
      label: `${fmtColHour(start)}\n${fmtColHour(end)}`,
      hours: [start],
    };
  }),
];

// Segment sort priority within a cell: Work first → other → Waste → Sleep last
const SEGMENT_PRIORITY: Record<string, number> = {
  'Office-Tasks': 0,
  'Learning':     1,
  'Confidence':   2,
  'Yoga':         3,
  'My Tasks':     4,
  'Home Tasks':   5,
  'Time Waste':   8,
  'Screen Time':  8,
  'Sleep':        9,
};

// ─── Component ────────────────────────────────────────────────────
export default function HourlyTaskTimeline() {
  const today = formatDateForInput(new Date());

  const [viewMode, setViewMode] = useState<ViewMode>('task');
  const [tasks,    setTasks]    = useState<TaskInfo[]>([]);
  const [entries,  setEntries]  = useState<HourlyEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [days,     setDays]     = useState(14);

  const [tooltip, setTooltip] = useState<{
    x: number; y: number; above: boolean;
    dateStr: string; hourLabel: string;
    items: { name: string; color: string; minutes: number }[];
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadData(); }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const startD = new Date(today + 'T00:00:00');
      startD.setDate(startD.getDate() - (days - 1));
      const startDate = formatDateForInput(startD);

      const [tasksRes, entriesRes] = await Promise.all([
        apiClient.get('/api/tasks?limit=1000&is_active=true'),
        apiClient.get(`/api/daily-time?start_date=${startDate}&end_date=${today}`),
      ]);

      const timeTasks: TaskInfo[] = (tasksRes.data || [])
        .filter((t: any) =>
          t.follow_up_frequency === 'daily' &&
          t.task_type?.toUpperCase() === 'TIME' &&
          !t.is_daily_one_time &&
          t.is_active
        )
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          pillar_name: t.pillar_name || 'Unknown',
          category_name: t.category_name || 'Uncategorized',
          allocated_minutes: t.allocated_minutes || 0,
        }));

      setTasks(timeTasks);
      setEntries(entriesRes.data || []);
    } catch (err) {
      console.error('HourlyTaskTimeline error', err);
    } finally {
      setLoading(false);
    }
  };

  const taskMap = useMemo(() => {
    const m = new Map<number, TaskInfo>();
    tasks.forEach(t => m.set(t.id, t));
    return m;
  }, [tasks]);

  // Assign task colors by category (so tasks in same category share one color,
  // distinct categories are clearly different). Deep-red and pillar overrides apply.
  const taskColorMap = useMemo(() => {
    const m = new Map<number, string>();
    tasks.forEach((t) => {
      if (isDeepRed(t.name) || isDeepRed(t.category_name)) {
        m.set(t.id, '#dc2626');
      } else {
        // Use the category color — every task inherits its category's colour
        m.set(t.id, getCategoryColor(t.category_name));
      }
    });
    return m;
  }, [tasks]);

  const colorFor = (taskId: number): string => {
    const t = taskMap.get(taskId);
    if (!t) return '#94a3b8';
    if (viewMode === 'pillar')   return getPillarColor(t.pillar_name);
    if (viewMode === 'category') return getCategoryColor(t.category_name);
    // Task mode: use pre-computed category-based color
    return taskColorMap.get(taskId) || getCategoryColor(t.category_name);
  };

  const dateList = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today + 'T00:00:00');
      d.setDate(d.getDate() - i);
      list.push(formatDateForInput(d));
    }
    return list;
  }, [today, days]);

  // entry_date may come as full ISO string or YYYY-MM-DD
  const entryLookup = useMemo(() => {
    const m = new Map<string, Map<number, { task_id: number; minutes: number }[]>>();
    entries.forEach(e => {
      const ds = String(e.entry_date).slice(0, 10);
      if (!m.has(ds)) m.set(ds, new Map());
      const hm = m.get(ds)!;
      if (!hm.has(e.hour)) hm.set(e.hour, []);
      hm.get(e.hour)!.push({ task_id: e.task_id, minutes: e.minutes });
    });
    return m;
  }, [entries]);

  // Legend ordered by Daily-tab hierarchy
  const legendItems = useMemo(() => {
    if (viewMode === 'pillar') {
      return PILLAR_ORDER
        .filter(p => tasks.some(t => t.pillar_name === p))
        .map(p => ({ label: p, color: getPillarColor(p) }));
    }
    if (viewMode === 'category') {
      return CATEGORY_ORDER
        .filter(c => tasks.some(t => t.category_name === c))
        .map(c => ({ label: c, color: getCategoryColor(c) }));
    }
    // Task mode: sort by pillar → category → id (same as Daily tab)
    return [...tasks]
      .sort((a, b) => {
        const pa = PILLAR_ORDER.indexOf(a.pillar_name);
        const pb = PILLAR_ORDER.indexOf(b.pillar_name);
        if (pa !== pb) return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
        const ca = CATEGORY_ORDER.indexOf(a.category_name);
        const cb = CATEGORY_ORDER.indexOf(b.category_name);
        if (ca !== cb) return (ca === -1 ? 999 : ca) - (cb === -1 ? 999 : cb);
        return a.id - b.id;
      })
      .map(t => ({ label: t.name, color: colorFor(t.id) }));
  }, [viewMode, tasks, taskColorMap]);

  const getCellSegs = (dateStr: string, hours: number[]) => {
    // Collect all entries across the given hours
    const items: { task_id: number; minutes: number; hour: number }[] = [];
    hours.forEach(h => {
      (entryLookup.get(dateStr)?.get(h) || []).forEach(e => items.push({ ...e, hour: h }));
    });
    if (items.length === 0) return null;

    const gm = new Map<string, { color: string; minutes: number; priority: number }>();
    items.forEach(({ task_id, minutes }) => {
      const t = taskMap.get(task_id);
      if (!t) return;
      const key = viewMode === 'pillar' ? t.pillar_name
                : viewMode === 'category' ? t.category_name
                : String(task_id);
      const color = colorFor(task_id);
      // Priority: use category order; deep-red items near end, Sleep always last
      const basePriority = SEGMENT_PRIORITY[t.category_name] ??
        (isDeepRed(t.category_name) || isDeepRed(t.name) ? 8 : 4);
      if (!gm.has(key)) gm.set(key, { color, minutes: 0, priority: basePriority });
      gm.get(key)!.minutes += minutes;
    });
    // Sort: Office/Work first → other → Waste → Sleep last
    return Array.from(gm.values()).sort((a, b) => a.priority - b.priority);
  };

  const handleCellEnter = (e: React.MouseEvent<HTMLTableCellElement>, dateStr: string, col: HourColumn) => {
    const allItems: { task_id: number; minutes: number }[] = [];
    col.hours.forEach(h => {
      (entryLookup.get(dateStr)?.get(h) || []).forEach(item => allItems.push(item));
    });
    if (allItems.length === 0) { setTooltip(null); return; }

    const tipItems: { name: string; color: string; minutes: number; priority: number }[] = [];
    allItems.forEach(({ task_id, minutes }) => {
      const t = taskMap.get(task_id);
      if (!t) return;
      const name = viewMode === 'pillar' ? t.pillar_name
                 : viewMode === 'category' ? t.category_name
                 : t.name;
      const color = colorFor(task_id);
      const priority = SEGMENT_PRIORITY[t.category_name] ??
        (isDeepRed(t.category_name) || isDeepRed(t.name) ? 8 : 4);
      const ex = tipItems.find(i => i.name === name);
      if (ex) ex.minutes += minutes; else tipItems.push({ name, color, minutes, priority });
    });
    tipItems.sort((a, b) => a.priority - b.priority);

    const hourLabel = col.key === 'early' ? '12AM–5AM' : col.label.replace('\n', '–');
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < 120;
    setTooltip({ x: rect.left + rect.width / 2, y: above ? rect.top : rect.bottom, above, dateStr, hourLabel, items: tipItems.map(({name,color,minutes}) => ({name,color,minutes})) });
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Loading schedule...</div>;
  }

  return (
    <div className="hourly-timeline-section">
      {/* ── Header ── */}
      <div className="hourly-timeline-header">
        <div>
          <h2>🕐 Daily Hour Schedule</h2>
          <p className="chart-description">What you worked on each hour — hover a block to see details</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            style={{ padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.84rem' }}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={120}>Last 120 days</option>
          </select>
          <div className="hourly-view-toggle">
            {(['pillar', 'category', 'task'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                className={`hourly-toggle-btn ${viewMode === mode ? 'active' : ''}`}
                onClick={() => setViewMode(mode)}
              >
                {mode === 'pillar' ? '🎯 Pillar' : mode === 'category' ? '📂 Category' : '✅ Task'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="hourly-legend">
        {legendItems.map(item => (
          <span key={item.label} className="hourly-legend-item">
            <span className="hourly-legend-dot" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      {/* ── Grid ── */}
      <div className="hourly-timeline-wrapper" onMouseLeave={() => setTooltip(null)}>
        <table className="hourly-timeline-table">
          <thead>
            <tr>
              <th className="hourly-label-col">Date</th>
              {HOUR_COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`hourly-hour-col${col.key === 'early' ? ' hourly-hour-col-early' : ''}`}
                  style={{ whiteSpace: 'pre-line' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dateList.map(dateStr => (
              <tr key={dateStr} className="hourly-row">
                <td className="hourly-date-cell">
                  {formatDateLabel(dateStr, today).main}
                  <span className="hourly-date-day"> {formatDateLabel(dateStr, today).day}</span>
                </td>
                {HOUR_COLUMNS.map(col => {
                  const segs = getCellSegs(dateStr, col.hours);
                  return (
                    <td
                      key={col.key}
                      className={`hourly-cell${segs ? ' hourly-cell-filled' : ''}${col.key === 'early' ? ' hourly-cell-early' : ''}`}
                      onMouseEnter={segs ? e => handleCellEnter(e, dateStr, col) : undefined}
                    >
                      {segs && (
                        <div className="hourly-cell-inner">
                          {segs.map((seg, si) => (
                            <div
                              key={si}
                              className="hourly-seg"
                              style={{ background: seg.color, flex: seg.minutes }}
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div
          ref={tooltipRef}
          className="hourly-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.above ? tooltip.y - 8 : tooltip.y + 8,
            transform: tooltip.above
              ? 'translate(-50%, -100%)'
              : 'translate(-50%, 0)',
          }}
        >
          <div className="hourly-tooltip-header">
            {formatDateLabel(tooltip.dateStr, today).main} ({formatDateLabel(tooltip.dateStr, today).day}) · {tooltip.hourLabel}
          </div>
          {tooltip.items.map((item, i) => (
            <div key={i} className="hourly-tooltip-row">
              <span className="hourly-tooltip-dot" style={{ background: item.color }} />
              <span className="hourly-tooltip-name">{item.name}</span>
              <span className="hourly-tooltip-mins">{fmtMins(item.minutes)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
