import { redirect, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { households } from '$lib/server/db/schema/index.js';

export const load = async ({ locals }: RequestEvent) => {
	if (locals.user) {
		redirect(302, '/dashboard');
	}

	let hasHousehold = false;
	try {
		hasHousehold = !!db.select({ id: households.id }).from(households).get();
	} catch {
		// Table may not exist if migrations haven't run — treat as fresh install
	}

	redirect(302, hasHousehold ? '/login' : '/setup');
};
