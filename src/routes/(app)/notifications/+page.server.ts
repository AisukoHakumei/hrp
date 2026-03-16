import { fail, type Actions, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { notifications } from '$lib/server/db/schema/index.js';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { and, desc, eq } from 'drizzle-orm';

export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	const userId = locals.user?.id;
	if (!householdId || !userId) {
		return {
			notifications: []
		};
	}

	const notificationList = db
		.select()
		.from(notifications)
		.where(and(eq(notifications.householdId, householdId), eq(notifications.userId, userId)))
		.orderBy(desc(notifications.createdAt))
		.all();

	return {
		notifications: notificationList
	};
};

export const actions: Actions = {
	markRead: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		const userId = locals.user?.id;
		if (!householdId || !userId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'notifications', 'edit')) return fail(403, { invalid: true });

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.update(notifications)
			.set({ isRead: true, readAt: new Date().toISOString() })
			.where(
				and(
					eq(notifications.id, id),
					eq(notifications.householdId, householdId),
					eq(notifications.userId, userId)
				)
			)
			.run();

		return { marked: true };
	},
	markAllRead: async ({ locals }) => {
		const householdId = locals.user?.householdId;
		const userId = locals.user?.id;
		if (!householdId || !userId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'notifications', 'edit')) return fail(403, { invalid: true });

		db.update(notifications)
			.set({ isRead: true, readAt: new Date().toISOString() })
			.where(and(eq(notifications.householdId, householdId), eq(notifications.userId, userId)))
			.run();

		return { allMarked: true };
	}
};
