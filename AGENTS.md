# AGENTS.md — HRP Session Knowledge Base

> Canonical reference for any AI agent continuing work on this project.
> Read this FIRST before making changes.

---

## Project Overview

**HRP (Home Resource Planner)** — Self-hostable household ERP. One instance = one household. 13 integrated modules, not 13 siloed apps. Cross-module linking is the core value proposition.

**License**: AGPL-3.0-or-later (do NOT write a LICENSE file — user said so explicitly)

---

## Stack (Mandatory — Do Not Replace)

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | SvelteKit (Svelte 5) | adapter-node for Docker |
| UI | shadcn-svelte + Tailwind CSS v4 | Bits UI underneath |
| ORM | Drizzle ORM | better-sqlite3 driver (sync API) |
| DB | SQLite | WAL mode, FK enforcement |
| Auth | Custom session-based | Argon2id passwords, 64-hex session tokens |
| IDs | nanoid (21 chars) | Text primary keys everywhere |
| i18n | Typed TS objects | NOT Paraglide. `en.ts` + `fr.ts` |
| Package manager | pnpm | Uses `pnpm-lock.yaml` |

---

## Critical Conventions

### Svelte 5 Runes Only
- `$state`, `$derived`, `$props`, `$effect` — NO `$:`, NO `on:click`, NO `createEventDispatcher`
- `let { data } = $props()` in pages

### Form Pattern
- All CRUD uses **SvelteKit form actions** (`method="POST"` + hidden inputs)
- `use:enhance` from `$app/forms` to close dialogs after submission
- Document upload is the ONE exception (uses `fetch` with `FormData`)

### UI Pattern
- **Dialog** (shadcn) for create/edit forms
- **AlertDialog** (shadcn) for delete confirmations
- Native `<select>` elements use shared `selectClass` from `$lib/utils.ts` — import it, don't copy-paste the string

### DB Operations
- All Drizzle calls are **synchronous** (better-sqlite3)
- `.run()` for inserts/updates/deletes
- `.get()` for single results
- `.all()` for lists
- `.returning().get()` when you need the inserted row back
- **Exception**: `hashPassword()` is async (Argon2id) — actions using it need `await`

### Permission Enforcement
- **Server-side**: Every form action checks `hasModuleAccess(locals.user?.role, module, action)` and returns `fail(403)` if unauthorized
- **Client-side**: Buttons wrapped in `{#if hasModuleAccess(userRole, module, action)}` using `page.data.user?.role`
- **Sidebar**: Navigation items filtered by view permission

### i18n
- Add keys to BOTH `en.ts` AND `fr.ts` in the same structure
- The `Translations` type in `fr.ts` is derived from `en.ts` via `DeepStringify`
- Use `$t.section.key` for static access, `translate('section.key', { param })` for interpolation

---

## Implementation Status

### ✅ Fully Complete

| Module | List | Detail | Create | Edit | Delete | Server Guards | UI Guards |
|--------|------|--------|--------|------|--------|---------------|-----------|
| Dashboard | ✅ | — | — | — | — | — | — |
| Projects | ✅ | ✅ `[id]` | ✅ `/new` + dialog | ✅ dialog | ✅ AlertDialog | ✅ | ✅ |
| Tasks | ✅ | — | ✅ dialog | ✅ dialog | ✅ AlertDialog | ✅ | ✅ |
| Assets | ✅ | ✅ `[id]` | ✅ dialog | ✅ dialog | ✅ AlertDialog | ✅ | ✅ |
| Rooms | ✅ | ✅ `[id]` | ✅ dialog | ✅ dialog | ✅ AlertDialog | ✅ | ✅ |
| Finances | ✅ | — | ✅ expense+budget+category | ✅ expense+budget+line | ✅ AlertDialog | ✅ | ✅ |
| Documents | ✅ | — | ✅ upload dialog | — | ✅ AlertDialog | ✅ | ✅ |
| Knowledge | ✅ | — | ✅ dialog | ✅ dialog | ✅ AlertDialog | ✅ | ✅ |
| Maintenance | ✅ | — | ✅ dialog | ✅ dialog | ✅ AlertDialog | ✅ | ✅ |
| Calendar | ✅ month grid | — | — | — | — | ✅ | — |
| Notifications | ✅ | — | — | ✅ markRead | — | ✅ | — |
| Search | ✅ | — | — | — | — | — | — |
| Settings | ✅ tabs | — | ✅ user mgmt + tags | ✅ user mgmt + tags | ✅ user mgmt + tags | ✅ | ✅ |

### ✅ Infrastructure Complete

