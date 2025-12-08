# Habit & Challenge Fixes Implementation Plan

## ✅ COMPLETED

### 1. Challenge Log Entry Fix
**Issue**: "Failed to log entry" error when logging challenge entries
**Root Cause**: `log_challenge_entry()` function signature expected individual parameters but route was passing entire dict
**Fix**: Updated `/backend/app/routes/challenges.py` line 316 to unpack Pydantic model fields individually
**Status**: ✅ FIXED

### 2. Challenge Form Field Reordering
**Issue**: "Is it part of a daily/monthly task" field should come right after task name
**Fix**: Moved Task link section in `/frontend/src/components/AddChallengeModal.tsx` to appear immediately after Challenge Name field
**Label Changed**: "📋 Is this part of a daily/monthly task? (Optional)"
**Status**: ✅ FIXED

## 🚧 IN PROGRESS / PENDING

### 3. Challenge Default Values for Missing Days
**Issue**: If data is not entered for a day, should default to 0 or No
**Implementation**:
- Backend: Modify `get_challenge_entries()` to generate placeholder entries for days without data
- Default values: `is_completed=False`, `count_value=0`, `numeric_value=0`
- Location: `/backend/app/services/challenge_service.py` lines 106-172
**Status**: PENDING

### 4. Habit Blank Day Entries
**Issue**: When no data entered for a day, should consider:
  - Time/Number habits: 0
  - Yes/No habits: Opposite of planned value
**Implementation**:
- Similar to Challenge fix above
- Check `habit.is_positive` field to determine opposite for Yes/No
- Location: `/backend/app/services/habit_service.py`
**Status**: PENDING

### 5. Habit Streak Display Format
**Issue**: Show "Current Streak:", "Best Streak:", "2nd Best Streak:" for habits
**Current State**: 
  - `stats.current_streak` exists
  - `stats.longest_streak` exists
  - `stats.top_3_streaks` array exists (added in recent update)
**Implementation**:
- Update habit card rendering in `/frontend/src/pages/Tasks.tsx` around line 7200-7600
- Display format:
  ```
  Current Streak: X days
  Best Streak: Y days
  2nd Best Streak: Z days
  ```
**Status**: PENDING

### 6. Disable Manual Entry for Monitored Habits
**Issue**: If habit is monitored from Daily Task, manual entry should not be allowed (like monthly/weekly tabs)
**Current Field**: `habit.linked_task_id` exists
**Implementation**:
- Check if `linked_task_id` is set
- If yes, disable manual entry buttons/inputs in habit card
- Show indicator: "🔗 Auto-tracked from Daily Task: {task_name}"
- Location: `/frontend/src/pages/Tasks.tsx` habit rendering section
**Status**: PENDING

### 7. Move Completed Habits (End Date)
**Issue**: After end date, habit should move to "Completed Habits" section
**Current State**: Habits have `end_date` field but not auto-moving
**Implementation**:
- Backend: Add filter in `get_all_habits()` to check if `end_date < today` → set `is_active=False` automatically
- Frontend: Create "Completed Habits" section below active habits
- Location: 
  - Backend: `/backend/app/routes/habits.py` line 119
  - Frontend: `/frontend/src/pages/Tasks.tsx` habits tab section
**Status**: PENDING

### 8. Redesign Habit Dashboard
**Issue**: Mix current dashboard with Today's tab view
**Details Needed**: User needs to clarify what specific elements to combine
**Current Tabs**: 
  - Dashboard tab: Shows overview/stats
  - Today tab: Shows daily tracking for habits/challenges
**Status**: AWAITING CLARIFICATION

### 9. Fix Habits Disappearing on Month Change
**Issue**: When month changes, all habits disappear
**Root Cause**: `loadHabitMonthDays()` function in `/frontend/src/pages/Tasks.tsx` line 757 filters entries by current month only
**Fix**: 
  - Habits should always load (they're already loading correctly from backend)
  - The month view should just be for DISPLAYING entries, not filtering habits
  - Keep habit list independent of month selection
  - Only filter ENTRIES by selected month for display
**Implementation**:
```typescript
// Line 738 - loadHabits() is already correct, loads all active habits
// Line 757 - loadHabitMonthDays() should be for display only, not hiding habits
// Simply show habits without entries as "No data this month" instead of hiding them
```
**Status**: PENDING

## 📝 TECHNICAL NOTES

### Backend API Endpoints
- `/api/challenges/{id}/log` - Fixed parameter unpacking
- `/api/habits/` - Returns all active habits correctly (no month filtering)
- `/api/habits/{id}/entries?start_date=X&end_date=Y` - Gets entries for date range

### Frontend Components
- `AddChallengeModal.tsx` - Challenge form (field reordering completed)
- `Tasks.tsx` - Main page with habits tab (lines 7200-8000 approx for habit rendering)
- Habit card rendering around line 7288

### Database Schema
- `habits.linked_task_id` - Foreign key to tasks table
- `habits.end_date` - Date when habit should be considered complete
- `habits.is_positive` - Boolean for Yes/No habit type (true = should do, false = should not do)
- `habit_streaks` table - Contains historical streaks with start/end dates

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

1. ✅ Challenge log entry fix (DONE)
2. ✅ Challenge form reordering (DONE)
3. **Next: Fix habits disappearing** - Simplest fix, high user impact
4. **Then: Show streak display** - Uses existing data, straightforward UI update
5. **Then: Disable manual entry for monitored habits** - Clear business logic
6. **Then: Move completed habits** - Requires new section
7. **Then: Default values for missing days** - Backend service changes
8. **Then: Dashboard redesign** - Awaiting user clarification

## 🔍 USER TESTING CHECKLIST

After implementation, test:
- [ ] Challenge log entry works without errors
- [ ] Challenge form shows task link right after name
- [ ] Habits persist across month changes
- [ ] Streak display shows Current/Best/2nd Best
- [ ] Habits with linked tasks show auto-track indicator
- [ ] Habits past end_date move to Completed section
- [ ] Missing challenge days default to 0/No
- [ ] Missing habit days default appropriately based on type
