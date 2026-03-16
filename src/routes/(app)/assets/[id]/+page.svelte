<script lang="ts">
	import { ArrowLeft, Pencil, Plus, Trash2, X } from "@lucide/svelte";
	import { enhance } from "$app/forms";
	import { page } from "$app/state";
	import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as NativeSelect from "$lib/components/ui/native-select/index.js";
	import * as Tabs from "$lib/components/ui/tabs/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { t } from "$lib/i18n/index.js";
	import { hasModuleAccess } from "$lib/permissions.js";

	let { data } = $props();
	const userRole = $derived(page.data.user?.role ?? "guest");

	const ASSET_CATEGORIES = ["appliance", "furniture", "tool", "vehicle", "electronics", "building_component", "subscription", "contract", "other"] as const;

	const ASSET_STATUSES = ["active", "stored", "broken", "maintenance", "disposed", "sold"] as const;

	let editOpen = $state(false);
	let deleteOpen = $state(false);
	let linkDocumentOpen = $state(false);
	let linkProjectOpen = $state(false);
	let addTagOpen = $state(false);

	const availableDocuments = $derived(data.allDocuments.filter((document) => !data.linkedDocuments.some((linkedDocument) => linkedDocument.id === document.id)));
	const availableProjects = $derived(data.allProjects.filter((project) => !data.relatedProjects.some((relatedProject) => relatedProject.id === project.id)));
	const availableTags = $derived(data.allTags.filter((tag) => !data.entityTags.some((entityTag) => entityTag.tagId === tag.id)));
</script>

