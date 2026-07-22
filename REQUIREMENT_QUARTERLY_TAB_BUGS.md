# Requirements: Quarterly Tab Bugs

**Status**: Pending Implementation  
**Priority**: High  
**Reported**: 2026-07-21  
**Page**: `http://localhost:3002/tasks?date=2026-07-21&tab=quarterly`

---

## Bug 1 — Row Color Always Green for Daily Tasks Added to Quarterly View

### Problem Statement

When a daily task is added to the Quarterly tab for monitoring, its row always shows **green** (on-track) regardless of actual progress. The red/yellow/green calculation is incorrect.

### Root Cause

There is a **units mismatch** between `totalSpent` and `expectedTarget`:

| Variable | Basis |
|---|---|
| `totalSpent` (in `renderTaskRow`) | Full monthly aggregate from `yearlyMonthlyAggregates` starting from `effectiveStartMonth` (1st of the month the task was added) |
| `daysElapsed` (in `getQuarterlyRowColorClass`) | Counts from **exact** `created_at` date (e.g., July 21 if added today) |

**Example** (task added July 21, allocated 60 min/day):
- `totalSpent` = July monthly aggregate = 60 min × 21 days = **1,260 min** (full July data)
- `daysElapsed` = July 21 → July 21 = **1 day**
- `expectedTarget` = 60 × 1 = **60 min**
- Result: 1,260 ≥ 60 → `weekly-on-track` → **green** ← always wrong

The monthly aggregate captures data for ALL of July, but the expected target only covers 1 day (since task was added today). This makes every newly-added daily task appear green.

### Files Involved

| File | Location | Issue |
|---|---|---|
| `frontend/src/pages/QuarterlyTasks.tsx` | `renderTaskRow()` ~line 450 | `totalSpent` uses month-boundary start |
| `frontend/src/pages/QuarterlyTasks.tsx` | `getQuarterlyRowColorClass()` ~line 197 | `daysElapsed` uses exact `addedDate` |

### Fix

**Option A (Recommended — Simple)**: In `getQuarterlyRowColorClass`, set `effectiveStart` to the **1st of `effectiveStartMonth`** (not the exact `addedDate`). This aligns `daysElapsed` with the same monthly boundary that `totalSpent` uses.

```typescript
// In getQuarterlyRowColorClass — change effectiveStart computation:
// BEFORE:
const addedAt = addedDate ? new Date(addedDate) : startOfYear;
const effectiveStart = addedAt > startOfYear ? addedAt : startOfYear;

// AFTER: Snap to 1st of the month to match monthly aggregate boundaries
const addedAt = addedDate ? new Date(addedDate) : startOfYear;
const addedMonth = addedAt.getFullYear() === currentYear ? addedAt.getMonth() : 0;
const effectiveStart = new Date(currentYear, Math.max(addedMonth, 0), 1); // 1st of added month
```

**Option B (Accurate but complex)**: Pro-rate the first partial month in `totalSpent`:
```
partialJulyData = julyAggregate × (daysRemaining_in_July_from_addedDate / daysInJuly)
```
Requires daily-level data, which the current aggregate system does not provide.

### Acceptance Criteria

- [ ] Task added to quarterly on July 21 with 60 min/day target: row shows **red** if daily average since July 1 is below 60 min
- [ ] Task consistently meeting or exceeding target: row shows **green**
- [ ] Quarter cell colors (`getQuarterlyCellColorClass`) should be reviewed for the same mismatch

---

## Bug 2 — "Select Daily Task" Dropdown Not Sorted by Daily Tab Order

### Problem Statement

In the **"Add Task to Quarterly View"** modal, all three dropdowns (Daily / Weekly / Monthly tasks) sort tasks **alphabetically by pillar name → task name**. This differs from how tasks appear in the daily tab, which uses the user-defined **hierarchy order** (pillar → category ordering set in preferences) and **task name order**.

The Yearly tab's equivalent modal ("Add Yearly Task") already has this fixed — it uses `hierarchyOrder` and `taskNameOrder` from `useUserPreferencesContext`.

### Screenshot Reference

See attached image: tasks appear sorted by pillar+name alphabetically (e.g., all Calmness tasks together, sorted A-Z by name), instead of the daily tab order.

### Files Involved

| File | Location |
|---|---|
| `frontend/src/pages/Tasks.tsx` | Quarterly modal at ~line 7162 — `dailyTaskSelectQuarterly` select |
| `frontend/src/pages/Tasks.tsx` | Quarterly modal at ~line 7195 — `weeklyTaskSelectQuarterly` select |
| `frontend/src/pages/Tasks.tsx` | Quarterly modal at ~line 7215 — `monthlyTaskSelectQuarterly` select |

**Working reference** (Yearly modal): `frontend/src/pages/Tasks.tsx` ~line 7380 — uses `hierarchyOrder` + `taskNameOrder`.

### Current Sort (Quarterly modal — wrong):
```typescript
.sort((a, b) =>
  (a.pillar_name || '').localeCompare(b.pillar_name || '') ||
  (a.name || '').localeCompare(b.name || '')
)
```

### Fix — Apply the same sort as the Yearly modal:
```typescript
.sort((a, b) => {
  const keyA = `${a.pillar_name || ''}|${a.category_name || ''}`;
  const keyB = `${b.pillar_name || ''}|${b.category_name || ''}`;
  const orderA = hierarchyOrder[keyA] || 999;
  const orderB = hierarchyOrder[keyB] || 999;
  if (orderA !== orderB) return orderA - orderB;
  const taskOrderA = taskNameOrder[a.name || ''] || 999;
  const taskOrderB = taskNameOrder[b.name || ''] || 999;
  if (taskOrderA !== taskOrderB) return taskOrderA - taskOrderB;
  return (a.name || '').localeCompare(b.name || '');
})
```

This requires that `QuarterlyTasks.tsx` (or the Tasks.tsx quarterly modal) accesses `hierarchyOrder` and `taskNameOrder` from `useUserPreferencesContext()` — which is already imported.

### Acceptance Criteria

- [ ] Daily task dropdown in "Add Task to Quarterly View" shows tasks in the **same order as the Daily tab**
- [ ] Weekly task dropdown shows tasks in the **same order as the Weekly tab**
- [ ] Monthly task dropdown shows tasks in the **same order as the Monthly tab**
- [ ] Order persists when user changes hierarchy/task order preferences in Settings
- [ ] Yearly tab modal ordering is **unchanged** (already correct)

---

## Implementation Notes

Both bugs are **frontend-only** — no backend changes needed.

Both fixes are small (< 20 lines each). Recommend fixing Bug 2 (ordering) first as it is simpler and lower risk.
