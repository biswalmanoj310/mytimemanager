# 🧪 Refactoring Validation & Testing Guide

**Purpose:** Ensure zero functionality regression during Tasks.tsx refactoring  
**Baseline Commit:** 5742d1e  
**Created:** November 5, 2025

---

## 🎯 Testing Philosophy

> **"If it works the same way before and after refactoring, the refactoring was successful."**

This document provides comprehensive testing procedures to validate that every feature continues to work exactly as before the refactoring.

---

## 📋 Pre-Refactoring Baseline Documentation

### Current Working Features (to preserve)

#### ✅ Daily Tab
- [x] View daily tasks organized by pillar/category hierarchy
- [x] Log time entries for time-based tasks
- [x] Log count values for count-based tasks
- [x] Toggle boolean tasks (Yes/No)
- [x] Mark tasks as complete
- [x] Mark tasks as Not Applicable (NA)
- [x] Filter by pillar
- [x] Filter by category
- [x] Custom task name ordering
- [x] Task type display (time/count/boolean)
- [x] Allocated vs actual time comparison
- [x] Target vs actual count comparison

#### ✅ Weekly Tab
- [x] Navigate between weeks
- [x] View 7-day grid (Mon-Sun)
- [x] Select daily tasks to track weekly
- [x] Create new tasks for weekly tracking
- [x] Daily aggregate display (from Daily tab)
- [x] Mark tasks complete for the week
- [x] Mark tasks NA for the week
- [x] Week-specific task status (independent of Daily)
- [x] Remove tasks from weekly tracking
- [x] Add Weekly Task Modal (RESTORED)

#### ✅ Monthly Tab
- [x] Navigate between months
- [x] View up to 31-day grid
- [x] Select daily or weekly tasks for monthly tracking
- [x] Create new tasks for monthly tracking
- [x] Daily aggregate display (from Daily tab)
- [x] Mark tasks complete for the month
- [x] Mark tasks NA for the month
- [x] Month-specific task status
- [x] Remove tasks from monthly tracking
- [x] Add Monthly Task Modal (RESTORED)

#### ✅ Yearly Tab
- [x] Navigate between years
- [x] View 12-month grid
- [x] Select daily/weekly/monthly tasks for yearly tracking
- [x] Create new tasks for yearly tracking
- [x] Monthly aggregate display
- [x] Mark tasks complete for the year
- [x] Mark tasks NA for the year
- [x] Year-specific task status
- [x] Remove tasks from yearly tracking
- [x] Add Yearly Task Modal (RESTORED)

#### ✅ One-Time Tab
- [x] View one-time tasks
- [x] Select existing tasks for one-time tracking
- [x] Create new one-time tasks
- [x] Set start date
- [x] Set target gap (days)
- [x] Calculate and display target date
- [x] Log progress entries
- [x] Mark as complete
- [x] Update target dates
- [x] Add One-Time Task Modal (RESTORED)

#### ✅ Projects Tab
- [x] Create new projects
- [x] Edit project details
- [x] Link projects to life goals
- [x] Set start and target completion dates
- [x] Create milestones for projects
- [x] Edit milestone details
- [x] Delete milestones
- [x] View milestone progress
- [x] Click milestone to view details (FIXED)
- [x] Create project tasks (root level)
- [x] Create subtasks (hierarchical)
- [x] Edit tasks with all fields (FIXED)
- [x] Move tasks in hierarchy
- [x] Assign tasks to milestones
- [x] Set task due dates and priorities
- [x] Toggle task completion (checkbox)
- [x] Recursive completion (children follow parent)
- [x] Progress calculation (completed/total)
- [x] Add Project Modal (FIXED)
- [x] Add Milestone Modal (FIXED)
- [x] Add Task Modal (FIXED)
- [x] Edit Task Modal (FIXED)
- [x] Edit Milestone Modal (FIXED)
- [x] Milestone Detail Modal (FIXED)
- [x] Subtask button in every task row (FIXED)
- [x] Subtask button in Edit Task Modal (FIXED)

#### ⚠️ Misc Tab (Needs Testing)
- [ ] Create misc task groups
- [ ] Add tasks to groups
- [ ] Mark tasks complete
- [ ] Delete tasks
- [ ] Edit task groups
- [x] Add Misc Group Modal (MISSING)
- [x] Add Misc Task Modal (MISSING)

#### ⚠️ Habits Tab (BROKEN - Needs Fixing)
- [ ] View habits list
- [ ] Create new habit (multiple tracking modes)
- [ ] Daily streak tracking
- [ ] Occurrence tracking (weekly/monthly)
- [ ] Aggregate tracking (weekly/monthly totals)
- [ ] Log habit entries
- [ ] View streaks
- [ ] Edit habit details
- [ ] Delete habits
- [ ] Link habits to daily tasks (auto-sync)
- [x] Add Habit Modal (MISSING)
- [x] Habit Details Modal (MISSING)

