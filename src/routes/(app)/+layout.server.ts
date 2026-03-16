import { redirect, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { households } from '$lib/server/db/schema/index.js';
import { eq } from 'drizzle-orm';

export const load = async ({ locals }: RequestEvent) => {
	if (!locals.user) {
		redirect(302, '/login');
	}

	const household = db
		.select()
		.from(households)
		.where(eq(households.id, locals.user.householdId))
		.get();

	if (!household) {
		redirect(302, '/setup');
	}

	return {
		user: locals.user,
		household
	};
};
