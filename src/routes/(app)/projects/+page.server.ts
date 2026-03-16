import { fail, type Actions, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { db } from '$lib/server/db/index.js';
import { projects } from '$lib/server/db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import { writeAuditLog } from '$lib/server/audit.js';
import { emitEntityEvent } from '$lib/server/events.js';

export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		return {
			projects: []
		};
	}

	const projectList = db.select().from(projects).where(eq(projects.householdId, householdId)).all();

	return {
		projects: projectList
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const created = db
			.insert(projects)
			.values({
				householdId,
				name,
				type: 'other',
				status: 'planning',
				priority: 'medium',
				createdBy: locals.user?.id
			})
			.returning()
			.get();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'project',
			entityId: created.id,
			action: 'create'
		});

		emitEntityEvent(householdId, 'entity_created', 'project', created.id, locals.user?.id ?? '');

		return { success: true };
	},
	delete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'project',
			entityId: id,
			action: 'delete'
		});

		db.delete(projects)
			.where(and(eq(projects.id, id), eq(projects.householdId, householdId)))
			.run();

		emitEntityEvent(householdId, 'entity_deleted', 'project', id, locals.user?.id ?? '');

		return { deleted: true };
	}
};
