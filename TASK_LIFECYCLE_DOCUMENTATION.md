# Task Lifecycle Documentation

**Version**: 1.0  
**Last Updated**: November 4, 2025  
**Purpose**: Complete reference for task behavior, completion logic, and multi-tab tracking

---

## 🎯 Core Principles

### 1. **Task Independence by Frequency**
- Each task has a **home tab** based on its `follow_up_frequency` field
- Daily tasks → Daily tab
- Weekly tasks → Weekly tab
- Monthly tasks → Monthly tab
- Tasks can be **monitored** in multiple tabs but have ONE home tab

### 2. **Independent Completion Tracking**
- **Global Completion** (`task.is_completed`, `task.completed_at`): Set when task is completed in its HOME tab
- **Tab-Specific Completion** (`weekly_task_status`, `monthly_task_status`): Set when task is completed in monitoring tabs

### 3. **Time-Bounded Visibility**
- Completed tasks stay visible with green background until period ends
- NA tasks stay visible with gray background until period ends
- After period ends, tasks don't reappear (clean slate for next period)

---

## 📊 Task Lifecycle by Tab

### **Daily Tab (Home for Daily Tasks)**

#### Task Creation:
```javascript
{
  follow_up_frequency: 'daily',
  is_completed: false,
  is_active: true,
  completed_at: null
}
```

#### Mark Complete in Daily Tab:
**Frontend Action**:
```javascript
handleTaskComplete(taskId) {
  1. POST /api/tasks/{taskId}/complete
     → Sets task.is_completed = true
     → Sets task.completed_at = today
  
  2. POST /api/weekly-time/status/{taskId}/complete?week_start_date={date}
     → Creates weekly_task_status entry
  
  3. POST /api/monthly-time/status/{taskId}/complete?month_start_date={date}
     → Creates monthly_task_status entry
}
```

**Result**:
- ✅ Shows green background in Daily tab until midnight
- ✅ Shows green background in Weekly tab until Sunday
- ✅ Shows green background in Monthly tab until end of month
- ✅ Tomorrow: Doesn't appear in Daily tab
- ✅ Next week: Doesn't appear in Weekly tab (if added)
- ✅ Next month: Doesn't appear in Monthly tab (if added)

#### Mark NA in Daily Tab:
**Frontend Action**:
```javascript
handleTaskNA(taskId) {
  1. PUT /api/tasks/{taskId} with { is_active: false }
     → Sets task.is_active = false
     → Sets task.na_marked_at = today
  
  2. POST /api/weekly-time/status/{taskId}/na?week_start_date={date}
     → Creates weekly_task_status entry with is_na = true
  
  3. POST /api/monthly-time/status/{taskId}/na?month_start_date={date}
     → Creates monthly_task_status entry with is_na = true
}
```

**Result**: Same as Complete but with gray background

#### Filtering Logic:
```javascript
if (activeTab === 'daily') {
  // Show completed tasks ONLY if completed today
  if (task.is_completed && task.completed_at === today) return true;
  
  // Show NA tasks ONLY if marked NA today
  if (!task.is_active && task.na_marked_at === today) return true;
  
  // Show all other active tasks
  return task.is_active && !task.is_completed;
}
```

---

### **Weekly Tab (Home for Weekly Tasks, Monitor for Daily Tasks)**

#### Task Creation:
```javascript
{
  follow_up_frequency: 'weekly'
  // Manually entered in Weekly tab
}
```

#### Adding Daily Task to Weekly:
- User clicks "Add Task to Weekly" button
- Creates `weekly_task_status` entry (initially no completion)
- Task appears in Weekly tab showing aggregated data from Daily entries

#### Mark Complete in Weekly Tab:
**Frontend Action**:
```javascript
handleWeeklyTaskComplete(taskId) {
  POST /api/weekly-time/status/{taskId}/complete?week_start_date={date}
  → ONLY creates/updates weekly_task_status
  → Does NOT affect task.is_completed (global)
}
```

