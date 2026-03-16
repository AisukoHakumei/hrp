import { error, fail, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import {
	assetDocuments,
	assets,
	documents,
	entityTags,
	maintenanceSchedules,
	projectAssets,
	projects,
	rooms,
	tags,
	tasks,
	type AssetCategory,
	type AssetStatus
} from '$lib/server/db/schema/index.js';
import { db } from '$lib/server/db/index.js';
import { and, eq } from 'drizzle-orm';
import { writeAuditLog } from '$lib/server/audit.js';


export const load = async ({ params, locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		error(404, 'Not found');
	}

	const assetId = String(params.id ?? '');
	const asset = db
		.select()
		.from(assets)
		.where(and(eq(assets.id, assetId), eq(assets.householdId, householdId)))
		.get();

	if (!asset) {
		error(404, 'Not found');
	}

	const room = asset.roomId
		? db
			.select()
			.from(rooms)
			.where(and(eq(rooms.id, asset.roomId), eq(rooms.householdId, householdId)))
			.get() ?? null
		: null;

	const linkedDocuments = db
		.select({
			id: documents.id,
			title: documents.title,
			description: documents.description,
			type: documents.type,
			fileName: documents.fileName,
			mimeType: documents.mimeType,
			fileSize: documents.fileSize
		})
		.from(assetDocuments)
		.innerJoin(documents, eq(documents.id, assetDocuments.documentId))
		.where(and(eq(assetDocuments.assetId, asset.id), eq(documents.householdId, householdId)))
		.all();

	const linkedMaintenance = db
		.select()
		.from(maintenanceSchedules)
		.where(and(eq(maintenanceSchedules.assetId, asset.id), eq(maintenanceSchedules.householdId, householdId)))
		.all();

	const relatedProjects = db
		.select({
			id: projects.id,
			name: projects.name,
			description: projects.description,
			type: projects.type,
			status: projects.status,
			priority: projects.priority,
			startDate: projects.startDate,
			endDate: projects.endDate,
			budgetAmount: projects.budgetAmount,
			progressPercent: projects.progressPercent,
			relationship: projectAssets.relationship
		})
		.from(projectAssets)
		.innerJoin(projects, eq(projects.id, projectAssets.projectId))
		.where(and(eq(projectAssets.assetId, asset.id), eq(projects.householdId, householdId)))
		.all();

	const allDocuments = db
		.select({ id: documents.id, title: documents.title })
		.from(documents)
		.where(eq(documents.householdId, householdId))
		.all();

	const allProjects = db
		.select({ id: projects.id, name: projects.name })
		.from(projects)
		.where(eq(projects.householdId, householdId))
		.all();

	const linkedTasks = db
		.select()
		.from(tasks)
		.where(and(eq(tasks.assetId, asset.id), eq(tasks.householdId, householdId)))
		.all();

	const allTags = db.select().from(tags).where(eq(tags.householdId, householdId)).all();

	const entityTagsList = db
		.select({ tagId: entityTags.tagId, tagName: tags.name, tagColor: tags.color })
		.from(entityTags)
		.innerJoin(tags, eq(tags.id, entityTags.tagId))
		.where(
			and(
				eq(entityTags.entityType, 'asset'),
				eq(entityTags.entityId, asset.id),
				eq(tags.householdId, householdId)
			)
		)
		.all();

	return {
		asset,
		room,
		linkedDocuments,
		linkedMaintenance,
		relatedProjects,
		linkedTasks,
		allDocuments,
		allProjects,
		allTags,
		entityTags: entityTagsList
	};
};

export const actions: Actions = {
	linkDocument: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'assets', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const assetId = String(formData.get('assetId') ?? '').trim();
		const documentId = String(formData.get('documentId') ?? '').trim();
		if (!assetId || !documentId) return fail(400, { invalid: true });

		db.insert(assetDocuments).values({ assetId, documentId }).onConflictDoNothing().run();
		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'asset',
			entityId: assetId,
			action: 'update'
		});
		return { success: true };
	},
	unlinkDocument: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'assets', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const assetId = String(formData.get('assetId') ?? '').trim();
		const documentId = String(formData.get('documentId') ?? '').trim();
		if (!assetId || !documentId) return fail(400, { invalid: true });

		db.delete(assetDocuments)
			.where(and(eq(assetDocuments.assetId, assetId), eq(assetDocuments.documentId, documentId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'asset',
			entityId: assetId,
			action: 'update'
		});

		return { success: true };
	},
	linkProject: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'assets', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const assetId = String(formData.get('assetId') ?? '').trim();
		const projectId = String(formData.get('projectId') ?? '').trim();
		const relationshipRaw = String(formData.get('relationship') ?? '').trim();
		const relationship =
			relationshipRaw === 'installed' ||
				relationshipRaw === 'replaced' ||
				relationshipRaw === 'repaired'
				? relationshipRaw
				: 'affected';
		if (!assetId || !projectId) return fail(400, { invalid: true });

		db.insert(projectAssets)
			.values({ projectId, assetId, relationship })
			.onConflictDoNothing()
			.run();
		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'asset',
			entityId: assetId,
			action: 'update'
		});
		return { success: true };
	},
	unlinkProject: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'assets', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const assetId = String(formData.get('assetId') ?? '').trim();
		const projectId = String(formData.get('projectId') ?? '').trim();
		if (!assetId || !projectId) return fail(400, { invalid: true });

		db.delete(projectAssets)
			.where(and(eq(projectAssets.assetId, assetId), eq(projectAssets.projectId, projectId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'asset',
			entityId: assetId,
			action: 'update'
		});

		return { success: true };
	},
	addTag: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'assets', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const entityId = String(formData.get('entityId') ?? '').trim();
		const tagId = String(formData.get('tagId') ?? '').trim();
		if (!entityId || !tagId) return fail(400, { invalid: true });

		db.insert(entityTags)
			.values({ tagId, entityType: 'asset', entityId })
			.onConflictDoNothing()
			.run();
		return { success: true };
	},
	removeTag: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'assets', 'edit')) {
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
					eq(entityTags.entityType, 'asset'),
					eq(entityTags.entityId, entityId)
				)
			)
			.run();

		return { success: true };
	},
	update: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'assets', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const category = String(formData.get('category') ?? '').trim() || null;
		const status = String(formData.get('status') ?? '').trim() || null;
		const manufacturer = String(formData.get('manufacturer') ?? '').trim() || null;
		const model = String(formData.get('model') ?? '').trim() || null;
		const serialNumber = String(formData.get('serialNumber') ?? '').trim() || null;
		const purchaseDate = String(formData.get('purchaseDate') ?? '').trim() || null;
		const purchasePriceRaw = String(formData.get('purchasePrice') ?? '').trim();
		const purchasePrice = purchasePriceRaw ? parseFloat(purchasePriceRaw) : null;
		const warrantyExpiresAt = String(formData.get('warrantyExpiresAt') ?? '').trim() || null;
		const description = String(formData.get('description') ?? '').trim() || null;

		db.update(assets)
			.set({
				name,
				...(category && { category: category as AssetCategory }),
				...(status && { status: status as AssetStatus }),
				manufacturer,
				model,
				serialNumber,
				purchaseDate,
				purchasePrice,
				warrantyExpiresAt,
				description
			})
			.where(and(eq(assets.id, id), eq(assets.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'asset',
			entityId: id,
			action: 'update'
		});

		return { updated: true };
	},
	delete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'assets', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(assets)
			.where(and(eq(assets.id, id), eq(assets.householdId, householdId)))
			.run();

		redirect(302, '/assets');
	}
};
