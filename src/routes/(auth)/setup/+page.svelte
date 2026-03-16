<script lang="ts">
	import { AlertCircle } from '@lucide/svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { t } from '$lib/i18n/index.js';

	let { form } = $props();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{$t.auth.setupTitle}</Card.Title>
		<Card.Description>{$t.auth.setupSubtitle}</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if form?.invalid}
			<Alert.Root variant="destructive" class="mb-4">
				<AlertCircle class="size-4" />
				<Alert.Title>{form?.message ?? $t.common.required}</Alert.Title>
			</Alert.Root>
		{/if}
		<form method="POST" class="space-y-4">
			<div class="space-y-2">
				<Label for="householdName">{$t.auth.householdName}</Label>
				<Input id="householdName" name="householdName" value={form?.householdName ?? ''} required />
			</div>
			<div class="space-y-2">
				<Label for="name">{$t.auth.yourName}</Label>
				<Input id="name" name="name" value={form?.name ?? ''} required />
			</div>
			<div class="space-y-2">
				<Label for="email">{$t.auth.email}</Label>
				<Input id="email" name="email" type="email" value={form?.email ?? ''} required />
			</div>
			<div class="space-y-2">
				<Label for="password">{$t.auth.password}</Label>
				<Input id="password" name="password" type="password" minlength={8} required />
			</div>
			<Button type="submit" class="w-full">{$t.common.create}</Button>
		</form>
	</Card.Content>
</Card.Root>
