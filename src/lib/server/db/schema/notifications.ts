import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { id, createdAt } from './common';
import { households } from './household';
import { users } from './users';

export type NotificationType =
	| 'task_assigned'
	| 'task_due'
	| 'task_overdue'
	| 'project_status_changed'
	| 'budget_warning'
	| 'budget_exceeded'
	| 'maintenance_due'
	| 'maintenance_overdue'
	| 'document_uploaded'
	| 'system';

/** In-app notifications */
export const notifications = sqliteTable(
	'notifications',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').$type<NotificationType>().notNull(),
		title: text('title').notNull(),
		message: text('message'),
		// Link to source entity (polymorphic)
		entityType: text('entity_type').$type<'project' | 'task' | 'asset' | 'budget' | 'maintenance' | 'document'>(),
		entityId: text('entity_id'),
		// State
		isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
		readAt: text('read_at'),
		createdAt: createdAt()
	},
	(t) => [
		index('notifications_user_idx').on(t.userId),
		index('notifications_user_unread_idx').on(t.userId, t.isRead),
		index('notifications_entity_idx').on(t.entityType, t.entityId)
	]
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
