# MyTimeManager — Requirements Tracker

> **Purpose**: Single source of truth for all project requirements, features, and personal improvement goals. Loaded automatically by the `makingmehappier` agent on every session.

## Legend

| STATUS | Meaning |
|--------|---------|
| 📋 BACKLOG | Not started yet |
| 🟡 IN PROGRESS | Currently being worked on |
| ✅ DONE | Completed and live |
| 🔴 BLOCKED | Blocked — see Comments |
| ❌ CANCELLED | Dropped / no longer relevant |

---

## Section 1 — My Time Manager Web Application

### 1A. Core Architecture & Infrastructure

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-001 | 2024-01-01 | Three-pillar time management system (Hard Work 💼, Calmness 🧘, Family 👨‍👩‍👦) — 8 hours per pillar per day. Never hardcode 24h total | — | Core CANI design principle | ✅ DONE |
| REQ-002 | 2024-01-01 | FastAPI 0.104.1 backend + React 18.2 / TypeScript 5.3.3 / Vite 5.0.8 frontend with SQLite. Ports: Backend 8000, Frontend 3000 | — | 74 REST endpoints, 8000+ backend LOC, 6000+ frontend LOC | ✅ DONE |
| REQ-003 | 2024-01-01 | Multi-profile family support: Dad = Mac direct run, Daughter = Windows Docker, Wife = Mac Docker. Single codebase, no OS branches | — | timezone_utils.py mandatory; never use datetime.now() directly | ✅ DONE |
| REQ-004 | 2024-02-01 | Docker Compose deployment: Dockerfile.backend (Python 3.9-slim), Dockerfile.frontend (Node 18-alpine). Auto-backups cron at 2 AM inside container. 30-day retention. Backups stored at backend/database/backups/ | — | start-docker.sh/.bat, stop-docker.sh/.bat, backup-now.sh/.bat | ✅ DONE |
| REQ-005 | 2024-03-01 | Database migration system — numbered NNN_description.py / .sql in backend/migrations/. 42+ migrations. Always backup before running | — | Python migrations detect duplicate column and skip safely | ✅ DONE |
| REQ-006 | 2024-01-01 | Database schema: 6 core entities — Pillar, Category, SubCategory, Task, Goal, TimeEntry. 3 enums: FollowUpFrequency, GoalTimePeriod, Priority. All with created_at / updated_at timestamps | — | backend/app/models/models.py + goal.py | ✅ DONE |
| REQ-007 | 2024-03-01 | Cross-platform timezone fix via timezone_utils.py: get_local_now(), to_local_date_start(), parse_date_string(). Windows stores UTC; Mac/Linux stores local — normalised by util | — | backend/app/utils/timezone_utils.py | ✅ DONE |
| REQ-008 | 2024-01-01 | API route registration pattern: all routes added to backend/app/main.py include_router() block (lines 70-108). Models imported before routes to resolve SQLAlchemy relationships | — | Common pitfall: new routes invisible until registered | ✅ DONE |
| REQ-009 | 2024-01-01 | Service layer pattern: business logic in backend/app/services/ (27 service files, stateless @staticmethod, db: Session as first param). Routes handle HTTP only | — | Services: task, habit, challenge, goal, goal_project, life_goal, wish, daily_time, weekly_time, monthly_time, yearly_time + more | ✅ DONE |

### 1B. Pillar / Category / SubCategory CRUD

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-010 | 2024-01-01 | CRUD for Pillars (5 endpoints). Tests: 12 passing. GET /api/pillars, POST, GET /{id}, PUT /{id}, DELETE /{id} | — | backend/app/routes/pillars.py, backend/tests/test_pillars.py | ✅ DONE |
| REQ-011 | 2024-01-01 | CRUD for Categories (7 endpoints) + SubCategories (5 endpoints). Hierarchical: Pillar → Category → SubCategory. Filter by parent. Tests: 17 passing | — | routes/categories.py, routes/sub_categories.py | ✅ DONE |
| REQ-012 | 2024-01-01 | Reusable PillarCategorySelector React component — used consistently across all entity creation/edit forms | — | frontend/src/components/PillarCategorySelector.tsx | ✅ DONE |