#### ⚠️ Wishes Tab (Needs Testing)
- [ ] Create new wish
- [ ] Edit wish details
- [ ] Add reflections
- [ ] Add exploration steps
- [ ] Add inspirations
- [ ] Status progression (dreaming → planning)
- [ ] Archive wishes
- [ ] View wish statistics
- [x] Add Wish Modal (MISSING)
- [x] Wish Details Modal (MISSING)

#### ⚠️ Life Goals Tab (Needs Testing)
- [ ] View life goals
- [ ] Create new goal
- [ ] Link to pillars
- [ ] Create goal milestones
- [ ] Create goal tasks
- [ ] Link existing tasks to goals
- [ ] Track goal progress
- [x] Add Goal Modal (MISSING)
- [x] Add Goal Milestone Modal (MISSING)
- [x] Add Goal Task Modal (MISSING)
- [x] Link Task Modal (MISSING)

---

## 🔬 Testing Procedures

### Phase 1 Testing: After Extracting Shared Components

#### Test Suite 1: Date Utilities
```typescript
// Test date formatting
const date = new Date('2025-11-05');
formatDateForInput(date) // Should return '2025-11-05'
getWeekStart(date) // Should return Monday of that week
getMonthStart(date) // Should return '2025-11-01'
```

#### Test Suite 2: Task Utilities
```typescript
// Test task filtering
filterTasksByPillar(tasks, 'Health') // Returns only Health tasks
filterTasksByCategory(tasks, 'Exercise') // Returns only Exercise tasks
sortTasksByHierarchy(tasks) // Returns sorted by pillar/category order
```

#### Test Suite 3: Shared Components
- [ ] `TimeEntryGrid` renders correctly with test data
- [ ] `DateNavigator` navigates forward/backward
- [ ] `TaskFilters` updates active filters
- [ ] Context providers supply data to child components

**Validation Criteria:**
✅ All utility functions return expected results  
✅ Components render without errors  
✅ Context values accessible throughout component tree

---

### Phase 2 Testing: After Extracting Time Tracking Pages

#### Test Suite 4: Weekly Tab (New Page)
1. **Navigation**
   - [ ] Click "Previous Week" → Week changes backward
   - [ ] Click "Next Week" → Week changes forward
   - [ ] Week date range displays correctly

2. **Task Management**
   - [ ] "Add Weekly Task" button opens modal
   - [ ] Can select daily task from dropdown
   - [ ] Can create new task (opens TaskForm)
   - [ ] Selected task appears in weekly grid
   - [ ] Task shows correct name, type, target values

3. **Time Entry**
   - [ ] Can enter time for time-based tasks
   - [ ] Can enter counts for count-based tasks
   - [ ] Can toggle boolean tasks
   - [ ] Daily aggregates show correctly
   - [ ] Values save on blur/change

4. **Status Management**
   - [ ] Can mark task complete for week
   - [ ] Can mark task NA for week
   - [ ] Completed tasks show checkmark
   - [ ] NA tasks show "N/A" badge
   - [ ] Can unmark completed/NA

5. **Data Integrity**
   - [ ] Weekly status independent of Daily tab
   - [ ] Daily aggregates sync from Daily tab
   - [ ] Removing task from weekly doesn't delete from daily
   - [ ] Week navigation persists data correctly

#### Test Suite 5: Monthly Tab (New Page)
1. **Navigation**
   - [ ] Navigate months forward/backward
   - [ ] Month date range correct
   - [ ] Days-in-month displays correctly (28/29/30/31)

2. **Task Management**
   - [ ] Add monthly task modal works
   - [ ] Can select from daily tasks
   - [ ] Can select from weekly tasks
   - [ ] Can create new task
   - [ ] Task appears in monthly grid

3. **Time Entry & Status**
   - [ ] Enter values for all task types
   - [ ] Daily aggregates display
   - [ ] Mark complete/NA for month
   - [ ] Remove from monthly tracking

4. **Data Integrity**
   - [ ] Monthly status independent
   - [ ] Aggregates sync correctly
   - [ ] Month navigation preserves data

#### Test Suite 6: Yearly Tab (New Page)
1. **Navigation**
   - [ ] Navigate years forward/backward
   - [ ] Year range displays correctly
   - [ ] 12 month columns show

2. **Task Management**
   - [ ] Add yearly task modal works
   - [ ] Select from daily/weekly/monthly
   - [ ] Create new task
   - [ ] Task in yearly grid

3. **Time Entry & Status**
   - [ ] Enter values for all types
   - [ ] Monthly aggregates display
   - [ ] Mark complete/NA for year
   - [ ] Remove from tracking

