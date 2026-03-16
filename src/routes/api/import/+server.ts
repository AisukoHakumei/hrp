import { json, error, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import {
	assets,
	budgets,
	expenses,
	knowledgeArticles,
	maintenanceSchedules,
	projects,
	rooms,
	tasks
} from '$lib/server/db/schema/index.js';
import { createId } from '$lib/server/db/schema/common.js';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { writeAuditLog } from '$lib/server/audit.js';

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

const REQUIRED_FIELDS: Record<ModuleName, string[]> = {
	projects: ['name'],
	tasks: ['title'],
	assets: ['name'],
	rooms: ['name'],
	expenses: ['description', 'amount', 'date'],
	budgets: ['name', 'totalAmount'],
	maintenance: ['name', 'nextDueDate'],
	knowledge: ['title', 'content']
};

function parseCsv(text: string): Record<string, string>[] {
	const lines = text.split('\n').filter((l) => l.trim());
	if (lines.length < 2) return [];

	const headers = parseCsvLine(lines[0]);
	const rows: Record<string, string>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = parseCsvLine(lines[i]);
		const row: Record<string, string> = {};
		for (let j = 0; j < headers.length; j++) {
			row[headers[j]] = values[j] ?? '';
		}
		rows.push(row);
	}

	return rows;
}

function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"') {
				if (i + 1 < line.length && line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ',') {
			result.push(current.trim());
			current = '';
		} else {
			current += ch;
		}
	}
	result.push(current.trim());
	return result;
}

