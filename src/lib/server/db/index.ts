import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { building } from '$app/environment';
import * as schema from './schema/index';
import { config } from '../config';
import { createLogger } from '../logger';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const log = createLogger('db');

// Ensure data directory exists
mkdirSync(dirname(config.databasePath), { recursive: true });

const sqlite = new Database(config.databasePath);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');
// Enable foreign key enforcement (off by default in SQLite)
sqlite.pragma('foreign_keys = ON');
// Synchronous = NORMAL is safe with WAL mode
sqlite.pragma('synchronous = NORMAL');
// Increase cache size for better performance (negative = KB)
sqlite.pragma('cache_size = -64000'); // 64MB

log.info({ path: config.databasePath }, 'Database connected');

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
export type Transaction = Parameters<Parameters<DB['transaction']>[0]>[0];

// Safe on every boot: tracks applied migrations in __drizzle_migrations, skips already-applied ones
if (!building) {
	const migrationsFolder = resolve(process.cwd(), 'drizzle');
	const journalPath = resolve(migrationsFolder, 'meta', '_journal.json');

	if (existsSync(journalPath)) {
		bootstrapMigrationTracking(sqlite, migrationsFolder, journalPath);

		try {
			migrate(db, { migrationsFolder });
			log.info('Database migrations applied');
		} catch (err) {
			log.error({ err }, 'Database migration failed — aborting startup');
			process.exit(1);
		}
	} else {
		log.warn(
			{ migrationsFolder },
			'No migration journal found — skipping auto-migrate. Run "pnpm db:push" manually.'
		);
	}
}

/**
 * Handles transition from db:push to migration-based schema.
 * If tables exist but __drizzle_migrations doesn't, marks the initial
 * migration as applied so migrate() doesn't try to recreate existing tables.
 */
function bootstrapMigrationTracking(
	conn: Database.Database,
	migrationsFolder: string,
	journalPath: string
): void {
	const hasSchema = (
		conn
			.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='households'")
			.get() as { c: number }
	).c > 0;

	const hasMigrationTable = (
		conn
			.prepare(
				"SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
			)
			.get() as { c: number }
	).c > 0;

	if (!hasSchema || hasMigrationTable) return;

	const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
	if (journal.entries.length === 0) return;

	const initialEntry = journal.entries[0];
	const sqlPath = resolve(migrationsFolder, `${initialEntry.tag}.sql`);
	if (!existsSync(sqlPath)) return;

	const sqlContent = readFileSync(sqlPath, 'utf-8');
	const hash = createHash('sha256').update(sqlContent).digest('hex');

	conn.exec(
		`CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC)`
	);
	conn.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(
		hash,
		initialEntry.when
	);

	log.info('Existing database detected — migration tracking bootstrapped');
}

/** Get the raw better-sqlite3 instance (for backup, serialize, etc.) */
export function getRawDb(): Database.Database {
	return sqlite;
}
