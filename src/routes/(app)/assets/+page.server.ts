import { fail, type Actions, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { db } from '$lib/server/db/index.js';
import {
	assets,
	rooms,
	type AssetCategory,
	type AssetStatus
} from '$lib/server/db/schema/index.js';
import { and, eq, inArray } from 'drizzle-orm';
import { writeAuditLog } from '$lib/server/audit.js';
import { emitEntityEvent } from '$lib/server/events.js';

export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		return {
			assets: [],
			rooms: []
		};
	}

	const assetList = db.select().from(assets).where(eq(assets.householdId, householdId)).all();
	const roomList = db.select().from(rooms).where(eq(rooms.householdId, householdId)).all();

	return {
		assets: assetList,
		rooms: roomList
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'assets', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const category = String(formData.get('category') ?? 'other').trim();
		const status = String(formData.get('status') ?? 'active').trim();
		const roomId = String(formData.get('roomId') ?? '').trim() || null;
		const description = String(formData.get('description') ?? '').trim() || null;

		const created = db
			.insert(assets)
			.values({
				householdId,
				name,
				category: category as AssetCategory,
				status: status as AssetStatus,
				roomId,
				description,
				createdBy: locals.user?.id
			})
			.returning({ id: assets.id })
			.get();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'asset',
			entityId: created.id,
			action: 'create'
		});

		emitEntityEvent(householdId, 'entity_created', 'asset', created.id, locals.user?.id ?? '');

		return { created: true };
	},
	delete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'assets', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(assets)
			.where(and(eq(assets.id, id), eq(assets.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'asset',
			entityId: id,
			action: 'delete'
		});

		emitEntityEvent(householdId, 'entity_deleted', 'asset', id, locals.user?.id ?? '');

		return { deleted: true };
	},
	bulkDelete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'assets', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const ids = String(formData.get('ids') ?? '')
			.split(',')
			.filter(Boolean);
		if (ids.length === 0) return fail(400, { invalid: true });

		db.delete(assets)
			.where(and(eq(assets.householdId, householdId), inArray(assets.id, ids)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'asset',
			entityId: `bulk:${ids.length}`,
			action: 'delete'
		});

		for (const id of ids) {
			emitEntityEvent(householdId, 'entity_deleted', 'asset', id, locals.user?.id ?? '');
		}

		return { deleted: true };
	}
};
