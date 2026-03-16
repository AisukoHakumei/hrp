import { fail, type Actions, type RequestEvent } from '@sveltejs/kit';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { db } from '$lib/server/db/index.js';
import { documents, documentVersions } from '$lib/server/db/schema/index.js';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { deleteFile } from '$lib/server/storage.js';
import { emitEntityEvent } from '$lib/server/events.js';

export const load = async ({ locals }: RequestEvent) => {
	const householdId = locals.user?.householdId;
	if (!householdId) {
		return {
			documents: []
		};
	}

	const documentList = db
		.select()
		.from(documents)
		.where(eq(documents.householdId, householdId))
		.orderBy(desc(documents.createdAt))
		.all();

	return {
		documents: documentList
	};
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'documents', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { invalid: true });

		const versions = db
			.select()
			.from(documentVersions)
			.where(eq(documentVersions.documentId, id))
			.all();

		try {
			await Promise.all(versions.map((version) => deleteFile(version.storagePath)));
		} catch (err) {
			console.error('Failed to delete document files:', err);
		}

		db.delete(documents)
			.where(and(eq(documents.id, id), eq(documents.householdId, householdId)))
			.run();

		emitEntityEvent(householdId, 'entity_deleted', 'document', id, locals.user?.id ?? '');

		return { deleted: true };
	},
	bulkDelete: async ({ request, locals }) => {
		const householdId = locals.user?.householdId;
		if (!householdId) return fail(401, { invalid: true });
		if (!hasModuleAccess(locals.user?.role ?? 'guest', 'documents', 'delete')) {
			return fail(403, { invalid: true });
		}

		const formData = await request.formData();
		const ids = String(formData.get('ids') ?? '')
			.split(',')
			.filter(Boolean);
		if (ids.length === 0) return fail(400, { invalid: true });

		const scopedDocuments = db
			.select({ id: documents.id })
			.from(documents)
			.where(and(eq(documents.householdId, householdId), inArray(documents.id, ids)))
			.all();
		const scopedIds = scopedDocuments.map((document) => document.id);
		if (scopedIds.length === 0) return fail(400, { invalid: true });

		const versions = db
			.select()
			.from(documentVersions)
			.where(inArray(documentVersions.documentId, scopedIds))
			.all();

		try {
			await Promise.all(versions.map((version) => deleteFile(version.storagePath)));
		} catch (err) {
			console.error('Failed to delete document files:', err);
		}

		db.delete(documents)
			.where(and(eq(documents.householdId, householdId), inArray(documents.id, scopedIds)))
			.run();

		for (const id of scopedIds) {
			emitEntityEvent(householdId, 'entity_deleted', 'document', id, locals.user?.id ?? '');
		}

		return { deleted: true };
	}
};
