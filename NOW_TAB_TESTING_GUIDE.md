# NOW Tab Testing Guide

## 🧪 QUICK TEST PLAN

Use these steps to verify the NOW tab smart queue management is working correctly.

---

## TEST 1: Default Priority is P10

**Purpose**: Verify new tasks default to P10 (not P5)

**Steps**:
1. Click "Add Task" button
2. Fill in Name, Pillar, Category, Frequency
3. **Do NOT set priority** (leave at default)
4. Save task
5. View task in task list

**Expected Result**: ✅ Task shows "P10" priority

**Why This Matters**: Tasks no longer auto-qualify for NOW tab (P1-P3 only)

---

## TEST 2: NOW Tab Shows Max 3 Tasks

**Purpose**: Verify NOW tab enforces 3-task limit

**Setup**:
1. Create 10 tasks with priorities P1-P10
2. Set all due dates to **today or earlier**
3. Set P1-P3 tasks as "active" (not completed)

**Steps**:
1. Navigate to "NOW" tab
2. Count visible tasks

**Expected Result**: ✅ Exactly 3 tasks shown (P1, P2, P3)
**Expected Result**: ⚠️ Warning message: "10 tasks qualify for NOW (showing top 3)"

**Troubleshooting**:
- If showing <3 tasks: Check due_date is today or earlier
- If showing >3 tasks: Refresh page, check browser console for errors

---

## TEST 3: Due Date Filtering

**Purpose**: Verify future tasks don't appear in NOW tab

**Setup**:
1. Create task with priority P1
2. Set due date to **tomorrow**

**Steps**:
1. Navigate to NOW tab

**Expected Result**: ❌ Task does NOT appear (due date is tomorrow)

**Then**:
1. Edit task, change due date to **today**
2. Refresh NOW tab

**Expected Result**: ✅ Task now appears in NOW tab

---

## TEST 4: Smart Queue Promotion

**Purpose**: Verify auto-promotion when completing high-priority task

**Setup**:
1. Create 6 tasks:
   - Task A: P1, due today
   - Task B: P2, due today
   - Task C: P3, due today
   - Task D: P4, due today (oldest due_date: Jan 1)
   - Task E: P4, due today (newer due_date: Jan 5)
   - Task F: P5, due today

**Steps**:
1. Navigate to NOW tab
2. Verify it shows 3 tasks (A, B, C)
3. ✅ **Complete Task A** (click checkbox)
4. Wait 2 seconds
5. Observe NOW tab

**Expected Result**: 
- ✅ Task A disappears (completed)
- ✅ Task D auto-promotes to P3 (oldest P4 task)
- ✅ NOW tab still shows 3 tasks: B, C, D

**Why Task D Not Task E**:
- Both P4, but Task D has older due_date (Jan 1 vs Jan 5)
- Tie-breaker: oldest due_date wins

**Then Complete Task B**:
1. ✅ Complete Task B
2. Observe NOW tab

**Expected Result**:
- ✅ Task E auto-promotes to P3
- ✅ NOW tab shows: C, D, E

**Then Complete Task C**:
1. ✅ Complete Task C
2. Observe NOW tab

**Expected Result**:
- ✅ Task F auto-promotes to P3
- ✅ NOW tab shows: D, E, F

---

## TEST 5: No Auto-Promotion When 3 Tasks Remain

**Purpose**: Verify system doesn't promote when NOW already has 3 tasks

**Setup**:
1. 4 tasks: P1, P2, P3, P4 (all due today)

**Steps**:
1. Complete a P7 task (NOT in NOW tab)
2. Observe NOW tab

**Expected Result**: ❌ No change (still shows P1, P2, P3)
- Why: Only P1-P3 completion triggers promotion

**Then**:
1. Complete P1 task
2. Observe NOW tab

**Expected Result**: ✅ P4 auto-promotes to P3

---

## TEST 6: Tie-Breaker by Oldest Due Date

**Purpose**: Verify oldest due_date wins when priorities are equal

