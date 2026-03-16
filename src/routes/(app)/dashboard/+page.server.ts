import type { RequestEvent } from '@sveltejs/kit';
import {
	assets,
	documents,
	expenses,
	maintenanceSchedules,
	projects,
	tasks
} from '$lib/server/db/schema/index.js';
import { db } from '$lib/server/db/index.js';
import { and, desc, eq, sql } from 'drizzle-orm';

export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		return {
			activeProjects: [],
			overdueTasks: [],
			budgetSpend: [],
			upcomingMaintenance: [],
			recentDocuments: [],
			assetAlerts: []
		};
	}

	const activeProjects = db
		.select()
		.from(projects)
		.where(and(eq(projects.householdId, householdId), eq(projects.status, 'in_progress')))
		.all();

	const today = new Date().toISOString().slice(0, 10);
	const overdueTasks = db
		.select()
		.from(tasks)
		.where(
			and(
				eq(tasks.householdId, householdId),
				sql`${tasks.dueDate} < ${today}`,
				sql`${tasks.status} NOT IN ('done', 'cancelled')`
			)
		)
		.all();

	const budgetSpend = activeProjects.map((project) => {
		const projectExpenses = db
			.select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
			.from(expenses)
			.where(and(eq(expenses.projectId, project.id), eq(expenses.householdId, householdId)))
			.get();

		return {
			projectId: project.id,
			projectName: project.name,
			spent: projectExpenses?.total ?? 0,
			budget: project.budgetAmount ?? 0
		};
	});

	const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	const upcomingMaintenance = db
		.select()
		.from(maintenanceSchedules)
		.where(
			and(
				eq(maintenanceSchedules.householdId, householdId),
				eq(maintenanceSchedules.isActive, true),
				sql`${maintenanceSchedules.nextDueDate} <= ${thirtyDaysOut}`
			)
		)
		.all();

	const assetAlerts = db
		.select()
		.from(assets)
		.where(
			and(
				eq(assets.householdId, householdId),
				sql`${assets.status} IN ('maintenance', 'broken')`
			)
		)
		.all();

	const recentDocuments = db
		.select()
		.from(documents)
		.where(eq(documents.householdId, householdId))
		.orderBy(desc(documents.createdAt))
		.limit(5)
		.all();

	return {
		activeProjects,
		overdueTasks,
		budgetSpend,
		upcomingMaintenance,
		recentDocuments,
		assetAlerts
	};
};
