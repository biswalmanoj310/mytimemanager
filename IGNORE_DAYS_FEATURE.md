# Ignore Days Feature Implementation

## Overview
Implemented the "Ignore Days" feature to allow users to mark certain days as ignored (travel, sick days, holidays) without affecting their tracking statistics or showing up as incomplete days.

## Concept Alignment
This feature aligns with productivity philosophy from:

1. **"Getting Things Done" (GTD) by David Allen**
   - "Someday/Maybe" concept - acknowledging reality without guilt
   - System reflects truth, not false obligations

2. **"Atomic Habits" by James Clear**
   - "Never miss twice" principle
   - Distinguishes: intentional pause vs. accidental drift

3. **"The Power of Full Engagement" by Jim Loehr & Tony Schwartz**
   - Recovery periods are essential, not failures
   - High performers build in strategic renewal

## Implementation Details

### Database Changes
**Migration 017**: Added ignore fields to `daily_summary` table
```sql
ALTER TABLE daily_summary ADD COLUMN is_ignored BOOLEAN DEFAULT FALSE;
ALTER TABLE daily_summary ADD COLUMN ignore_reason TEXT;
ALTER TABLE daily_summary ADD COLUMN ignored_at TIMESTAMP;
CREATE INDEX idx_daily_summary_is_ignored ON daily_summary(is_ignored);
```

### Backend Changes

#### Models & Schemas
- Updated `DailySummary` model with new fields
- Added `IgnoreDayRequest` schema (for ignore API)
- Added `IgnoredDayResponse` schema (for listing ignored days)

#### Service Layer (`daily_time_service.py`)
- Modified `get_incomplete_days()` to filter out ignored days
- Added `ignore_day(date, reason)` - Mark a day as ignored
- Added `unignore_day(date)` - Restore day to incomplete list
- Added `get_ignored_days(limit)` - Get list of all ignored days

#### API Endpoints (`daily_time.py`)
- `POST /api/daily-time/ignore/{date}` - Ignore a day (with optional reason)
- `POST /api/daily-time/unignore/{date}` - Unignore a day
- `GET /api/daily-time/ignored-days/` - List all ignored days

### Frontend Changes (`Tasks.tsx`)

#### State Management
```typescript
const [ignoredDays, setIgnoredDays] = useState<any[]>([]);
const [showIgnoredDays, setShowIgnoredDays] = useState(false);
```

#### Functions
- `loadIgnoredDays()` - Load ignored days from API
- `handleIgnoreDay(date, reason)` - Mark day as ignored
- `handleUnignoreDay(date)` - Restore day to incomplete list

#### UI Components

**Incomplete Days Section** (Daily Tab):
- Shows count of incomplete days (excludes ignored)
- Each day has an **[Ignore]** button
- Clicking "Ignore" prompts for optional reason
- **"View Ignored Days"** button in header

**Ignored Days Section** (shown when toggled):
- Lists all ignored days with:
  - Date
  - Reason (if provided)
  - Allocated/Spent time
  - Ignore timestamp
  - **[Unignore]** button

## Usage Scenarios

### When to Ignore Days
- **Travel**: Multi-day trips where normal routine not possible
- **Sick Days**: Too ill to track or maintain routine
- **Family Emergencies**: Unexpected situations requiring full attention
- **Holidays**: Planned vacation/celebration days
- **Digital Detox**: Intentional breaks from tracking

### User Workflow

1. **View Incomplete Days**
   - Go to Daily tab
   - See incomplete days list at bottom

2. **Ignore a Day**
   - Click **[Ignore]** button next to any incomplete day
   - Enter reason (optional): "5-day travel to Bangalore"
   - Day disappears from incomplete list
   - Incomplete count decreases

3. **View Ignored Days**
   - Click **"View Ignored Days (X)"** button
   - See all ignored days with reasons

4. **Restore a Day**
   - Click **[Unignore]** button
   - Confirm restoration
   - Day returns to incomplete list

## Benefits

✅ **Honest Tracking**: System reflects reality, not ideal aspirations
✅ **Guilt-Free Breaks**: Travel/illness don't appear as failures
✅ **Data Integrity**: Ignored days preserved, can be unignored later
✅ **Audit Trail**: Timestamp and reason logged for each ignored day
✅ **Clean Statistics**: Weekly/monthly goals not distorted by exceptional days

## Technical Notes

- Ignored days are soft-deleted (flag-based, not physical deletion)
- Can be restored at any time via unignore
- Incomplete days query filters `is_ignored=true`
- Ignored days have separate endpoint and view
- Reasons are optional but recommended for audit trail

## Example Use Case

**Scenario**: User going on 5-day travel from Nov 10-14, 2025

**Before Feature**:
- 5 incomplete days showing (allocated ≠ spent)
- User feels pressured to "fix" these days
- Weekly/monthly goals appear unmet

**After Feature**:
1. User clicks "Ignore" on Nov 10
2. Enters reason: "Travel to Bangalore"
3. Repeats for Nov 11-14
4. Incomplete days: 5 → 0
5. Can view ignored days separately
6. Upon return, can unignore if desired

## Future Enhancements (Optional)

- Bulk ignore (select multiple days)
- Ignore reason templates/presets
- Calendar view of ignored days
- Statistics showing ignored vs tracked days
- Ignore patterns (every Sunday, holidays, etc.)
