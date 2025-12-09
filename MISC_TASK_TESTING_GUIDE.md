# Quick Testing Guide - Misc Task Improvements

## Prerequisites
```bash
cd /Users/mbiswal/projects/mytimemanager
./start_app.sh  # Starts both backend (port 8000) and frontend (port 3000)
```

## Test Scenarios

### 1. Create Misc Task with New Option ✅

**Steps:**
1. Open http://localhost:3000
2. Click "➕ Add Task" button
3. Fill in task details:
   - Name: "Learn Python Programming"
   - Description: "Complete beginner to advanced course"
   - Follow-up Time: **Select "Misc Task"** ← NEW OPTION
   - Due Date: Set to tomorrow
   - Priority: High
4. Click "Save Task"

**Expected:**
- Task should NOT appear in Today/Daily/Weekly tabs
- Task should appear in Misc tab (may need to create a Misc Group first if none exist)

### 2. Verify Color Coding - Overdue Tasks 🔴

**Steps:**
1. Navigate to Misc tab
2. Create or select a Misc Group
3. Add task with due_date = yesterday (e.g., 2024-01-01)
4. Observe task row

**Expected:**
- Task row has **light red background** (#f8d7da)
- Red left border (4px solid)
- Border color: #f56565

**CSS Classes Applied:** `.task-row.task-overdue`

### 3. Verify Color Coding - Completed Tasks ✅

**Steps:**
1. In Misc tab task list
2. Check the checkbox on an overdue task
3. Observe color change

**Expected:**
- Background changes from red to **light green** (#d4edda)
- Left border changes to green (#48bb78)
- Completed status **overrides** overdue color

**CSS Classes Applied:** `.task-row.completed` (wins over `.task-overdue`)

### 4. Today Tab Integration 📅

**Steps:**
1. Create misc task with due_date = today
2. Switch to "Today" tab
3. Scroll to "Misc Tasks Due Today" section

**Expected:**
- Task appears under dedicated section
- Can complete task from Today tab
- Completion syncs back to Misc tab with green background

**API Endpoint:** `GET /api/misc-tasks/tasks/due-today`

### 5. Hierarchical Structure - Parent/Child 🌳

**Steps:**
1. In Misc tab, create parent task: "Learn Python"
2. Click "➕ Sub" button on the task row
3. Add subtask: "Find Udemy Course"
4. Click "➕ Sub" on the subtask
5. Add sub-subtask: "Enroll in Course"

**Expected:**
- 3 levels of indentation visible
- Expand/collapse buttons (▶/▼) appear
- Subtask count badge shows "📊 0/2" on parent

### 6. Parent Inherits Child Overdue Status 🔴

**Steps:**
1. Create parent task "Complete Project" (due_date = next month)
2. Add subtask "Submit Report" (due_date = yesterday)
3. Observe parent task color

**Expected:**
- Parent task row gets **light red background** even though its own due_date is fine
- This is because child task is overdue
- Inheritance logic in `getDueDateColorClass()` function

### 7. Inline Due Date Editing 📅

**Steps:**
1. Click on the calendar date in task row
2. Change date using date picker
3. Press Enter or click outside

**Expected:**
- Task automatically re-sorts if order changed
- Color coding updates immediately
- No need to refresh page

**Function:** `onUpdateDueDate` prop in TaskNode

### 8. Color Priority Logic 🎨

**Test Matrix:**

| Due Date | Completed | Expected Background | Border Color |
|----------|-----------|-------------------|-------------|
| Yesterday | ❌ | Light Red (#f8d7da) | Red (#f56565) |
| Yesterday | ✅ | Light Green (#d4edda) | Green (#48bb78) |
| Today | ❌ | Light Red (#f8d7da) | Red (#f56565) |
| Tomorrow | ❌ | Light Red (#f8d7da) | Red (#f56565) |
| 5 days out | ❌ | Light Yellow (#fffff0) | Yellow (#ecc94b) |
| 10 days out | ❌ | Light Green (#f0fff4) | Green (#48bb78) |
| Any date | ✅ | Light Green (#d4edda) | Green (#48bb78) |

## Browser Console Testing

Open Developer Tools (F12) and check:

```javascript
// Verify MISC enum exists
console.log(FollowUpFrequency.MISC); // Should output: "misc"

// Check task data structure
console.log(miscTasks[0]);
// Should include:
// {
//   id: 123,
//   name: "Learn Python",
//   due_date: "2024-01-15",
//   is_completed: false,
//   parent_task_id: null,
//   ...
// }
```

## API Testing (Swagger UI)

1. Open http://localhost:8000/docs
2. Navigate to `/api/misc-tasks/tasks/due-today`
3. Click "Try it out" → "Execute"

**Expected Response:**
```json
[
  {
    "id": 1,
    "name": "Task Due Today",
    "due_date": "2024-01-15",  // Today's date
    "is_completed": false,
    "group_name": "Personal Projects"
  }
]
```

## Visual Verification Checklist

- [ ] ✅ Completed tasks have green background
- [ ] 🔴 Overdue tasks have red background  
- [ ] ⚠️ Soon tasks (3-7 days) have yellow background
- [ ] 📊 Subtask count badges visible
- [ ] 🎯 Parent task inherits child overdue color
- [ ] 📅 Inline date picker works
- [ ] ▶/▼ Expand/collapse buttons functional
- [ ] 🗑️ Delete button prompts confirmation
- [ ] ✏️ Edit button opens modal
- [ ] ➕ Add subtask button creates nested task

## Troubleshooting

### Issue: "Misc Task" option not visible in dropdown
**Fix:** Hard refresh browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

### Issue: Colors not showing correctly
**Fix:** 
1. Check browser console for CSS errors
2. Clear cache and hard refresh
3. Verify Tasks.css loaded properly

### Issue: Tasks not appearing in Misc tab
**Fix:**
1. Check task has `follow_up_frequency = 'misc'`
2. Verify task is assigned to a Misc Group
3. Check API response in Network tab (F12)

### Issue: Today tab not showing misc tasks
**Fix:**
1. Verify task due_date = today
2. Check API endpoint: `/api/misc-tasks/tasks/due-today`
3. Refresh Today tab

## Performance Check

- [ ] Page loads in < 2 seconds
- [ ] Task list renders smoothly with 50+ tasks
- [ ] Color changes apply instantly on completion
- [ ] No console errors or warnings
- [ ] Network tab shows successful API calls (200 status)

## Regression Testing

Verify existing features still work:

- [ ] Daily tab time tracking
- [ ] Weekly tab task status
- [ ] Monthly tab cell editing
- [ ] Projects tab task management
- [ ] Habits tracking
- [ ] Goals and milestones

## Success Criteria

All of the following must be true:

1. ✅ Can create task with "Misc Task" frequency option
2. ✅ Overdue tasks show light red background
3. ✅ Completed tasks show light green background
4. ✅ Parent tasks inherit child overdue color
5. ✅ Tasks appear in Today tab when due
6. ✅ Hierarchical indentation visible (3+ levels)
7. ✅ No TypeScript compilation errors
8. ✅ No console errors in browser
9. ✅ Color priorities work correctly (completed > overdue)
10. ✅ Inline due date editing updates colors immediately

## Test Completion Sign-Off

- Date Tested: _________________
- Tester: _________________
- Browser: _________________
- All Tests Passed: ☐ Yes ☐ No
- Issues Found: _________________
- Notes: _________________
