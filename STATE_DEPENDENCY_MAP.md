# 🗺️ Tasks.tsx State Dependency Map

**Baseline Commit:** 5742d1e  
**Purpose:** Document all state variables, their purpose, and cross-dependencies  
**Last Updated:** November 5, 2025

---

## 📊 State Variable Inventory

### Core Task State (Daily Tab)
- **`tasks`** - All tasks from database
- **`pillars`** - Task pillars for filtering
- **`categories`** - Task categories for filtering  
- **`hierarchyOrder`** - Custom pillar/category ordering
- **`taskNameOrder`** - Custom task name ordering
- **`dailyEntries`** - Time entries for today (key: taskId)
- **`dailyAggregates`** - Aggregated time from all entries (key: taskId)
- **`dailySaveTimeout`** - Debounce timer for auto-save

**Used By:** Daily tab, Weekly/Monthly/Yearly tabs (for task selection)

---

### Weekly Tab State
- **`selectedWeekStart`** - Current week being viewed (Monday date)
- **`weeklyEntries`** - Time entries (key: "taskId-dayIndex")
- **`weeklyTaskStatuses`** - Completion/NA status (key: taskId)
- **`weeklyDailyAggregates`** - Daily aggregates from Daily tab
- **`weeklySaveTimeout`** - Auto-save debounce
- **`showAddWeeklyTaskModal`** - Modal visibility
- **`selectedDailyTask`** - Selected task for adding to weekly

**Used By:** Weekly tab only

---

### Monthly Tab State
- **`selectedMonthStart`** - Current month (first day of month)
- **`monthlyEntries`** - Time entries (key: "taskId-dayOfMonth")
- **`monthlyTaskStatuses`** - Completion/NA (key: taskId)
- **`monthlyDailyAggregates`** - Daily aggregates from Daily
- **`monthlySaveTimeout`** - Auto-save debounce
- **`showAddMonthlyTaskModal`** - Modal visibility
- **`selectedDailyTaskForMonthly`** - Selected task

**Used By:** Monthly tab only

---

### Yearly Tab State
- **`selectedYearStart`** - Current year (Jan 1)
- **`yearlyEntries`** - Time entries (key: "taskId-month")
- **`yearlyTaskStatuses`** - Completion/NA (key: taskId)
- **`yearlyMonthlyAggregates`** - Monthly aggregates
- **`yearlySaveTimeout`** - Auto-save debounce
- **`showAddYearlyTaskModal`** - Modal visibility
- **`selectedDailyTaskForYearly`** - Selected task

**Used By:** Yearly tab only

---

### One-Time Tab State
- **`oneTimeTasks`** - One-time task tracking data
- **`showAddOneTimeTaskModal`** - Modal visibility
- **`selectedTaskForOneTime`** - Selected task
- **`editingOneTimeTask`** - Task being edited

**Used By:** One-Time tab only

---

### Projects Tab State
- **`projects`** - All projects
- **`selectedProject`** - Currently selected project
- **`projectMilestones`** - Milestones for selected project
- **`projectTasks`** - Tasks for selected project
- **`expandedTasks`** - Set of expanded task IDs (hierarchy)
- **`editingProject`** - Project being edited
- **`editingTask`** - Task being edited (modal)
- **`editingMilestone`** - Milestone being edited
- **`selectedMilestone`** - For milestone detail view
- **`showAddProjectModal`** - Modal visibility
- **`showAddProjectMilestoneModal`** - Modal visibility
- **`showAddTaskModal`** - Modal visibility
- **`showEditTaskModal`** - Modal visibility
- **`showEditProjectMilestoneModal`** - Modal visibility
- **`showMilestoneDetailModal`** - Modal visibility

**Used By:** Projects tab only

---

### Misc Tasks Tab State
- **`miscTaskGroups`** - Misc task groups
- **`selectedMiscGroup`** - Selected group
- **`miscTasks`** - Tasks in selected group
- **`showAddMiscGroupModal`** - Modal visibility (MISSING)
- **`showAddMiscTaskModal`** - Modal visibility (MISSING)
- **`editingMiscGroup`** - Group being edited
- **`editingMiscTask`** - Task being edited

**Used By:** Misc tab only

---

### Habits Tab State ⚠️ BROKEN
- **`habits`** - All habits
- **`selectedHabit`** - Selected habit for details
- **`habitEntries`** - Habit entries (unused?)
- **`habitStreaks`** - Streak data (unused?)
- **`showAddHabitModal`** - Modal visibility (MISSING)
- **`showHabitDetailsModal`** - Modal visibility (MISSING)
- **`editingHabit`** - Habit being edited

**Used By:** Habits tab only  
**Issues:** Many handlers present but modals missing

---

### Wishes Tab State
- **`wishes`** - All wishes/dreams
- **`selectedWish`** - Wish for details view
- **`showAddWishModal`** - Modal visibility (MISSING)
- **`showWishDetailsModal`** - Modal visibility (MISSING)

