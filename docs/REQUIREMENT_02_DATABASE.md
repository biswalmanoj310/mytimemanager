# Requirement 02: Database Setup - COMPLETED ✅

## Overview
Implemented a scalable database architecture using SQLite with migration path to PostgreSQL/MySQL.

## Database Tables Created

### 1. **Pillars** (`pillars`)
The three pillars of life with 8-hour allocation each:
- id (Primary Key)
- name (Hard Work, Calmness, Family)
- description
- allocated_hours (8.0)
- color_code (Hex color for UI)
- icon (Emoji representation)
- created_at, updated_at

### 2. **Categories** (`categories`)
Categories within each pillar:
- id (Primary Key)
- name
- description
- pillar_id (Foreign Key → pillars)
- allocated_hours
- color_code
- created_at, updated_at

**Constraint**: Total allocated hours for all categories within a pillar must equal pillar's allocated_hours

### 3. **Sub-Categories** (`sub_categories`)
Granular organization within categories:
- id (Primary Key)
- name
- description
- category_id (Foreign Key → categories)
- allocated_hours
- created_at, updated_at

### 4. **Goals** (`goals`)
Time-based goals with tracking:
- id (Primary Key)
- name
- description
- pillar_id (Foreign Key)
- category_id (Foreign Key)
- sub_category_id (Optional Foreign Key)
- goal_time_period (week/month/quarter/year)
- allocated_hours
- spent_hours
- why_reason (Motivation)
- is_active, is_completed
- completed_at, created_at, updated_at
- start_date, end_date

### 5. **Tasks** (`tasks`)
Individual tasks with comprehensive tracking:
- id (Primary Key)
- name
- description
- pillar_id, category_id, sub_category_id (Foreign Keys)
- allocated_minutes
- spent_minutes
- follow_up_frequency (today/weekly/monthly/quarterly/yearly/one_time)
- separately_followed (No time bound tasks)
- goal_id (Optional link to goal)
- is_part_of_goal
- why_reason (Primary motivation)
- additional_whys (JSON array of additional reasons)
- is_active, is_completed
- completed_at, created_at, updated_at, due_date

### 6. **Time Entries** (`time_entries`)
30-minute slot time tracking:
- id (Primary Key)
- task_id (Foreign Key → tasks)
- entry_date
- start_time, end_time
- duration_minutes (Must be multiples of 30)
- notes
- created_at, updated_at

### 7. **Motivational Quotes** (`motivational_quotes`)
Inspirational quotes for UI:
- id (Primary Key)
- quote
- author
- category (motivation/time-management/cani/balance)
- is_active
- created_at

## Database Features

### ✅ Implemented
1. **SQLite Database** - Simple, file-based, no server required
2. **SQLAlchemy ORM** - Object-Relational Mapping for easy querying
3. **Relationships** - Proper foreign keys and cascade deletes
4. **Indexes** - Performance optimization on frequently queried fields
5. **Timestamps** - Automatic created_at and updated_at tracking
6. **Enums** - Type-safe enumerations for frequencies and periods

### 🔮 Future Migration Path
The database configuration supports easy migration to PostgreSQL or MySQL:

```python
# Change .env file:
DATABASE_URL=postgresql://user:password@localhost:5432/mytimemanager
```

All queries will work without code changes thanks to SQLAlchemy abstraction.

## Initial Data Seeded

### Three Pillars Created:
1. **Hard Work** (💼) - Blue (#3B82F6)
   - Professional development, career growth, and productive work
   - 8 hours allocated

2. **Calmness** (🧘) - Green (#10B981)
   - Rest, meditation, self-care, and mental well-being
   - 8 hours allocated

3. **Family** (👨‍👩‍👧‍👦) - Amber (#F59E0B)
   - Relationships, personal connections, and family time
   - 8 hours allocated

### Motivational Quotes Added:
- 10 inspirational quotes covering CANI, motivation, time management, and balance
- Categories: cani, motivation, time-management, balance

## Files Created

### Backend Structure
```
backend/
├── requirements.txt         # Python dependencies
├── app/
│   ├── __init__.py
│   ├── main.py             # FastAPI application
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py       # Database models
│   └── database/
│       ├── config.py       # Database configuration
│       └── init_db.py      # Database initialization script
└── venv/                   # Virtual environment
```

## How to Use

### Initialize Database
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python -m app.database.init_db
```

### Start Backend Server
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

Server runs at: http://localhost:8000

### API Endpoints (Currently)
- `GET /` - Welcome message with philosophy
- `GET /health` - Health check

## Database Location
- **SQLite file**: `/database/mytimemanager.db`
- Automatically created on first run
- Excluded from git (.gitignore)

## Dependencies Installed
- FastAPI - Web framework
- Uvicorn - ASGI server
- SQLAlchemy - ORM
- Alembic - Database migrations
- Pydantic - Data validation
- python-dotenv - Environment variables
- psycopg2-binary - PostgreSQL support (future)
- pytest - Testing framework

## Design Principles

### 1. **Scalability**
- Easy to switch database engines
- Connection pooling configured
- Indexes for performance

### 2. **Data Integrity**
- Foreign key constraints
- Cascade delete rules
- Required field validation

### 3. **Flexibility**
- Optional sub-categories
- Optional goal linkage
- Configurable time periods

### 4. **CANI Philosophy**
- Built-in support for continuous improvement tracking
- Motivational quotes system
- Why-based task management

## Next Steps

🔜 **Requirement 03**: Implement Three Pillars System
- API endpoints for pillars
- Validation for 24-hour constraint
- Category time allocation logic

---

**Status**: ✅ Complete and tested
**Date**: October 21, 2025
**Database Engine**: SQLite (with PostgreSQL migration support)
