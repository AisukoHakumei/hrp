<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Bell, Calendar, CircleDollarSign, ClipboardList, FileText, FolderKanban, Hammer, House, LayoutDashboard, Search, Settings, Wrench } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Separator from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { t } from '$lib/i18n/index.js';
	import { hasModuleAccess } from '$lib/permissions.js';
	import { destroySSE, initSSE } from '$lib/stores/events.svelte.js';

	let { children, data } = $props();
	const userRole = $derived(page.data.user?.role ?? 'guest');

	const mainNav = $derived([
		{ href: '/dashboard', label: $t.nav.dashboard, icon: LayoutDashboard, module: 'dashboard' },
		{ href: '/projects', label: $t.nav.projects, icon: FolderKanban, module: 'projects' },
		{ href: '/tasks', label: $t.nav.tasks, icon: ClipboardList, module: 'tasks' },
		{ href: '/assets', label: $t.nav.assets, icon: Wrench, module: 'assets' },
		{ href: '/rooms', label: $t.nav.rooms, icon: House, module: 'rooms' },
		{ href: '/finances', label: $t.nav.finances, icon: CircleDollarSign, module: 'finances' },
		{ href: '/documents', label: $t.nav.documents, icon: FileText, module: 'documents' },
		{ href: '/knowledge', label: $t.nav.knowledge, icon: Search, module: 'knowledge' },
		{ href: '/maintenance', label: $t.nav.maintenance, icon: Hammer, module: 'maintenance' },
		{ href: '/calendar', label: $t.nav.calendar, icon: Calendar, module: 'calendar' },
		{ href: '/search', label: $t.nav.search, icon: Search, module: 'search' }
	]);

	const filteredNav = $derived(
		mainNav.filter((item) => !item.module || hasModuleAccess(userRole, item.module, 'view'))
	);

	const footerNav = $derived([
		{ href: '/notifications', label: $t.nav.notifications, icon: Bell },
		{ href: '/settings', label: $t.nav.settings, icon: Settings }
	]);

	function isActive(href: string) {
		if (href === '/dashboard') return page.url.pathname === href;
		return page.url.pathname.startsWith(href);
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			void goto('/search');
		}
	}

	$effect(() => {
		if (data.user?.id) {
			initSSE(data.user.id);
		}

		return () => {
			destroySSE();
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />
<Sidebar.Provider>
	<Sidebar.Root collapsible="icon">
		<Sidebar.Header>
			<div class="px-2 py-1.5">
				<p class="text-xs text-muted-foreground">{data.household.name}</p>
				<p class="text-sm font-semibold">HRP</p>
			</div>
		</Sidebar.Header>
		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
					{#each filteredNav as item}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={isActive(item.href)} tooltipContent={item.label}>
									{#snippet child({ props })}
									<a href={item.href} {...props}>
										<item.icon />
										<span>{item.label}</span>
										{#if item.href === '/search'}
											<kbd class="text-xs text-muted-foreground ml-auto hidden md:inline-flex items-center gap-0.5 rounded border px-1 py-0.5 font-mono">
												⌘K
											</kbd>
										{/if}
									</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>
		<Sidebar.Footer>
			<Separator.Root class="mb-2" />
			<Sidebar.Menu>
				{#each footerNav as item}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={isActive(item.href)}>
							{#snippet child({ props })}
								<a href={item.href} {...props}>
									<item.icon />
									<span>{item.label}</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Footer>
		<Sidebar.Rail />
	</Sidebar.Root>
	<Sidebar.Inset>
		<header class="border-b bg-background px-4 py-3 md:px-6">
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-3">
					<Sidebar.Trigger />
					<Separator.Root orientation="vertical" class="h-5" />
					<p class="text-sm font-medium">{data.user.name}</p>
				</div>
				<div class="flex items-center gap-2">
					<Badge variant="outline">{data.user.role}</Badge>
				</div>
			</div>
		</header>
		<main class="p-4 md:p-6">{@render children()}</main>
	</Sidebar.Inset>
</Sidebar.Provider>
