# MyTimeManager — Solutions Log

> Tracks major features, fixes, and decisions implemented. Each entry links to its REQ-NNN. Loaded by the `makingmehappier` agent on every session.

---

## How to Read This

- **SOL-NNN**: Solution ID (sequential)
- **REQ-NNN**: Requirement it satisfies (from REQUIREMENTS.md)
- **Date**: When it was implemented
- **Approach**: Key technical decision made
- **Files Changed**: Primary files touched

---

## Solutions

### SOL-001 — Multi-Platform Timezone Fix
| Field | Value |
|-------|-------|
| REQ | REQ-003 |
| Date | 2024-03-01 |
| Problem | Windows stores UTC datetimes, Mac/Linux store local — caused display bugs |
| Approach | Created `backend/app/utils/timezone_utils.py` with `get_local_now()`, `to_local_date_start()`, `parse_date_string()`. Banned direct use of `datetime.now()` / `datetime.utcnow()` / `func.now()` |
| Files | `backend/app/utils/timezone_utils.py` |
| Outcome | Cross-platform consistency; Windows (daughter's machine) shows correct dates |

---

### SOL-002 — Docker Multi-Service Deployment with Auto-Backup
| Field | Value |
|-------|-------|
| REQ | REQ-004 |
| Date | 2024-04-01 |
| Problem | Family members on different OS needed zero-install setup |
| Approach | Docker Compose with two services (backend:8000, frontend:3000). Dockerfile.backend includes cron for 2 AM daily backup. Database mounted as host volume so data survives rebuilds |
| Files | `docker-compose.yml`, `Dockerfile.backend`, `Dockerfile.frontend`, `start-docker.sh/.bat` |
| Outcome | Daughter (Windows) and wife (Mac) can run `start-docker.bat` / `start-docker.sh` without any Python/Node setup |

---

### SOL-003 — Analytics Overview: Quick Week/Month Buttons, Task Trend Drill-Down, X-Axis Label Fix
| Field | Value |
|-------|-------|
| REQ | REQ-206, REQ-207, REQ-208 |
| Date | 2026-09-08 |
| Problem | (1) Toggling the shared Week/Month comparison columns required scrolling up to the top filter bar every time, and it defaulted to showing This Week/This Month on every load. (2) The "📈 Trend" inline drill-down only existed on the Pillar and Category comparison charts, not on the Daily Time-Based/One-Time task charts. (3) Task names on those two charts wrapped into overlapping label boxes, making them unreadable. |
| Approach | (1) Added `renderWeekMonthQuickButtons()` next to the ⏱ Time/% toggle on all 7 comparison chart headers; buttons set `overviewWeekOption`/`overviewMonthOption` straight to 0 (This Week/Month) or back to `'hide'`. Changed both option states' default to `'hide'`. (2) Added `taskTrendOpenFor` state + `openTaskTrend()` + `renderTaskTrendPanel()`, reusing the existing `taskTrendData`/`loadDetailedTrendData('tasks')` pipeline, wired into both Daily task chart sections. (3) Tightened `CustomMultilineLabel` (maxCharsPerLine 20→13, capped at 3 lines with ellipsis) and gave the two Daily task `BarChart`s more room (`barCategoryGap` 25→40, XAxis `height`/margin bottom 60→90). |
| Files | `frontend/src/pages/Analytics.tsx` |
| Outcome | Faster access to weekly/monthly comparisons from any chart; per-task trend drill-down now available on Time-Based and One-Time task charts; task names no longer overlap on those charts' X-axis |

---

### SOL-004 — Daily Task Charts: Scrollable Fixed-Width Canvas Instead of Responsive 100%
| Field | Value |
|-------|-------|
| REQ | REQ-208 |
| Date | 2026-09-08 |
| Problem | SOL-003's X-axis tweaks weren't enough — with many tasks, `ResponsiveContainer width="100%"` squeezed each category narrower than its multiline label box, so adjacent task-name labels still overlapped |
| Approach | Replaced `ResponsiveContainer` with a fixed-width `BarChart` (`width = Math.max(700, taskCount * 100)`) inside an `overflowX: auto` wrapper on the "Daily: Time-Based Tasks" and "Daily: One-Time Tasks" charts, so each task always gets ≥100px of horizontal room regardless of how many tasks are plotted; extra tasks scroll horizontally instead of compressing |
| Files | `frontend/src/pages/Analytics.tsx` |
| Outcome | Task name labels on these two charts stay legible no matter how many tasks are shown |

---

### SOL-005 — Revert Fixed-Width Chart Hack; Compact the Detailed Trend Analysis Section
| Field | Value |
|-------|-------|
| REQ | REQ-208, REQ-209 |
| Date | 2026-09-08 |
| Problem | SOL-004's fixed-width scrollable `<BarChart>` (no `ResponsiveContainer`) rendered oddly — huge dead space below the X-axis and a stray scrollbar, worse than before. Separately, the legacy "Detailed Trend Analysis" section (still shown under Overview, driven by the same `detailedViewType`/`selectedTasks` state as the new inline Trend drill-downs) had oversized `<h3>` headers, a redundant color-name legend under each chart, and huge `400px`/`350px` tall charts with big gradient "Show Week-over-Week"/"Show Month-over-Month" buttons — all consuming excess page space. |
| Approach | Reverted the two Daily task charts back to `ResponsiveContainer width="100%"`, with a shorter, single XAxis reservation (`height`/`margin.bottom` 44px, capped at 2 lines via new `CustomMultilineLabel` `maxCharsPerLine`/`maxLines` props) and `barCategoryGap="20%"` so spacing scales with the container instead of a fixed pixel/width hack. For the Detailed Trend Analysis Daily/Weekly/Monthly charts: added `getSelectedTrendNames()`/`getSelectedTrendCount()`, folded the selected task/category/pillar name(s) directly into a compact 13px header (`"<name> — Daily Utilization (N Days)"`), hid `<Legend>` when only one item is selected, and shrank chart heights (400→230, 350→220) and `.toggle-month-btn` (padding/font-size) in `Analytics.css`. |
| Files | `frontend/src/pages/Analytics.tsx`, `frontend/src/pages/Analytics.css` |
| Outcome | Charts render correctly again with no dead space; the Detailed Trend Analysis section is compact and shows which item a chart refers to right in its header instead of a separate legend line |

---

### SOL-006 — Shrink "Click to Enlarge" Badge; Reclaim Legend Margin on Daily Task Charts
| Field | Value |
|-------|-------|
| REQ | REQ-208 |
| Date | 2026-09-08 |
| Problem | The hover-only "🔍 Click to enlarge" pill (`.clickable-chart::after`) was large and positioned top-right, next to the reserved 185px-wide Legend margin on the two Daily task charts — visually implicated in the leftover right-side space even though it's `position: absolute` and not the real cause (the Legend's `margin.right` was). Net effect: the X-axis/plot area had less width than it could, worsening label crowding. |
| Approach | Shrunk `.clickable-chart::after` to a small 20px circular icon badge (🔍 only, no text) in the top-left corner instead of a large top-right text pill. Reduced `margin.right` on the "Daily: Time-Based Tasks" / "Daily: One-Time Tasks" charts from 185→110px and tightened their `Legend` (`fontSize` 11→10, `paddingLeft` 20→6), giving the plot area more real width |
| Files | `frontend/src/pages/Analytics.tsx`, `frontend/src/pages/Analytics.css` |
| Outcome | More horizontal room for bars/X-axis labels on the two Daily task charts; the enlarge affordance still works (click anywhere on the chart) but no longer visually competes for space |

