import { db } from '../db/index.js';
import { sessions, users } from '../db/schema/index.js';
import { eq, and, gt, lt } from 'drizzle-orm';
import { config } from '../config.js';
import type { User, Session } from '../db/schema/users.js';

/** Generate a cryptographically random session token */
function generateSessionToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** Create a new session for a user */
export async function createSession(
	userId: string,
	meta?: { ipAddress?: string; userAgent?: string }
): Promise<{ session: Session; token: string }> {
	const token = generateSessionToken();
	const expiresAt = new Date(Date.now() + config.sessionMaxAge * 1000).toISOString();

	const session = db
		.insert(sessions)
		.values({
			id: token,
			userId,
			expiresAt,
			ipAddress: meta?.ipAddress,
			userAgent: meta?.userAgent
		})
		.returning()
		.get();

	// Update last login
	db.update(users)
		.set({ lastLoginAt: new Date().toISOString() })
		.where(eq(users.id, userId))
		.run();

	return { session, token };
}

export interface ValidatedSession {
	user: User;
	session: Session;
}

/** Validate a session token and return user + session if valid */
export async function validateSession(token: string): Promise<ValidatedSession | null> {
	if (!token) return null;

	const now = new Date().toISOString();

	const result = db
		.select()
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.id, token), gt(sessions.expiresAt, now)))
		.get();

	if (!result) return null;
	if (!result.users.isActive) return null;

	// Extend session if more than half of max age has passed
	const expiresAt = new Date(result.sessions.expiresAt);
	const halfLife = config.sessionMaxAge * 500; // half of max age in ms
	if (expiresAt.getTime() - Date.now() < halfLife) {
		const newExpiry = new Date(Date.now() + config.sessionMaxAge * 1000).toISOString();
		db.update(sessions).set({ expiresAt: newExpiry }).where(eq(sessions.id, token)).run();
	}

	return { user: result.users, session: result.sessions };
}

/** Invalidate a session */
export async function invalidateSession(token: string): Promise<void> {
	db.delete(sessions).where(eq(sessions.id, token)).run();
}

/** Invalidate all sessions for a user */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
	db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

/** Clean up expired sessions (call periodically) */
export function cleanExpiredSessions(): number {
	const now = new Date().toISOString();
	const result = db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
	return result.changes;
}
