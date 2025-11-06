# Styling Restoration Plan for Extracted Pages

## Problem
Weekly, Monthly, and Yearly tabs have data but lack color formatting and visual styling from original implementation.

## Root Cause
Extracted pages use simplified `TimeEntryGrid` component that doesn't include:
1. Row-level color coding (green for on-track, red for below target)
2. Cell-level color coding (per-day achievement status)
3. Task type section headers (Time/Count/Boolean grouping)
4. Completed/NA row styling (green/gray backgrounds)
5. Sticky column styling for better UX

## Solution
Replace simplified TimeEntryGrid renders with full table implementations from original Tasks.tsx, including:

### 1. Color Logic Functions (✅ ADDED to taskHelpers.ts)
- `getWeeklyRowColorClass()` - Row colors based on weekly progress
- `getMonthlyRowColorClass()` - Row colors based on monthly progress
- `getYearlyRowColorClass()` - Row colors based on yearly progress
- `getWeeklyCellColorClass()` - Per-day cell colors for weekly view
- `getMonthlyCellColorClass()` - Per-day cell colors for monthly view

### 2. Weekly Tasks Page Updates Needed
**File:** `frontend/src/pages/WeeklyTasks.tsx`

**Changes:**
1. Add section headers for task types (Time/Count/Boolean)
2. Replace TimeEntryGrid with full table render
3. Add row color classes using `getWeeklyRowColorClass()`
4. Add cell color classes using `getWeeklyCellColorClass()`
5. Apply completed/NA background colors
6. Add sticky columns for better scrolling

**Key Elements:**
```tsx
// Section header for each task type
<tr className="task-type-section-header">
  <td colSpan={11} className="section-header-cell time-based">
    <span>⏱️</span> Time-Based Tasks (X tasks)
  </td>
</tr>

// Row with colors
<tr className={`${rowClassName} ${colorClass}`}
    style={bgColor ? { backgroundColor: bgColor } : undefined}>
  
  // Sticky columns with color classes
  <td className={`col-task sticky-col sticky-col-1 ${colorClass}`}>
    {task.name}
  </td>
  
  // Daily columns with cell colors
  {weekDays.map(day => {
    const cellColor = getWeeklyCellColorClass(task, value, day.date);
    return <td className={`col-hour ${cellColor}`}>...</td>;
  })}
</tr>
```

### 3. Monthly Tasks Page Updates Needed
**File:** `frontend/src/pages/MonthlyTasks.tsx`

**Same pattern as Weekly:**
- Task type sections
- Full table with ~31 columns (days in month)
- Row colors using `getMonthlyRowColorClass()`
- Cell colors using `getMonthlyCellColorClass()`
- Sticky columns (4 columns: Task, Allocated, Spent, Remaining)

### 4. Yearly Tasks Page Updates Needed
**File:** `frontend/src/pages/YearlyTasks.tsx`

**Same pattern:**
- Task type sections
- Full table with 12 month columns
- Row colors using `getYearlyRowColorClass()`
- Sticky columns (4 columns: Task, Allocated, Spent, Remaining)

### 5. Important (Today) Tab
**Note:** This tab is NOT in extracted pages - still in main Tasks.tsx
**Status:** Already has proper styling, no changes needed

## CSS Classes Referenced
From `frontend/src/styles/Tasks.css`:

### Row-level colors:
- `weekly-on-track` - Green background (meeting target)
- `weekly-below-target` - Light red background (below target)
- `completed-row` - Green background (#c6f6d5)
- `na-row` - Gray background (#e2e8f0)

### Cell-level colors:
- `cell-achieved` - Green cell (met daily target)
- `cell-below-target` - Red cell (missed daily target)

### Task type sections:
- `task-type-section-header` - Section divider
- `time-based` - Time tasks section
- `count-based` - Count tasks section  
- `boolean-based` - Yes/No tasks section

### Sticky columns:
- `sticky-col` - Base sticky column class
- `sticky-col-1` - Task name column
- `sticky-col-2` - Allocated column
- `sticky-col-3` - Spent column
- `sticky-col-4` - Remaining column

## Implementation Order
1. ✅ Add color functions to taskHelpers.ts
2. ⏳ Update WeeklyTasks.tsx with full table render
3. ⏳ Update MonthlyTasks.tsx with full table render
4. ⏳ Update YearlyTasks.tsx with full table render
5. ⏳ Test all pages with user
6. ✅ Remove dead code from Tasks.tsx after validation

## Reference Implementation
See Tasks.tsx lines 8000-8900 for complete weekly/monthly/yearly table rendering with all styling.

## Testing Checklist
- [ ] Weekly tab shows green rows for on-track tasks
- [ ] Weekly tab shows red rows for below-target tasks
- [ ] Weekly tab shows green/red cells for individual days
- [ ] Completed tasks show green background
- [ ] NA tasks show gray background
- [ ] Task type sections (Time/Count/Boolean) display correctly
- [ ] Sticky columns work when scrolling horizontally
- [ ] Monthly tab has same styling patterns
- [ ] Yearly tab has same styling patterns
- [ ] Colors update when data changes