---

### SOL-007 — Misc Tab Compaction + Tab-Aware Quick Add
| Field | Value |
|-------|-------|
| REQ | REQ-210, REQ-211, REQ-212 |
| Date | 2026-09-08 |
| Problem | Tasks → Misc tab wasted a lot of vertical space: a large always-open "Overdue Tasks: Monthly" panel, oversized filter buttons/category headers, and `TaskNode` rows with big padding plus an always-visible description line meant only ~6 tasks fit on screen. Separately, `QuickAddTask` always created a "today" task regardless of which tab it was opened from, so it couldn't be used to quickly capture a misc task. |
| Approach | Made the Monthly panel collapsible (`showMiscMonthlyPanel`, collapsed by default, persisted to localStorage) with a `▶`/`▼` clickable header. Shrunk filter-button/category-header padding and margins throughout the Misc tab. Removed the always-visible `task.description` line from `TaskNode` (still shown when editing via click) and tightened `.task-row`/`.task-node`/`.task-content`/`.task-children` CSS for a denser, spreadsheet-like list. Gave `QuickAddTask` a new `activeTab` prop: on the Misc tab it now creates a `follow_up_frequency: 'misc'` task (Family/Home Tasks, 30 min, priority 5) with an *optional* due-date input instead of forcing today's date; all other tabs keep the original "today" task behavior. |
| Files | `frontend/src/pages/Tasks.tsx`, `frontend/src/pages/Tasks.css`, `frontend/src/components/QuickAddTask.tsx`, `frontend/src/components/QuickAddTask.css` |
| Outcome | Misc tab shows far more tasks per screen with less scrolling; Quick Add can now be used from the Misc tab to capture a misc task in one step |

