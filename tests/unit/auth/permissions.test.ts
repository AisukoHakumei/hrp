import { describe, expect, it } from 'vitest';
import {
	canViewEntity,
	getRoleLevel,
	hasModuleAccess,
	isAtLeast
} from '../../../src/lib/server/auth/permissions.js';

const modules = [
	'dashboard',
	'projects',
	'tasks',
	'assets',
	'rooms',
	'finances',
	'documents',
	'knowledge',
	'maintenance',
	'calendar',
	'settings',
	'users',
	'automation',
	'notifications',
	'search'
] as const;

const actions = ['view', 'create', 'edit', 'delete'] as const;

describe('server/auth/permissions', () => {
	it('admin has full access to all modules', () => {
		// Modules where admin has all 4 actions
		const fullCrudModules = [
			'projects', 'tasks', 'assets', 'rooms', 'finances',
			'documents', 'knowledge', 'maintenance', 'settings',
			'users', 'automation'
		] as const;
		for (const module of fullCrudModules) {
			for (const action of actions) {
				expect(hasModuleAccess('admin', module, action), `admin/${module}/${action}`).toBe(true);
			}
		}
		// View-only modules (dashboard, calendar, search) — admin can view but not create/edit/delete
		expect(hasModuleAccess('admin', 'dashboard', 'view')).toBe(true);
		expect(hasModuleAccess('admin', 'calendar', 'view')).toBe(true);
		expect(hasModuleAccess('admin', 'search', 'view')).toBe(true);
		// Notifications — admin can view, edit, delete but not create
		expect(hasModuleAccess('admin', 'notifications', 'view')).toBe(true);
		expect(hasModuleAccess('admin', 'notifications', 'edit')).toBe(true);
		expect(hasModuleAccess('admin', 'notifications', 'delete')).toBe(true);
	});

	it('adult has create/edit but not delete for most modules', () => {
		expect(hasModuleAccess('adult', 'projects', 'create')).toBe(true);
		expect(hasModuleAccess('adult', 'projects', 'edit')).toBe(true);
		expect(hasModuleAccess('adult', 'projects', 'delete')).toBe(false);

		expect(hasModuleAccess('adult', 'assets', 'create')).toBe(true);
		expect(hasModuleAccess('adult', 'assets', 'edit')).toBe(true);
		expect(hasModuleAccess('adult', 'assets', 'delete')).toBe(false);

		expect(hasModuleAccess('adult', 'rooms', 'create')).toBe(true);
		expect(hasModuleAccess('adult', 'rooms', 'edit')).toBe(true);
		expect(hasModuleAccess('adult', 'rooms', 'delete')).toBe(false);
	});

	it('child has view-only for most modules and no finance access', () => {
		expect(hasModuleAccess('child', 'projects', 'view')).toBe(true);
		expect(hasModuleAccess('child', 'projects', 'create')).toBe(false);
		expect(hasModuleAccess('child', 'projects', 'edit')).toBe(false);
		expect(hasModuleAccess('child', 'projects', 'delete')).toBe(false);

		expect(hasModuleAccess('child', 'assets', 'view')).toBe(true);
		expect(hasModuleAccess('child', 'assets', 'create')).toBe(false);
		expect(hasModuleAccess('child', 'assets', 'edit')).toBe(false);
		expect(hasModuleAccess('child', 'assets', 'delete')).toBe(false);

		expect(hasModuleAccess('child', 'finances', 'view')).toBe(false);
		expect(hasModuleAccess('child', 'finances', 'create')).toBe(false);
		expect(hasModuleAccess('child', 'finances', 'edit')).toBe(false);
		expect(hasModuleAccess('child', 'finances', 'delete')).toBe(false);
	});

	it('guest has view-only and no finance/maintenance/calendar access', () => {
		expect(hasModuleAccess('guest', 'projects', 'view')).toBe(true);
		expect(hasModuleAccess('guest', 'projects', 'create')).toBe(false);
		expect(hasModuleAccess('guest', 'projects', 'edit')).toBe(false);
		expect(hasModuleAccess('guest', 'projects', 'delete')).toBe(false);

		expect(hasModuleAccess('guest', 'finances', 'view')).toBe(false);
		expect(hasModuleAccess('guest', 'maintenance', 'view')).toBe(false);
		expect(hasModuleAccess('guest', 'calendar', 'view')).toBe(false);
	});

	it('canViewEntity household visibility: everyone can see', () => {
		expect(canViewEntity('admin', 'household')).toBe(true);
		expect(canViewEntity('adult', 'household')).toBe(true);
		expect(canViewEntity('child', 'household')).toBe(true);
		expect(canViewEntity('guest', 'household')).toBe(true);
	});

	it('canViewEntity adults visibility: only admin/adult can see', () => {
		expect(canViewEntity('admin', 'adults')).toBe(true);
		expect(canViewEntity('adult', 'adults')).toBe(true);
		expect(canViewEntity('child', 'adults')).toBe(false);
		expect(canViewEntity('guest', 'adults')).toBe(false);
	});

	it('canViewEntity private visibility: only admin or creator', () => {
		expect(canViewEntity('admin', 'private', 'user-1', 'user-2')).toBe(true);
		expect(canViewEntity('adult', 'private', 'user-1', 'user-1')).toBe(true);
		expect(canViewEntity('adult', 'private', 'user-1', 'user-2')).toBe(false);
		expect(canViewEntity('guest', 'private', 'user-1', 'user-2')).toBe(false);
	});

	it('isAtLeast follows role hierarchy', () => {
		expect(isAtLeast('admin', 'admin')).toBe(true);
		expect(isAtLeast('admin', 'adult')).toBe(true);
		expect(isAtLeast('admin', 'child')).toBe(true);
		expect(isAtLeast('admin', 'guest')).toBe(true);

		expect(isAtLeast('adult', 'child')).toBe(true);
		expect(isAtLeast('adult', 'admin')).toBe(false);

		expect(isAtLeast('child', 'guest')).toBe(true);
		expect(isAtLeast('child', 'adult')).toBe(false);
	});

	it('getRoleLevel returns expected numeric levels', () => {
		expect(getRoleLevel('admin')).toBe(100);
		expect(getRoleLevel('adult')).toBe(50);
		expect(getRoleLevel('child')).toBe(20);
		expect(getRoleLevel('guest')).toBe(10);
	});
});
