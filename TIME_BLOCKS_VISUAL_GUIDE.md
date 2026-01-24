# Time Blocks Feature - Visual Guide

## What Changed for Your Daughter 🎯

### BEFORE (24-Hour Engineer View)
```
┌─────────────────────────────────────────────────────┐
│  Daily Time Tracking - January 23, 2026              │
├─────────────────────────────────────────────────────┤
│                                                       │
│  0h  1h  2h  3h  4h  5h  6h  7h  8h  9h  10h  11h    │
│  ☐   ☐   ☐   ☐   ☐   ☐   ☐   ☐   ☐   ☐   ☐    ☐    │
│                                                       │
│  12h 13h 14h 15h 16h 17h 18h 19h 20h 21h 22h 23h    │
│  ☐   ☐   ☐   ☐   ☐   ☐   ☐   ☐   ☐   ☐   ☐   ☐    │
│                                                       │
│  Task: Code Review                                   │
│  Allocated: 120 mins | Spent: 90 mins               │
└─────────────────────────────────────────────────────┘
```
**Problem for kids:**
- Too many columns (24 hours)
- Military time format (0-23)
- Not intuitive for school schedules

---

### AFTER (School Day View)
```
┌─────────────────────────────────────────────────────┐
│  Daily Time Tracking - January 23, 2026              │
├─────────────────────────────────────────────────────┤
│                                                       │
│  🌅 Morning       🏫 School           🎮 After School │
│  (6-8 AM)        (8 AM - 3 PM)       (3-5 PM)       │
│  ────────        ──────────────      ─────────────  │
│  Breakfast       Math                Games           │
│  Get ready       Science             Homework        │
│                  Lunch                               │
│                  PE                                  │
│                                                       │
│  👨‍👩‍👦 Family       😴 Sleep                            │
│  (5-9 PM)        (9 PM - 6 AM)                      │
│  ─────────       ───────────────                     │
│  Dinner          Sleeping                            │
│  Play                                                │
│  Stories                                             │
│                                                       │
│  Task: Math Homework                                 │
│  Allocated: 60 mins | Spent: 45 mins                │
└─────────────────────────────────────────────────────┘
```
**Benefits for kids:**
- 5 blocks instead of 24 columns
- AM/PM format (kid-friendly)
- Named blocks (Morning, School, etc.)
- Can track multiple activities within each block

---

## How It Works 🎨

### 1. Time Block Configuration

**In "My Day Design" → "Time Blocks" tab:**

```
Standard 24-hour (Default - For Dad)
├── Display: 24 columns (0h, 1h, 2h, ... 23h)
├── Format: 24-hour
└── Use: Professional hourly tracking

School Day (For Daughter)
├── Morning (6-8 AM)        - Green
├── School (8 AM-3 PM)      - Orange  
├── After School (3-5 PM)   - Blue
├── Family Time (5-9 PM)    - Purple
└── Sleep (9 PM-6 AM)       - Gray

Work Day (For Wife/Teachers)
├── Morning Prep (6-7 AM)   - Green
├── Teaching (7 AM-3 PM)    - Orange
├── Grading (3-6 PM)        - Blue
└── Evening (6 PM-6 AM)     - Purple
```

### 2. What Happens When You Switch

**Storage Layer (Always the Same):**
```sql
daily_time_entries table:
- task_id: 42
- date: 2026-01-23
- hour: 9          ← Always absolute hour (0-23)
- minutes: 60      ← Time spent
```

**Display Layer (Changes):**

**Standard 24h View:**
```
Shows in column: "9h" (9:00)
```

**School Day View:**
```
Hour 9 is inside "School (8 AM - 3 PM)" block
Shows grouped with other school hours
```

---

## Example Workflow 👧

### Your Daughter's Day

**Morning - My Day Design Setup:**
1. Navigate to "My Day Design"
2. Click "⏰ Time Blocks" tab
3. See preset templates
4. Click "Use Template" on "School Day"
5. Click "Activate"

**During Day - Daily Tab:**
1. Go to "Daily" tab
2. Instead of 24 hour columns, sees 5 blocks:
   - Morning (6-8 AM)
   - School (8-3 PM)
   - After School (3-5 PM)  
   - Family (5-9 PM)
   - Sleep (9-6 AM)

**Example Task: Math Homework**
```
Task: Math Homework
Pillar: School
Category: Academics
Allocated: 60 minutes

In School block (8 AM - 3 PM):
- 10 AM: 30 minutes (in class)
- 2 PM: 30 minutes (homework time)

Total: 60 minutes (100% complete) ✓
```

