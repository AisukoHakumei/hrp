import type { UserRole } from '../db/schema/users.js';
import type { Visibility } from '../db/schema/common.js';

/** Role hierarchy — higher number = more access */
const ROLE_LEVELS: Record<UserRole, number> = {
	admin: 100,
	adult: 50,
	child: 20,
	guest: 10
};

/** Module access matrix */
type ModuleAccess = {
	view: boolean;
	create: boolean;
	edit: boolean;
	delete: boolean;
};

type Module =
	| 'dashboard'
	| 'projects'
	| 'tasks'
	| 'assets'
	| 'rooms'
	| 'finances'
	| 'documents'
	| 'knowledge'
	| 'maintenance'
	| 'calendar'
	| 'settings'
	| 'users'
	| 'automation'
	| 'notifications'
	| 'search';

const MODULE_ACCESS: Record<Module, Record<UserRole, ModuleAccess>> = {
	dashboard: {
		admin: { view: true, create: false, edit: false, delete: false },
		adult: { view: true, create: false, edit: false, delete: false },
		child: { view: true, create: false, edit: false, delete: false },
		guest: { view: true, create: false, edit: false, delete: false }
	},
	projects: {
		admin: { view: true, create: true, edit: true, delete: true },
		adult: { view: true, create: true, edit: true, delete: false },
		child: { view: true, create: false, edit: false, delete: false },
		guest: { view: true, create: false, edit: false, delete: false }
	},
	tasks: {
		admin: { view: true, create: true, edit: true, delete: true },
		adult: { view: true, create: true, edit: true, delete: true },
		child: { view: true, create: false, edit: true, delete: false }, // can update assigned tasks
		guest: { view: true, create: false, edit: false, delete: false }
	},
	assets: {
		admin: { view: true, create: true, edit: true, delete: true },
		adult: { view: true, create: true, edit: true, delete: false },
		child: { view: true, create: false, edit: false, delete: false },
		guest: { view: true, create: false, edit: false, delete: false }
	},
	rooms: {
		admin: { view: true, create: true, edit: true, delete: true },
		adult: { view: true, create: true, edit: true, delete: false },
		child: { view: true, create: false, edit: false, delete: false },
		guest: { view: true, create: false, edit: false, delete: false }
	},
	finances: {
		admin: { view: true, create: true, edit: true, delete: true },
		adult: { view: true, create: true, edit: true, delete: false },
		child: { view: false, create: false, edit: false, delete: false },
		guest: { view: false, create: false, edit: false, delete: false }
	},
	documents: {
		admin: { view: true, create: true, edit: true, delete: true },
		adult: { view: true, create: true, edit: true, delete: true },
		child: { view: true, create: false, edit: false, delete: false },
		guest: { view: true, create: false, edit: false, delete: false }
	},
	knowledge: {
		admin: { view: true, create: true, edit: true, delete: true },
		adult: { view: true, create: true, edit: true, delete: false },
		child: { view: true, create: false, edit: false, delete: false },
		guest: { view: true, create: false, edit: false, delete: false }
	},
	maintenance: {
		admin: { view: true, create: true, edit: true, delete: true },
		adult: { view: true, create: true, edit: true, delete: false },
		child: { view: true, create: false, edit: false, delete: false },
		guest: { view: false, create: false, edit: false, delete: false }
	},
	calendar: {
		admin: { view: true, create: false, edit: false, delete: false },
		adult: { view: true, create: false, edit: false, delete: false },
		child: { view: true, create: false, edit: false, delete: false },
		guest: { view: false, create: false, edit: false, delete: false }
	},
	settings: {
		admin: { view: true, create: true, edit: true, delete: true },
		adult: { view: true, create: false, edit: false, delete: false }, // profile only
		child: { view: true, create: false, edit: false, delete: false }, // profile only
		guest: { view: false, create: false, edit: false, delete: false }
	},
	users: {
		admin: { view: true, create: true, edit: true, delete: true },
		adult: { view: true, create: false, edit: false, delete: false },
		child: { view: false, create: false, edit: false, delete: false },
		guest: { view: false, create: false, edit: false, delete: false }
	},
	automation: {
		admin: { view: true, create: true, edit: true, delete: true },
		adult: { view: true, create: false, edit: false, delete: false },
		child: { view: false, create: false, edit: false, delete: false },
		guest: { view: false, create: false, edit: false, delete: false }
	},
	notifications: {
		admin: { view: true, create: false, edit: true, delete: true },
		adult: { view: true, create: false, edit: true, delete: true },
		child: { view: true, create: false, edit: true, delete: false },
		guest: { view: true, create: false, edit: false, delete: false }
	},
	search: {
		admin: { view: true, create: false, edit: false, delete: false },
		adult: { view: true, create: false, edit: false, delete: false },
		child: { view: true, create: false, edit: false, delete: false },
		guest: { view: true, create: false, edit: false, delete: false }
	}
};

/** Check if a role has access to a module action */
export function hasModuleAccess(
	role: UserRole,
	module: Module,
	action: keyof ModuleAccess
): boolean {
	return MODULE_ACCESS[module]?.[role]?.[action] ?? false;
}

/** Check if a role can see an entity with given visibility */
export function canViewEntity(
	role: UserRole,
	entityVisibility: Visibility,
	entityCreatedBy?: string | null,
	currentUserId?: string
): boolean {
	switch (entityVisibility) {
		case 'household':
			return true; // everyone in the household can see it
		case 'adults':
			return ROLE_LEVELS[role] >= ROLE_LEVELS.adult;
		case 'private':
			return role === 'admin' || entityCreatedBy === currentUserId;
		default:
			return false;
	}
}

/** Check if a role is at least the given level */
export function isAtLeast(role: UserRole, minimumRole: UserRole): boolean {
	return ROLE_LEVELS[role] >= ROLE_LEVELS[minimumRole];
}

/** Get the role level number */
export function getRoleLevel(role: UserRole): number {
	return ROLE_LEVELS[role];
}

export type { Module, ModuleAccess };
