#!/usr/bin/env python3
"""Add pillar filter to Important Tasks tab"""

filepath = 'frontend/src/pages/ImportantTasks.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# Add pillar filter state after filterStatus
old_state = "  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'gray' | 'red'>('all');"
new_state = """  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'gray' | 'red'>('all');
  const [filterPillar, setFilterPillar] = useState<string | null>(null);"""

content = content.replace(old_state, new_state)

# Update getFilteredTasks to include pillar filtering
old_filter = """  const getFilteredTasks = (): ImportantTask[] => {
    let filtered = tasks.filter(t => !t.parent_id);
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }
    
    return filtered;
  };"""

new_filter = """  const getFilteredTasks = (): ImportantTask[] => {
    let filtered = tasks.filter(t => !t.parent_id);
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }
    
    if (filterPillar) {
      filtered = filtered.filter(task => task.pillar_name === filterPillar);
    }
    
    return filtered;
  };"""

content = content.replace(old_filter, new_filter)

# Add pillar filter tabs after summary metrics
old_metrics_end = """      </div>

      {/* Tasks Table */}"""

new_metrics_with_filters = """      </div>

      {/* Pillar Filter Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        padding: '10px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <button
          onClick={() => setFilterPillar(null)}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: filterPillar === null ? '#3b82f6' : 'white',
            color: filterPillar === null ? 'white' : '#1a202c',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          All Pillars
        </button>
        <button
          onClick={() => setFilterPillar('Hard Work')}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: filterPillar === 'Hard Work' ? '#2563eb' : 'white',
            color: filterPillar === 'Hard Work' ? 'white' : '#1a202c',
            border: '2px solid #3b82f6',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          💼 Hard Work
        </button>
        <button
          onClick={() => setFilterPillar('Calmness')}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: filterPillar === 'Calmness' ? '#16a34a' : 'white',
            color: filterPillar === 'Calmness' ? 'white' : '#1a202c',
            border: '2px solid #22c55e',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          🧘 Calmness
        </button>
        <button
          onClick={() => setFilterPillar('Family')}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: filterPillar === 'Family' ? '#9333ea' : 'white',
            color: filterPillar === 'Family' ? 'white' : '#1a202c',
            border: '2px solid #a855f7',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          👨‍👩‍👦 Family
        </button>
      </div>

      {/* Tasks Table */}"""

content = content.replace(old_metrics_end, new_metrics_with_filters)

# Write back
with open(filepath, 'w') as f:
    f.write(content)

print("✓ Added pillar filter to Important Tasks!")
print(f"File length: {len(content)} bytes")
