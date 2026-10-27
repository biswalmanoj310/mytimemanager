export interface SelectorOption<K extends string | number> {
  key: K;
  label: string;
  /** Active-chip colour; falls back to `accent` */
  color?: string;
}

interface Props<K extends string | number> {
  title: string;
  options: SelectorOption<K>[];
  selected: K[];
  onChange: (next: K[]) => void;
  /** Omit for no limit */
  max?: number;
  noun?: string;
  accent?: string;
  expanded: boolean;
  onToggleExpanded: () => void;
}

/** Collapsible chip picker shared by Detailed Trend Analysis and Time Distribution. */
export default function EntitySelector<K extends string | number>({
  title, options, selected, onChange, max, noun = 'items', accent = '#4299e1', expanded, onToggleExpanded,
}: Props<K>) {
  const atMax = max !== undefined && selected.length >= max;

  return (
    <div style={{ marginBottom: '10px', padding: '10px', background: '#f7fafc', borderRadius: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: expanded ? '6px' : 0 }}>
        <label
          onClick={onToggleExpanded}
          style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}
        >
          {title}{!expanded && selected.length > 0 ? ` — ${selected.length} selected` : ''}
          <span style={{ fontSize: '10px', transition: 'transform 0.15s', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
        </label>
        {expanded && selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            style={{ fontSize: '11px', padding: '2px 8px', border: '1px solid #cbd5e0', borderRadius: '999px', background: 'white', cursor: 'pointer' }}
          >Clear</button>
        )}
      </div>
      {expanded && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {options.map(opt => {
            const isOn = selected.includes(opt.key);
            return (
              <label key={opt.key} style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 8px',
                fontSize: '11px',
                background: isOn ? (opt.color || accent) : 'white',
                color: isOn ? 'white' : '#2d3748',
                borderRadius: '999px',
                cursor: !isOn && atMax ? 'not-allowed' : 'pointer',
                border: '1px solid #cbd5e0',
              }}>
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={(e) => {
                    if (e.target.checked && !atMax) onChange([...selected, opt.key]);
                    else if (!e.target.checked) onChange(selected.filter(k => k !== opt.key));
                  }}
                  disabled={!isOn && atMax}
                  style={{ marginRight: '5px' }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      )}
      {expanded && atMax && (
        <p style={{ marginTop: '6px', color: '#ed8936', fontSize: '11px' }}>
          Maximum of {max} {noun} selected. Uncheck one to select another.
        </p>
      )}
    </div>
  );
}
