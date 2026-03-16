import { error, fail, type Actions, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { db } from '$lib/server/db/index.js';
import { maintenanceSchedules, maintenanceLogs, assets, users } from '$lib/server/db/schema/index.js';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { notifyHousehold } from '$lib/server/notifications.js';
import { writeAuditLog } from '$lib/server/audit.js';
import { emitEntityEvent } from '$lib/server/events.js';

export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		return {
			maintenanceSchedules: [],
			assets: [],
			users: []
		};
	}
	if (!hasModuleAccess(locals.user?.role ?? 'guest', 'maintenance', 'view')) {
		error(403, 'Forbidden');
	}

	const scheduleList = db
		.select()
		.from(maintenanceSchedules)
		.where(eq(maintenanceSchedules.householdId, householdId))
		.orderBy(maintenanceSchedules.nextDueDate)
		.all();

	const assetList = db.select().from(assets).where(eq(assets.householdId, householdId)).all();
	const userList = db.select().from(users).where(eq(users.householdId, householdId)).all();

	const scheduleIds = scheduleList.map((s) => s.id);
	const allLogs = scheduleIds.length > 0
		? db
				.select()
				.from(maintenanceLogs)
				.where(inArray(maintenanceLogs.scheduleId, scheduleIds))
				.orderBy(desc(maintenanceLogs.completedDate))
				.all()
		: [];

	const logsBySchedule = new Map<string, typeof allLogs>();
	for (const log of allLogs) {
		const existing = logsBySchedule.get(log.scheduleId) ?? [];
		existing.push(log);
		logsBySchedule.set(log.scheduleId, existing);
	}

	const schedulesWithLogs = scheduleList.map((s) => ({
		...s,
		logs: logsBySchedule.get(s.id) ?? []
	}));

	return {
		maintenanceSchedules: schedulesWithLogs,
		assets: assetList,
		users: userList
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'maintenance', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const nextDueDate = String(formData.get('nextDueDate') ?? '').trim();
		if (!nextDueDate) return fail(400, { invalid: true });

		const description = String(formData.get('description') ?? '').trim() || null;
		const frequency = (String(formData.get('frequency') ?? '').trim() || 'yearly') as typeof maintenanceSchedules.$inferInsert.frequency;
		const assetId = String(formData.get('assetId') ?? '').trim() || null;
		const estimatedCostRaw = String(formData.get('estimatedCost') ?? '').trim();
		const estimatedCost = estimatedCostRaw ? Number(estimatedCostRaw) : null;
		const assigneeId = String(formData.get('assigneeId') ?? '').trim() || null;

		const created = db
			.insert(maintenanceSchedules)
			.values({
				householdId,
				name,
				description,
				frequency,
				nextDueDate,
				assetId,
				estimatedCost,
				assigneeId,
				createdBy: locals.user?.id
			})
			.returning({ id: maintenanceSchedules.id })
			.get();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'maintenance',
			entityId: created.id,
			action: 'create'
		});

		emitEntityEvent(
			householdId,
			'entity_created',
			'maintenance',
			created.id,
			locals.user?.id ?? ''
		);

		return { created: true };
	},

	update: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'maintenance', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const nextDueDate = String(formData.get('nextDueDate') ?? '').trim();
		if (!nextDueDate) return fail(400, { invalid: true });

		const description = String(formData.get('description') ?? '').trim() || null;
		const frequency = (String(formData.get('frequency') ?? '').trim() || 'yearly') as typeof maintenanceSchedules.$inferInsert.frequency;
		const estimatedCostRaw = String(formData.get('estimatedCost') ?? '').trim();
		const estimatedCost = estimatedCostRaw ? Number(estimatedCostRaw) : null;
		const assigneeId = String(formData.get('assigneeId') ?? '').trim() || null;

		db.update(maintenanceSchedules)
			.set({ name, description, frequency, nextDueDate, estimatedCost, assigneeId })
			.where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'maintenance',
			entityId: id,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'maintenance', id, locals.user?.id ?? '');

		return { updated: true };
	},

	logCompletion: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'maintenance', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const scheduleId = String(formData.get('scheduleId') ?? '').trim();
		if (!scheduleId) return fail(400, { invalid: true });

		const completedDate = String(formData.get('completedDate') ?? '').trim();
		if (!completedDate) return fail(400, { invalid: true });

		const schedule = db
			.select()
			.from(maintenanceSchedules)
			.where(and(eq(maintenanceSchedules.id, scheduleId), eq(maintenanceSchedules.householdId, householdId)))
			.get();
		if (!schedule) return fail(404, { invalid: true });

		const notes = String(formData.get('notes') ?? '').trim() || null;
		const costRaw = String(formData.get('cost') ?? '').trim();
		const cost = costRaw ? Number(costRaw) : null;
		const durationRaw = String(formData.get('durationMinutes') ?? '').trim();
		const durationMinutes = durationRaw ? Number(durationRaw) : null;

		db.insert(maintenanceLogs)
			.values({
				scheduleId,
				completedDate,
				completedBy: locals.user?.id ?? null,
				notes,
				cost,
				durationMinutes
			})
			.run();

		db.update(maintenanceSchedules)
			.set({ lastCompletedDate: completedDate })
			.where(eq(maintenanceSchedules.id, scheduleId))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'maintenance',
			entityId: scheduleId,
			action: 'update'
		});

		notifyHousehold({
			householdId,
			excludeUserId: locals.user?.id,
			type: 'maintenance_due',
			title: `Maintenance completed: ${schedule.name}`,
			entityType: 'maintenance',
			entityId: scheduleId
		});

		emitEntityEvent(householdId, 'entity_updated', 'maintenance', scheduleId, locals.user?.id ?? '');

		return { logged: true };
	},

	delete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'maintenance', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(maintenanceSchedules)
			.where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'maintenance',
			entityId: id,
			action: 'delete'
		});

		emitEntityEvent(householdId, 'entity_deleted', 'maintenance', id, locals.user?.id ?? '');

		return { deleted: true };
	}
};
