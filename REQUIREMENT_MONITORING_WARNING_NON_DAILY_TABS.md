# Requirement: Cross-Tab Monitoring Warning for Non-Daily Tabs

**Status**: Pending Implementation  
**Priority**: Medium  
**Reported**: 2026-07-21  

---

## Problem Statement

When marking a **monthly task** as Complete or NA in the Monthly tab, and that task is also being monitored in the **Yearly tab**, no warning is shown. The user is unaware the action will affect a task tracked in another tab.

### Concrete Scenario

- 4 monthly tasks exist in the Monthly tab.
- User is also monitoring all 4 via the Yearly tab (`yearly_task_status` rows exist).
- User marks them as **NA** from the Monthly tab → they move to the Completed section (correct behavior).
- **Missing**: No warning shown that these tasks are being monitored in the Yearly tab.

---

## Existing (Working) Behavior — Daily Tab

The Daily tab **already implements** this warning via:

1. `checkReferencesAndConfirm(taskId, action, onConfirm)` in `frontend/src/pages/Tasks.tsx` (line ~2130)
   - Calls `GET /api/tasks/{taskId}/references`
   - If references exist (habits, challenges, or **monitoring tabs**), shows a confirmation modal before proceeding.
2. `handleDailyTaskComplete` and `handleDailyTaskNA` both call `checkReferencesAndConfirm` before acting.
3. The warning modal (line ~22448) renders "Monitored in Other Tabs" with a list of tab names.

### Backend Already Supports This

`GET /api/tasks/{taskId}/references` (`backend/app/routes/tasks.py`, line 331) already queries:
- `WeeklyTaskStatus` → adds `"Weekly"` to `monitoring_tabs`
- `MonthlyTaskStatus` → adds `"Monthly"` to `monitoring_tabs`
- `YearlyTaskStatus` → adds `"Yearly"` to `monitoring_tabs`

**Backend needs NO changes.** It already returns the correct data.

---

## Gap Analysis

The following handlers in `frontend/src/pages/Tasks.tsx` do **NOT** call `checkReferencesAndConfirm`:

| Handler | Tab | Action | Line (approx) |
|---|---|---|---|
| `handleTaskComplete` | Weekly / Monthly / Yearly | Complete | ~2253 |
| `handleTaskNA` | Weekly / Monthly / Yearly | NA | ~2342 |
| `handleWeeklyTaskComplete` | Weekly (monitoring) | Complete | ~2388 |
| `handleWeeklyTaskNA` | Weekly (monitoring) | NA | ~2399 |

> Note: `handleWeeklyTaskComplete` / `handleWeeklyTaskNA` only set tab-specific status (not global), so warning there is optional but good UX.

---

## Implementation Plan

### Step 1 — Wrap `handleTaskComplete` with `checkReferencesAndConfirm`

**File**: `frontend/src/pages/Tasks.tsx`

```typescript
const handleTaskComplete = async (taskId: number) => {
  if (activeTab === 'daily') {
    return handleDailyTaskComplete(taskId);
  }

  const doComplete = async () => {
    // ... existing logic unchanged ...
  };

  await checkReferencesAndConfirm(taskId, 'complete', doComplete);
};
```

### Step 2 — Wrap `handleTaskNA` with `checkReferencesAndConfirm`

**File**: `frontend/src/pages/Tasks.tsx`

```typescript
const handleTaskNA = async (taskId: number) => {
  if (activeTab === 'daily') {
    return handleDailyTaskNA(taskId);
  }

  const doNA = async () => {
    // ... existing logic unchanged ...
  };

  await checkReferencesAndConfirm(taskId, 'na', doNA);
};
```

### Step 3 (Optional / Nice-to-have) — Smarter `monitoring_tabs` filtering

Currently the backend returns ALL tabs that have a status row for the task.  
When acting from the Monthly tab, showing "Monthly" in the warning (self-referential) is confusing.  
Consider passing the `current_tab` as a query param so the backend can exclude it:

```
GET /api/tasks/{taskId}/references?exclude_tab=Monthly
```

Backend then skips adding `"Monthly"` to `monitoring_tabs` when the caller is already acting from that tab.

---

## Acceptance Criteria

1. [ ] When marking a **monthly** task as Complete or NA from the **Monthly tab**, if the task has a row in `yearly_task_status`, show the existing "Monitored in Other Tabs" warning modal listing "Yearly".
2. [ ] When marking a **weekly** task as Complete or NA from the **Weekly tab**, if the task is monitored in Monthly or Yearly, show the warning.
3. [ ] When marking a **yearly** task as Complete or NA from the **Yearly tab**, if the task is monitored in Monthly or Weekly, show the warning.
4. [ ] Existing Daily tab warning behavior is **unchanged**.
5. [ ] User can still confirm and proceed after seeing the warning.
6. [ ] Warning modal lists all affected tabs (same UI as daily tab warning).

---

## Files to Change

| File | Change |
|---|---|
| `frontend/src/pages/Tasks.tsx` | Wrap `handleTaskComplete` and `handleTaskNA` with `checkReferencesAndConfirm` |
| `backend/app/routes/tasks.py` | (Optional) Add `exclude_tab` query param to `/references` endpoint |

**No database changes needed.**  
**No new components needed.**  
**Backend references endpoint already works correctly.**

---

## Testing Checklist

- [ ] Mark a monthly task as NA → yearly monitoring warning appears
- [ ] Confirm → task marked NA, yearly tab still shows task (monitoring tab behavior unchanged)
- [ ] Cancel → task stays active, no changes
- [ ] Daily tab complete/NA flow still works exactly as before
- [ ] Task with NO monitoring tabs → no warning, proceeds directly (no regression)
