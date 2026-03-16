<script lang="ts">
	import { ArrowLeft, Pencil, Plus, Trash2, X } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { t } from '$lib/i18n/index.js';
	import { hasModuleAccess } from '$lib/permissions.js';

	let { data } = $props();
	const userRole = $derived(page.data.user?.role ?? 'guest');

	const ROOM_TYPES = [
		'room', 'hallway', 'bathroom', 'kitchen', 'garage',
		'garden', 'attic', 'basement', 'balcony', 'storage', 'other'
	] as const;

	let editOpen = $state(false);
	let deleteOpen = $state(false);
	let linkDocumentOpen = $state(false);
	let linkProjectOpen = $state(false);
	let addTagOpen = $state(false);

	const availableDocuments = $derived(
		data.allDocuments.filter(
			(document) => !data.roomDocuments.some((roomDocument) => roomDocument.id === document.id)
		)
	);
	const availableProjects = $derived(
		data.allProjects.filter(
			(project) => !data.roomProjects.some((roomProject) => roomProject.id === project.id)
		)
	);
	const availableTags = $derived(
		data.allTags.filter((tag) => !data.entityTags.some((entityTag) => entityTag.tagId === tag.id))
	);
</script>

<Dialog.Root bind:open={editOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.common.edit}</Dialog.Title>
		</Dialog.Header>
		<form method="POST" action="?/update" class="space-y-4 pt-2">
			<input type="hidden" name="id" value={data.room.id} />
			<div class="space-y-2">
				<Label for="edit-name">{$t.common.name} <span class="text-destructive">*</span></Label>
				<Input id="edit-name" name="name" value={data.room.name} required />
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="edit-type">{$t.common.type}</Label>
					<NativeSelect.Root id="edit-type" name="type" class="w-full">
						{#each ROOM_TYPES as rt}
							<option value={rt} selected={data.room.type === rt}>{$t.rooms.type[rt]}</option>
						{/each}
					</NativeSelect.Root>
				</div>
				<div class="space-y-2">
					<Label for="edit-area">{$t.rooms.area}</Label>
					<Input id="edit-area" name="area" type="number" step="0.1" value={data.room.area ?? ''} />
				</div>
			</div>
			<div class="space-y-2">
				<Label for="edit-description">{$t.common.description}</Label>
				<Textarea id="edit-description" name="description" rows={3} value={data.room.description ?? ''} />
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
			<AlertDialog.Title>{$t.common.delete}?</AlertDialog.Title>
			<AlertDialog.Description>This will permanently delete "{data.room.name}". This action cannot be undone.</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{$t.common.cancel}</AlertDialog.Cancel>
			<form method="POST" action="?/delete">
				<input type="hidden" name="id" value={data.room.id} />
				<AlertDialog.Action type="submit">{$t.common.delete}</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<p class="text-sm text-muted-foreground">{$t.rooms.title}</p>
			<h1 class="text-2xl font-semibold">{data.room.name}</h1>
		</div>
		<div class="flex items-center gap-2">
			{#if hasModuleAccess(userRole, 'rooms', 'edit')}
				<Button onclick={() => (editOpen = true)} variant="outline"><Pencil class="size-4" />{$t.common.edit}</Button>
			{/if}
			{#if hasModuleAccess(userRole, 'rooms', 'delete')}
				<Button onclick={() => (deleteOpen = true)} variant="destructive"><Trash2 class="size-4" />{$t.common.delete}</Button>
			{/if}
			<Button href="/rooms" variant="outline"><ArrowLeft class="size-4" />{$t.common.back}</Button>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-1">
		{#each data.entityTags as tag (tag.tagId)}
			<span
				class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
				style={tag.tagColor ? `border-color: ${tag.tagColor}; color: ${tag.tagColor}` : ''}
			>
				{tag.tagName}
				{#if hasModuleAccess(userRole, 'rooms', 'edit')}
					<form method="POST" action="?/removeTag" use:enhance class="inline">
						<input type="hidden" name="entityId" value={data.room.id} />
						<input type="hidden" name="tagId" value={tag.tagId} />
						<button type="submit" class="hover:text-destructive" aria-label={$t.common.removeTag}>
							<X class="size-3" />
						</button>
					</form>
				{/if}
			</span>
		{/each}
		{#if hasModuleAccess(userRole, 'rooms', 'edit')}
			<Button size="sm" variant="ghost" onclick={() => (addTagOpen = true)} class="h-6 px-1">
				<Plus class="size-3" />
			</Button>
		{/if}
	</div>

	<Card.Root>
		<Card.Content class="grid gap-3 pt-6 md:grid-cols-3">
			<div><p class="text-xs text-muted-foreground">{$t.common.type}</p><Badge variant="outline">{data.room.type}</Badge></div>
			<div><p class="text-xs text-muted-foreground">{$t.rooms.area}</p><p>{data.room.area ? `${data.room.area} m²` : '—'}</p></div>
			<div><p class="text-xs text-muted-foreground">{$t.common.description}</p><p class="text-sm text-muted-foreground">{data.room.description ?? '—'}</p></div>
		</Card.Content>
	</Card.Root>

	{#if data.floorPlanData}
		<Card.Root>
			<Card.Content class="space-y-3 pt-6">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-medium">{$t.rooms.floorPlan}</h2>
					<Button href="/rooms/floor-plans" size="sm" variant="outline">{$t.rooms.viewFloorPlan}</Button>
				</div>
				<div
					class="relative w-full max-w-sm overflow-hidden rounded-md border bg-muted"
					style={data.floorPlanData.plan.imageWidth && data.floorPlanData.plan.imageHeight
						? `aspect-ratio: ${data.floorPlanData.plan.imageWidth} / ${data.floorPlanData.plan.imageHeight}`
						: 'aspect-ratio: 4 / 3'}
				>
					<img
						src="/api/download?documentId={data.floorPlanData.plan.imagePath}"
						alt={data.floorPlanData.plan.name}
						class="absolute inset-0 h-full w-full object-contain"
					/>
					{#each data.floorPlanData.siblingRooms as sibling (sibling.id)}
						{@const isCurrentRoom = sibling.id === data.room.id}
						{@const color = sibling.color ?? '#a1a1aa'}
						<div
							class="absolute border"
							style="left: {sibling.posX ?? 0}%; top: {sibling.posY ?? 0}%; width: {sibling.posWidth ?? 10}%; height: {sibling.posHeight ?? 10}%; background-color: {color}{isCurrentRoom ? '4d' : '1a'}; border-color: {color}; opacity: {isCurrentRoom ? 1 : 0.3}; border-width: {isCurrentRoom ? '2px' : '1px'};"
						>
							{#if isCurrentRoom}
								<span class="absolute inset-0 flex items-center justify-center text-[10px] font-medium" style="color: {color}">
									{sibling.name}
								</span>
							{/if}
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<Tabs.Root value="assets" class="space-y-4">
		<Tabs.List>
			<Tabs.Trigger value="assets">{$t.rooms.assets}</Tabs.Trigger>
			<Tabs.Trigger value="projects">{$t.rooms.projects}</Tabs.Trigger>
			<Tabs.Trigger value="documents">{$t.assets.documents}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="assets">
			<Card.Root><Card.Content class="pt-6 space-y-2">{#each data.roomAssets as asset}<a href={`/assets/${asset.id}`} class="block rounded-md border p-2 text-sm hover:bg-muted/50">{asset.name}</a>{/each}</Card.Content></Card.Root>
		</Tabs.Content>
		<Tabs.Content value="projects">
			<Card.Root>
				<Card.Content class="pt-6 space-y-2">
					<div class="mb-2 flex items-center justify-between">
						<p class="text-sm font-medium">{$t.rooms.projects}</p>
						{#if hasModuleAccess(userRole, 'rooms', 'edit')}
							<Button size="sm" variant="outline" onclick={() => (linkProjectOpen = true)}>
								<Plus class="size-4" />
								{$t.common.link}
							</Button>
						{/if}
				</div>
				{#each data.roomProjects as project (project.id)}
						<div class="flex items-center justify-between rounded-md border p-2 text-sm">
							<a href={`/projects/${project.id}`} class="hover:underline">{project.name}</a>
							{#if hasModuleAccess(userRole, 'rooms', 'edit')}
								<form method="POST" action="?/unlinkProject" use:enhance>
									<input type="hidden" name="roomId" value={data.room.id} />
									<input type="hidden" name="projectId" value={project.id} />
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
		<Tabs.Content value="documents">
			<Card.Root>
				<Card.Content class="pt-6 space-y-2">
					<div class="mb-2 flex items-center justify-between">
						<p class="text-sm font-medium">{$t.assets.documents}</p>
						{#if hasModuleAccess(userRole, 'rooms', 'edit')}
							<Button size="sm" variant="outline" onclick={() => (linkDocumentOpen = true)}>
								<Plus class="size-4" />
								{$t.common.link}
							</Button>
						{/if}
				</div>
				{#each data.roomDocuments as document (document.id)}
						<div class="flex items-center justify-between rounded-md border p-2 text-sm">
							<a href="/documents" class="hover:underline">{document.title}</a>
							{#if hasModuleAccess(userRole, 'rooms', 'edit')}
								<form method="POST" action="?/unlinkDocument" use:enhance>
									<input type="hidden" name="roomId" value={data.room.id} />
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
	</Tabs.Root>
</div>

<Dialog.Root bind:open={linkProjectOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$t.common.link}</Dialog.Title>
		</Dialog.Header>
		{#if availableProjects.length > 0}
			<form
				method="POST"
				action="?/linkProject"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') linkProjectOpen = false;
						await update();
					};
				}}
			>
				<input type="hidden" name="roomId" value={data.room.id} />
				<div class="space-y-4 py-4">
					<div class="space-y-2">
						<Label for="link-project">{$t.projects.title}</Label>
						<NativeSelect.Root id="link-project" name="projectId" required class="w-full">
							<option value="">{$t.projects.title}</option>
							{#each availableProjects as project}
								<option value={project.id}>{project.name}</option>
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
				<input type="hidden" name="entityId" value={data.room.id} />
				<div class="space-y-4 py-4">
					<div class="space-y-2">
						<Label for="room-tag-id">{$t.common.selectTag}</Label>
						<NativeSelect.Root id="room-tag-id" name="tagId" required class="w-full">
							<option value="">{$t.common.selectTag}</option>
							{#each availableTags as tag}
								<option value={tag.id}>{tag.name}</option>
							{/each}
						</NativeSelect.Root>
					</div>
				</div>
				<Dialog.Footer>
					<Dialog.Close><Button type="button" variant="outline">{$t.common.cancel}</Button></Dialog.Close>
					<Button type="submit">{$t.common.addTag}</Button>
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
				<input type="hidden" name="roomId" value={data.room.id} />
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
