import { fail, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { assets, projectAssets, projectRooms, projects, rooms } from '$lib/server/db/schema/index.js';
import { createId } from '$lib/server/db/schema/common.js';
import { eq } from 'drizzle-orm';
import { emitEntityEvent } from '$lib/server/events.js';

export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		return {
			rooms: [],
			assets: []
		};
	}

	return {
		rooms: db.select().from(rooms).where(eq(rooms.householdId, householdId)).all(),
		assets: db.select().from(assets).where(eq(assets.householdId, householdId)).all()
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const projectId = createId();
		const description = String(formData.get('description') ?? '').trim() || null;
		const budgetAmountValue = String(formData.get('budgetAmount') ?? '').trim();
		const endDate = String(formData.get('endDate') ?? '').trim() || null;
		const selectedRoomIds = formData
			.getAll('roomIds')
			.map((value) => String(value).trim())
			.filter(Boolean);
		const selectedAssetIds = formData
			.getAll('assetIds')
			.map((value) => String(value).trim())
			.filter(Boolean);

		db.insert(projects)
			.values({
				id: projectId,
				householdId,
				name,
				description,
				type: 'other',
				status: 'planning',
				priority: 'medium',
				budgetAmount: budgetAmountValue ? Number(budgetAmountValue) : null,
				endDate,
				createdBy: locals.user?.id
			})
			.run();

		emitEntityEvent(householdId, 'entity_created', 'project', projectId, locals.user?.id ?? '');

		if (selectedRoomIds.length > 0) {
			db.insert(projectRooms)
				.values(selectedRoomIds.map((roomId) => ({ projectId, roomId })))
				.run();
		}

		if (selectedAssetIds.length > 0) {
			db.insert(projectAssets)
				.values(
					selectedAssetIds.map((assetId) => ({
						projectId,
						assetId,
						relationship: 'affected' as const
					}))
				)
				.run();
		}

		redirect(302, `/projects/${projectId}`);
	}
};
