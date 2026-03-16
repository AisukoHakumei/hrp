import { and, eq } from 'drizzle-orm';
import { db, type Transaction } from './db/index.js';
import {
	automationLogs,
	automationRules,
	assets,
	maintenanceSchedules,
	notifications,
	projectAssets,
	tasks,
	users,
	type AutomationActionType,
	type AutomationTrigger,
	type MaintenanceFrequency,
	type NotificationType,
	type TaskPriority
} from './db/schema/index.js';
import { createId } from './db/schema/common.js';
import { createLogger } from './logger.js';

const log = createLogger('automation');

export interface TriggerContext {
	trigger: AutomationTrigger;
	entityType: string;
	entityId: string;
	householdId: string;
	data: Record<string, unknown>;
}

type JsonRecord = Record<string, unknown>;

interface AutomationAction {
	type: AutomationActionType;
	params?: JsonRecord;
}

function safeParseObject(value: string): JsonRecord {
	try {
		const parsed: unknown = JSON.parse(value);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as JsonRecord;
		}
		return {};
	} catch {
		return {};
	}
}

function safeParseActions(value: string): AutomationAction[] {
	try {
		const parsed: unknown = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((action): action is AutomationAction => {
			if (!action || typeof action !== 'object') return false;
			const candidate = action as { type?: unknown; params?: unknown };
			const validType =
				candidate.type === 'create_maintenance_schedule' ||
				candidate.type === 'create_notification' ||
				candidate.type === 'create_task' ||
				candidate.type === 'update_asset_status';
			const validParams =
				candidate.params === undefined ||
				(typeof candidate.params === 'object' && candidate.params !== null && !Array.isArray(candidate.params));
			return validType && validParams;
		});
	} catch {
		return [];
	}
}

function toStringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function conditionsMatch(conditions: JsonRecord, context: TriggerContext): boolean {
	const expectedEntityType = toStringValue(conditions.entityType);
	if (expectedEntityType && expectedEntityType !== context.entityType) return false;

	const expectedEntityId = toStringValue(conditions.entityId);
	if (expectedEntityId && expectedEntityId !== context.entityId) return false;

	const expectedData = conditions.data;
	if (expectedData && typeof expectedData === 'object' && !Array.isArray(expectedData)) {
		for (const [key, expected] of Object.entries(expectedData as JsonRecord)) {
			if (context.data[key] !== expected) return false;
		}
	}

	for (const [key, expected] of Object.entries(conditions)) {
		if (key === 'entityType' || key === 'entityId' || key === 'data') continue;
		if (context.data[key] !== expected) return false;
	}

	return true;
}

function resolveDefaultUserId(householdId: string): string | undefined {
	const admin = db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.householdId, householdId), eq(users.role, 'admin')))
		.get();
	if (admin?.id) return admin.id;

	const fallback = db.select({ id: users.id }).from(users).where(eq(users.householdId, householdId)).get();
	return fallback?.id;
}

function resolveUserId(
	householdId: string,
	context: TriggerContext,
	ruleCreatedBy: string | null,
	actionParams: JsonRecord | undefined
): string | undefined {
	const fromParams = toStringValue(actionParams?.userId);
	if (fromParams) return fromParams;

	const fromContext =
		toStringValue(context.data.userId) ??
		toStringValue(context.data.assigneeId) ??
		toStringValue(context.data.createdBy);
	if (fromContext) return fromContext;

	if (ruleCreatedBy) return ruleCreatedBy;
	return resolveDefaultUserId(householdId);
}

function resolveNotificationType(actionParams: JsonRecord | undefined, trigger: AutomationTrigger): NotificationType {
	const value = actionParams?.notificationType;
	if (typeof value === 'string') {
		const validTypes: NotificationType[] = [
			'task_assigned',
			'task_due',
			'task_overdue',
			'project_status_changed',
			'budget_warning',
			'budget_exceeded',
			'maintenance_due',
			'maintenance_overdue',
			'document_uploaded',
			'system'
		];
		if (validTypes.includes(value as NotificationType)) {
			return value as NotificationType;
		}
	}

	if (trigger === 'budget_threshold_exceeded') return 'budget_warning';
	if (trigger === 'maintenance_due') return 'maintenance_due';
	if (trigger === 'document_uploaded') return 'document_uploaded';
	if (trigger === 'task_overdue') return 'task_overdue';
	if (trigger === 'project_completed') return 'project_status_changed';
	return 'system';
}

function projectAssetIds(context: TriggerContext, actionParams: JsonRecord | undefined): string[] {
	const explicit = toStringArray(actionParams?.assetIds);
	if (explicit.length > 0) return explicit;

	const fromContext = toStringArray(context.data.assetIds);
	if (fromContext.length > 0) return fromContext;

	if (context.entityType !== 'project') return [];

	const rows = db
		.select({ assetId: projectAssets.assetId })
		.from(projectAssets)
		.where(eq(projectAssets.projectId, context.entityId))
		.all();
	return rows.map((row) => row.assetId);
}

