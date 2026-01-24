# MyTimeManager AI Coding Instructions

## Project Overview

MyTimeManager is a time and task management application built on the **CANI (Constant And Never-ending Improvement)** philosophy. The app balances life across three 8-hour pillars: **Hard Work** (💼), **Calmness** (🧘), and **Family** (👨‍👩‍👦). It supports multi-profile usage (family members) with kid-friendly and professional time block views.

## Architecture

### Tech Stack
- **Backend**: FastAPI 0.104.1 + SQLAlchemy 2.0.23 + SQLite (or PostgreSQL/MySQL)
- **Frontend**: React 18.2 + TypeScript 5.3.3 + Vite 5.0.8
- **Deployment**: Docker Compose (see `docker-compose.yml`, `Dockerfile.backend`, `Dockerfile.frontend`)
- **Ports**: Backend 8000, Frontend 3000
- **Database**: SQLite at `backend/database/mytimemanager.db` (backup location: `~/mytimemanager_backups/`)

### Critical File Locations
```
backend/app/main.py              # Router registration - ALL routes must be added here (lines 70-108)
backend/app/database/config.py   # DB session factory (get_db dependency injection)
backend/app/services/            # Business logic layer (27 service files - stateless @staticmethod pattern)
backend/app/routes/              # API endpoints (30 routers - import models for relationship resolution)
backend/app/models/models.py     # SQLAlchemy models (must import in main.py:22-23 before routes)
backend/app/models/goal.py       # Goal-specific models (separate file)
backend/app/models/schemas.py    # Pydantic schemas for request/response validation
frontend/src/contexts/           # Global state (TaskContext, TimeEntriesContext, UserPreferencesProvider)
frontend/src/App.tsx             # Context providers wrap all routes (order matters: Task → TimeEntries → UserPreferences)
frontend/src/components/PillarCategorySelector.tsx  # Reusable org hierarchy selector
backend/migrations/              # Database migrations (40+ files: NNN_*.py or NNN_*.sql)
backend/database/mytimemanager.db # SQLite database (backup at ~/mytimemanager_backups/)
*.py (root dir)                  # 20+ utility scripts (backup, recalc, migrations, setup, etc.)
*.sh (root dir)                  # Shell scripts for starting/stopping/backup
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
- `one_time` → Important Tasks (formerly Projects/One-Time tab)

**Multi-Tab Monitoring**: Tasks can be monitored in OTHER tabs via status tables (`daily_task_status`, `weekly_task_status`, `monthly_task_status`, `yearly_task_status`), but only have ONE home tab.

### 3. Dual Completion Tracking
**Global Completion** (set in home tab only):
- `task.is_completed = true`
- `task.completed_at = timestamp`

**Tab-Specific Status** (set in monitoring tabs):
- Separate rows in `daily_task_status`, `weekly_task_status`, `monthly_task_status`, `yearly_task_status`
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

### Starting the App (Production Docker - Recommended for Cloud Deployment)
```bash
# Docker deployment (recommended for production/cloud)
./start-docker.sh           # Mac/Linux: Starts both services in containers
start-docker.bat            # Windows: Double-click to start

# Manual backup before starting (automatic backups run at 2 AM daily)
./backup-now.sh             # Mac/Linux: Create immediate backup
backup-now.bat              # Windows: Create immediate backup

# Access URLs
http://localhost:3000       # Frontend (React + Vite)
http://localhost:8000       # Backend API (FastAPI)
http://localhost:8000/docs  # Swagger UI (interactive API testing)
```

### Starting the App (Development - Direct on Host)
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
# Automatic Backups (Docker Deployment)
# - Run daily at 2:00 AM inside Docker container
# - Stored in backend/database/backups/ (not ~/mytimemanager_backups/)
# - 30-day retention (auto-cleanup)
# - Initial backup on container startup
# - Compressed with gzip (.db.gz format)

# Manual backups (Docker)
./backup-now.sh             # Mac/Linux: Immediate backup
backup-now.bat              # Windows: Immediate backup

# Manual backups (Non-Docker)
./backup_database.sh        # Creates ~/mytimemanager_backups/mytimemanager_backup_YYYYMMDD_HHMMSS.db.gz

# Restore from backup
./restore-backup.sh         # Mac/Linux: Interactive restore (lists available backups)
restore-backup.bat          # Windows: Interactive restore

# Recalculate summaries after bulk changes
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
- **Frontend tests**: Currently manual via DevTools console (planned: Jest + React Testing Library for component/integration tests)
- **Docker health checks**: Backend has `/health` endpoint monitored every 30s

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
- **27 service files**: `task_service.py`, `habit_service.py`, `challenge_service.py`, `goal_service.py`, `goal_project_service.py`, `life_goal_service.py`, `wish_service.py`, `daily_time_service.py`, `weekly_time_service.py`, `monthly_time_service.py`, `yearly_time_service.py`, etc.
- **Routes handle HTTP concerns** (validation, status codes), **services handle domain logic**
- **Pattern**: Services are stateless classes with `@staticmethod` methods taking `db: Session` as first param
```python
class HabitService:
    @staticmethod
    def recalculate_streaks(db: Session, habit_id: int) -> None:
        """Rebuild streak data from entries - complex business logic"""
        # ... implementation