<Dialog.Root bind:open={editOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.common.edit}</Dialog.Title>
		</Dialog.Header>
		<form method="POST" action="?/update" class="space-y-4 pt-2">
			<input type="hidden" name="id" value={data.asset.id} />
			<div class="space-y-2">
				<Label for="edit-name">{$t.common.name} <span class="text-destructive">*</span></Label>
				<Input id="edit-name" name="name" value={data.asset.name} required />
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="edit-category">{$t.finances.category}</Label>
					<NativeSelect.Root id="edit-category" name="category" class="w-full">
						{#each ASSET_CATEGORIES as cat}
							<option value={cat} selected={data.asset.category === cat}>{$t.assets.category[cat]}</option>
						{/each}
					</NativeSelect.Root>
				</div>
				<div class="space-y-2">
					<Label for="edit-status">{$t.common.status}</Label>
					<NativeSelect.Root id="edit-status" name="status" class="w-full">
						{#each ASSET_STATUSES as st}
							<option value={st} selected={data.asset.status === st}>{$t.assets.status[st]}</option>
						{/each}
					</NativeSelect.Root>
				</div>
			</div>
			<div class="space-y-2">
				<Label for="edit-manufacturer">{data.asset.manufacturer ? "Manufacturer" : "Manufacturer"}</Label>
				<Input id="edit-manufacturer" name="manufacturer" value={data.asset.manufacturer ?? ""} placeholder="Manufacturer" />
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="edit-model">Model</Label>
					<Input id="edit-model" name="model" value={data.asset.model ?? ""} />
				</div>
				<div class="space-y-2">
					<Label for="edit-serial">Serial Number</Label>
					<Input id="edit-serial" name="serialNumber" value={data.asset.serialNumber ?? ""} />
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="edit-purchase-date">{$t.assets.purchaseInfo}</Label>
					<Input id="edit-purchase-date" name="purchaseDate" type="date" value={data.asset.purchaseDate ?? ""} />
				</div>
				<div class="space-y-2">
					<Label for="edit-purchase-price">Price</Label>
					<Input id="edit-purchase-price" name="purchasePrice" type="number" step="0.01" value={data.asset.purchasePrice ?? ""} />
				</div>
			</div>
			<div class="space-y-2">
				<Label for="edit-warranty">{$t.assets.warrantyExpires}</Label>
				<Input id="edit-warranty" name="warrantyExpiresAt" type="date" value={data.asset.warrantyExpiresAt ?? ""} />
			</div>
			<div class="space-y-2">
				<Label for="edit-description">{$t.common.description}</Label>
				<Textarea id="edit-description" name="description" rows={3} value={data.asset.description ?? ""} />
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
			<AlertDialog.Description>This will permanently delete "{data.asset.name}". This action cannot be undone.</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{$t.common.cancel}</AlertDialog.Cancel>
			<form method="POST" action="?/delete">
				<input type="hidden" name="id" value={data.asset.id} />
				<AlertDialog.Action type="submit">{$t.common.delete}</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<p class="text-sm text-muted-foreground">{$t.assets.title}</p>
			<h1 class="text-2xl font-semibold">{data.asset.name}</h1>
		</div>
		<div class="flex items-center gap-2">
			{#if hasModuleAccess(userRole, "assets", "edit")}
				<Button onclick={() => (editOpen = true)} variant="outline"><Pencil class="size-4" />{$t.common.edit}</Button>
			{/if}
			{#if hasModuleAccess(userRole, "assets", "delete")}
				<Button onclick={() => (deleteOpen = true)} variant="destructive"><Trash2 class="size-4" />{$t.common.delete}</Button>
			{/if}
			<Button href="/assets" variant="outline"><ArrowLeft class="size-4" />{$t.common.back}</Button>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-1">
		{#each data.entityTags as tag (tag.tagId)}
			<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs" style={tag.tagColor ? `border-color: ${tag.tagColor}; color: ${tag.tagColor}` : ""}>
				{tag.tagName}
				{#if hasModuleAccess(userRole, "assets", "edit")}
					<form method="POST" action="?/removeTag" use:enhance class="inline">
						<input type="hidden" name="entityId" value={data.asset.id} />
						<input type="hidden" name="tagId" value={tag.tagId} />
						<button type="submit" class="hover:text-destructive" aria-label={$t.common.removeTag}>
							<X class="size-3" />
						</button>
					</form>
				{/if}
			</span>
		{/each}
		{#if hasModuleAccess(userRole, "assets", "edit")}
			<Button size="sm" variant="ghost" onclick={() => (addTagOpen = true)} class="h-6 px-1">
				<Plus class="size-3" />
			</Button>
		{/if}
	</div>

	<Card.Root>
		<Card.Content class="grid gap-3 pt-6 md:grid-cols-3">
			<div>
				<p class="text-xs text-muted-foreground">{$t.common.status}</p>
				<Badge>{data.asset.status}</Badge>
			</div>
			<div>
				<p class="text-xs text-muted-foreground">{$t.finances.category}</p>
				<p>{data.asset.category}</p>
			</div>
			<div>
				<p class="text-xs text-muted-foreground">{$t.assets.room}</p>
				<a class="hover:underline" href={`/rooms/${data.room?.id}`}>{data.room?.name}</a>
			</div>
		</Card.Content>
	</Card.Root>

	<Tabs.Root value="info" class="space-y-4">
		<Tabs.List>
			<Tabs.Trigger value="info">{$t.common.description}</Tabs.Trigger>
			<Tabs.Trigger value="warranty">{$t.assets.warranty}</Tabs.Trigger>
			<Tabs.Trigger value="documents">{$t.assets.documents}</Tabs.Trigger>
			<Tabs.Trigger value="maintenance">{$t.assets.maintenance}</Tabs.Trigger>
			<Tabs.Trigger value="projects">{$t.projects.title}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="info">
			<Card.Root>
				<Card.Content class="pt-6 space-y-2 text-sm">
					<p>{data.asset.manufacturer} {data.asset.model}</p>
					<p>{data.asset.purchaseDate}</p>
					<p>{data.asset.purchasePrice}</p>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="warranty">
			<Card.Root><Card.Content class="pt-6">{data.asset.warrantyExpiresAt}</Card.Content></Card.Root>
		</Tabs.Content>

		<Tabs.Content value="documents">
			<Card.Root>
				<Card.Content class="pt-6 space-y-2">
					<div class="mb-2 flex items-center justify-between">
						<p class="text-sm font-medium">{$t.assets.documents}</p>
						{#if hasModuleAccess(userRole, "assets", "edit")}
							<Button size="sm" variant="outline" onclick={() => (linkDocumentOpen = true)}>
								<Plus class="size-4" />
								{$t.common.link}
							</Button>
						{/if}
				</div>
				{#each data.linkedDocuments as document (document.id)}
						<div class="flex items-center justify-between rounded-md border p-2 text-sm">
							<a href="/documents" class="hover:underline">{document.title}</a>
							{#if hasModuleAccess(userRole, "assets", "edit")}
								<form method="POST" action="?/unlinkDocument" use:enhance>
									<input type="hidden" name="assetId" value={data.asset.id} />
									<input type="hidden" name="documentId" value={document.id} />
									<button type="submit" class="text-muted-foreground hover:text-destructive" aria-label={$t.common.unlink}>
										<X class="size-4" />
									</button>
								</form>
							{/if}
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="maintenance">
			<Card.Root>
				<Card.Content class="pt-6 space-y-2">
					{#each data.linkedMaintenance as item (item.id)}
						<a href="/maintenance" class="block rounded-md border p-2 text-sm hover:bg-muted/50">{item.name}</a>
					{/each}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="projects">
			<Card.Root>
				<Card.Content class="pt-6 space-y-2">
					<div class="mb-2 flex items-center justify-between">
						<p class="text-sm font-medium">{$t.projects.title}</p>
						{#if hasModuleAccess(userRole, "assets", "edit")}
							<Button size="sm" variant="outline" onclick={() => (linkProjectOpen = true)}>
								<Plus class="size-4" />
								{$t.common.link}
							</Button>
						{/if}
				</div>
				{#each data.relatedProjects as project (project.id)}
						<div class="flex items-center justify-between rounded-md border p-2 text-sm">
							<a href={`/projects/${project.id}`} class="hover:underline">{project.name}</a>
							{#if hasModuleAccess(userRole, "assets", "edit")}
								<form method="POST" action="?/unlinkProject" use:enhance>
									<input type="hidden" name="assetId" value={data.asset.id} />
									<input type="hidden" name="projectId" value={project.id} />
									<button type="submit" class="text-muted-foreground hover:text-destructive" aria-label={$t.common.unlink}>
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
						if (result.type === "success") linkDocumentOpen = false;
						await update();
					};
				}}
			>
				<input type="hidden" name="assetId" value={data.asset.id} />
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
						if (result.type === "success") addTagOpen = false;
						await update();
					};
				}}
			>
				<input type="hidden" name="entityId" value={data.asset.id} />
				<div class="space-y-4 py-4">
					<div class="space-y-2">
						<Label for="asset-tag-id">{$t.common.selectTag}</Label>
						<NativeSelect.Root id="asset-tag-id" name="tagId" required class="w-full">
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
						if (result.type === "success") linkProjectOpen = false;
						await update();
					};
				}}
			>
				<input type="hidden" name="assetId" value={data.asset.id} />
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
					<div class="space-y-2">
						<Label for="link-project-relationship">{$t.common.relationship}</Label>
						<NativeSelect.Root id="link-project-relationship" name="relationship" class="w-full">
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
