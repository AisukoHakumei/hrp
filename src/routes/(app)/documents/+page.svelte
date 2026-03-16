<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Download, Trash2 } from '@lucide/svelte';
	import BulkActions from '$lib/components/bulk-actions.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { t, translate } from '$lib/i18n/index.js';
	import { hasModuleAccess } from '$lib/permissions.js';

	let { data } = $props();
	const userRole = $derived(page.data.user?.role ?? 'guest');

	const DOC_TYPES = [
		'invoice', 'contract', 'warranty', 'manual', 'receipt',
		'photo', 'plan', 'certificate', 'report', 'other'
	] as const;

	let deleteId = $state<string | null>(null);
	let uploadOpen = $state(false);
	let uploadLoading = $state(false);
	let uploadError = $state<string | null>(null);
	let selectedIds = $state<Set<string>>(new Set());
	let bulkDeleteOpen = $state(false);

	let title = $state('');
	let description = $state('');
	let docType = $state('other');
	let fileInput = $state<HTMLInputElement | null>(null);

	const allDocumentIds = $derived(data.documents.map((document) => document.id));
	const selectedIdsValue = $derived(Array.from(selectedIds).join(','));
	const allSelected = $derived(
		allDocumentIds.length > 0 && allDocumentIds.every((id) => selectedIds.has(id))
	);

	function toggleDocumentSelection(documentId: string, checked: boolean) {
		const next = new Set(selectedIds);
		if (checked) {
			next.add(documentId);
		} else {
			next.delete(documentId);
		}
		selectedIds = next;
	}

	function toggleAll(checked: boolean) {
		const next = new Set(selectedIds);
		for (const id of allDocumentIds) {
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

	function resetForm() {
		title = '';
		description = '';
		docType = 'other';
		if (fileInput) fileInput.value = '';
		uploadError = null;
	}

	async function handleUpload(e: SubmitEvent) {
		e.preventDefault();
		const file = fileInput?.files?.[0];
		if (!file) {
			uploadError = 'Please select a file.';
			return;
		}

		uploadLoading = true;
		uploadError = null;

		const formData = new FormData();
		formData.append('file', file);
		formData.append('title', title.trim() || file.name);
		formData.append('description', description.trim());
		formData.append('type', docType);

		try {
			const res = await fetch('/api/upload', { method: 'POST', body: formData });
			if (res.ok) {
				uploadOpen = false;
				resetForm();
				await invalidateAll();
			} else {
				const body = await res.json().catch(() => ({}));
				uploadError = body?.error ?? 'Upload failed. Please try again.';
			}
		} catch {
			uploadError = 'Network error — upload not completed.';
		} finally {
			uploadLoading = false;
		}
	}
</script>

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
		<h1 class="text-2xl font-semibold">{$t.documents.title}</h1>
		{#if hasModuleAccess(userRole, 'documents', 'create')}
			<Button onclick={() => { resetForm(); uploadOpen = true; }}>{$t.documents.upload}</Button>
		{/if}
	</div>

	<Dialog.Root bind:open={uploadOpen}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>{$t.documents.upload}</Dialog.Title>
				<Dialog.Description>Add a document to your household library.</Dialog.Description>
			</Dialog.Header>

			<form onsubmit={handleUpload} class="space-y-4 pt-2">
				<div class="space-y-2">
					<Label for="doc-file">File <span class="text-destructive">*</span></Label>
					<Input
						id="doc-file"
						type="file"
						bind:ref={fileInput}
						accept="*/*"
						required
					/>
				</div>

				<div class="space-y-2">
					<Label for="doc-title">{$t.common.name}</Label>
					<Input id="doc-title" bind:value={title} placeholder="Leave blank to use filename" />
				</div>

				<div class="space-y-2">
					<Label for="doc-description">{$t.common.description}</Label>
					<Textarea id="doc-description" bind:value={description} rows={3} />
				</div>

				<div class="space-y-2">
					<Label for="doc-type">{$t.common.type}</Label>
					<select
						id="doc-type"
						bind:value={docType}
						class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#each DOC_TYPES as opt}
							<option value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
						{/each}
					</select>
				</div>

				{#if uploadError}
					<p class="text-sm text-destructive">{uploadError}</p>
				{/if}

				<Dialog.Footer>
					<Dialog.Close>
						<Button type="button" variant="outline" onclick={resetForm}>{$t.common.cancel}</Button>
					</Dialog.Close>
					<Button type="submit" disabled={uploadLoading}>
						{uploadLoading ? $t.common.loading : $t.documents.upload}
					</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>

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
						<Table.Head>{$t.common.type}</Table.Head>
						<Table.Head>{$t.common.description}</Table.Head>
						<Table.Head class="w-24"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.documents as document (document.id)}
						<Table.Row>
							<Table.Cell>
								<input
									type="checkbox"
									aria-label={`Select ${document.title}`}
									checked={selectedIds.has(document.id)}
									onchange={(e) => toggleDocumentSelection(document.id, e.currentTarget.checked)}
								/>
							</Table.Cell>
							<Table.Cell>{document.title}</Table.Cell>
							<Table.Cell>{document.type}</Table.Cell>
							<Table.Cell>{document.fileName}</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-1">
									<a href="/api/download?documentId={document.id}" target="_blank" rel="noopener noreferrer">
										<Button variant="ghost" size="icon" aria-label={$t.documents.download}>
											<Download class="size-4" />
										</Button>
									</a>
									{#if hasModuleAccess(userRole, 'documents', 'delete')}
										<Button
											variant="ghost"
											size="icon"
											class="text-destructive hover:text-destructive"
											onclick={() => (deleteId = document.id)}
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

<BulkActions selectedCount={selectedIds.size} onDeselectAll={clearSelection}>
	{#snippet children()}
		{#if hasModuleAccess(userRole, 'documents', 'delete')}
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
