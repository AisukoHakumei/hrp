import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import {
	assets,
	documents,
	expenses,
	knowledgeArticles,
	maintenanceSchedules,
	projects,
	rooms,
	tasks
} from '$lib/server/db/schema/index.js';
import { and, eq, or, sql } from 'drizzle-orm';

type SearchType =
	| 'project'
	| 'task'
	| 'asset'
	| 'room'
	| 'document'
	| 'knowledge'
	| 'maintenance'
	| 'expense';

type SearchResult = {
	id: string;
	label: string;
	type: SearchType;
	href: string;
	snippet: string;
	relevanceScore: number;
};

const validTypeFilters: SearchType[] = [
	'project',
	'task',
	'asset',
	'room',
	'document',
	'knowledge',
	'maintenance',
	'expense'
];

function getRelevanceScore(label: string, query: string): number {
	const value = label.toLowerCase();
	if (value === query) return 3;
	if (value.startsWith(query)) return 2;
	if (value.includes(query)) return 1;
	return 0;
}

function trimToWordBoundary(value: string): string {
	if (value.length <= 120) return value;
	const truncated = value.slice(0, 120);
	const lastSpace = truncated.lastIndexOf(' ');
	if (lastSpace > 0) {
		return truncated.slice(0, lastSpace);
	}
	return truncated;
}

function getSnippet(content: string | null, query: string): string {
	if (!content) return '';
	const normalizedContent = content.trim();
	if (!normalizedContent) return '';

	const lowerContent = normalizedContent.toLowerCase();
	const index = lowerContent.indexOf(query);
	const start = index >= 0 ? index : 0;
	const end = Math.min(start + 120, normalizedContent.length);
	const rawSnippet = normalizedContent.slice(start, end).trim();
	const trimmedSnippet = trimToWordBoundary(rawSnippet);

	if (!trimmedSnippet) return '';

	const prefix = start > 0 ? '...' : '';
	const suffix = end < normalizedContent.length ? '...' : '';
	return `${prefix}${trimmedSnippet}${suffix}`;
}

