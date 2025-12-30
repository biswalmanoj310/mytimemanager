# MyTimeManager AI Coding Instructions

## Project Overview

MyTimeManager is a time and task management application built on the **CANI (Constant And Never-ending Improvement)** philosophy. The app balances life across three 8-hour pillars: **Hard Work** (💼), **Calmness** (🧘), and **Family** (👨‍👩‍👦).

## Architecture

### Tech Stack
- **Backend**: FastAPI 0.104.1 + SQLAlchemy 2.0.23 + SQLite
- **Frontend**: React 18.2 + TypeScript 5.3.3 + Vite 5.0.8
- **Ports**: Backend 8000, Frontend 3000
- **Database**: SQLite at `backend/database/mytimemanager.db` (easily migrates to PostgreSQL/MySQL via `backend/app/database/config.py`)

### Critical File Locations
```
backend/app/main.py              # Router registration - ALL routes must be added here (lines 70-105)
backend/app/database/config.py   # DB session factory (get_db dependency injection)
backend/app/services/            # Business logic layer (25 service files - stateless @staticmethod pattern)
backend/app/routes/              # API endpoints (30+ routers - import models for relationship resolution)
backend/app/models/models.py     # SQLAlchemy models (must import in main.py before routes)
frontend/src/contexts/           # Global state (TaskContext, TimeEntriesContext, UserPreferencesProvider)
frontend/src/App.tsx             # Context providers wrap all routes (order matters!)
backend/migrations/              # Database migrations (NNN_*.sql or add_*.py)
backend/database/mytimemanager.db # SQLite database (backup at ~/mytimemanager_backups/)
```

## Core Domain Logic

### 1. Three-Pillar Organization Hierarchy
**All entities** (tasks, goals, habits, challenges) MUST organize under: `pillar → category → subcategory`
- Use `PillarCategorySelector` component (`frontend/src/components/PillarCategorySelector.tsx`) for consistent UI
- Backend validates pillar/category relationships in routes

### 2. Task Frequency System (Critical)
Tasks have ONE "home tab" determined by `follow_up_frequency` field:
- `daily` → Daily tab (resets daily after completion/NA)
- `weekly` → Weekly tab (resets Sunday)
- `monthly` → Monthly tab (resets 1st of month)
- `yearly` → Yearly tab
- `one_time` → Projects/One-Time tab

**Multi-Tab Monitoring**: Tasks can be monitored in OTHER tabs via status tables (`weekly_task_status`, `monthly_task_status`, `yearly_task_status`), but only have ONE home tab.

### 3. Dual Completion Tracking
**Global Completion** (set in home tab only):
- `task.is_completed = true`
- `task.completed_at = timestamp`

**Tab-Specific Status** (set in monitoring tabs):
- Separate rows in `daily_task_status`, `weekly_task_status`, `monthly_task_status`
- Allows cross-tab tracking without affecting global state

**NA (Not Applicable)**: `task.is_active = false` + `task.na_marked_at = timestamp` → shows gray background until period ends

**Completion Logic**: When marking complete/NA in a monitoring tab, hit BOTH endpoints:
```typescript
// Example: Complete daily task in Weekly tab
POST /api/tasks/{taskId}/complete           // Updates global task.is_completed
POST /api/weekly-time/status/{taskId}/complete?week_start_date={date}  // Updates weekly_task_status
```

### 4. Key Entity Types
- **Tasks**: Work items with `allocated_minutes`/`spent_minutes` tracking
- **Life Goals**: 1-10 year goals with milestones (link to tasks/projects)
- **Goal Projects**: Structured projects under goals with dependencies
- **Habits**: Behavioral tracking with 4 modes (`daily_streak`, `occurrences`, `occurrences_with_value`, `aggregate_total`)
- **Challenges**: 7-30 day experiments with daily logging + auto-sync from habits
- **Wishes**: Dream parking lot (can graduate to goals/projects)

## Development Workflows

### Starting the App
```bash
./start_app.sh              # Both backend + frontend (prompts for backup)
./start_backend.sh          # Backend only (uvicorn on port 8000)
./start_frontend.sh         # Frontend only (vite dev server on port 3000)
```

**First Time Setup**:
```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend  
cd frontend
npm install
```

