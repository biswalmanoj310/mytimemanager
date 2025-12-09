# Recovery Implementation Plan

## Date: December 8, 2025
## Status: IN PROGRESS

## Lost Changes Due to Git Checkout

When fixing the tab syntax error, `git checkout HEAD -- frontend/src/pages/Tasks.tsx` was executed, which discarded all uncommitted changes in Tasks.tsx.

## What Needs to be Re-implemented

### 1. ✅ String Replacement: 'onetime' → 'important'
**Status**: DONE
- Used sed to replace all instances of 'onetime' with 'important'

### 2. ⏳ Misc Tasks Due Today Section (TODAY TAB)
**Source**: MISC_TASKS_TODAY_TAB_COMPLETE.md
**Status**: TO BE IMPLEMENTED

**Requirements**:
- Add `miscTasksDueToday` useMemo hook (line ~1209-1251)
- Add `showMiscTasksDueToday` state variable (line ~161)
- Add UI section in Today tab (lines ~13034-13127)
- Shows misc tasks that are due today or overdue
- Purple gradient header
- Complete button with confirmation
- View button to navigate to Misc tab
- Priority badges
- Overdue vs due today styling

### 3. ⏳ Misc Tab Sub-tasks Implementation
**Source**: MISC_TAB_SUBTASKS_COMPLETE.md
**Status**: TO BE IMPLEMENTED

**Requirements**:
- Fix API endpoints to use `/api/misc-tasks/tasks/{id}`
- Calendar date picker with auto-save
- Sub-task creation modal
- Add state: `showAddMiscSubTaskModal`, `selectedMiscParentTask`
- "+ Sub" button handler

### 4. ⏳ Misc Tab Bug Fixes (9 Fixes)
**Source**: MISC_SUBTASKS_BUGS_FIXED.md
**Status**: TO BE IMPLEMENTED

**Requirements**:
1. Nested sub-tasks support (sub-tasks can have sub-tasks)
2. Clean description display (remove `[PARENT_TASK_ID:110]` markers)
3. Clean task names (remove `└─` prefix)
4. Remove unnecessary arrow icon after checkbox
5. Filter buttons ("Show All", "In Progress", "Completed") with state management
6. Done button validation (prevent completing parent with incomplete children)
7. Progress indicator next to task name `(completed/total)`
8. Delete button validation (prevent deleting parent with children)
9. Parent task protection

## Implementation Order

1. First: Misc Tab improvements (most critical user-facing features)
2. Second: Misc Tasks Due Today section (depends on misc tab data)
3. Third: Test everything thoroughly
4. Fourth: COMMIT THE CHANGES!

## Files to Modify

- `frontend/src/pages/Tasks.tsx` - Main implementation
- Already done: Backend files were preserved (not reverted)

## Backup Strategy

**CRITICAL**: Before making changes, user should:
```bash
git add -A
git commit -m "WIP: Before recovery implementation"
```

This way we have a checkpoint to revert to if needed.