| Component | Status | Notes |
|-----------|--------|-------|
| Auth (login/setup) | ✅ | Argon2id + session cookies |
| Session management | ✅ | Auto-extend, cleanup |
| Hooks (middleware) | ✅ | Session validation, locale detection |
| Permission system | ✅ | Server + client, 4 roles, module matrix |
| File upload API | ✅ | POST/PUT/DELETE at `/api/upload` |
| Backup API | ✅ | GET/POST at `/api/backup` |
| Health endpoint | ✅ | GET `/api/health` |
| Service worker | ✅ | `static/sw.js`, offline banner |
| Automation engine | ✅ | `src/lib/server/automation.ts` (505 lines) |
| Notification service | ✅ | `src/lib/server/notifications.ts` — `createNotification()`, `notifyHousehold()` |
| Storage service | ✅ | `src/lib/server/storage.ts` |
| Backup service | ✅ | `src/lib/server/backup.ts` |
| Logger | ✅ | Pino with module scoping |
| Config | ✅ | Env-based, typed |
| Docker | ✅ | Multi-stage Dockerfile + compose |
| Seed data | ✅ | 1 household, 2 users, sample entities |
| Unit tests | ✅ | 25 tests (auth, permissions, i18n) |
| E2e config | ✅ | Playwright config + smoke tests |
| README | ✅ | Full project documentation |
| OIDC auth | ✅ | Generic OIDC login, any compliant provider |
| Real-time (SSE) | ✅ | Server-Sent Events, auto-reconnect, household-scoped |
| Export/Import | ✅ | Per-module CSV/JSON via Settings → Data |
| Bulk operations | ✅ | Multi-select + floating action bar on 4 pages |

---

## Remaining Code Quality Improvements

Non-blocking polish items. Pick up when next touching these files.

### 1. Full i18n Rune Migration (~2h)

**Current state**: `src/lib/i18n/index.ts` uses `writable` + `derived` from `svelte/store`. Every component uses `$t.section.key` (auto-subscribe via `$` prefix). The subscribe leak in settings was fixed, but the underlying store-based architecture remains.

**Goal**: Rewrite `index.ts` → `index.svelte.ts` using `$state` + `$derived` runes. This would change `$t.nav.dashboard` → `t.nav.dashboard` across all components (hundreds of references).

**Why deferred**: High-risk mechanical refactor touching every `.svelte` file. The stores work correctly in Svelte 5. The actual bug (subscribe leak) was already fixed.

**When to do it**: If/when Svelte deprecates store auto-subscribe, or during a major refactor pass.

### 2. Standardize `use:enhance` Callback Patterns (~45min)

**Current state**: Three different patterns used inconsistently across 12 files:
- **Pattern A** (most common): `() => ({ update }) => update().then(() => { dialogOpen = false })`
- **Pattern B** (8 instances): async with `result.type === 'success'` check
- **Pattern C** (2 instances): `() => ({ update }) => update({ reset: false })`

**Goal**: Standardize on Pattern A for simple dialog-close, Pattern B where result checking is needed. Document the convention.

**Files**: tasks, finances, settings, maintenance, knowledge, projects/[id], assets/[id], assets, rooms/[id], rooms/floor-plans, projects.

### 3. Replace `goto()` with `<a>` Links in Floor Plans (~10min)

**File**: `src/routes/(app)/rooms/floor-plans/+page.svelte` lines 480-483

**Current**: Room overlays use `onclick={() => goto('/rooms/' + room.id)}` — loses right-click context menu, screen reader link semantics, and SvelteKit prefetching.

**Fix**: Wrap overlay content in `<a href="/rooms/{room.id}">` with `e.preventDefault()` in edit mode.

### 4. Component Decomposition (~3h)

Five page components exceed 500 lines and would benefit from extraction:

| Component | Lines | Suggested Extractions |
|-----------|-------|----------------------|
| `settings/+page.svelte` | 1299 | ProfileTab, UsersTab, TagsTab, AutomationTab, AuditTab, DataTab, BackupTab |
| `finances/+page.svelte` | 1050 | ExpensesSection, BudgetsSection, CategoryManager |
| `projects/[id]/+page.svelte` | 716 | PhaseManager, EntityLinkDialogs |
| `tasks/+page.svelte` | 698 | TaskTable, TaskDialogs, TagManager |
| `rooms/floor-plans/+page.svelte` | 528 | FloorPlanCanvas, RoomOverlay |

**Note**: Purely maintainability improvement. No bugs or performance issues. Use `$props` + snippets for child components. Keep form actions in the page server file.

---

## File Map