4. **Data Integrity**
   - [ ] Yearly status independent
   - [ ] Aggregates sync
   - [ ] Year navigation works

#### Test Suite 7: One-Time Tab (New Page)
1. **Task Management**
   - [ ] Add one-time task modal works
   - [ ] Select existing task
   - [ ] Create new task
   - [ ] Task appears in list

2. **Date Management**
   - [ ] Set start date
   - [ ] Set target gap
   - [ ] Target date calculates correctly
   - [ ] Update dates

3. **Progress Tracking**
   - [ ] Log entries
   - [ ] Mark complete
   - [ ] Completion date records

**Validation Criteria:**
✅ All time tracking pages work identically to original tabs  
✅ Data synchronization between tabs works  
✅ No loss of functionality  
✅ File sizes under 300KB each

---

### Phase 3 Testing: After Extracting Feature Pages

#### Test Suite 8: Habits Page (CRITICAL - Must Fix All Issues)
1. **Habit Creation**
   - [ ] Add habit modal opens
   - [ ] Daily streak mode works
   - [ ] Occurrence mode (weekly/monthly) works
   - [ ] Occurrence with value works
   - [ ] Aggregate mode works
   - [ ] Link to daily task works

2. **Habit Tracking**
   - [ ] Log habit entry
   - [ ] Track streak (daily mode)
   - [ ] Track occurrences (weekly/monthly)
   - [ ] Track aggregate totals
   - [ ] View habit history

3. **Habit Management**
   - [ ] Edit habit
   - [ ] Delete habit
   - [ ] View habit details modal
   - [ ] See statistics
   - [ ] Auto-sync from linked tasks

