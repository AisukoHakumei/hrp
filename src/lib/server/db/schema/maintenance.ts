import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { id, createdAt, updatedAt, visibility } from './common';
import { households } from './household';
import { users } from './users';
import { assets } from './assets';
import { rooms } from './rooms';

export type MaintenanceFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannual' | 'yearly' | 'custom';

/** Recurring maintenance schedules */
export const maintenanceSchedules = sqliteTable(
	'maintenance_schedules',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		// Link to asset or room (at least one should be set)
		assetId: text('asset_id').references(() => assets.id, { onDelete: 'cascade' }),
		roomId: text('room_id').references(() => rooms.id, { onDelete: 'set null' }),
		// Schedule
		name: text('name').notNull(),
		description: text('description'),
		frequency: text('frequency').$type<MaintenanceFrequency>().notNull().default('yearly'),
		customIntervalDays: integer('custom_interval_days'), // for frequency='custom'
		// Tracking
		nextDueDate: text('next_due_date').notNull(),
		lastCompletedDate: text('last_completed_date'),
		// Notification
		reminderDaysBefore: integer('reminder_days_before').notNull().default(7),
		// Estimated cost
		estimatedCost: real('estimated_cost'),
		// Assignment
		assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
		// State
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		// Source: was this auto-created by automation?
		sourceProjectId: text('source_project_id'),
		sourceAutomationRuleId: text('source_automation_rule_id'),
		visibility: visibility(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('maintenance_schedules_household_idx').on(t.householdId),
		index('maintenance_schedules_asset_idx').on(t.assetId),
		index('maintenance_schedules_next_due_idx').on(t.nextDueDate),
		index('maintenance_schedules_active_idx').on(t.isActive)
	]
);

/** Maintenance log entries — records of completed maintenance */
export const maintenanceLogs = sqliteTable(
	'maintenance_logs',
	{
		id: id(),
		scheduleId: text('schedule_id')
			.notNull()
			.references(() => maintenanceSchedules.id, { onDelete: 'cascade' }),
		completedDate: text('completed_date').notNull(),
		completedBy: text('completed_by').references(() => users.id, { onDelete: 'set null' }),
		notes: text('notes'),
		cost: real('cost'),
		// Duration in minutes
		durationMinutes: integer('duration_minutes'),
		createdAt: createdAt()
	},
	(t) => [index('maintenance_logs_schedule_idx').on(t.scheduleId)]
);

export type MaintenanceSchedule = typeof maintenanceSchedules.$inferSelect;
export type NewMaintenanceSchedule = typeof maintenanceSchedules.$inferInsert;
export type MaintenanceLog = typeof maintenanceLogs.$inferSelect;
