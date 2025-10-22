# Daily Time Tracking Implementation Summary

## Backend Implementation - COMPLETED ✅

### 1. Database Tables Created
- `daily_time_entries` - Stores hourly time for each task, each day
- `daily_summary` - Tracks daily completion status

### 2. API Endpoints Created (`/api/daily-time/`)
- `GET /entries/{date}` - Get all entries for a date
- `POST /entries/` - Save single entry
- `POST /entries/bulk/` - Bulk save entries for a date
- `GET /summary/{date}` - Get summary for a date
- `GET /incomplete-days/` - Get list of incomplete days
- `PUT /summary/{date}/recalculate` - Recalculate summary

## Frontend Changes Needed

### 1. Update Tasks.tsx to Add:
- **Date selector** for Daily tab (default: today)
- **Load entries** from `/api/daily-time/entries/{date}` on mount/date change
- **Auto-save** to `/api/daily-time/entries/bulk/` when user enters time
- **Show incomplete days** at bottom with links

### 2. Key Frontend Changes:

```typescript
// Add these states
const [selectedDate, setSelectedDate] = useState<Date>(new Date());
const [incompleteDays, setIncompleteDays] = useState<any[]>([]);

// Load daily entries from backend
const loadDailyEntries = async (date: Date) => {
  const dateStr = date.toISOString().split('T')[0];
  const entries = await api.get(`/api/daily-time/entries/${dateStr}`);
  // Convert to hourlyEntries format
  const entriesMap: Record<string, number> = {};
  entries.forEach((entry: any) => {
    entriesMap[`${entry.task_id}-${entry.hour}`] = entry.minutes;
  });
  setHourlyEntries(entriesMap);
};

// Save to backend (debounced)
const saveDailyEntries = async () => {
  const dateStr = selectedDate.toISOString().split('T')[0];
  const entries = Object.entries(hourlyEntries).map(([key, minutes]) => {
    const [task_id, hour] = key.split('-').map(Number);
    return { task_id, hour, minutes };
  });
  await api.post('/api/daily-time/entries/bulk/', { 
    entry_date: dateStr, 
    entries 
  });
};

// Load incomplete days
const loadIncompleteDays = async () => {
  const days = await api.get('/api/daily-time/incomplete-days/');
  setIncompleteDays(days);
};
```

### 3. UI Changes for Daily Tab:

1. **Add Date Picker** at top:
```tsx
<div className="date-selector">
  <button onClick={() => changeDate(-1)}>← Previous</button>
  <input 
    type="date" 
    value={selectedDate.toISOString().split('T')[0]}
    onChange={(e) => setSelectedDate(new Date(e.target.value))}
  />
  <button onClick={() => changeDate(1)}>Next →</button>
  <button onClick={() => setSelectedDate(new Date())}>Today</button>
</div>
```

2. **Show incomplete days** at bottom:
```tsx
{incompleteDays.length > 0 && (
  <div className="incomplete-days-alert">
    <h3>⚠️ Incomplete Days</h3>
    <p>These days need attention (Allocated ≠ Spent):</p>
    <ul>
      {incompleteDays.map(day => (
        <li key={day.entry_date}>
          <a 
            href="#" 
            onClick={() => openDayInNewTab(day.entry_date)}
          >
            {formatDate(day.entry_date)} - 
            Missing {day.difference} minutes
          </a>
        </li>
      ))}
    </ul>
  </div>
)}
```

3. **Auto-save on input change**:
```typescript
const handleHourlyTimeChange = (taskId: number, hour: number, value: string) => {
  const minutes = parseInt(value) || 0;
  const key = `${taskId}-${hour}`;
  setHourlyEntries(prev => ({
    ...prev,
    [key]: minutes
  }));
  
  // Debounced save (use setTimeout or debounce library)
  debouncedSave();
};
```

## Testing the Backend

Test with curl:
```bash
# Save entries for today
curl -X POST "http://localhost:8000/api/daily-time/entries/bulk/" \
  -H "Content-Type: application/json" \
  -d '{
    "entry_date": "2025-10-22",
    "entries": [
      {"task_id": 5, "hour": 8, "minutes": 30},
      {"task_id": 5, "hour": 9, "minutes": 30}
    ]
  }'

# Get incomplete days
curl "http://localhost:8000/api/daily-time/incomplete-days/"

# Get summary for a date
curl "http://localhost:8000/api/daily-time/summary/2025-10-22"
```

## Next Steps

1. Add date picker component to Daily tab
2. Implement load/save functions with API
3. Add incomplete days section at bottom
4. Add "Open in new tab" functionality
5. Style the new components

Would you like me to implement the complete frontend changes now?