export const load = async ({ url, locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	const query = (url.searchParams.get('q') ?? '').toLowerCase();
	const rawTypeFilter = url.searchParams.get('type') ?? '';
	const typeFilter = validTypeFilters.includes(rawTypeFilter as SearchType)
		? (rawTypeFilter as SearchType)
		: '';

	if (!householdId || !query) {
		return {
			query,
			typeFilter,
			resultCount: 0,
			results: [] as SearchResult[]
		};
	}

	const term = `%${query}%`;
	const results: SearchResult[] = [];

	if (!typeFilter || typeFilter === 'project') {
		const projectMatches = db
			.select({ id: projects.id, label: projects.name, snippetSource: projects.description })
			.from(projects)
			.where(
				and(
					eq(projects.householdId, householdId),
					or(
						sql`lower(${projects.name}) like ${term}`,
						sql`lower(${projects.description}) like ${term}`
					)
				)
			)
			.limit(10)
			.all()
			.map((item) => ({
				id: item.id,
				label: item.label,
				type: 'project' as const,
				href: `/projects/${item.id}`,
				snippet: getSnippet(item.snippetSource, query),
				relevanceScore: getRelevanceScore(item.label, query)
			}));

		results.push(...projectMatches);
	}

	if (!typeFilter || typeFilter === 'task') {
		const taskMatches = db
			.select({ id: tasks.id, label: tasks.title, snippetSource: tasks.description })
			.from(tasks)
			.where(
				and(
					eq(tasks.householdId, householdId),
					or(sql`lower(${tasks.title}) like ${term}`, sql`lower(${tasks.description}) like ${term}`)
				)
			)
			.limit(10)
			.all()
			.map((item) => ({
				id: item.id,
				label: item.label,
				type: 'task' as const,
				href: '/tasks',
				snippet: getSnippet(item.snippetSource, query),
				relevanceScore: getRelevanceScore(item.label, query)
			}));

		results.push(...taskMatches);
	}

	if (!typeFilter || typeFilter === 'asset') {
		const assetMatches = db
			.select({ id: assets.id, label: assets.name, snippetSource: assets.description })
			.from(assets)
			.where(
				and(
					eq(assets.householdId, householdId),
					or(sql`lower(${assets.name}) like ${term}`, sql`lower(${assets.description}) like ${term}`)
				)
			)
			.limit(10)
			.all()
			.map((item) => ({
				id: item.id,
				label: item.label,
				type: 'asset' as const,
				href: `/assets/${item.id}`,
				snippet: getSnippet(item.snippetSource, query),
				relevanceScore: getRelevanceScore(item.label, query)
			}));

		results.push(...assetMatches);
	}

	if (!typeFilter || typeFilter === 'room') {
		const roomMatches = db
			.select({ id: rooms.id, label: rooms.name, snippetSource: rooms.description })
			.from(rooms)
			.where(
				and(
					eq(rooms.householdId, householdId),
					or(sql`lower(${rooms.name}) like ${term}`, sql`lower(${rooms.description}) like ${term}`)
				)
			)
			.limit(10)
			.all()
			.map((item) => ({
				id: item.id,
				label: item.label,
				type: 'room' as const,
				href: `/rooms/${item.id}`,
				snippet: getSnippet(item.snippetSource, query),
				relevanceScore: getRelevanceScore(item.label, query)
			}));

		results.push(...roomMatches);
	}

	if (!typeFilter || typeFilter === 'document') {
		const documentMatches = db
			.select({ id: documents.id, label: documents.title, snippetSource: documents.description })
			.from(documents)
			.where(
				and(
					eq(documents.householdId, householdId),
					or(
						sql`lower(${documents.title}) like ${term}`,
						sql`lower(${documents.description}) like ${term}`
					)
				)
			)
			.limit(10)
			.all()
			.map((item) => ({
				id: item.id,
				label: item.label,
				type: 'document' as const,
				href: '/documents',
				snippet: getSnippet(item.snippetSource, query),
				relevanceScore: getRelevanceScore(item.label, query)
			}));

		results.push(...documentMatches);
	}

	if (!typeFilter || typeFilter === 'knowledge') {
		const knowledgeMatches = db
			.select({
				id: knowledgeArticles.id,
				label: knowledgeArticles.title,
				snippetSource: knowledgeArticles.content
			})
			.from(knowledgeArticles)
			.where(
				and(
					eq(knowledgeArticles.householdId, householdId),
					or(
						sql`lower(${knowledgeArticles.title}) like ${term}`,
						sql`lower(${knowledgeArticles.content}) like ${term}`
					)
				)
			)
			.limit(10)
			.all()
			.map((item) => ({
				id: item.id,
				label: item.label,
				type: 'knowledge' as const,
				href: '/knowledge',
				snippet: getSnippet(item.snippetSource, query),
				relevanceScore: getRelevanceScore(item.label, query)
			}));

		results.push(...knowledgeMatches);
	}

	if (!typeFilter || typeFilter === 'maintenance') {
		const maintenanceMatches = db
			.select({
				id: maintenanceSchedules.id,
				label: maintenanceSchedules.name,
				snippetSource: maintenanceSchedules.description
			})
			.from(maintenanceSchedules)
			.where(
				and(
					eq(maintenanceSchedules.householdId, householdId),
					or(
						sql`lower(${maintenanceSchedules.name}) like ${term}`,
						sql`lower(${maintenanceSchedules.description}) like ${term}`
					)
				)
			)
			.limit(10)
			.all()
			.map((item) => ({
				id: item.id,
				label: item.label,
				type: 'maintenance' as const,
				href: '/maintenance',
				snippet: getSnippet(item.snippetSource, query),
				relevanceScore: getRelevanceScore(item.label, query)
			}));

		results.push(...maintenanceMatches);
	}

	if (!typeFilter || typeFilter === 'expense') {
		const expenseMatches = db
			.select({
				id: expenses.id,
				label: expenses.description,
				snippetSource: expenses.description
			})
			.from(expenses)
			.where(
				and(
					eq(expenses.householdId, householdId),
					or(
						sql`lower(${expenses.description}) like ${term}`,
						sql`lower(${expenses.vendor}) like ${term}`
					)
				)
			)
			.limit(10)
			.all()
			.map((item) => ({
				id: item.id,
				label: item.label,
				type: 'expense' as const,
				href: '/finances',
				snippet: getSnippet(item.snippetSource, query),
				relevanceScore: getRelevanceScore(item.label, query)
			}));

		results.push(...expenseMatches);
	}

	const sortedResults = [...results].sort((a, b) => {
		if (b.relevanceScore !== a.relevanceScore) {
			return b.relevanceScore - a.relevanceScore;
		}
		return a.label.localeCompare(b.label);
	});

	return {
		query,
		typeFilter,
		resultCount: sortedResults.length,
		results: sortedResults
	};
};
