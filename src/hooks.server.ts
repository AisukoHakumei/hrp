import { validateSession } from '$lib/server/auth/session.js';
import { createLogger } from '$lib/server/logger.js';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import type { Locale } from '$lib/i18n/index.js';

const log = createLogger('hooks');

export const handle: Handle = async ({ event, resolve }) => {
	// --- Locale detection ---
	const cookieLocale = event.cookies.get('locale') as Locale | undefined;
	const acceptLang = event.request.headers.get('accept-language');
	const locale: Locale =
		cookieLocale ??
		(acceptLang?.startsWith('fr') ? 'fr' : 'en');
	event.locals.locale = locale;

	// --- Session validation ---
	const sessionToken = event.cookies.get('session');
	if (sessionToken) {
		const result = await validateSession(sessionToken);
		if (result) {
			event.locals.user = result.user;
			event.locals.sessionToken = sessionToken;
			event.locals.householdId = result.user.householdId;
		} else {
			event.locals.user = null;
			event.locals.sessionToken = null;
			event.locals.householdId = null;
			// Clear stale cookie
			event.cookies.delete('session', { path: '/' });
		}
	} else {
		event.locals.user = null;
		event.locals.sessionToken = null;
		event.locals.householdId = null;
	}

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', locale)
	});

	return response;
};

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID().slice(0, 8);

	log.error(
		{
			errorId,
			status,
			path: event.url.pathname,
			method: event.request.method,
			error
		},
		message
	);

	return {
		message: status === 500 ? 'Internal server error' : message,
		code: errorId
	};
};