### 1C. Task Management

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-020 | 2024-01-15 | CRUD for Tasks (13 endpoints, 18 tests). Fields: name, description, allocated_minutes, spent_minutes, priority, due_date, follow_up_frequency, why/additional_whys, goal_id. Filter by pillar, category, completion, date range | — | backend/app/routes/tasks.py | ✅ DONE |
| REQ-021 | 2024-01-15 | Task frequency system determines "home tab": daily → Daily tab, weekly → Weekly tab, monthly → Monthly tab, yearly → Yearly tab, one_time → Important Tasks tab | — | follow_up_frequency field is required on every task | ✅ DONE |
| REQ-022 | 2024-02-01 | Dual completion tracking: Global (task.is_completed + completed_at) set in home tab only. Tab-specific via daily_task_status / weekly_task_status / monthly_task_status / yearly_task_status tables for cross-tab monitoring | — | See TASK_LIFECYCLE_DOCUMENTATION.md. When completing in monitoring tab, must call BOTH endpoints | ✅ DONE |
| REQ-023 | 2024-02-01 | NA (Not Applicable) marking: is_active=false + na_marked_at. Task shows gray background until period ends, then disappears. Full lifecycle same as completion but with NA status tables | — | | ✅ DONE |
| REQ-024 | 2024-02-15 | Multi-tab monitoring: daily tasks can appear in weekly/monthly tabs. Adding to monitoring tab creates a status row. Completing in monitoring tab updates only that tab's status | — | Does NOT affect global task.is_completed | ✅ DONE |
| REQ-025 | 2024-03-01 | Flexible task tracking types — TIME tasks (proportional minute target within period), COUNT tasks (occurrence target, flexible scheduling), BOOLEAN tasks (must-do-daily). Color coding: green = on track, red = below target | — | FLEXIBLE_TASK_TRACKING.md | ✅ DONE |
| REQ-026 | 2024-04-01 | Time entry auto-save: debounce 1-2s, bulk endpoints. POST /api/daily-time/entries/bulk/, /weekly-time/entries/bulk/, /monthly-time/entries/bulk/. TimeEntriesContext handles state + batching | — | Entries stored by absolute hour 0-23; Time Blocks change display only | ✅ DONE |
| REQ-027 | 2024-04-01 | Date navigation (Previous/Today/Next) on all time tabs. Incomplete past days shown at bottom with "jump to day" links | — | daily_summary table tracks completion status | ✅ DONE |
| REQ-028 | 2024-05-01 | Ignore Days feature: mark days as ignored (travel, sick, holiday) — excluded from incomplete days list and analytics. Fields: is_ignored, ignore_reason, ignored_at on daily_summary. Endpoints: POST /ignore/{date}, /unignore/{date}, GET /ignored-days/ | — | IGNORE_DAYS_FEATURE.md; Migration 017 | ✅ DONE |

### 1D. Goals, Life Goals & Goal Projects

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-030 | 2024-02-01 | Goals CRUD (11 endpoints, 14 tests). Time periods: week/month/quarter/year. Allocated vs spent hours. Start/end dates, milestone tracking, active/completed status, task associations, progress calculation | — | backend/app/routes/goals.py | ✅ DONE |
| REQ-031 | 2024-02-01 | Life Goals (1-10 year aspirational goals) with milestones linked to tasks/projects. Pillar/Category/SubCategory organization. linked_task_id field. Separate backend/app/models/goal.py | — | life_goal_service.py | ✅ DONE |
| REQ-032 | 2024-02-01 | Goal Projects (structured projects under Life Goals) with task dependencies. goal_project_service.py | — | GOAL_PROJECT_STRATEGY_GUIDE.md | ✅ DONE |
| REQ-033 | 2024-07-01 | Goals and Life Goals organized under Pillar/Category hierarchy — same PillarCategorySelector component. Added pillar_id, category_id, sub_category_id, linked_task_id to life_goals table | — | GOAL_CHALLENGE_ORGANIZATION_COMPLETE.md; Migration for life_goals | ✅ DONE |

