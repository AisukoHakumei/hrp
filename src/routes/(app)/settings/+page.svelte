<script lang="ts">
	import { enhance } from '$app/forms';
	import { Moon, Pencil, Plus, Sun, Trash2 } from '@lucide/svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { t, translate, setLocale, LOCALES, locale } from '$lib/i18n/index.js';
	import type { Locale } from '$lib/i18n/index.js';
	import { selectClass } from '$lib/utils.js';

	let { data, form } = $props();

	let backupLoading = $state(false);
	let cleanLoading = $state(false);
	let feedback = $state<{ ok: boolean; message: string } | null>(null);

	let createUserOpen = $state(false);
	let editUserDialogOpen = $state(false);
	let deleteUserDialogOpen = $state(false);
	let createTagOpen = $state(false);
	let editTagDialogOpen = $state(false);
	let deleteTagDialogOpen = $state(false);
	let createRuleOpen = $state(false);
	let editRuleDialogOpen = $state(false);
	let deleteRuleDialogOpen = $state(false);

	let exportModule = $state('projects');
	let exportFormat = $state('json');
	let importModule = $state('projects');
	let importFormat = $state('json');
	let importFile = $state<File | null>(null);
	let importLoading = $state(false);
	let importResult = $state<{ imported: number; skipped: number; errors: string[] } | null>(null);

	type User = (typeof data.users)[0];
	type Tag = (typeof data.tags)[0];
	type Rule = (typeof data.rules)[0];
	let editUser = $state<User | null>(null);
	let deleteUser = $state<User | null>(null);
	let editTag = $state<Tag | null>(null);
	let deleteTag = $state<Tag | null>(null);
	let editRule = $state<Rule | null>(null);
	let deleteRule = $state<Rule | null>(null);

	const triggerOptions = [
		{ value: 'project_completed', label: $t.settings.triggers.project_completed },
		{ value: 'budget_threshold_exceeded', label: $t.settings.triggers.budget_threshold_exceeded },
		{ value: 'maintenance_due', label: $t.settings.triggers.maintenance_due },
		{ value: 'document_uploaded', label: $t.settings.triggers.document_uploaded },
		{ value: 'task_overdue', label: $t.settings.triggers.task_overdue }
	];

	const actionTypeOptions = [
		{ value: 'create_notification', label: $t.settings.actionTypes.create_notification },
		{ value: 'create_task', label: $t.settings.actionTypes.create_task },
		{ value: 'create_maintenance_schedule', label: $t.settings.actionTypes.create_maintenance_schedule },
		{ value: 'update_asset_status', label: $t.settings.actionTypes.update_asset_status }
	];

	function getEditRuleActionType(rule: Rule | null): string {
		if (!rule) return 'create_notification';
		try {
			const actions = JSON.parse(rule.actions);
			return actions?.[0]?.type ?? 'create_notification';
		} catch {
			return 'create_notification';
		}
	}

	function openEditRule(rule: Rule) {
		editRule = rule;
		editRuleDialogOpen = true;
	}

	function openDeleteRule(rule: Rule) {
		deleteRule = rule;
		deleteRuleDialogOpen = true;
	}

	const cannotDeleteSelf = $derived(Boolean(form?.cannotDeleteSelf));

	let theme = $state<'light' | 'dark' | 'system'>('system');

	$effect(() => {
		const stored = document.cookie.match(/theme=(light|dark|system)/)?.[1] as 'light' | 'dark' | 'system' | undefined;
		const initial = stored ?? 'system';
		theme = initial;
		applyTheme(initial);
	});

	function applyTheme(mode: 'light' | 'dark' | 'system') {
		const isDark =
			mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.classList.toggle('dark', isDark);
	}

	function setTheme(mode: 'light' | 'dark' | 'system') {
		theme = mode;
		applyTheme(mode);
		document.cookie = `theme=${mode};path=/;max-age=${365 * 24 * 60 * 60}`;
	}

	function switchLocale(loc: Locale) {
		setLocale(loc);
	}

	const roleOptions = [
		{ value: 'admin', label: 'admin' },
		{ value: 'adult', label: 'adult' },
		{ value: 'child', label: 'child' },
		{ value: 'guest', label: 'guest' }
	] as const;

	function openEdit(user: User) {
		editUser = user;
		editUserDialogOpen = true;
	}

	function openDelete(user: User) {
		deleteUser = user;
		deleteUserDialogOpen = true;
	}

	function openEditTag(tag: Tag) {
		editTag = tag;
		editTagDialogOpen = true;
	}

	function openDeleteTag(tag: Tag) {
		deleteTag = tag;
		deleteTagDialogOpen = true;
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function createBackup() {
		backupLoading = true;
		feedback = null;
		try {
			const res = await fetch('/api/backup?action=db', { method: 'POST' });
			if (res.ok) {
				feedback = { ok: true, message: 'Database backup created successfully.' };
			} else {
				const body = await res.json().catch(() => ({}));
				feedback = { ok: false, message: body?.error ?? 'Failed to create backup.' };
			}
		} catch {
			feedback = { ok: false, message: 'Network error — backup not created.' };
		} finally {
			backupLoading = false;
		}
	}

	const EXPORT_MODULES = [
		{ value: 'projects', label: $t.projects.title },
		{ value: 'tasks', label: $t.tasks.title },
		{ value: 'assets', label: $t.assets.title },
		{ value: 'rooms', label: $t.rooms.title },
		{ value: 'expenses', label: $t.finances.expenses },
		{ value: 'budgets', label: $t.finances.budgets },
		{ value: 'maintenance', label: $t.maintenance.title },
		{ value: 'knowledge', label: $t.knowledge.title }
	];

	function handleExport() {
		window.location.href = `/api/export?module=${exportModule}&format=${exportFormat}`;
	}

	async function handleImport() {
		if (!importFile || importLoading) return;
		importLoading = true;
		importResult = null;
		try {
			const formData = new FormData();
			formData.set('file', importFile);
			const res = await fetch(`/api/import?module=${importModule}&format=${importFormat}`, {
				method: 'POST',
				body: formData
			});
			if (res.ok) {
				importResult = await res.json();
			} else {
				const body = await res.json().catch(() => ({}));
				importResult = { imported: 0, skipped: 0, errors: [body?.message ?? 'Import failed'] };
			}
		} catch {
			importResult = { imported: 0, skipped: 0, errors: ['Network error'] };
		} finally {
			importLoading = false;
		}
	}

	async function cleanBackups() {
		cleanLoading = true;
		feedback = null;
		try {
			const res = await fetch('/api/backup?action=cleanup&keep=5', { method: 'POST' });
			if (res.ok) {
				const body = await res.json().catch(() => ({}));
				const removed = body?.removed ?? 0;
				feedback = {
					ok: true,
					message: removed > 0 ? `Removed ${removed} old backup(s).` : 'Nothing to clean — already within limit.'
				};
			} else {
				feedback = { ok: false, message: 'Failed to clean old backups.' };
			}
		} catch {
			feedback = { ok: false, message: 'Network error — cleanup not performed.' };
		} finally {
			cleanLoading = false;
		}
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-semibold">{$t.settings.title}</h1>

	<Tabs.Root value="household" class="space-y-4">
		<Tabs.List>
			<Tabs.Trigger value="household">{$t.settings.household}</Tabs.Trigger>
			<Tabs.Trigger value="profile">{$t.settings.profile}</Tabs.Trigger>
			<Tabs.Trigger value="users">{$t.settings.users}</Tabs.Trigger>
			<Tabs.Trigger value="tags">{$t.settings.tags}</Tabs.Trigger>
			<Tabs.Trigger value="appearance">{$t.settings.appearance}</Tabs.Trigger>
			<Tabs.Trigger value="automation">{$t.settings.automation}</Tabs.Trigger>
			<Tabs.Trigger value="audit">{$t.settings.audit}</Tabs.Trigger>
			<Tabs.Trigger value="data">{$t.settings.data}</Tabs.Trigger>
			<Tabs.Trigger value="backup">{$t.settings.backup}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="household">
			<Card.Root>
				<Card.Content class="pt-6">
					<form method="POST" action="?/save" class="space-y-4">
						<div class="space-y-2"><Label for="name">{$t.common.name}</Label><Input id="name" name="name" value={data.household.name} /></div>
						<Button type="submit">{$t.common.save}</Button>
					</form>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="tags">
			<Card.Root>
				<Card.Content class="space-y-4 pt-6">
					<div class="flex items-center justify-between gap-2">
						<h2 class="text-base font-medium">{$t.settings.tags}</h2>
						{#if data.isAdmin}
							<Button onclick={() => (createTagOpen = true)}>
								<Plus class="size-4" />{$t.settings.newTag}
							</Button>
						{/if}
					</div>

					<div class="space-y-2">
						{#each data.tags as tag (tag.id)}
							<div class="flex items-center justify-between rounded-md border p-3 text-sm">
								<div class="flex items-center gap-2">
									<span
										class="size-2.5 rounded-full border"
										style={`background-color: ${tag.color ?? '#9ca3af'}; border-color: ${tag.color ?? '#9ca3af'};`}
									></span>
									<span class="font-medium">{tag.name}</span>
								</div>
								{#if data.isAdmin}
									<div class="flex items-center gap-1">
										<Button
											variant="ghost"
											size="icon"
											onclick={() => openEditTag(tag)}
											aria-label={$t.settings.editTag}
										>
											<Pencil class="size-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onclick={() => openDeleteTag(tag)}
											aria-label={$t.settings.deleteTag}
										>
											<Trash2 class="size-4 text-destructive" />
										</Button>
									</div>
								{/if}
							</div>
						{/each}
						{#if data.tags.length === 0}
							<div class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
								{$t.common.noResults}
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="profile">
			<div class="space-y-4">
				<Card.Root>
					<Card.Content class="space-y-4 pt-6">
						<h2 class="text-base font-medium">{$t.settings.updateProfile}</h2>

						{#if form?.profileUpdated}
							<div class="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
								{$t.settings.profileUpdated}
							</div>
						{/if}

						<form method="POST" action="?/updateProfile" class="space-y-4">
							<div class="space-y-2">
								<Label for="profile-name">{$t.settings.memberName} <span class="text-destructive">*</span></Label>
								<Input id="profile-name" name="name" required value={data.profile?.name ?? ''} />
							</div>
							<div class="space-y-2">
								<Label for="profile-email">{$t.settings.email} <span class="text-destructive">*</span></Label>
								<Input id="profile-email" name="email" type="email" required value={data.profile?.email ?? ''} />
							</div>
							<Button type="submit">{$t.common.save}</Button>
						</form>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Content class="space-y-4 pt-6">
						<h2 class="text-base font-medium">{$t.settings.changePassword}</h2>

						{#if form?.passwordChanged}
							<div class="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
								{$t.settings.passwordChanged}
							</div>
						{/if}
						{#if form?.passwordMismatch}
							<div class="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
								{$t.settings.passwordMismatch}
							</div>
						{/if}
						{#if form?.wrongPassword}
							<div class="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
								{$t.settings.wrongPassword}
							</div>
						{/if}

						<form method="POST" action="?/changePassword" class="space-y-4">
							<div class="space-y-2">
								<Label for="current-password">{$t.settings.currentPassword} <span class="text-destructive">*</span></Label>
								<Input id="current-password" name="currentPassword" type="password" required />
							</div>
							<div class="space-y-2">
								<Label for="new-password">{$t.settings.newPassword} <span class="text-destructive">*</span></Label>
								<Input id="new-password" name="newPassword" type="password" required />
							</div>
							<div class="space-y-2">
								<Label for="confirm-password">{$t.settings.confirmPassword} <span class="text-destructive">*</span></Label>
								<Input id="confirm-password" name="confirmPassword" type="password" required />
							</div>
							<Button type="submit">{$t.settings.changePassword}</Button>
						</form>
					</Card.Content>
				</Card.Root>

				{#if data.hasOidc}
					<Card.Root>
						<Card.Content class="space-y-4 pt-6">
						<h2 class="text-base font-medium">{$t.settings.linkedAccounts}</h2>

						{#if form?.oidcUnlinked}
							<div class="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
								{translate('settings.accountDisconnected', { provider: data.oidcProviderName })}
							</div>
						{/if}

						<div class="flex items-center justify-between gap-3 rounded-md border p-4">
							<div>
								<p class="text-sm font-medium">{data.oidcProviderName}</p>
								<p class="text-sm text-muted-foreground">
									{data.oidcLink ? $t.settings.accountConnected : $t.settings.accountNotConnected}
								</p>
							</div>
							{#if data.oidcLink}
								<form method="POST" action="?/unlinkOidc">
									<Button type="submit" variant="outline">{$t.settings.unlinkAccount}</Button>
								</form>
							{:else}
								<a href="/auth/oidc">
									<Button type="button">{translate('settings.linkAccount', { provider: data.oidcProviderName })}</Button>
								</a>
							{/if}
						</div>
						</Card.Content>
					</Card.Root>
				{/if}
			</div>
		</Tabs.Content>

		<Tabs.Content value="users">
			<Card.Root>
				<Card.Content class="space-y-4 pt-6">
					<div class="flex items-center justify-between gap-2">
						<h2 class="text-base font-medium">{$t.settings.users}</h2>
						{#if data.isAdmin}
							<Button onclick={() => (createUserOpen = true)}><Plus class="size-4" />{$t.settings.addMember}</Button>
						{/if}
					</div>

					{#if cannotDeleteSelf}
						<div class="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
							{$t.settings.cannotDeleteSelf}
						</div>
					{/if}

					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>{$t.settings.memberName}</Table.Head>
								<Table.Head>{$t.settings.email}</Table.Head>
								<Table.Head>{$t.settings.role}</Table.Head>
								<Table.Head>{$t.common.status}</Table.Head>
								{#if data.isAdmin}
									<Table.Head class="w-[120px]">{$t.common.actions}</Table.Head>
								{/if}
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.users as user (user.id)}
								<Table.Row>
									<Table.Cell class="font-medium">{user.name}</Table.Cell>
									<Table.Cell>{user.email}</Table.Cell>
									<Table.Cell class="uppercase">{user.role}</Table.Cell>
									<Table.Cell>
										{user.isActive ? $t.settings.active : $t.settings.inactive}
									</Table.Cell>
									{#if data.isAdmin}
										<Table.Cell>
											<div class="flex items-center gap-1">
												<Button
													variant="ghost"
													size="icon"
													onclick={() => openEdit(user)}
													aria-label={$t.settings.editMember}
												>
													<Pencil class="size-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onclick={() => openDelete(user)}
													aria-label={$t.settings.deleteMember}
												>
													<Trash2 class="size-4 text-destructive" />
												</Button>
											</div>
										</Table.Cell>
									{/if}
								</Table.Row>
							{/each}
							{#if data.users.length === 0}
								<Table.Row>
									<Table.Cell colspan={data.isAdmin ? 5 : 4} class="py-8 text-center text-muted-foreground">
										{$t.common.noResults}
									</Table.Cell>
								</Table.Row>
							{/if}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="appearance">
			<Card.Root>
				<Card.Content class="space-y-4 pt-6">
					<h2 class="text-base font-medium">{$t.settings.appearance}</h2>
					<div class="flex gap-3">
						<Button
							variant={theme === 'light' ? 'default' : 'outline'}
							onclick={() => setTheme('light')}
						>
							<Sun class="size-4" />
							{$t.settings.lightMode}
						</Button>
						<Button
							variant={theme === 'dark' ? 'default' : 'outline'}
							onclick={() => setTheme('dark')}
						>
							<Moon class="size-4" />
							{$t.settings.darkMode}
						</Button>
						<Button
							variant={theme === 'system' ? 'default' : 'outline'}
							onclick={() => setTheme('system')}
						>
							{$t.settings.systemMode}
						</Button>
					</div>

					<h2 class="text-base font-medium">{$t.settings.language}</h2>
					<div class="flex gap-3">
						{#each LOCALES as loc}
							<Button
								variant={$locale === loc.value ? 'default' : 'outline'}
								onclick={() => switchLocale(loc.value)}
							>
								{loc.label}
							</Button>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="automation">
			<Card.Root>
				<Card.Content class="space-y-4 pt-6">
					<div class="flex items-center justify-between gap-2">
						<h2 class="text-base font-medium">{$t.settings.automation}</h2>
						{#if data.isAdmin}
							<Button onclick={() => (createRuleOpen = true)}>
								<Plus class="size-4" />{$t.settings.newRule}
							</Button>
						{/if}
					</div>

					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>{$t.settings.ruleName}</Table.Head>
								<Table.Head>{$t.settings.trigger}</Table.Head>
								<Table.Head>{$t.settings.actionType}</Table.Head>
								<Table.Head>{$t.common.status}</Table.Head>
								<Table.Head>{$t.settings.triggerCount}</Table.Head>
								{#if data.isAdmin}
									<Table.Head class="w-[120px]">{$t.common.actions}</Table.Head>
								{/if}
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.rules as rule (rule.id)}
								<Table.Row>
									<Table.Cell class="font-medium">
										<div>
											{rule.name}
											{#if rule.description}
												<p class="text-xs text-muted-foreground">{rule.description}</p>
											{/if}
										</div>
									</Table.Cell>
									<Table.Cell class="text-sm">{triggerOptions.find((t) => t.value === rule.trigger)?.label ?? rule.trigger}</Table.Cell>
									<Table.Cell class="text-sm">{actionTypeOptions.find((a) => a.value === getEditRuleActionType(rule))?.label ?? '—'}</Table.Cell>
									<Table.Cell>
										{#if data.isAdmin}
											<form
												method="POST"
												action="?/toggleRule"
												use:enhance={() => ({ update }) => update({ reset: false })}
											>
												<input type="hidden" name="id" value={rule.id} />
												<input type="hidden" name="isEnabled" value={String(!rule.isEnabled)} />
												<button
													type="submit"
													class="rounded-full px-2.5 py-0.5 text-xs font-medium {rule.isEnabled
														? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
														: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}"
												>
													{rule.isEnabled ? $t.settings.enabled : $t.settings.disabled}
												</button>
											</form>
										{:else}
											<span
												class="rounded-full px-2.5 py-0.5 text-xs font-medium {rule.isEnabled
													? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
													: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}"
											>
												{rule.isEnabled ? $t.settings.enabled : $t.settings.disabled}
											</span>
										{/if}
									</Table.Cell>
									<Table.Cell class="text-sm tabular-nums">{rule.triggerCount}</Table.Cell>
									{#if data.isAdmin}
										<Table.Cell>
											<div class="flex items-center gap-1">
												<Button
													variant="ghost"
													size="icon"
													onclick={() => openEditRule(rule)}
													aria-label={$t.settings.editRule}
												>
													<Pencil class="size-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onclick={() => openDeleteRule(rule)}
													aria-label={$t.settings.deleteRule}
												>
													<Trash2 class="size-4 text-destructive" />
												</Button>
											</div>
										</Table.Cell>
									{/if}
								</Table.Row>
							{/each}
							{#if data.rules.length === 0}
								<Table.Row>
									<Table.Cell colspan={data.isAdmin ? 6 : 5} class="py-8 text-center text-muted-foreground">
										{$t.settings.noRules}
									</Table.Cell>
								</Table.Row>
							{/if}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="audit">
			<Card.Root>
				<Card.Content class="space-y-4 pt-6">
					<h2 class="text-base font-medium">{$t.settings.audit}</h2>

					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>{$t.settings.auditAction}</Table.Head>
								<Table.Head>{$t.settings.auditEntity}</Table.Head>
								<Table.Head>{$t.settings.auditUser}</Table.Head>
								<Table.Head>{$t.settings.auditDate}</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.auditEntries as entry (entry.id)}
								<Table.Row>
									<Table.Cell>
										<span
											class="rounded-full px-2 py-0.5 text-xs font-medium
												{entry.action === 'create'
												? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
												: entry.action === 'delete'
													? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
													: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}"
										>
											{entry.action}
										</span>
									</Table.Cell>
									<Table.Cell class="text-sm">
										<span class="font-medium">{entry.entityType}</span>
										<span class="text-muted-foreground ml-1 font-mono text-xs">{entry.entityId.slice(0, 8)}…</span>
									</Table.Cell>
									<Table.Cell class="text-sm">{entry.userName ?? '—'}</Table.Cell>
									<Table.Cell class="text-sm text-muted-foreground">{formatDate(entry.createdAt)}</Table.Cell>
								</Table.Row>
							{/each}
							{#if data.auditEntries.length === 0}
								<Table.Row>
									<Table.Cell colspan={4} class="py-8 text-center text-muted-foreground">
										{$t.settings.noAuditEntries}
									</Table.Cell>
								</Table.Row>
							{/if}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="data">
			<div class="space-y-4">
				<Card.Root>
					<Card.Content class="space-y-4 pt-6">
						<h2 class="text-base font-medium">{$t.settings.exportData}</h2>
						<div class="flex flex-wrap items-end gap-3">
							<div class="space-y-2">
								<Label for="export-module">{$t.settings.exportModule}</Label>
								<select id="export-module" class={selectClass} bind:value={exportModule}>
									{#each EXPORT_MODULES as mod}
										<option value={mod.value}>{mod.label}</option>
									{/each}
								</select>
							</div>
							<div class="space-y-2">
								<Label for="export-format">{$t.settings.format}</Label>
								<select id="export-format" class={selectClass} bind:value={exportFormat}>
									<option value="json">JSON</option>
									<option value="csv">CSV</option>
								</select>
							</div>
							<Button onclick={handleExport}>{$t.settings.exportData}</Button>
						</div>
					</Card.Content>
				</Card.Root>

				{#if data.isAdmin}
					<Card.Root>
						<Card.Content class="space-y-4 pt-6">
							<h2 class="text-base font-medium">{$t.settings.importData}</h2>
							<div class="flex flex-wrap items-end gap-3">
								<div class="space-y-2">
									<Label for="import-module">{$t.settings.importModule}</Label>
									<select id="import-module" class={selectClass} bind:value={importModule}>
										{#each EXPORT_MODULES as mod}
											<option value={mod.value}>{mod.label}</option>
										{/each}
									</select>
								</div>
								<div class="space-y-2">
									<Label for="import-format">{$t.settings.format}</Label>
									<select id="import-format" class={selectClass} bind:value={importFormat}>
										<option value="json">JSON</option>
										<option value="csv">CSV</option>
									</select>
								</div>
								<div class="space-y-2">
									<Label for="import-file">&nbsp;</Label>
									<input
										id="import-file"
										type="file"
										accept=".csv,.json"
										class={selectClass}
										onchange={(e) => { importFile = (e.target as HTMLInputElement).files?.[0] ?? null; }}
									/>
								</div>
								<Button onclick={handleImport} disabled={!importFile || importLoading}>
									{importLoading ? $t.common.loading : $t.settings.importData}
								</Button>
							</div>
							{#if importResult}
								<div class="rounded-md border px-4 py-3 text-sm {importResult.errors.length === 0
									? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
									: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200'}">
									<p>{translate('settings.importSuccess', { count: String(importResult.imported) })}</p>
									{#if importResult.skipped > 0}
										<p>{translate('settings.importSkipped', { count: String(importResult.skipped) })}</p>
									{/if}
									{#if importResult.errors.length > 0}
										<details class="mt-2">
											<summary class="cursor-pointer font-medium">{$t.settings.importErrors}</summary>
											<ul class="mt-1 list-inside list-disc text-xs">
												{#each importResult.errors as err}
													<li>{err}</li>
												{/each}
											</ul>
										</details>
									{/if}
								</div>
							{/if}
						</Card.Content>
					</Card.Root>
				{/if}
			</div>
		</Tabs.Content>

		<Tabs.Content value="backup">
			<div class="space-y-4">
				<Card.Root>
					<Card.Content class="pt-6 space-y-4">
						<h2 class="text-base font-medium">Backup Actions</h2>

						<div class="flex flex-wrap gap-3">
							<Button onclick={createBackup} disabled={backupLoading}>
								{backupLoading ? 'Creating…' : 'Create Backup'}
							</Button>

							<a href="/api/backup?action=download" target="_blank" rel="noopener noreferrer">
								<Button variant="outline">Download Full Backup</Button>
							</a>

							<Button variant="destructive" onclick={cleanBackups} disabled={cleanLoading}>
								{cleanLoading ? 'Cleaning…' : 'Clean Old Backups'}
							</Button>
						</div>

						{#if feedback}
							<div
								class="rounded-md border px-4 py-3 text-sm {feedback.ok
									? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
									: 'border-destructive/30 bg-destructive/10 text-destructive'}"
							>
								{feedback.message}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Content class="pt-6 space-y-3">
						<h2 class="text-base font-medium">Existing Backups</h2>

						{#if data.backups.length === 0}
							<p class="text-sm text-muted-foreground">No backups found. Create one above.</p>
						{:else}
							<div class="divide-y divide-border rounded-md border">
								{#each data.backups as backup (backup.filename)}
									<div class="flex items-center justify-between px-4 py-3 text-sm">
										<span class="font-mono text-xs text-muted-foreground truncate max-w-[50%]">{backup.filename}</span>
										<span class="text-muted-foreground">{formatDate(backup.createdAt)}</span>
										<span class="font-medium tabular-nums">{formatSize(backup.sizeBytes)}</span>
									</div>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>

<Dialog.Root bind:open={createUserOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.settings.addMember}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/createUser"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						createUserOpen = false;
					})}
		>
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="create-user-name"
						>{$t.settings.memberName} <span class="text-destructive">*</span></Label
					>
					<Input id="create-user-name" name="name" required />
				</div>
				<div class="space-y-2">
					<Label for="create-user-email"
						>{$t.settings.email} <span class="text-destructive">*</span></Label
					>
					<Input id="create-user-email" name="email" type="email" required />
				</div>
				<div class="space-y-2">
					<Label for="create-user-password"
						>{$t.settings.password} <span class="text-destructive">*</span></Label
					>
					<Input id="create-user-password" name="password" type="password" required />
				</div>
				<div class="space-y-2">
					<Label for="create-user-role">{$t.settings.role}</Label>
					<select id="create-user-role" name="role" class={selectClass}>
						{#each roleOptions as role}
							<option value={role.value} selected={role.value === 'adult'}>{role.label}</option>
						{/each}
					</select>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createUserOpen = false)}>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.create}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={createTagOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$t.settings.newTag}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/createTag"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						createTagOpen = false;
					})}
		>
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="create-tag-name"
						>{$t.common.name} <span class="text-destructive">*</span></Label
					>
					<Input id="create-tag-name" name="name" required />
				</div>
				<div class="space-y-2">
					<Label for="create-tag-color">{$t.settings.tagColor}</Label>
					<Input id="create-tag-color" name="color" type="color" />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createTagOpen = false)}>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.create}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	bind:open={editTagDialogOpen}
	onOpenChange={(o) => {
		if (!o) editTag = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$t.settings.editTag}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/updateTag"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						editTagDialogOpen = false;
						editTag = null;
					})}
		>
			<input type="hidden" name="id" value={editTag?.id ?? ''} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="edit-tag-name"
						>{$t.common.name} <span class="text-destructive">*</span></Label
					>
					<Input id="edit-tag-name" name="name" required value={editTag?.name ?? ''} />
				</div>
				<div class="space-y-2">
					<Label for="edit-tag-color">{$t.settings.tagColor}</Label>
					<Input id="edit-tag-color" name="color" type="color" value={editTag?.color ?? '#9ca3af'} />
				</div>
			</div>
			<Dialog.Footer>
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						editTagDialogOpen = false;
						editTag = null;
					}}
				>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.save}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	bind:open={editUserDialogOpen}
	onOpenChange={(o) => {
		if (!o) editUser = null;
	}}
>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.settings.editMember}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/updateUser"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						editUserDialogOpen = false;
						editUser = null;
					})}
		>
			<input type="hidden" name="id" value={editUser?.id ?? ''} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="edit-user-name"
						>{$t.settings.memberName} <span class="text-destructive">*</span></Label
					>
					<Input id="edit-user-name" name="name" required value={editUser?.name ?? ''} />
				</div>
				<div class="space-y-2">
					<Label for="edit-user-email"
						>{$t.settings.email} <span class="text-destructive">*</span></Label
					>
					<Input id="edit-user-email" name="email" type="email" required value={editUser?.email ?? ''} />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="edit-user-role">{$t.settings.role}</Label>
						<select id="edit-user-role" name="role" class={selectClass}>
							{#each roleOptions as role}
								<option value={role.value} selected={role.value === (editUser?.role ?? 'adult')}>
									{role.label}
								</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label for="edit-user-active">{$t.common.status}</Label>
						<select id="edit-user-active" name="isActive" class={selectClass}>
							<option value="true" selected={editUser?.isActive ?? true}>{$t.settings.active}</option>
							<option value="false" selected={!(editUser?.isActive ?? true)}>{$t.settings.inactive}</option>
						</select>
					</div>
				</div>
				<div class="space-y-2">
					<Label for="edit-user-password">{$t.settings.password}</Label>
					<Input
						id="edit-user-password"
						name="password"
						type="password"
						placeholder={$t.settings.passwordOptional}
					/>
				</div>
			</div>
			<Dialog.Footer>
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						editUserDialogOpen = false;
						editUser = null;
					}}
				>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.save}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
	bind:open={deleteUserDialogOpen}
	onOpenChange={(o) => {
		if (!o) deleteUser = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{$t.settings.deleteMember}</AlertDialog.Title>
			<AlertDialog.Description>
				{translate('settings.deleteMemberConfirm', { name: deleteUser?.name ?? '' })}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				onclick={() => {
					deleteUserDialogOpen = false;
					deleteUser = null;
				}}>{$t.common.cancel}</AlertDialog.Cancel
			>
			<form
				method="POST"
				action="?/deleteUser"
				use:enhance={() =>
					({ update }) =>
						update().then(() => {
							deleteUserDialogOpen = false;
							deleteUser = null;
						})}
			>
				<input type="hidden" name="id" value={deleteUser?.id ?? ''} />
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

<AlertDialog.Root
	bind:open={deleteTagDialogOpen}
	onOpenChange={(o) => {
		if (!o) deleteTag = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{$t.settings.deleteTag}</AlertDialog.Title>
			<AlertDialog.Description>
				{translate('settings.deleteTagConfirm', { name: deleteTag?.name ?? '' })}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				onclick={() => {
					deleteTagDialogOpen = false;
					deleteTag = null;
				}}>{$t.common.cancel}</AlertDialog.Cancel
			>
			<form
				method="POST"
				action="?/deleteTag"
				use:enhance={() =>
					({ update }) =>
						update().then(() => {
							deleteTagDialogOpen = false;
							deleteTag = null;
						})}
			>
				<input type="hidden" name="id" value={deleteTag?.id ?? ''} />
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

<Dialog.Root bind:open={createRuleOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.settings.newRule}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/createRule"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						createRuleOpen = false;
					})}
		>
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="create-rule-name">{$t.settings.ruleName} <span class="text-destructive">*</span></Label>
					<Input id="create-rule-name" name="name" required />
				</div>
				<div class="space-y-2">
					<Label for="create-rule-desc">{$t.common.description}</Label>
					<Input id="create-rule-desc" name="description" />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="create-rule-trigger">{$t.settings.trigger}</Label>
						<select id="create-rule-trigger" name="trigger" class={selectClass}>
							{#each triggerOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label for="create-rule-action">{$t.settings.actionType}</Label>
						<select id="create-rule-action" name="actionType" class={selectClass}>
							{#each actionTypeOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<input type="checkbox" id="create-rule-enabled" name="isEnabled" class="size-4 rounded border" checked />
					<Label for="create-rule-enabled">{$t.settings.enabled}</Label>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createRuleOpen = false)}>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.create}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	bind:open={editRuleDialogOpen}
	onOpenChange={(o) => {
		if (!o) editRule = null;
	}}
>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.settings.editRule}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/updateRule"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						editRuleDialogOpen = false;
						editRule = null;
					})}
		>
			<input type="hidden" name="id" value={editRule?.id ?? ''} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="edit-rule-name">{$t.settings.ruleName} <span class="text-destructive">*</span></Label>
					<Input id="edit-rule-name" name="name" required value={editRule?.name ?? ''} />
				</div>
				<div class="space-y-2">
					<Label for="edit-rule-desc">{$t.common.description}</Label>
					<Input id="edit-rule-desc" name="description" value={editRule?.description ?? ''} />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="edit-rule-trigger">{$t.settings.trigger}</Label>
						<select id="edit-rule-trigger" name="trigger" class={selectClass}>
							{#each triggerOptions as opt}
								<option value={opt.value} selected={opt.value === (editRule?.trigger ?? 'project_completed')}>{opt.label}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label for="edit-rule-action">{$t.settings.actionType}</Label>
						<select id="edit-rule-action" name="actionType" class={selectClass}>
							{#each actionTypeOptions as opt}
								<option value={opt.value} selected={opt.value === getEditRuleActionType(editRule)}>{opt.label}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<input
						type="checkbox"
						id="edit-rule-enabled"
						name="isEnabled"
						class="size-4 rounded border"
						checked={editRule?.isEnabled ?? true}
					/>
					<Label for="edit-rule-enabled">{$t.settings.enabled}</Label>
				</div>
			</div>
			<Dialog.Footer>
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						editRuleDialogOpen = false;
						editRule = null;
					}}
				>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.save}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
	bind:open={deleteRuleDialogOpen}
	onOpenChange={(o) => {
		if (!o) deleteRule = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{$t.settings.deleteRule}</AlertDialog.Title>
			<AlertDialog.Description>
				{translate('settings.deleteRuleConfirm', { name: deleteRule?.name ?? '' })}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				onclick={() => {
					deleteRuleDialogOpen = false;
					deleteRule = null;
				}}>{$t.common.cancel}</AlertDialog.Cancel
			>
			<form
				method="POST"
				action="?/deleteRule"
				use:enhance={() =>
					({ update }) =>
						update().then(() => {
							deleteRuleDialogOpen = false;
							deleteRule = null;
						})}
			>
				<input type="hidden" name="id" value={deleteRule?.id ?? ''} />
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
