import { fail, type Actions, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { db } from '$lib/server/db/index.js';
import { knowledgeArticles, knowledgeLinks, projects, assets, rooms, tasks } from '$lib/server/db/schema/index.js';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { writeAuditLog } from '$lib/server/audit.js';
import { emitEntityEvent } from '$lib/server/events.js';

export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		return {
			knowledgeArticles: []
		};
	}

	const articleList = db
		.select()
		.from(knowledgeArticles)
		.where(eq(knowledgeArticles.householdId, householdId))
		.orderBy(desc(knowledgeArticles.createdAt))
		.all();

	const articleIds = articleList.map((a) => a.id);
	const linkList = articleIds.length > 0
		? db.select().from(knowledgeLinks).where(inArray(knowledgeLinks.articleId, articleIds)).all()
		: [];

	const projectList = db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.householdId, householdId)).all();
	const assetList = db.select({ id: assets.id, name: assets.name }).from(assets).where(eq(assets.householdId, householdId)).all();
	const roomList = db.select({ id: rooms.id, name: rooms.name }).from(rooms).where(eq(rooms.householdId, householdId)).all();
	const taskList = db.select({ id: tasks.id, name: tasks.title }).from(tasks).where(eq(tasks.householdId, householdId)).all();

	return {
		knowledgeArticles: articleList,
		knowledgeLinks: linkList,
		entities: {
			project: projectList,
			asset: assetList,
			room: roomList,
			task: taskList
		}
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'knowledge', 'create')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const title = String(formData.get('title') ?? '').trim();
		const content = String(formData.get('content') ?? '').trim();
		const category = String(formData.get('category') ?? 'note').trim();

		if (!title) return fail(400, { invalid: true, field: 'title' });
		if (!content) return fail(400, { invalid: true, field: 'content' });

		const created = db
			.insert(knowledgeArticles)
			.values({
				householdId,
				title,
				content,
				category: category as 'note' | 'procedure' | 'howto' | 'reference' | 'troubleshooting' | 'other',
				createdBy: locals.user?.id
			})
			.returning({ id: knowledgeArticles.id })
			.get();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'knowledge',
			entityId: created.id,
			action: 'create'
		});

		emitEntityEvent(householdId, 'entity_created', 'knowledge', created.id, locals.user?.id ?? '');

		return { created: true };
	},

	update: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'knowledge', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const title = String(formData.get('title') ?? '').trim();
		const content = String(formData.get('content') ?? '').trim();
		const category = String(formData.get('category') ?? 'note').trim();

		if (!id) return fail(400, { invalid: true, field: 'id' });
		if (!title) return fail(400, { invalid: true, field: 'title' });
		if (!content) return fail(400, { invalid: true, field: 'content' });

		db.update(knowledgeArticles)
			.set({
				title,
				content,
				category: category as 'note' | 'procedure' | 'howto' | 'reference' | 'troubleshooting' | 'other'
			})
			.where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'knowledge',
			entityId: id,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'knowledge', id, locals.user?.id ?? '');

		return { updated: true };
	},

	linkEntity: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'knowledge', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const articleId = String(formData.get('articleId') ?? '').trim();
		const targetType = String(formData.get('targetType') ?? '').trim() as 'project' | 'asset' | 'room' | 'task';
		const targetId = String(formData.get('targetId') ?? '').trim();

		if (!articleId || !targetType || !targetId) return fail(400, { invalid: true });

		const existing = db
			.select()
			.from(knowledgeLinks)
			.where(
				and(
					eq(knowledgeLinks.articleId, articleId),
					eq(knowledgeLinks.targetType, targetType),
					eq(knowledgeLinks.targetId, targetId)
				)
			)
			.get();

		if (!existing) {
			db.insert(knowledgeLinks)
				.values({ articleId, targetType, targetId })
				.run();
		}

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'knowledge',
			entityId: articleId,
			action: 'update'
		});

		emitEntityEvent(householdId, 'entity_updated', 'knowledge', articleId, locals.user?.id ?? '');

		return { linked: true };
	},

	unlinkEntity: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'knowledge', 'edit')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const linkId = String(formData.get('linkId') ?? '').trim();
		if (!linkId) return fail(400, { invalid: true });

		const link = db
			.select({ articleId: knowledgeLinks.articleId })
			.from(knowledgeLinks)
			.where(eq(knowledgeLinks.id, linkId))
			.get();

		db.delete(knowledgeLinks).where(eq(knowledgeLinks.id, linkId)).run();

		if (link?.articleId) {
			writeAuditLog({
				userId: locals.user?.id,
				userName: locals.user?.name,
				entityType: 'knowledge',
				entityId: link.articleId,
				action: 'update'
			});
		}

		if (link?.articleId) {
			emitEntityEvent(householdId, 'entity_updated', 'knowledge', link.articleId, locals.user?.id ?? '');
		}

		return { unlinked: true };
	},

	delete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'knowledge', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		db.delete(knowledgeArticles)
			.where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.householdId, householdId)))
			.run();

		writeAuditLog({
			userId: locals.user?.id,
			userName: locals.user?.name,
			entityType: 'knowledge',
			entityId: id,
			action: 'delete'
		});

		emitEntityEvent(householdId, 'entity_deleted', 'knowledge', id, locals.user?.id ?? '');

		return { deleted: true };
	}
};
