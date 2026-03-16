<script lang="ts">
	import { ArrowLeft, Pencil, Plus, Trash2, X } from '@lucide/svelte';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { t } from '$lib/i18n/index.js';
	import { hasModuleAccess } from '$lib/permissions.js';

	let { data } = $props();
	const userRole = $derived(page.data.user?.role ?? 'guest');

	let editOpen = $state(false);
	let deleteOpen = $state(false);
	let linkRoomOpen = $state(false);
	let linkAssetOpen = $state(false);
	let linkDocumentOpen = $state(false);
	let addTagOpen = $state(false);
	let createPhaseOpen = $state(false);
	let editPhaseOpen = $state(false);
	let deletePhaseOpen = $state(false);

	type Phase = (typeof data.phases)[0];
	let phaseToEdit = $state<Phase | null>(null);
	let phaseToDelete = $state<Phase | null>(null);

	const availableRooms = $derived(
		data.allRooms.filter((room) => !data.projectRooms.some((projectRoom) => projectRoom.id === room.id))
	);
	const availableAssets = $derived(
		data.allAssets.filter(
			(asset) => !data.projectAssets.some((projectAsset) => projectAsset.id === asset.id)
		)
	);
	const availableDocuments = $derived(
		data.allDocuments.filter(
			(document) => !data.projectDocuments.some((projectDocument) => projectDocument.id === document.id)
		)
	);
	const availableTags = $derived(
		data.allTags.filter((tag) => !data.entityTags.some((entityTag) => entityTag.tagId === tag.id))
	);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<p class="text-sm text-muted-foreground">{$t.projects.title}</p>
			<h1 class="text-2xl font-semibold">{data.project.name}</h1>
		</div>
		<div class="flex items-center gap-2">
			{#if hasModuleAccess(userRole, 'projects', 'edit')}
				<Button variant="outline" onclick={() => (editOpen = true)}>
					<Pencil class="size-4" />{$t.common.edit}
				</Button>
			{/if}
			{#if hasModuleAccess(userRole, 'projects', 'delete')}
				<Button variant="destructive" onclick={() => (deleteOpen = true)}>
					<Trash2 class="size-4" />{$t.common.delete}
				</Button>
			{/if}
			<Button href="/projects" variant="outline"><ArrowLeft class="size-4" />{$t.common.back}</Button>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-1">
		{#each data.entityTags as tag (tag.tagId)}
			<span
				class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
				style={tag.tagColor ? `border-color: ${tag.tagColor}; color: ${tag.tagColor}` : ''}
			>
				{tag.tagName}
				{#if hasModuleAccess(userRole, 'projects', 'edit')}
					<form method="POST" action="?/removeTag" use:enhance class="inline">
						<input type="hidden" name="entityId" value={data.project.id} />
						<input type="hidden" name="tagId" value={tag.tagId} />
						<button type="submit" class="hover:text-destructive" aria-label={$t.common.removeTag}>
							<X class="size-3" />
						</button>
					</form>
				{/if}
			</span>
		{/each}
		{#if hasModuleAccess(userRole, 'projects', 'edit')}
			<Button size="sm" variant="ghost" onclick={() => (addTagOpen = true)} class="h-6 px-1">
				<Plus class="size-3" />
			</Button>
		{/if}
	</div>

	<Card.Root>
		<Card.Content class="grid gap-3 pt-6 md:grid-cols-3">
			<div>
				<p class="text-xs text-muted-foreground">{$t.common.status}</p>
				<Badge>{data.project.status}</Badge>
			</div>
			<div>
				<p class="text-xs text-muted-foreground">{$t.projects.budget}</p>
				<p class="font-medium">{data.project.budgetAmount}</p>
			</div>
			<div>
				<p class="text-xs text-muted-foreground">{$t.projects.progress}</p>
				<Progress value={data.project.progressPercent} />
			</div>
		</Card.Content>
	</Card.Root>

	<Tabs.Root value="overview" class="space-y-4">
		<Tabs.List>
			<Tabs.Trigger value="overview">{$t.common.description}</Tabs.Trigger>
			<Tabs.Trigger value="tasks">{$t.projects.tasks}</Tabs.Trigger>
			<Tabs.Trigger value="expenses">{$t.projects.expenses}</Tabs.Trigger>
			<Tabs.Trigger value="documents">{$t.projects.linkedDocuments}</Tabs.Trigger>
			<Tabs.Trigger value="rooms">{$t.projects.linkedRooms}</Tabs.Trigger>
			<Tabs.Trigger value="assets">{$t.projects.linkedAssets}</Tabs.Trigger>
			<Tabs.Trigger value="phases">{$t.projects.phases}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="overview">
			<Card.Root><Card.Content class="pt-6">{data.project.description}</Card.Content></Card.Root>
		</Tabs.Content>

		<Tabs.Content value="tasks">
			<Card.Root>
				<Card.Content class="pt-6">
					<Table.Root>
						<Table.Header><Table.Row><Table.Head>{$t.common.name}</Table.Head><Table.Head>{$t.tasks.dueDate}</Table.Head></Table.Row></Table.Header>
					<Table.Body>
						{#each data.projectTasks as task (task.id)}
								<Table.Row><Table.Cell><a href="/tasks" class="hover:underline">{task.title}</a></Table.Cell><Table.Cell>{task.dueDate}</Table.Cell></Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="expenses">
			<Card.Root>
			<Card.Content class="pt-6 space-y-2">
				{#each data.projectExpenses as expense (expense.id)}
						<div class="flex items-center justify-between rounded-md border p-2 text-sm">
							<span>{expense.description}</span><span>{expense.amount}</span>
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="documents">
			<Card.Root>
				<Card.Content class="pt-6 space-y-2">
					<div class="mb-2 flex items-center justify-between">
						<p class="text-sm font-medium">{$t.projects.linkedDocuments}</p>
						{#if hasModuleAccess(userRole, 'projects', 'edit')}
							<Button size="sm" variant="outline" onclick={() => (linkDocumentOpen = true)}>
								<Plus class="size-4" />
								{$t.common.link}
							</Button>
						{/if}
					</div>
					{#each data.projectDocuments as document (document.id)}
						<div class="flex items-center justify-between rounded-md border p-2 text-sm">
							<a href="/documents" class="hover:underline">{document.title}</a>
							{#if hasModuleAccess(userRole, 'projects', 'edit')}
								<form method="POST" action="?/unlinkDocument" use:enhance>
									<input type="hidden" name="projectId" value={data.project.id} />
									<input type="hidden" name="documentId" value={document.id} />
									<button
										type="submit"
										class="text-muted-foreground hover:text-destructive"
										aria-label={$t.common.unlink}
									>
										<X class="size-4" />
									</button>
								</form>
							{/if}
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="rooms">
			<Card.Root>
				<Card.Content class="pt-6 space-y-2">
					<div class="mb-2 flex items-center justify-between">
						<p class="text-sm font-medium">{$t.projects.linkedRooms}</p>
						{#if hasModuleAccess(userRole, 'projects', 'edit')}
							<Button size="sm" variant="outline" onclick={() => (linkRoomOpen = true)}>
								<Plus class="size-4" />
								{$t.common.link}
							</Button>
						{/if}
					</div>
					{#each data.projectRooms as room (room.id)}
						<div class="flex items-center justify-between rounded-md border p-2 text-sm">
							<a href={`/rooms/${room.id}`} class="hover:underline">{room.name}</a>
							{#if hasModuleAccess(userRole, 'projects', 'edit')}
								<form method="POST" action="?/unlinkRoom" use:enhance>
									<input type="hidden" name="projectId" value={data.project.id} />
									<input type="hidden" name="roomId" value={room.id} />
									<button
										type="submit"
										class="text-muted-foreground hover:text-destructive"
										aria-label={$t.common.unlink}
									>
										<X class="size-4" />
									</button>
								</form>
							{/if}
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="assets">
			<Card.Root>
				<Card.Content class="pt-6 space-y-2">
					<div class="mb-2 flex items-center justify-between">
						<p class="text-sm font-medium">{$t.projects.linkedAssets}</p>
						{#if hasModuleAccess(userRole, 'projects', 'edit')}
							<Button size="sm" variant="outline" onclick={() => (linkAssetOpen = true)}>
								<Plus class="size-4" />
								{$t.common.link}
							</Button>
						{/if}
					</div>
					{#each data.projectAssets as asset (asset.id)}
						<div class="flex items-center justify-between rounded-md border p-2 text-sm">
							<a href={`/assets/${asset.id}`} class="hover:underline">{asset.name}</a>
							{#if hasModuleAccess(userRole, 'projects', 'edit')}
								<form method="POST" action="?/unlinkAsset" use:enhance>
									<input type="hidden" name="projectId" value={data.project.id} />
									<input type="hidden" name="assetId" value={asset.id} />
									<button
										type="submit"
										class="text-muted-foreground hover:text-destructive"
										aria-label={$t.common.unlink}
									>
										<X class="size-4" />
									</button>
								</form>
							{/if}
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

	<Tabs.Content value="phases">
		<Card.Root>
			<Card.Content class="pt-6 space-y-2">
			<div class="mb-2 flex items-center justify-between">
				<p class="text-sm font-medium">{$t.projects.phases}</p>
				{#if hasModuleAccess(userRole, 'projects', 'create')}
					<Button size="sm" variant="outline" onclick={() => (createPhaseOpen = true)}>
						<Plus class="size-4" />{$t.projects.newPhase}
					</Button>
				{/if}
			</div>
			{#each data.phases as phase (phase.id)}
					<div class="flex items-center justify-between rounded-md border p-2 text-sm">
						<div>
							<span class="font-medium">{phase.name}</span>
							<Badge variant="outline" class="ml-2">{$t.projects.status[phase.status as keyof typeof $t.projects.status] ?? phase.status}</Badge>
						</div>
						<div class="flex items-center gap-1">
							{#if hasModuleAccess(userRole, 'projects', 'edit')}
								<button onclick={() => { phaseToEdit = phase; editPhaseOpen = true; }} class="text-muted-foreground hover:text-foreground" aria-label={$t.common.edit}>
									<Pencil class="size-4" />
								</button>
							{/if}
							{#if hasModuleAccess(userRole, 'projects', 'delete')}
								<button onclick={() => { phaseToDelete = phase; deletePhaseOpen = true; }} class="text-muted-foreground hover:text-destructive" aria-label={$t.common.delete}>
									<Trash2 class="size-4" />
								</button>
							{/if}
						</div>
					</div>
				{/each}
				{#if data.phases.length === 0}
					<p class="text-muted-foreground py-4 text-center text-sm">{$t.common.noResults}</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</Tabs.Content>
	</Tabs.Root>
</div>

<Dialog.Root bind:open={editOpen}>
	<Dialog.Content class="sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>{$t.projects.editProject}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						editOpen = false;
					}
					await update();
				};
			}}
		>
			<input type="hidden" name="id" value={data.project.id} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="edit-name">{$t.common.name} *</Label>
					<Input id="edit-name" name="name" value={data.project.name} required />
				</div>
				<div class="space-y-2">
					<Label for="edit-description">{$t.common.description}</Label>
					<Textarea id="edit-description" name="description" rows={3} value={data.project.description ?? ''}/>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="edit-type">{$t.common.type}</Label>
						<NativeSelect.Root id="edit-type" name="type" value={data.project.type} class="w-full">
							<option value="renovation">{$t.projects.type.renovation}</option>
							<option value="repair">{$t.projects.type.repair}</option>
							<option value="installation">{$t.projects.type.installation}</option>
							<option value="decoration">{$t.projects.type.decoration}</option>
							<option value="landscaping">{$t.projects.type.landscaping}</option>
							<option value="construction">{$t.projects.type.construction}</option>
							<option value="administrative">{$t.projects.type.administrative}</option>
							<option value="other">{$t.projects.type.other}</option>
						</NativeSelect.Root>
					</div>
					<div class="space-y-2">
						<Label for="edit-status">{$t.common.status}</Label>
						<NativeSelect.Root id="edit-status" name="status" value={data.project.status} class="w-full">
							<option value="planning">{$t.projects.status.planning}</option>
							<option value="in_progress">{$t.projects.status.in_progress}</option>
							<option value="on_hold">{$t.projects.status.on_hold}</option>
							<option value="completed">{$t.projects.status.completed}</option>
							<option value="cancelled">{$t.projects.status.cancelled}</option>
						</NativeSelect.Root>
					</div>
				</div>
				<div class="space-y-2">
					<Label for="edit-priority">{$t.common.priority}</Label>
					<NativeSelect.Root id="edit-priority" name="priority" value={data.project.priority} class="w-full">
						<option value="low">{$t.tasks.priority.low}</option>
						<option value="medium">{$t.tasks.priority.medium}</option>
						<option value="high">{$t.tasks.priority.high}</option>
						<option value="urgent">{$t.tasks.priority.urgent}</option>
					</NativeSelect.Root>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="edit-startDate">Start Date</Label>
						<Input id="edit-startDate" name="startDate" type="date" value={data.project.startDate ?? ''} />
					</div>
					<div class="space-y-2">
						<Label for="edit-endDate">End Date</Label>
						<Input id="edit-endDate" name="endDate" type="date" value={data.project.endDate ?? ''} />
					</div>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="edit-budgetAmount">{$t.projects.budget}</Label>
						<Input id="edit-budgetAmount" name="budgetAmount" type="number" min="0" step="0.01" value={data.project.budgetAmount ?? ''} />
					</div>
					<div class="space-y-2">
						<Label for="edit-progressPercent">{$t.projects.progress} (%)</Label>
						<Input id="edit-progressPercent" name="progressPercent" type="number" min="0" max="100" value={data.project.progressPercent} />
					</div>
				</div>
			</div>
			<Dialog.Footer>
				<Dialog.Close>
					<Button type="button" variant="outline">{$t.common.cancel}</Button>
				</Dialog.Close>
				<Button type="submit">{$t.common.save}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={deleteOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Project?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. "{data.project.name}" will be permanently deleted.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{$t.common.cancel}</AlertDialog.Cancel>
			<form method="POST" action="?/delete" use:enhance>
				<input type="hidden" name="id" value={data.project.id} />
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

<Dialog.Root bind:open={addTagOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$t.common.addTag}</Dialog.Title>
		</Dialog.Header>
		{#if availableTags.length > 0}
			<form
				method="POST"
				action="?/addTag"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') addTagOpen = false;
						await update();
					};
				}}
			>
				<input type="hidden" name="entityId" value={data.project.id} />
				<div class="space-y-4 py-4">
					<div class="space-y-2">
						<Label for="project-tag-id">{$t.common.selectTag}</Label>
						<NativeSelect.Root id="project-tag-id" name="tagId" required class="w-full">
							<option value="">{$t.common.selectTag}</option>
							{#each availableTags as tag}
								<option value={tag.id}>{tag.name}</option>
							{/each}
						</NativeSelect.Root>
					</div>
				</div>
				<Dialog.Footer>
					<Dialog.Close>
						<Button type="button" variant="outline">{$t.common.cancel}</Button>
					</Dialog.Close>
					<Button type="submit">{$t.common.addTag}</Button>
				</Dialog.Footer>
			</form>
		{:else}
			<p class="py-4 text-sm text-muted-foreground">{$t.common.noAvailable}</p>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={linkRoomOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$t.common.linkRoom}</Dialog.Title>
		</Dialog.Header>
		{#if availableRooms.length > 0}
			<form
				method="POST"
				action="?/linkRoom"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') linkRoomOpen = false;
						await update();
					};
				}}
			>
				<input type="hidden" name="projectId" value={data.project.id} />
				<div class="space-y-4 py-4">
					<div class="space-y-2">
						<Label for="link-room">{$t.common.selectRoom}</Label>
						<NativeSelect.Root id="link-room" name="roomId" required class="w-full">
							<option value="">{$t.common.selectRoom}</option>
							{#each availableRooms as room}
								<option value={room.id}>{room.name}</option>
							{/each}
						</NativeSelect.Root>
					</div>
				</div>
				<Dialog.Footer>
					<Dialog.Close><Button type="button" variant="outline">{$t.common.cancel}</Button></Dialog.Close>
					<Button type="submit">{$t.common.link}</Button>
				</Dialog.Footer>
			</form>
		{:else}
			<p class="py-4 text-sm text-muted-foreground">{$t.common.noAvailable}</p>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={linkAssetOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$t.common.linkAsset}</Dialog.Title>
		</Dialog.Header>
		{#if availableAssets.length > 0}
			<form
				method="POST"
				action="?/linkAsset"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') linkAssetOpen = false;
						await update();
					};
				}}
			>
				<input type="hidden" name="projectId" value={data.project.id} />
				<div class="space-y-4 py-4">
					<div class="space-y-2">
						<Label for="link-asset">{$t.common.selectAsset}</Label>
						<NativeSelect.Root id="link-asset" name="assetId" required class="w-full">
							<option value="">{$t.common.selectAsset}</option>
							{#each availableAssets as asset}
								<option value={asset.id}>{asset.name}</option>
							{/each}
						</NativeSelect.Root>
					</div>
					<div class="space-y-2">
						<Label for="link-asset-relationship">{$t.common.relationship}</Label>
						<NativeSelect.Root
							id="link-asset-relationship"
							name="relationship"
							class="w-full"
						>
							<option value="affected">affected</option>
							<option value="installed">installed</option>
							<option value="replaced">replaced</option>
							<option value="repaired">repaired</option>
						</NativeSelect.Root>
					</div>
				</div>
				<Dialog.Footer>
					<Dialog.Close><Button type="button" variant="outline">{$t.common.cancel}</Button></Dialog.Close>
					<Button type="submit">{$t.common.link}</Button>
				</Dialog.Footer>
			</form>
		{:else}
			<p class="py-4 text-sm text-muted-foreground">{$t.common.noAvailable}</p>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={linkDocumentOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$t.common.linkDocument}</Dialog.Title>
		</Dialog.Header>
		{#if availableDocuments.length > 0}
			<form
				method="POST"
				action="?/linkDocument"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') linkDocumentOpen = false;
						await update();
					};
				}}
			>
				<input type="hidden" name="projectId" value={data.project.id} />
				<div class="space-y-4 py-4">
					<div class="space-y-2">
						<Label for="link-document">{$t.common.selectDocument}</Label>
						<NativeSelect.Root id="link-document" name="documentId" required class="w-full">
							<option value="">{$t.common.selectDocument}</option>
							{#each availableDocuments as document}
								<option value={document.id}>{document.title}</option>
							{/each}
						</NativeSelect.Root>
					</div>
				</div>
				<Dialog.Footer>
					<Dialog.Close><Button type="button" variant="outline">{$t.common.cancel}</Button></Dialog.Close>
					<Button type="submit">{$t.common.link}</Button>
				</Dialog.Footer>
			</form>
		{:else}
			<p class="py-4 text-sm text-muted-foreground">{$t.common.noAvailable}</p>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={createPhaseOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header><Dialog.Title>{$t.projects.newPhase}</Dialog.Title></Dialog.Header>
		<form method="POST" action="?/createPhase"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') createPhaseOpen = false;
					await update();
				};
			}}
		>
			<input type="hidden" name="projectId" value={data.project.id} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="phase-name">{$t.common.name} <span class="text-destructive">*</span></Label>
					<Input id="phase-name" name="name" required />
				</div>
				<div class="space-y-2">
					<Label for="phase-description">{$t.common.description}</Label>
					<Textarea id="phase-description" name="description" rows={2} />
				</div>
				<div class="space-y-2">
					<Label for="phase-status">{$t.common.status}</Label>
					<NativeSelect.Root id="phase-status" name="status" value="planning" class="w-full">
						<option value="planning">{$t.projects.status.planning}</option>
						<option value="in_progress">{$t.projects.status.in_progress}</option>
						<option value="on_hold">{$t.projects.status.on_hold}</option>
						<option value="completed">{$t.projects.status.completed}</option>
						<option value="cancelled">{$t.projects.status.cancelled}</option>
					</NativeSelect.Root>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="phase-start">Start Date</Label>
						<Input id="phase-start" name="startDate" type="date" />
					</div>
					<div class="space-y-2">
						<Label for="phase-end">End Date</Label>
						<Input id="phase-end" name="endDate" type="date" />
					</div>
				</div>
			</div>
			<Dialog.Footer>
				<Dialog.Close><Button type="button" variant="outline">{$t.common.cancel}</Button></Dialog.Close>
				<Button type="submit">{$t.common.create}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editPhaseOpen} onOpenChange={(o) => { if (!o) phaseToEdit = null; }}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header><Dialog.Title>{$t.projects.editPhase}</Dialog.Title></Dialog.Header>
		{#if phaseToEdit}
			<form method="POST" action="?/updatePhase"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') editPhaseOpen = false;
						await update();
					};
				}}
			>
				<input type="hidden" name="id" value={phaseToEdit.id} />
				<div class="grid gap-4 py-4">
					<div class="space-y-2">
						<Label for="edit-phase-name">{$t.common.name} <span class="text-destructive">*</span></Label>
						<Input id="edit-phase-name" name="name" value={phaseToEdit.name} required />
					</div>
					<div class="space-y-2">
						<Label for="edit-phase-description">{$t.common.description}</Label>
						<Textarea id="edit-phase-description" name="description" rows={2} value={phaseToEdit.description ?? ''} />
					</div>
					<div class="space-y-2">
						<Label for="edit-phase-status">{$t.common.status}</Label>
						<NativeSelect.Root id="edit-phase-status" name="status" value={phaseToEdit.status} class="w-full">
							<option value="planning">{$t.projects.status.planning}</option>
							<option value="in_progress">{$t.projects.status.in_progress}</option>
							<option value="on_hold">{$t.projects.status.on_hold}</option>
							<option value="completed">{$t.projects.status.completed}</option>
							<option value="cancelled">{$t.projects.status.cancelled}</option>
						</NativeSelect.Root>
					</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="edit-phase-start">Start Date</Label>
							<Input id="edit-phase-start" name="startDate" type="date" value={phaseToEdit.startDate ?? ''} />
						</div>
						<div class="space-y-2">
							<Label for="edit-phase-end">End Date</Label>
							<Input id="edit-phase-end" name="endDate" type="date" value={phaseToEdit.endDate ?? ''} />
						</div>
					</div>
				</div>
				<Dialog.Footer>
					<Dialog.Close><Button type="button" variant="outline">{$t.common.cancel}</Button></Dialog.Close>
					<Button type="submit">{$t.common.save}</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={deletePhaseOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Phase?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. "{phaseToDelete?.name}" will be permanently deleted.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{$t.common.cancel}</AlertDialog.Cancel>
			<form method="POST" action="?/deletePhase" use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') deletePhaseOpen = false;
					await update();
				};
			}}>
				<input type="hidden" name="id" value={phaseToDelete?.id ?? ''} />
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
