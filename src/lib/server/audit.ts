import { db } from '$lib/server/db/index.js';
import { auditLog } from '$lib/server/db/schema/index.js';
import type { AuditAction, AuditEntityType } from '$lib/server/db/schema/audit.js';

interface AuditLogOpts {
	userId?: string;
	userName?: string;
	entityType: AuditEntityType;
	entityId: string;
	action: AuditAction;
	before?: Record<string, unknown>;
	after?: Record<string, unknown>;
	ipAddress?: string;
}

export function writeAuditLog(opts: AuditLogOpts): void {
	db.insert(auditLog)
		.values({
			userId: opts.userId ?? null,
			userName: opts.userName ?? null,
			entityType: opts.entityType,
			entityId: opts.entityId,
			action: opts.action,
			before: opts.before ? JSON.stringify(opts.before) : null,
			after: opts.after ? JSON.stringify(opts.after) : null,
			ipAddress: opts.ipAddress ?? null
		})
		.run();
}
