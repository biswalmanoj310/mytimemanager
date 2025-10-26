# Goal Projects Feature - Testing Guide

## Overview
Goal Projects are tracking dashboards that monitor task performance within life goals. They calculate completion frequency and display visual status indicators.

## Key Features Implemented

### Backend
✅ Database Tables:
- `goal_projects`: Stores dashboard metadata
- `goal_project_task_links`: Links tasks with tracking parameters

✅ SQLAlchemy Models:
- `GoalProject`: Dashboard model with relationships
- `GoalProjectTaskLink`: Task link with time-bounded tracking

✅ Service Layer (`backend/app/services/goal_project_service.py`):
- CRUD operations for goal projects
- Performance calculation logic
- Task frequency tracking (daily/weekly/monthly)
- Color-coded status (🟢≥80%, 🟡60-79%, 🔴<60%)

✅ API Endpoints (`backend/app/routes/life_goals.py`):
- `POST /api/life-goals/{goal_id}/goal-projects` - Create dashboard
- `GET /api/life-goals/{goal_id}/goal-projects` - List dashboards with stats
- `GET /api/life-goals/goal-projects/{project_id}` - Get dashboard details
- `PUT /api/life-goals/goal-projects/{project_id}` - Update dashboard
- `DELETE /api/life-goals/goal-projects/{project_id}` - Delete dashboard
- `POST /api/life-goals/goal-projects/{project_id}/tasks` - Link task
- `PUT /api/life-goals/goal-project-tasks/{link_id}` - Update task link
- `DELETE /api/life-goals/goal-project-tasks/{link_id}` - Remove task link
- `GET /api/life-goals/tasks/{task_id}/goal-projects` - Get projects for task

### Frontend
✅ UI Components:
- Performance Tracking section in Goals page
- Color-coded project cards with status indicators
- Task performance rows with progress bars
- Create dashboard modal with task linking

✅ Features:
- Visual status indicators (🟢🟡🔴)
- Overall performance percentage
- Individual task performance breakdown
- Time-bounded tracking display
- Expected vs actual completion counts

## Testing Steps

### 1. Create a Life Goal
1. Navigate to Goals page
2. Click "Add New Goal"
3. Fill in:
   - Name: "Target Weight 72 kg"
   - Start Date: "2024-10-24"
   - Target Date: "2024-12-24"
   - Priority: High
4. Save the goal
5. Click on the goal to view details

### 2. Create a Tracking Dashboard
1. In the goal details, find "📊 Performance Tracking" section
2. Click "➕ Create Tracking Dashboard"
3. Fill in:
   - Dashboard Name: "Weight Loss Routine"
   - Description: "Daily fitness and meal tracking"
4. Click "Load Available Tasks"
5. Select tasks to track (e.g., "Running 5 Miles", "Meal Prep")
6. For each task, configure:
   - Track Start Date: Same as goal start
   - Track End Date: Same as goal target
   - Expected Frequency: e.g., "6" times "Per Week"
   - Notes: Optional tracking notes
7. Click "Create Dashboard"

### 3. Verify Performance Calculation
1. The dashboard should appear in the Performance Tracking section
2. Check that it shows:
   - Overall percentage (calculated from all tasks)
   - Status color (🟢🟡🔴) based on performance
   - Individual task rows with:
     - Task name and type badge
     - Actual vs expected counts
     - Progress bar
     - Performance percentage

### 4. Test Different Frequencies
Create multiple task links with different frequencies:
- Daily task: "1 per day" (7/week expected)
- Weekly task: "3 per week" (3/week expected)
- Monthly task: "8 per month" (~2/week expected)

Verify calculations are correct for each frequency type.

### 5. Test Status Colors
Performance thresholds:
- 🟢 Green: ≥80% completion
- 🟡 Yellow: 60-79% completion
- 🔴 Red: <60% completion

Project overall status = worst performing task status.

## API Testing (Using curl or Postman)

### Create Goal Project
```bash
curl -X POST http://localhost:8000/api/life-goals/1/goal-projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weight Loss Routine",
    "description": "Track fitness and meals"
  }'
```

### Link Task to Project
```bash
curl -X POST http://localhost:8000/api/life-goals/goal-projects/1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": 5,
    "task_type": "daily",
    "track_start_date": "2024-10-24",
    "track_end_date": "2024-12-24",
    "expected_frequency_value": 6,
    "expected_frequency_unit": "per_week",
    "notes": "Run 6 times per week"
  }'
```

### Get Project with Stats
```bash
curl http://localhost:8000/api/life-goals/1/goal-projects
```

## Known Limitations

1. **Tasks Page Display**: Read-only display in Tasks page not yet implemented
   - Planned: Show goal projects that include each task
   - Workaround: View from Goals page only

2. **Real-time Updates**: Dashboard stats calculated on load
   - Refresh goal details to see updated performance

3. **Date Validation**: No validation that track dates are within goal dates
   - User should manually ensure dates align

## Performance Calculation Logic

```python
# Example: Task with 6 per week expected over 20 days
days_in_period = 20
weeks_in_period = 20 / 7.0 ≈ 2.86 weeks
expected_count = 6 * 2.86 ≈ 17 completions

# If actual completions = 15
completion_percentage = (15 / 17) * 100 ≈ 88.2%
status = 'green'  # ≥80%
```

## Next Steps

1. **Tasks Page Integration**: Add read-only goal project cards to Tasks page
2. **Edit Dashboard**: Add ability to edit existing dashboards and task links
3. **Date Validation**: Add validation to ensure track dates are within goal dates
4. **Analytics**: Add charts/graphs for performance trends over time
5. **Notifications**: Alert when performance drops below threshold

## Architecture Summary

```
User Creates Goal
    └── Creates Tracking Dashboard (GoalProject)
        └── Links Existing Tasks (GoalProjectTaskLink)
            ├── Defines tracking period (start_date, end_date)
            ├── Sets expected frequency (6 per_week)
            └── System calculates performance:
                ├── Queries DailyTimeEntry for completions
                ├── Filters by date range
                ├── Counts actual completions
                ├── Compares to expected
                └── Returns status + percentage
```

**Key Principle**: Goal Projects don't store data—they MONITOR existing task data.