---

### SOL-009 — Quick Add Subtask Popup (replaces heavy "Add Subtask" modal)
| Field | Value |
|-------|-------|
| REQ | REQ-214 |
| Date | 2026-09-09 |
| Problem | Clicking "➕ Sub" on any task row opened a large, full form modal (name, description, due date, priority, all in styled sections) just to add a quick subtask — high friction for the common case of jotting down a one-line subtask. |
| Approach | Built `QuickAddSubtask.tsx`, a compact centered popup mirroring the `QuickAddTask` UX: name input + optional due date visible by default, Enter-to-save, auto-focus, Esc-to-close. Added a "▼ More options (description, priority)" toggle that reveals a description textarea and priority dropdown only when needed. Preserved all existing subtask-creation logic (inherit pillar/category/goal/wish/project linkage from parent, `follow_up_frequency: 'misc'`, auto-uncomplete a completed parent) unchanged. Swapped the old `showAddMiscTaskModal` JSX block in `Tasks.tsx` for `<QuickAddSubtask parentTask={editingMiscTask} isOpen={showAddMiscTaskModal} .../>` — all 3 existing `onAddSubtask` call sites (Misc tab, Project detail, completed Misc tasks) work unchanged since they only set the same two state variables. Follow-up: the "➕ Sub" button's `onClick` now captures `e.currentTarget.getBoundingClientRect()` and threads it through `onAddSubtask(task, anchorRect)` into a new `subtaskAnchorRect` state; `QuickAddSubtask` measures its own rendered size via `useLayoutEffect` + a `popupRef` and positions itself with `position: fixed`, flipping above the button when there isn't room below and clamping horizontally to stay on-screen (falls back to a centered position if no anchor is available). Outside-click-to-close now checks against the popup's own ref instead of a full-screen dimmed overlay. |
| Files | `frontend/src/components/QuickAddSubtask.tsx` (new), `frontend/src/components/QuickAddSubtask.css` (new), `frontend/src/pages/Tasks.tsx` |
| Outcome | Adding a subtask is now a 2-field, one-Enter-keypress action, with description/priority still available a click away for cases that need them; the popup now opens right next to the button that was clicked instead of the center of the screen |

---

### SOL-008 — Weekly/Monthly Average Bar Labels + Trend Line on Analytics Drill-Downs
| Field | Value |
|-------|-------|
| REQ | REQ-213 |
| Date | 2026-09-09 |
| Problem | The "📊 Weekly Average — Week over Week" and "📈 Monthly Average — Month over Month" bar charts (shown when drilling into a Pillar, Category, or Task trend on the Overview tab) only showed bars with no printed value, and had no way to see the overall direction (trending up/down) at a glance. |
| Approach | Added `addLinearTrend()` helper — simple least-squares linear regression over the weekly/monthly series, appending a `trend` field to each data point. Added `avgBarLabel()` shared label formatter (shows `Xh` or `X%` on top of each bar, matching the existing Overview chart label style). Converted the three Weekly/Monthly `BarChart`s (pillar trend, category trend, task trend panels) to `ComposedChart` with the existing `Bar` (now carrying the value label) plus a new dashed red `Line` rendering the `trend` field. |
| Files | `frontend/src/pages/Analytics.tsx` |
| Outcome | Each bar now shows its actual average hours/percentage, and a dashed trend line makes the week-over-week / month-over-month direction immediately visible |






