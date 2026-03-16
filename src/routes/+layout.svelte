<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { locale } from '$lib/i18n/index.js';
	import type { Locale } from '$lib/i18n/index.js';

	let { children } = $props();
	let isOffline = $state(false);

	$effect(() => {
		const serverLocale = page.data.locale as Locale | undefined;
		if (serverLocale) locale.set(serverLocale);
	});

	$effect(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/sw.js').catch(() => {});
		}

		const storedTheme = document.cookie.match(/theme=(light|dark|system)/)?.[1] ?? 'system';
		const isDark =
			storedTheme === 'dark' || (storedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.classList.toggle('dark', isDark);

		isOffline = !navigator.onLine;
	});
</script>

<svelte:window ononline={() => (isOffline = false)} onoffline={() => (isOffline = true)} />
<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if isOffline}
	<div class="offline-banner">
		<span>📡 You are offline. Browsing cached data only.</span>
	</div>
{/if}

{@render children()}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}

	.offline-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		background-color: #fbbf24;
		color: #78350f;
		padding: 0.75rem 1rem;
		text-align: center;
		font-size: 0.875rem;
		font-weight: 500;
		z-index: 9999;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}
</style>
