# Tasks.tsx Refactoring - Validation Checklist
**Date**: November 5, 2025
**Goal**: Reduce from 557KB to ~190KB while preserving ALL functionality from last 2 days

---

## 📊 Size Reduction Plan
- **Current**: 557KB (12,096 lines)
- **After Modals Extract**: ~330KB (9,270 lines) - Extract 2,825 lines
- **After Habits Extract**: ~240KB (6,270 lines) - Extract 3,000 lines  
- **After Projects Extract**: ~190KB (4,770 lines) - Extract 1,500 lines
- **Final Target**: ~190KB (62% reduction, WELL under 500KB limit)

---

## ✅ Critical Features to Validate (Last 2 Days Work)

### 1. Weekly Tab ⭐ HIGH PRIORITY
- [ ] Column headers display correctly:
  - [ ] "Ideal Average/Day" column header visible
  - [ ] "Actual Average/Day" column header visible
  - [ ] "Average Required/Day" column header visible
- [ ] Calculations are correct and displaying
- [ ] Needs Attention section has enhanced UI formatting
- [ ] Task completion works
- [ ] Status colors are correct
- [ ] Weekly tracking properly cascades from Daily tab

### 2. Monthly Tab ⭐ HIGH PRIORITY
- [ ] Column headers display correctly (same as Weekly):
  - [ ] "Ideal Average/Day" column header visible
  - [ ] "Actual Average/Day" column header visible
  - [ ] "Average Required/Day" column header visible
- [ ] Monthly calculations display correctly
- [ ] Needs Attention section has enhanced UI formatting
- [ ] Monthly tracking properly cascades from Daily tab
- [ ] Status colors are correct

### 3. Today Tab - Needs Attention ⭐ HIGH PRIORITY
- [ ] Needs Attention section has beautiful formatting
- [ ] Red background highlighting for overdue tasks
- [ ] Proper grouping and display
- [ ] Daily tasks display correctly
- [ ] Completed tasks show properly
- [ ] NA (Not Applicable) marking works

### 4. Projects Tab ⭐ HIGH PRIORITY
**Recent Improvements (from few hours ago):**
- [ ] `expandedSections` state works for collapsible sections
- [ ] Milestones section is collapsible (▼/▶ icon)
- [ ] "All Tasks" section is collapsible (▼/▶ icon)
- [ ] Both sections start expanded by default
- [ ] Collapse/expand animations work smoothly
- [ ] Project list view displays correctly
- [ ] Project detail view displays correctly
- [ ] Red background for overdue tasks in project view

**Note**: projectTaskFilter (Show All/In Progress/Completed/No Milestone buttons) was NOT in git commit, check if needed

### 5. Daily Tab
- [ ] Daily tasks display and sort correctly
- [ ] Completion toggles work
- [ ] NA marking works
- [ ] Tasks auto-hide after completion/NA (as per lifecycle)
- [ ] Cascade to Weekly/Monthly works (only if already monitored)

### 6. Quarterly Tab
- [ ] Quarterly tasks display
- [ ] Status tracking works

### 7. Yearly Tab
- [ ] Yearly tasks display
- [ ] Year-specific completion status works
- [ ] Independent from daily completion

### 8. Important Tasks Tab
- [ ] Important tasks display
- [ ] Filtering works

### 9. Misc Tab
- [ ] Misc task groups display
- [ ] Task creation works
- [ ] Task completion works

### 10. Habits Tab
- [ ] Habit list displays
- [ ] Period tracking works (weekly/monthly)
- [ ] Session marking works
- [ ] Aggregate tracking works
- [ ] Statistics display correctly

---

## 🔧 Components to Extract

### Extract 1: TaskModals.tsx (~2,825 lines, ~150KB)
**Location**: Lines 9270-12095

**Modals to Extract**:
1. AddWeeklyTask Modal
2. AddMonthlyTask Modal  
3. AddYearlyTask Modal
4. AddOneTimeTask Modal
5. AddProject Modal
6. AddMilestone Modal
7. EditMilestone Modal
8. AddTask Modal
9. EditTask Modal
10. AddMiscGroup Modal
11. AddMiscTask Modal
12. AddWish Modal
13. WishDetails Modal
14. AddHabit Modal
15. MilestoneDetail Modal

**Props Needed**:
- All modal show/hide states
- All modal setters
- All data (tasks, projects, habits, etc.)
- All handler functions (handleCreate, handleUpdate, etc.)

### Extract 2: HabitsTab.tsx (~3,000 lines, ~90KB)
**Includes**:
- Habit list display
- Period tracking UI
- Session management
- Aggregate tracking
- Statistics display
- All habit-related state and functions

### Extract 3: ProjectsTab.tsx (~1,500 lines, ~50KB)
**Includes**:
- Project list view
- Project detail view
- Milestones section (with expandedSections)
- All Tasks section (with expandedSections)
- Task hierarchy display
- All project-related state and functions

---

## 🧪 Testing Strategy

### Phase 1: After Modal Extraction
1. Verify all tabs still render
2. Test opening each modal type
3. Verify modal data flows correctly
4. Check all create/edit/delete operations

### Phase 2: After Habits Extraction
1. Verify Habits tab loads
2. Test habit tracking functionality
3. Verify period stats display
4. Check navigation between tabs

### Phase 3: After Projects Extraction  
1. Verify Projects tab loads
2. Test expandedSections (collapsible Milestones/All Tasks)
3. Verify project navigation
4. Test task creation/editing
5. Verify milestone functionality

### Phase 4: Final Validation
- Run through ENTIRE checklist above
- Test all tabs in sequence
- Verify file size is under 500KB
- Confirm no console errors
- Check performance (page load time)

---

## 🚨 Red Flags to Watch For

1. **Missing imports** - Ensure all types/interfaces are imported
2. **State lifting issues** - Props might need to be passed correctly
3. **Handler references** - Functions must be passed as props
4. **Type errors** - TypeScript compilation must succeed
5. **Console errors** - No runtime JavaScript errors
6. **Blank screens** - Components must render
7. **Lost improvements** - Verify Weekly/Monthly headers, Today formatting, Projects expandedSections

---

## 📝 Before Each Extraction - Checklist

- [ ] Identify exact line numbers to extract
- [ ] List all dependencies (state, props, handlers)
- [ ] Check if code exists elsewhere (avoid duplication)
- [ ] Ask user about behavior if unclear
- [ ] Create component file with proper structure
- [ ] Import all required types/interfaces
- [ ] Update parent component imports
- [ ] Test compilation
- [ ] Test runtime functionality

---

## ✅ Success Criteria

1. **File size**: Tasks.tsx under 250KB (safe margin under 500KB)
2. **Functionality**: ALL features from checklist work perfectly
3. **No regressions**: Nothing that worked before is broken
4. **Clean code**: Properly organized, maintainable components
5. **TypeScript**: Zero compilation errors
6. **Runtime**: No console errors, smooth performance
7. **Last 2 days work**: Weekly/Monthly headers, Today formatting, Projects collapsible sections ALL working

---

## 📞 Questions for User Before Proceeding

1. **projectTaskFilter**: I see expandedSections in git, but projectTaskFilter (Show All/In Progress/Completed/No Milestone buttons) is only in the backup. Was this feature actually implemented and working for you?

2. **Scroll-to-view**: The data-task-id attributes and scroll behavior - was this working in your version?

3. **Red backgrounds**: getTaskColorClass function for overdue highlighting - is this showing correctly in Today tab and Projects tab for you now?

4. **Any other features**: Are there any other specific features from the last 2 days that I should be extra careful to preserve?
