import { fail, type Actions, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { db } from '$lib/server/db/index.js';
import { rooms, type Room } from '$lib/server/db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import { writeAuditLog } from '$lib/server/audit.js';
import { emitEntityEvent } from '$lib/server/events.js';

export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		return {
			rooms: []
		};
	}

	const roomList = db.select().from(rooms).where(eq(rooms.householdId, householdId)).all();

	return {
		rooms: roomList
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const type = String(formData.get('type') ?? 'room').trim();
		const areaRaw = String(formData.get('area') ?? '').trim();
		const area = areaRaw ? parseFloat(areaRaw) : null;
		const description = String(formData.get('description') ?? '').trim() || null;

		const created = db
			.insert(rooms)
			.values({
				householdId,
				name,
				type: type as Room['type'],
				area,
				description,
				createdBy: locals.user?.id
			})
			.returning({ id: rooms.id })
			.get();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'room',
			entityId: created.id,
			action: 'create'
		});

		emitEntityEvent(householdId, 'entity_created', 'room', created.id, locals.user?.id ?? '');

		return { created: true };
	},
	delete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(rooms)
			.where(and(eq(rooms.id, id), eq(rooms.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'room',
			entityId: id,
			action: 'delete'
		});

		emitEntityEvent(householdId, 'entity_deleted', 'room', id, locals.user?.id ?? '');

		return { deleted: true };
	}
};