### 1E. Habit Tracking

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-040 | 2024-03-01 | Habit tracking with 4 modes: daily_streak (traditional streaks), occurrences (X times per week/month), occurrences_with_value (X times AND quality threshold), aggregate_total (hit running total by end of period) | — | HabitService.recalculate_streaks() rebuilds from entries | ✅ DONE |
| REQ-041 | 2024-03-01 | Habit DB schema: habit_sessions table (individual occurrences with session_number, is_completed, value_achieved, meets_target). habit_periods table (weekly/monthly summaries: completed_count, aggregate_achieved, success_percentage). Migration 010 | — | New fields on habits: tracking_mode, period_type, target_count_per_period, session_target_value, session_target_unit, aggregate_target | ✅ DONE |
| REQ-042 | 2024-03-01 | Habit API endpoints: GET /{id}/current-period, POST /{id}/initialize-period, POST /sessions/{session_id}/complete, POST /{id}/add-aggregate. Calculation logic for occurrence, occurrence_with_value, aggregate modes | — | backend/app/services/habit_service.py | ✅ DONE |
| REQ-043 | 2024-04-01 | Habit pillar/category/subcategory organization using same PillarCategorySelector. apply_migration_habits_pillar_category.py | — | | ✅ DONE |
| REQ-044 | 2024-11-01 | Habit UI improvements: past dates without entries auto-marked as failures (red ✗). Month navigation (Previous/Next). Success rate = successful_entries / total_days_since_start. Habits filtered by selected month | — | HABIT_TAB_IMPROVEMENTS_COMPLETE.md | ✅ DONE |
| REQ-045 | 2024-12-01 | Habit streak display format: Current Streak 🔥, Best Streak 🏆, 2nd Best Streak 🥈, Success Rate ✅ — vertical layout | — | | ✅ DONE |
| REQ-046 | 2024-12-01 | Auto-track habits from daily tasks (linked_task_id). When linked, manual "Done/Missed" buttons hidden; shows "🔗 Auto-tracked from Daily Task" indicator. Completing daily task auto-logs the habit | — | | ✅ DONE |
| REQ-047 | 2024-12-01 | Habit end date: habits with past end_date auto-move to "Completed Habits" section. is_active auto-set to false by get_all_habits() service | — | | ✅ DONE |

### 1F. Challenges

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-050 | 2024-03-15 | Challenges: 7-30 day time-bound experiments distinct from habits (low pressure, "let me try" mindset). 3 types: daily_streak (do X every day), count_based (do X times in Y days), accumulation (reach total target) | — | CHALLENGES_FEATURE_DESIGN.md | ✅ DONE |
| REQ-051 | 2024-03-15 | Challenge DB: challenges table with challenge_type, start_date, end_date, target_days/count/value, unit, current_streak, is_completed, completion_date. challenge_entries table for daily logging | — | | ✅ DONE |
| REQ-052 | 2024-03-15 | Challenge daily logging: log_challenge_entry with entry_date, is_completed, count_value, numeric_value, note, mood. Challenge progress visualization | — | | ✅ DONE |
| REQ-053 | 2024-07-01 | Challenges organized under Pillar/Category/SubCategory. Added category_id, sub_category_id, linked_task_id, is_active to challenges table. GOAL_CHALLENGE_ORGANIZATION_COMPLETE.md | — | challenge_service.py updated | ✅ DONE |
| REQ-054 | 2024-04-01 | Confetti celebration (canvas-confetti) on challenge completion | — | | ✅ DONE |
| REQ-055 | 2024-12-01 | Challenge form field ordering: linked task field appears right after challenge name. Fixed log_challenge_entry parameter unpacking bug | — | HABIT_CHALLENGE_FIXES_COMPLETE.md | ✅ DONE |

### 1G. Wishes (Dream Parking Lot)

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-060 | 2024-04-01 | Wishes feature: dream parking lot for aspirations not yet goals. Wishes can graduate to Goals or Projects | — | wish_service.py | ✅ DONE |
| REQ-061 | 2024-12-01 | Dream Tasks inline within wish details modal: hierarchical task tree (parent_task_id), subtask support, priority dropdown. WishTask model with CRUD endpoints at /api/wishes/{wish_id}/tasks. Ultra-compact form layout | — | DREAM_TASKS_INLINE_COMPLETE.md; Migration 041_add_wish_tasks.py | ✅ DONE |