### Database Operations
```bash
./backup_database.sh        # Creates ~/mytimemanager_backups/mytimemanager_backup_YYYYMMDD_HHMMSS.db.gz
python recalculate_summaries.py  # Recalculates daily summaries (run after bulk data changes)

# Apply migrations (ALWAYS backup first)
cd backend/migrations
python 019_add_priority_to_tasks.py     # Python migrations (numbered NNN_*.py)
sqlite3 ../database/mytimemanager.db < 001_add_na_marked_at.sql  # SQL migrations (numbered NNN_*.sql)

# Restore from backup
./restore_database.sh       # Interactive restore from ~/mytimemanager_backups/
```

### Testing
- **Backend**: `cd backend && pytest` (tests in `backend/tests/`)
- **API**: http://localhost:8000/docs (Swagger UI - interactive testing)
- **Quick validation**: `QUICK_TEST_CHECKLIST.md` for regression tests
- **No frontend tests** - manual testing via DevTools console

### Project Scripts
```bash
# Root directory contains many helper scripts
./backup_database.sh, ./restore_database.sh   # Database management
./start_*.sh                                  # App startup scripts
./recalculate_summaries.py                   # Recalc daily summaries
./add_daily_tasks.py, ./add_missing_tasks.py # Data utilities
./apply_migration_*.py                       # Migration helpers
```

## Critical Implementation Patterns

### 1. API Route Registration (ALWAYS DO THIS)
New routes are invisible until registered in `backend/app/main.py`:
```python
from app.routes import new_feature
app.include_router(new_feature.router, prefix="/api/new-feature", tags=["New Feature"])
```

### 2. Database Session Management
Use dependency injection (never create sessions manually):
```python
from app.database.config import get_db
from sqlalchemy.orm import Session

@router.post("/endpoint")
def endpoint(data: Schema, db: Session = Depends(get_db)):
    # Session auto-committed/rolled back
```

### 3. React Context Pattern
Frontend has 3 global contexts (see `frontend/src/App.tsx`):
- `TaskProvider`: CRUD for tasks/pillars/categories/goals
- `TimeEntriesProvider`: Daily/Weekly/Monthly/Yearly entries + statuses (handles debounced auto-save)
- `UserPreferencesProvider`: UI preferences

**Components consume via hooks**:
```typescript
import { useTaskContext } from '../contexts/TaskContext';
const { tasks, refreshTasks, completeTask, markTaskNA } = useTaskContext();
```

**Context wrapping order matters** (App.tsx):
```typescript
<TaskProvider>          // First - provides base entities
  <TimeEntriesProvider> // Second - depends on tasks
    <UserPreferencesProvider> // Third - UI layer
      <Layout>...</Layout>
```

### 4. Time Entry Auto-Save
Time entries use debounced saves (1-2 seconds) with bulk endpoints:
```typescript
POST /api/daily-time/entries/bulk/      # [{task_id, date, hour, minutes}, ...]
POST /api/weekly-time/entries/bulk/     # [{task_id, week_start_date, time_spent}, ...]
POST /api/monthly-time/entries/bulk/    # [{task_id, month_start_date, time_spent}, ...]
```
Pattern in `TimeEntriesContext`: Update local state immediately → debounce → batch save

### 5. Habit Streak Recalculation
When habit sessions/entries change, call `backend/app/services/habit_service.py::recalculate_streaks()`:
```python
from app.services.habit_service import HabitService
HabitService.recalculate_streaks(db, habit_id)  # Rebuilds streak data from entries
```

### 6. Service Layer Pattern
Business logic lives in `backend/app/services/` NOT in route handlers. Each entity has a dedicated service:
- `task_service.py`, `habit_service.py`, `challenge_service.py`, `goal_service.py`, etc.
- Routes handle HTTP concerns (validation, status codes), services handle domain logic
- Example: `HabitService.recalculate_streaks()` for complex streak calculations
- Services are stateless classes with `@staticmethod` methods taking `db: Session` as first param

## Data Integrity Rules

