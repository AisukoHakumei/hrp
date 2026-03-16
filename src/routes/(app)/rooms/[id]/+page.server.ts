import { error, fail, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { db } from '$lib/server/db/index.js';
import {
	assets,
	documents,
	entityTags,
	floorPlans,
	maintenanceSchedules,
	projectRooms,
	projects,
	roomDocuments as roomDocumentsTable,
	rooms,
	tags,
	tasks
} from '$lib/server/db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import { writeAuditLog } from '$lib/server/audit.js';
import { emitEntityEvent } from '$lib/server/events.js';


export const load = async ({ params, locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		error(404, 'Not found');
	}

	const roomKey = String(params.id ?? '');
	const room = db
		.select()
		.from(rooms)
		.where(and(eq(rooms.id, roomKey), eq(rooms.householdId, householdId)))
		.get();

	if (!room) {
		error(404, 'Not found');
	}

	const roomId = room.id;

	const roomAssets = db
		.select()
		.from(assets)
		.where(and(eq(assets.roomId, roomId), eq(assets.householdId, householdId)))
		.all();

	const roomProjects = db
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
			progressPercent: projects.progressPercent
		})
		.from(projectRooms)
		.innerJoin(projects, eq(projectRooms.projectId, projects.id))
		.where(and(eq(projectRooms.roomId, roomId), eq(projects.householdId, householdId)))
		.all();

	const roomTasks = db
		.select()
		.from(tasks)
		.where(and(eq(tasks.roomId, roomId), eq(tasks.householdId, householdId)))
		.all();

	const roomMaintenanceSchedules = db
		.select()
		.from(maintenanceSchedules)
		.where(and(eq(maintenanceSchedules.roomId, roomId), eq(maintenanceSchedules.householdId, householdId)))
		.all();

	const roomDocuments = db
		.select({
			id: documents.id,
			title: documents.title,
			description: documents.description,
			type: documents.type,
			fileName: documents.fileName,
			mimeType: documents.mimeType,
			fileSize: documents.fileSize
		})
		.from(roomDocumentsTable)
		.innerJoin(documents, eq(documents.id, roomDocumentsTable.documentId))
		.where(and(eq(roomDocumentsTable.roomId, roomId), eq(documents.householdId, householdId)))
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

	const allTags = db.select().from(tags).where(eq(tags.householdId, householdId)).all();

	const entityTagsList = db
		.select({ tagId: entityTags.tagId, tagName: tags.name, tagColor: tags.color })
		.from(entityTags)
		.innerJoin(tags, eq(tags.id, entityTags.tagId))
		.where(
			and(
				eq(entityTags.entityType, 'room'),
				eq(entityTags.entityId, room.id),
				eq(tags.householdId, householdId)
			)
		)
		.all();

	let floorPlanData: {
		plan: typeof floorPlans.$inferSelect;
		siblingRooms: Array<{ id: string; name: string; posX: number | null; posY: number | null; posWidth: number | null; posHeight: number | null; color: string | null }>;
	} | null = null;

	if (room.floorPlanId) {
		const plan = db
			.select()
			.from(floorPlans)
			.where(eq(floorPlans.id, room.floorPlanId))
			.get();

		if (plan) {
			const siblingRooms = db
				.select({
					id: rooms.id,
					name: rooms.name,
					posX: rooms.posX,
					posY: rooms.posY,
					posWidth: rooms.posWidth,
					posHeight: rooms.posHeight,
					color: rooms.color
				})
				.from(rooms)
				.where(
					and(
						eq(rooms.floorPlanId, room.floorPlanId!),
						eq(rooms.householdId, householdId)
					)
				)
				.all();

			floorPlanData = { plan, siblingRooms };
		}
	}

	return {
		room,
		roomAssets,
		roomProjects,
		roomDocuments,
		roomTasks,
		roomMaintenanceSchedules,
		allDocuments,
		allProjects,
		allTags,
		entityTags: entityTagsList,
		floorPlanData
	};
};

export const actions: Actions = {
	linkDocument: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const roomId = String(formData.get('roomId') ?? '').trim();
		const documentId = String(formData.get('documentId') ?? '').trim();
		if (!roomId || !documentId) return fail(400, { invalid: true });

		db.insert(roomDocumentsTable).values({ roomId, documentId }).onConflictDoNothing().run();
		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'room',
			entityId: roomId,
			action: 'update'
		});
		emitEntityEvent(householdId, 'entity_updated', 'room', roomId, locals.user?.id ?? '');
		return { success: true };
	},
	unlinkDocument: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const roomId = String(formData.get('roomId') ?? '').trim();
		const documentId = String(formData.get('documentId') ?? '').trim();
		if (!roomId || !documentId) return fail(400, { invalid: true });

		db.delete(roomDocumentsTable)
			.where(and(eq(roomDocumentsTable.roomId, roomId), eq(roomDocumentsTable.documentId, documentId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'room',
			entityId: roomId,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'room', roomId, locals.user?.id ?? '');

		return { success: true };
	},
	linkProject: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const roomId = String(formData.get('roomId') ?? '').trim();
		const projectId = String(formData.get('projectId') ?? '').trim();
		if (!roomId || !projectId) return fail(400, { invalid: true });

		db.insert(projectRooms).values({ projectId, roomId }).onConflictDoNothing().run();
		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'room',
			entityId: roomId,
			action: 'update'
		});
		emitEntityEvent(householdId, 'entity_updated', 'room', roomId, locals.user?.id ?? '');
		return { success: true };
	},
	unlinkProject: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const roomId = String(formData.get('roomId') ?? '').trim();
		const projectId = String(formData.get('projectId') ?? '').trim();
		if (!roomId || !projectId) return fail(400, { invalid: true });

		db.delete(projectRooms)
			.where(and(eq(projectRooms.roomId, roomId), eq(projectRooms.projectId, projectId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'room',
			entityId: roomId,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'room', roomId, locals.user?.id ?? '');

		return { success: true };
	},
	addTag: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const entityId = String(formData.get('entityId') ?? '').trim();
		const tagId = String(formData.get('tagId') ?? '').trim();
		if (!entityId || !tagId) return fail(400, { invalid: true });

		db.insert(entityTags)
			.values({ tagId, entityType: 'room', entityId })
			.onConflictDoNothing()
			.run();

		emitEntityEvent(householdId, 'entity_updated', 'room', entityId, locals.user?.id ?? '');
		return { success: true };
	},
	removeTag: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'edit')) {
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
					eq(entityTags.entityType, 'room'),
					eq(entityTags.entityId, entityId)
				)
			)
			.run();

		emitEntityEvent(householdId, 'entity_updated', 'room', entityId, locals.user?.id ?? '');

		return { success: true };
	},
	update: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { invalid: true });

		const type = (String(formData.get('type') ?? '').trim() || 'room') as typeof rooms.$inferInsert.type;
		const area = formData.get('area') ? Number(formData.get('area')) : null;
		const description = String(formData.get('description') ?? '').trim() || null;

		db.update(rooms)
			.set({ name, type, area, description })
			.where(and(eq(rooms.id, id), eq(rooms.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'room',
			entityId: id,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'room', id, locals.user?.id ?? '');

		return { updated: true };
	},
	delete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'rooms', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(rooms)
			.where(and(eq(rooms.id, id), eq(rooms.householdId, householdId)))
			.run();

		emitEntityEvent(householdId, 'entity_deleted', 'room', id, locals.user?.id ?? '');

		redirect(302, '/rooms');
	}
};
