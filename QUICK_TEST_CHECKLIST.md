# Quick Test Checklist ✅

## When You Return (After 3-4 Hours)

### 🔴 Critical Tests (Must Work)

1. **Basic Entry Test**
   - Go to: Tasks → Daily → 10/29/2025
   - Click any time cell
   - Type: `30`
   - Result: Should show `30` (NOT `36` or any other number)

2. **Mouse Scroll Test**
   - Click a cell
   - Scroll mouse wheel
   - Result: Input should lose focus, value should NOT change

3. **Navigation Test**
   - Enter `30` in one cell
   - Press Tab or click next cell
   - Result: First cell should still show `30`

4. **Persistence Test**
   - Enter several values
   - Press F5 to refresh
   - Result: All values should remain

### 🟡 Important Tests (Should Work)

5. **Total Row**
   - Enter values in multiple task rows for same hour
   - Check Total row at bottom
   - Result: Should sum correctly

6. **Weekly Aggregation**
   - Enter values in Daily tab
   - Switch to Weekly tab
   - Result: Should show aggregated data

7. **Date Switching**
   - Enter values for 10/29
   - Switch to 10/30
   - Switch back to 10/29
   - Result: 10/29 values should reload

### 🟢 Nice-to-Have Tests

8. **Auto-Save**
   - Enter a value
   - Wait 1-2 seconds
   - Check browser console (F12)
   - Result: Should see save request

9. **Invalid Input**
   - Try typing letters
   - Try negative numbers
   - Result: Should be rejected/ignored

10. **Multiple Tasks**
    - Enter values for 5-10 different tasks
    - Navigate between them
    - Result: All values stay correct

## What to Look For

### ✅ Good Signs:
- Numbers stay the same after typing
- No weird auto-changes
- Mouse scroll doesn't affect values
- Values persist after refresh
- Weekly tab updates correctly

### ❌ Bad Signs:
- Numbers change after entering
- Random "1" appears in cells
- Mouse scroll changes values
- Values disappear after refresh
- Console shows errors

## If Something Fails

1. **Open Browser Console** (F12)
2. **Look for red error messages**
3. **Try the same action again** (might be one-time glitch)
4. **Note which specific test failed**
5. **Check if it's consistent** (happens every time)

## Quick Fixes to Try

### Issue: Values still changing
```bash
# Hard refresh browser
Cmd + Shift + R (Mac)
Ctrl + Shift + R (Windows)
```

### Issue: Values not saving
```bash
# Check backend is running
curl http://localhost:8000/api/daily-time/entries/2025-10-29
```

### Issue: App not loading
```bash
# Restart frontend
cd /Users/mbiswal/projects/mytimemanager/frontend
lsof -ti:3003 | xargs kill -9
npm run dev
```

## Success Criteria

**The fix is successful if:**
1. You can enter `30` and it stays `30`
2. Mouse wheel doesn't change values
3. Moving between cells doesn't auto-enter values
4. Data persists after refresh
5. No console errors

## Current Status

- ✅ Frontend running: http://localhost:3003
- ✅ Backend running: http://localhost:8000
- ✅ Code changes compiled successfully
- ✅ No TypeScript errors
- ⏳ Awaiting user testing

## Documentation Files

- **BUG_FIX_SUMMARY.md** - Detailed technical explanation
- **TESTING_DATA_ENTRY_FIXES.md** - Comprehensive testing guide
- **THIS FILE** - Quick checklist

---

**Fixed**: October 30, 2025, 8:38 AM
**Status**: Ready for testing
**Priority**: CRITICAL - Main feature
**Expected Result**: All data entry should work correctly now
