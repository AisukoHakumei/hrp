import { error, fail, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import {
	assets,
	budgets,
	documents,
	entityTags,
	expenses,
	projectAssets,
	projectDocuments as projectDocumentsTable,
	projectPhases,
	projectRooms,
	projects,
	rooms,
	tags,
	tasks
} from '$lib/server/db/schema/index.js';
import { db } from '$lib/server/db/index.js';
import { and, eq, sql } from 'drizzle-orm';
import { writeAuditLog } from '$lib/server/audit.js';
import { emitEntityEvent } from '$lib/server/events.js';


export const load = async ({ params, locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		error(404, 'Not found');
	}

	const projectId = String(params.id ?? '');
	const project = db
		.select()
		.from(projects)
		.where(and(eq(projects.id, projectId), eq(projects.householdId, householdId)))
		.get();

	if (!project) {
		error(404, 'Not found');
	}

	const projectTasks = db
		.select()
		.from(tasks)
		.where(and(eq(tasks.projectId, project.id), eq(tasks.householdId, householdId)))
		.all();

	const projectBudget = db
		.select()
		.from(budgets)
		.where(and(eq(budgets.projectId, project.id), eq(budgets.householdId, householdId)))
		.get() ?? null;

	const projectExpenses = db
		.select()
		.from(expenses)
		.where(and(eq(expenses.projectId, project.id), eq(expenses.householdId, householdId)))
		.all();

	const totalSpentRow = db
		.select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
		.from(expenses)
		.where(and(eq(expenses.projectId, project.id), eq(expenses.householdId, householdId)))
		.get();

	const projectRoomsList = db
		.select({
			id: rooms.id,
			name: rooms.name,
			type: rooms.type,
			floorPlanId: rooms.floorPlanId,
			area: rooms.area
		})
		.from(projectRooms)
		.innerJoin(rooms, eq(rooms.id, projectRooms.roomId))
		.where(and(eq(projectRooms.projectId, project.id), eq(rooms.householdId, householdId)))
		.all();

	const projectAssetsList = db
		.select({
			id: assets.id,
			name: assets.name,
			category: assets.category,
			status: assets.status,
			roomId: assets.roomId,
			manufacturer: assets.manufacturer,
			model: assets.model,
			purchaseDate: assets.purchaseDate,
			purchasePrice: assets.purchasePrice,
			warrantyExpiresAt: assets.warrantyExpiresAt
		})
		.from(projectAssets)
		.innerJoin(assets, eq(assets.id, projectAssets.assetId))
		.where(and(eq(projectAssets.projectId, project.id), eq(assets.householdId, householdId)))
		.all();

	const projectDocuments = db
		.select({
			id: documents.id,
			title: documents.title,
			description: documents.description,
			type: documents.type,
			fileName: documents.fileName,
			mimeType: documents.mimeType,
			fileSize: documents.fileSize
		})
		.from(projectDocumentsTable)
		.innerJoin(documents, eq(documents.id, projectDocumentsTable.documentId))
		.where(
			and(eq(projectDocumentsTable.projectId, project.id), eq(documents.householdId, householdId))
		)
		.all();

	const allRooms = db
		.select({ id: rooms.id, name: rooms.name })
		.from(rooms)
		.where(eq(rooms.householdId, householdId))
		.all();

	const allAssets = db
		.select({ id: assets.id, name: assets.name })
		.from(assets)
		.where(eq(assets.householdId, householdId))
		.all();

	const allDocuments = db
		.select({ id: documents.id, title: documents.title })
		.from(documents)
		.where(eq(documents.householdId, householdId))
		.all();

	const phases = db
		.select({
			id: projectPhases.id,
			name: projectPhases.name,
			description: projectPhases.description,
			status: projectPhases.status,
			startDate: projectPhases.startDate,
			endDate: projectPhases.endDate,
			sortOrder: projectPhases.sortOrder
		})
		.from(projectPhases)
		.where(eq(projectPhases.projectId, project.id))
		.orderBy(projectPhases.sortOrder)
		.all();

	const allTags = db.select().from(tags).where(eq(tags.householdId, householdId)).all();

	const entityTagsList = db
		.select({ tagId: entityTags.tagId, tagName: tags.name, tagColor: tags.color })
		.from(entityTags)
		.innerJoin(tags, eq(tags.id, entityTags.tagId))
		.where(
			and(
				eq(entityTags.entityType, 'project'),
				eq(entityTags.entityId, project.id),
				eq(tags.householdId, householdId)
			)
		)
		.all();

	return {
		project,
		projectTasks,
		projectExpenses,
		projectRooms: projectRoomsList,
		projectAssets: projectAssetsList,
		projectDocuments,
		projectBudget,
		totalSpent: totalSpentRow?.total ?? 0,
		phases,
		allRooms,
		allAssets,
		allDocuments,
		allTags,
		entityTags: entityTagsList
	};
};

export const actions: Actions = {
	linkRoom: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const projectId = String(formData.get('projectId') ?? '').trim();
		const roomId = String(formData.get('roomId') ?? '').trim();
		if (!projectId || !roomId) return fail(400, { invalid: true });

		db.insert(projectRooms).values({ projectId, roomId }).onConflictDoNothing().run();
		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'project',
			entityId: projectId,
			action: 'update'
		});
		emitEntityEvent(householdId, 'entity_updated', 'project', projectId, locals.user?.id ?? '');
		return { success: true };
	},
	unlinkRoom: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const projectId = String(formData.get('projectId') ?? '').trim();
		const roomId = String(formData.get('roomId') ?? '').trim();
		if (!projectId || !roomId) return fail(400, { invalid: true });

		db.delete(projectRooms)
			.where(and(eq(projectRooms.projectId, projectId), eq(projectRooms.roomId, roomId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'project',
			entityId: projectId,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'project', projectId, locals.user?.id ?? '');

		return { success: true };
	},
	linkAsset: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const projectId = String(formData.get('projectId') ?? '').trim();
		const assetId = String(formData.get('assetId') ?? '').trim();
		const relationshipRaw = String(formData.get('relationship') ?? '').trim();
		const relationship =
			relationshipRaw === 'installed' ||
			relationshipRaw === 'replaced' ||
			relationshipRaw === 'repaired'
				? relationshipRaw
				: 'affected';
		if (!projectId || !assetId) return fail(400, { invalid: true });

		db.insert(projectAssets)
			.values({ projectId, assetId, relationship })
			.onConflictDoNothing()
			.run();
		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'project',
			entityId: projectId,
			action: 'update'
		});
		emitEntityEvent(householdId, 'entity_updated', 'project', projectId, locals.user?.id ?? '');
		return { success: true };
	},
	unlinkAsset: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const projectId = String(formData.get('projectId') ?? '').trim();
		const assetId = String(formData.get('assetId') ?? '').trim();
		if (!projectId || !assetId) return fail(400, { invalid: true });

		db.delete(projectAssets)
			.where(and(eq(projectAssets.projectId, projectId), eq(projectAssets.assetId, assetId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'project',
			entityId: projectId,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'project', projectId, locals.user?.id ?? '');

		return { success: true };
	},
	linkDocument: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const projectId = String(formData.get('projectId') ?? '').trim();
		const documentId = String(formData.get('documentId') ?? '').trim();
		if (!projectId || !documentId) return fail(400, { invalid: true });

		db.insert(projectDocumentsTable)
			.values({ projectId, documentId })
			.onConflictDoNothing()
			.run();
		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'project',
			entityId: projectId,
			action: 'update'
		});
		emitEntityEvent(householdId, 'entity_updated', 'project', projectId, locals.user?.id ?? '');
		return { success: true };
	},
	unlinkDocument: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const projectId = String(formData.get('projectId') ?? '').trim();
		const documentId = String(formData.get('documentId') ?? '').trim();
		if (!projectId || !documentId) return fail(400, { invalid: true });

		db.delete(projectDocumentsTable)
			.where(
				and(
					eq(projectDocumentsTable.projectId, projectId),
					eq(projectDocumentsTable.documentId, documentId)
				)
			)
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'project',
			entityId: projectId,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'project', projectId, locals.user?.id ?? '');

		return { success: true };
	},
	addTag: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const entityId = String(formData.get('entityId') ?? '').trim();
		const tagId = String(formData.get('tagId') ?? '').trim();
		if (!entityId || !tagId) return fail(400, { invalid: true });

		db.insert(entityTags)
			.values({ tagId, entityType: 'project', entityId })
			.onConflictDoNothing()
			.run();
		emitEntityEvent(householdId, 'entity_updated', 'project', entityId, locals.user?.id ?? '');
		return { success: true };
	},
	removeTag: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const entityId = String(formData.get('entityId') ?? '').trim();
		const tagId = String(formData.get('tagId') ?? '').trim();
		if (!entityId || !tagId) return fail(400, { invalid: true });

		db.delete(entityTags)
			.where(
				and(
					eq(entityTags.tagId, tagId),
					eq(entityTags.entityType, 'project'),
					eq(entityTags.entityId, entityId)
				)
			)
			.run();
		emitEntityEvent(householdId, 'entity_updated', 'project', entityId, locals.user?.id ?? '');
		return { success: true };
	},
	createPhase: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const projectId = String(formData.get('projectId') ?? '').trim();
		if (!projectId) return fail(400, { invalid: true });

		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const description = String(formData.get('description') ?? '').trim() || null;
		const status = String(formData.get('status') ?? '').trim() || 'planning';
		const startDate = String(formData.get('startDate') ?? '').trim() || null;
		const endDate = String(formData.get('endDate') ?? '').trim() || null;
		const sortOrderRaw = String(formData.get('sortOrder') ?? '').trim();
		const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;

		db.insert(projectPhases)
			.values({
				projectId,
				name,
				description,
				status: status as 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled',
				startDate,
				endDate,
				sortOrder
			})
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'project',
			entityId: projectId,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'project', projectId, locals.user?.id ?? '');

		return { success: true };
	},
	updatePhase: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const description = String(formData.get('description') ?? '').trim() || null;
		const status = String(formData.get('status') ?? '').trim() || 'planning';
		const startDate = String(formData.get('startDate') ?? '').trim() || null;
		const endDate = String(formData.get('endDate') ?? '').trim() || null;
		const sortOrderRaw = String(formData.get('sortOrder') ?? '').trim();
		const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;

		db.update(projectPhases)
			.set({
				name,
				description,
				status: status as 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled',
				startDate,
				endDate,
				sortOrder
			})
			.where(eq(projectPhases.id, id))
			.run();

		const projectPhase = db.select({ projectId: projectPhases.projectId }).from(projectPhases).where(eq(projectPhases.id, id)).get();
		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'project',
			entityId: projectPhase?.projectId ?? id,
			action: 'update'
		});
		if (projectPhase?.projectId) {
			emitEntityEvent(householdId, 'entity_updated', 'project', projectPhase.projectId, locals.user?.id ?? '');
		}

		return { success: true };
	},
	deletePhase: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const projectPhase = db
			.select({ projectId: projectPhases.projectId })
			.from(projectPhases)
			.where(eq(projectPhases.id, id))
			.get();

		db.delete(projectPhases).where(eq(projectPhases.id, id)).run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'project',
			entityId: projectPhase?.projectId ?? id,
			action: 'update'
		});

		if (projectPhase?.projectId) {
			emitEntityEvent(householdId, 'entity_updated', 'project', projectPhase.projectId, locals.user?.id ?? '');
		}

		return { success: true };
	},
	update: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const description = String(formData.get('description') ?? '').trim() || null;
		const type = String(formData.get('type') ?? '').trim();
		const status = String(formData.get('status') ?? '').trim();
		const priority = String(formData.get('priority') ?? '').trim();
		const startDate = String(formData.get('startDate') ?? '').trim() || null;
		const endDate = String(formData.get('endDate') ?? '').trim() || null;
		const budgetAmountRaw = String(formData.get('budgetAmount') ?? '').trim();
		const budgetAmount = budgetAmountRaw ? Number(budgetAmountRaw) : null;
		const progressPercentRaw = String(formData.get('progressPercent') ?? '').trim();
		const progressPercent = progressPercentRaw
			? Math.min(100, Math.max(0, Number(progressPercentRaw)))
			: 0;

		db.update(projects)
			.set({
				name,
				description,
				...(type ? { type: type as 'renovation' | 'repair' | 'installation' | 'decoration' | 'landscaping' | 'construction' | 'administrative' | 'other' } : {}),
				...(status ? { status: status as 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' } : {}),
				...(priority ? { priority: priority as 'low' | 'medium' | 'high' | 'urgent' } : {}),
				startDate,
				endDate,
				budgetAmount,
				progressPercent
			})
			.where(and(eq(projects.id, id), eq(projects.householdId, householdId)))
			.run();

		emitEntityEvent(householdId, 'entity_updated', 'project', id, locals.user?.id ?? '');

		return { success: true };
	},
	delete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'projects', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(projects)
			.where(and(eq(projects.id, id), eq(projects.householdId, householdId)))
			.run();

		emitEntityEvent(householdId, 'entity_deleted', 'project', id, locals.user?.id ?? '');

		redirect(302, '/projects');
	}
};
