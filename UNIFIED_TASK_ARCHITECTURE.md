# Unified Task Architecture for Mobile-Ready System

## Current Fragmented Structure (Problem):
- `tasks` table: Regular daily/weekly/monthly tasks with integer priority (1-10)
- `project_tasks` table: Project subtasks with string priority ("high"/"medium"/"low")
- `goal_tasks` table: Goal milestones (no priority field!)
- `habits` table: Separate with `linked_task_id` (optional, unused)
- `challenges` table: Separate with `linked_task_id` (optional, unused)
- `misc_task_groups` table: Lightweight task groups (incomplete feature)

**Issues:**
- Can't show project/goal tasks in NOW tab (different priority system)
- Can't set priority on habits/challenges
- Duplicate logic for completion tracking
- Mobile app would need 6+ different sync endpoints
- Time tracking only works for regular tasks

## Unified Solution (Mobile-Ready):

### Core Principle: ONE tasks table with task_type discriminator

```sql
CREATE TABLE unified_tasks (
    -- Core fields (ALL task types)
    id INTEGER PRIMARY KEY,
    task_type TEXT NOT NULL,  -- 'regular', 'project', 'goal', 'habit', 'challenge', 'important', 'misc'
    name TEXT NOT NULL,
    description TEXT,
    
    -- Organization (ALL task types)
    pillar_id INTEGER,
    category_id INTEGER,
    sub_category_id INTEGER,
    
    -- Scheduling (ALL task types)
    due_date DATETIME,
    priority INTEGER,  -- 1-10 for ALL types (convert "high"=2, "medium"=5, "low"=8)
    is_completed BOOLEAN DEFAULT 0,
    completed_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    
    -- Time tracking (regular, important, misc tasks)
    allocated_minutes INTEGER,
    spent_minutes INTEGER DEFAULT 0,
    follow_up_frequency TEXT,  -- 'daily', 'weekly', 'monthly', 'yearly', 'one_time'
    
    -- Relationships
    parent_task_id INTEGER,  -- For project/misc subtasks
    project_id INTEGER,
    goal_id INTEGER,
    milestone_id INTEGER,
    
    -- Important Tasks specific
    ideal_gap_days INTEGER,  -- e.g., 45 for bank account check
    last_check_date DATETIME,  -- Last time task was "checked"
    check_history TEXT,  -- JSON array of check dates
    
    -- Habit/Challenge specific (nullable for other types)
    habit_type TEXT,  -- 'boolean', 'time_based', 'count_based'
    target_frequency TEXT,  -- 'daily', 'weekly', 'monthly'
    target_value INTEGER,
    tracking_mode TEXT,
    current_streak INTEGER DEFAULT 0,
    start_date DATETIME,
    end_date DATETIME,
    
    -- Misc/Project hierarchy
    task_level INTEGER DEFAULT 0,  -- 0=main, 1=subtask, 2=sub-subtask
    order_position INTEGER DEFAULT 0,
    
    -- Standard fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    
    FOREIGN KEY (parent_task_id) REFERENCES unified_tasks(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (goal_id) REFERENCES life_goals(id),
    FOREIGN KEY (pillar_id) REFERENCES pillars(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

### Task Type Behaviors:

**regular**: Daily/weekly/monthly recurring tasks
- Uses: allocated_minutes, follow_up_frequency, priority
- Shows in: Daily/Weekly/Monthly/Yearly/OneTime tabs, NOW tab (if priority 1-3)

**project**: Subtask of a project
- Uses: parent_task_id, project_id, due_date, priority
- Can have up to 3 levels deep
- Shows in: Projects tab, Today tab (if due), NOW tab (if priority 1-3)

**goal**: Milestone of a life goal
- Uses: goal_id, milestone_id, due_date, priority
- Shows in: Goals tab, Today tab (if due), NOW tab (if priority 1-3)

**habit**: Behavioral tracking with streaks
- Uses: habit_type, target_frequency, target_value, current_streak, start_date
- Shows in: Habits tab, Today tab (if due today), NOW tab (if priority 1-3)

**challenge**: Time-bound experiment
- Uses: start_date, end_date, target_value, current_streak
- Shows in: Challenges tab, Today tab (if active), NOW tab (if priority 1-3)

**important**: Periodic check tasks (NEW!)
- Uses: ideal_gap_days, last_check_date, priority
- Status: RED (overdue), YELLOW (upcoming 5 days), GREEN (on track)
- Shows in: Important tab, Today tab (if red/yellow), NOW tab (if priority 1-3)

**misc**: Ad-hoc task groups (ENHANCED!)
- Uses: parent_task_id, due_date, allocated_minutes, priority
- Like project but simpler, no milestones
- Shows in: Misc tab, Today tab (if due), NOW tab (if priority 1-3)

### Migration Strategy (Zero Downtime):

1. **Phase 1: Extend existing tables** (NON-BREAKING)
   - Add `priority INTEGER` to project_tasks, goal_tasks (convert high=2, medium=5, low=8)
   - Add `allocated_minutes INTEGER` to project_tasks, goal_tasks
   - Add `task_type TEXT DEFAULT 'regular'` to tasks table
   - Keep all existing tables operational

2. **Phase 2: Create unified view** (READ-ONLY)
   - Create SQL VIEW that UNIONs all task types
   - Update frontend to read from view
   - All writes still go to individual tables
   - Test thoroughly

3. **Phase 3: Migrate data** (CONTROLLED CUTOVER)
   - Backup database
   - Copy all data to unified_tasks table
   - Verify data integrity
   - Switch backend to write to unified_tasks
   - Keep old tables for 30 days as backup

4. **Phase 4: Clean up**
   - Drop old tables after validation period
   - Remove compatibility code

### Mobile App Benefits:

✅ **Single sync endpoint**: `/api/tasks` returns ALL task types
✅ **Unified filtering**: `?priority<=3` works for everything
✅ **Consistent UI**: Same card/list component for all tasks
✅ **Offline-first**: Single local table for SQLite/Realm
✅ **Conflict resolution**: Simple last-write-wins per task
✅ **Incremental sync**: `?updated_since=timestamp` gets all changes

### API Design:

```
GET /api/tasks?task_type=regular&priority_max=3&is_completed=false
GET /api/tasks?task_type=habit&active=true
GET /api/tasks?task_type=important&status=red,yellow
GET /api/tasks/due-today  -- Returns ALL task types due today
GET /api/tasks/{id}
POST /api/tasks  -- Create any type
PUT /api/tasks/{id}  -- Update any type
DELETE /api/tasks/{id}
POST /api/tasks/{id}/complete
POST /api/tasks/{id}/check  -- For important tasks
```

### Implementation Plan:

**Immediate (This Session):**
1. Add priority INTEGER to project_tasks, goal_tasks (migration)
2. Add allocated_minutes to project_tasks, goal_tasks
3. Create important_tasks table (will merge later)
4. Update frontend to handle all types in NOW tab
5. Test existing functionality

**Next Session:**
1. Create unified_tasks table
2. Create migration script with data preservation
3. Update backend models
4. Update API endpoints
5. Comprehensive testing

**Timeline:** 
- Quick fixes: 1 hour (now)
- Full migration: 3-4 hours (separate session with backup)
- Testing: 1 hour

Shall we proceed?
