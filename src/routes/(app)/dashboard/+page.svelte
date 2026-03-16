<script lang="ts">
	import { AlertTriangle, FileText, Hammer, Kanban, ListTodo, Wallet } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { t } from '$lib/i18n/index.js';

	let { data } = $props();
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">{$t.dashboard.title}</h1>
	</div>

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">{$t.dashboard.activeProjects}</Card.Title>
				<Kanban class="size-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<p class="text-2xl font-semibold">{data.activeProjects.length}</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">{$t.dashboard.overdueTasks}</Card.Title>
				<ListTodo class="size-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<p class="text-2xl font-semibold">{data.overdueTasks.length}</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">{$t.dashboard.assetAlerts}</Card.Title>
				<AlertTriangle class="size-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<p class="text-2xl font-semibold">{data.assetAlerts.length}</p>
			</Card.Content>
		</Card.Root>
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-base"><Wallet class="size-4" />{$t.dashboard.budgetSpend}</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#each data.budgetSpend as budget (budget.projectId)}
					<div class="space-y-1">
						<div class="flex items-center justify-between text-sm">
							<span>{budget.projectName}</span>
							<span>{budget.spent} / {budget.budget}</span>
						</div>
						<Progress value={(budget.spent / budget.budget) * 100} />
					</div>
				{/each}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-base"><Hammer class="size-4" />{$t.dashboard.upcomingMaintenance}</Card.Title>
			</Card.Header>
			<Card.Content>
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>{$t.common.name}</Table.Head>
							<Table.Head>{$t.maintenance.nextDue}</Table.Head>
						</Table.Row>
					</Table.Header>
				<Table.Body>
					{#each data.upcomingMaintenance as item (item.id)}
							<Table.Row>
								<Table.Cell>{item.name}</Table.Cell>
								<Table.Cell>{item.nextDueDate}</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-base"><FileText class="size-4" />{$t.dashboard.recentDocuments}</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-2">
				{#each data.recentDocuments as doc (doc.id)}
					<div class="flex items-center justify-between rounded-md border p-2 text-sm">
						<span>{doc.title}</span>
						<Badge variant="outline">{doc.type}</Badge>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">{$t.dashboard.assetAlerts}</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-2">
				{#each data.assetAlerts as asset (asset.id)}
					<a class="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-muted/50" href={`/assets/${asset.id}`}>
						<span>{asset.name}</span>
						<Badge>{asset.status}</Badge>
					</a>
				{/each}
			</Card.Content>
		</Card.Root>
	</div>
</div>
