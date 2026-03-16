<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { CornerDownRight, Pencil, Plus, RefreshCw, Trash2, X } from '@lucide/svelte';
	import BulkActions from '$lib/components/bulk-actions.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { t, translate } from '$lib/i18n/index.js';
	import { hasModuleAccess } from '$lib/permissions.js';
	import { selectClass } from '$lib/utils.js';

	let { data } = $props();
	const userRole = $derived(page.data.user?.role ?? 'guest');

	let createOpen = $state(false);
	let editDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let addTagOpen = $state(false);
	let tagTaskId = $state('');
	let createParentId = $state<string | null>(null);
	let createRecurring = $state(false);
	let editRecurring = $state(false);
	let selectedIds = $state<Set<string>>(new Set());
	let bulkDeleteDialogOpen = $state(false);

	const recurrenceOptions = [
		{ value: 'FREQ=DAILY', label: $t.tasks.recurrence.daily },
		{ value: 'FREQ=WEEKLY', label: $t.tasks.recurrence.weekly },
		{ value: 'FREQ=MONTHLY', label: $t.tasks.recurrence.monthly },
		{ value: 'FREQ=YEARLY', label: $t.tasks.recurrence.yearly }
	];

	type Task = (typeof data.tasks)[0];
	let editTask = $state<Task | null>(null);
	let deleteTask = $state<Task | null>(null);

	const topLevelTasks = $derived(data.tasks.filter((t) => !t.parentId));
	const selectedIdsValue = $derived(Array.from(selectedIds).join(','));
	const visibleTopLevelTaskIds = $derived(topLevelTasks.map((task) => task.id));
	const allVisibleSelected = $derived(
		visibleTopLevelTaskIds.length > 0 && visibleTopLevelTaskIds.every((id) => selectedIds.has(id))
	);

	function getSubtasks(parentId: string) {
		return data.tasks.filter((t) => t.parentId === parentId);
	}

	function clearSelection() {
		selectedIds = new Set();
	}

	function toggleTaskSelection(taskId: string, checked: boolean) {
		const next = new Set(selectedIds);
		if (checked) {
			next.add(taskId);
		} else {
			next.delete(taskId);
		}
		selectedIds = next;
	}

	function toggleAllTopLevel(checked: boolean) {
		const next = new Set(selectedIds);
		for (const id of visibleTopLevelTaskIds) {
			if (checked) {
				next.add(id);
			} else {
				next.delete(id);
			}
		}
		selectedIds = next;
	}

	function openCreateSubtask(parentId: string) {
		createParentId = parentId;
		createOpen = true;
	}

	function openEdit(task: Task) {
		editTask = task;
		editRecurring = task.isRecurring;
		editDialogOpen = true;
	}

	function openDelete(task: Task) {
		deleteTask = task;
		deleteDialogOpen = true;
	}

	function openAddTag(taskId: string) {
		tagTaskId = taskId;
		addTagOpen = true;
	}

	function getTaskTags(taskId: string) {
		return data.taskTags.filter((tag) => tag.entityId === taskId);
	}

	function getAvailableTaskTags(taskId: string) {
		const assignedTagIds = new Set(getTaskTags(taskId).map((tag) => tag.tagId));
		return data.allTags.filter((tag) => !assignedTagIds.has(tag.id));
	}

	const statuses: { value: string; label: string }[] = [
		{ value: 'todo', label: $t.tasks.status.todo },
		{ value: 'in_progress', label: $t.tasks.status.in_progress },
		{ value: 'blocked', label: $t.tasks.status.blocked },
		{ value: 'done', label: $t.tasks.status.done },
		{ value: 'cancelled', label: $t.tasks.status.cancelled }
	];

	const priorities: { value: string; label: string }[] = [
		{ value: 'low', label: $t.tasks.priority.low },
		{ value: 'medium', label: $t.tasks.priority.medium },
		{ value: 'high', label: $t.tasks.priority.high },
		{ value: 'urgent', label: $t.tasks.priority.urgent }
	];

	const selectedTask = $derived(data.tasks.find((task) => task.id === tagTaskId) ?? null);
	const availableDialogTags = $derived(tagTaskId ? getAvailableTaskTags(tagTaskId) : []);
</script>