### 1H. Analytics & Dashboard

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-070 | 2024-01-01 | Dashboard API (1 endpoint, 7 tests): aggregates pillar summaries, task stats (total/completed/in-progress/overdue), goal stats (total/completed/on-track/at-risk), recent activity, time entries overview | — | backend/app/routes/dashboard.py | ✅ DONE |
| REQ-071 | 2024-02-01 | Analytics API (8 endpoints, 20+ tests, 550-line service): pillar-distribution (pie), category-breakdown (bar), time-trends (line), goal-progress (gauge), task-completion (donut), heatmap, comparative-analysis, productivity-metrics | — | analytics_service.py, routes/analytics.py | ✅ DONE |
| REQ-072 | 2024-03-01 | Comparative Analytics (5 endpoints, 21 tests, 580-line service): planned-vs-actual (efficiency + variance), goal-progress-trends (on-track/at-risk/behind), pillar-balance (balance score 0-100, ideal 33.3% each), productivity-insights (peak times by day/hour), efficiency-metrics (composite score: 40% planning accuracy + 30% goal achievement + 30% work-life balance) | — | comparative_analytics_service.py | ✅ DONE |
| REQ-073 | 2024-04-01 | Calendar integration (4 endpoints, 20 tests, 520-line service): daily, weekly, monthly, upcoming views. Aggregates tasks + goals + time entries. Pillar color coding | — | calendar_service.py, routes/calendar.py | ✅ DONE |
| REQ-074 | 2025-12-01 | Analytics chart labels fix: replaced custom JSX label functions with recharts LabelList component for reliable bar labels. Analytics toggle state persisted to localStorage (6 toggle states: showUtilizationTask/Category/OneTimeWeek/Month) | — | ANALYTICS_LABELS_FIX.md; frontend/src/pages/Analytics.tsx | ✅ DONE |

### 1I. Data Integrity

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-080 | 2026-01-23 | CRITICAL: Historical data integrity via snapshot columns. Deleting/renaming tasks no longer corrupts historical entries. Added task_name_snapshot, pillar_id_snapshot, pillar_name_snapshot, category_id_snapshot, category_name_snapshot to ALL time entry tables and habit/challenge entry tables | — | DATA_INTEGRITY_COMPLETE.md. Backfilled: 3491 daily entries, 341 habit entries, 4 challenge entries | ✅ DONE |
| REQ-081 | 2026-01-23 | SnapshotHelper service: reusable get_task_snapshots(), get_habit_snapshots(), get_challenge_snapshots() methods. All entry-creation services updated to auto-populate snapshots | — | backend/app/services/snapshot_helper.py | ✅ DONE |
| REQ-082 | 2024-03-01 | Summary recalculation script: python recalculate_summaries.py — recalculates daily summaries after bulk data changes | — | Root directory script | ✅ DONE |

### 1J. UI/UX

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-090 | 2024-03-01 | Pomodoro Timer with tree growth animation — persistent across all pages via Layout.tsx. 25/5-min work/break cycles. 5 growth stages. State in localStorage. No props needed | — | frontend/src/components/PomodoroTree.tsx (575 lines), PomodoroTree.css | ✅ DONE |
| REQ-091 | 2024-03-01 | Compact card layouts for list views. See COMPACT_CARDS_IMPLEMENTATION.md | — | | ✅ DONE |
| REQ-092 | 2024-04-01 | Time Blocks feature — kid-friendly vs professional display. Changes DISPLAY only, not storage. Entries always stored by absolute hour (0-23). TIME_BLOCKS_VISUAL_GUIDE.md | — | | ✅ DONE |
| REQ-093 | 2024-01-01 | React 3-context architecture. TaskProvider (entities/CRUD) → TimeEntriesProvider (entries + statuses + debounce) → UserPreferencesProvider (UI). Order matters in App.tsx. Components use hooks: useTaskContext(), useTimeEntriesContext() | — | frontend/src/contexts/ | ✅ DONE |
| REQ-094 | 2024-01-01 | Pillar color system: Hard Work = blue, Calmness = green, Family = purple (amber in some views). Consistent across all components | — | | ✅ DONE |
| REQ-095 | 2024-01-01 | Responsive sidebar layout with mobile support. Global CSS variable design system. TypeScript type definitions (270 lines) | — | frontend/src/components/Layout.tsx, global.css | ✅ DONE |

### 1K. Testing

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-099 | 2024-01-01 | Backend test suite: 80+ tests across all modules. pytest with fixtures. test_pillars (12), test_categories (17), test_tasks (18), test_goals (14), test_dashboard (7), test_time_entries (12), test_analytics (20+), test_calendar (20), test_comparative_analytics (21). Run: cd backend && pytest | — | backend/tests/ | ✅ DONE |

---