### Route Structure
```
src/routes/
├── +layout.server.ts          # Root: user + locale
├── +page.server.ts            # Root redirect (→ dashboard/setup/login)
├── (auth)/
│   ├── login/+page.server.ts  # Login form action
│   ├── setup/+page.server.ts  # Household + admin creation
│   └── auth/oidc/             # OIDC initiate + callback
├── (app)/
│   ├── +layout.server.ts      # Auth guard, provides user + household
│   ├── +layout.svelte         # Sidebar navigation (filtered by permissions)
│   ├── dashboard/             # Read-only aggregation
│   ├── projects/              # List + [id] detail + /new
│   ├── tasks/                 # Full CRUD
│   ├── assets/                # List + [id] detail
│   ├── rooms/                 # List + [id] detail
│   ├── finances/              # Expenses + Budgets
│   ├── documents/             # Upload + delete
│   ├── knowledge/             # Articles CRUD
│   ├── maintenance/           # Schedules CRUD
│   ├── calendar/              # Month grid (read-only)
│   ├── search/                # Multi-entity search
│   ├── notifications/         # Mark read
│   └── settings/              # Household + Users + Backup tabs
└── api/
    ├── health/+server.ts      # GET → { status: 'ok' }
    ├── logout/+server.ts      # POST → invalidate session
    ├── upload/+server.ts      # POST/PUT/DELETE documents
    ├── download/+server.ts    # GET → download document file
    ├── backup/+server.ts      # GET/POST backups (admin only)
    ├── export/+server.ts      # GET → CSV/JSON export per module
    ├── import/+server.ts      # POST → CSV/JSON import per module
    └── events/+server.ts      # GET → SSE real-time event stream
```

### Server Infrastructure
```
src/lib/server/
├── auth/
│   ├── password.ts            # hashPassword(), verifyPassword() [Argon2id]
│   ├── session.ts             # createSession(), validateSession(), invalidate*()
│   └── permissions.ts         # hasModuleAccess(), canViewEntity(), isAtLeast()
├── db/
│   ├── index.ts               # DB connection (better-sqlite3, WAL, FK)
│   ├── seed.ts                # Development seed data
│   └── schema/                # 16 files: common, household, users, rooms, projects,
│                              #   assets, tasks, finances, documents, knowledge,
│                              #   maintenance, notifications, tags, automation, audit, index
├── automation.ts              # Rule engine: processTrigger(), executeActions()
├── backup.ts                  # createBackup(), listBackups(), cleanup
├── config.ts                  # Env-based config (DB path, uploads, auth, locale)
├── logger.ts                  # Pino logger with createLogger(module)
├── events.ts                  # SSE pub/sub: emitEntityEvent(), subscribe()
├── notifications.ts           # createNotification(), notifyHousehold()
├── oidc.ts                    # OIDC Discovery, token exchange, email extraction
└── storage.ts                 # saveFile(), deleteFile(), getFile()
```

### Client Infrastructure
```
src/lib/
├── components/ui/             # 47 shadcn-svelte components
├── components/bulk-actions.svelte  # Shared bulk action bar component
├── hooks/is-mobile.svelte.ts  # Mobile breakpoint detection
├── stores/events.svelte.ts    # Client SSE store (EventSource, auto-reconnect)
├── i18n/                      # en.ts, fr.ts, index.ts (stores + translate)
├── validation/                # 7 Zod schemas: auth, projects, tasks, assets,
│                              #   rooms, finances, maintenance
├── permissions.ts             # Client-side hasModuleAccess()
└── utils.ts                   # cn() for Tailwind class merging
```

### Tests
```
tests/
├── unit/
│   ├── auth/
│   │   ├── password.test.ts   # 7 tests: hash/verify
│   │   └── permissions.test.ts # 9 tests: module access, visibility, roles
│   ├── permissions-client.test.ts # 4 tests: client-side checks
│   └── i18n.test.ts           # 5 tests: EN/FR parity, no empty values
└── e2e/
    └── smoke.test.ts          # Login page, auth redirect, health endpoint
```

### Config Files
```
/
├── package.json               # pnpm, node >=20
├── svelte.config.js           # adapter-node
├── vite.config.ts             # Tailwind + SvelteKit plugins
├── vitest.config.ts           # Unit test config (no SvelteKit plugin)
├── playwright.config.ts       # E2e config (port 4173, chromium)
├── drizzle.config.ts          # Drizzle Kit config
├── Dockerfile                 # Multi-stage (deps → build → runner)
├── docker-compose.yml         # Single service + named volume
├── tailwind.config.ts         # Tailwind v4
├── tsconfig.json
└── ARCHITECTURE.md            # Full architecture document (412 lines)
```

---

## Database Schema Summary

**31 tables** across 7 domains:

