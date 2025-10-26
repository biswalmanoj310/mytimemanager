# Flexible Task Tracking - Implementation Complete ✅

## Overview
Updated the calculation logic for TIME and COUNT tasks to provide **flexible scheduling** within weekly and monthly periods based on the task's `follow_up_frequency` setting.

---

## New Behavior

### **The Key: `follow_up_frequency` Determines Calculation**

Tasks now calculate differently based on their **Follow-up Frequency**:

- **Daily** → Per-day calculation (multiply by days elapsed)
- **Weekly/Monthly** → Period-total calculation (proportional to days elapsed)

---

### **COUNT Tasks (e.g., "Give 4 speeches in a month")**

#### Weekly Tab (with Follow-up: Weekly):
- **Target**: Number of completions needed **total for the week**
- **Example**: Target = 4, Follow-up = Weekly (e.g., 4 speeches per week)
- **Calculation**: Expected = 4 × (days elapsed / 7)
  - Day 1: Expected ≈ 0.57 completions
  - Day 3: Expected ≈ 1.71 completions
  - Day 7: Expected = 4 completions
- **Flexibility**: Complete all 4 on Day 1 → GREEN for entire week! ✅

#### Weekly Tab (with Follow-up: Daily):
- **Target**: Number of completions needed **per day**
- **Example**: Target = 20, Follow-up = Daily (e.g., 20 push-ups per day)
- **Calculation**: Expected = 20 × days elapsed
  - Day 1: Expected = 20 completions
  - Day 3: Expected = 60 completions
  - Day 7: Expected = 140 completions
- **Daily Habit**: Need to do 20 each day to stay on track ✅

#### Monthly Tab:
- **Target**: Number of completions needed **per month**
- **Example**: Target = 4 (e.g., 4 speeches per month)
- **Calculation**: Expected = 4 × (days elapsed / days in month)
  - Day 7: Expected ≈ 1 completion (4 × 7/30)
  - Day 15: Expected = 2 completions (4 × 15/30)
  - Day 30: Expected = 4 completions
- **Flexibility**: Complete all 4 in Week 1 → GREEN for entire month! ✅

---

### **TIME Tasks (e.g., "Spend 120 minutes on finance review per month")**

#### Weekly Tab:
- **Target**: Total minutes needed **per week**
- **Example**: Allocated = 120 min (e.g., 2 hours of reading per week)
- **Calculation**: Expected = 120 × (days elapsed / 7)
  - Day 1: Expected ≈ 17 minutes
  - Day 3: Expected ≈ 51 minutes
  - Day 7: Expected = 120 minutes
- **Flexibility**: Do all 120 minutes on Sunday → GREEN for entire week! ✅

#### Monthly Tab:
- **Target**: Total minutes needed **per month**
- **Example**: Allocated = 180 min (e.g., 3 hours of planning per month)
- **Calculation**: Expected = 180 × (days elapsed / days in month)
  - Day 10: Expected = 60 minutes (180 × 10/30)
  - Day 20: Expected = 120 minutes (180 × 20/30)
  - Day 30: Expected = 180 minutes
- **Flexibility**: Do all 180 minutes in Week 1 → GREEN for entire month! ✅

---

### **BOOLEAN Tasks (Unchanged)**
- Behavior: **Daily completion expected**
- Example: "Did I meditate today?"
- Calculation: Expected = 1 per day × days elapsed
- Purpose: Track daily habits that should be done every day

---

## Color Coding

| Color | Meaning | Condition |
|-------|---------|-----------|
| 🟢 **Green** | On Track | You've met or exceeded the proportional target |
| 🔴 **Light Red** | Below Target | You have some progress but below expected |
| **No Color** | No Progress | Haven't started yet |

---

## Real-World Examples

### Example 1: Monthly Speeches (COUNT)
```
Task: "Public Speaking Practice"
Type: COUNT
Target: 4 per month
```

**Scenario**: You give all 4 speeches in the first week
- Week 1 (Day 7): Expected = 4 × (7/30) ≈ 1, Actual = 4 → 🟢 GREEN
- Week 2 (Day 14): Expected = 4 × (14/30) ≈ 2, Actual = 4 → 🟢 GREEN
- Week 3 (Day 21): Expected = 4 × (21/30) ≈ 3, Actual = 4 → 🟢 GREEN
- Week 4 (Day 30): Expected = 4, Actual = 4 → 🟢 GREEN

**Result**: Stay GREEN all month! No need to follow up after completing target early.

---

### Example 2: Weekly Finance Review (TIME)
```
Task: "Finance Review"
Type: TIME
Allocated: 20 minutes per week
```

