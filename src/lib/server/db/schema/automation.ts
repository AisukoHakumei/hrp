import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { id, createdAt, updatedAt } from './common';
import { households } from './household';
import { users } from './users';

export type AutomationTrigger =
	| 'project_completed'
	| 'budget_threshold_exceeded'
	| 'maintenance_due'
	| 'document_uploaded'
	| 'task_overdue';

export type AutomationActionType =
	| 'create_maintenance_schedule'
	| 'create_notification'
	| 'create_task'
	| 'update_asset_status';

/** Automation rules — deterministic, rule-based */
export const automationRules = sqliteTable(
	'automation_rules',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		trigger: text('trigger').$type<AutomationTrigger>().notNull(),
		/** JSON: conditions that must be true for the rule to fire */
		conditions: text('conditions').notNull().default('{}'),
		/** JSON array: actions to execute when triggered */
		actions: text('actions').notNull().default('[]'),
		isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
		// Execution tracking
		lastTriggeredAt: text('last_triggered_at'),
		triggerCount: integer('trigger_count').notNull().default(0),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('automation_rules_household_idx').on(t.householdId),
		index('automation_rules_trigger_idx').on(t.trigger),
		index('automation_rules_enabled_idx').on(t.isEnabled)
	]
);

/** Log of automation executions */
export const automationLogs = sqliteTable(
	'automation_logs',
	{
		id: id(),
		ruleId: text('rule_id')
			.notNull()
			.references(() => automationRules.id, { onDelete: 'cascade' }),
		trigger: text('trigger').$type<AutomationTrigger>().notNull(),
		/** JSON: the entity that triggered the rule */
		triggerContext: text('trigger_context').notNull(),
		/** JSON: actions that were executed */
		executedActions: text('executed_actions').notNull(),
		success: integer('success', { mode: 'boolean' }).notNull(),
		errorMessage: text('error_message'),
		createdAt: createdAt()
	},
	(t) => [index('automation_logs_rule_idx').on(t.ruleId)]
);

export type AutomationRule = typeof automationRules.$inferSelect;
export type NewAutomationRule = typeof automationRules.$inferInsert;
