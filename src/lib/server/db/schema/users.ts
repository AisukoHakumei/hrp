import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { id, createdAt, updatedAt } from './common';
import { households } from './household';

/** User roles — fixed set for V1 */
export type UserRole = 'admin' | 'adult' | 'child' | 'guest';

export const users = sqliteTable(
	'users',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		name: text('name').notNull(),
		displayName: text('display_name'),
		role: text('role').$type<UserRole>().notNull().default('adult'),
		passwordHash: text('password_hash'), // null for OAuth-only users
		avatarPath: text('avatar_path'),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		lastLoginAt: text('last_login_at'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [uniqueIndex('users_email_unique').on(t.email), index('users_household_idx').on(t.householdId)]
);

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(), // session token (random 64 hex chars)
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: text('expires_at').notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		createdAt: createdAt()
	},
	(t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)]
);

export const oauthAccounts = sqliteTable(
	'oauth_accounts',
	{
		id: id(),
		provider: text('provider').notNull(),
		providerUserId: text('provider_user_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('oauth_provider_user_unique').on(t.provider, t.providerUserId),
		index('oauth_user_idx').on(t.userId)
	]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
