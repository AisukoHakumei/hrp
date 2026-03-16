<script lang="ts">
	import { t } from '$lib/i18n/index.js';
	import { translate } from '$lib/i18n/index.js';

	let { selectedCount, onDeselectAll, children } = $props<{
		selectedCount: number;
		onDeselectAll: () => void;
		children?: import('svelte').Snippet;
	}>();
</script>

{#if selectedCount > 0}
	<div class="fixed bottom-0 left-0 right-0 z-50 border-t bg-background px-4 py-3 shadow-lg md:left-[var(--sidebar-width)]">
		<div class="flex items-center justify-between gap-4">
			<span class="text-sm font-medium">{translate('common.selected', { count: selectedCount })}</span>
			<div class="flex items-center gap-2">
				{@render children?.()}
				<button
					type="button"
					class="text-sm text-muted-foreground underline hover:text-foreground"
					onclick={onDeselectAll}
				>
					{$t.common.deselectAll}
				</button>
			</div>
		</div>
	</div>
{/if}
