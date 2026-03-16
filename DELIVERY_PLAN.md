# HRP Delivery Plan — Phase 4

## 1. Implementation Priority Order

Priority is based on: **Auth first** (nothing works without it), then **the data backbone** (household/rooms/assets), then **the cross-module value** (projects linking everything), then **supporting modules**.

### Slice 1: Auth & First-Run Setup (CRITICAL PATH)
**Goal**: A real user can log in, and a fresh instance can be bootstrapped.

1. Wire `/login` to real password verification + session creation
2. Wire `/setup` to create household + admin user + default automation rules
3. Wire `(app)/+layout.server.ts` to load real household from DB
4. Add `/api/logout` endpoint to invalidate session

**Validates**: Auth system, session management, household creation, DB writes.

### Slice 2: Spatial Foundation — Rooms
**Goal**: CRUD rooms, the spatial backbone everything links to.

1. Wire `/rooms` list page to real DB query
2. Wire `/rooms/[id]` detail page to real DB query (show linked assets, projects, tasks)
3. Wire room create/edit form actions to real DB inserts/updates
4. Wire room delete action

**Validates**: Basic CRUD pattern that all other modules follow.

### Slice 3: Asset Registry
**Goal**: CRUD assets linked to rooms.

1. Wire `/assets` list with real data, filterable by room/category/status
2. Wire `/assets/[id]` detail showing room link, linked projects, maintenance schedules
3. Wire asset create/edit/delete actions

**Validates**: Cross-module linking (asset → room), the pattern for all entity detail pages.

### Slice 4: Project Lifecycle (THE VALUE SLICE)
**Goal**: Create a project, link rooms/assets/tasks, track budget, see it on dashboard.

1. Wire `/projects` list with real data
2. Wire `/projects/new` create form with room/asset multi-select linking
3. Wire `/projects/[id]` detail showing linked rooms, assets, tasks, budget, expenses
4. Wire project status updates (triggers automation on completion)
5. Wire task CRUD within project context
6. Wire expense/budget creation linked to project

**Validates**: The entire cross-module value proposition — this IS the product demo.

### Slice 5: Dashboard (Aggregation)
**Goal**: Dashboard pulls real data across all modules.

1. Wire dashboard to query: active projects, overdue tasks, budget spend, upcoming maintenance, asset alerts
2. All dashboard cards link to real detail pages

**Validates**: Cross-module read aggregation.

### Slice 6: Tasks (Standalone)
**Goal**: Tasks list with filtering, independent of projects.

1. Wire `/tasks` list page — filter by status, assignee, project, due date
2. Wire task create/edit/complete actions
3. Task assignment and due date tracking

### Slice 7: Finance Module
**Goal**: Budgets and expenses with project linking.

1. Wire `/finances` overview — budget summaries, recent expenses
2. Wire budget create/edit linked to projects
3. Wire expense create/edit with category, budget line, project linking

### Slice 8: Maintenance Module
**Goal**: Maintenance schedules with asset/room linking.

1. Wire `/maintenance` list — upcoming, overdue, completed
2. Wire maintenance schedule CRUD linked to assets/rooms
3. Wire maintenance completion logging

### Slice 9: Remaining Modules
**Goal**: Documents, Knowledge, Calendar, Search, Notifications, Settings.

1. Wire notifications list (mark read, link to source entity)
2. Wire documents list/upload (uses storage.ts)
3. Wire knowledge articles CRUD
4. Wire calendar (aggregate tasks, maintenance, project dates)
5. Wire search (structured field queries across modules)
6. Wire settings (household config, user management, backup/restore)

---

## 2. Critical User Journeys

### Journey A: Fresh Install → First Dashboard
```
User visits / → redirected to /login → no account → goes to /setup
→ enters household name + admin email + password
→ household + user created in DB, session set
→ redirected to /dashboard (empty state)
```

### Journey B: Create a Project with Full Cross-Module Links
```
Admin logs in → goes to /projects/new
→ creates "Bathroom Renovation" project
→ selects rooms: Bathroom
→ selects assets: Bathtub, Sink
→ sets budget: €8000
→ adds tasks: "Remove old tiles", "Install new fixtures"
→ adds expense: "Tiles from Leroy Merlin, €1200"
→ views project detail: sees rooms, assets, tasks, budget progress
→ dashboard shows the project with budget bar
```

### Journey C: Complete Project → Automation Fires
```
Admin marks "Bathroom Renovation" as completed
→ automation engine fires `project_completed` trigger
→ maintenance schedules auto-created for linked assets
→ notification created for admin
→ /notifications shows the auto-generated notification
→ /maintenance shows the new schedules
```

### Journey D: Day-to-Day Household Management
```
Adult user logs in → dashboard shows:
  - 2 active projects with budget bars
  - 3 overdue tasks (red badge)
  - Upcoming maintenance (dishwasher service in 5 days)
  - 1 asset alert (washing machine needs maintenance)
→ clicks overdue task → marks as done
→ clicks maintenance notification → logs completion
→ dashboard updates in real-time
```

---

## 3. Testing Strategy

### Unit Tests (`tests/unit/`)
- **Auth**: password hashing, session token generation, session validation
- **Automation**: rule condition matching, action execution, default rule seeding
- **Storage**: filename sanitization, path traversal prevention, upload validation
- **Backup**: backup info listing, old backup cleanup, zip validation
- **Permissions**: role level checks, visibility filtering

### Integration Tests (`tests/integration/`)
- **DB operations**: CRUD for each entity type through Drizzle
- **Cross-module links**: project ↔ room, project ↔ asset, task ↔ project
- **Automation flow**: trigger → condition check → action execution → log

### E2E Tests (`tests/e2e/`)
- **Setup flow**: fresh install → create household → land on dashboard
- **Login/logout flow**: login → navigate → logout → redirected to login
- **Project lifecycle**: create project → add tasks → add expense → view detail
- **CRUD smoke tests**: create/read/update/delete for projects, tasks, assets, rooms

### Test Infrastructure
- Unit/integration: `vitest` with `environment: 'node'`
- E2E: `@playwright/test` (already in devDependencies)
- Test DB: use in-memory SQLite or temp file per test
- No mocking of DB — test against real SQLite

---

## 4. Documentation Outline

### README.md (rewrite from scaffold default)
- Project description and screenshots
- Quick start: Docker, local dev
- Configuration (.env)
- Available scripts

### CONTRIBUTING.md
- Dev setup, architecture overview pointer
- Code conventions, commit message format
- How to add a new module

### API.md (future)
- Internal API routes documentation
- Intended for eventual public API