## Section 2 — makingmehappier Personal Agent

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-100 | 2026-07-20 | Create custom `makingmehappier` VS Code agent that auto-loads project context on every session — user never re-explains the codebase | 2026-07-20 | .github/agents/makingmehappier.agent.md | ✅ DONE |
| REQ-101 | 2026-07-20 | REQUIREMENTS.md — structured requirements tracker with REQ-NNN IDs, Start Date, Description, ETA, Comments, STATUS columns | 2026-07-20 | This file | ✅ DONE |
| REQ-102 | 2026-07-20 | SOLUTIONS.md — log of major solutions and features implemented, linked to REQ-NNN | 2026-07-20 | See SOLUTIONS.md | ✅ DONE |
| REQ-103 | 2026-07-20 | PROCESS.md — process notes, retrospectives, and periodic life analyses stored persistently | 2026-07-20 | See PROCESS.md | ✅ DONE |
| REQ-104 | 2026-07-20 | Periodic life analysis: agent analyzes Hard Work / Calmness / Family pillar balance, identifies top 3 gaps, writes findings to PROCESS.md | — | Trigger phrase: "analyze my life" / "CANI check" | 📋 BACKLOG |

---

## Section 3 — Upcoming / Known Gaps

> Add new requirements here as they are discovered. Agent will pick these up automatically next session.

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-200 | 2026-07-20 | Analytics frontend dashboard improvements — richer cross-pillar time trends, habit streak visualization, goal progress summary charts | — | analytics-requirements.md exists in repo memory | 📋 BACKLOG |
| REQ-201 | 2026-09-02 | Analytics Overview tab: consolidate 9 stacked comparison charts (Pillar/Category/Daily Time-Based/Daily One-Time/3x Utilization/2x Breakdown) into one page with checkbox chart-picker (persisted to localStorage) + shared This Week/Last Week and This Month/Last Month selector so the Week/Month avg columns on every chart use the same period | 2026-09-02 | frontend/src/pages/Analytics.tsx — visibleOverviewCharts state, getOverviewWeekRange()/getOverviewMonthRange() helpers | ✅ DONE |
| REQ-202 | 2026-09-02 | Follow-up: true custom date-range picker (arbitrary start/end, not just This/Last Week/Month) for the Overview comparison charts | — | Would require passing a date range into getOverviewWeekRange/getOverviewMonthRange instead of a fixed offset | 📋 BACKLOG |
| REQ-215 | 2026-07-20 | Mobile-responsive layout improvements — current UI designed for desktop, needs mobile breakpoints for family use | — | Renumbered from a duplicate REQ-201 | 📋 BACKLOG |
| REQ-216 | 2026-07-20 | Cloud database migration: SQLite → PostgreSQL for multi-device live sync without file-copy workarounds | — | Renumbered from a duplicate REQ-202; update backend/app/database/config.py | 📋 BACKLOG |
| REQ-203 | 2026-07-20 | Frontend component tests — Jest + React Testing Library for TaskContext, TimeEntriesContext, key page components | — | Currently manual testing only | 📋 BACKLOG |
| REQ-204 | 2026-07-20 | Drag-and-drop task reordering within daily/weekly views | — | Phase 2 UI enhancement noted in PROJECT_SUMMARY.md | 📋 BACKLOG |
| REQ-205 | 2026-07-20 | Real-time updates via WebSocket or SSE — family members see each other's progress live | — | Needs PostgreSQL first (REQ-216) | 📋 BACKLOG |
| REQ-206 | 2026-09-08 | Overview comparison charts: add "📅 This Week" / "🗓️ This Month" quick-select buttons next to each chart's ⏱ Time/% toggle so the shared Week/Month avg columns can be turned on without scrolling to the top filter bar. Also default the top "Week:"/"Month:" dropdowns to "Hide" instead of "This Week"/"This Month" | 2026-09-08 | frontend/src/pages/Analytics.tsx — renderWeekMonthQuickButtons(), overviewWeekOption/overviewMonthOption default now 'hide' | ✅ DONE |
| REQ-207 | 2026-09-08 | Inline "📈 Trend" drill-down (previously only on Pillar Time Comparison + Category Time Comparison charts) extended to "Daily: Time-Based Tasks" and "Daily: One-Time Tasks" charts, reusing existing per-task trend data | 2026-09-08 | frontend/src/pages/Analytics.tsx — taskTrendOpenFor state, openTaskTrend(), renderTaskTrendPanel() | ✅ DONE |
| REQ-208 | 2026-09-08 | Fix overlapping X-axis task-name labels on "Daily: Time-Based Tasks" / "Daily: One-Time Tasks" charts — narrower per-line label boxes (max 3 lines, ellipsis on overflow), taller X-axis, wider bar-category gap | 2026-09-08 | frontend/src/pages/Analytics.tsx — CustomMultilineLabel (maxCharsPerLine 20→13, maxLines 3), XAxis height 60→90, barCategoryGap 25→40 | ✅ DONE |
| REQ-209 | 2026-09-08 | Revert REQ-208's fixed-width scrollable chart (caused dead space/rendering bug) back to responsive sizing with a compact 2-line X-axis. Compact the "Detailed Trend Analysis" section: fold selected task/category/pillar name(s) into each chart's header instead of a separate legend row, hide Legend when only one item selected, shrink chart heights and the "Show Week-over-Week"/"Show Month-over-Month" buttons | 2026-09-08 | frontend/src/pages/Analytics.tsx — getSelectedTrendNames()/getSelectedTrendCount(), CustomMultilineLabel maxCharsPerLine/maxLines props; frontend/src/pages/Analytics.css — .toggle-month-btn | ✅ DONE |
| REQ-210 | 2026-09-08 | Tasks — Misc tab: make "Overdue Tasks: Monthly" panel collapsible (collapsed by default); shrink vertical spacing/padding around the Show All/In Progress/Overdue filter buttons and the monthly panel | 2026-09-08 | frontend/src/pages/Tasks.tsx — showMiscMonthlyPanel state | ✅ DONE |
| REQ-211 | 2026-09-08 | Tasks — Misc/task list: compact "excel sheet"-style rows (less padding/margin per task and subtask), stop showing the description inline under the task name (still visible when editing via click) | 2026-09-08 | frontend/src/pages/Tasks.tsx — TaskNode; frontend/src/pages/Tasks.css — .task-row/.task-node/.task-content/.task-children | ✅ DONE |
| REQ-212 | 2026-09-08 | QuickAddTask: adapt behavior to the active tab — Today tab creates a "today" task (unchanged); Misc tab creates a "misc" task (Family/Home Tasks, 30 min, priority 5) with an optional due-date field instead of a forced today date | 2026-09-08 | frontend/src/components/QuickAddTask.tsx — activeTab prop, isMisc branch; all QuickAddTask call sites in Tasks.tsx pass activeTab | ✅ DONE |
| REQ-213 | 2026-09-09 | Analytics inline Trend drill-down: show the actual average value (hours or %) printed on top of each bar in the "📊 Weekly Average — Week over Week" and "📈 Monthly Average — Month over Month" charts, plus a dashed linear trend line overlay, for Pillar/Category/Task trend panels | 2026-09-09 | frontend/src/pages/Analytics.tsx — addLinearTrend(), avgBarLabel(), ComposedChart+Bar+Line | ✅ DONE |
| REQ-214 | 2026-09-09 | Tasks — "➕ Sub" button: replace the large detailed "Add Subtask" modal with a lightweight Quick-Add-style popup (task name + optional due date only), with a "▼ More options" toggle to reveal description/priority when needed. Popup anchors next to the clicked "➕ Sub" button (flips above if no room below, clamps to viewport) instead of opening centered on screen | 2026-09-09 | frontend/src/components/QuickAddSubtask.tsx (new) + QuickAddSubtask.css (new); frontend/src/pages/Tasks.tsx — replaced showAddMiscTaskModal's heavy form with <QuickAddSubtask>, subtaskAnchorRect state, onAddSubtask(task, anchorRect) | ✅ DONE |