function nextDueDateFromContext(context: TriggerContext): string {
	const base = toStringValue(context.data.completedAt) ?? toStringValue(context.data.date);
	const date = base ? new Date(base) : new Date();
	if (Number.isNaN(date.getTime())) {
		const fallback = new Date();
		fallback.setUTCFullYear(fallback.getUTCFullYear() + 1);
		return fallback.toISOString().slice(0, 10);
	}
	date.setUTCFullYear(date.getUTCFullYear() + 1);
	return date.toISOString().slice(0, 10);
}

function resolveMaintenanceFrequency(value: unknown): MaintenanceFrequency {
	if (
		value === 'daily' ||
		value === 'weekly' ||
		value === 'monthly' ||
		value === 'quarterly' ||
		value === 'biannual' ||
		value === 'yearly' ||
		value === 'custom'
	) {
		return value;
	}
	return 'yearly';
}

function executeAction(
	action: AutomationAction,
	context: TriggerContext,
	rule: { id: string; name: string; createdBy: string | null }
): void {
	if (action.type === 'create_notification') {
		const userId = resolveUserId(context.householdId, context, rule.createdBy, action.params);
		if (!userId) {
			log.warn({ ruleId: rule.id, trigger: context.trigger }, 'No notification recipient found');
			return;
		}

		db.insert(notifications)
			.values({
				id: createId(),
				householdId: context.householdId,
				userId,
				type: resolveNotificationType(action.params, context.trigger),
				title: toStringValue(action.params?.title) ?? `Automation: ${rule.name}`,
				message: toStringValue(action.params?.message) ?? `Trigger ${context.trigger} fired for ${context.entityType}.`,
				entityType:
					context.entityType === 'project' ||
					context.entityType === 'task' ||
					context.entityType === 'asset' ||
					context.entityType === 'budget' ||
					context.entityType === 'maintenance' ||
					context.entityType === 'document'
						? context.entityType
						: undefined,
				entityId: context.entityId,
				isRead: false
			})
			.run();
		return;
	}

	if (action.type === 'create_maintenance_schedule') {
		const linkedAssetIds = projectAssetIds(context, action.params);
		const fallbackAssignee = resolveUserId(context.householdId, context, rule.createdBy, action.params);
		const scheduleFrequency = resolveMaintenanceFrequency(action.params?.frequency);

		if (linkedAssetIds.length === 0) {
			db.insert(maintenanceSchedules)
				.values({
					id: createId(),
					householdId: context.householdId,
					name: toStringValue(action.params?.name) ?? `Maintenance for ${context.entityType}`,
					description: toStringValue(action.params?.description) ?? `Auto-created from rule ${rule.name}.`,
					frequency: scheduleFrequency,
					nextDueDate: nextDueDateFromContext(context),
					assigneeId: fallbackAssignee,
					sourceProjectId: context.entityType === 'project' ? context.entityId : undefined,
					sourceAutomationRuleId: rule.id,
					createdBy: rule.createdBy
				})
				.run();
			return;
		}

		for (const assetId of linkedAssetIds) {
			const asset = db.select({ name: assets.name }).from(assets).where(eq(assets.id, assetId)).get();
			db.insert(maintenanceSchedules)
				.values({
					id: createId(),
					householdId: context.householdId,
					assetId,
					name: toStringValue(action.params?.name) ?? `Maintenance: ${asset?.name ?? 'Linked asset'}`,
					description: toStringValue(action.params?.description) ?? `Auto-created from rule ${rule.name}.`,
					frequency: scheduleFrequency,
					nextDueDate: nextDueDateFromContext(context),
					assigneeId: fallbackAssignee,
					sourceProjectId: context.entityType === 'project' ? context.entityId : undefined,
					sourceAutomationRuleId: rule.id,
					createdBy: rule.createdBy
				})
				.run();
		}
		return;
	}

	if (action.type === 'create_task') {
		const assigneeId = resolveUserId(context.householdId, context, rule.createdBy, action.params);
		const rawPriority = toStringValue(action.params?.priority);
		const priority: TaskPriority =
			rawPriority === 'low' || rawPriority === 'medium' || rawPriority === 'high' || rawPriority === 'urgent'
				? rawPriority
				: 'medium';

		db.insert(tasks)
			.values({
				id: createId(),
				householdId: context.householdId,
				projectId: context.entityType === 'project' ? context.entityId : undefined,
				assetId: context.entityType === 'asset' ? context.entityId : undefined,
				title: toStringValue(action.params?.title) ?? `Automation task: ${rule.name}`,
				description: toStringValue(action.params?.description) ?? `Generated from trigger ${context.trigger}.`,
				status: 'todo',
				priority,
				assigneeId,
				dueDate: toStringValue(action.params?.dueDate),
				createdBy: rule.createdBy
			})
			.run();
		return;
	}

	if (action.type === 'update_asset_status') {
		const assetId =
			toStringValue(action.params?.assetId) ??
			(context.entityType === 'asset' ? context.entityId : undefined) ??
			toStringArray(context.data.assetIds)[0];
		const nextStatus = toStringValue(action.params?.status);

		if (!assetId || !nextStatus) {
			log.warn({ ruleId: rule.id, trigger: context.trigger }, 'Missing asset status update parameters');
			return;
		}

		if (
			nextStatus !== 'active' &&
			nextStatus !== 'stored' &&
			nextStatus !== 'broken' &&
			nextStatus !== 'maintenance' &&
			nextStatus !== 'disposed' &&
			nextStatus !== 'sold'
		) {
			return;
		}

		db.update(assets)
			.set({ status: nextStatus })
			.where(and(eq(assets.id, assetId), eq(assets.householdId, context.householdId)))
			.run();
	}
}

