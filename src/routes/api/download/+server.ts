import { error, type RequestEvent } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { db } from '$lib/server/db/index.js';
import { documents } from '$lib/server/db/schema/index.js';
import { hasModuleAccess } from '$lib/server/auth/permissions.js';
import { getFilePath } from '$lib/server/storage.js';
import { eq } from 'drizzle-orm';

export const GET = async ({ url, locals }: RequestEvent) => {
	const user = locals.user;
	if (!user || !hasModuleAccess(user.role, 'documents', 'view')) {
		error(403, 'Not authorized');
	}

	const documentId = url.searchParams.get('documentId');
	if (!documentId) {
		error(400, 'documentId query parameter is required');
	}

	const doc = db
		.select()
		.from(documents)
		.where(eq(documents.id, documentId))
		.get();

	if (!doc || doc.householdId !== user.householdId) {
		error(404, 'Document not found');
	}

	let fileBuffer: Buffer;
	try {
		const absolutePath = getFilePath(doc.storagePath);
		fileBuffer = readFileSync(absolutePath);
	} catch {
		error(404, 'File not found on disk');
	}

	return new Response(new Uint8Array(fileBuffer), {
		headers: {
			'Content-Type': doc.mimeType || 'application/octet-stream',
			'Content-Disposition': `attachment; filename="${doc.fileName}"`,
			'Content-Length': String(fileBuffer.length)
		}
	});
};
