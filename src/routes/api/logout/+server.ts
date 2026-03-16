import { redirect, type RequestEvent } from '@sveltejs/kit';
import { invalidateSession } from '$lib/server/auth/session.js';

export const POST = async ({ locals, cookies }: RequestEvent) => {
	if (locals.sessionToken) {
		await invalidateSession(locals.sessionToken);
	}
	cookies.delete('session', { path: '/' });
	redirect(302, '/login');
};
