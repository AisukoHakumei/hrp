import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$lib/server/config.js';
import { getOidcUserEmail } from '$lib/server/oidc.js';
import { db } from '$lib/server/db/index.js';
import { oauthAccounts, users } from '$lib/server/db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import { createSession } from '$lib/server/auth/session.js';
import { writeAuditLog } from '$lib/server/audit.js';
import { createLogger } from '$lib/server/logger.js';

const log = createLogger('oidc-callback');

export const GET: RequestHandler = async ({ url, cookies, request, getClientAddress }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const providerError = url.searchParams.get('error');

	if (providerError) {
		log.warn({ providerError }, 'OIDC provider returned error');
		redirect(302, '/login?error=oidc_error');
	}

	if (!code || !state) {
		redirect(302, '/login?error=oidc_error');
	}

	const savedState = cookies.get('oidc_state');
	cookies.delete('oidc_state', { path: '/' });

	if (state !== savedState) {
		log.warn('OIDC state mismatch');
		redirect(302, '/login?error=oidc_error');
	}

	try {
		const redirectUri = `${url.origin}/auth/oidc/callback`;
		const { email, sub } = await getOidcUserEmail(code, redirectUri);
		const provider = config.oidc.issuer;

		const existingLink = db
			.select()
			.from(oauthAccounts)
			.where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, sub)))
			.get();

		let userId: string;

		if (existingLink) {
			userId = existingLink.userId;
		} else {
			const user = db
				.select()
				.from(users)
				.where(eq(users.email, email.toLowerCase()))
				.get();

			if (!user || !user.isActive) {
				redirect(302, '/login?error=oidc_no_account');
			}

			db.insert(oauthAccounts)
				.values({
					provider,
					providerUserId: sub,
					userId: user.id
				})
				.run();

			userId = user.id;
		}

		const { token } = await createSession(userId, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent') ?? undefined
		});

		cookies.set('session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 30 * 24 * 60 * 60
		});

		writeAuditLog({
			userId,
			entityType: 'session',
			entityId: token.slice(0, 8),
			action: 'login'
		});

		redirect(302, '/dashboard');
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;

		log.error({ err }, 'OIDC callback failed');
		redirect(302, '/login?error=oidc_error');
	}
};