---

## Section 4 — Productization Roadmap: Bug Fixes, Design & Market-Readiness

> Goal: make MyTimeManager solid enough to hand to someone outside the family, demo publicly, or sell. Grouped by known bugs first, then what's structurally required before any external users touch it.

### 4A. Known Bugs (found via compiler diagnostics during this session)

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-217 | 2026-09-12 | TypeScript error: `circleOfLifePeriod` state is typed `'week' \| 'month'` but the UI sets/compares it to `'year'` in 3 places (Analytics.tsx ~5029-5034) — the Year option in Circle of Life is likely silently broken at runtime | 2026-09-12 | Fixed — widened useState/getInitialCirclePeriod type to `'week' \| 'month' \| 'year'` | ✅ DONE |
| REQ-218 | 2026-09-12 | TypeScript error: `row.isDrain` accessed on a union type where the pillar-branch object doesn't define it (Analytics.tsx Circle of Life table ~5127-5129) — one of the two circle-of-life data shapes (pillar vs category) is missing the field | 2026-09-12 | Fixed — added `isDrain: false` default to the pillar-branch row objects | ✅ DONE |
| REQ-219 | 2026-09-12 | REQUIREMENTS.md itself had duplicate REQ-201/REQ-202 IDs (two unrelated items shared the same number) | 2026-09-12 | Fixed — renumbered the older duplicates to REQ-215/REQ-216 in this pass | ✅ DONE |
| REQ-220 | 2026-09-12 | 40+ leftover `console.log` debug statements in frontend/src/pages/Analytics.tsx (task/category load functions, chart data mapping) — noisy for end users, and some log full API response payloads to the browser console, which is a minor data-exposure concern if the app is ever exposed outside the home network | — | Strip or gate behind an `import.meta.env.DEV` check before any external release | 📋 BACKLOG |
| REQ-221 | 2026-09-12 | Backend uses `print()` statements for debug output instead of structured logging (e.g. analytics_service.py category-breakdown debug prints) — not visible/searchable in any real hosting environment | — | backend/app/services/analytics_service.py | 📋 BACKLOG |

