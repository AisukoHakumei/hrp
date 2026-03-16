import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../../src/lib/server/auth/password.js';

describe('server/auth/password', () => {
	it('hashPassword returns an Argon2id hash string', async () => {
		const hashed = await hashPassword('correct horse battery staple');

		expect(typeof hashed).toBe('string');
		expect(hashed).toContain('argon2id');
	});

	it('hashPassword returns different hashes for different passwords', async () => {
		const first = await hashPassword('alpha-password');
		const second = await hashPassword('beta-password');

		expect(first).not.toBe(second);
	});

	it('hashPassword returns different hashes for same password (salted)', async () => {
		const first = await hashPassword('same-password');
		const second = await hashPassword('same-password');

		expect(first).not.toBe(second);
	});

	it('verifyPassword returns true for correct password', async () => {
		const password = 'my-secret-password';
		const hashed = await hashPassword(password);

		expect(await verifyPassword(hashed, password)).toBe(true);
	});

	it('verifyPassword returns false for wrong password', async () => {
		const hashed = await hashPassword('correct-password');

		expect(await verifyPassword(hashed, 'wrong-password')).toBe(false);
	});

	it('verifyPassword returns false for empty password string', async () => {
		const hashed = await hashPassword('non-empty-password');

		expect(await verifyPassword(hashed, '')).toBe(false);
	});

	it('verifyPassword returns false for invalid hash', async () => {
		expect(await verifyPassword('not-a-valid-argon2-hash', 'password')).toBe(false);
	});
});