**Setup**:
1. Create 5 tasks all with priority P7:
   - Task A: due Jan 15
   - Task B: due Jan 5
   - Task C: due Jan 20
   - Task D: due Jan 1
   - Task E: due Jan 10

2. Create 3 tasks P1-P3 (all due today)

**Steps**:
1. Complete P1 task (triggers promotion)
2. Check which P7 task got promoted

**Expected Result**: ✅ Task D promoted (oldest due_date: Jan 1)

**Then Complete P2**:
**Expected Result**: ✅ Task B promoted (next oldest: Jan 5)

**Then Complete P3**:
**Expected Result**: ✅ Task E promoted (next oldest: Jan 10)

---

## TEST 7: Project and Goal Tasks in NOW Tab

**Purpose**: Verify NOW tab includes all task types

**Setup**:
1. Create regular task: P1, due today
2. Create project task: P2, due today
3. Create goal task: P3, due today

**Steps**:
1. Navigate to NOW tab

**Expected Result**: ✅ All 3 tasks visible (regular, project, goal)

**Then Complete Project Task**:
1. ✅ Complete P2 project task
2. Create task with P5, due today

**Expected Result**: ✅ P5 task auto-promotes to P3 and appears in NOW tab

---

## TEST 8: Empty NOW Tab Message

**Purpose**: Verify helpful message when NOW is empty

**Setup**:
1. Complete or delete all P1-P3 tasks
2. Ensure no other tasks have due_date <= today

**Steps**:
1. Navigate to NOW tab

**Expected Result**: 
```
No Urgent Tasks Right Now!

Set task priorities to 1-3 with due dates today or earlier to see them here. 
Max 3 tasks allowed.
```

---

## 🐛 TROUBLESHOOTING

### Issue: "NOW tab shows 20+ tasks again"
**Fix**: 
1. Hard refresh browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. Clear browser cache
3. Restart frontend: `cd frontend && npm start`

### Issue: "Completed task not triggering promotion"
**Check**:
1. Was the completed task P1-P3? (Only high-priority tasks trigger promotion)
2. Are there P4+ tasks with due_date <= today? (No eligible tasks = no promotion)
3. Check browser console for errors (F12)

### Issue: "Priority still defaults to 5"
**Fix**:
1. Restart backend: `cd backend && pkill -f uvicorn && uvicorn app.main:app --reload`
2. Verify: `curl http://localhost:8000/api/tasks/1 | grep priority`

### Issue: "Smart promotion not working"
**Debug**:
1. Open browser console (F12)
2. Complete a P1 task
3. Look for console.log: "Auto-promoting task..."
4. If not present, handleTaskComplete may not be running

---

## ✅ SUCCESS CRITERIA

All tests should pass with these results:

- [ ] Test 1: New task defaults to P10
- [ ] Test 2: NOW shows max 3 tasks
- [ ] Test 3: Future tasks don't appear
- [ ] Test 4: P4 auto-promotes when P1 completes
- [ ] Test 5: No promotion when completing P7
- [ ] Test 6: Oldest due_date promoted first
- [ ] Test 7: Project/Goal tasks work same as regular
- [ ] Test 8: Empty NOW shows helpful message

---

## 📊 QUICK VERIFICATION

Run this to check priority defaults:

```bash
# Backend API test
curl -X POST http://localhost:8000/api/tasks/ \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test Task",
    "follow_up_frequency": "daily",
    "pillar_id": 1,
    "category_id": 1
  }' | python3 -m json.tool | grep priority

# Expected: "priority": 10
```

---

## 🎯 REALISTIC USER SCENARIO

**Morning Workflow**:
1. User has 15 tasks with priorities P1-P10
2. NOW tab shows top 3: "Call client" (P1), "Review proposal" (P2), "Send email" (P3)
3. User completes "Call client"
4. System auto-promotes "Finish report" (oldest P4 task) to P3
5. NOW tab now shows: "Review proposal" (P2), "Send email" (P3), "Finish report" (P3)
6. User always has 3 focus tasks without manual priority management

**Benefit**: User never sees 20 tasks, never manually promotes tasks, system handles queue automatically
