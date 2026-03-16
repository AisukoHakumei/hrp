<script lang="ts">
	import { Plus, Trash2, Map } from '@lucide/svelte';
	import { page } from '$app/state';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { t } from '$lib/i18n/index.js';
	import { hasModuleAccess } from '$lib/permissions.js';

	let { data } = $props();
	const userRole = $derived(page.data.user?.role ?? 'guest');

	const SELECT_CLASS =
		'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50';

	const ROOM_TYPES = [
		'room',
		'hallway',
		'bathroom',
		'kitchen',
		'garage',
		'garden',
		'attic',
		'basement',
		'balcony',
		'storage',
		'other'
	] as const;

	let createOpen = $state(false);
	let deleteId = $state<string | null>(null);
</script>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.rooms.newRoom}</Dialog.Title>
		</Dialog.Header>
		<form method="POST" action="?/create" class="space-y-4 pt-2">
			<div class="space-y-2">
				<Label for="new-name">{$t.common.name} <span class="text-destructive">*</span></Label>
				<Input id="new-name" name="name" required />
			</div>
			<div class="space-y-2">
				<Label for="new-type">{$t.common.type}</Label>
				<select id="new-type" name="type" class={SELECT_CLASS}>
					{#each ROOM_TYPES as rt}
						<option value={rt}>{rt.charAt(0).toUpperCase() + rt.slice(1)}</option>
					{/each}
				</select>
			</div>
			<div class="space-y-2">
				<Label for="new-area">{$t.rooms.area}</Label>
				<Input id="new-area" name="area" type="number" step="0.01" min="0" />
			</div>
			<div class="space-y-2">
				<Label for="new-description">{$t.common.description}</Label>
				<Textarea id="new-description" name="description" rows={3} />
			</div>
			<Dialog.Footer>
				<Dialog.Close>
					<Button type="button" variant="outline">{$t.common.cancel}</Button>
				</Dialog.Close>
				<Button type="submit">{$t.common.create}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root open={!!deleteId} onOpenChange={(v) => { if (!v) deleteId = null; }}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{$t.common.delete}?</AlertDialog.Title>
			<AlertDialog.Description>This action cannot be undone.</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (deleteId = null)}>{$t.common.cancel}</AlertDialog.Cancel>
			<form method="POST" action="?/delete">
				<input type="hidden" name="id" value={deleteId} />
				<AlertDialog.Action type="submit">{$t.common.delete}</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">{$t.rooms.title}</h1>
		<div class="flex items-center gap-2">
			<Button href="/rooms/floor-plans" variant="outline"><Map class="size-4" />{$t.rooms.floorPlans}</Button>
			{#if hasModuleAccess(userRole, 'rooms', 'create')}
				<Button onclick={() => (createOpen = true)}><Plus class="size-4" />{$t.rooms.newRoom}</Button>
			{/if}
		</div>
	</div>

	<Card.Root>
		<Card.Content class="pt-6">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>{$t.common.name}</Table.Head>
						<Table.Head>{$t.common.type}</Table.Head>
						<Table.Head>{$t.rooms.area}</Table.Head>
						<Table.Head>{$t.rooms.floorPlan}</Table.Head>
						<Table.Head class="w-12"></Table.Head>
					</Table.Row>
				</Table.Header>
			<Table.Body>
				{#each data.rooms as room (room.id)}
						<Table.Row>
							<Table.Cell><a href={`/rooms/${room.id}`} class="font-medium hover:underline">{room.name}</a></Table.Cell>
							<Table.Cell><Badge variant="outline">{room.type}</Badge></Table.Cell>
							<Table.Cell>{room.area}</Table.Cell>
							<Table.Cell>{room.floorPlanId}</Table.Cell>
							<Table.Cell>
								{#if hasModuleAccess(userRole, 'rooms', 'delete')}
									<Button
										variant="ghost"
										size="icon"
										class="text-destructive hover:text-destructive"
										onclick={() => (deleteId = room.id)}
									>
										<Trash2 class="size-4" />
									</Button>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