---

### SOL-003 — Dual Completion Tracking Architecture
| Field | Value |
|-------|-------|
| REQ | REQ-011 |
| Date | 2024-02-15 |
| Problem | Tasks needed to be tracked as "done this week" in weekly view WITHOUT affecting their global daily completion state |
| Approach | Separate status tables per time period: `daily_task_status`, `weekly_task_status`, `monthly_task_status`, `yearly_task_status`. When completing in a monitoring tab, call BOTH `POST /api/tasks/{id}/complete` AND `POST /api/weekly-time/status/{id}/complete` |
| Files | `backend/app/models/models.py`, `backend/app/routes/` (time routes) |
| Outcome | Cross-tab monitoring without state pollution. See TASK_LIFECYCLE_DOCUMENTATION.md |

---

### SOL-004 — Pomodoro Timer with Persistent Tree Growth
| Field | Value |
|-------|-------|
| REQ | REQ-030 |
| Date | 2024-04-01 |
| Problem | Needed a focus timer visible on ALL pages that survives page refreshes |
| Approach | `PomodoroTree.tsx` rendered in `Layout.tsx` (wraps all pages). State stored in `localStorage`. SVG tree grows through 5 stages as pomodoros complete. 25/5 min work/break cycles |
| Files | `frontend/src/components/PomodoroTree.tsx`, `frontend/src/styles/PomodoroTree.css`, `frontend/src/components/Layout.tsx` |
| Outcome | Persistent timer available globally; tree animation gives visual progress reward |

---

### SOL-005 — makingmehappier Agent + Requirements System
| Field | Value |
|-------|-------|
| REQ | REQ-100 to REQ-103 |
| Date | 2026-07-20 |
| Problem | User had to re-explain the entire project at the start of every new Copilot chat session |
| Approach | Created `.github/agents/makingmehappier.agent.md` custom VS Code agent. Reads REQUIREMENTS.md, SOLUTIONS.md, PROCESS.md on every invocation. Prints a brief context card. Tracks life analyses in PROCESS.md |
| Files | `.github/agents/makingmehappier.agent.md`, `REQUIREMENTS.md`, `SOLUTIONS.md`, `PROCESS.md` |
| Outcome | Select "makingmehappier" in agent picker — full project context is auto-loaded |

---

### SOL-006 — Analytics Overview Chart Consolidation
| Field | Value |
|-------|-------|
| REQ | REQ-201 |
| Date | 2026-09-02 |
| Problem | Overview tab stacked 9 full-size comparison charts vertically — user had to scroll past all of them to find the one they wanted, making "where did my time go" checks tedious |
| Approach | Added a filter bar at the top of the Overview tab: (1) checkbox pills to tick which of the 9 charts render (visibility via inline `display: none`, state persisted to localStorage so the choice sticks); default ticks the 5 highest-value charts (Pillar, Category, Daily Time-Based, Daily One-Time, Utilization: Daily Tasks). (2) Two dropdowns — Week: This Week/Last Week, Month: This Month/Last Month — that replace the previously hardcoded "Monday-to-today" / "1st-to-today" ranges via new `getOverviewWeekRange()`/`getOverviewMonthRange()` helpers, feeding all three comparative-data loaders (pillar/category/task) |
| Files | `frontend/src/pages/Analytics.tsx` |
| Outcome | Same page, far less scrolling; user can also compare against last week/last month instead of only week/month-to-date |

---

