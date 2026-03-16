<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash2 } from "@lucide/svelte";
	import { page } from "$app/state";
	import BulkActions from '$lib/components/bulk-actions.svelte';
	import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { t, translate } from "$lib/i18n/index.js";
	import { hasModuleAccess } from "$lib/permissions.js";

	let { data } = $props();
	const userRole = $derived(page.data.user?.role ?? "guest");

	const SELECT_CLASS = "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50";

	const ASSET_CATEGORIES = ["appliance", "furniture", "tool", "vehicle", "electronics", "building_component", "subscription", "contract", "other"] as const;

	const ASSET_STATUSES = ["active", "stored", "broken", "maintenance", "disposed", "sold"] as const;

	let createOpen = $state(false);
	let deleteId = $state<string | null>(null);
	let selectedIds = $state<Set<string>>(new Set());
	let bulkDeleteOpen = $state(false);

	const allAssetIds = $derived(data.assets.map((asset) => asset.id));
	const selectedIdsValue = $derived(Array.from(selectedIds).join(','));
	const allSelected = $derived(allAssetIds.length > 0 && allAssetIds.every((id) => selectedIds.has(id)));

	function toggleAssetSelection(assetId: string, checked: boolean) {
		const next = new Set(selectedIds);
		if (checked) {
			next.add(assetId);
		} else {
			next.delete(assetId);
		}
		selectedIds = next;
	}

	function toggleAll(checked: boolean) {
		const next = new Set(selectedIds);
		for (const id of allAssetIds) {
			if (checked) {
				next.add(id);
			} else {
				next.delete(id);
			}
		}
		selectedIds = next;
	}

	function clearSelection() {
		selectedIds = new Set();
	}
</script>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.assets.newAsset}</Dialog.Title>
		</Dialog.Header>
		<form method="POST" action="?/create" class="space-y-4 pt-2">
			<div class="space-y-2">
				<Label for="new-name">{$t.common.name} <span class="text-destructive">*</span></Label>
				<Input id="new-name" name="name" required />
			</div>
			<div class="space-y-2">
				<Label for="new-category">{$t.finances.category}</Label>
				<select id="new-category" name="category" class={SELECT_CLASS}>
					{#each ASSET_CATEGORIES as cat}
						<option value={cat}>{$t.assets.category[cat]}</option>
					{/each}
				</select>
			</div>
			<div class="space-y-2">
				<Label for="new-status">{$t.common.status}</Label>
				<select id="new-status" name="status" class={SELECT_CLASS}>
					{#each ASSET_STATUSES as st}
						<option value={st}>{$t.assets.status[st]}</option>
					{/each}
				</select>
			</div>
			<div class="space-y-2">
				<Label for="new-room">{$t.assets.room}</Label>
				<select id="new-room" name="roomId" class={SELECT_CLASS}>
					<option value="">— {$t.assets.room} —</option>
					{#each data.rooms as room}
						<option value={room.id}>{room.name}</option>
					{/each}
				</select>
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

<AlertDialog.Root
	open={!!deleteId}
	onOpenChange={(v) => {
		if (!v) deleteId = null;
	}}
>
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
		<h1 class="text-2xl font-semibold">{$t.assets.title}</h1>
		{#if hasModuleAccess(userRole, "assets", "create")}
			<Button onclick={() => (createOpen = true)}><Plus class="size-4" />{$t.assets.newAsset}</Button>
		{/if}
	</div>

	<Card.Root>
		<Card.Header><Card.Title>{$t.common.filter}</Card.Title></Card.Header>
		<Card.Content class="grid gap-4 md:grid-cols-2">
			<div class="space-y-2"><Label for="category">{$t.finances.category}</Label><Input id="category" /></div>
			<div class="space-y-2"><Label for="status">{$t.common.status}</Label><Input id="status" /></div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Content class="pt-6">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-12">
							<input
								type="checkbox"
								aria-label="Select all"
								checked={allSelected}
								onchange={(e) => toggleAll(e.currentTarget.checked)}
							/>
						</Table.Head>
						<Table.Head>{$t.common.name}</Table.Head>
						<Table.Head>{$t.finances.category}</Table.Head>
						<Table.Head>{$t.common.status}</Table.Head>
						<Table.Head>{$t.assets.room}</Table.Head>
						<Table.Head>{$t.assets.warrantyExpires}</Table.Head>
						<Table.Head class="w-12"></Table.Head>
					</Table.Row>
				</Table.Header>
			<Table.Body>
				{#each data.assets as asset (asset.id)}
						<Table.Row>
							<Table.Cell>
								<input
									type="checkbox"
									aria-label={`Select ${asset.name}`}
									checked={selectedIds.has(asset.id)}
									onchange={(e) => toggleAssetSelection(asset.id, e.currentTarget.checked)}
								/>
							</Table.Cell>
							<Table.Cell><a href={`/assets/${asset.id}`} class="font-medium hover:underline">{asset.name}</a></Table.Cell>
							<Table.Cell>{asset.category}</Table.Cell>
							<Table.Cell><Badge variant="outline">{asset.status}</Badge></Table.Cell>
							<Table.Cell>{data.rooms.find((room) => room.id === asset.roomId)?.name}</Table.Cell>
							<Table.Cell>{asset.warrantyExpiresAt}</Table.Cell>
							<Table.Cell>
								{#if hasModuleAccess(userRole, "assets", "delete")}
									<Button variant="ghost" size="icon" class="text-destructive hover:text-destructive" onclick={() => (deleteId = asset.id)}>
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

<BulkActions selectedCount={selectedIds.size} onDeselectAll={clearSelection}>
	{#snippet children()}
		{#if hasModuleAccess(userRole, 'assets', 'delete')}
		<Button type="button" variant="destructive" onclick={() => (bulkDeleteOpen = true)}>
			{$t.common.bulkDelete}
		</Button>
		{/if}
	{/snippet}
</BulkActions>

<AlertDialog.Root bind:open={bulkDeleteOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
		<AlertDialog.Title>{$t.common.bulkDelete}</AlertDialog.Title>
		<AlertDialog.Description>
			{translate('common.bulkDeleteConfirm', { count: selectedIds.size })}
		</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (bulkDeleteOpen = false)}>Cancel</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/bulkDelete"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							bulkDeleteOpen = false;
							clearSelection();
						}
						await update();
					};
				}}
			>
				<input type="hidden" name="ids" value={selectedIdsValue} />
				<AlertDialog.Action type="submit">Delete</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