**Result**:
- ✅ Shows green background in Weekly tab until Sunday
- ✅ Next Monday: Doesn't appear in Weekly tab
- ❌ Daily tab UNAFFECTED (still shows task as active)
- ❌ Monthly tab UNAFFECTED

#### Filtering Logic:
```javascript
if (activeTab === 'weekly') {
  // Must be explicitly added to weekly
  if (!weeklyTaskStatuses[task.id]) return false;
  
  // Show all tasks with weekly status (completed or not)
  if (weeklyTaskStatuses[task.id]) return true;
  
  // Don't filter by global is_completed/is_active
  return true;
}
```

---

### **Monthly Tab (Home for Monthly Tasks, Monitor for Daily Tasks)**

#### Behavior:
- **Identical to Weekly tab** but with month-specific tracking
- Uses `monthly_task_status` table
- Period = First day to last day of month

#### Mark Complete in Monthly Tab:
```javascript
handleMonthlyTaskComplete(taskId) {
  POST /api/monthly-time/status/{taskId}/complete?month_start_date={date}
  → ONLY creates/updates monthly_task_status
  → Does NOT affect task.is_completed (global)
}
```

**Result**:
- ✅ Shows green until end of month
- ✅ Next month: Doesn't appear
- ❌ Daily/Weekly tabs UNAFFECTED

---

## 🔄 Cascading Completion Logic

### **Cascade Hierarchy**:
```
Daily Tab Completion
    ↓
Cascades to Weekly (current week)
    ↓
Cascades to Monthly (current month)
```

### **No Reverse Cascade**:
```
Weekly Tab Completion → Does NOT cascade to Daily
Monthly Tab Completion → Does NOT cascade to Daily or Weekly
```

### **Why Cascading?**
- Daily task completed = Done for the day = Done for the week = Done for the month
- Prevents confusion: "Why is completed task still showing?"
- Logical consistency: Home tab completion affects monitoring tabs

---

## 🗂️ Database Schema

### **Tasks Table** (Global State):
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  follow_up_frequency TEXT, -- 'daily', 'weekly', 'monthly', 'one_time'
  is_completed BOOLEAN DEFAULT 0,
  completed_at TIMESTAMP,
  is_active BOOLEAN DEFAULT 1,
  na_marked_at TIMESTAMP,
  allocated_minutes INTEGER,
  -- ... other fields
);
```

### **Weekly Task Status** (Week-Specific State):
```sql
CREATE TABLE weekly_task_status (
  id INTEGER PRIMARY KEY,
  task_id INTEGER,
  week_start_date DATE,
  is_completed BOOLEAN DEFAULT 0,
  is_na BOOLEAN DEFAULT 0,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  UNIQUE(task_id, week_start_date)
);
```

### **Monthly Task Status** (Month-Specific State):
```sql
CREATE TABLE monthly_task_status (
  id INTEGER PRIMARY KEY,
  task_id INTEGER,
  month_start_date DATE,
  is_completed BOOLEAN DEFAULT 0,
  is_na BOOLEAN DEFAULT 0,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  UNIQUE(task_id, month_start_date)
);
```

---

## 🧪 Test Scenarios

### **Scenario 1: Daily Task Completed in Daily Tab**
```
Given: Task "Meditation" (daily frequency)
When: Mark complete in Daily tab (Monday)
Then:
  - Daily tab: Green background until midnight
  - Weekly tab: Green background until Sunday (if added)
  - Monthly tab: Green background until month end (if added)
  - Next day (Tuesday): Task disappears from Daily
  - Next week (Monday): Task doesn't appear in Weekly
  - Next month (1st): Task doesn't appear in Monthly
```

### **Scenario 2: Daily Task Completed in Weekly Tab**
```
Given: Task "Meditation" (daily frequency) added to Weekly tab
When: Mark complete in Weekly tab (Monday)
Then:
  - Weekly tab: Green background until Sunday
  - Daily tab: UNCHANGED (still active)
  - Next week: Task doesn't appear in Weekly
  - Daily tab: Task still appears every day
