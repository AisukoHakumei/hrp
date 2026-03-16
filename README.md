# HRP — Home Resource Planner

A self-hostable household management platform. Track projects, tasks, assets, finances, documents, maintenance schedules, and more — all from a single integrated interface.

One household per instance. No cloud dependency. Your data stays yours.

## Features

- **Projects** — Plan renovations, repairs, installations with budgets, phases, and linked rooms/assets
- **Tasks** — Assign, prioritize, and track household tasks with due dates and status workflows
- **Assets** — Inventory appliances, furniture, tools, vehicles with warranty tracking and maintenance history
- **Rooms & Spaces** — Map your home's rooms, track what's in each, link to projects and documents
- **Finances** — Log expenses, create budgets (per-project or standalone), track spending vs. limits
- **Documents** — Upload and organize household documents (receipts, manuals, contracts) with versioning
- **Knowledge Base** — Store procedures, how-tos, notes, and reference material for your household
- **Maintenance** — Schedule recurring maintenance (daily to yearly), track completion history
- **Calendar** — Month-view grid showing task due dates, maintenance schedules, and project milestones
- **Notifications** — System notifications for overdue tasks, upcoming maintenance, budget alerts
- **Global Search** — Search across all modules from a single interface
- **Dashboard** — At-a-glance overview of active projects, overdue tasks, budget status, and upcoming maintenance
- **Settings** — Manage household info, users, roles, backups, and automation rules

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit (Svelte 5) |
| UI | shadcn-svelte + Tailwind CSS v4 |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Auth | Custom session-based (Argon2id) |
| Runtime | Node.js >= 20 |
| Deployment | Docker (adapter-node) |

## Quick Start

### Docker (recommended)

```bash
docker compose up -d
```

The app will be available at `http://localhost:3000`. On first visit you'll be prompted to create your admin account and household.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ORIGIN` | `http://localhost:3000` | Public URL of the app |
| `DATABASE_PATH` | `/data/hrp.db` | SQLite database file path |
| `UPLOAD_DIR` | `/data/uploads` | Document upload directory |
| `BACKUP_DIR` | `/data/backups` | Backup storage directory |
| `BODY_SIZE_LIMIT` | `100M` | Max upload size |
| `AUTH_SECRET` | — | Secret for session tokens (set in production) |
| `LOG_LEVEL` | `info` | Pino log level |
| `DEFAULT_LOCALE` | `en` | Default language (`en` or `fr`) |

### Local Development

```bash
pnpm install
pnpm db:push        # create/migrate database
pnpm db:seed         # seed with sample data (optional)
pnpm dev             # start dev server
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm preview` | Preview production build |
| `pnpm check` | Type-check with svelte-check |
| `pnpm test` | Run Vitest unit tests |
| `pnpm test:e2e` | Run Playwright e2e tests |
| `pnpm db:push` | Push schema to database |
| `pnpm db:seed` | Seed database with sample data |
| `pnpm db:studio` | Open Drizzle Studio |

## Permissions

Four roles with hierarchical access:

| Role | Level | Capabilities |
|------|-------|-------------|
| **Admin** | 100 | Full access to all modules including user management and automation |
| **Adult** | 50 | Create and edit most entities, view finances, no delete on most modules |
| **Child** | 20 | View most modules (no finances), edit assigned tasks |
| **Guest** | 10 | View-only access to shared content |

Entity visibility controls who can see individual items: `household` (everyone), `adults` (admin + adult), or `private` (creator + admin only).

## Backups

Create and download backups from **Settings > Backup & Restore**. Backups include the SQLite database and uploaded files.

The Docker setup persists all data in a named volume (`hrp-data`).

## i18n

English and French are supported. The locale is detected from the browser's `Accept-Language` header and can be overridden via cookie.

## License

AGPL-3.0-or-later
