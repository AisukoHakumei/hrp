import { createLogger } from './logger.js';

const log = createLogger('events');

export type SSEEventType =
	| 'entity_created'
	| 'entity_updated'
	| 'entity_deleted'
	| 'notification_created';

export interface SSEEvent {
	type: SSEEventType;
	entityType: string;
	entityId: string;
	userId: string;
	timestamp: string;
}

type Listener = (event: SSEEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribe(householdId: string, callback: Listener): () => void {
	if (!listeners.has(householdId)) {
		listeners.set(householdId, new Set());
	}

	listeners.get(householdId)?.add(callback);

	return () => {
		const set = listeners.get(householdId);
		if (!set) return;

		set.delete(callback);
		if (set.size === 0) {
			listeners.delete(householdId);
		}
	};
}

export function emitEvent(householdId: string, event: SSEEvent): void {
	const set = listeners.get(householdId);
	if (!set || set.size === 0) return;

	log.debug({ householdId, event }, 'Emitting SSE event');

	for (const listener of set) {
		try {
			listener(event);
		} catch (err) {
			log.error({ err }, 'SSE listener error');
		}
	}
}

export function emitEntityEvent(
	householdId: string,
	type: SSEEventType,
	entityType: string,
	entityId: string,
	userId: string
): void {
	try {
		emitEvent(householdId, {
			type,
			entityType,
			entityId,
			userId,
			timestamp: new Date().toISOString()
		});
	} catch {
		return;
	}
}
