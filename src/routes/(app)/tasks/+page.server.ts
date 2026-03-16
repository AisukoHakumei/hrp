import { fail, type Actions, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { db } from '$lib/server/db/index.js';
import { entityTags, tags, tasks, users } from '$lib/server/db/schema/index.js';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { createNotification } from '$lib/server/notifications.js';
import { writeAuditLog } from '$lib/server/audit.js';
import { emitEntityEvent } from '$lib/server/events.js';

export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		return {
			tasks: [],
			users: [],
			allTags: [],
			taskTags: []
		};
	}

	const taskList = db
		.select()
		.from(tasks)
		.where(eq(tasks.householdId, householdId))
		.orderBy(desc(tasks.createdAt))
		.all();

	const userList = db.select().from(users).where(eq(users.householdId, householdId)).all();

	const allTags = db.select().from(tags).where(eq(tags.householdId, householdId)).all();

	const taskTagsList = db
		.select({
			entityId: entityTags.entityId,
			tagId: entityTags.tagId,
			tagName: tags.name,
			tagColor: tags.color
		})
		.from(entityTags)
		.innerJoin(tags, eq(tags.id, entityTags.tagId))
		.where(and(eq(entityTags.entityType, 'task'), eq(tags.householdId, householdId)))
		.all();

	return {
		tasks: taskList,
		users: userList,
		allTags,
		taskTags: taskTagsList
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'tasks', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const title = String(formData.get('title') ?? '').trim();
		if (!title) return fail(400, { invalid: true });

		const description = String(formData.get('description') ?? '').trim() || null;
		const priority = (String(formData.get('priority') ?? '').trim() || 'medium') as typeof tasks.$inferInsert.priority;
		const status = (String(formData.get('status') ?? '').trim() || 'todo') as typeof tasks.$inferInsert.status;
		const assigneeId = String(formData.get('assigneeId') ?? '').trim() || null;
		const dueDate = String(formData.get('dueDate') ?? '').trim() || null;

		const parentId = String(formData.get('parentId') ?? '').trim() || null;
		const isRecurring = formData.get('isRecurring') === 'on';
		const recurrenceRule = isRecurring
			? String(formData.get('recurrenceRule') ?? '').trim() || null
			: null;

		const created = db
			.insert(tasks)
			.values({
				householdId,
				title,
				description,
				status,
				priority,
				assigneeId,
				dueDate,
				parentId,
				isRecurring,
				recurrenceRule,
				createdBy: locals.user?.id
			})
			.returning()
			.get();

		if (assigneeId && assigneeId !== locals.user?.id) {
			createNotification({
				householdId,
				userId: assigneeId,
				type: 'task_assigned',
				title: `Task assigned: ${title}`,
				entityType: 'task',
				entityId: created.id
			});
		}

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'task',
			entityId: created.id,
			action: 'create'
		});

		emitEntityEvent(householdId, 'entity_created', 'task', created.id, locals.user?.id ?? '');

		return { created: true };
	},
	update: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'tasks', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const title = String(formData.get('title') ?? '').trim();
		if (!title) return fail(400, { invalid: true });

		const description = String(formData.get('description') ?? '').trim() || null;
		const priority = (String(formData.get('priority') ?? '').trim() || 'medium') as typeof tasks.$inferInsert.priority;
		const status = (String(formData.get('status') ?? '').trim() || 'todo') as typeof tasks.$inferInsert.status;
		const assigneeId = String(formData.get('assigneeId') ?? '').trim() || null;
		const dueDate = String(formData.get('dueDate') ?? '').trim() || null;
		const isRecurring = formData.get('isRecurring') === 'on';
		const recurrenceRule = isRecurring
			? String(formData.get('recurrenceRule') ?? '').trim() || null
			: null;

		const existingTask = db
			.select({ assigneeId: tasks.assigneeId })
			.from(tasks)
			.where(and(eq(tasks.id, id), eq(tasks.householdId, householdId)))
			.get();

		db.update(tasks)
			.set({ title, description, priority, status, assigneeId, dueDate, isRecurring, recurrenceRule })
			.where(and(eq(tasks.id, id), eq(tasks.householdId, householdId)))
			.run();

		if (assigneeId && assigneeId !== locals.user?.id && assigneeId !== existingTask?.assigneeId) {
			createNotification({
				householdId,
				userId: assigneeId,
				type: 'task_assigned',
				title: `Task assigned: ${title}`,
				entityType: 'task',
				entityId: id
			});
		}

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'task',
			entityId: id,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'task', id, locals.user?.id ?? '');

		return { updated: true };
	},
	updateStatus: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'tasks', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const status = String(formData.get('status') ?? '').trim();
		if (!id || !status) return fail(400, { invalid: true });

		db.update(tasks)
			.set({ status: status as typeof tasks.$inferInsert.status })
			.where(and(eq(tasks.id, id), eq(tasks.householdId, householdId)))
			.run();

		emitEntityEvent(householdId, 'entity_updated', 'task', id, locals.user?.id ?? '');

		return { updated: true };
	},
	delete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'tasks', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'task',
			entityId: id,
			action: 'delete'
		});

		db.delete(tasks)
			.where(and(eq(tasks.id, id), eq(tasks.householdId, householdId)))
			.run();

		emitEntityEvent(householdId, 'entity_deleted', 'task', id, locals.user?.id ?? '');

		return { deleted: true };
	},
	bulkDelete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'tasks', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const ids = String(formData.get('ids') ?? '')
			.split(',')
			.filter(Boolean);
		if (ids.length === 0) return fail(400, { invalid: true });

		db.delete(tasks)
			.where(and(eq(tasks.householdId, householdId), inArray(tasks.id, ids)))
			.run();

		for (const id of ids) {
			emitEntityEvent(householdId, 'entity_deleted', 'task', id, locals.user?.id ?? '');
		}

		return { deleted: true };
	},
	bulkUpdateStatus: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'tasks', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const ids = String(formData.get('ids') ?? '')
			.split(',')
			.filter(Boolean);
		const status = String(formData.get('status') ?? '').trim();
		if (ids.length === 0 || !status) return fail(400, { invalid: true });

		db.update(tasks)
			.set({ status: status as (typeof tasks.$inferInsert)['status'] })
			.where(and(eq(tasks.householdId, householdId), inArray(tasks.id, ids)))
			.run();

		for (const id of ids) {
			emitEntityEvent(householdId, 'entity_updated', 'task', id, locals.user?.id ?? '');
		}

		return { updated: true };
	},
	bulkAssign: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'tasks', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const ids = String(formData.get('ids') ?? '')
			.split(',')
			.filter(Boolean);
		const assigneeId = String(formData.get('assigneeId') ?? '').trim() || null;
		if (ids.length === 0) return fail(400, { invalid: true });

		db.update(tasks)
			.set({ assigneeId })
			.where(and(eq(tasks.householdId, householdId), inArray(tasks.id, ids)))
			.run();

		for (const id of ids) {
			emitEntityEvent(householdId, 'entity_updated', 'task', id, locals.user?.id ?? '');
		}

		return { updated: true };
	},
	addTag: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'tasks', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const entityId = String(formData.get('entityId') ?? '').trim();
		const tagId = String(formData.get('tagId') ?? '').trim();
		if (!entityId || !tagId) return fail(400, { invalid: true });

		db.insert(entityTags)
			.values({ tagId, entityType: 'task', entityId })
			.onConflictDoNothing()
			.run();
		return { success: true };
	},
	removeTag: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'tasks', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const entityId = String(formData.get('entityId') ?? '').trim();
		const tagId = String(formData.get('tagId') ?? '').trim();
		if (!entityId || !tagId) return fail(400, { invalid: true });

		db.delete(entityTags)
			.where(
				and(
					eq(entityTags.tagId, tagId),
					eq(entityTags.entityType, 'task'),
					eq(entityTags.entityId, entityId)
				)
			)
			.run();

		return { success: true };
	}
};
