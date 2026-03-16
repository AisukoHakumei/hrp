import { sqliteTable, text, integer, real, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { id, createdAt, updatedAt, visibility } from './common';
import { households } from './household';
import { users } from './users';
import { rooms } from './rooms';

export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
export type ProjectType =
	| 'renovation'
	| 'repair'
	| 'installation'
	| 'decoration'
	| 'landscaping'
	| 'construction'
	| 'administrative'
	| 'other';

export const projects = sqliteTable(
	'projects',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		type: text('type').$type<ProjectType>().notNull().default('other'),
		status: text('status').$type<ProjectStatus>().notNull().default('planning'),
		priority: text('priority').$type<'low' | 'medium' | 'high' | 'urgent'>().notNull().default('medium'),
		startDate: text('start_date'),
		endDate: text('end_date'),
		actualEndDate: text('actual_end_date'),
		// Budget
		budgetAmount: real('budget_amount'),
		budgetCurrency: text('budget_currency').default('EUR'),
		// Progress
		progressPercent: integer('progress_percent').notNull().default(0),
		// Metadata
		notes: text('notes'),
		visibility: visibility(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('projects_household_idx').on(t.householdId),
		index('projects_status_idx').on(t.status),
		index('projects_created_by_idx').on(t.createdBy)
	]
);

/** Project phases / milestones */
export const projectPhases = sqliteTable(
	'project_phases',
	{
		id: id(),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		status: text('status').$type<ProjectStatus>().notNull().default('planning'),
		startDate: text('start_date'),
		endDate: text('end_date'),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('project_phases_project_idx').on(t.projectId)]
);

/** Junction: project ↔ room */
export const projectRooms = sqliteTable(
	'project_rooms',
	{
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		roomId: text('room_id')
			.notNull()
			.references(() => rooms.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.projectId, t.roomId] })]
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectPhase = typeof projectPhases.$inferSelect;