**Example Task: Play Time**
```
Task: Outdoor Play
Pillar: Play
Category: Physical Activity
Allocated: 90 minutes

In After School block (3-5 PM):
- 3:30 PM: 90 minutes (playground)

Total: 90 minutes (100% complete) ✓
```

---

## Switching Between Views 🔄

### Dad Switches to 24-Hour
```
My Day Design → Time Blocks → "Standard 24-hour" → Activate
Daily tab now shows: 0h, 1h, 2h, ... 23h
Perfect for professional work tracking
```

### Daughter Switches to School Day
```
My Day Design → Time Blocks → "School Day" → Activate
Daily tab now shows: Morning, School, After School, Family, Sleep
Perfect for kid-friendly tracking
```

### Same Database, Different Views!
- All time entries stored identically (absolute hours)
- No data migration needed
- Can switch back and forth anytime
- Historical data always valid

---

## Creating Custom Blocks 🎨

**Example: Custom "Hybrid Work Day"**

```
My Day Design → Time Blocks → "Create Custom Configuration"

Configuration Name: Hybrid Work Day
Time Format: 12h (AM/PM)

Blocks:
1. Morning Routine (6-8 AM)     - #10b981 (Green)
2. Office Work (8-12 PM)        - #3b82f6 (Blue)
3. Lunch Break (12-1 PM)        - #f59e0b (Orange)
4. Remote Work (1-5 PM)         - #3b82f6 (Blue)
5. Evening (5-10 PM)            - #8b5cf6 (Purple)
6. Sleep (10 PM-6 AM)           - #6b7280 (Gray)

[Save Configuration] → [Activate]
```

---

## Technical Details 🔧

### What Gets Stored

**Time Block Config:**
```json
{
  "id": 2,
  "profile_name": "production",
  "config_name": "School Day",
  "is_active": true,
  "time_format": "12h",
  "blocks": [
    {
      "block_order": 1,
      "start_hour": 6,
      "end_hour": 8,
      "label": "Morning",
      "color_code": "#10b981"
    },
    {
      "block_order": 2,
      "start_hour": 8,
      "end_hour": 15,
      "label": "School",
      "color_code": "#f59e0b"
    }
  ]
}
```

**Time Entry (Always the Same):**
```json
{
  "task_id": 42,
  "date": "2026-01-23",
  "hour": 10,        // Absolute hour
  "minutes": 60
}
```

### How Daily Tab Adapts

1. Fetches active config
2. If `blocks.length == 0`: Show 24 columns (standard)
3. If `blocks.length > 0`: Group hours into blocks
4. Apply time format (24h vs 12h)
5. Display block labels and colors
6. Validation: Each block expects `(end - start) * 60` minutes

---

## Benefits Summary ✨

### For Engineers (Dad)
✅ Hour-by-hour precision (0-23 hours)
✅ 24-hour format (no AM/PM confusion)
✅ Track exact work patterns
✅ Analyze productivity by hour

### For Students (Daughter)
✅ 5 simple blocks instead of 24 columns
✅ Kid-friendly AM/PM time
✅ Named blocks (Morning, School, Play)
✅ Can track multiple activities per block
✅ Less overwhelming interface

### For Teachers (Wife)
✅ Teaching day structure (prep, teaching, grading)
✅ Work-life separation visible
✅ Planning vs teaching vs admin time clear
✅ Align with school schedule

### For Everyone
✅ Same data storage (no migration)
✅ Switch views anytime
✅ Historical data always valid
✅ Customize blocks per person
✅ Multi-profile support

---

## FAQ 🤔

**Q: If I enter 60 minutes in "School block", which hours get updated?**
A: Time entry has specific hour. Entry at 10 AM for 60 mins is stored at hour=10. School block just groups hours 8-15 for display.

**Q: Can I have gaps in time blocks?**
A: Yes! E.g., School (8-15), Study (16-18), with gap 15-16 for travel.

**Q: What if I want 30-minute blocks?**
A: System stores hourly. Display groups by blocks. Can't do 30-min blocks (yet).

**Q: Can daughter and I use different blocks on same computer?**
A: Use "Database Profiles" - switch between production (dad) and test (daughter) profiles.

**Q: What if daughter's school schedule changes?**
A: Edit config or create new one. Old data stays valid - just viewed differently.

**Q: Can blocks overlap?**
A: No validation yet, but don't. E.g., School 8-15 and Play 10-12 would be confusing.

---

**Ready to set up for your daughter?** Follow [QUICK_SETUP.md](QUICK_SETUP.md)!