```

## Data Integrity Rules

1. **Time Allocation**: Daily tasks should total 480 minutes (8 hours) per pillar (not enforced but expected)
2. **Completed Task Visibility**: Tasks with `is_completed=true` AND `completed_at` matching current period show with green background until period ends, then disappear
3. **NA Task Lifecycle**: `is_active=false` tasks show gray background until period ends, then disappear
4. **Summary Recalculation**: After bulk changes, run `python recalculate_summaries.py` from project root
5. **Migration Safety**: ALWAYS run `./backup_database.sh` before migrations (database corruption is unrecoverable)

## Common Pitfalls

1. **Missing Router Registration**: New routes in `app/routes/` won't work until added to `main.py` includes - check lines 70-108 in [backend/app/main.py](backend/app/main.py) for pattern
2. **Context Bypass**: Don't call API directly from components - use `useTaskContext()` or `useTimeEntriesContext()` to leverage caching/state sync
3. **Incomplete Multi-Tab Completion**: When completing tasks in monitoring tabs, must call BOTH task endpoint + status endpoint (see [TASK_LIFECYCLE_DOCUMENTATION.md](TASK_LIFECYCLE_DOCUMENTATION.md))
4. **Migration Without Backup**: SQLite has no WAL mode - corruption requires restore from backups (Docker: `backend/database/backups/`, Non-Docker: `~/mytimemanager_backups/`)
5. **Hardcoded 24-Hour Logic**: System assumes three 8-hour pillars (never hardcode 24 hours) - Use time_blocks feature for custom display
6. **Task Without Frequency**: `follow_up_frequency` is required - determines home tab visibility
7. **Service Layer Bypass**: Don't put business logic in routes - use existing service classes in `backend/app/services/` (27 service files with @staticmethod pattern)
8. **Direct Session Creation**: Never `Session()` - always use `db: Session = Depends(get_db)` for automatic transaction management
9. **Forgetting to Import Models**: Must import all models in `main.py` before routes to prevent relationship resolution errors (see lines 22-23)
10. **Root Script Usage**: Many utility scripts exist in project root (backup_database.sh, recalculate_summaries.py, start-docker.sh, etc.) - check root before creating new tools
11. **Docker vs Direct Run**: Docker backups go to `backend/database/backups/`, manual script backups go to `~/mytimemanager_backups/` - different locations!
12. **Time Blocks Misconception**: Time blocks change DISPLAY only (not storage) - entries always stored by absolute hour (0-23)
13. **Cron in Docker**: Automatic backups only work in Docker deployment (requires cron service in container)

## UI/UX Standards

- **Pillar Colors**: Hard Work (blue), Calmness (green), Family (purple) - consistent across app
- **Confetti Celebrations**: Use `canvas-confetti` for challenge completion, habit milestones (see existing patterns)
- **Compact Card Layouts**: List views use compact cards (see `COMPACT_CARDS_IMPLEMENTATION.md`)
- **Empty States**: Provide actionable empty states with "Add [Entity]" buttons
- **Date Navigation**: All time tabs have Previous/Today/Next date selectors

## Essential Documentation

### Core Architecture & Features
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Complete feature catalog with implementation details (606 lines - comprehensive system overview)
- [TASK_LIFECYCLE_DOCUMENTATION.md](TASK_LIFECYCLE_DOCUMENTATION.md) - Deep dive into task completion/NA/status logic (513 lines - READ THIS for task changes)
- [REUSABLE_COMPONENTS_GUIDE.md](REUSABLE_COMPONENTS_GUIDE.md) - PillarCategorySelector, TaskSelector patterns with research-backed UX patterns
- [DATABASE_INFO.md](DATABASE_INFO.md) - Backup locations (Docker: `backend/database/backups/`, Non-Docker: `~/mytimemanager_backups/`), restore procedures, schema reference
- [QUICK_TEST_CHECKLIST.md](QUICK_TEST_CHECKLIST.md) - Regression tests for time entry system (critical for validating changes)
- [COMPACT_CARDS_IMPLEMENTATION.md](COMPACT_CARDS_IMPLEMENTATION.md) - UI card layout patterns
- [GOAL_PROJECT_STRATEGY_GUIDE.md](GOAL_PROJECT_STRATEGY_GUIDE.md) - Goals vs Projects architecture decisions

### Deployment & Operations (Cloud-Ready)
- [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md) - Complete Docker deployment guide (prerequisites, troubleshooting, data management)
- [QUICK_SETUP.md](QUICK_SETUP.md) - Step-by-step instructions for end users (Windows focus)
- [DAUGHTER_LAPTOP_SETUP_GUIDE.md](DAUGHTER_LAPTOP_SETUP_GUIDE.md) - Family-friendly setup guide (556 lines - comprehensive Windows deployment)
- [DAD_DEPLOYMENT_CHECKLIST.md](DAD_DEPLOYMENT_CHECKLIST.md) - Weekend deployment plan (547 lines - includes support strategy)
- [EXACT_COMMANDS.md](EXACT_COMMANDS.md) - Windows copy-paste commands (403 lines)
- [MAC_SETUP_COMMANDS.md](MAC_SETUP_COMMANDS.md) - Mac copy-paste commands (716 lines)
- [AUTOMATIC_BACKUP_GUIDE.md](AUTOMATIC_BACKUP_GUIDE.md) - Automatic backup system details (Docker cron + 30-day retention)
- [TIME_BLOCKS_VISUAL_GUIDE.md](TIME_BLOCKS_VISUAL_GUIDE.md) - Time blocks feature explanation (313 lines - kid-friendly vs professional views)

## Docker Deployment (Cloud-Ready)

### Why Docker for Cloud Deployment
- **Isolated environment**: No Python/Node.js installation needed on target system
- **Cross-platform**: Same containers work on Windows, Mac, Linux, AWS, Azure, GCP
- **Automatic backups**: Built-in cron job runs daily at 2 AM (inside container)
- **Easy updates**: Pull new code, rebuild containers, data persists in mounted volumes
- **Health monitoring**: Backend has healthcheck endpoint for orchestrators (Kubernetes, ECS)

### Docker Files
- `Dockerfile.backend` - Python 3.9-slim + FastAPI + automatic backups (cron)
- `Dockerfile.frontend` - Node 18-alpine + Vite dev server
- `docker-compose.yml` - Orchestrates both services + volumes + networking
- `start-docker.sh/.bat` - Build images + start containers
- `stop-docker.sh/.bat` - Graceful shutdown
- `backup-now.sh/.bat` - Manual backup trigger
- `restore-backup.sh/.bat` - Interactive restore (lists backups, confirms, restores)

### Docker Volumes
- `./backend/database:/app/database` - Database + backups persist on host
- `./backend/migrations:/app/migrations` - Migrations accessible in container
- `backup-logs:/var/log` - Backup logs for troubleshooting

### Docker Commands
```bash
# Start (builds on first run)
./start-docker.sh          # Mac/Linux
start-docker.bat           # Windows