### SOL-010 — Goal Page: Misc Tasks Section + Compact UI
| Field | Value |
|-------|-------|
| REQ | REQ-250, REQ-251 |
| Date | 2026-09-12 |
| Problem | (1) A misc task linked to a Life Goal (task.goal_id set, follow_up_frequency='misc') showed up inside the "Linked Tasks (Important)" section instead of its own compact tree section like the Misc tab; its Edit button navigated to a dead `/tasks?tab=onetime&edit=` URL that Tasks.tsx never handled. (2) The goal detail page headers/padding were oversized (18-28px text, 20px+ padding), showing little info per screen |
| Approach | Split the `/api/life-goals/{id}/linked-tasks` response client-side by `task_type` into `importantLinkedTasks` (one_time) and a new `miscLinkedTasks` (misc) tree section styled like the Misc tab (checkbox complete, ✏️ edit, ➕ Sub, 🗑 delete) — all acting on the same `tasks` row so Misc tab / Goal page stay in sync. Added `defaultGoalId` prop to `TaskForm` (mirrors `defaultWishId`) to pre-link new misc subtasks to the goal, and fixed `resetForm()` to respect `defaultParentTaskId`. Replaced the old "navigate to dead edit URL" button with an in-page `TaskForm` edit modal. Fixed `misc_tasks` goal stats in `life_goal_service.py` to query the current `Task` table (`goal_id` + `follow_up_frequency='misc'`) instead of the deprecated `MiscTaskGroup`/`MiscTaskItem` models. Compacted the goal-detail-page banner, stats bar, and the goal-tasks/projects/milestones/why/description sections (padding ~12px, headers ~14px, buttons ~4px 10px), plus the shared `.goal-section`/`.section-header`/`.milestone-item`/`.goal-task-item`/`.empty-section` CSS rules |
| Files | `frontend/src/pages/Goals.tsx`, `frontend/src/pages/Goals.css`, `frontend/src/components/TaskForm.tsx`, `backend/app/services/life_goal_service.py` |
| Outcome | Misc tasks linked to a goal now show in their own section with full parent/child tree and the same edit/delete/add-subtask actions as the Misc tab, staying in sync everywhere; goal detail page shows more content with less scrolling |

---

