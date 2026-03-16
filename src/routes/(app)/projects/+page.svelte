<script lang="ts">
	import { Plus, Trash2 } from '@lucide/svelte';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { t } from '$lib/i18n/index.js';
	import { hasModuleAccess } from '$lib/permissions.js';

	let { data } = $props();
	const userRole = $derived(page.data.user?.role ?? 'guest');

	let deleteProjectId = $state('');
	let deleteOpen = $state(false);

	function confirmDelete(id: string) {
		deleteProjectId = id;
		deleteOpen = true;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">{$t.projects.title}</h1>
		{#if hasModuleAccess(userRole, 'projects', 'create')}
			<Button href="/projects/new"><Plus class="size-4" />{$t.projects.newProject}</Button>
		{/if}
	</div>

	<Card.Root>
		<Card.Content class="pt-6">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>{$t.common.name}</Table.Head>
						<Table.Head>{$t.common.type}</Table.Head>
						<Table.Head>{$t.common.status}</Table.Head>
						<Table.Head>{$t.projects.progress}</Table.Head>
						<Table.Head>{$t.projects.budget}</Table.Head>
						<Table.Head class="w-16">{$t.common.actions}</Table.Head>
					</Table.Row>
				</Table.Header>
			<Table.Body>
				{#each data.projects as project (project.id)}
						<Table.Row>
							<Table.Cell><a href={`/projects/${project.id}`} class="font-medium hover:underline">{project.name}</a></Table.Cell>
							<Table.Cell>{project.type}</Table.Cell>
							<Table.Cell><Badge variant="outline">{project.status}</Badge></Table.Cell>
							<Table.Cell>{project.progressPercent}%</Table.Cell>
							<Table.Cell>{project.budgetAmount}</Table.Cell>
							<Table.Cell>
								{#if hasModuleAccess(userRole, 'projects', 'delete')}
									<Button
										variant="ghost"
										size="icon"
										class="text-destructive hover:text-destructive hover:bg-destructive/10"
										onclick={() => confirmDelete(project.id)}
									>
										<Trash2 class="size-4" />
										<span class="sr-only">{$t.common.delete}</span>
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

<AlertDialog.Root bind:open={deleteOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Project?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. The project will be permanently deleted.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{$t.common.cancel}</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						deleteOpen = false;
					};
				}}
			>
				<input type="hidden" name="id" value={deleteProjectId} />
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
