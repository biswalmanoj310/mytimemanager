# MyTimeManager AI Coding Instructions

## Project Overview

MyTimeManager is a comprehensive time and task management application built on the **CANI (Constant And Never-ending Improvement)** philosophy. The app helps users balance life across three 8-hour pillars: **Hard Work** (💼), **Calmness** (🧘), and **Family** (👨‍👩‍👦).

## Architecture

### Tech Stack
- **Backend**: FastAPI 0.104.1 + SQLAlchemy 2.0.23 + SQLite (at `backend/database/mytimemanager.db`)
- **Frontend**: React 18.2 + TypeScript 5.3.3 + Vite 5.0.8
- **Ports**: Backend on 8000, Frontend on 3000

### Project Structure
```
mytimemanager/
├── backend/
│   ├── app/
│   │   ├── models/        # SQLAlchemy ORM models (models.py, goal.py)
│   │   ├── routes/        # FastAPI endpoints (25+ routers)
│   │   ├── services/      # Business logic (habit_service.py, etc.)
│   │   ├── database/      # DB config (config.py, init_db)
│   │   └── main.py        # FastAPI app with CORS and router registration
│   ├── migrations/        # SQL migration scripts (001-017)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/    # Reusable UI (Layout, PillarCategorySelector)
│       ├── contexts/      # React Context (TaskContext, TimeEntriesContext)
│       ├── pages/         # Route pages (Dashboard, Tasks, Goals, etc.)
│       ├── services/      # API client (api.ts)
│       └── types/         # TypeScript definitions
└── database/              # SQLite database location
```

## Core Domain Concepts

### 1. Three-Pillar System
All entities (tasks, goals, habits, challenges) are organized under pillars → categories → subcategories. This hierarchy is fundamental to the app's organization philosophy.

### 2. Task Frequencies & Home Tabs
Tasks have a `follow_up_frequency` field that determines their "home tab":
- `daily` → Daily tab (disappears after completion/NA until next day)
- `weekly` → Weekly tab (resets weekly)
- `monthly` → Monthly tab (resets monthly)
- `yearly` → Yearly tab
- `one_time` → One Time tab (project-based)

**Critical**: Tasks can be "monitored" in multiple tabs via `weekly_task_status`, `monthly_task_status`, `yearly_task_status` tables for cross-tab tracking, but have only ONE home tab.

### 3. Completion vs. Status Tracking
- **Global Completion**: `task.is_completed`, `task.completed_at` (set when completed in home tab)
- **Tab-Specific Status**: Separate status tables (`daily_task_status`, `weekly_task_status`, `monthly_task_status`) track per-period completion
- **NA (Not Applicable)**: `task.is_active = false` marks tasks as NA; they stay visible with gray background until period ends

### 4. Key Entity Types
- **Tasks**: Daily work items with time allocation (`allocated_minutes`, `spent_minutes`)
- **Life Goals**: Long-term aspirations (1-10 years) with milestones
- **Projects**: Structured task containers with dependencies and milestones
- **Habits**: Behavioral tracking with streak calculations (4 tracking modes: daily_streak, occurrences, occurrences_with_value, aggregate_total)
- **Challenges**: Time-bound experiments (7-30 days) with daily logging
- **Wishes**: Dreams that can graduate to goals/projects

## Development Workflows

### Starting the Application
```bash
# From project root
./start_app.sh              # Starts both backend + frontend
# OR separately:
./start_backend.sh          # Backend only
./start_frontend.sh         # Frontend only
```

### Database Operations
```bash
# Backup database (creates timestamped .db.gz in ~/mytimemanager_backups/)
./backup_database.sh

# Apply migrations (from backend/)
cd backend && python migrations/add_*.py

# Recalculate summaries (when data integrity issues occur)
python recalculate_summaries.py
```

### Testing
- Backend tests: `backend/tests/` (pytest)
- API docs: http://localhost:8000/docs (Swagger UI)
- Quick testing checklist: See `QUICK_TEST_CHECKLIST.md`

## Critical Implementation Patterns

### 1. API Route Registration
All routers MUST be registered in `backend/app/main.py`. Pattern:
```python
from app.routes import new_feature
app.include_router(new_feature.router, prefix="/api/new-feature", tags=["New Feature"])
```

