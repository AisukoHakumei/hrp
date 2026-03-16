<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { t } from '$lib/i18n/index.js';
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">{$t.projects.newProject}</h1>
		<Button href="/projects" variant="outline"><ArrowLeft class="size-4" />{$t.common.back}</Button>
	</div>

	<Card.Root>
		<Card.Content class="pt-6">
			<form method="POST" class="space-y-4">
				<div class="space-y-2">
					<Label for="name">{$t.common.name}</Label>
					<Input id="name" name="name" required />
				</div>
				<div class="space-y-2">
					<Label for="description">{$t.common.description}</Label>
					<Textarea id="description" name="description" rows={4} />
				</div>
				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="budgetAmount">{$t.projects.budget}</Label>
						<Input id="budgetAmount" name="budgetAmount" type="number" min="0" />
					</div>
					<div class="space-y-2">
						<Label for="endDate">{$t.tasks.dueDate}</Label>
						<Input id="endDate" name="endDate" type="date" />
					</div>
				</div>
				<Button type="submit">{$t.common.create}</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