**Used By:** Wishes tab only

---

### Life Goals Tab State
- **`lifeGoals`** - All life goals
- **`selectedGoal`** - Selected goal
- **`goalMilestones`** - Milestones for goal
- **`goalTasks`** - Tasks for goal
- **`linkedTasks`** - Tasks linked to goal
- **`showAddGoalModal`** - Modal visibility (MISSING)
- **`showAddMilestoneModal`** - Modal visibility (MISSING)
- **`showAddGoalTaskModal`** - Modal visibility (MISSING)
- **`showLinkTaskModal`** - Modal visibility (MISSING)

**Used By:** Life Goals tab only

---

### UI State (Global)
- **`activeTab`** - Current tab ('daily' | 'weekly' | 'monthly' etc.)
- **`selectedDate`** - Date for Daily tab
- **`hoveredColumn`** - Column hover state (for highlighting)
- **`focusedCell`** - Keyboard navigation focus
- **`showNeedsAttentionWeekly`** - Toggle section visibility
- **`showNeedsAttentionMonthly`** - Toggle section visibility
- **`isTaskFormOpen`** - TaskForm modal state
- **`selectedTaskId`** - Task ID for TaskForm
- **`isCreatingNewTask`** - Flag for task creation
- **`addToTrackingAfterCreate`** - Auto-add to weekly/monthly after create

**Used By:** Multiple tabs

---

## 🔗 Cross-Tab Dependencies

### Shared Across Multiple Tabs
```
tasks, pillars, categories, hierarchyOrder, taskNameOrder
└─ Used by: Daily, Weekly, Monthly, Yearly, One-Time, Projects, Habits
   └─ MUST be in global context

dailyAggregates
└─ Used by: Daily (source), Weekly, Monthly (display)
   └─ Should be in context or passed as prop

lifeGoals
└─ Used by: Goals tab, Projects tab (linking)
   └─ Should be in context
```

### Independent State (Tab-Specific)
```
Weekly: weeklyEntries, weeklyTaskStatuses, selectedWeekStart
Monthly: monthlyEntries, monthlyTaskStatuses, selectedMonthStart  
Yearly: yearlyEntries, yearlyTaskStatuses, selectedYearStart
Projects: projects, projectMilestones, projectTasks
Habits: habits, habitEntries, habitStreaks
etc.
└─ Can stay in individual page components
```

---

## 🎯 Refactoring Strategy

### Move to Global Context
**TaskContext.tsx:**
- tasks
- pillars
- categories
- hierarchyOrder
- taskNameOrder
- lifeGoals
- loadTasks()
- loadPillars()
- loadCategories()
- loadLifeGoals()

**TimeEntriesContext.tsx:**
- dailyEntries
- dailyAggregates
- loadDailyEntries()
- saveDailyEntry()

**UserPreferencesContext.tsx:**
- activeTab
- selectedDate
- filters (pillar, category)
- UI preferences

### Keep in Page Components
- Tab-specific entries (weekly, monthly, yearly)
- Tab-specific statuses
- Tab-specific navigation dates
- Modal visibility states
- Editing states (local to page)

---

## 🚨 Critical Dependencies to Preserve

### Data Flow: Daily → Weekly/Monthly/Yearly
```
1. User logs time in Daily tab
   └─ Saves to dailyEntries
   └─ Aggregates calculated → dailyAggregates

2. User views Weekly tab
   └─ Fetches weeklyEntries (this week)
   └─ Displays dailyAggregates (from Daily) as fallback
   └─ Shows combined view

3. Same pattern for Monthly and Yearly
```

**MUST MAINTAIN:** Daily aggregates must be accessible to Weekly/Monthly/Yearly

### Status Independence
```
Daily tab: Task marked complete
└─ Does NOT affect Weekly/Monthly/Yearly status

Weekly tab: Task marked complete for week
└─ Does NOT affect Daily or other tabs

Each tab has independent completion tracking!
```

**MUST MAINTAIN:** Separate status tracking per tab

---

## 📋 Migration Checklist

### Phase 1: Extract to Context
- [ ] Create TaskContext with tasks, pillars, categories
- [ ] Create TimeEntriesContext with dailyEntries, dailyAggregates
- [ ] Create UserPreferencesContext with UI state
- [ ] Verify: All components can access context
- [ ] Verify: No prop drilling needed

### Phase 2: Split Pages
- [ ] WeeklyTasks: Move weekly* state variables
- [ ] MonthlyTasks: Move monthly* state variables
- [ ] YearlyTasks: Move yearly* state variables
- [ ] Verify: Each page independent
- [ ] Verify: Shared context accessible

### Phase 3: Validate Data Flow
- [ ] Daily → Weekly aggregates flow
- [ ] Daily → Monthly aggregates flow
- [ ] Daily → Yearly aggregates flow
- [ ] Status independence maintained
- [ ] Task creation → auto-add works

---

**Next:** Use this map when creating contexts and splitting pages
