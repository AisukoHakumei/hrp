import { error, fail, type Actions, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { db } from '$lib/server/db/index.js';
import { budgetLines, budgets, expenseCategories, expenses, projects } from '$lib/server/db/schema/index.js';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { writeAuditLog } from '$lib/server/audit.js';
import { emitEntityEvent } from '$lib/server/events.js';


export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		return {
			expenses: [],
			budgets: [],
			categoryList: [],
			projects: []
		};
	}
	if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'view')) {
		error(403, 'Forbidden');
	}

	const budgetList = db.select().from(budgets).where(eq(budgets.householdId, householdId)).all();
	const recentExpenses = db
		.select()
		.from(expenses)
		.where(eq(expenses.householdId, householdId))
		.orderBy(desc(expenses.date))
		.limit(20)
		.all();
	const categoryList = db
		.select()
		.from(expenseCategories)
		.where(eq(expenseCategories.householdId, householdId))
		.all();

	const projectList = db.select().from(projects).where(eq(projects.householdId, householdId)).all();

	const projectIds = budgetList
		.map((budget) => budget.projectId)
		.filter((projectId): projectId is string => Boolean(projectId));
	const projectRows =
		projectIds.length > 0
			? db.select().from(projects).where(and(eq(projects.householdId, householdId), inArray(projects.id, projectIds))).all()
			: [];
	const projectById = new Map(projectRows.map((project) => [project.id, project]));

	const budgetIds = budgetList.map((budget) => budget.id);
	const allBudgetLines =
		budgetIds.length > 0 ? db.select().from(budgetLines).where(inArray(budgetLines.budgetId, budgetIds)).all() : [];
	const linesByBudget = new Map<string, typeof allBudgetLines>();
	for (const line of allBudgetLines) {
		const existing = linesByBudget.get(line.budgetId) ?? [];
		existing.push(line);
		linesByBudget.set(line.budgetId, existing);
	}

	const enrichedBudgets = budgetList.map((budget) => {
		const spentByBudget = db
			.select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
			.from(expenses)
			.where(and(eq(expenses.householdId, householdId), eq(expenses.budgetId, budget.id)))
			.get();

		const spentByProject = budget.projectId
			? db
					.select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
					.from(expenses)
					.where(and(eq(expenses.householdId, householdId), eq(expenses.projectId, budget.projectId)))
					.get()
			: null;

		return {
			...budget,
			spent: spentByBudget?.total || spentByProject?.total || 0,
			project: budget.projectId ? (projectById.get(budget.projectId) ?? null) : null,
			lines: (linesByBudget.get(budget.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
		};
	});

	return {
		expenses: recentExpenses,
		budgets: enrichedBudgets,
		categoryList,
		projects: projectList
	};
};

export const actions: Actions = {
	createExpense: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const description = String(formData.get('description') ?? '').trim();
		if (!description) return fail(400, { invalid: true });

		const amountRaw = String(formData.get('amount') ?? '').trim();
		if (!amountRaw) return fail(400, { invalid: true });
		const amount = Number(amountRaw);
		if (isNaN(amount)) return fail(400, { invalid: true });

		const date = String(formData.get('date') ?? '').trim();
		if (!date) return fail(400, { invalid: true });

		const categoryId = String(formData.get('categoryId') ?? '').trim() || null;
		const projectId = String(formData.get('projectId') ?? '').trim() || null;
		const paymentMethod = String(formData.get('paymentMethod') ?? '').trim() || null;
		const vendor = String(formData.get('vendor') ?? '').trim() || null;

		const created = db
			.insert(expenses)
			.values({
				householdId,
				description,
				amount,
				date,
				categoryId,
				projectId,
				paymentMethod: paymentMethod as typeof expenses.$inferInsert.paymentMethod,
				vendor,
				createdBy: locals.user?.id
			})
			.returning({ id: expenses.id })
			.get();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'expense',
			entityId: created.id,
			action: 'create'
		});

		emitEntityEvent(householdId, 'entity_created', 'expense', created.id, locals.user?.id ?? '');

		return { created: true };
	},

	deleteExpense: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(expenses)
			.where(and(eq(expenses.id, id), eq(expenses.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'expense',
			entityId: id,
			action: 'delete'
		});

		emitEntityEvent(householdId, 'entity_deleted', 'expense', id, locals.user?.id ?? '');

		return { deleted: true };
	},

	bulkDeleteExpense: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const ids = String(formData.get('ids') ?? '')
			.split(',')
			.filter(Boolean);
		if (ids.length === 0) return fail(400, { invalid: true });

		db.delete(expenses)
			.where(and(eq(expenses.householdId, householdId), inArray(expenses.id, ids)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'expense',
			entityId: `bulk:${ids.length}`,
			action: 'delete'
		});

		for (const id of ids) {
			emitEntityEvent(householdId, 'entity_deleted', 'expense', id, locals.user?.id ?? '');
		}

		return { deleted: true };
	},

	updateExpense: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const description = String(formData.get('description') ?? '').trim();
		if (!description) return fail(400, { invalid: true });

		const amountRaw = String(formData.get('amount') ?? '').trim();
		if (!amountRaw) return fail(400, { invalid: true });
		const amount = Number(amountRaw);
		if (isNaN(amount)) return fail(400, { invalid: true });

		const date = String(formData.get('date') ?? '').trim();
		if (!date) return fail(400, { invalid: true });

		const categoryId = String(formData.get('categoryId') ?? '').trim() || null;
		const projectId = String(formData.get('projectId') ?? '').trim() || null;
		const paymentMethod = String(formData.get('paymentMethod') ?? '').trim() || null;
		const vendor = String(formData.get('vendor') ?? '').trim() || null;

		db.update(expenses)
			.set({
				description,
				amount,
				date,
				categoryId,
				projectId,
				paymentMethod: paymentMethod as typeof expenses.$inferInsert.paymentMethod,
				vendor
			})
			.where(and(eq(expenses.id, id), eq(expenses.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'expense',
			entityId: id,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'expense', id, locals.user?.id ?? '');

		return { updated: true };
	},

	createBudget: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const totalAmountRaw = String(formData.get('totalAmount') ?? '').trim();
		if (!totalAmountRaw) return fail(400, { invalid: true });
		const totalAmount = Number(totalAmountRaw);
		if (isNaN(totalAmount)) return fail(400, { invalid: true });

		const projectId = String(formData.get('projectId') ?? '').trim() || null;
		const startDate = String(formData.get('startDate') ?? '').trim() || null;
		const endDate = String(formData.get('endDate') ?? '').trim() || null;

		const created = db
			.insert(budgets)
			.values({
				householdId,
				name,
				totalAmount,
				projectId,
				startDate,
				endDate,
				createdBy: locals.user?.id
			})
			.returning({ id: budgets.id })
			.get();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'budget',
			entityId: created.id,
			action: 'create'
		});

		emitEntityEvent(householdId, 'entity_created', 'budget', created.id, locals.user?.id ?? '');

		return { created: true };
	},

	deleteBudget: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(budgets)
			.where(and(eq(budgets.id, id), eq(budgets.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'budget',
			entityId: id,
			action: 'delete'
		});

		emitEntityEvent(householdId, 'entity_deleted', 'budget', id, locals.user?.id ?? '');

		return { deleted: true };
	},

	updateBudget: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const totalAmountRaw = String(formData.get('totalAmount') ?? '').trim();
		if (!totalAmountRaw) return fail(400, { invalid: true });
		const totalAmount = Number(totalAmountRaw);
		if (isNaN(totalAmount)) return fail(400, { invalid: true });

		const projectId = String(formData.get('projectId') ?? '').trim() || null;
		const startDate = String(formData.get('startDate') ?? '').trim() || null;
		const endDate = String(formData.get('endDate') ?? '').trim() || null;

		db.update(budgets)
			.set({ name, totalAmount, projectId, startDate, endDate })
			.where(and(eq(budgets.id, id), eq(budgets.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'budget',
			entityId: id,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'budget', id, locals.user?.id ?? '');

		return { updated: true };
	},

	createBudgetLine: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const budgetId = String(formData.get('budgetId') ?? '').trim();
		if (!budgetId) return fail(400, { invalid: true });

		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const plannedAmountRaw = String(formData.get('plannedAmount') ?? '').trim();
		if (!plannedAmountRaw) return fail(400, { invalid: true });
		const plannedAmount = Number(plannedAmountRaw);
		if (isNaN(plannedAmount)) return fail(400, { invalid: true });

		const categoryId = String(formData.get('categoryId') ?? '').trim() || null;

		db.insert(budgetLines)
			.values({ budgetId, name, plannedAmount, categoryId })
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'budget',
			entityId: budgetId,
			action: 'create'
		});

		return { created: true };
	},

	updateBudgetLine: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const plannedAmountRaw = String(formData.get('plannedAmount') ?? '').trim();
		if (!plannedAmountRaw) return fail(400, { invalid: true });
		const plannedAmount = Number(plannedAmountRaw);
		if (isNaN(plannedAmount)) return fail(400, { invalid: true });

		const categoryId = String(formData.get('categoryId') ?? '').trim() || null;

		db.update(budgetLines)
			.set({ name, plannedAmount, categoryId })
			.where(eq(budgetLines.id, id))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'budget',
			entityId: id,
			action: 'update'
		});

		return { updated: true };
	},

	deleteBudgetLine: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(budgetLines).where(eq(budgetLines.id, id)).run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'budget',
			entityId: id,
			action: 'delete'
		});

		return { deleted: true };
	},

	createCategory: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const icon = String(formData.get('icon') ?? '').trim() || null;
		const color = String(formData.get('color') ?? '').trim() || null;

		const created = db
			.insert(expenseCategories)
			.values({ householdId, name, icon, color })
			.returning({ id: expenseCategories.id })
			.get();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'expense',
			entityId: created.id,
			action: 'create'
		});

		return { created: true };
	},

	updateCategory: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const icon = String(formData.get('icon') ?? '').trim() || null;
		const color = String(formData.get('color') ?? '').trim() || null;

		db.update(expenseCategories)
			.set({ name, icon, color })
			.where(and(eq(expenseCategories.id, id), eq(expenseCategories.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'expense',
			entityId: id,
			action: 'update'
		});

		return { updated: true };
	},

	deleteCategory: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'finances', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(expenseCategories)
			.where(and(eq(expenseCategories.id, id), eq(expenseCategories.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'expense',
			entityId: id,
			action: 'delete'
		});

		return { deleted: true };
	}
};
