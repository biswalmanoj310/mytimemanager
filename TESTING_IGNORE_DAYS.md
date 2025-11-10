# Testing the Ignore Days Feature

## Quick Test Checklist

### Prerequisites
- Backend running on http://localhost:8000
- Frontend running on http://localhost:5173
- Have at least 1 incomplete day in the system

### Test Scenario 1: Ignore a Day

1. **Navigate to Daily Tab**
   - Open the app
   - Go to "Daily" tab
   - Scroll to bottom to see "Incomplete Days" section

2. **Ignore a Day**
   - Find an incomplete day in the list
   - Click **[Ignore]** button
   - When prompted, enter reason: "Travel to Bangalore"
   - Click OK

3. **Verify Results**
   - ✅ Day disappears from incomplete days list
   - ✅ Incomplete days count decreases by 1
   - ✅ "View Ignored Days" button shows count increased

### Test Scenario 2: View Ignored Days

1. **Click "View Ignored Days"**
   - Button should show count: "View Ignored Days (1)"
   - Click the button

2. **Verify Ignored Days Section**
   - ✅ Section appears below incomplete days
   - ✅ Shows 🏖️ emoji and title
   - ✅ Lists the ignored day with:
     - Date
     - Reason: "Travel to Bangalore"
     - Allocated and Spent minutes
     - Ignore timestamp
   - ✅ **[Unignore]** button visible

### Test Scenario 3: Unignore a Day

1. **Click [Unignore]**
   - Find the ignored day
   - Click **[Unignore]** button
   - Confirm in the dialog

2. **Verify Results**
   - ✅ Day disappears from ignored days list
   - ✅ Day reappears in incomplete days list
   - ✅ Ignored days count decreases
   - ✅ Incomplete days count increases

### Test Scenario 4: Ignore Without Reason

1. **Ignore Another Day**
   - Click **[Ignore]** on another incomplete day
   - When prompted, click Cancel or leave empty and click OK

2. **Verify**
   - ✅ Day still gets ignored
   - ✅ In ignored days view, shows "No reason specified"

### Test Scenario 5: Multiple Ignores (Travel Scenario)

**Simulate 5-day travel**:

1. **Ignore 5 consecutive days**
   - Nov 10: "Travel to Bangalore - Day 1"
   - Nov 11: "Travel to Bangalore - Day 2"
   - Nov 12: "Travel to Bangalore - Day 3"
   - Nov 13: "Travel to Bangalore - Day 4"
   - Nov 14: "Travel to Bangalore - Day 5"

2. **Verify**
   - ✅ Incomplete days count reduced by 5
   - ✅ View Ignored Days shows all 5 with reasons
   - ✅ Each can be unignored individually

### Test Scenario 6: API Testing (Optional)

**Test Backend Endpoints**:

```bash
# Get incomplete days (should exclude ignored)
curl http://localhost:8000/api/daily-time/incomplete-days/

# Ignore a day
curl -X POST http://localhost:8000/api/daily-time/ignore/2024-11-01 \
  -H "Content-Type: application/json" \
  -d '{"reason": "Sick day"}'

# Get ignored days
curl http://localhost:8000/api/daily-time/ignored-days/

# Unignore a day
curl -X POST http://localhost:8000/api/daily-time/unignore/2024-11-01 \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Expected Database State

**After ignoring a day**:
```sql
SELECT entry_date, is_ignored, ignore_reason, ignored_at 
FROM daily_summary 
WHERE is_ignored = 1;
```

Should show:
- `is_ignored` = 1 (true)
- `ignore_reason` = your entered text or NULL
- `ignored_at` = timestamp of when ignored

## Edge Cases to Test

1. **Toggle View Multiple Times**
   - Click "View Ignored Days" → shows section
   - Click "Hide Ignored Days" → hides section
   - Repeat several times

2. **No Ignored Days**
   - Unignore all days
   - "View Ignored Days (0)" button still visible
   - Clicking it shows empty section or nothing

3. **Refresh Page**
   - Ignore a day
   - Refresh browser
   - ✅ Day still ignored (persisted in DB)
   - ✅ Counts accurate

4. **Navigate Between Tabs**
   - Ignore day in Daily tab
   - Switch to Weekly/Monthly tabs
   - Come back to Daily tab
   - ✅ Ignored days still hidden from incomplete list

## Success Criteria

✅ Ignore button works and prompts for reason
✅ Days move from incomplete to ignored list
✅ Counts update correctly
✅ Reasons display properly (or "No reason specified")
✅ Unignore restores days to incomplete list
✅ Data persists across page refreshes
✅ Database fields populated correctly
✅ No console errors in browser or backend

## Known Issues / Limitations

- Cannot bulk ignore multiple days at once
- No calendar view of ignored days
- Cannot edit reason after ignoring (must unignore and re-ignore)
- Maximum 30 ignored days shown (API limit parameter)

## Report Issues

If you find any bugs, check:
1. Browser console for frontend errors
2. Backend terminal for API errors
3. Database state using sqlite3 commands
