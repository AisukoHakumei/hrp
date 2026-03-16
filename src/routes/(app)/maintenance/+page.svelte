<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { ChevronDown, ChevronRight, ClipboardCheck, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { t } from '$lib/i18n/index.js';
	import { hasModuleAccess } from '$lib/permissions.js';
	import { selectClass } from '$lib/utils.js';

	let { data } = $props();
	const userRole = $derived(page.data.user?.role ?? 'guest');

	let createOpen = $state(false);
	let editDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let logDialogOpen = $state(false);

	type Schedule = (typeof data.maintenanceSchedules)[0];

	let editItem = $state<Schedule | null>(null);
	let deleteItem = $state<Schedule | null>(null);
	let logItem = $state<Schedule | null>(null);
	let expandedLogs = $state<Set<string>>(new Set());

	function openLog(item: Schedule) {
		logItem = item;
		logDialogOpen = true;
	}

	function toggleLogs(id: string) {
		const next = new Set(expandedLogs);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedLogs = next;
	}

	function openEdit(item: Schedule) {
		editItem = item;
		editDialogOpen = true;
	}

	function openDelete(item: Schedule) {
		deleteItem = item;
		deleteDialogOpen = true;
	}

	const frequencies = [
		{ value: 'daily', label: $t.maintenance.frequency.daily },
		{ value: 'weekly', label: $t.maintenance.frequency.weekly },
		{ value: 'monthly', label: $t.maintenance.frequency.monthly },
		{ value: 'quarterly', label: $t.maintenance.frequency.quarterly },
		{ value: 'biannual', label: $t.maintenance.frequency.biannual },
		{ value: 'yearly', label: $t.maintenance.frequency.yearly }
	];
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">{$t.maintenance.title}</h1>
		{#if hasModuleAccess(userRole, 'maintenance', 'create')}
			<Button onclick={() => (createOpen = true)}>
				<Plus class="size-4" />{$t.maintenance.newSchedule}
			</Button>
		{/if}
	</div>

	<Card.Root>
		<Card.Content class="pt-6">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>{$t.common.name}</Table.Head>
						<Table.Head>{$t.common.type}</Table.Head>
						<Table.Head>{$t.maintenance.nextDue}</Table.Head>
						<Table.Head>Estimated Cost</Table.Head>
						<Table.Head class="w-[100px]">{$t.common.actions}</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.maintenanceSchedules as item (item.id)}
						<Table.Row>
							<Table.Cell class="font-medium">
								<button
									class="flex items-center gap-1 hover:underline"
									onclick={() => toggleLogs(item.id)}
								>
									{#if expandedLogs.has(item.id)}
										<ChevronDown class="size-4" />
									{:else}
										<ChevronRight class="size-4" />
									{/if}
									{item.name}
								</button>
							</Table.Cell>
							<Table.Cell>{item.frequency}</Table.Cell>
							<Table.Cell>{item.nextDueDate}</Table.Cell>
							<Table.Cell>{item.estimatedCost != null ? item.estimatedCost : '—'}</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-1">
									{#if hasModuleAccess(userRole, 'maintenance', 'edit')}
										<Button
											variant="ghost"
											size="icon"
											onclick={() => openLog(item)}
											aria-label={$t.maintenance.logEntry}
										>
											<ClipboardCheck class="size-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onclick={() => openEdit(item)}
											aria-label="Edit schedule"
										>
											<Pencil class="size-4" />
										</Button>
									{/if}
									{#if hasModuleAccess(userRole, 'maintenance', 'delete')}
										<Button
											variant="ghost"
											size="icon"
											onclick={() => openDelete(item)}
											aria-label="Delete schedule"
										>
											<Trash2 class="size-4 text-destructive" />
										</Button>
									{/if}
								</div>
							</Table.Cell>
						</Table.Row>
						{#if expandedLogs.has(item.id)}
							<Table.Row>
								<Table.Cell colspan={5} class="bg-muted/30 p-4">
									<h4 class="mb-2 text-sm font-medium">{$t.maintenance.completionHistory}</h4>
									{#if item.logs.length === 0}
										<p class="text-sm text-muted-foreground">{$t.maintenance.noLogs}</p>
									{:else}
									<div class="divide-y divide-border rounded-md border bg-background">
										{#each item.logs as log (log.id)}
												<div class="flex items-center justify-between px-3 py-2 text-sm">
													<span>{log.completedDate}</span>
													<span>{log.durationMinutes != null ? `${log.durationMinutes} min` : '—'}</span>
													<span>{log.cost != null ? log.cost : '—'}</span>
													<span class="max-w-[200px] truncate text-muted-foreground">{log.notes ?? '—'}</span>
												</div>
											{/each}
										</div>
									{/if}
								</Table.Cell>
							</Table.Row>
						{/if}
					{/each}
					{#if data.maintenanceSchedules.length === 0}
						<Table.Row>
							<Table.Cell colspan={5} class="text-muted-foreground py-8 text-center">
								{$t.common.noResults}
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.maintenance.newSchedule}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						createOpen = false;
					})}
		>
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="cr-name">{$t.common.name} <span class="text-destructive">*</span></Label>
					<Input id="cr-name" name="name" required placeholder="e.g. HVAC Filter Change" />
				</div>
				<div class="space-y-2">
					<Label for="cr-desc">{$t.common.description}</Label>
					<Textarea id="cr-desc" name="description" placeholder="Optional details" rows={2} />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="cr-freq">Frequency</Label>
						<select id="cr-freq" name="frequency" class={selectClass}>
							{#each frequencies as f}
								<option value={f.value} selected={f.value === 'yearly'}>{f.label}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label for="cr-due">{$t.maintenance.nextDue} <span class="text-destructive">*</span></Label>
						<Input id="cr-due" name="nextDueDate" type="date" required />
					</div>
				</div>
				<div class="space-y-2">
					<Label for="cr-asset">Asset</Label>
					<select id="cr-asset" name="assetId" class={selectClass}>
						<option value="">— None —</option>
						{#each data.assets as asset}
							<option value={asset.id}>{asset.name}</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="cr-cost">Estimated Cost</Label>
						<Input id="cr-cost" name="estimatedCost" type="number" step="0.01" placeholder="0.00" />
					</div>
					<div class="space-y-2">
						<Label for="cr-assignee">Assignee</Label>
						<select id="cr-assignee" name="assigneeId" class={selectClass}>
							<option value="">— Unassigned —</option>
							{#each data.users as user}
								<option value={user.id}>{user.name}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createOpen = false)}>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.create}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	bind:open={editDialogOpen}
	onOpenChange={(o) => {
		if (!o) editItem = null;
	}}
>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Edit Schedule</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/update"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						editDialogOpen = false;
						editItem = null;
					})}
		>
			<input type="hidden" name="id" value={editItem?.id ?? ''} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="ed-name">{$t.common.name} <span class="text-destructive">*</span></Label>
					<Input id="ed-name" name="name" required value={editItem?.name ?? ''} />
				</div>
				<div class="space-y-2">
					<Label for="ed-desc">{$t.common.description}</Label>
					<Textarea id="ed-desc" name="description" rows={2} value={editItem?.description ?? ''} />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="ed-freq">Frequency</Label>
						<select id="ed-freq" name="frequency" class={selectClass}>
							{#each frequencies as f}
								<option value={f.value} selected={f.value === (editItem?.frequency ?? 'yearly')}>
									{f.label}
								</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label for="ed-due">{$t.maintenance.nextDue} <span class="text-destructive">*</span></Label>
						<Input id="ed-due" name="nextDueDate" type="date" required value={editItem?.nextDueDate ?? ''} />
					</div>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="ed-cost">Estimated Cost</Label>
						<Input
							id="ed-cost"
							name="estimatedCost"
							type="number"
							step="0.01"
							value={editItem?.estimatedCost != null ? String(editItem.estimatedCost) : ''}
						/>
					</div>
					<div class="space-y-2">
						<Label for="ed-assignee">Assignee</Label>
						<select id="ed-assignee" name="assigneeId" class={selectClass}>
							<option value="" selected={!editItem?.assigneeId}>— Unassigned —</option>
							{#each data.users as user}
								<option value={user.id} selected={user.id === editItem?.assigneeId}>
									{user.name}
								</option>
							{/each}
						</select>
					</div>
				</div>
			</div>
			<Dialog.Footer>
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						editDialogOpen = false;
						editItem = null;
					}}
				>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.save}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	bind:open={logDialogOpen}
	onOpenChange={(o) => {
		if (!o) logItem = null;
	}}