# Stop (preserves data)
./stop-docker.sh           # Mac/Linux
stop-docker.bat            # Windows

# View logs (real-time)
docker-compose logs -f     # All services
docker logs mytimemanager-backend -f  # Backend only

# Check backup logs
docker exec mytimemanager-backend cat /var/log/backup.log

# Force rebuild (after code changes)
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Cloud Deployment Notes
- Database in `backend/database/` is NOT in container - persists across rebuilds
- Backups in `backend/database/backups/` sync to host (easy to copy to S3/Azure Blob)
- For cloud: Replace SQLite with PostgreSQL (update `backend/app/database/config.py`)
- For Kubernetes: Convert `docker-compose.yml` to Deployments + Services + PersistentVolumeClaims
- For AWS ECS: Use task definitions with EFS mount for database persistence

## Pre-Commit Checklist

1. **Test both deployment modes**:
   - `./start_app.sh` - Verify direct run works (development)
   - `./start-docker.sh` - Verify Docker works (production)
2. Check browser DevTools console - no errors
3. Test new endpoints in http://localhost:8000/docs
4. `cd backend && pytest` - All tests pass
5. **Docker-specific checks**:
   - `docker exec mytimemanager-backend service cron status` - Cron running
   - `ls backend/database/backups/` - Backups exist
   - `./backup-now.sh && ./restore-backup.sh` - Test backup/restore cycle
6. **Before schema changes**: Backup first (`./backup-now.sh` or `./backup_database.sh`)

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
