import { writable, derived, get } from 'svelte/store';
import { en } from './en.js';
import { fr } from './fr.js';

export type Locale = 'en' | 'fr';

/** Deep string type — same structure as en, but values are just `string` */
type DeepStringify<T> = {
	[K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};
export type Translations = DeepStringify<typeof en>;
export type TranslationKeys = typeof en;

const translations: Record<Locale, Translations> = { en, fr };

/** Current locale store */
export const locale = writable<Locale>('en');

/** Derived translations store */
export const t = derived(locale, ($locale) => translations[$locale]);

/** Get a nested translation value by dot-separated key */
export function translate(key: string, params?: Record<string, string | number>): string {
	const currentLocale = get(locale);
	const keys = key.split('.');
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let value: any = translations[currentLocale];

	for (const k of keys) {
		value = value?.[k];
		if (value === undefined) return key; // fallback to key
	}

	if (typeof value !== 'string') return key;

	// Simple parameter substitution: {name} → value
	if (params) {
		return value.replace(/\{(\w+)\}/g, (_, param) => String(params[param] ?? `{${param}}`));
	}

	return value;
}

/** Set locale and persist in cookie */
export function setLocale(newLocale: Locale) {
	locale.set(newLocale);
	if (typeof document !== 'undefined') {
		document.cookie = `locale=${newLocale};path=/;max-age=${365 * 24 * 60 * 60}`;
		document.documentElement.lang = newLocale;
	}
}

/** Available locales */
export const LOCALES: { value: Locale; label: string }[] = [
	{ value: 'en', label: 'English' },
	{ value: 'fr', label: 'Français' }
];