### SOL-011 — Analytics Overview: Per-Chart Today/Week/Month Controls + Persisted %/Time Toggles
| Field | Value |
|-------|-------|
| REQ | REQ-252, REQ-253, REQ-254 |
| Date | 2026-09-14 |
| Problem | (1) The ⏱ Time/📊 % Utilization toggle on each comparison chart reset to "Time" on every refresh. (2) There was no explicit control for the "Today" column — it was always on with no button, unlike Week/Month which had quick-select buttons. (3) The "📅 This Week"/"🗓️ This Month" quick buttons (and the %/hours toggle on the 3 utilization charts) were wired to one shared global state, so clicking them on one chart changed the columns on all 7 comparison charts at once |
| Approach | Added `loadChartToggles()`/`CHART_TOGGLE_STORAGE_KEY` so `catShowPct`/`taskShowPct`/`oneTimeShowPct`/`pillarShowPct`/`showUtilizationAsHours` lazy-init from and persist to localStorage. Introduced 3 new per-chart `Record<OverviewChartKey, boolean>` states — `chartTodayVisible` (default true), `chartWeekVisible`, `chartMonthVisible` (both default false, matching REQ-206's "hidden by default") — each persisted to its own localStorage key. `renderWeekMonthQuickButtons()` now takes a `chartKey` argument and renders 3 buttons (Today/This Week/This Month) that flip only that chart's own flags. Replaced the old global `showWeekColumnGlobal`/`showMonthColumnGlobal` conditionals on all 7 inline comparison charts' Today/Week/Month `<Bar>` elements with the chart-scoped flags. The top "Charts shown below" filter bar's Week:/Month: dropdowns (and the expanded "View All" modal) are untouched — they still control the shared date-range offset (This Week vs Last 2 Weeks, etc.) that a chart's own column uses once turned on |
| Files | `frontend/src/pages/Analytics.tsx` |
| Outcome | Refreshing the page keeps whatever %/Time and Today/Week/Month state each chart was left in; toggling one chart's columns never affects any other chart |

---

### SOL-012 — Persist Detailed Trend Analysis Selection Across Refresh
| Field | Value |
|-------|-------|
| REQ | REQ-256 |
| Date | 2026-09-23 |
| Problem | Selecting tasks/categories/pillars, the view type tab, and the History range in the "Detailed Trend Analysis" section was lost on every page refresh — all reverted to empty selection / 8-Weeks default |
| Approach | Added `DETAILED_TREND_SELECTION_STORAGE_KEY` + `loadDetailedTrendSelection()` helper. `detailedViewType`, `selectedTasks`, `selectedCategories`, `selectedPillars`, and `trendRangeDays` now lazy-init from localStorage (falling back to URL params for `detailedViewType`, then defaults). A single `useEffect` persists all five to one JSON blob in localStorage whenever any changes |
| Files | `frontend/src/pages/Analytics.tsx` |
| Outcome | Refreshing the page keeps whatever tasks/categories/pillars, view type, and history range were last selected in the Detailed Trend Analysis section |

---

### SOL-013 — Fix Day-over-Day Toggle Reset + Blank Week/Month Trend Charts on Refresh
| Field | Value |
|-------|-------|
| REQ | REQ-257 |
| Date | 2026-09-24 |
| Problem | After SOL-012 persisted the task/category/pillar selection, refreshing still (1) forced the "Day-over-Day" chart back on and hid Week-over-Week/Month-over-Month regardless of what was last shown (those 3 toggle states weren't persisted), and (2) showed blank/zero data on the Week-over-Week and Month-over-Month charts for a restored task selection, because `loadDetailedTrendData()` ran immediately on mount (triggered by `selectedTasks` restored from localStorage) before `allTasksData`/`allOneTimeTasksData` finished their async load — the `allTasksData.find(...)` task lookup failed silently, so `task_{id}` fields were never set on the trend rows |
| Approach | Added `showDayOverDay`/`showWeekOverWeek`/`showMonthOverMonth` to the persisted `DetailedTrendSelection` object (same `analytics_detailed_trend_selection_v1` localStorage key). Added `allTasksData.length`/`allOneTimeTasksData.length` to the dependency array of the trend-loading `useEffect` so it re-fires once those arrays populate, re-fetching correctly-populated trend data |
| Files | `frontend/src/pages/Analytics.tsx` |
| Outcome | Refresh now keeps whichever Day/Week/Month-over-X charts were last toggled on, and task trend charts (Daily/Weekly/Monthly) show real data immediately instead of a blank chart |

---

### SOL-014 — Fix Overlapping Weekly X-Axis Labels; Add Loading Indicator for Detailed Trend Charts
| Field | Value |
|-------|-------|
| REQ | REQ-258 |
| Date | 2026-09-24 |
| Problem | (1) The Detailed Trend Analysis "Weekly Average" chart's X-axis showed date ranges like "Jun 22–Jun 28" at default font size/spacing, which overlapped once enough weeks (8+) were plotted. (2) On every refresh the chart area sat blank for a moment while the trend API calls completed, with no visual cue that it was loading rather than broken |
| Approach | Added a `forceSplitAt` prop to `CustomMultilineLabel` that splits a label cleanly at a given substring (the en dash) into two lines, instead of the generic word-wrap (which could drop text when it produced more lines than `maxLines`). Wired it into the Weekly chart's `XAxis` (`tick={<CustomMultilineLabel maxCharsPerLine={8} maxLines={2} forceSplitAt="–" />}`, `height={38}`, `interval={0}`) so each week now renders as two short, non-overlapping lines (e.g. "Jun 22" / "Jun 28"). Added a `detailedTrendLoading` state set in `loadDetailedTrendData`'s try/finally, rendering a small "⏳ Loading trend data…" line above the Day/Week/Month-over toggle buttons while a fetch is in flight |
| Files | `frontend/src/pages/Analytics.tsx` |
| Outcome | Weekly chart date labels no longer overlap regardless of history range; the brief blank period on refresh now reads as an explicit loading state instead of a rendering bug |

---

### SOL-015 — Persist Hours/% Display Toggle in Detailed Trend Analysis
| Field | Value |
|-------|-------|
| REQ | REQ-259 |
| Date | 2026-09-24 |
| Problem | The ⏱️ Hours / 📊 % toggle on the Detailed Trend Analysis charts always reset to "%" after a page refresh, ignoring whatever the user had last selected |
| Approach | Added `showAsHours` to the `DetailedTrendSelection` interface; the state now lazy-inits from `loadDetailedTrendSelection()` and is included in the persisting `useEffect`'s dependency array and saved object, same as the task/category/pillar selection and Day/Week/Month-over toggles |
| Files | `frontend/src/pages/Analytics.tsx` |
| Outcome | Refreshing the page keeps whichever of Hours/% was last selected on the Detailed Trend Analysis charts |

---

*Last updated: 2026-09-24 | Add entries here whenever a major feature or fix lands*

