import type { RequestEvent } from '@sveltejs/kit';

export const load = async ({ locals }: RequestEvent) => {
	return {
		user: locals.user,
		locale: locals.locale
	};
};