{#snippet taskRow(task: Task, depth: number)}
	<Table.Row class={depth > 0 ? 'bg-muted/20' : ''}>
		<Table.Cell>
			<input
				type="checkbox"
				aria-label={`Select ${task.title}`}
				checked={selectedIds.has(task.id)}
				onchange={(e) => toggleTaskSelection(task.id, e.currentTarget.checked)}
			/>
		</Table.Cell>
		<Table.Cell class="font-medium">
			<div class="space-y-1" style={depth > 0 ? 'padding-left: 1.5rem' : ''}>
				<div class="flex items-center gap-1.5">
					{#if depth > 0}
						<CornerDownRight class="size-3.5 text-muted-foreground" />
					{/if}
					{task.title}
					{#if task.isRecurring}
						<RefreshCw class="size-3.5 text-muted-foreground" />
					{/if}
				</div>
				<div class="flex flex-wrap items-center gap-1">
					{#each getTaskTags(task.id) as tag (tag.tagId)}
						<span
							class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-normal"
							style={tag.tagColor ? `border-color: ${tag.tagColor}; color: ${tag.tagColor}` : ''}
						>
							{tag.tagName}
							{#if hasModuleAccess(userRole, 'tasks', 'edit')}
								<form method="POST" action="?/removeTag" use:enhance class="inline">
									<input type="hidden" name="entityId" value={task.id} />
									<input type="hidden" name="tagId" value={tag.tagId} />
									<button type="submit" class="hover:text-destructive" aria-label={$t.common.removeTag}>
										<X class="size-3" />
									</button>
								</form>
							{/if}
						</span>
					{/each}
					{#if hasModuleAccess(userRole, 'tasks', 'edit')}
						<Button
							type="button"
							size="sm"
							variant="ghost"
							onclick={() => openAddTag(task.id)}
							class="h-5 px-1"
						>
							<Plus class="size-3" />
						</Button>
					{/if}
				</div>
			</div>
		</Table.Cell>
		<Table.Cell>
			{#if hasModuleAccess(userRole, 'tasks', 'edit')}
				<form
					method="POST"
					action="?/updateStatus"
					use:enhance={() => ({ update }) => update({ reset: false })}
				>
					<input type="hidden" name="id" value={task.id} />
					<select
						name="status"
						class={selectClass}
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
					>
						{#each statuses as s}
							<option value={s.value} selected={task.status === s.value}>{s.label}</option>
						{/each}
					</select>
				</form>
			{:else}
				<Badge variant="outline">{statuses.find((s) => s.value === task.status)?.label ?? task.status}</Badge>
			{/if}
		</Table.Cell>
		<Table.Cell><Badge>{task.priority}</Badge></Table.Cell>
		<Table.Cell>{data.users.find((u) => u.id === task.assigneeId)?.name ?? '—'}</Table.Cell>
		<Table.Cell>{task.dueDate ?? '—'}</Table.Cell>
		<Table.Cell>
			<div class="flex items-center gap-1">
				{#if hasModuleAccess(userRole, 'tasks', 'create') && depth === 0}
					<Button
						variant="ghost"
						size="icon"
						onclick={() => openCreateSubtask(task.id)}
						aria-label={$t.tasks.newSubtask}
					>
						<CornerDownRight class="size-4" />
					</Button>
				{/if}
				{#if hasModuleAccess(userRole, 'tasks', 'edit')}
					<Button
						variant="ghost"
						size="icon"
						onclick={() => openEdit(task)}
						aria-label="Edit task"
					>
						<Pencil class="size-4" />
					</Button>
				{/if}
				{#if hasModuleAccess(userRole, 'tasks', 'delete')}
					<Button
						variant="ghost"
						size="icon"
						onclick={() => openDelete(task)}
						aria-label="Delete task"
					>
						<Trash2 class="size-4 text-destructive" />
					</Button>
				{/if}
			</div>
		</Table.Cell>
	</Table.Row>
{/snippet}

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">{$t.tasks.title}</h1>
		{#if hasModuleAccess(userRole, 'tasks', 'create')}
			<Button onclick={() => { createParentId = null; createOpen = true; }}><Plus class="size-4" />{$t.tasks.newTask}</Button>
		{/if}
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>{$t.common.filter}</Card.Title>
		</Card.Header>
		<Card.Content class="grid gap-4 md:grid-cols-3">
			<div class="space-y-2"><Label for="status">{$t.common.status}</Label><Input id="status" /></div>
			<div class="space-y-2"><Label for="assignee">{$t.tasks.assignee}</Label><Input id="assignee" /></div>
			<div class="space-y-2"><Label for="dueDate">{$t.tasks.dueDate}</Label><Input id="dueDate" type="date" /></div>
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
								checked={allVisibleSelected}
								onchange={(e) => toggleAllTopLevel(e.currentTarget.checked)}
							/>
						</Table.Head>
						<Table.Head>{$t.common.name}</Table.Head>
						<Table.Head>{$t.common.status}</Table.Head>
						<Table.Head>{$t.common.priority}</Table.Head>
						<Table.Head>{$t.tasks.assignee}</Table.Head>
						<Table.Head>{$t.tasks.dueDate}</Table.Head>
						<Table.Head class="w-[120px]">{$t.common.actions}</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each topLevelTasks as task (task.id)}
						{@render taskRow(task, 0)}
						{#each getSubtasks(task.id) as subtask (subtask.id)}
							{@render taskRow(subtask, 1)}
						{/each}
					{/each}
					{#if data.tasks.length === 0}
						<Table.Row>
							<Table.Cell colspan={7} class="text-muted-foreground py-8 text-center">
								{$t.common.noResults}
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>

<BulkActions selectedCount={selectedIds.size} onDeselectAll={clearSelection}>
	{#snippet children()}
		{#if hasModuleAccess(userRole, 'tasks', 'edit')}
			<form
				method="POST"
				action="?/bulkUpdateStatus"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							clearSelection();
						}
						await update({ reset: false });
					};
				}}
			>
				<input type="hidden" name="ids" value={selectedIdsValue} />
				<select
					name="status"
					class={selectClass}
					onchange={(e) => e.currentTarget.form?.requestSubmit()}
				>
					<option value="">{$t.common.bulkChangeStatus}</option>
					{#each statuses as s}
						<option value={s.value}>{s.label}</option>
					{/each}
				</select>
			</form>
			<form
				method="POST"
				action="?/bulkAssign"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							clearSelection();
						}
						await update({ reset: false });
					};
				}}
			>
				<input type="hidden" name="ids" value={selectedIdsValue} />
				<select
					name="assigneeId"
					class={selectClass}
					onchange={(e) => {
						if (e.currentTarget.value !== '__placeholder__') {
							e.currentTarget.form?.requestSubmit();
						}
					}}
				>
					<option value="__placeholder__">{$t.common.bulkAssign}</option>
					<option value="">{$t.common.unassigned}</option>
					{#each data.users as user}
						<option value={user.id}>{user.name}</option>
					{/each}
				</select>
			</form>
		{/if}
		{#if hasModuleAccess(userRole, 'tasks', 'delete')}
			<Button type="button" variant="destructive" onclick={() => (bulkDeleteDialogOpen = true)}>
				{$t.common.bulkDelete}
			</Button>
		{/if}
	{/snippet}
</BulkActions>

<AlertDialog.Root bind:open={bulkDeleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{$t.common.bulkDelete}</AlertDialog.Title>
			<AlertDialog.Description>
				{translate('common.bulkDeleteConfirm', { count: selectedIds.size })}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (bulkDeleteDialogOpen = false)}>Cancel</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/bulkDelete"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							bulkDeleteDialogOpen = false;
							clearSelection();
						}
						await update();
					};
				}}
			>
				<input type="hidden" name="ids" value={selectedIdsValue} />
				<AlertDialog.Action
					type="submit"
					class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				>
					Delete
				</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<Dialog.Root bind:open={createOpen} onOpenChange={(o) => { if (!o) createParentId = null; }}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{createParentId ? $t.tasks.newSubtask : $t.tasks.newTask}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						createOpen = false;
						createParentId = null;
						createRecurring = false;
					})}
		>
			{#if createParentId}
				<input type="hidden" name="parentId" value={createParentId} />
			{/if}
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="create-title"
						>{$t.common.name} <span class="text-destructive">*</span></Label
					>
					<Input id="create-title" name="title" required placeholder="Task title" />
				</div>
				<div class="space-y-2">
					<Label for="create-description">{$t.common.description}</Label>
					<Input id="create-description" name="description" placeholder="Optional description" />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="create-priority">{$t.common.priority}</Label>
						<select id="create-priority" name="priority" class={selectClass}>
							{#each priorities as p}
								<option value={p.value} selected={p.value === 'medium'}>{p.label}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label for="create-status">{$t.common.status}</Label>
						<select id="create-status" name="status" class={selectClass}>
							{#each statuses as s}
								<option value={s.value} selected={s.value === 'todo'}>{s.label}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="space-y-2">
					<Label for="create-assignee">{$t.tasks.assignee}</Label>
					<select id="create-assignee" name="assigneeId" class={selectClass}>
						<option value="">— Unassigned —</option>
						{#each data.users as user}
							<option value={user.id}>{user.name}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-2">
					<Label for="create-dueDate">{$t.tasks.dueDate}</Label>
					<Input id="create-dueDate" name="dueDate" type="date" />
				</div>
				<div class="space-y-2">
					<div class="flex items-center gap-2">
						<input
							type="checkbox"
							id="create-recurring"
							name="isRecurring"
							class="size-4 rounded border"
							checked={createRecurring}
							onchange={(e) => (createRecurring = e.currentTarget.checked)}
						/>
						<Label for="create-recurring">{$t.tasks.recurring}</Label>
					</div>
					{#if createRecurring}
						<select id="create-recurrenceRule" name="recurrenceRule" class={selectClass}>
							{#each recurrenceOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					{/if}
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
		if (!o) editTask = null;
	}}
>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Edit Task</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/update"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						editDialogOpen = false;
						editTask = null;
					})}
		>
			<input type="hidden" name="id" value={editTask?.id ?? ''} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="edit-title"
						>{$t.common.name} <span class="text-destructive">*</span></Label
					>
					<Input id="edit-title" name="title" required value={editTask?.title ?? ''} />
				</div>
				<div class="space-y-2">
					<Label for="edit-description">{$t.common.description}</Label>
					<Input id="edit-description" name="description" value={editTask?.description ?? ''} />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="edit-priority">{$t.common.priority}</Label>
						<select id="edit-priority" name="priority" class={selectClass}>
							{#each priorities as p}
								<option value={p.value} selected={p.value === (editTask?.priority ?? 'medium')}>
									{p.label}
								</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label for="edit-status">{$t.common.status}</Label>
						<select id="edit-status" name="status" class={selectClass}>
							{#each statuses as s}
								<option value={s.value} selected={s.value === (editTask?.status ?? 'todo')}>
									{s.label}
								</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="space-y-2">
					<Label for="edit-assignee">{$t.tasks.assignee}</Label>
					<select id="edit-assignee" name="assigneeId" class={selectClass}>
						<option value="" selected={!editTask?.assigneeId}>— Unassigned —</option>
						{#each data.users as user}
							<option value={user.id} selected={user.id === editTask?.assigneeId}>
								{user.name}
							</option>
						{/each}
					</select>
				</div>
				<div class="space-y-2">
					<Label for="edit-dueDate">{$t.tasks.dueDate}</Label>
					<Input id="edit-dueDate" name="dueDate" type="date" value={editTask?.dueDate ?? ''} />
				</div>
				<div class="space-y-2">
					<div class="flex items-center gap-2">
						<input
							type="checkbox"
							id="edit-recurring"
							name="isRecurring"
							class="size-4 rounded border"
							checked={editRecurring}
							onchange={(e) => (editRecurring = e.currentTarget.checked)}
						/>
						<Label for="edit-recurring">{$t.tasks.recurring}</Label>
					</div>
					{#if editRecurring}
						<select id="edit-recurrenceRule" name="recurrenceRule" class={selectClass}>
							{#each recurrenceOptions as opt}
								<option value={opt.value} selected={opt.value === (editTask?.recurrenceRule ?? 'FREQ=WEEKLY')}>{opt.label}</option>
							{/each}
						</select>
					{/if}
				</div>
			</div>
			<Dialog.Footer>
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						editDialogOpen = false;
						editTask = null;
					}}
				>
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
		if (!o) deleteTask = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Task</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{deleteTask?.title}</strong>? This action cannot be
				undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				onclick={() => {
					deleteDialogOpen = false;
					deleteTask = null;
				}}>{$t.common.cancel}</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() =>
					({ update }) =>
						update().then(() => {
							deleteDialogOpen = false;
							deleteTask = null;
						})}
			>
				<input type="hidden" name="id" value={deleteTask?.id ?? ''} />
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

<Dialog.Root
	bind:open={addTagOpen}
	onOpenChange={(o) => {
		if (!o) tagTaskId = '';
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$t.common.addTag}</Dialog.Title>
		</Dialog.Header>
		{#if selectedTask}
			{#if availableDialogTags.length > 0}
				<form
					method="POST"
					action="?/addTag"
					use:enhance={() =>
						({ update }) =>
							update().then(() => {
								addTagOpen = false;
								tagTaskId = '';
							})}
				>
					<input type="hidden" name="entityId" value={selectedTask.id} />
					<div class="space-y-4 py-4">
						<div class="space-y-2">
							<Label for="task-tag-id">{$t.common.selectTag}</Label>
							<select id="task-tag-id" name="tagId" required class={selectClass}>
								<option value="">{$t.common.selectTag}</option>
								{#each availableDialogTags as tag}
									<option value={tag.id}>{tag.name}</option>
								{/each}
							</select>
						</div>
					</div>
					<Dialog.Footer>
						<Button
							type="button"
							variant="outline"
							onclick={() => {
								addTagOpen = false;
								tagTaskId = '';
							}}
						>
							{$t.common.cancel}
						</Button>
						<Button type="submit">{$t.common.addTag}</Button>
					</Dialog.Footer>
				</form>
			{:else}
				<p class="py-4 text-sm text-muted-foreground">{$t.common.noAvailable}</p>
			{/if}
		{/if}
	</Dialog.Content>
</Dialog.Root>
