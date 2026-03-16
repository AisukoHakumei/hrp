import { error, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import {
	assets,
	budgets,
	expenses,
	knowledgeArticles,
	maintenanceSchedules,
	projects,
	rooms,
	tasks,
	users
} from '$lib/server/db/schema/index.js';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { eq } from 'drizzle-orm';

type ModuleName = 'projects' | 'tasks' | 'assets' | 'rooms' | 'expenses' | 'budgets' | 'maintenance' | 'knowledge';

const MODULE_PERMISSION_MAP: Record<ModuleName, string> = {
	projects: 'projects',
	tasks: 'tasks',
	assets: 'assets',
	rooms: 'rooms',
	expenses: 'finances',
	budgets: 'finances',
	maintenance: 'maintenance',
	knowledge: 'knowledge'
};

function queryModule(moduleName: ModuleName, householdId: string) {
	const userMap = new Map<string, string>();
	const allUsers = db.select({ id: users.id, name: users.name }).from(users).where(eq(users.householdId, householdId)).all();
	for (const u of allUsers) userMap.set(u.id, u.name);

	const getCreatorName = (createdBy: string | null) => createdBy ? (userMap.get(createdBy) ?? '') : '';

	switch (moduleName) {
		case 'projects':
			return db.select().from(projects).where(eq(projects.householdId, householdId)).all().map((r) => ({
				name: r.name, description: r.description ?? '', type: r.type, status: r.status,
				priority: r.priority, startDate: r.startDate ?? '', endDate: r.endDate ?? '',
				budgetAmount: r.budgetAmount ?? '', budgetCurrency: r.budgetCurrency ?? '',
				progressPercent: r.progressPercent, notes: r.notes ?? '',
				createdByName: getCreatorName(r.createdBy), createdAt: r.createdAt
			}));
		case 'tasks':
			return db.select().from(tasks).where(eq(tasks.householdId, householdId)).all().map((r) => ({
				title: r.title, description: r.description ?? '', status: r.status,
				priority: r.priority, dueDate: r.dueDate ?? '', startDate: r.startDate ?? '',
				assigneeName: r.assigneeId ? (userMap.get(r.assigneeId) ?? '') : '',
				estimatedMinutes: r.estimatedMinutes ?? '', actualMinutes: r.actualMinutes ?? '',
				isRecurring: r.isRecurring, recurrenceRule: r.recurrenceRule ?? '',
				createdByName: getCreatorName(r.createdBy), createdAt: r.createdAt
			}));
		case 'assets':
			return db.select().from(assets).where(eq(assets.householdId, householdId)).all().map((r) => ({
				name: r.name, description: r.description ?? '', category: r.category, status: r.status,
				manufacturer: r.manufacturer ?? '', model: r.model ?? '', serialNumber: r.serialNumber ?? '',
				purchaseDate: r.purchaseDate ?? '', purchasePrice: r.purchasePrice ?? '',
				purchaseCurrency: r.purchaseCurrency ?? '', purchaseFrom: r.purchaseFrom ?? '',
				warrantyExpiresAt: r.warrantyExpiresAt ?? '', currentValue: r.currentValue ?? '',
				notes: r.notes ?? '', createdByName: getCreatorName(r.createdBy), createdAt: r.createdAt
			}));
		case 'rooms':
			return db.select().from(rooms).where(eq(rooms.householdId, householdId)).all().map((r) => ({
				name: r.name, description: r.description ?? '', type: r.type,
				area: r.area ?? '', createdByName: getCreatorName(r.createdBy), createdAt: r.createdAt
			}));
		case 'expenses':
			return db.select().from(expenses).where(eq(expenses.householdId, householdId)).all().map((r) => ({
				description: r.description, amount: r.amount, currency: r.currency, date: r.date,
				vendor: r.vendor ?? '', paymentMethod: r.paymentMethod ?? '',
				invoiceNumber: r.invoiceNumber ?? '', isIncome: r.isIncome, isRefund: r.isRefund,
				notes: r.notes ?? '', createdByName: getCreatorName(r.createdBy), createdAt: r.createdAt
			}));
		case 'budgets':
			return db.select().from(budgets).where(eq(budgets.householdId, householdId)).all().map((r) => ({
				name: r.name, description: r.description ?? '', totalAmount: r.totalAmount,
				currency: r.currency, startDate: r.startDate ?? '', endDate: r.endDate ?? '',
				createdByName: getCreatorName(r.createdBy), createdAt: r.createdAt
			}));
		case 'maintenance':
			return db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.householdId, householdId)).all().map((r) => ({
				name: r.name, description: r.description ?? '', frequency: r.frequency,
				nextDueDate: r.nextDueDate, lastCompletedDate: r.lastCompletedDate ?? '',
				estimatedCost: r.estimatedCost ?? '', isActive: r.isActive,
				createdByName: getCreatorName(r.createdBy), createdAt: r.createdAt
			}));
		case 'knowledge':
			return db.select().from(knowledgeArticles).where(eq(knowledgeArticles.householdId, householdId)).all().map((r) => ({
				title: r.title, content: r.content, excerpt: r.excerpt ?? '',
				category: r.category, isPinned: r.isPinned,
				createdByName: getCreatorName(r.createdBy), createdAt: r.createdAt
			}));
	}
}

function toCsv(rows: Record<string, unknown>[]): string {
	if (rows.length === 0) return '';
	const headers = Object.keys(rows[0]);
	const escape = (val: unknown): string => {
		const str = String(val ?? '');
		if (str.includes(',') || str.includes('"') || str.includes('\n')) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	};
	const lines = [headers.join(',')];
	for (const row of rows) {
		lines.push(headers.map((h) => escape(row[h])).join(','));
	}
	return lines.join('\n');
}

export const GET = async ({ url, locals }: RequestEvent) => {
	const user = locals.user;
	if (!user) error(401, 'Not authenticated');

	const moduleName = url.searchParams.get('module') as ModuleName | null;
	const format = url.searchParams.get('format') ?? 'json';

	if (!moduleName || !MODULE_PERMISSION_MAP[moduleName]) {
		error(400, 'Invalid module parameter');
	}

	if (!hasModuleAccess(user.role, MODULE_PERMISSION_MAP[moduleName] as Parameters<typeof hasModuleAccess>[1], 'view')) {
		error(403, 'Not authorized');
	}

	const rows = queryModule(moduleName, user.householdId);
	const dateStr = new Date().toISOString().slice(0, 10);
	const filename = `${moduleName}-${dateStr}`;

	if (format === 'csv') {
		const csv = toCsv(rows);
		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="${filename}.csv"`
			}
		});
	}

	return new Response(JSON.stringify(rows, null, 2), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}.json"`
		}
	});
};