### 4B. Security & Multi-Tenancy — required before any user outside the household uses this

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-222 | 2026-09-12 | No authentication/authorization exists anywhere in the app — any device on the network has full read/write access to all data. Add login (email/password or OAuth) before exposing this beyond the home LAN | — | Blocks everything else in this section | 📋 BACKLOG |
| REQ-223 | 2026-09-12 | No per-user/per-household data isolation — every table is effectively single-tenant. Selling to multiple families requires an account/household_id column scoped into every query across all 27 services | — | Depends on REQ-222; touches backend/app/models/models.py + every service file | 📋 BACKLOG |
| REQ-224 | 2026-09-12 | No rate limiting or brute-force protection on any endpoint | — | e.g. slowapi middleware, or enforce at a reverse proxy | 📋 BACKLOG |
| REQ-225 | 2026-09-12 | No HTTPS/TLS in docker-compose.yml — needs a reverse proxy (Caddy/Nginx/Traefik) with automatic certs for any non-local deployment | — | | 📋 BACKLOG |
| REQ-226 | 2026-09-12 | Backup files (backend/database/backups/) are stored unencrypted on disk — needs encryption at rest or a cloud target (e.g. S3 with server-side encryption) for a hosted offering | — | | 📋 BACKLOG |
| REQ-227 | 2026-09-12 | No secrets-management story — any future DB credentials/API keys/payment keys must go through environment variables or a secrets manager, never committed to git | — | | 📋 BACKLOG |

### 4C. Design & UX Polish

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-228 | 2026-09-12 | No first-run/onboarding flow — a brand-new install drops the user into an empty app with no guidance to create their first pillar/category/task | — | Needs a guided setup wizard or seeded demo data with a "start fresh" reset option | 📋 BACKLOG |
| REQ-229 | 2026-09-12 | Accessibility audit — keyboard navigation, ARIA labels, and color-contrast check for the pillar color system (blue/green/purple), since colorblind users can't rely on color alone to distinguish pillars | — | Target WCAG AA | 📋 BACKLOG |
| REQ-230 | 2026-09-12 | Design-system consolidation — most pages (Analytics.tsx especially) hand-roll inline `style={{...}}` objects rather than shared style tokens/components, causing visual drift between pages | — | Would reduce inconsistency before a public launch | 📋 BACKLOG |
| REQ-231 | 2026-09-12 | Empty-state and error-state screens — list views assume data exists and API failures currently only surface in the browser console, not to the user | — | Add "No tasks yet — add your first one" style empty states + visible error banners | 📋 BACKLOG |

### 4D. Testing, Quality & Operations

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-232 | 2026-09-12 | End-to-end test suite (Playwright/Cypress) covering core flows: create task → complete → verify analytics reflect it | — | Currently only backend pytest + manual frontend testing exist | 📋 BACKLOG |
| REQ-233 | 2026-09-12 | CI pipeline (GitHub Actions) running backend pytest + frontend build/lint on every push/PR | — | No automated gate currently exists before merging | 📋 BACKLOG |
| REQ-234 | 2026-09-12 | Centralized error monitoring (e.g. Sentry) for both frontend and backend | — | Errors currently only visible in local browser/server console | 📋 BACKLOG |

