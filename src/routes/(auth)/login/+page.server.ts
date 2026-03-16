import { fail, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '$lib/server/auth/password.js';
import { createSession } from '$lib/server/auth/session.js';
import { config } from '$lib/server/config.js';

export const load = async ({ locals }: RequestEvent) => {
	if (locals.user) {
		redirect(302, '/dashboard');
	}
	return {
		hasOidc: config.hasOidc,
		oidcProviderName: config.oidc.providerName
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(formData.get('password') ?? '').trim();

		if (!email || !password) {
			return fail(400, { email, invalid: true, message: 'Email and password are required' });
		}

		const user = db.select().from(users).where(eq(users.email, email)).get();
		if (!user || !user.passwordHash || !user.isActive) {
			return fail(400, { email, invalid: true, message: 'Invalid email or password' });
		}

		const validPassword = await verifyPassword(user.passwordHash, password);
		if (!validPassword) {
			return fail(400, { email, invalid: true, message: 'Invalid email or password' });
		}

		const { token } = await createSession(user.id, {
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

		redirect(302, '/dashboard');
	}
};