**Scenario**: You do the review on Sunday (20 minutes in one session)
- Monday (Day 1): Expected ≈ 3 min, Actual = 0 → No color
- Wednesday (Day 3): Expected ≈ 9 min, Actual = 0 → No color
- Sunday (Day 7): Expected = 20 min, Actual = 20 min → 🟢 GREEN

**Result**: Complete it anytime during the week that works for you!

---

### Example 3: Monthly Planning Session (TIME)
```
Task: "Monthly Planning"
Type: TIME
Allocated: 180 minutes (3 hours) per month
```

**Scenario**: You do all planning in the first weekend
- Day 3: Expected = 180 × (3/30) = 18 min, Actual = 180 min → 🟢 GREEN
- Day 15: Expected = 90 min, Actual = 180 min → 🟢 GREEN
- Day 30: Expected = 180 min, Actual = 180 min → 🟢 GREEN

**Result**: Front-load your planning and stay green all month!

---

## Benefits

1. ✅ **Flexible Scheduling**: Complete tasks when it suits you
2. ✅ **Realistic Tracking**: Matches how people actually work
3. ✅ **Early Completion Rewarded**: Finish early, stay green
4. ✅ **Progress Awareness**: Color coding shows if you're falling behind mid-period
5. ✅ **No Daily Pressure**: For non-daily tasks, complete them on your schedule

---

## Changes Made

### Files Modified:

1. **frontend/src/pages/Tasks.tsx**
   - Line ~910-920: Updated weekly COUNT calculation
   - Line ~920-928: Updated weekly TIME calculation
   - Line ~962-970: Updated monthly COUNT calculation
   - Line ~970-978: Updated monthly TIME calculation

2. **frontend/src/components/TaskForm.tsx**
   - Line ~471: Added help text for TIME tasks
   - Line ~489: Added help text for COUNT tasks

### Calculation Formulas:

**Weekly Tasks:**
```typescript
// COUNT: target_value * (days_elapsed / 7)
expectedTarget = (task.target_value || 0) * (daysElapsed / 7);

// TIME: allocated_minutes * (days_elapsed / 7)
expectedTarget = task.allocated_minutes * (daysElapsed / 7);
```

**Monthly Tasks:**
```typescript
// COUNT: target_value * (days_elapsed / days_in_month)
expectedTarget = (task.target_value || 0) * (daysElapsed / daysInMonth);

// TIME: allocated_minutes * (days_elapsed / days_in_month)
expectedTarget = task.allocated_minutes * (daysElapsed / daysInMonth);
```

---

## Testing Checklist

### Flexible Tasks (Weekly/Monthly Follow-up):
- [ ] Create a COUNT task with target 4, follow-up WEEKLY
- [ ] Complete it 4 times in first day of week
- [ ] Verify row turns GREEN for entire week
- [ ] Create a TIME task with 120 min, follow-up MONTHLY
- [ ] Enter 120 minutes on day 1 of month
- [ ] Verify row turns GREEN for entire month

### Daily Habit Tasks (Daily Follow-up):
- [ ] Create a COUNT task with target 20, follow-up DAILY (e.g., push-ups)
- [ ] View in Weekly tab - should expect 20 × 7 = 140 by end of week
- [ ] Complete 20 on Day 1, verify shows 20/20 for that day
- [ ] Create a TIME task with 45 min, follow-up DAILY (e.g., meditation)
- [ ] View in Weekly tab - should expect 45 × 7 = 315 min by end of week
- [ ] Enter 45 min on Day 1, verify on track for that day

### Edge Cases:
- [ ] Test with different days in month (28, 30, 31 days)
- [ ] Verify daily tasks show correctly in all tabs (Today, Weekly, Monthly)

---

## Bug Fix: Daily Tasks in Weekly/Monthly Views

### Issue Identified:
When a task with follow-up frequency "Daily" was viewed in Weekly or Monthly tabs, the allocated time was being interpreted as the total for the period instead of per-day.

### Example Problem:
- Task: "Meditation" - 45 min, Follow-up: DAILY
- Expected in Weekly: 45 min × 7 days = 315 min target
- Bug: Was calculating 45 min total for week (incorrect!)

### Solution:
Updated calculation logic to check `follow_up_frequency`:
- If `'daily'` → Multiply by days elapsed (per-day habit)
- If `'weekly'/'monthly'` → Proportional calculation (flexible period task)

### Files Changed:
- `frontend/src/pages/Tasks.tsx` (lines ~910-935 and ~975-998)
  - Added `follow_up_frequency` check in `getWeeklyRowColorClass()`
  - Added `follow_up_frequency` check in `getMonthlyRowColorClass()`

---

## Date: October 23, 2025
**Status**: Implementation Complete ✅ (Bug Fixed)
**Ready for Testing**: Yes
