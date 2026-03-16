import type { UserRole } from '$lib/server/db/schema/users.js';

declare global {
	namespace App {
		interface Error {
			code?: string;
			message: string;
		}
		interface Locals {
			user: {
				id: string;
				householdId: string;
				email: string;
				name: string;
				displayName: string | null;
				role: UserRole;
				isActive: boolean;
			} | null;
			sessionToken: string | null;
			locale: 'en' | 'fr';
			householdId: string | null;
		}
	}
}

export {};