function insertRow(moduleName: ModuleName, row: Record<string, string>, householdId: string, userId: string): boolean {
	const now = new Date().toISOString();

	switch (moduleName) {
		case 'projects':
			db.insert(projects).values({
				id: createId(), householdId, createdBy: userId,
				name: row.name, description: row.description || null,
				type: (row.type as 'renovation' | 'repair' | 'installation' | 'decoration' | 'landscaping' | 'construction' | 'administrative' | 'other') || 'other',
				status: (row.status as 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled') || 'planning',
				priority: (row.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
				startDate: row.startDate || null, endDate: row.endDate || null,
				budgetAmount: row.budgetAmount ? parseFloat(row.budgetAmount) : null,
				budgetCurrency: row.budgetCurrency || 'EUR',
				progressPercent: row.progressPercent ? parseInt(row.progressPercent, 10) : 0,
				notes: row.notes || null
			}).run();
			return true;

		case 'tasks':
			db.insert(tasks).values({
				id: createId(), householdId, createdBy: userId,
				title: row.title, description: row.description || null,
				status: (row.status as 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled') || 'todo',
				priority: (row.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
				dueDate: row.dueDate || null, startDate: row.startDate || null,
				estimatedMinutes: row.estimatedMinutes ? parseInt(row.estimatedMinutes, 10) : null,
				isRecurring: row.isRecurring === 'true',
				recurrenceRule: row.recurrenceRule || null
			}).run();
			return true;

		case 'assets':
			db.insert(assets).values({
				id: createId(), householdId, createdBy: userId,
				name: row.name, description: row.description || null,
				category: (row.category as 'appliance' | 'furniture' | 'tool' | 'vehicle' | 'electronics' | 'building_component' | 'subscription' | 'contract' | 'other') || 'other',
				status: (row.status as 'active' | 'stored' | 'broken' | 'maintenance' | 'disposed' | 'sold') || 'active',
				manufacturer: row.manufacturer || null, model: row.model || null,
				serialNumber: row.serialNumber || null,
				purchaseDate: row.purchaseDate || null,
				purchasePrice: row.purchasePrice ? parseFloat(row.purchasePrice) : null,
				purchaseCurrency: row.purchaseCurrency || 'EUR',
				purchaseFrom: row.purchaseFrom || null,
				warrantyExpiresAt: row.warrantyExpiresAt || null,
				currentValue: row.currentValue ? parseFloat(row.currentValue) : null,
				notes: row.notes || null
			}).run();
			return true;

		case 'rooms':
			db.insert(rooms).values({
				id: createId(), householdId, createdBy: userId,
				name: row.name, description: row.description || null,
				type: (row.type as 'room' | 'hallway' | 'bathroom' | 'kitchen' | 'garage' | 'garden' | 'attic' | 'basement' | 'balcony' | 'storage' | 'other') || 'room',
				area: row.area ? parseFloat(row.area) : null
			}).run();
			return true;

		case 'expenses':
			db.insert(expenses).values({
				id: createId(), householdId, createdBy: userId,
				description: row.description, amount: parseFloat(row.amount),
				currency: row.currency || 'EUR', date: row.date,
				vendor: row.vendor || null,
				paymentMethod: (row.paymentMethod as 'cash' | 'card' | 'transfer' | 'check' | 'other') || null,
				invoiceNumber: row.invoiceNumber || null,
				isIncome: row.isIncome === 'true', isRefund: row.isRefund === 'true',
				notes: row.notes || null
			}).run();
			return true;

		case 'budgets':
			db.insert(budgets).values({
				id: createId(), householdId, createdBy: userId,
				name: row.name, description: row.description || null,
				totalAmount: parseFloat(row.totalAmount),
				currency: row.currency || 'EUR',
				startDate: row.startDate || null, endDate: row.endDate || null
			}).run();
			return true;

		case 'maintenance':
			db.insert(maintenanceSchedules).values({
				id: createId(), householdId, createdBy: userId,
				name: row.name, description: row.description || null,
				frequency: (row.frequency as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannual' | 'yearly' | 'custom') || 'yearly',
				nextDueDate: row.nextDueDate,
				lastCompletedDate: row.lastCompletedDate || null,
				estimatedCost: row.estimatedCost ? parseFloat(row.estimatedCost) : null,
				isActive: row.isActive !== 'false'
			}).run();
			return true;

		case 'knowledge':
			db.insert(knowledgeArticles).values({
				id: createId(), householdId, createdBy: userId,
				title: row.title, content: row.content,
				excerpt: row.excerpt || null,
				category: (row.category as 'note' | 'procedure' | 'howto' | 'reference' | 'troubleshooting' | 'other') || 'note',
				isPinned: row.isPinned === 'true'
			}).run();
			return true;
	}
}

export const POST = async ({ request, url, locals }: RequestEvent) => {
	const user = locals.user;
	if (!user) error(401, 'Not authenticated');

	const moduleName = url.searchParams.get('module') as ModuleName | null;
	const format = url.searchParams.get('format') ?? 'json';

	if (!moduleName || !MODULE_PERMISSION_MAP[moduleName]) {
		error(400, 'Invalid module parameter');
	}

	if (!hasModuleAccess(user.role, MODULE_PERMISSION_MAP[moduleName] as Parameters<typeof hasModuleAccess>[1], 'create')) {
		error(403, 'Not authorized');
	}

	const formData = await request.formData();
	const file = formData.get('file');
	if (!(file instanceof File) || file.size === 0) {
		error(400, 'No file provided');
	}

	const text = await file.text();
	let rows: Record<string, string>[];

	if (format === 'csv') {
		rows = parseCsv(text);
	} else {
		try {
			const parsed = JSON.parse(text);
			rows = Array.isArray(parsed) ? parsed : [parsed];
		} catch {
			error(400, 'Invalid JSON');
		}
	}

	const required = REQUIRED_FIELDS[moduleName];
	let imported = 0;
	let skipped = 0;
	const errors: string[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const missingFields = required.filter((f) => !row[f]?.trim());

		if (missingFields.length > 0) {
			errors.push(`Row ${i + 1}: missing ${missingFields.join(', ')}`);
			skipped++;
			continue;
		}

		try {
			insertRow(moduleName, row, user.householdId, user.id);
			imported++;
		} catch (err) {
			errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'insert failed'}`);
			skipped++;
		}
	}

	const AUDIT_ENTITY_MAP: Record<ModuleName, 'project' | 'task' | 'asset' | 'room' | 'expense' | 'budget' | 'maintenance' | 'knowledge'> = {
		projects: 'project', tasks: 'task', assets: 'asset', rooms: 'room',
		expenses: 'expense', budgets: 'budget', maintenance: 'maintenance', knowledge: 'knowledge'
	};

	writeAuditLog({
		userId: user.id,
		userName: user.name,
		entityType: AUDIT_ENTITY_MAP[moduleName],
		entityId: 'import',
		action: 'create',
		after: { imported, skipped }
	});

	return json({ imported, skipped, errors });
};