### 4E. Business Readiness (only if distributing/selling beyond personal use)

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-235 | 2026-09-12 | Generic branding/config layer — remove hardcoded personal family references ("dad"/"daughter"/"wife", specific script names) from user-facing code and docs; add a configurable app name/logo/theme | — | Doesn't affect current family use, only needed for external distribution | 📋 BACKLOG |
| REQ-236 | 2026-09-12 | Data export (JSON/CSV) and an account-deletion flow | — | Needed for GDPR-style "right to access/delete" once real external users' data is involved | 📋 BACKLOG |
| REQ-237 | 2026-09-12 | No LICENSE file exists at the repo root, and no Terms of Service / Privacy Policy | — | Required before any public distribution or sale | 📋 BACKLOG |
| REQ-238 | 2026-09-12 | Billing/subscription integration (e.g. Stripe) — only needed if monetizing directly as SaaS; decide self-hosted-open-source vs hosted-SaaS distribution model first, since it changes the priority of REQ-222/REQ-223 | — | Blocked on a distribution-model decision | 🔴 BLOCKED |

### 4F. Mobile App Strategy (raised 2026-09-12)

| REQ-ID | Start Date | Detailed Description | ETA | Comments | STATUS |
|--------|------------|----------------------|-----|----------|--------|
| REQ-239 | 2026-09-12 | Decide mobile app approach — 3 real options on top of the current React+TS web frontend: (1) **PWA** — add manifest.json + service worker to the existing app; lowest effort, installable, no new codebase; (2) **Capacitor/Ionic wrapper** — reuses ~90% of existing React code inside a native shell, adds access to device APIs (push, biometrics, camera); (3) **Full React Native rewrite** — most native feel, but a second UI codebase to build and maintain in parallel with the web app forever after. Recommendation: ship PWA first (near-zero cost, validates real mobile usage), layer Capacitor if push/native-feel becomes a real ask, only commit to React Native if usage data justifies a second codebase | — | 2026-09-12: confirmed scope is personal/family use, not selling a mobile app externally — this makes PWA (or Capacitor if push notifications are wanted) the clear answer; a React Native rewrite would not be worth it for personal use. Blocks REQ-240/241/242/243 below; REQ-215 (mobile-responsive layout) is a prerequisite for all 3 options | 📋 BACKLOG |
| REQ-240 | 2026-09-12 | Token-based auth (JWT, not cookie/session) — required for any native/Capacitor mobile client regardless of which mobile path is chosen | — | Depends on REQ-222 (no auth exists yet at all); do this once, correctly, when building REQ-222 | 📋 BACKLOG |
| REQ-241 | 2026-09-12 | Awareness: recent web-only UI work (Analytics trend-line SVG/inline-style badges, CSS-heavy components) is not portable to a React Native rewrite — fine for PWA/Capacitor (both render the same web UI in a WebView), but a hard reset if React Native is chosen later. Factor this into the REQ-239 decision — the longer that decision is deferred while polishing web-only styling, the more expensive a later React Native pivot becomes | — | No action needed until REQ-239 is decided | 📋 BACKLOG |
| REQ-242 | 2026-09-12 | Offline-first data + background sync — mobile users expect the app to work with spotty connectivity (e.g. logging a task on the subway). Current architecture assumes always-on network (React Context fetches straight from FastAPI, no local cache/queue) | — | Needed regardless of PWA/Capacitor/React Native choice; would need IndexedDB (web) or SQLite (native) local cache + sync queue | 📋 BACKLOG |
| REQ-243 | 2026-09-12 | Push notifications for reminders (Pomodoro break over, habit streak at risk, task overdue) — a key mobile value-add not present today | — | Needs Web Push (PWA) or FCM/APNs (Capacitor/React Native) | 📋 BACKLOG |
| REQ-244 | 2026-09-12 | PWA basics implemented per the REQ-239 decision — manifest.json (name/icons/theme_color/standalone display), a pillar-themed SVG icon, and a minimal app-shell service worker (caches static assets, always network-first for /api/*, registered only in production builds) | 2026-09-12 | frontend/public/manifest.json, icon.svg, sw.js; frontend/index.html (manifest link + apple meta tags); frontend/src/main.tsx (SW registration). Installable on phone home screen now; offline data sync is separately tracked at REQ-242 | ✅ DONE |

---

*Last updated: 2026-09-12 | Maintained by makingmehappier agent*
