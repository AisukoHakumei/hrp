import { describe, expect, it } from 'vitest';
import { en } from '../../src/lib/i18n/en.js';
import { fr } from '../../src/lib/i18n/fr.js';

type Dict = Record<string, unknown>;

function isObject(value: unknown): value is Dict {
	return typeof value === 'object' && value !== null;
}

function collectKeyPaths(value: unknown, prefix = ''): string[] {
	if (!isObject(value)) {
		return [];
	}

	const result: string[] = [];
	for (const [key, nestedValue] of Object.entries(value)) {
		const path = prefix ? `${prefix}.${key}` : key;
		result.push(path);
		result.push(...collectKeyPaths(nestedValue, path));
	}

	return result;
}

function collectEmptyStringPaths(value: unknown, prefix = ''): string[] {
	if (!isObject(value)) {
		return [];
	}

	const result: string[] = [];
	for (const [key, nestedValue] of Object.entries(value)) {
		const path = prefix ? `${prefix}.${key}` : key;

		if (typeof nestedValue === 'string' && nestedValue.trim() === '') {
			result.push(path);
		}

		if (isObject(nestedValue)) {
			result.push(...collectEmptyStringPaths(nestedValue, path));
		}
	}

	return result;
}

function hasPath(value: unknown, targetPath: string): boolean {
	const parts = targetPath.split('.');
	let current: unknown = value;

	for (const part of parts) {
		if (!isObject(current) || !(part in current)) {
			return false;
		}
		current = current[part];
	}

	return true;
}

describe('i18n translations consistency', () => {
	it('all top-level keys in en exist in fr', () => {
		for (const key of Object.keys(en)) {
			expect(key in fr).toBe(true);
		}
	});

	it('all nested keys match recursively between en and fr', () => {
		const enPaths = collectKeyPaths(en);
		const frPaths = collectKeyPaths(fr);

		for (const path of enPaths) {
			expect(hasPath(fr, path)).toBe(true);
		}

		for (const path of frPaths) {
			expect(hasPath(en, path)).toBe(true);
		}
	});

	it('en has no empty string values', () => {
		expect(collectEmptyStringPaths(en)).toEqual([]);
	});

	it('fr has no empty string values', () => {
		expect(collectEmptyStringPaths(fr)).toEqual([]);
	});

	it('critical keys exist', () => {
		const criticalKeys = [
			'nav.dashboard',
			'nav.settings',
			'common.save',
			'common.cancel',
			'auth.login',
			'dashboard.title',
			'projects.status.in_progress',
			'settings.users'
		];

		for (const keyPath of criticalKeys) {
			expect(hasPath(en, keyPath)).toBe(true);
			expect(hasPath(fr, keyPath)).toBe(true);
		}
	});
});
