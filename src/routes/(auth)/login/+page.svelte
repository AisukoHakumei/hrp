<script lang="ts">
	import { AlertCircle } from '@lucide/svelte';
	import { KeyRound } from '@lucide/svelte';
	import { page } from '$app/state';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { t, translate } from '$lib/i18n/index.js';

	let { form, data } = $props();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{$t.auth.loginTitle}</Card.Title>
		<Card.Description>{$t.auth.loginSubtitle}</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if form?.invalid}
			<Alert.Root variant="destructive" class="mb-4">
				<AlertCircle class="size-4" />
				<Alert.Title>{form?.message ?? $t.auth.invalidCredentials}</Alert.Title>
			</Alert.Root>
		{/if}
		{#if page.url.searchParams.get('error') === 'oidc_no_account'}
			<Alert.Root variant="destructive" class="mb-4">
				<AlertCircle class="size-4" />
				<Alert.Title>{$t.auth.oidcNoAccount}</Alert.Title>
			</Alert.Root>
		{/if}
		{#if page.url.searchParams.get('error') === 'oidc_error'}
			<Alert.Root variant="destructive" class="mb-4">
				<AlertCircle class="size-4" />
				<Alert.Title>{$t.auth.oidcError}</Alert.Title>
			</Alert.Root>
		{/if}

		<form method="POST" class="space-y-4">
			<div class="space-y-2">
				<Label for="email">{$t.auth.email}</Label>
				<Input id="email" name="email" type="email" value={form?.email ?? ''} required />
			</div>
			<div class="space-y-2">
				<Label for="password">{$t.auth.password}</Label>
				<Input id="password" name="password" type="password" required />
			</div>
			<Button type="submit" class="w-full">{$t.auth.login}</Button>
		</form>

		{#if data.hasOidc}
			<div class="relative my-4">
				<div class="absolute inset-0 flex items-center"><span class="w-full border-t"></span></div>
				<div class="relative flex justify-center text-xs uppercase">
					<span class="bg-card px-2 text-muted-foreground">{$t.auth.or}</span>
				</div>
			</div>
			<a
				href="/auth/oidc"
				class="inline-flex w-full items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
			>
				<KeyRound class="size-4" />
				{translate('auth.signInWith', { provider: data.oidcProviderName })}
			</a>
		{/if}
	</Card.Content>
</Card.Root>
