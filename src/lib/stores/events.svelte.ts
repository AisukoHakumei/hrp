import { invalidateAll } from '$app/navigation';

let eventSource: EventSource | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
let currentUserId: string | null = null;

export const sseState = $state<{ status: 'connected' | 'connecting' | 'disconnected' }>({ status: 'disconnected' });

function handleMessage(event: MessageEvent) {
	try {
		const data = JSON.parse(event.data);

		if (data.type === 'connected') {
			sseState.status = 'connected';
			reconnectDelay = 1000;
			return;
		}

		if (data.userId === currentUserId) return;

		if (
			data.type === 'entity_created' ||
			data.type === 'entity_updated' ||
			data.type === 'entity_deleted' ||
			data.type === 'notification_created'
		) {
			void invalidateAll();
		}
	} catch {
		return;
	}
}

function connect() {
	if (eventSource) {
		eventSource.close();
	}

	sseState.status = 'connecting';
	eventSource = new EventSource('/api/events');
	eventSource.onmessage = handleMessage;

	eventSource.onerror = () => {
		sseState.status = 'disconnected';
		eventSource?.close();
		eventSource = null;

		if (reconnectTimeout) clearTimeout(reconnectTimeout);
		reconnectTimeout = setTimeout(() => {
			connect();
		}, reconnectDelay);
		reconnectDelay = Math.min(reconnectDelay * 2, 30000);
	};
}

export function initSSE(userId: string) {
	currentUserId = userId;
	connect();
}

export function destroySSE() {
	if (reconnectTimeout) {
		clearTimeout(reconnectTimeout);
		reconnectTimeout = null;
	}

	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}

	sseState.status = 'disconnected';
	currentUserId = null;
}