4. **Habit Types**
   - [ ] Boolean habits (did it / didn't)
   - [ ] Time-based habits
   - [ ] Count-based habits
   - [ ] Build habits (positive)
   - [ ] Break habits (negative)

**FIX THESE KNOWN ISSUES:**
- [ ] Habit detail modal not opening
- [ ] Streak calculations incorrect
- [ ] Occurrence tracking not saving
- [ ] Aggregate totals not summing correctly
- [ ] Linked task sync not working

#### Test Suite 9: Wishes Page
1. **Wish Management**
   - [ ] Create new wish
   - [ ] Edit wish details
   - [ ] Archive wish
   - [ ] View wish details modal

2. **Wish Features**
   - [ ] Add reflection
   - [ ] Add exploration step
   - [ ] Add inspiration
   - [ ] Change status
   - [ ] View statistics

3. **Status Progression**
   - [ ] Dreaming → Exploring
   - [ ] Exploring → Planning
   - [ ] Planning → Ready to Commit
   - [ ] Convert to Goal (when ready)

#### Test Suite 10: Misc Tasks Page
1. **Group Management**
   - [ ] Create misc group
   - [ ] Edit group
   - [ ] Delete group
   - [ ] View group tasks

2. **Task Management**
   - [ ] Add task to group
   - [ ] Edit task
   - [ ] Mark complete
   - [ ] Delete task
   - [ ] Hierarchical subtasks

**Validation Criteria:**
✅ All feature pages work completely  
✅ Habits page fully functional (all bugs fixed)  
✅ No regressions in any feature  
✅ Modals all working

---

## 🔄 Integration Testing

### Cross-Tab Data Flow
1. **Daily → Weekly → Monthly → Yearly**
   - [ ] Create task in Daily
   - [ ] Add to Weekly → Shows in weekly grid
   - [ ] Add to Monthly → Shows in monthly grid
   - [ ] Add to Yearly → Shows in yearly grid
   - [ ] Log time in Daily → Aggregates update in Weekly/Monthly/Yearly

2. **Task Status Synchronization**
   - [ ] Complete in Daily → Still active in Weekly (independent)
   - [ ] Mark NA in Daily → Can still track in Weekly
   - [ ] Complete in Weekly → Doesn't affect Monthly/Yearly
   - [ ] Complete in all tabs → All show completed independently

3. **Task Deletion/Deactivation**
   - [ ] Deactivate in Daily → Removed from future Weekly/Monthly/Yearly periods
   - [ ] Remove from Weekly → Still exists in Daily
   - [ ] Delete task entirely → Removed from all tabs

### Project Integration
- [ ] Create project linked to goal
- [ ] Create milestone
- [ ] Create task linked to milestone
- [ ] Complete task → Milestone progress updates
- [ ] Complete all tasks → Milestone shows 100%
- [ ] Complete all milestones → Project shows 100%

### Habit Integration
- [ ] Create habit linked to daily task
- [ ] Log time in Daily tab
- [ ] Habit entry auto-created
- [ ] Streak updates correctly
- [ ] Unlink habit → Auto-sync stops

---

## 📊 Performance Testing

### Metrics to Measure (Before & After)
1. **Page Load Time**
   - [ ] Initial load < 2 seconds
   - [ ] Tab switching < 200ms
   - [ ] Modal opening < 100ms

2. **Data Fetch Performance**
   - [ ] Tasks load < 500ms
   - [ ] Time entries load < 300ms
   - [ ] Aggregates calculate < 200ms

3. **UI Responsiveness**
   - [ ] Input lag < 50ms
   - [ ] Grid rendering < 100ms
   - [ ] Filter updates < 100ms

4. **Memory Usage**
   - [ ] No memory leaks on tab switching
   - [ ] Context updates don't cause excessive re-renders
   - [ ] Large datasets (1000+ tasks) perform acceptably

---

## 🚨 Known Issues to Verify Fixed

### Current Bugs (from baseline)
1. **Habits Tab**
   - [x] Habit details modal not opening → MUST FIX
   - [x] Add Habit modal missing → MUST RESTORE
   - [ ] Streak calculations incorrect → MUST FIX
   - [ ] Occurrence tracking broken → MUST FIX

2. **Modals**
   - [x] Add Weekly Task modal missing → RESTORED ✅
   - [x] Add Monthly Task modal missing → RESTORED ✅
   - [x] Add Yearly Task modal missing → RESTORED ✅
   - [x] Add One-Time Task modal missing → RESTORED ✅
   - [ ] Add Misc Group modal missing → TODO
   - [ ] Add Misc Task modal missing → TODO
   - [ ] Add Wish modal missing → TODO
   - [ ] Wish Details modal missing → TODO

3. **Projects Tab**
   - [x] Edit task button opens prompt → FIXED ✅
   - [x] Milestone edit not working → FIXED ✅
   - [x] Milestone detail view missing → FIXED ✅

---

## ✅ Acceptance Criteria

### Must Pass ALL Before Merging Each Phase

#### Code Quality
- [ ] No TypeScript errors
- [ ] No ESLint warnings (critical)
- [ ] All imports resolve correctly
- [ ] No circular dependencies
- [ ] No console errors in browser

#### Functionality
- [ ] ALL tests in relevant test suite pass
- [ ] No regression in existing features
- [ ] New pages work identically to original tabs
- [ ] All modals open and function correctly
- [ ] All CRUD operations work

#### Performance
- [ ] No significant performance degradation
- [ ] Page loads within acceptable time
- [ ] No memory leaks detected
- [ ] Large datasets still performant

#### Documentation
- [ ] Code comments explain complex logic
- [ ] Component props documented
- [ ] API calls documented
- [ ] State management explained

#### Git Hygiene
- [ ] Clear commit message
- [ ] No unrelated changes
- [ ] Backup files removed
- [ ] Migration notes included

---

## 🔧 Debugging Checklist

### If Something Breaks

1. **Check Console Errors**
   ```bash
   # Browser console
   - Look for TypeScript errors
   - Check network tab for failed API calls
   - Look for state update warnings
   ```

2. **Verify Data Flow**
   ```
   API → Context → Component → Display
   └─ Check each step
   ```

3. **Compare with Baseline**
   ```bash
   git diff 5742d1e -- frontend/src/pages/Tasks.tsx
   # Review what changed
   ```

4. **Test in Isolation**
   - Test component with mock data
   - Test hook independently
   - Test utility function with unit tests

5. **Rollback if Needed**
   ```bash
   git checkout 5742d1e -- [file]
   # Restore baseline if stuck
   ```

---

## 📝 Test Execution Log

### Phase 1: Foundation (Date: ______)
- [ ] Date utilities: ✅ / ❌
- [ ] Task utilities: ✅ / ❌
- [ ] Shared components: ✅ / ❌
- [ ] Context providers: ✅ / ❌
- **Notes:**

### Phase 2: Time Tracking (Date: ______)
- [ ] WeeklyTasks page: ✅ / ❌
- [ ] MonthlyTasks page: ✅ / ❌
- [ ] YearlyTasks page: ✅ / ❌
- [ ] OneTimeTasks page: ✅ / ❌
- **Notes:**

### Phase 3: Feature Pages (Date: ______)
- [ ] Habits page: ✅ / ❌
- [ ] Wishes page: ✅ / ❌
- [ ] MiscTasks page: ✅ / ❌
- **Notes:**

### Phase 4: Final Testing (Date: ______)
- [ ] Integration tests: ✅ / ❌
- [ ] Performance tests: ✅ / ❌
- [ ] Regression tests: ✅ / ❌
- **Final Sign-off:** ✅ / ❌

---

**Remember:** If in doubt, DON'T merge. Test thoroughly. It's better to take extra time than to break working functionality.
