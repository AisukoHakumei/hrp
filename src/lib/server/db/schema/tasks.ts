import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { id, createdAt, updatedAt, visibility } from './common';
import { households } from './household';
import { users } from './users';
import { projects } from './projects';
import { projectPhases } from './projects';
import { rooms } from './rooms';
import { assets } from './assets';

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export const tasks = sqliteTable(
	'tasks',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		// Cross-module links
		projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
		phaseId: text('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
		roomId: text('room_id').references(() => rooms.id, { onDelete: 'set null' }),
		assetId: text('asset_id').references(() => assets.id, { onDelete: 'set null' }),
		parentId: text('parent_id'), // self-referential: subtasks
		// Content
		title: text('title').notNull(),
		description: text('description'),
		status: text('status').$type<TaskStatus>().notNull().default('todo'),
		priority: text('priority').$type<TaskPriority>().notNull().default('medium'),
		// Assignment
		assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
		// Dates
		dueDate: text('due_date'),
		startDate: text('start_date'),
		completedAt: text('completed_at'),
		// Estimation
		estimatedMinutes: integer('estimated_minutes'),
		actualMinutes: integer('actual_minutes'),
		// Recurrence (for repeating tasks)
		isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
		recurrenceRule: text('recurrence_rule'), // iCal RRULE format
		// Metadata
		sortOrder: integer('sort_order').notNull().default(0),
		visibility: visibility(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('tasks_household_idx').on(t.householdId),
		index('tasks_project_idx').on(t.projectId),
		index('tasks_assignee_idx').on(t.assigneeId),
		index('tasks_status_idx').on(t.status),
		index('tasks_due_date_idx').on(t.dueDate),
		index('tasks_parent_idx').on(t.parentId)
	]
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
