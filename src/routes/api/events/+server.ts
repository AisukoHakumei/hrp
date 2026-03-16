import type { RequestHandler } from './$types';
import { validateSession } from '$lib/server/auth/session.js';
import { subscribe } from '$lib/server/events.js';

export const GET: RequestHandler = async ({ request, cookies }) => {
	const sessionToken = cookies.get('session');
	if (!sessionToken) {
		return new Response('Unauthorized', { status: 401 });
	}

	const result = await validateSession(sessionToken);
	if (!result) {
		return new Response('Unauthorized', { status: 401 });
	}

	const householdId = result.user.householdId;
	const userId = result.user.id;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`));

			const unsubscribe = subscribe(householdId, (event) => {
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
				} catch {
					unsubscribe();
				}
			});

			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': keepalive\n\n'));
				} catch {
					clearInterval(heartbeat);
					unsubscribe();
				}
			}, 30000);

			request.signal.addEventListener('abort', () => {
				clearInterval(heartbeat);
				unsubscribe();
				try {
					controller.close();
				} catch {
					return;
				}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