| Domain | Tables |
|--------|--------|
| Core | `households`, `users`, `sessions`, `oauthAccounts` |
| Projects & Tasks | `projects`, `projectPhases`, `projectRooms` (junction), `tasks` |
| Assets & Rooms | `assets`, `projectAssets` (junction), `rooms`, `floorPlans` |
| Finances | `expenses`, `budgets`, `budgetLines`, `expenseCategories` |
| Documents | `documents`, `documentVersions`, `projectDocuments`, `assetDocuments`, `roomDocuments` (junctions) |
| Knowledge & Maintenance | `knowledgeArticles`, `knowledgeLinks`, `maintenanceSchedules`, `maintenanceLogs` |
| System | `notifications`, `automationRules`, `automationLogs`, `auditLog`, `tags`, `entityTags` |

**Key relationships**:
- All entities scoped to `householdId` (CASCADE delete)
- 5 explicit junction tables for cross-entity linking
- 2 polymorphic linking systems: `entityTags` (tagging) + `knowledgeLinks` (knowledge→entity)
- `notifications` use polymorphic `entityType`/`entityId` for linking
- Self-referential: `rooms.parentId`, `tasks.parentId`, `expenseCategories.parentId`

---

## Permission Matrix

```
Module          admin   adult   child   guest
─────────────── ─────── ─────── ─────── ───────
dashboard       V       V       V       V
projects        VCED    VCE     V       V
tasks           VCED    VCED    VE*     V
assets          VCED    VCE     V       V
rooms           VCED    VCE     V       V
finances        VCED    VCE     —       —
documents       VCED    VCED    V       V
knowledge       VCED    VCE     V       V
maintenance     VCED    VCE     V       —
calendar        V       V       V       —
settings        VCED    V       V       —
users           VCED    V       —       —
automation      VCED    V       —       —
notifications   VED     VED     VE      V
search          V       V       V       V

V=view C=create E=edit D=delete  —=no access
* child can edit assigned tasks only
```

---

## Environment Variables

| Variable | Default | Required |
|----------|---------|----------|
| `ORIGIN` | `http://localhost:3000` | Production |
| `DATABASE_PATH` | `./data/hrp.db` | — |
| `UPLOAD_DIR` | `./uploads` | — |
| `BACKUP_DIR` | `./data/backups` | — |
| `AUTH_SECRET` | `dev-secret-change-me` | Production |
| `BODY_SIZE_LIMIT` | `100M` | — |
| `LOG_LEVEL` | `info` | — |
| `DEFAULT_LOCALE` | `en` | — |
| `MAX_UPLOAD_MB` | `50` | — |
| `OIDC_PROVIDER_NAME` | `SSO` | — |
| `OIDC_ISSUER` | — | To enable OIDC |
| `OIDC_CLIENT_ID` | — | With OIDC |
| `OIDC_CLIENT_SECRET` | — | With OIDC |
| `OIDC_SCOPES` | `openid email profile` | — |

---

## Commands

```bash
pnpm dev              # Dev server
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm check            # Type-check (svelte-kit sync + svelte-check)
pnpm test             # Vitest unit tests (25 passing)
pnpm test:e2e         # Playwright e2e tests
pnpm db:push          # Push schema to SQLite
pnpm db:seed          # Seed sample data
pnpm db:studio        # Drizzle Studio
docker compose up -d  # Run in Docker
```

---

## Verification State

| Check | Result | Date |
|-------|--------|------|
| `pnpm check` | 0 errors, 8 warnings (shadcn-svelte + floor-plans slider, not actionable) | 2026-03-13 |
| `pnpm build` | ✅ passes | 2026-03-13 |
| `pnpm test` | 25/25 passing | 2026-03-13 |
| Runtime (login) | ✅ works | 2026-03-12 |
| Runtime (all 13 pages) | ✅ 200 OK | 2026-03-12 |

---

## Design Decisions Log

| Decision | Choice | Why |
|----------|--------|-----|
| SQLite driver | `better-sqlite3` (sync) | Fastest for local Node.js, no async overhead |
| Auth | Custom session-based | Lucia v3 deprecated; simple is better |
| IDs | `nanoid` text PKs | URL-safe, no integer leaking |
| Forms | SvelteKit form actions | Progressive enhancement, no client JS required |
| i18n | Typed TS objects | Simple, type-safe, no build step |
| Offline | Service worker + stale-while-revalidate | Honest read-only, no complex sync |
| Calendar | Custom grid | shadcn Calendar is a date picker, not an event calendar |
| Vitest config | Separate `vitest.config.ts` | SvelteKit plugin causes startup errors in unit test mode |
| `vite.config.ts` plugins | `as never[]` cast | Dual vite version (v7 direct + v5 via vitest) type mismatch |
| OAuth | Generic OIDC (not provider-specific) | Works with Keycloak, Authelia, Authentik, Google, Azure AD, GitHub via manual overrides |
| Real-time | SSE (not WebSocket) | Simpler, HTTP-based, one-directional, auto-reconnects, no dependencies |
