# MyTimeManager — Process Notes & Life Analyses

> Process decisions, retrospectives, and periodic CANI life analyses. Loaded by the `makingmehappier` agent on every session. Life analyses are appended here automatically when you ask "analyze my life" or "CANI check".

---

## How to Use This File

- **Process Notes**: Architecture decisions, workflow changes, lessons learned
- **Life Analyses**: Periodic snapshots of pillar balance — added automatically by agent
- **Retrospectives**: Sprint/period reviews

---

## Development Process

### Workflow Rules (Established)

1. **Before any DB schema change**: Run `./backup-now.sh` or `./backup_database.sh`
2. **Test both environments**: `./start_app.sh` (direct) + `./start-docker.sh` (Docker)
3. **Windows bug reports** always come from daughter's machine → test with Docker, not direct run
4. **New API routes** are invisible until added to `backend/app/main.py` lines 70-108
5. **Business logic** belongs in `backend/app/services/` (27 service files, `@staticmethod` pattern) — NOT in routes
6. **Context bypass**: Always use React context hooks (`useTaskContext`, `useTimeEntriesContext`) — never call API directly from components

### Architecture Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-01-01 | SQLite over PostgreSQL for initial launch | Simplicity; no server needed; easy file-copy backup for family deployment |
| 2024-01-01 | Three 8-hour pillars over free-form scheduling | CANI philosophy; balanced life enforcement |
| 2024-02-01 | Separate status tables per time period | Enables cross-tab monitoring without global state mutation |
| 2024-03-01 | timezone_utils.py as mandatory datetime wrapper | Windows/Mac UTC inconsistency; single fix point |
| 2024-04-01 | Docker for family deployment | Eliminates Python/Node installation friction for non-technical family members |
| 2026-07-20 | Custom agent (makingmehappier) with REQUIREMENTS/SOLUTIONS/PROCESS docs | Persistent context across Copilot sessions; no more re-explaining |
| 2026-09-12 | Added Section 4 "Productization Roadmap" to REQUIREMENTS.md (REQ-217 to REQ-238): known bugs, auth/multi-tenancy, UX polish, testing/ops, business readiness | Triggered by the goal of eventually marketing/selling the app beyond family use — current app has zero auth and single-tenant schema, which are the real blockers, not UI polish |

---

## Retrospectives

### 2026-09-12 — Productization Gap Review

Prompted by the goal of eventually showing this app to others / selling it. Audited the codebase for what's actually blocking that (vs. nice-to-haves):

