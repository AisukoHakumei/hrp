import { hash, verify } from '@node-rs/argon2';

/** Argon2id parameters — OWASP recommended minimum */
const ARGON2_OPTIONS = {
	memoryCost: 19456, // 19 MiB
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
} as const;

/** Hash a password using Argon2id */
export async function hashPassword(password: string): Promise<string> {
	return hash(password, ARGON2_OPTIONS);
}

/** Verify a password against a hash */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
	try {
		return await verify(hash, password, ARGON2_OPTIONS);
	} catch {
		return false;
	}
}
