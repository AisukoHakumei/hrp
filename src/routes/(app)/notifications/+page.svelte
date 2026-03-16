<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { t } from '$lib/i18n/index.js';

	let { data } = $props();
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">{$t.notifications.title}</h1>
		<form method="POST" action="?/markAllRead"><Button type="submit" variant="outline">{$t.notifications.markAllRead}</Button></form>
	</div>

	<Card.Root>
		<Card.Content class="space-y-2 pt-6">
			{#each data.notifications as item (item.id)}
				<div class="rounded-md border p-3 text-sm">
					<div class="flex items-center justify-between">
						<p class="font-medium">{item.title}</p>
						<Badge variant={item.isRead ? 'outline' : 'default'}>{item.type}</Badge>
					</div>
					<p class="mt-1 text-muted-foreground">{item.message}</p>
					<div class="mt-2 flex justify-end">
						<form method="POST" action="?/markRead">
							<input type="hidden" name="id" value={item.id} />
							<Button type="submit" variant="ghost" size="sm">{$t.notifications.markRead}</Button>
						</form>
					</div>
				</div>
			{/each}
		</Card.Content>
	</Card.Root>
</div>