### 2. Database Session Management
Always use dependency injection for DB sessions:
```python
from app.database.config import get_db
from sqlalchemy.orm import Session

@router.get("/endpoint")
def endpoint(db: Session = Depends(get_db)):
    # db session automatically managed
```

### 3. React Context Usage
Frontend uses three main contexts (in `App.tsx`):
- `TaskProvider`: Task CRUD operations
- `TimeEntriesProvider`: Time tracking data (daily/weekly/monthly/yearly/one-time entries + statuses)
- `UserPreferencesProvider`: UI preferences

**Pattern**: Components consume contexts via hooks:
```typescript
import { useTaskContext } from '../contexts/TaskContext';
const { tasks, loading, refreshTasks } = useTaskContext();
```

### 4. Reusable Organization Components
Use `PillarCategorySelector` component for consistent pillar/category/subcategory selection across forms (see `REUSABLE_COMPONENTS_GUIDE.md`).

### 5. Time Entry Auto-Save
Time entries use debounced auto-save to backend with bulk endpoints:
```typescript
POST /api/daily-time/entries/bulk/      // Daily entries
POST /api/weekly-time/entries/bulk/     // Weekly entries
POST /api/monthly-time/entries/bulk/    // Monthly entries
```

### 6. Status Management for Multi-Tab Tracking
When marking task complete/NA in a monitoring tab, hit BOTH task completion endpoint AND status endpoint:
```typescript
// Example: Complete daily task in Weekly tab
POST /api/tasks/{taskId}/complete           // Global completion
POST /api/weekly-time/status/{taskId}/complete?week_start_date={date}  // Weekly status
```

## Migration Strategy

- SQL migrations in `backend/migrations/` numbered 001-017
- Apply new migrations with Python scripts: `python migrations/add_*.py`
- Always backup database before migrations: `./backup_database.sh`
- Migration documentation: `MIGRATION_GUIDE.md`

## Data Integrity Rules

1. **Time Allocation**: For daily tasks, `SUM(allocated_minutes)` should equal 480 minutes (8 hours) per pillar
2. **Streak Recalculation**: Habits have `recalculate_streaks()` in `backend/app/services/habit_service.py` - use when session data changes
3. **Summary Recalculation**: Run `recalculate_summaries.py` after bulk data changes
4. **Task Completion Cleanup**: Completed tasks auto-hide after period ends (no manual cleanup needed)

## UI/UX Conventions

- **Color Coding**: Each pillar has distinct colors (Hard Work: blue, Calmness: green, Family: purple)
- **Compact Cards**: Use compact card layouts for list views (see `COMPACT_CARDS_IMPLEMENTATION.md`)
- **Confetti Celebrations**: Trigger on challenge completion, habit milestones (canvas-confetti library)
- **Empty States**: Provide helpful empty states with action prompts
- **Date Selectors**: All time-tracking tabs have date navigation (Previous/Today/Next)

## Common Pitfalls

1. **Don't** create tasks without `follow_up_frequency` - it determines home tab visibility
2. **Don't** forget to register new routes in `main.py` - they won't be accessible otherwise
3. **Don't** modify task completion state without updating corresponding status tables for monitored tabs
4. **Don't** run migrations without backups - database corruption is unrecoverable
5. **Don't** bypass `TimeEntriesContext` for time tracking - it manages complex state synchronization
6. **Avoid** hardcoding 24-hour allocation - system is built around three 8-hour pillars (flexible for future)

## Key Documentation Files

- `PROJECT_SUMMARY.md` - Complete feature list with implementation details
- `TASK_LIFECYCLE_DOCUMENTATION.md` - Deep dive into task completion logic
- `DATABASE_INFO.md` - Database location, backup strategy, schema
- `REUSABLE_COMPONENTS_GUIDE.md` - Reusable UI component patterns
- `MIGRATION_GUIDE.md` - Laptop migration and Docker strategy
- `VISUAL_UI_GUIDE.md` - UI mockups and visual examples

## Testing & Validation

Before committing changes:
1. Start both servers: `./start_app.sh`
2. Verify no console errors in browser DevTools
3. Test in API docs: http://localhost:8000/docs
4. Run backend tests: `cd backend && pytest`
5. Check database backup exists: `ls ~/mytimemanager_backups/`

When adding new features, follow existing patterns in similar routes (e.g., new tab → mimic `daily_time.py` structure).