1. **Time Allocation**: Daily tasks should total 480 minutes (8 hours) per pillar (not enforced but expected)
2. **Completed Task Visibility**: Tasks with `is_completed=true` AND `completed_at` matching current period show with green background until period ends, then disappear
3. **NA Task Lifecycle**: `is_active=false` tasks show gray background until period ends, then disappear
4. **Summary Recalculation**: After bulk changes, run `python recalculate_summaries.py` from project root
5. **Migration Safety**: ALWAYS run `./backup_database.sh` before migrations (database corruption is unrecoverable)

## Common Pitfalls

1. **Missing Router Registration**: New routes in `app/routes/` won't work until added to `main.py` includes - check lines 70-105 in `backend/app/main.py` for pattern
2. **Context Bypass**: Don't call API directly from components - use `useTaskContext()` or `useTimeEntriesContext()` to leverage caching/state sync
3. **Incomplete Multi-Tab Completion**: When completing tasks in monitoring tabs, must call BOTH task endpoint + status endpoint (see TASK_LIFECYCLE_DOCUMENTATION.md)
4. **Migration Without Backup**: SQLite has no WAL mode - corruption requires restore from `~/mytimemanager_backups/`
5. **Hardcoded 24-Hour Logic**: System assumes three 8-hour pillars (never hardcode 24 hours)
6. **Task Without Frequency**: `follow_up_frequency` is required - determines home tab visibility
7. **Service Layer Bypass**: Don't put business logic in routes - use existing service classes in `backend/app/services/` (25 service files with @staticmethod pattern)
8. **Direct Session Creation**: Never `Session()` - always use `db: Session = Depends(get_db)` for automatic transaction management
9. **Forgetting to Import Models**: Must import all models in `main.py` before routes to prevent relationship resolution errors (see lines 22-23)

## UI/UX Standards

- **Pillar Colors**: Hard Work (blue), Calmness (green), Family (purple) - consistent across app
- **Confetti Celebrations**: Use `canvas-confetti` for challenge completion, habit milestones (see existing patterns)
- **Compact Card Layouts**: List views use compact cards (see `COMPACT_CARDS_IMPLEMENTATION.md`)
- **Empty States**: Provide actionable empty states with "Add [Entity]" buttons
- **Date Navigation**: All time tabs have Previous/Today/Next date selectors

## Essential Documentation

- `PROJECT_SUMMARY.md` - Complete feature catalog with implementation details (606 lines - comprehensive system overview)
- `TASK_LIFECYCLE_DOCUMENTATION.md` - Deep dive into task completion/NA/status logic (513 lines - READ THIS for task changes)
- `REUSABLE_COMPONENTS_GUIDE.md` - PillarCategorySelector, TaskSelector patterns with research-backed UX patterns
- `DATABASE_INFO.md` - Backup location (`~/mytimemanager_backups/`), restore procedures, schema reference
- `QUICK_TEST_CHECKLIST.md` - Regression tests for time entry system (critical for validating changes)
- `COMPACT_CARDS_IMPLEMENTATION.md` - UI card layout patterns
- `GOAL_PROJECT_STRATEGY_GUIDE.md` - Goals vs Projects architecture decisions

## Pre-Commit Checklist

1. `./start_app.sh` - Verify both servers start
2. Check browser DevTools console - no errors
3. Test new endpoints in http://localhost:8000/docs
4. `cd backend && pytest` - All tests pass
5. `./backup_database.sh` - Backup exists before schema changes

## Migration Workflow

When creating database migrations:
1. **Always backup first**: `./backup_database.sh`
2. **Name consistently**: Python migrations use numbered format `NNN_description.py` (e.g., `019_add_priority_to_tasks.py`), SQL uses `NNN_description.sql` (e.g., `001_add_na_marked_at.sql`)
3. **Migration pattern** (Python):
```python
import sqlite3
import os

def run_migration():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 5")
        conn.commit()
        print("✓ Migration completed!")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("⚠ Column exists, skipping...")
        else:
            raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
```
4. **Apply**: `cd backend/migrations && python 019_add_priority_to_tasks.py`
5. **Verify**: Check http://localhost:8000/docs that new fields appear in schemas
6. **Run tests**: `cd backend && pytest`
7. **Update models**: Add new fields to `backend/app/models/models.py` and corresponding Pydantic schemas

When adding features, mimic existing patterns (e.g., new time tab → copy `backend/app/routes/daily_time.py` structure).
