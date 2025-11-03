# Quick Testing Guide - Challenges Feature

## Prerequisites
- Backend running on port 8000
- Frontend running on port 3003
- Database migrations executed

## Start Services

### Backend
```bash
cd /Users/mbiswal/projects/mytimemanager
./start_backend.sh
```

### Frontend
```bash
cd /Users/mbiswal/projects/mytimemanager
./start_frontend.sh
```

Or start both:
```bash
./start_all.sh
```

## Test Plan

### 1. Test Project Improvements (5 minutes)

#### Navigate to Projects Tab
1. Open browser: `http://localhost:3003`
2. Click **Tasks** in sidebar
3. Scroll to **Projects** tab (3rd tab)

#### Verify Project Stats Display
Look for project cards with 4-column stats:
- **Total**: Should show number (e.g., 5)
- **Done**: Green color, completed count
- **Pending**: Gray color, pending count
- **⚠️ Overdue**: Red color with warning emoji, overdue count

Expected: All 4 stats displayed correctly with proper colors.

#### API Test (Optional)
```bash
curl http://localhost:8000/api/projects/4 | jq '.progress'
```

Expected output:
```json
{
  "total_tasks": 5,
  "completed_tasks": 2,
  "pending_tasks": 3,
  "overdue_tasks": 1,
  "progress_percentage": 40.0
}
```

---

### 2. Test Challenges Feature (15 minutes)

#### Navigate to Challenges Page
1. Open browser: `http://localhost:3003`
2. Click **Challenges** (Trophy icon 🏆) in sidebar
3. Should see: "🎯 Challenges" header

#### Verify Sample Challenges Display
Should see 4 active challenge cards with colorful gradients:

1. **🍎 Eat 7 Fruits Daily**
   - Type: Daily Streak (🔥 flames)
   - Difficulty: Hard (red background)
   - Shows: Streak visualization

2. **🥾 7 Treks in a Month**
   - Type: Count-based (🎯)
   - Difficulty: Medium (pink background)
   - Shows: Progress bar (0/7 treks)

3. **📚 Read 300 Pages**
   - Type: Accumulation (📈)
   - Difficulty: Medium
   - Shows: Progress bar (0/300 pages)

4. **🚶 Walk 10,000 Steps Daily**
   - Type: Daily Streak (🔥)
   - Difficulty: Easy (green background)
   - Shows: Streak visualization

#### Test Daily Logging
1. Click "📝 Log Today" on "🍎 Eat 7 Fruits Daily"
2. Modal opens with:
   - Date picker (defaults to today)
   - Checkbox: "Did you complete this today?"
   - Mood selector (4 options)
   - Notes textarea
3. Check the completion checkbox
4. Select mood: "😄 Great"
5. Add note: "Had apple, banana, and grapes!"
6. Click "Log Entry"

Expected: 
- Modal closes
- Challenge card updates with 🔥 flame
- Current streak shows "1 day streak"
- Completed days shows "1 days completed"

#### Test Count-Based Challenge
1. Click "📝 Log Today" on "🥾 7 Treks in a Month"
2. Modal shows:
   - Date picker
   - Number input: "Count (treks)"
   - Mood selector
   - Notes
3. Enter count: `1`
4. Click "Log Entry"

Expected:
- Progress bar updates to 1/7 (14%)
- "1 days completed" displayed

