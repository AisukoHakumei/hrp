import { fail, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { households, users } from '$lib/server/db/schema/index.js';
import { createId } from '$lib/server/db/schema/common.js';
import { hashPassword } from '$lib/server/auth/password.js';
import { createSession } from '$lib/server/auth/session.js';
import { seedDefaultRules } from '$lib/server/automation.js';

export const load = async ({ locals }: RequestEvent) => {
	let existingHousehold: { id: string } | undefined;
	try {
		existingHousehold = db.select({ id: households.id }).from(households).get();
	} catch {
		// Table may not exist yet — treat as fresh install, show setup form
	}
	if (existingHousehold) {
		redirect(302, locals.user ? '/dashboard' : '/login');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const formData = await request.formData();
		const householdName = String(formData.get('householdName') ?? '').trim();
		const name = String(formData.get('name') ?? '').trim();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(formData.get('password') ?? '').trim();

		if (!householdName || !name || !email || !password) {
			return fail(400, {
				householdName,
				name,
				email,
				invalid: true,
				message: 'All fields are required'
			});
		}

		if (password.length < 8) {
			return fail(400, {
				householdName,
				name,
				email,
				invalid: true,
				message: 'Password must be at least 8 characters'
			});
		}

		const existing = db.select({ id: households.id }).from(households).get();
		if (existing) {
			redirect(302, '/login');
		}

		const householdId = createId();
		const userId = createId();
		const passwordHash = await hashPassword(password);

		db.transaction((tx) => {
			tx.insert(households)
				.values({
					id: householdId,
					name: householdName,
					currency: 'EUR',
					timezone: 'Europe/Paris',
					locale: 'en'
				})
				.run();

			tx.insert(users)
				.values({
					id: userId,
					householdId,
					email,
					name,
					displayName: name.split(' ')[0],
					role: 'admin',
					passwordHash,
					isActive: true
				})
				.run();

			seedDefaultRules(householdId, userId, tx);
		});

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

		redirect(302, '/dashboard');
	}
};