export function executeAutomation(context: TriggerContext): void {
	const rules = db
		.select({
			id: automationRules.id,
			name: automationRules.name,
			trigger: automationRules.trigger,
			conditions: automationRules.conditions,
			actions: automationRules.actions,
			createdBy: automationRules.createdBy,
			triggerCount: automationRules.triggerCount
		})
		.from(automationRules)
		.where(
			and(
				eq(automationRules.householdId, context.householdId),
				eq(automationRules.trigger, context.trigger),
				eq(automationRules.isEnabled, true)
			)
		)
		.all();

	for (const rule of rules) {
		const conditions = safeParseObject(rule.conditions);
		if (!conditionsMatch(conditions, context)) {
			continue;
		}

		const actions = safeParseActions(rule.actions);
		const now = new Date().toISOString();

		try {
			for (const action of actions) {
				executeAction(action, context, {
					id: rule.id,
					name: rule.name,
					createdBy: rule.createdBy
				});
			}

			db.insert(automationLogs)
				.values({
					id: createId(),
					ruleId: rule.id,
					trigger: rule.trigger,
					triggerContext: JSON.stringify(context),
					executedActions: JSON.stringify(actions),
					success: true
				})
				.run();
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown automation error';
			log.error({ error, ruleId: rule.id, trigger: context.trigger }, 'Automation rule execution failed');

			db.insert(automationLogs)
				.values({
					id: createId(),
					ruleId: rule.id,
					trigger: rule.trigger,
					triggerContext: JSON.stringify(context),
					executedActions: JSON.stringify(actions),
					success: false,
					errorMessage: message
				})
				.run();
		} finally {
			db.update(automationRules)
				.set({
					lastTriggeredAt: now,
					triggerCount: rule.triggerCount + 1
				})
				.where(eq(automationRules.id, rule.id))
				.run();
		}
	}
}

export function seedDefaultRules(householdId: string, createdBy: string, tx?: Transaction): void {
	const defaults: Array<{
		name: string;
		description: string;
		trigger: AutomationTrigger;
		conditions: JsonRecord;
		actions: AutomationAction[];
	}> = [
		{
			name: 'Project completion creates maintenance schedules',
			description:
				'When a project is completed, automatically create recurring maintenance schedules for linked assets.',
			trigger: 'project_completed',
			conditions: { entityType: 'project' },
			actions: [
				{
					type: 'create_maintenance_schedule',
					params: {
						frequency: 'yearly',
						description: 'Created automatically after project completion.'
					}
				}
			]
		},
		{
			name: 'Budget threshold warning notification',
			description: 'Notify household admins when project expenses exceed warning threshold.',
			trigger: 'budget_threshold_exceeded',
			conditions: { entityType: 'budget' },
			actions: [
				{
					type: 'create_notification',
					params: {
						notificationType: 'budget_warning',
						title: 'Budget warning threshold reached',
						message: 'A budget has reached the configured warning threshold.'
					}
				}
			]
		},
		{
			name: 'Maintenance due reminder',
			description: 'Notify assignees when a maintenance schedule reaches its due date.',
			trigger: 'maintenance_due',
			conditions: { entityType: 'maintenance' },
			actions: [
				{
					type: 'create_notification',
					params: {
						notificationType: 'maintenance_due',
						title: 'Maintenance due',
						message: 'A maintenance schedule is due today.'
					}
				}
			]
		}
	];

	const conn = tx ?? db;
	for (const rule of defaults) {
		const existing = conn
			.select({ id: automationRules.id })
			.from(automationRules)
			.where(
				and(
					eq(automationRules.householdId, householdId),
					eq(automationRules.trigger, rule.trigger),
					eq(automationRules.name, rule.name)
				)
			)
			.get();

		if (existing) continue;

		conn
			.insert(automationRules)
			.values({
				id: createId(),
				householdId,
				name: rule.name,
				description: rule.description,
				trigger: rule.trigger,
				conditions: JSON.stringify(rule.conditions),
				actions: JSON.stringify(rule.actions),
				isEnabled: true,
				createdBy
			})
			.run();
	}
}
