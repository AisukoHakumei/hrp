import { describe, expect, it } from 'vitest';
import { hasModuleAccess } from '../../src/lib/permissions.js';

const actions = ['view', 'create', 'edit', 'delete'] as const;

describe('permissions client helper', () => {
	it('admin has full access everywhere', () => {
		for (const action of actions) {
			expect(hasModuleAccess('admin', 'projects', action)).toBe(true);
			expect(hasModuleAccess('admin', 'finances', action)).toBe(true);
			expect(hasModuleAccess('admin', 'settings', action)).toBe(true);
		}
	});

	it('guest has view-only access', () => {
		expect(hasModuleAccess('guest', 'projects', 'view')).toBe(true);
		expect(hasModuleAccess('guest', 'projects', 'create')).toBe(false);
		expect(hasModuleAccess('guest', 'projects', 'edit')).toBe(false);
		expect(hasModuleAccess('guest', 'projects', 'delete')).toBe(false);
	});

	it('child has no finance access', () => {
		expect(hasModuleAccess('child', 'finances', 'view')).toBe(false);
		expect(hasModuleAccess('child', 'finances', 'create')).toBe(false);
		expect(hasModuleAccess('child', 'finances', 'edit')).toBe(false);
		expect(hasModuleAccess('child', 'finances', 'delete')).toBe(false);
	});

	it('adult has most access but not settings delete', () => {
		expect(hasModuleAccess('adult', 'projects', 'view')).toBe(true);
		expect(hasModuleAccess('adult', 'projects', 'create')).toBe(true);
		expect(hasModuleAccess('adult', 'projects', 'edit')).toBe(true);
		expect(hasModuleAccess('adult', 'projects', 'delete')).toBe(true);

		expect(hasModuleAccess('adult', 'settings', 'delete')).toBe(false);
		expect(hasModuleAccess('adult', 'documents', 'delete')).toBe(false);
		expect(hasModuleAccess('adult', 'knowledge', 'delete')).toBe(false);
		expect(hasModuleAccess('adult', 'calendar', 'delete')).toBe(false);
		expect(hasModuleAccess('adult', 'search', 'delete')).toBe(false);
	});
});
