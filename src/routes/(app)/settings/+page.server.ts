import { error, fail, type Actions, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import {
	households,
	tags,
	users,
	automationRules,
	auditLog,
	oauthAccounts
} from '$lib/server/db/schema/index.js';
import { and, desc, eq } from 'drizzle-orm';
import { listBackups } from '$lib/server/backup.js';
import { hashPassword, verifyPassword } from '$lib/server/auth/password.js';
import { invalidateAllUserSessions } from '$lib/server/auth/session.js';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { writeAuditLog } from '$lib/server/audit.js';
import { config } from '$lib/server/config.js';

const validRoles = new Set(['admin', 'adult', 'child', 'guest']);

function parseIsActive(value: FormDataEntryValue | null): boolean {
	if (value === null) return true;
	const normalized = String(value).trim().toLowerCase();
	return normalized === 'true' || normalized === '1' || normalized === 'on';
}

export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		error(404, 'Not found');
	}

	const household = db.select().from(households).where(eq(households.id, householdId)).get();
	if (!household) {
		error(404, 'Not found');
	}

	const userList = db.select().from(users).where(eq(users.householdId, householdId)).all();
	const oidcLink = locals.user
		? db
				.select()
				.from(oauthAccounts)
				.where(
					and(
						eq(oauthAccounts.userId, locals.user.id),
						eq(oauthAccounts.provider, config.oidc.issuer)
					)
				)
				.get()
		: null;
	const tagList = db.select().from(tags).where(eq(tags.householdId, householdId)).all();
	const ruleList = db
		.select()
		.from(automationRules)
		.where(eq(automationRules.householdId, householdId))
		.orderBy(desc(automationRules.createdAt))
		.all();
	const auditEntries = db
		.select()
		.from(auditLog)
		.orderBy(desc(auditLog.createdAt))
		.all()
		.slice(0, 100);

	return {
		household,
		users: userList,
		hasOidc: config.hasOidc,
		oidcProviderName: config.oidc.providerName,
		oidcLink,
		tags: tagList,
		rules: ruleList,
		auditEntries,
		profile: locals.user,
		isAdmin: locals.user?.role === 'admin',
		backups: listBackups()
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		db.update(households)
			.set({ name })
			.where(and(eq(households.id, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'household',
			entityId: householdId,
			action: 'update'
		});

		return { saved: true };
	},
	updateProfile: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { invalid: true });

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const email = String(formData.get('email') ?? '').trim().toLowerCase();

		if (!name || !email) return fail(400, { invalid: true });

		db.update(users)
			.set({ name, displayName: name, email })
			.where(eq(users.id, locals.user.id))
			.run();

		return { profileUpdated: true };
	},

	changePassword: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { invalid: true });

		const formData = await request.formData();
		const currentPassword = String(formData.get('currentPassword') ?? '').trim();
		const newPassword = String(formData.get('newPassword') ?? '').trim();
		const confirmPassword = String(formData.get('confirmPassword') ?? '').trim();

		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, { invalid: true });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { passwordMismatch: true });
		}

		const user = db
			.select()
			.from(users)
			.where(eq(users.id, locals.user.id))
			.get();

		if (!user || !user.passwordHash) return fail(404, { invalid: true });

		const valid = await verifyPassword(user.passwordHash, currentPassword);
		if (!valid) {
			return fail(400, { wrongPassword: true });
		}

		const newHash = await hashPassword(newPassword);
		db.update(users)
			.set({ passwordHash: newHash })
			.where(eq(users.id, locals.user.id))
			.run();

		await invalidateAllUserSessions(locals.user.id);

		return { passwordChanged: true };
	},

	unlinkOidc: async ({ locals }) => {
		if (!locals.user) return fail(401, { invalid: true });
		if (!config.hasOidc) return fail(400, { invalid: true });

		db.delete(oauthAccounts)
			.where(and(eq(oauthAccounts.userId, locals.user.id), eq(oauthAccounts.provider, config.oidc.issuer)))
			.run();

		return { oidcUnlinked: true };
	},

	createUser: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (locals.user?.role !== 'admin') return fail(403, { invalid: true });

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(formData.get('password') ?? '').trim();
		const roleInput = String(formData.get('role') ?? '').trim();
		const role = (roleInput || 'adult') as typeof users.$inferInsert.role;

		if (!name || !email || !password || !role || !validRoles.has(role)) {
			return fail(400, { invalid: true });
		}

		const passwordHash = await hashPassword(password);

		const newUser = db
			.insert(users)
			.values({
				householdId,
				name,
				displayName: name,
				email,
				role,
				passwordHash,
				isActive: true
			})
			.returning()
			.get();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'user',
			entityId: newUser.id,
			action: 'create'
		});

		return { created: true };
	},
	updateUser: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (locals.user?.role !== 'admin') return fail(403, { invalid: true });

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const name = String(formData.get('name') ?? '').trim();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const roleInput = String(formData.get('role') ?? '').trim();
		const role = roleInput as typeof users.$inferInsert.role;
		const password = String(formData.get('password') ?? '').trim();
		const isActive = parseIsActive(formData.get('isActive'));

		if (!id || !name || !email || !role || !validRoles.has(role)) {
			return fail(400, { invalid: true });
		}

		if (id === locals.user?.id && locals.user.role === 'admin' && role !== 'admin') {
			return fail(400, { invalid: true });
		}

		const user = db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.id, id), eq(users.householdId, householdId)))
			.get();
		if (!user) return fail(404, { invalid: true });

		const nextValues: Partial<typeof users.$inferInsert> = {
			name,
			displayName: name,
			email,
			role,
			isActive
		};

		if (password) {
			nextValues.passwordHash = await hashPassword(password);
		}

		db.update(users)
			.set(nextValues)
			.where(and(eq(users.id, id), eq(users.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'user',
			entityId: id,
			action: 'update'
		});

		if (!isActive || Boolean(password)) {
			await invalidateAllUserSessions(id);
		}

		return { updated: true };
	},
	deleteUser: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (locals.user?.role !== 'admin') return fail(403, { invalid: true });

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });
		if (id === locals.user?.id) return fail(400, { cannotDeleteSelf: true });

		const user = db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.id, id), eq(users.householdId, householdId)))
			.get();
		if (!user) return fail(404, { invalid: true });

		await invalidateAllUserSessions(id);

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'user',
			entityId: id,
			action: 'delete'
		});

		db.delete(users)
			.where(and(eq(users.id, id), eq(users.householdId, householdId)))
			.run();

		return { deleted: true };
	},
	createTag: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'settings', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });
		const color = String(formData.get('color') ?? '').trim() || null;

		db.insert(tags).values({ householdId, name, color }).run();
		return { success: true };
	},
	updateTag: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'settings', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });
		const color = String(formData.get('color') ?? '').trim() || null;

		db.update(tags)
			.set({ name, color })
			.where(and(eq(tags.id, id), eq(tags.householdId, householdId)))
			.run();
		return { success: true };
	},
	deleteTag: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'settings', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(tags)
			.where(and(eq(tags.id, id), eq(tags.householdId, householdId)))
			.run();
		return { success: true };
	},

	createRule: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'automation', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const description = String(formData.get('description') ?? '').trim() || null;
		const trigger = String(formData.get('trigger') ?? '').trim() as typeof automationRules.$inferInsert.trigger;
		const actionType = String(formData.get('actionType') ?? '').trim();
		const isEnabled = formData.get('isEnabled') === 'on';

		const actions = JSON.stringify([{ type: actionType }]);

		const rule = db
			.insert(automationRules)
			.values({
				householdId,
				name,
				description,
				trigger,
				conditions: '{}',
				actions,
				isEnabled,
				createdBy: locals.user?.id
			})
			.returning()
			.get();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'automation',
			entityId: rule.id,
			action: 'create'
		});

		return { ruleCreated: true };
	},

	updateRule: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'automation', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const description = String(formData.get('description') ?? '').trim() || null;
		const trigger = String(formData.get('trigger') ?? '').trim() as typeof automationRules.$inferInsert.trigger;
		const actionType = String(formData.get('actionType') ?? '').trim();
		const isEnabled = formData.get('isEnabled') === 'on';

		const actions = JSON.stringify([{ type: actionType }]);

		db.update(automationRules)
			.set({ name, description, trigger, actions, isEnabled })
			.where(and(eq(automationRules.id, id), eq(automationRules.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'automation',
			entityId: id,
			action: 'update'
		});

		return { ruleUpdated: true };
	},

	toggleRule: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'automation', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const isEnabled = formData.get('isEnabled') === 'true';

		if (!id) return fail(400, { invalid: true });

		db.update(automationRules)
			.set({ isEnabled })
			.where(and(eq(automationRules.id, id), eq(automationRules.householdId, householdId)))
			.run();

		return { ruleToggled: true };
	},

	deleteRule: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'automation', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(automationRules)
			.where(and(eq(automationRules.id, id), eq(automationRules.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'automation',
			entityId: id,
			action: 'delete'
		});

		return { ruleDeleted: true };
	}
};
