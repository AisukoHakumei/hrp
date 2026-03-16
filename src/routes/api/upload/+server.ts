import { json, error, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { documents, documentVersions } from '$lib/server/db/schema/index.js';
import { createId } from '$lib/server/db/schema/common.js';
import { storeFile, validateUpload, deleteFile } from '$lib/server/storage.js';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { eq } from 'drizzle-orm';
import { notifyHousehold } from '$lib/server/notifications.js';

export const POST = async ({ request, locals }: RequestEvent) => {
	const user = locals.user;
	if (!user || !hasModuleAccess(user.role, 'documents', 'create')) {
		error(403, 'Not authorized');
	}

	const formData = await request.formData();
	const file = formData.get('file');
	if (!(file instanceof File) || file.size === 0) {
		error(400, 'No file provided');
	}

	const title = String(formData.get('title') ?? file.name).trim();
	const description = formData.get('description')
		? String(formData.get('description')).trim()
		: null;
	const type = String(formData.get('type') ?? 'other').trim() as
		| 'invoice'
		| 'contract'
		| 'warranty'
		| 'manual'
		| 'receipt'
		| 'photo'
		| 'plan'
		| 'certificate'
		| 'report'
		| 'other';

	const validation = validateUpload(file);
	if (!validation.valid) {
		error(400, validation.error ?? 'Upload validation failed');
	}

	const documentId = createId();
	const versionId = createId();

	let storageResult;
	try {
		storageResult = await storeFile('documents', documentId, file, versionId);
	} catch {
		error(500, 'Failed to store file');
	}

	try {
		db.insert(documents)
			.values({
				id: documentId,
				householdId: user.householdId,
				title,
				description,
				type,
				currentVersionId: versionId,
				fileName: storageResult.fileName,
				mimeType: storageResult.mimeType,
				fileSize: storageResult.fileSize,
				storagePath: storageResult.storagePath,
				createdBy: user.id
			})
			.run();
	} catch (err) {
		await deleteFile(storageResult.storagePath);
		error(500, 'Failed to create document record');
	}

	try {
		db.insert(documentVersions)
			.values({
				id: versionId,
				documentId,
				versionNumber: 1,
				fileName: storageResult.fileName,
				mimeType: storageResult.mimeType,
				fileSize: storageResult.fileSize,
				storagePath: storageResult.storagePath,
				changelog: 'Initial upload',
				uploadedBy: user.id
			})
			.run();
	} catch (err) {
		error(500, 'Failed to create document version record');
	}

	notifyHousehold({
		householdId: user.householdId,
		excludeUserId: user.id,
		type: 'document_uploaded',
		title: `Document uploaded: ${title}`,
		entityType: 'document',
		entityId: documentId
	});

	return json(
		{
			id: documentId,
			title,
			fileName: storageResult.fileName,
			mimeType: storageResult.mimeType,
			fileSize: storageResult.fileSize
		},
		{ status: 201 }
	);
};

export const PUT = async ({ request, url, locals }: RequestEvent) => {
	const user = locals.user;
	if (!user || !hasModuleAccess(user.role, 'documents', 'edit')) {
		error(403, 'Not authorized');
	}

	const documentId = url.searchParams.get('documentId');
	if (!documentId) {
		error(400, 'documentId query parameter is required');
	}

	const existing = db
		.select()
		.from(documents)
		.where(eq(documents.id, documentId))
		.get();

	if (!existing || existing.householdId !== user.householdId) {
		error(404, 'Document not found');
	}

	const formData = await request.formData();
	const file = formData.get('file');
	if (!(file instanceof File) || file.size === 0) {
		error(400, 'No file provided');
	}

	const changelog = formData.get('changelog')
		? String(formData.get('changelog')).trim()
		: null;

	const validation = validateUpload(file);
	if (!validation.valid) {
		error(400, validation.error ?? 'Upload validation failed');
	}

	const existingVersions = db
		.select()
		.from(documentVersions)
		.where(eq(documentVersions.documentId, documentId))
		.all();

	const nextVersion = existingVersions.length + 1;
	const versionId = createId();

	let storageResult;
	try {
		storageResult = await storeFile('documents', documentId, file, versionId);
	} catch {
		error(500, 'Failed to store file');
	}

	try {
		db.insert(documentVersions)
			.values({
				id: versionId,
				documentId,
				versionNumber: nextVersion,
				fileName: storageResult.fileName,
				mimeType: storageResult.mimeType,
				fileSize: storageResult.fileSize,
				storagePath: storageResult.storagePath,
				changelog,
				uploadedBy: user.id
			})
			.run();
	} catch (err) {
		await deleteFile(storageResult.storagePath);
		error(500, 'Failed to create document version record');
	}

	try {
		db.update(documents)
			.set({
				currentVersionId: versionId,
				fileName: storageResult.fileName,
				mimeType: storageResult.mimeType,
				fileSize: storageResult.fileSize,
				storagePath: storageResult.storagePath
			})
			.where(eq(documents.id, documentId))
			.run();
	} catch (err) {
		error(500, 'Failed to update document record');
	}

	return json({
		documentId,
		versionId,
		versionNumber: nextVersion,
		fileName: storageResult.fileName,
		fileSize: storageResult.fileSize
	});
};

export const DELETE = async ({ url, locals }: RequestEvent) => {
	const user = locals.user;
	if (!user || !hasModuleAccess(user.role, 'documents', 'delete')) {
		error(403, 'Not authorized');
	}

	const documentId = url.searchParams.get('documentId');
	if (!documentId) {
		error(400, 'documentId query parameter is required');
	}

	const existing = db
		.select()
		.from(documents)
		.where(eq(documents.id, documentId))
		.get();

	if (!existing || existing.householdId !== user.householdId) {
		error(404, 'Document not found');
	}

	const versions = db
		.select()
		.from(documentVersions)
		.where(eq(documentVersions.documentId, documentId))
		.all();

	try {
		await Promise.all(versions.map((version) => deleteFile(version.storagePath)));
	} catch (err) {
		console.error('Failed to delete document files:', err);
	}

	db.delete(documents).where(eq(documents.id, documentId)).run();

	return json({ deleted: true });
};
