/**
 * TimeDistributionMini
 * A compact donut chart for a fixed date range (start/end).
 * Used by Dashboard Circle of Life section — 4 per row, latest highlighted.
 */
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import apiClient from '../services/api';

// ─── Types ────────────────────────────────────────────────────────
export type MiniViewType = 'category' | 'pillar';
interface DistItem { name: string; minutes: number; color: string; }

// ─── Daily tab hierarchy order ────────────────────────────────────
const PILLAR_ORDER   = ['Hard Work', 'Calmness', 'Family'];
const CATEGORY_ORDER = ['Office-Tasks', 'Learning', 'Confidence', 'Yoga', 'Sleep', 'My Tasks', 'Home Tasks', 'Time Waste', 'Screen Time'];

// ─── Colors ───────────────────────────────────────────────────────
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

function fmtShort(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Props ────────────────────────────────────────────────────────
interface Props {
  start: string;
  end: string;
  label: string;
  isNewest: boolean;
  accentColor: string;
  viewType: MiniViewType;
}

export default function TimeDistributionMini({ start, end, label, isNewest, accentColor, viewType }: Props) {
  const [data, setData]       = useState<DistItem[]>([]);
  const [loading, setLoading] = useState(true);

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
            }))
            .sort((a: DistItem, b: DistItem) => {
              const pa = PILLAR_ORDER.indexOf(a.name);
              const pb = PILLAR_ORDER.indexOf(b.name);
              return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
            });
        } else {
          const res = await apiClient.get(`/api/analytics/category-breakdown?start_date=${start}&end_date=${end}`);
          items = (res.data.categories || [])
            .filter((c: any) => c.spent_hours > 0)
            .map((c: any) => ({
              name: c.category_name,
              minutes: Math.round(c.spent_hours * 60),
              color: getCatColor(c.category_name),
            }))
            .sort((a: DistItem, b: DistItem) => {
              const ca = CATEGORY_ORDER.indexOf(a.name);
              const cb = CATEGORY_ORDER.indexOf(b.name);
              return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
            });
        }

        if (!cancelled) setData(items);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [start, end, viewType]);

  const totalMins = data.reduce((s, d) => s + d.minutes, 0);
  const totalH    = Math.floor(totalMins / 60);
  const totalM    = totalMins % 60;

  const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: isNewest
      ? `0 0 0 2px ${accentColor}, 0 4px 12px rgba(0,0,0,0.1)`
      : '0 2px 8px rgba(0,0,0,0.07)',
    border: isNewest ? `2px solid ${accentColor}` : '1px solid #e5e7eb',
    flex: '1',
    minWidth: '180px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  return (
    <div style={cardStyle}>
      {/* Period label */}
      <div style={{
        width: '100%',
        fontSize: '13px',
        fontWeight: '700',
        color: isNewest ? accentColor : '#374151',
        marginBottom: '6px',
      }}>
        {isNewest && '★ '}{label}
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', color: '#94a3b8', fontSize: '12px' }}>Loading…</div>
      ) : data.length === 0 ? (
        <div style={{ padding: '40px 0', color: '#94a3b8', fontSize: '12px' }}>No data</div>
      ) : (
        <>
          {/* Donut */}
          <div style={{ position: 'relative' }}>
            <PieChart width={180} height={180}>
              <Pie
                data={data}
                cx={90}
                cy={90}
                startAngle={90}
                endAngle={-270}
                innerRadius={52}
                outerRadius={78}
                paddingAngle={2}
                dataKey="minutes"
                isAnimationActive={false}
              >
                {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              {/* Center text */}
              <text x={90} y={84} textAnchor="middle" fill="#dc2626" fontSize={20} fontWeight={800}>
                {totalH}<tspan fontSize={11} fontWeight={600}>h</tspan>
              </text>
              <text x={90} y={103} textAnchor="middle" fill="#dc2626" fontSize={14} fontWeight={700}>
                {totalM}<tspan fontSize={9} fontWeight={500}>m</tspan>
              </text>
              <Tooltip
                formatter={(value: any, name: string) => {
                  const pct = totalMins > 0 ? Math.round((value / totalMins) * 100) : 0;
                  return [`${fmtShort(value)} · ${pct}%`, name];
                }}
              />
            </PieChart>
          </div>

          {/* Legend */}
          <div style={{ width: '100%', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {data.map((item, i) => {
              const pct = totalMins > 0 ? Math.round((item.minutes / totalMins) * 100) : 0;
              if (pct < 1) return null;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color, flexShrink: 0 }} />
                    <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }}>{item.name}</span>
                  </div>
                  <span style={{ color: '#6b7280', flexShrink: 0, marginLeft: '4px' }}>
                    <strong style={{ color: '#1e293b' }}>{fmtShort(item.minutes)}</strong> · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
