import { error, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { db } from '$lib/server/db/index.js';
import { maintenanceSchedules, projects, tasks } from '$lib/server/db/schema/index.js';
import { and, eq, isNotNull } from 'drizzle-orm';

function getISOWeek(date: Date): number {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export const load = async ({ locals, url }: RequestEvent) => {
	const now = new Date();
	const viewParam = url.searchParams.get('view');
	const view = viewParam === 'week' ? 'week' : 'month';
	const monthParam = Number(url.searchParams.get('month'));
	const yearParam = Number(url.searchParams.get('year'));
	const weekParam = Number(url.searchParams.get('week'));
	const month = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getMonth() + 1;
	const year = Number.isInteger(yearParam) && yearParam >= 1 ? yearParam : now.getFullYear();
	const week = Number.isInteger(weekParam) && weekParam >= 1 && weekParam <= 53 ? weekParam : getISOWeek(now);

	const householdId = locals.user?.householdId;
	if (!householdId) {
		return {
			events: [],
			view,
			month,
			year,
			week
		};
	}
	if (!hasModuleAccess(locals.user?.role ?? 'guest', 'calendar', 'view')) {
		error(403, 'Forbidden');
	}

	const taskEvents = db
		.select({ id: tasks.id, name: tasks.title, date: tasks.dueDate })
		.from(tasks)
		.where(and(eq(tasks.householdId, householdId), isNotNull(tasks.dueDate)))
		.all()
		.map((task) => ({
			id: task.id,
			name: task.name,
			date: task.date,
			type: 'task'
		}));

	const maintenanceEvents = db
		.select({ id: maintenanceSchedules.id, name: maintenanceSchedules.name, date: maintenanceSchedules.nextDueDate })
		.from(maintenanceSchedules)
		.where(and(eq(maintenanceSchedules.householdId, householdId), isNotNull(maintenanceSchedules.nextDueDate)))
		.all()
		.map((item) => ({
			id: item.id,
			name: item.name,
			date: item.date,
			type: 'maintenance'
		}));

	const projectEvents = db
		.select({
			id: projects.id,
			name: projects.name,
			startDate: projects.startDate,
			targetEndDate: projects.endDate
		})
		.from(projects)
		.where(eq(projects.householdId, householdId))
		.all()
		.flatMap((project) => {
			const events: Array<{ id: string; name: string; date: string; type: 'project' }> = [];
			if (project.startDate) {
				events.push({
					id: `${project.id}-start`,
					name: project.name,
					date: project.startDate,
					type: 'project'
				});
			}
			if (project.targetEndDate) {
				events.push({
					id: `${project.id}-end`,
					name: project.name,
					date: project.targetEndDate,
					type: 'project'
				});
			}
			return events;
		});

	return {
		events: [...taskEvents, ...maintenanceEvents, ...projectEvents],
		view,
		month,
		year,
		week
	};
};