>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.maintenance.logEntry}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/logCompletion"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						logDialogOpen = false;
						logItem = null;
					})}
		>
			<input type="hidden" name="scheduleId" value={logItem?.id ?? ''} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="log-date">{$t.maintenance.completedDate} <span class="text-destructive">*</span></Label>
					<Input id="log-date" name="completedDate" type="date" required value={new Date().toISOString().slice(0, 10)} />
				</div>
				<div class="space-y-2">
					<Label for="log-notes">{$t.common.notes}</Label>
					<Textarea id="log-notes" name="notes" rows={2} placeholder="Optional notes" />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="log-cost">{$t.maintenance.cost}</Label>
						<Input id="log-cost" name="cost" type="number" step="0.01" placeholder="0.00" />
					</div>
					<div class="space-y-2">
						<Label for="log-duration">{$t.maintenance.duration}</Label>
						<Input id="log-duration" name="durationMinutes" type="number" placeholder="0" />
					</div>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => { logDialogOpen = false; logItem = null; }}>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.save}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
	bind:open={deleteDialogOpen}
	onOpenChange={(o) => {
		if (!o) deleteItem = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Schedule</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{deleteItem?.name}</strong>? This action cannot be
				undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				onclick={() => {
					deleteDialogOpen = false;
					deleteItem = null;
				}}>{$t.common.cancel}</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() =>
					({ update }) =>
						update().then(() => {
							deleteDialogOpen = false;
							deleteItem = null;
						})}
			>
				<input type="hidden" name="id" value={deleteItem?.id ?? ''} />
				<AlertDialog.Action
					type="submit"
					class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				>
					{$t.common.delete}
				</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
