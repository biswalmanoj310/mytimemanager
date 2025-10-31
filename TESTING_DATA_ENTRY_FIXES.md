# Data Entry Bug Fixes - Testing Guide

## Issues Fixed

### 1. **Mouse Wheel Changing Values**
- **Problem**: Scrolling with mouse wheel over number inputs was changing values
- **Fix**: Added `onWheel` handler that prevents default behavior and blurs the input
- **Files Changed**: `frontend/src/pages/Tasks.tsx` (Time and Count input fields)

### 2. **State/Ref Synchronization Issues**
- **Problem**: `hourlyEntries` state and `hourlyEntriesRef.current` were out of sync
- **Root Cause**: 
  - `handleHourlyTimeChange` was mutating ref but creating new state object
  - `getHourlyTime` was reading from state while values were in ref
- **Fix**: 
  - Simplified `handleHourlyTimeChange` to keep state and ref in perfect sync
  - Both are now updated together with the same object
  - Removed complex wheel/paste detection logic that was causing issues

### 3. **Invalid Input Handling**
- **Problem**: Invalid inputs (NaN, negative numbers) could corrupt data
- **Fix**: Added validation to reject invalid inputs early

### 4. **Data Loading**
- **Problem**: `loadDailyEntries` wasn't syncing state and ref properly
- **Fix**: Now updates both ref and state in the correct order, with error handling

## Code Changes Summary

### handleHourlyTimeChange (Simplified)
```typescript
const handleHourlyTimeChange = (taskId: number, hour: number, value: string) => {
  // Parse and validate
  const minutes = value === '' ? 0 : parseInt(value);
  if (isNaN(minutes) || minutes < 0) {
    return; // Reject invalid input
  }
  
  const key = `${taskId}-${hour}`;
  
  // Update BOTH ref and state together (keep in sync)
  const newEntries = {
    ...hourlyEntriesRef.current,
    [key]: minutes
  };
  
  hourlyEntriesRef.current = newEntries;
  setHourlyEntries(newEntries);
  
  // Debounced auto-save (1 second)
  // ... rest of save logic
};
```

### Input Protection
```typescript
<input
  type="number"
  onWheel={(e) => {
    e.preventDefault();
    e.currentTarget.blur();
  }}
  // ... other props
/>
```

## Testing Instructions

### Test 1: Basic Data Entry
1. Go to Tasks → Daily tab
2. Select date: 10/29/2025
3. Click on a time-based task hour cell
4. Type a number (e.g., 30)
5. **Expected**: Value should stay as 30, not change to something else

### Test 2: Mouse Wheel Prevention
1. Click on an input field
2. Try to scroll with mouse wheel
3. **Expected**: Input should blur (lose focus), value should NOT change

### Test 3: Navigation Between Cells
1. Enter a value in one cell
2. Use arrow keys or click to move to next cell
3. **Expected**: Previous value should remain unchanged

### Test 4: Auto-Save
1. Enter a value
2. Wait 1 second
3. **Expected**: Console should show save request, Weekly tab should update

### Test 5: Data Persistence
1. Enter several values
2. Refresh the page (F5)
3. **Expected**: All entered values should be preserved

### Test 6: Invalid Input Prevention
1. Try to enter negative numbers
2. Try to enter letters
3. **Expected**: Invalid inputs should be rejected/ignored

### Test 7: Multiple Tasks
1. Enter values for multiple tasks in the same hour column
2. Check Total row
3. **Expected**: Total should correctly sum all values

### Test 8: Date Switching
1. Enter values for 10/29
2. Switch to different date (10/30)
3. Switch back to 10/29
4. **Expected**: Values from 10/29 should reload correctly

## Monitoring

Watch browser console for:
- Save confirmations
- Error messages
- Validation warnings

## If Issues Persist

### Debug Steps:
1. Open Browser DevTools (F12)
2. Go to Console tab
3. Try to reproduce the issue
4. Look for error messages or warnings
5. Check Network tab for failed API calls

### Common Issues:
- **Values still changing**: Check if mouse wheel is triggering despite fix
- **Values not saving**: Check Network tab for failed API calls
- **Values disappearing**: Check if `loadDailyEntries` is being called multiple times

## Backend Check

If frontend looks good but data isn't persisting:
```bash
cd /Users/mbiswal/projects/mytimemanager/backend
# Check if backend is running
curl http://localhost:8000/api/daily-time/entries/2025-10-29
```

Should return JSON with saved entries.

## Rollback (If Needed)

The changes are focused in these functions:
- `handleHourlyTimeChange` (lines ~2558-2590)
- `getHourlyTime` (lines ~2682-2687)
- `loadDailyEntries` (lines ~737-758)
- Input elements in Daily tab (lines ~4350-4385, ~4530-4560)

Git can help revert if needed.
