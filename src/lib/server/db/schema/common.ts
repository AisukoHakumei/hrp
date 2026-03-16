/**
 * Common column helpers shared across all schema files.
 * Every entity gets: id (nanoid), createdAt, updatedAt.
 * Entities with household scope get: householdId.
 * Entities with visibility control get: visibility, createdBy.
 */
import { text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/** Standard ID column — nanoid, 21 chars, URL-safe */
export const id = () => text('id').primaryKey().$defaultFn(() => createId());

/** Timestamp columns */
export const createdAt = () =>
	text('created_at')
		.notNull()
		.default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`);

export const updatedAt = () =>
	text('updated_at')
		.notNull()
		.default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`)
		.$onUpdate(() => new Date().toISOString());

/** Visibility levels for permission control */
export type Visibility = 'household' | 'adults' | 'private';

export const visibility = () =>
	text('visibility').$type<Visibility>().notNull().default('household');

/** nanoid generation — import dynamically to avoid top-level await */
let _nanoid: (() => string) | null = null;

export function createId(): string {
	if (!_nanoid) {
		// Synchronous fallback using crypto
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
		return Array.from(crypto.getRandomValues(new Uint8Array(21)))
			.map((b) => chars[b % 64])
			.join('');
	}
	return _nanoid();
}

// Initialize nanoid async
import('nanoid').then((mod) => {
	_nanoid = mod.nanoid;
});
