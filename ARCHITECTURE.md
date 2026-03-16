# HRP — Home Resource Planner: Architecture Document

## 1. Product Interpretation

HRP is a **household ERP**: a single self-hosted instance serving one family, consolidating finances, assets, projects, tasks, spatial mapping, documents, knowledge, and maintenance into a unified operational platform.

The defining value is **cross-module connectivity** — a renovation project links to rooms, budgets, invoices, tasks, assets, and upon completion spawns maintenance schedules. Every entity page surfaces its relationships.

**This is not 13 independent apps glued together. It is one coherent domain with 13 views into it.**

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    SvelteKit App                     │
│  ┌──────────────┐  ┌────────────────────────────┐   │
│  │  (auth) routes│  │      (app) routes          │   │
│  │  /login       │  │  /dashboard /projects ...  │   │
│  │  /setup       │  │  /assets /rooms /finances  │   │
│  └──────────────┘  └────────────────────────────┘   │
│            │                    │                     │
│  ┌─────────┴────────────────────┴──────────────┐    │
│  │              Server Layer                     │    │
│  │  hooks.server.ts → auth middleware            │    │
│  │  +page.server.ts → load functions + actions   │    │
│  │  /api/* → REST-style endpoints                │    │
│  └──────────────────────────────────────────────┘    │
│            │                                          │
│  ┌─────────┴──────────────────────────────────┐      │
│  │           Service Layer ($lib/server/)       │      │
│  │  auth/  services/  storage/  automation/     │      │
│  │  backup/  logger.ts  config.ts               │      │
│  └──────────────────────────────────────────────┘      │
│            │                                          │
│  ┌─────────┴──────────────────────────────────┐      │
│  │         Data Layer (Drizzle ORM)             │      │
│  │  schema/  relations  migrations              │      │
│  └──────────────────────────────────────────────┘      │
│            │                                          │
│  ┌─────────┴────────┐  ┌──────────────────┐          │
│  │   SQLite (data/)  │  │  Disk (uploads/) │          │
│  └───────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────┘
```

**No microservices. No message queues. No external databases.** One process, one SQLite file, one uploads directory.

---

## 3. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Node.js via `@sveltejs/adapter-node` | Docker-friendly, SQLite-compatible |
| Database | SQLite via `better-sqlite3` | Synchronous, zero-config, single-file backup |
| ORM | Drizzle ORM with migration files | Type-safe, lightweight, SQL-close |
| Auth | Custom session-based (no Lucia) | Lucia v3 deprecated; custom is simpler for local accounts |
| Password hashing | `@node-rs/argon2` | Fast native binding, Argon2id |
| Session tokens | `crypto.getRandomValues` + base64 | No JWT — sessions in DB, revocable |
| Forms | `sveltekit-superforms` + Zod | Type-safe validation on client+server |
| UI | `shadcn-svelte` (Svelte 5) + Tailwind v4 | Composable, copy-paste components |
| IDs | `nanoid` (21 chars, URL-safe) as text PKs | Simple, no auto-increment coordination |
| i18n | Custom JSON-based with type safety | Simpler than paraglide, no build step |
| File storage | Disk-based, organized by entity | Metadata in DB, files on disk |
| Search | SQLite queries on indexed fields | No FTS5 for V1, just structured search |
| Logging | `pino` structured JSON logger | Lightweight, production-ready |
| Date handling | `date-fns` | Tree-shakeable, no Moment.js |

### Secondary libraries justified:
- **`pino`**: Production structured logging. Minimal, fast.
- **`nanoid`**: ID generation. 130 bytes, no deps.
- **`date-fns`**: Date utilities. Tree-shakeable.
- **`@node-rs/argon2`**: Password hashing. Native Rust binding.
- **`archiver` + `extract-zip`**: Backup archive creation/extraction.

---

## 4. Domain Model

### Entity Relationship Overview

```
Household ──1:N── User ──N:1── Role
    │
    ├── Project ──N:M── Room
    │     ├── ProjectPhase
    │     ├── Task ──N:1── User (assignee)
    │     ├── Budget ── BudgetLine
    │     ├── Expense ── ExpenseCategory
    │     └── ──N:M── Asset
    │     └── ──N:M── Document
    │
    ├── Asset ──N:1── Room
    │     ├── MaintenanceSchedule
    │     └── ──N:M── Document
    │
    ├── Room ──N:1── FloorPlan
    │     └── ──N:M── Document
    │
    ├── Document ── DocumentVersion
    │
    ├── KnowledgeArticle ──N:M── (Project, Asset, Room, Document)
    │
    ├── MaintenanceSchedule ──N:1── Asset
    │     └── MaintenanceLog
    │
    ├── Notification ──N:1── User
    │
    ├── AutomationRule
    │
    └── AuditLog
```

### Cross-module linking strategy

**Explicit junction tables** for core relationships:
- `project_rooms` — project ↔ room
- `project_assets` — project ↔ asset
- `project_documents` — project ↔ document
- `asset_documents` — asset ↔ document
- `room_documents` — room ↔ document

**Polymorphic linking** for cross-cutting concerns:
- `entity_tags` — (entity_type, entity_id, tag_id) for tagging anything
- `knowledge_links` — (article_id, target_type, target_id) for knowledge article links
- `notifications` — (entity_type, entity_id) for linking notifications to source entities

This hybrid approach gives us type-safe foreign keys for core domain relationships while allowing flexible tagging and notification linking.

---

## 5. Permission Model

### Roles (fixed set for V1)

| Role | Level | Capabilities |
|------|-------|-------------|
| `admin` | 100 | Full access, household settings, user management, all finances |
| `adult` | 50 | Most features, own finances, create/edit most entities |
| `child` | 20 | View assigned tasks, limited asset/room view, no finances |
| `guest` | 10 | Read-only access to explicitly shared entities |

### Entity visibility

Each entity has a `visibility` field:
- `household` — visible to all household members (default)
- `adults` — visible only to adult+ roles
- `private` — visible only to creator and admins
- `restricted` — visible only to explicitly listed users (future, not V1)

### Permission check flow

```
1. hooks.server.ts → load session → attach user+role to locals
2. +page.server.ts load → check role has module access
3. Service layer → check entity visibility against user role
4. UI → conditionally render based on user permissions
```

### Module access by role

| Module | admin | adult | child | guest |
|--------|-------|-------|-------|-------|
| Dashboard | ✓ | ✓ | ✓ (limited) | ✓ (limited) |
| Projects | CRUD | CRUD | Read assigned | Read shared |
| Tasks | CRUD | CRUD | Read/update assigned | Read |
| Assets | CRUD | CRUD | Read | Read |
| Rooms | CRUD | CRUD | Read | Read |
| Finances | CRUD | Own CRUD | — | — |
| Documents | CRUD | CRUD | Read shared | Read shared |
| Knowledge | CRUD | CRUD | Read | Read |
| Maintenance | CRUD | CRUD | Read | — |
| Calendar | ✓ | ✓ | Own tasks | — |
| Settings | ✓ | Profile only | Profile only | — |
| Users | CRUD | Read | — | — |

---

## 6. Storage Approach

### Database
- Single SQLite file at `data/hrp.db`
- WAL mode enabled for concurrent reads
- Drizzle ORM with generated migration files

### File storage
```
uploads/
  ├── documents/
  │     └── {document_id}/
  │           └── {version_id}_{filename}
  ├── floor-plans/
  │     └── {floor_plan_id}_{filename}
  └── avatars/
        └── {user_id}_{filename}
```

Files served through SvelteKit API route with auth checks, not static serving.

---

## 7. Automation Approach

Rule-based, deterministic, stored in DB:

```typescript
interface AutomationRule {
  id: string;
  name: string;
  trigger: 'project_completed' | 'budget_exceeded' | 'document_uploaded' | 'maintenance_due';
  conditions: Record<string, unknown>; // JSON conditions
  actions: Array<{
    type: 'create_maintenance' | 'create_notification' | 'create_task';
    params: Record<string, unknown>;
  }>;
  enabled: boolean;
}
```

V1 built-in rules:
1. **Project completion → Maintenance creation**: When project status → completed, create recurring maintenance for linked assets
2. **Budget threshold → Notification**: When project expenses exceed budget %, notify admin
3. **Maintenance due → Notification**: When maintenance schedule date arrives, notify assignee

Rules execute synchronously in service layer after triggering action. No background job queue.

---

## 8. API Design Direction

**Internal-first, public-ready structure:**

- SvelteKit form actions for mutations (create, update, delete)
- SvelteKit load functions for data fetching
- `/api/*` routes for AJAX operations (search, upload, backup)
- All data access through service functions in `$lib/server/services/`

Services are the boundary: routes call services, services call Drizzle. This makes future public API extraction straightforward — add API routes that call the same services.

All service functions accept a `userId` parameter for permission checks. No implicit auth context.

---

## 9. i18n Strategy

Simple, type-safe, JSON-based:

```
$lib/i18n/
  ├── index.ts      — locale store, t() function, type definitions
  ├── en.ts         — English translations (default)
  └── fr.ts         — French translations
```

- Translations are typed TypeScript objects (not JSON files)
- `t('module.key')` function with autocomplete
- Locale stored in cookie, set in hooks
- All UI strings go through `t()` — no hardcoded strings
- Nested keys by module: `t('projects.status.completed')`

---

## 10. Backup/Restore Strategy

### Backup (from UI, admin only)
1. Checkpoint WAL to main DB file
2. `VACUUM INTO` a temp copy (consistent snapshot)
3. Archive: DB copy + uploads/ directory → .zip
4. Stream to client as download

### Restore (from UI, admin only)
1. Upload .zip archive
2. Validate contents (DB file + uploads/)
3. Stop accepting writes (maintenance mode)
4. Replace DB file and uploads/
5. Restart (Docker container restart)

### Automated backup
- Cron-triggered DB-only backup to `data/backups/`
- Configurable retention (default: 7 daily)

---

## 11. Offline Read-Only Strategy

Pragmatic approach — not full offline-first:

1. **Service Worker**: Cache shell (HTML, CSS, JS) and recent API responses
2. **Stale-while-revalidate**: Serve cached data when offline, refresh when online
3. **Offline indicator**: Show banner when connection lost
4. **No offline writes**: Queue is complex with SQLite; honest about limitation

Implementation: Custom service worker registered in `src/service-worker.ts` using SvelteKit's service worker support.

---

## 12. Project Structure

```
hrp/
├── src/
│   ├── app.html                    # HTML shell
│   ├── app.css                     # Tailwind imports + theme
│   ├── app.d.ts                    # SvelteKit type augmentation
│   ├── hooks.server.ts             # Auth middleware, locale
│   ├── lib/
│   │   ├── server/                 # Server-only code
│   │   │   ├── db/
│   │   │   │   ├── index.ts        # DB connection
│   │   │   │   ├── schema/         # Drizzle table definitions
│   │   │   │   │   ├── index.ts    # Re-exports all schemas
│   │   │   │   │   ├── household.ts
│   │   │   │   │   ├── users.ts
│   │   │   │   │   ├── projects.ts
│   │   │   │   │   ├── tasks.ts
│   │   │   │   │   ├── assets.ts
│   │   │   │   │   ├── rooms.ts
│   │   │   │   │   ├── finances.ts
│   │   │   │   │   ├── documents.ts
│   │   │   │   │   ├── knowledge.ts
│   │   │   │   │   ├── maintenance.ts
│   │   │   │   │   ├── notifications.ts
│   │   │   │   │   ├── automation.ts
│   │   │   │   │   ├── tags.ts
│   │   │   │   │   └── audit.ts
│   │   │   │   ├── relations.ts    # Drizzle relations
│   │   │   │   └── seed.ts         # Demo data
│   │   │   ├── services/           # Business logic
│   │   │   │   ├── auth.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── tasks.ts
│   │   │   │   ├── assets.ts
│   │   │   │   ├── rooms.ts
│   │   │   │   ├── finances.ts
│   │   │   │   ├── documents.ts
│   │   │   │   ├── knowledge.ts
│   │   │   │   ├── maintenance.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   ├── search.ts
│   │   │   │   └── dashboard.ts
│   │   │   ├── auth/
│   │   │   │   ├── password.ts     # Argon2 hashing
│   │   │   │   ├── session.ts      # Session management
│   │   │   │   └── permissions.ts  # Permission checks
│   │   │   ├── automation/
│   │   │   │   ├── engine.ts       # Rule execution
│   │   │   │   └── rules/          # Built-in rules
│   │   │   ├── storage/
│   │   │   │   └── index.ts        # File upload/serve
│   │   │   ├── backup/
│   │   │   │   └── index.ts        # Backup/restore
│   │   │   ├── logger.ts           # Pino logger
│   │   │   └── config.ts           # Env config
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn-svelte (auto-generated)
│   │   │   ├── layout/             # App layout components
│   │   │   ├── entity/             # Cross-entity components
│   │   │   └── shared/             # Reusable patterns
│   │   ├── validation/             # Zod schemas
│   │   ├── i18n/                   # Translations
│   │   ├── stores/                 # Svelte stores
│   │   ├── types/                  # Shared types
│   │   └── utils.ts                # Utilities (cn, formatters)
│   └── routes/
│       ├── +layout.svelte          # Root layout
│       ├── +layout.server.ts       # Root data (user, locale)
│       ├── (auth)/                 # Unauthenticated routes
│       │   ├── login/
│       │   └── setup/              # First-run household setup
│       ├── (app)/                  # Authenticated routes
│       │   ├── +layout.svelte      # App shell (sidebar, header)
│       │   ├── +layout.server.ts   # Auth guard
│       │   ├── dashboard/
│       │   ├── projects/
│       │   │   ├── +page.*         # List
│       │   │   ├── new/+page.*     # Create
│       │   │   └── [id]/+page.*    # Detail
│       │   ├── tasks/
│       │   ├── assets/
│       │   ├── rooms/
│       │   ├── finances/
│       │   ├── documents/
│       │   ├── knowledge/
│       │   ├── maintenance/
│       │   ├── calendar/
│       │   ├── search/
│       │   ├── notifications/
│       │   └── settings/
│       └── api/                    # API endpoints
│           ├── upload/
│           ├── search/
│           └── backup/
├── data/                           # SQLite DB (gitignored)
├── uploads/                        # File storage (gitignored)
├── drizzle/                        # Migration files
├── tests/                          # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── drizzle.config.ts
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
└── LICENSE
```
