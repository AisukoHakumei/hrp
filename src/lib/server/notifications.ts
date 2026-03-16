/**
 * Notification helper utilities.
 * Creates in-app notifications for household members.
 */
import { db } from '$lib/server/db/index.js';
import { notifications, users } from '$lib/server/db/schema/index.js';
import { eq } from 'drizzle-orm';
import type { NotificationType } from '$lib/server/db/schema/notifications.js';
import { emitEntityEvent } from '$lib/server/events.js';

interface NotificationOpts {
	householdId: string;
	userId: string;
	type: NotificationType;
	title: string;
	message?: string;
	entityType?: 'project' | 'task' | 'asset' | 'budget' | 'maintenance' | 'document';
	entityId?: string;
}

/** Create a single notification for one user. */
export function createNotification(opts: NotificationOpts): void {
	const notification = db
		.insert(notifications)
		.values({
			householdId: opts.householdId,
			userId: opts.userId,
			type: opts.type,
			title: opts.title,
			message: opts.message ?? null,
			entityType: opts.entityType ?? null,
			entityId: opts.entityId ?? null
		})
		.returning({ id: notifications.id })
		.get();

	emitEntityEvent(opts.householdId, 'notification_created', 'notification', notification.id, 'system');
}

interface HouseholdNotificationOpts {
	householdId: string;
	excludeUserId?: string;
	type: NotificationType;
	title: string;
	message?: string;
	entityType?: 'project' | 'task' | 'asset' | 'budget' | 'maintenance' | 'document';
	entityId?: string;
}

/** Notify all members of a household, optionally excluding one user (e.g. the actor). */
export function notifyHousehold(opts: HouseholdNotificationOpts): void {
	const members = db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.householdId, opts.householdId))
		.all();

	for (const member of members) {
		if (member.id === opts.excludeUserId) continue;
		createNotification({
			householdId: opts.householdId,
			userId: member.id,
			type: opts.type,
			title: opts.title,
			message: opts.message,
			entityType: opts.entityType,
			entityId: opts.entityId
		});
	}
}
