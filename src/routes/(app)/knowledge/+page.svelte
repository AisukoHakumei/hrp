<script lang="ts">
	import { enhance } from '$app/forms';
	import { Pencil, Plus, Trash2, X } from '@lucide/svelte';
	import { page } from '$app/state';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
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

	const CATEGORIES = ['note', 'procedure', 'howto', 'reference', 'troubleshooting', 'other'] as const;
	const TARGET_TYPES = ['project', 'asset', 'room', 'task'] as const;

	let createOpen = $state(false);
	let deleteId = $state<string | null>(null);
	let editArticle = $state<{ id: string; title: string; content: string; category: string } | null>(null);
	let linkDialogOpen = $state(false);
	let linkArticleId = $state('');
	let linkTargetType = $state<'project' | 'asset' | 'room' | 'task'>('project');

	function getArticleLinks(articleId: string) {
		return (data.knowledgeLinks ?? []).filter((l) => l.articleId === articleId);
	}

	function getEntityName(targetType: string, targetId: string): string {
		if (!data.entities) return targetId;
		const list = data.entities[targetType as keyof typeof data.entities] ?? [];
		return (list as Array<{ id: string; name: string }>).find((e) => e.id === targetId)?.name ?? targetId;
	}

	const availableLinkEntities = $derived(
		(data.entities?.[linkTargetType] ?? []) as Array<{ id: string; name: string }>
	);

	function openLinkDialog(articleId: string) {
		linkArticleId = articleId;
		linkTargetType = 'project';
		linkDialogOpen = true;
	}
</script>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.knowledge.newArticle}</Dialog.Title>
		</Dialog.Header>
		<form method="POST" action="?/create" class="space-y-4 pt-2">
			<div class="space-y-2">
				<Label for="new-title">{$t.common.name} <span class="text-destructive">*</span></Label>
				<Input id="new-title" name="title" required />
			</div>
			<div class="space-y-2">
				<Label for="new-content">{$t.common.description} <span class="text-destructive">*</span></Label>
				<Textarea id="new-content" name="content" rows={8} placeholder="Write in Markdown..." required />
			</div>
			<div class="space-y-2">
				<Label for="new-category">{$t.finances.category}</Label>
				<select id="new-category" name="category" class={SELECT_CLASS}>
					{#each CATEGORIES as cat}
						<option value={cat}>{$t.knowledge.categories[cat]}</option>
					{/each}
				</select>
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

<Dialog.Root open={!!editArticle} onOpenChange={(v) => { if (!v) editArticle = null; }}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.common.edit}</Dialog.Title>
		</Dialog.Header>
		{#if editArticle}
			<form method="POST" action="?/update" class="space-y-4 pt-2">
				<input type="hidden" name="id" value={editArticle.id} />
				<div class="space-y-2">
					<Label for="edit-title">{$t.common.name} <span class="text-destructive">*</span></Label>
					<Input id="edit-title" name="title" value={editArticle.title} required />
				</div>
				<div class="space-y-2">
					<Label for="edit-content">{$t.common.description} <span class="text-destructive">*</span></Label>
					<Textarea id="edit-content" name="content" rows={8} placeholder="Write in Markdown..." value={editArticle.content} required />
				</div>
				<div class="space-y-2">
					<Label for="edit-category">{$t.finances.category}</Label>
					<select id="edit-category" name="category" class={SELECT_CLASS}>
						{#each CATEGORIES as cat}
							<option value={cat} selected={editArticle.category === cat}>{$t.knowledge.categories[cat]}</option>
						{/each}
					</select>
				</div>
				<Dialog.Footer>
					<Dialog.Close>
						<Button type="button" variant="outline">{$t.common.cancel}</Button>
					</Dialog.Close>
					<Button type="submit">{$t.common.save}</Button>
				</Dialog.Footer>
			</form>
		{/if}
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

<Dialog.Root
	bind:open={linkDialogOpen}
	onOpenChange={(o) => {
		if (!o) linkArticleId = '';
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$t.knowledge.linkEntity}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/linkEntity"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						linkDialogOpen = false;
						linkArticleId = '';
					})}
		>
			<input type="hidden" name="articleId" value={linkArticleId} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="link-target-type">{$t.knowledge.targetType}</Label>
					<select
						id="link-target-type"
						name="targetType"
						class={SELECT_CLASS}
						bind:value={linkTargetType}
					>
						{#each TARGET_TYPES as tt}
							<option value={tt}>{tt.charAt(0).toUpperCase() + tt.slice(1)}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-2">
					<Label for="link-target-id">{$t.knowledge.selectEntity}</Label>
					<select
						id="link-target-id"
						name="targetId"
						required
						class={SELECT_CLASS}
					>
						<option value="">{$t.knowledge.selectEntity}</option>
						{#each availableLinkEntities as entity}
							<option value={entity.id}>{entity.name}</option>
						{/each}
					</select>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => { linkDialogOpen = false; linkArticleId = ''; }}>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.link}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">{$t.knowledge.title}</h1>
		{#if hasModuleAccess(userRole, 'knowledge', 'create')}
			<Button onclick={() => (createOpen = true)}><Plus class="size-4" />{$t.knowledge.newArticle}</Button>
		{/if}
	</div>

	<Card.Root>
		<Card.Content class="pt-6">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>{$t.common.name}</Table.Head>
						<Table.Head>{$t.finances.category}</Table.Head>
						<Table.Head>{$t.common.description}</Table.Head>
						<Table.Head class="w-20"></Table.Head>
					</Table.Row>
				</Table.Header>
			<Table.Body>
				{#each data.knowledgeArticles as article (article.id)}
						<Table.Row>
							<Table.Cell class="font-medium">
								<div class="space-y-1">
									<div>{article.title}</div>
									<div class="flex flex-wrap items-center gap-1">
										{#each getArticleLinks(article.id) as link (link.id)}
											<span
												class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground"
											>
												<span class="capitalize">{link.targetType}:</span> {getEntityName(link.targetType, link.targetId)}
												{#if hasModuleAccess(userRole, 'knowledge', 'edit')}
													<form method="POST" action="?/unlinkEntity" use:enhance class="inline">
														<input type="hidden" name="linkId" value={link.id} />
														<button type="submit" class="hover:text-destructive">
															<X class="size-3" />
														</button>
													</form>
												{/if}
											</span>
										{/each}
										{#if hasModuleAccess(userRole, 'knowledge', 'edit')}
											<Button
												type="button"
												size="sm"
												variant="ghost"
												onclick={() => openLinkDialog(article.id)}
												class="h-5 px-1"
											>
												<Plus class="size-3" />
											</Button>
										{/if}
									</div>
								</div>
							</Table.Cell>
							<Table.Cell>{$t.knowledge.categories[article.category]}</Table.Cell>
							<Table.Cell class="max-w-xs truncate text-muted-foreground">{article.content}</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-1">
									{#if hasModuleAccess(userRole, 'knowledge', 'edit')}
										<Button
											variant="ghost"
											size="icon"
											onclick={() => (editArticle = { id: article.id, title: article.title, content: article.content, category: article.category })}
										>
											<Pencil class="size-4" />
										</Button>
									{/if}
									{#if hasModuleAccess(userRole, 'knowledge', 'delete')}
										<Button
											variant="ghost"
											size="icon"
											class="text-destructive hover:text-destructive"
											onclick={() => (deleteId = article.id)}
										>
											<Trash2 class="size-4" />
										</Button>
									{/if}
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