- **Biggest blocker**: no authentication and no per-household data isolation (REQ-222, REQ-223). Every table is single-tenant today; this is the real gate before anyone outside the family can use it safely.
- **Found real bugs while auditing**: two pre-existing TypeScript compile errors in the Circle of Life analytics view (`circleOfLifePeriod` type doesn't include `'year'`; `row.isDrain` missing on one branch of a union type) — logged as REQ-217/REQ-218.
- **Documentation bug**: REQUIREMENTS.md itself had duplicate REQ-201/REQ-202 IDs from two different work sessions — renumbered to REQ-215/REQ-216 (REQ-219).
- **Hygiene gap**: 40+ `console.log` debug statements left in Analytics.tsx, some logging full API responses — fine for a family app, not fine to ship externally (REQ-220).
- **Missing for any public/paid distribution**: no LICENSE file, no onboarding flow, no CI, no error monitoring, no HTTPS in docker-compose. All logged in Section 4.
- **Decision needed before doing the heavy lifting**: self-hosted open-source vs. hosted SaaS. This determines whether auth/multi-tenancy/billing (REQ-222/223/238) are even the right investment — logged REQ-238 as BLOCKED pending that decision.

### 2026-09-12 — Mobile App Question

User raised wanting a mobile app eventually and asked directly whether recent web work (Analytics trend-line redesign) had mobile in mind. Honest answer: no — that work was pure web SVG/CSS, scoped to the browser dashboard only.

Logged the mobile decision as its own item (REQ-239) rather than assuming a path, because the three realistic options have very different costs:
- **PWA** (manifest + service worker on the existing app) — near-zero cost, reuses everything, good first step to validate real mobile usage.
- **Capacitor/Ionic** — wraps the existing React app in a native shell, ~90% code reuse, unlocks push/native APIs.
- **Full React Native rewrite** — best native feel, but a second UI codebase forever after; none of the current web-only styling (including this session's Analytics work) carries over.

Key insight: REQ-215 (mobile-responsive web layout, already backlogged) is a prerequisite for *all three* paths, so it stays worth doing regardless of which one gets picked. Also flagged (REQ-241) that continuing to invest in web-only CSS/SVG styling makes a future React Native pivot more expensive the longer it's deferred — worth deciding on a path sooner rather than later if mobile is a real near-future goal, not just PWA/Capacitor as an afterthought.

### 2026-09-12 — Multi-Account & Family Sharing Vision (distant idea, logged for architecture guidance only)

User confirmed web stays the near-term priority, but shared a longer-term vision: one subscriber uses their account across mobile/laptop/browser, can create up to ~4 individual sub-accounts, plus an optional shared "Family Account" for joint goals. Explicitly not scheduled — asked how to avoid painting the current single-tenant design into a corner that would force a rewrite later.

Logged as REQ-245 through REQ-249. The core architectural guidance (REQ-246), so it isn't lost before REQ-222/223 are ever scheduled:
- Model **User → Account → Household** as 3 distinct concepts, not 2. User=login identity, Account=an individual's private data (1:1 with User today), Household=an optional many-to-many group Accounts can join. This cleanly separates "single person, multiple devices" from "family sharing" — conflating them now would be the actual rewrite risk.
- When multi-tenancy is eventually built, add a nullable `account_id` to every existing table and backfill with one default account — additive migration, same pattern as the existing 42+ migrations, not a schema rewrite.
- Shared "Family Goal" data belongs in its own table keyed by `household_id`, never bolted onto per-account tables — keeps private-vs-shared an explicit boundary instead of an implicit query-filter rule that's easy to get wrong (and easy to leak data through).
- Frontend needs no changes today: 3 Contexts + 1 apiClient already centralize all data access, so an account/household switcher later is a threading exercise, not a rewrite.
- Sequencing callout: single-user cross-device sync only needs auth (REQ-222) — the family-sharing model (REQ-245/247) is a separate, harder problem (privacy/visibility rules between family members) that shouldn't block or be conflated with the simpler "log in from my phone and laptop" need.



> Entries below are generated by the `makingmehappier` agent when you request a life analysis. Most recent first.

---

### Life Analysis — 2026-07-20 (Initial Baseline)

**Context**: First analysis — establishing baseline as agent is set up.

**Pillars at a Glance**:
| Pillar | Intent | Observation |
|--------|--------|-------------|
| 💼 Hard Work | 8 hrs/day focused deep work | Building MyTimeManager actively — good engagement |
| 🧘 Calmness | 8 hrs/day rest, reflection, health | Unknown — needs data from app |
| 👨‍👩‍👦 Family | 8 hrs/day quality time | Building tools FOR family — proxy engagement |

**Top 3 Gaps Identified** *(to be updated with real data)*:
1. **Calmness tracking gap**: No habit data yet visible for meditation/rest routines — add habits in the app to make this measurable
2. **Family time intentionality**: App is built *for* family but quality time should be tracked explicitly, not just assumed
3. **Tool vs. living**: Risk of spending more time building the time manager than using it — set a ratio (e.g., 1 hour building : 5 hours living by the system)

**Recommended Actions**:
- [ ] Add at least 3 Calmness habits to the tracker (e.g., meditation, walk, reading)
- [ ] Create a Family pillar daily task for dedicated screen-free time
- [ ] Schedule a "use the tool" day before any new build day

**Next Analysis**: Request with "CANI check" or "analyze my life" — provide current habit streaks and time entries for deeper analysis.

---

## Retrospectives

> Add sprint/period reviews here.

### 2026-07-20 — Agent Setup Sprint

**Done**:
- ✅ Created `makingmehappier` custom agent
- ✅ REQUIREMENTS.md with REQ-001 through REQ-202
- ✅ SOLUTIONS.md with SOL-001 through SOL-005
- ✅ PROCESS.md with process rules and baseline life analysis

**Next Sprint Goals**:
- Complete analytics dashboard (REQ-200)
- First real life analysis with actual data from the app
- Evaluate REQ-201 (mobile) and REQ-202 (PostgreSQL migration) priority

### 2026-10-13 — Weekend Slump: Redesigning the Week (REQ-261)

**Pattern**: Strong Mon–Fri, weak Sat+Sun → both weak days sit back-to-back at the end of the week, so the week (and month) always closes weak and the next Monday starts with a "recovery" mindset.

**Decision**: Start the week on Sunday → Sunday becomes a *launch day* (plan the week, small win), Saturday stays the *closing day*. Weak days are split across the two ends instead of stacked.

**Guardrails so this actually works** (the calendar change alone won't fix the habit):
- Make Sunday's bar deliberately small: a 20-minute weekly planning ritual + one "minimum win" per pillar (a floor, not a stretch).
- Make Saturday a *planned* Family/Calmness day (those pillars are weekend-natural) rather than an unstructured gap.
- Review after 4 weeks: compare weekend vs weekday pillar hours. If weekends are still the gap, the issue is the weekend plan, not the week boundary.

---

*Last updated: 2026-10-13 | Maintained by makingmehappier agent*
