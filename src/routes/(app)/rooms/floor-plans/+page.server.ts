import { error, fail, type Actions, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { db } from '$lib/server/db/index.js';
import { assets, floorPlans, rooms } from '$lib/server/db/schema/index.js';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { deleteFile } from '$lib/server/storage.js';

const ROOM_TYPE_COLORS: Record<string, string> = {
	room: '#6366f1',
	hallway: '#9ca3af',
	bathroom: '#06b6d4',
	kitchen: '#f59e0b',
	garage: '#64748b',
	garden: '#10b981',
	attic: '#a78bfa',
	basement: '#78716c',
	balcony: '#38bdf8',
	storage: '#d4d4d8',
	other: '#a1a1aa'
};

export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		error(404, 'Not found');
	}

	const plans = db
		.select()
		.from(floorPlans)
		.where(eq(floorPlans.householdId, householdId))
		.orderBy(floorPlans.floor, floorPlans.sortOrder)
		.all();

	const assignedRooms = db
		.select({
			id: rooms.id,
			name: rooms.name,
			type: rooms.type,
			floorPlanId: rooms.floorPlanId,
			posX: rooms.posX,
			posY: rooms.posY,
			posWidth: rooms.posWidth,
			posHeight: rooms.posHeight,
			color: rooms.color
		})
		.from(rooms)
		.where(
			and(
				eq(rooms.householdId, householdId),
				sql`${rooms.floorPlanId} IS NOT NULL`
			)
		)
		.all();

	const assetCounts = db
		.select({
			roomId: assets.roomId,
			count: sql<number>`count(*)`.as('count')
		})
		.from(assets)
		.where(
			and(
				eq(assets.householdId, householdId),
				sql`${assets.roomId} IS NOT NULL`
			)
		)
		.groupBy(assets.roomId)
		.all();

	const assetCountMap: Record<string, number> = {};
	for (const row of assetCounts) {
		if (row.roomId) assetCountMap[row.roomId] = row.count;
	}

	const unassignedRooms = db
		.select({ id: rooms.id, name: rooms.name, type: rooms.type })
		.from(rooms)
		.where(
			and(
				eq(rooms.householdId, householdId),
				isNull(rooms.floorPlanId)
			)
		)
		.all();

	return {
		plans,
		assignedRooms,
		assetCountMap,
		unassignedRooms
	};
};

export const actions: Actions = {
	createFloorPlan: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const description = String(formData.get('description') ?? '').trim() || null;
		const floor = parseInt(String(formData.get('floor') ?? '0'), 10);
		const imagePath = String(formData.get('imagePath') ?? '').trim();
		if (!imagePath) return fail(400, { invalid: true });

		const imageWidth = parseInt(String(formData.get('imageWidth') ?? '0'), 10) || null;
		const imageHeight = parseInt(String(formData.get('imageHeight') ?? '0'), 10) || null;

		db.insert(floorPlans)
			.values({
				householdId,
				name,
				description,
				floor: isNaN(floor) ? 0 : floor,
				imagePath,
				imageWidth,
				imageHeight,
				createdBy: locals.user?.id
			})
			.run();

		return { created: true };
	},

	updateFloorPlan: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const description = String(formData.get('description') ?? '').trim() || null;
		const floor = parseInt(String(formData.get('floor') ?? '0'), 10);

		db.update(floorPlans)
			.set({ name, description, floor: isNaN(floor) ? 0 : floor })
			.where(and(eq(floorPlans.id, id), eq(floorPlans.householdId, householdId)))
			.run();

		return { updated: true };
	},

	deleteFloorPlan: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const plan = db
			.select()
			.from(floorPlans)
			.where(and(eq(floorPlans.id, id), eq(floorPlans.householdId, householdId)))
			.get();

		if (!plan) return fail(404, { invalid: true });

		try {
			await deleteFile(plan.imagePath);
		} catch {
			// ENOENT expected — image may already be deleted
		}

		db.delete(floorPlans)
			.where(and(eq(floorPlans.id, id), eq(floorPlans.householdId, householdId)))
			.run();

		return { deleted: true };
	},

	assignRoom: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const roomId = String(formData.get('roomId') ?? '').trim();
		const floorPlanId = String(formData.get('floorPlanId') ?? '').trim();
		if (!roomId || !floorPlanId) return fail(400, { invalid: true });

		const room = db
			.select({ type: rooms.type, color: rooms.color })
			.from(rooms)
			.where(and(eq(rooms.id, roomId), eq(rooms.householdId, householdId)))
			.get();

		if (!room) return fail(404, { invalid: true });

		const color = room.color || ROOM_TYPE_COLORS[room.type ?? 'other'] || '#a1a1aa';

		db.update(rooms)
			.set({
				floorPlanId,
				posX: 45,
				posY: 45,
				posWidth: 10,
				posHeight: 10,
				color
			})
			.where(and(eq(rooms.id, roomId), eq(rooms.householdId, householdId)))
			.run();

		return { assigned: true };
	},

	saveAllPositions: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const positionsJson = String(formData.get('positions') ?? '[]');

		let positions: Array<{ roomId: string; posX: number; posY: number; posWidth: number; posHeight: number }>;
		try {
			positions = JSON.parse(positionsJson);
		} catch {
			return fail(400, { invalid: true });
		}

		for (const pos of positions) {
			if (!pos.roomId) continue;
			db.update(rooms)
				.set({
					posX: pos.posX,
					posY: pos.posY,
					posWidth: pos.posWidth,
					posHeight: pos.posHeight
				})
				.where(and(eq(rooms.id, pos.roomId), eq(rooms.householdId, householdId)))
				.run();
		}

		return { saved: true };
	},

	removeRoom: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const roomId = String(formData.get('roomId') ?? '').trim();
		if (!roomId) return fail(400, { invalid: true });

		db.update(rooms)
			.set({ floorPlanId: null, posX: null, posY: null, posWidth: null, posHeight: null })
			.where(and(eq(rooms.id, roomId), eq(rooms.householdId, householdId)))
			.run();

		return { removed: true };
	}
};