```

### **Scenario 3: Task Renamed**
```
Given: Task "Meditation" completed in Daily tab
When: Rename to "Morning Meditation"
Then:
  - Task ID unchanged
  - All historical data preserved (daily_time_entries, weekly_task_status, etc.)
  - Completion state preserved
  - Name updated everywhere
```

### **Scenario 4: Duplicate Task Names**
```
Given: Task "Meditation" (daily) marked complete
When: Create NEW task "Meditation" (weekly)
Then:
  - Two separate tasks with same name but different IDs
  - Old task: is_completed = true (won't show in Daily)
  - New task: is_completed = false (shows in Weekly)
  - No conflict because task_id is unique
```

---

## ⚠️ Edge Cases & Solutions

### **Edge Case 1: Mark Complete Twice**
**Problem**: User marks complete in Daily, then tries in Weekly
**Current Behavior**: Weekly completion creates new status (harmless)
**Recommended**: Show message "Already completed via Daily"

### **Edge Case 2: Frequency Changed After Completion**
**Problem**: Complete "Meditation" (daily), then change to weekly
**Current Behavior**: May cause confusion in next period
**Recommended**: Show warning when changing frequency of completed task

### **Edge Case 3: Task Deleted**
**Problem**: Delete task with historical data
**Current Behavior**: Cascade delete (removes all time entries, statuses)
**Recommended**: Add soft delete or archive feature

### **Edge Case 4: Week Spans Two Months**
**Problem**: Week starts Oct 30, ends Nov 5
**Current Behavior**: Week uses week_start_date (Oct 30), Month uses month_start_date (Nov 1)
**Recommended**: Works correctly - independent tracking

---

## 🐛 Debugging Guide

### **Task Not Appearing in Tab**

**Daily Tab**:
```javascript
// Check:
1. task.follow_up_frequency === 'daily'
2. task.is_active === true
3. task.is_completed === false OR completed_at === today
4. task.na_marked_at === null OR na_marked_at === today
```

**Weekly Tab**:
```javascript
// Check:
1. weeklyTaskStatuses[task.id] exists
2. Task explicitly added to weekly (has status entry)
3. NOT filtered by global is_completed
```

**Monthly Tab**:
```javascript
// Check:
1. monthlyTaskStatuses[task.id] exists
2. Task explicitly added to monthly (has status entry)
3. NOT filtered by global is_completed
```

### **Task Shows Completed but Shouldn't**

**Check Database**:
```sql
-- Check global completion
SELECT id, name, is_completed, completed_at FROM tasks WHERE id = ?;

-- Check weekly status
SELECT * FROM weekly_task_status 
WHERE task_id = ? AND week_start_date = ?;

-- Check monthly status
SELECT * FROM monthly_task_status 
WHERE task_id = ? AND month_start_date = ?;
```

### **Completion Didn't Cascade**

**Check Frontend Code**:
```javascript
// In handleTaskComplete():
if (task.follow_up_frequency === 'daily') {
  // Should call:
  await api.post(`/api/weekly-time/status/${taskId}/complete?...`);
  await api.post(`/api/monthly-time/status/${taskId}/complete?...`);
}
```

---

## 📝 Code Locations

### **Frontend (Tasks.tsx)**:
- **Line 684-715**: `handleTaskComplete()` - Global completion with cascading
- **Line 717-748**: `handleTaskNA()` - Global NA with cascading
- **Line 750-762**: `handleWeeklyTaskComplete()` - Week-specific completion
- **Line 764-776**: `handleWeeklyTaskNA()` - Week-specific NA
- **Line 778-790**: `handleMonthlyTaskComplete()` - Month-specific completion
- **Line 792-804**: `handleMonthlyTaskNA()` - Month-specific NA
- **Line 3700-3880**: Filtering logic for all tabs

### **Backend**:
- **tasks.py**: Global completion endpoints
- **weekly_time.py**: Weekly status endpoints
- **monthly_time.py**: Monthly status endpoints
- **task_service.py**: Task completion logic
- **weekly_task_status_service.py**: Weekly status service
- **monthly_task_status_service.py**: Monthly status service

---

## 🎯 Visual Cascade Indicators (IMPLEMENTED)

### **"Completed via Daily" Badge**
When a Daily task is marked complete in the Daily tab, it cascades to Weekly and Monthly tabs. Instead of showing action buttons, these tabs now display a visual badge:

**Badge Appearance**:
```
✓ Completed via Daily
```
- **Color**: Green gradient (#10b981 → #059669)
- **Style**: Rounded badge with subtle shadow
- **Purpose**: Prevents user confusion ("Why can't I click these buttons?")

**When Badge Appears**:
- Task has `follow_up_frequency === 'daily'`
- Task has `is_completed === true`
- Badge shown in: Weekly Time-Based, Weekly Count-Based, Weekly Boolean, Monthly Time-Based, Monthly Manual Entry sections

### **"NA via Daily" Badge**
When a Daily task is marked NA in the Daily tab, it also cascades with a gray badge:

**Badge Appearance**:
```
⊘ NA via Daily
```
- **Color**: Gray gradient (#9ca3af → #6b7280)
- **Style**: Same rounded badge style
- **Purpose**: Shows task was marked Not Applicable in Daily tab

**When Badge Appears**:
- Task has `follow_up_frequency === 'daily'`
- Task has `is_active === false`
- Badge shown in: Same 5 locations as Completed badge

**Code Implementation** (Tasks.tsx, 5 locations):
```tsx
<td className="col-status">
  {/* Show badge if completed/NA via Daily */}
  {task.is_completed && task.follow_up_frequency === 'daily' ? (
    <div>
      <span style={{ /* green gradient */ }}>
        ✓ Completed via Daily
      </span>
    </div>
  ) : !task.is_active && task.follow_up_frequency === 'daily' ? (
    <div>
      <span style={{ /* gray gradient */ }}>
        ⊘ NA via Daily
      </span>
    </div>
  ) : (
    <div className="action-buttons">
      <button>COMPLETED</button>
      <button>NA</button>
    </div>
  )}
</td>
```

---

## 🔮 Future Enhancements

### **1. Undo Feature**
Allow undo within same period:
```javascript
handleUndoComplete(taskId) {
  // Reset is_completed = false
  // Delete weekly/monthly status entries
  // Only works if still same period
}
```

### **3. Recurring Tasks**
Auto-create task for next period:
```javascript
{
  is_recurring: true,
  recurrence_rule: 'daily' | 'weekly' | 'monthly'
}
```

### **4. Archive View**
Tab showing completed tasks from past periods:
```javascript
activeTab === 'archive'
// Show all completed tasks regardless of date
```

### **5. Bulk Operations**
```javascript
// Complete all daily tasks for this week
handleBulkWeeklyComplete(taskIds) {
  // Mark all as complete in weekly_task_status
}
```

---

## ✅ Validation Checklist

Before deploying changes to task lifecycle:

- [ ] Daily tab filtering works (shows only active + today's completed)
- [ ] Weekly tab filtering works (shows only explicitly added tasks)
- [ ] Monthly tab filtering works (same as weekly)
- [ ] Daily completion cascades to Weekly + Monthly
- [ ] Weekly completion does NOT cascade to Daily
- [ ] Monthly completion does NOT cascade to Daily/Weekly
- [ ] Completed tasks show green background
- [ ] NA tasks show gray background
- [ ] Tasks disappear after period ends
- [ ] Rename preserves all data
- [ ] Duplicate names don't conflict
- [ ] Database constraints prevent orphaned statuses

---

**Document Maintenance**: Update this document whenever task lifecycle logic changes.
