import { json, error, type RequestEvent } from '@sveltejs/kit';
import { createBackup, createDbBackup, listBackups, cleanOldBackups } from '$lib/server/backup.js';
import { isAtLeast } from '$lib/server/auth/permissions.js';

export const GET = async ({ url, locals }: RequestEvent) => {
	const user = locals.user;
	if (!user || !isAtLeast(user.role, 'admin')) {
		error(403, 'Admin access required');
	}

	const action = url.searchParams.get('action');

	if (action === 'download') {
		const { stream, filename } = await createBackup();
		return new Response(stream as unknown as ReadableStream, {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	}

	const backups = listBackups();
	return json({ backups });
};

export const POST = async ({ url, locals }: RequestEvent) => {
	const user = locals.user;
	if (!user || !isAtLeast(user.role, 'admin')) {
		error(403, 'Admin access required');
	}

	const action = url.searchParams.get('action') ?? 'db';

	if (action === 'db') {
		const backup = await createDbBackup();
		return json(backup, { status: 201 });
	}

	if (action === 'cleanup') {
		const keep = Number(url.searchParams.get('keep') ?? '5');
		const removed = cleanOldBackups(keep);
		return json({ removed, kept: keep });
	}

	error(400, 'Invalid action. Use "db" or "cleanup".');
};