#### Test Challenge Details
1. Click anywhere on a challenge card (not on buttons)
2. Details modal opens showing:
   - **Stats Grid**: 6 stats
     - Days Elapsed: 1
     - Days Remaining: 6 (or whatever's left)
     - Days Completed: 1
     - Completion Rate: 14% (1/7 days)
     - Success Rate: 100% (if logged today)
     - On Track: ✅ (if >= 70% success)
   - **Recent Entries**: List of logged entries
     - Date, completion status, mood emoji, notes
3. Click "Close"

Expected: Modal displays correct stats and entries.

#### Test Multiple Entries
1. Log entries for multiple days (change date in picker)
2. Click challenge card to view details
3. Check "Recent Entries" section

Expected: All entries appear in chronological order.

#### Test Streak Calculation
1. Log completion for consecutive days
2. Check streak counter increases: 🔥🔥🔥
3. Skip a day (don't log)
4. Log next day
5. Check streak resets to 1

Expected: Streak only counts consecutive days from today backward.

---

### 3. API Testing (Optional)

#### List Challenges
```bash
curl http://localhost:8000/api/challenges/ | jq
```

#### Get Challenge Details
```bash
curl http://localhost:8000/api/challenges/1 | jq
```

#### Log Entry (Daily Streak)
```bash
curl -X POST http://localhost:8000/api/challenges/1/log \
  -H "Content-Type: application/json" \
  -d '{
    "entry_date": "2024-11-03",
    "is_completed": true,
    "mood": "great",
    "note": "Feeling motivated!"
  }' | jq
```

#### Log Entry (Count-Based)
```bash
curl -X POST http://localhost:8000/api/challenges/2/log \
  -H "Content-Type: application/json" \
  -d '{
    "entry_date": "2024-11-03",
    "count_value": 1,
    "mood": "good"
  }' | jq
```

#### Get Challenge Stats
```bash
curl http://localhost:8000/api/challenges/1/stats | jq
```

Expected: Returns comprehensive stats with 17 metrics.

#### Get Entries
```bash
curl http://localhost:8000/api/challenges/1/entries | jq
```

Expected: Returns all logged entries.

---

### 4. Graduate to Habit (Advanced)

#### Prerequisites
Complete a challenge first:
1. Create a 7-day challenge
2. Log entries for all 7 days
3. Challenge should auto-complete when target reached

#### Test Graduation
1. Navigate to Challenges page
2. Find completed challenge card
3. Should see "⬆️ Graduate to Habit" button
4. Click the button
5. Confirm dialog: "Graduate this challenge to a permanent habit?"
6. Click OK

Expected:
- Alert: "Challenge graduated to habit successfully!"
- Challenge card now shows: "⬆️ Graduated to Habit #X"
- Check Habits tab to verify new habit created

#### Verify Habit Created
1. Go to Tasks page → Habits tab
2. Find new habit with same name as challenge
3. Verify pillar inherited from challenge

---

### 5. Edge Cases & Error Handling

#### Test Date Validation
1. Try logging future date
   - Date picker should max at today

#### Test Duplicate Entry
1. Log entry for today
2. Try logging again for same date
   - Should update existing entry (upsert)

#### Test Invalid Data
API tests:
```bash
# Missing required fields
curl -X POST http://localhost:8000/api/challenges/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "challenge_type": "daily_streak",
    "start_date": "2024-11-03",
    "end_date": "2024-11-10"
  }' | jq
```

Expected: 400 error - "Missing target_days for daily_streak"

---

### 6. Visual Checks

#### Color Gradients
- Easy challenges: Green gradient
- Medium challenges: Pink gradient
- Hard challenges: Red-yellow gradient
- Completed challenges: Black gradient (faded)

#### Hover Effects
- Challenge cards lift 4px on hover
- Buttons scale 1.05x on hover

#### Responsive Design
1. Resize browser to mobile width (<768px)
2. Check:
   - Single column grid
   - Stats grid becomes 2 columns
   - Entry items stack vertically

---

## Success Criteria

### Project Improvements ✓
- [x] 4-stat grid displays correctly
- [x] Overdue count accurate (red color)
- [x] Backend returns pending_tasks and overdue_tasks

### Challenges Feature ✓
- [x] 4 sample challenges display
- [x] Navigation link works (Trophy icon)
- [x] Logging modal opens and submits
- [x] Stats update after logging
- [x] Streak calculation works
- [x] Details modal shows stats + entries
- [x] Graduation to habit works
- [x] API endpoints respond correctly

---

## Troubleshooting

### Backend not starting?
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend not starting?
```bash
cd frontend
npm install
npm run dev
```

### Database issues?
```bash
cd backend
sqlite3 database/mytimemanager.db
.tables  # Should show challenges, challenge_entries, project_milestones
.schema challenges  # View table structure
SELECT * FROM challenges;  # View sample data
.quit
```

### API 404 errors?
- Check backend logs for import errors
- Verify challenges.py exists in app/routes/
- Verify main.py includes challenges router

### Frontend blank page?
- Check browser console for errors (F12)
- Verify Challenges.tsx and Challenges.css exist
- Check network tab for API call failures

---

## Quick Smoke Test (2 minutes)

```bash
# 1. Check backend health
curl http://localhost:8000/health

# 2. Check challenges endpoint
curl http://localhost:8000/api/challenges/ | jq 'length'
# Expected: 4

# 3. Open frontend
open http://localhost:3003/challenges

# 4. Visual check
# - See 4 colorful challenge cards
# - Click "Log Today" on any challenge
# - Fill form and submit
# - Verify card updates

# Done! ✅
```

---

## Next Actions

After successful testing:
1. Commit changes to git
2. Update user documentation
3. Optional: Add Challenges widget to Dashboard
4. Optional: Integrate into Today tab for daily logging

---

## Support

If issues occur:
1. Check browser console (F12)
2. Check backend terminal logs
3. Verify database schema: `sqlite3 database/mytimemanager.db ".schema challenges"`
4. Test API directly with curl commands
5. Review error messages in UI

Happy testing! 🎉
