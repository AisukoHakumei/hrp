type Role = 'admin' | 'adult' | 'child' | 'guest';
type Action = 'view' | 'create' | 'edit' | 'delete';

const readonlyModules = ['documents', 'knowledge', 'calendar', 'search', 'notifications'] as const;

export function hasModuleAccess(role: Role, module: string, action: Action) {
	if (role === 'admin') return true;
	if (role === 'guest') return action === 'view';
	if (role === 'child') {
		if (module === 'finances') return false;
		return action === 'view' || action === 'create';
	}
	if (role === 'adult') {
		if (module === 'settings' && action === 'delete') return false;
		if (readonlyModules.includes(module as (typeof readonlyModules)[number])) {
			return action !== 'delete';
		}
		return true;
	}
	return false;
}
