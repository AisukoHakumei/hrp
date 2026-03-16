import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$lib/server/config.js';
import { getOidcEndpoints } from '$lib/server/oidc.js';

export const GET: RequestHandler = async ({ cookies, url }) => {
	if (!config.hasOidc) {
		redirect(302, '/login');
	}

	const endpoints = await getOidcEndpoints();
	const state = crypto.randomUUID().replace(/-/g, '');

	cookies.set('oidc_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 600
	});

	const redirectUri = `${url.origin}/auth/oidc/callback`;

	const params = new URLSearchParams({
		response_type: 'code',
		client_id: config.oidc.clientId,
		redirect_uri: redirectUri,
		scope: config.oidc.scopes,
		state
	});

	redirect(302, `${endpoints.authorization_endpoint}?${params.toString()}`);
};
