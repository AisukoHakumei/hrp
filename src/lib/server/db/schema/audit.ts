import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { createdAt } from './common';
import { users } from './users';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'backup' | 'restore';
export type AuditEntityType =
	| 'household'
	| 'user'
	| 'project'
	| 'task'
	| 'asset'
	| 'room'
	| 'expense'
	| 'budget'
	| 'document'
	| 'knowledge'
	| 'maintenance'
	| 'automation'
	| 'session';

/** Audit log — append-only history of changes */
export const auditLog = sqliteTable(
	'audit_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }), // auto-increment for performance
		// Who
		userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
		userName: text('user_name'), // denormalized — survives user deletion
		// What entity
		entityType: text('entity_type').$type<AuditEntityType>().notNull(),
		entityId: text('entity_id').notNull(),
		// What action
		action: text('action').$type<AuditAction>().notNull(),
		// Diff (store only changed fields, not full snapshots)
		before: text('before'), // JSON: { field: oldValue }
		after: text('after'), // JSON: { field: newValue }
		// Context
		ipAddress: text('ip_address'),
		correlationId: text('correlation_id'), // group related changes
		createdAt: createdAt()
	},
	(t) => [
		index('audit_log_entity_idx').on(t.entityType, t.entityId),
		index('audit_log_user_idx').on(t.userId),
		index('audit_log_created_at_idx').on(t.createdAt),
		index('audit_log_correlation_idx').on(t.correlationId)
	]
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
