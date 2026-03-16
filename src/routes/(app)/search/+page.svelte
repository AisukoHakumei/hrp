<script lang="ts">
	import { Search } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { t, translate } from '$lib/i18n/index.js';
	import { selectClass } from '$lib/utils.js';

	let { data } = $props();

	const query = $derived(data.query ?? '');
	const typeFilter = $derived(data.typeFilter ?? '');
	const resultCountLabel = $derived(
		translate('search.resultsFound', { count: String(data.results.length) })
	);

	const typeOptions = [
		{ value: '', label: $t.search.allTypes },
		{ value: 'project', label: $t.search.types.project },
		{ value: 'task', label: $t.search.types.task },
		{ value: 'asset', label: $t.search.types.asset },
		{ value: 'room', label: $t.search.types.room },
		{ value: 'document', label: $t.search.types.document },
		{ value: 'knowledge', label: $t.search.types.knowledge },
		{ value: 'maintenance', label: $t.search.types.maintenance },
		{ value: 'expense', label: $t.search.types.expense }
	];

	const typeBadgeClass: Record<string, string> = {
		project: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
		task: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
		asset: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
		room: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
		document: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
		knowledge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
		maintenance: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
		expense: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
	};

	function escapeHtml(value: string): string {
		return value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	function highlightMatch(value: string, rawQuery: string): string {
		const normalizedQuery = rawQuery.trim();
		if (!normalizedQuery) return escapeHtml(value);

		const lowerValue = value.toLowerCase();
		const lowerQuery = normalizedQuery.toLowerCase();
		const matchIndex = lowerValue.indexOf(lowerQuery);
		if (matchIndex === -1) return escapeHtml(value);

		const before = escapeHtml(value.slice(0, matchIndex));
		const match = escapeHtml(value.slice(matchIndex, matchIndex + normalizedQuery.length));
		const after = escapeHtml(value.slice(matchIndex + normalizedQuery.length));
		return `${before}<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">${match}</mark>${after}`;
	}

	function getTypeBadgeClass(type: string): string {
		return typeBadgeClass[type] ?? 'bg-muted text-muted-foreground';
	}
</script>

<div class="mx-auto max-w-4xl space-y-6">
	<div class="space-y-2">
		<h1 class="text-2xl font-semibold">{$t.nav.search}</h1>
		<form method="GET" class="flex gap-2">
			<Input name="q" value={query} placeholder={$t.common.search} />
			{#if typeFilter}
				<input type="hidden" name="type" value={typeFilter} />
			{/if}
			<Button type="submit" variant="outline"><Search class="size-4" />{$t.common.search}</Button>
		</form>
		<form method="GET" class="space-y-2">
			<input type="hidden" name="q" value={query} />
			<Label for="search-type">{$t.search.filterByType}</Label>
			<select
				id="search-type"
				name="type"
				class={selectClass}
				onchange={(event) => event.currentTarget.form?.requestSubmit()}
			>
				{#each typeOptions as option}
					<option value={option.value} selected={typeFilter === option.value}>{option.label}</option>
				{/each}
			</select>
		</form>
		<p class="text-sm text-muted-foreground">{resultCountLabel}</p>
	</div>

	<Card.Root>
		<Card.Content class="space-y-2 pt-6">
			{#if data.results.length === 0}
				<p class="text-sm text-muted-foreground">{$t.common.noResults}</p>
			{:else}
				{#each data.results as result (result.id)}
					<a class="block rounded-md border p-3 hover:bg-muted/50" href={result.href}>
						<div class="flex items-start justify-between gap-3">
							<div class="space-y-1">
								<p class="text-sm font-medium">{@html highlightMatch(result.label, query)}</p>
								{#if result.snippet}
									<p class="truncate text-xs text-muted-foreground">{result.snippet}</p>
								{/if}
							</div>
							<Badge class={getTypeBadgeClass(result.type)}>{$t.search.types[result.type]}</Badge>
						</div>
					</a>
				{/each}
			{/if}
		</Card.Content>
	</Card.Root>
</div>
