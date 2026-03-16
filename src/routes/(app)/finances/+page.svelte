<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Plus, Trash2, Pencil, ChevronDown, ChevronRight } from '@lucide/svelte';
	import BulkActions from '$lib/components/bulk-actions.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { t, translate } from '$lib/i18n/index.js';
	import { hasModuleAccess } from '$lib/permissions.js';
	import { selectClass } from '$lib/utils.js';

	let { data } = $props();
	const userRole = $derived(page.data.user?.role ?? 'guest');

	let createExpenseOpen = $state(false);
	let createBudgetOpen = $state(false);
	let deleteExpenseDialogOpen = $state(false);
	let deleteBudgetDialogOpen = $state(false);
	let editExpenseOpen = $state(false);
	let editBudgetOpen = $state(false);
	let createCategoryOpen = $state(false);
	let editCategoryOpen = $state(false);
	let deleteCategoryOpen = $state(false);

	type Expense = (typeof data.expenses)[0];
	type Budget = (typeof data.budgets)[0];
	type BudgetLine = (typeof data.budgets)[0]['lines'][0];
	type Category = (typeof data.categoryList)[0];

	let expenseToDelete = $state<Expense | null>(null);
	let budgetToDelete = $state<Budget | null>(null);
	let expenseToEdit = $state<Expense | null>(null);
	let budgetToEdit = $state<Budget | null>(null);
	let addLineForBudgetId = $state<string | null>(null);
	let editLineOpen = $state(false);
	let lineToEdit = $state<BudgetLine | null>(null);
	let deleteLineOpen = $state(false);
	let lineToDelete = $state<BudgetLine | null>(null);
	let expandedBudgets = $state<Set<string>>(new Set());
	let categoryToEdit = $state<Category | null>(null);
	let categoryToDelete = $state<Category | null>(null);
	let selectedExpenseIds = $state<Set<string>>(new Set());
	let bulkDeleteExpensesOpen = $state(false);

	const expenseIds = $derived(data.expenses.map((expense) => expense.id));
	const selectedExpenseIdsValue = $derived(Array.from(selectedExpenseIds).join(','));
	const allExpensesSelected = $derived(
		expenseIds.length > 0 && expenseIds.every((id) => selectedExpenseIds.has(id))
	);

	function openDeleteExpense(expense: Expense) {
		expenseToDelete = expense;
		deleteExpenseDialogOpen = true;
	}

	function toggleExpenseSelection(expenseId: string, checked: boolean) {
		const next = new Set(selectedExpenseIds);
		if (checked) {
			next.add(expenseId);
		} else {
			next.delete(expenseId);
		}
		selectedExpenseIds = next;
	}

	function toggleAllExpenses(checked: boolean) {
		const next = new Set(selectedExpenseIds);
		for (const id of expenseIds) {
			if (checked) {
				next.add(id);
			} else {
				next.delete(id);
			}
		}
		selectedExpenseIds = next;
	}

	function clearExpenseSelection() {
		selectedExpenseIds = new Set();
	}

	function openDeleteBudget(budget: Budget) {
		budgetToDelete = budget;
		deleteBudgetDialogOpen = true;
	}

	function openEditExpense(expense: Expense) {
		expenseToEdit = expense;
		editExpenseOpen = true;
	}

	function openEditBudget(budget: Budget) {
		budgetToEdit = budget;
		editBudgetOpen = true;
	}

	function toggleBudgetExpand(budgetId: string) {
		const next = new Set(expandedBudgets);
		if (next.has(budgetId)) {
			next.delete(budgetId);
		} else {
			next.add(budgetId);
		}
		expandedBudgets = next;
	}

	function openEditLine(line: BudgetLine) {
		lineToEdit = line;
		editLineOpen = true;
	}

	function openDeleteLine(line: BudgetLine) {
		lineToDelete = line;
		deleteLineOpen = true;
	}

	function openEditCategory(cat: Category) {
		categoryToEdit = cat;
		editCategoryOpen = true;
	}

	function openDeleteCategory(cat: Category) {
		categoryToDelete = cat;
		deleteCategoryOpen = true;
	}

</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">{$t.finances.title}</h1>
		<div class="flex gap-2">
			{#if hasModuleAccess(userRole, 'finances', 'create')}
				<Button variant="outline" onclick={() => (createExpenseOpen = true)}>
					<Plus class="size-4" />{$t.finances.newExpense}
				</Button>
				<Button onclick={() => (createBudgetOpen = true)}>
					<Plus class="size-4" />{$t.finances.newBudget}
				</Button>
			{/if}
		</div>
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		<Card.Root>
			<Card.Header><Card.Title>{$t.finances.expenses}</Card.Title></Card.Header>
			<Card.Content class="pt-0">
				<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-12">
							<input
								type="checkbox"
								aria-label="Select all"
								checked={allExpensesSelected}
								onchange={(e) => toggleAllExpenses(e.currentTarget.checked)}
							/>
						</Table.Head>
						<Table.Head>{$t.common.name}</Table.Head>
						<Table.Head>{$t.finances.amount}</Table.Head>
							<Table.Head>{$t.common.date}</Table.Head>
							<Table.Head class="w-[60px]">{$t.common.actions}</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
					{#each data.expenses as expense (expense.id)}
						<Table.Row>
							<Table.Cell>
								<input
									type="checkbox"
									aria-label={`Select ${expense.description}`}
									checked={selectedExpenseIds.has(expense.id)}
									onchange={(e) => toggleExpenseSelection(expense.id, e.currentTarget.checked)}
								/>
							</Table.Cell>
							<Table.Cell>{expense.description}</Table.Cell>
							<Table.Cell>{expense.amount}</Table.Cell>
								<Table.Cell>{expense.date}</Table.Cell>
							<Table.Cell>
								{#if hasModuleAccess(userRole, 'finances', 'edit')}
									<Button
										variant="ghost"
										size="icon"
										onclick={() => openEditExpense(expense)}
										aria-label="Edit expense"
									>
										<Pencil class="size-4" />
									</Button>
								{/if}
								{#if hasModuleAccess(userRole, 'finances', 'delete')}
									<Button
										variant="ghost"
										size="icon"
										onclick={() => openDeleteExpense(expense)}
										aria-label="Delete expense"
									>
										<Trash2 class="size-4 text-destructive" />
									</Button>
								{/if}
							</Table.Cell>
							</Table.Row>
						{/each}
						{#if data.expenses.length === 0}
							<Table.Row>
								<Table.Cell colspan={5} class="text-muted-foreground py-8 text-center">
									{$t.common.noResults}
								</Table.Cell>
							</Table.Row>
						{/if}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Title>{$t.finances.budgets}</Card.Title></Card.Header>
			<Card.Content class="space-y-2 pt-0">
				{#each data.budgets as budget (budget.id)}
					<div class="rounded-md border p-3 text-sm">
						<div class="flex items-start justify-between">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<button
										type="button"
										onclick={() => toggleBudgetExpand(budget.id)}
										class="text-muted-foreground hover:text-foreground"
										aria-label={$t.finances.lineItems}
									>
										{#if expandedBudgets.has(budget.id)}
											<ChevronDown class="size-4" />
										{:else}
											<ChevronRight class="size-4" />
										{/if}
									</button>
									<p class="font-medium">{budget.name}</p>
								</div>
								{#if budget.project?.name}
									<p class="text-muted-foreground">{budget.project.name}</p>
								{/if}
								<p>{budget.spent} / {budget.totalAmount}</p>
							</div>
							<div class="ml-2 flex shrink-0 gap-1">
								{#if hasModuleAccess(userRole, 'finances', 'edit')}
									<Button
										variant="ghost"
										size="icon"
										onclick={() => openEditBudget(budget)}
										aria-label="Edit budget"
									>
										<Pencil class="size-4" />
									</Button>
								{/if}
								{#if hasModuleAccess(userRole, 'finances', 'delete')}
									<Button
										variant="ghost"
										size="icon"
										onclick={() => openDeleteBudget(budget)}
										aria-label="Delete budget"
									>
										<Trash2 class="size-4 text-destructive" />
									</Button>
								{/if}
							</div>
						</div>
						{#if expandedBudgets.has(budget.id)}
							<div class="mt-2 space-y-1 border-t pt-2">
								{#if budget.lines.length > 0}
									{#each budget.lines as line (line.id)}
										<div class="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-muted/50">
											<span>{line.name}</span>
											<div class="flex items-center gap-1">
												<span class="text-muted-foreground">{line.plannedAmount}</span>
												{#if hasModuleAccess(userRole, 'finances', 'edit')}
													<button
														type="button"
														onclick={() => openEditLine(line)}
														class="text-muted-foreground hover:text-foreground"
														aria-label="Edit"
													>
														<Pencil class="size-3" />
													</button>
												{/if}
												{#if hasModuleAccess(userRole, 'finances', 'delete')}
													<button
														type="button"
														onclick={() => openDeleteLine(line)}
														class="text-muted-foreground hover:text-destructive"
														aria-label="Delete"
													>
														<Trash2 class="size-3" />
													</button>
												{/if}
											</div>
										</div>
									{/each}
								{:else}
									<p class="px-2 py-1 text-xs text-muted-foreground">{$t.common.noResults}</p>
								{/if}
								{#if hasModuleAccess(userRole, 'finances', 'create')}
									<button
										type="button"
										class="flex w-full items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
										onclick={() => (addLineForBudgetId = budget.id)}
									>
										<Plus class="size-3" /> {$t.finances.addLine}
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
				{#if data.budgets.length === 0}
					<p class="text-muted-foreground py-4 text-center text-sm">{$t.common.noResults}</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<Card.Title>{$t.finances.categories}</Card.Title>
				{#if hasModuleAccess(userRole, 'finances', 'create')}
					<Button size="sm" variant="outline" onclick={() => (createCategoryOpen = true)}>
						<Plus class="size-4" />{$t.finances.newCategory}
					</Button>
				{/if}
			</div>
		</Card.Header>
		<Card.Content class="pt-0 space-y-1">
			{#each data.categoryList as cat (cat.id)}
				<div class="flex items-center justify-between rounded-md border p-2 text-sm">
					<div class="flex items-center gap-2">
						{#if cat.color}
							<span class="inline-block size-3 rounded-full" style="background-color: {cat.color}"></span>
						{/if}
						{#if cat.icon}
							<span>{cat.icon}</span>
						{/if}
						<span>{cat.name}</span>
					</div>
					<div class="flex items-center gap-1">
						{#if hasModuleAccess(userRole, 'finances', 'edit')}
							<Button variant="ghost" size="icon" onclick={() => openEditCategory(cat)} aria-label="Edit category">
								<Pencil class="size-4" />
							</Button>
						{/if}
						{#if hasModuleAccess(userRole, 'finances', 'delete')}
							<Button variant="ghost" size="icon" onclick={() => openDeleteCategory(cat)} aria-label="Delete category">
								<Trash2 class="size-4 text-destructive" />
							</Button>
						{/if}
					</div>
				</div>
			{/each}
			{#if data.categoryList.length === 0}
				<p class="text-muted-foreground py-4 text-center text-sm">{$t.common.noResults}</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<BulkActions selectedCount={selectedExpenseIds.size} onDeselectAll={clearExpenseSelection}>
	{#snippet children()}
		{#if hasModuleAccess(userRole, 'finances', 'delete')}
		<Button type="button" variant="destructive" onclick={() => (bulkDeleteExpensesOpen = true)}>
			{$t.common.bulkDelete}
		</Button>
		{/if}
	{/snippet}
</BulkActions>

<AlertDialog.Root bind:open={bulkDeleteExpensesOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
		<AlertDialog.Title>{$t.common.bulkDelete}</AlertDialog.Title>
		<AlertDialog.Description>
			{translate('common.bulkDeleteConfirm', { count: selectedExpenseIds.size })}
		</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (bulkDeleteExpensesOpen = false)}>Cancel</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/bulkDeleteExpense"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							bulkDeleteExpensesOpen = false;
							clearExpenseSelection();
						}
						await update();
					};
				}}
			>
				<input type="hidden" name="ids" value={selectedExpenseIdsValue} />
				<AlertDialog.Action
					type="submit"
					class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				>
					Delete
				</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<Dialog.Root bind:open={createExpenseOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.finances.newExpense}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/createExpense"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						createExpenseOpen = false;
					})}
		>
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="exp-description"
						>{$t.common.description} <span class="text-destructive">*</span></Label
					>
					<Input id="exp-description" name="description" required placeholder="e.g. Grocery shopping" />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="exp-amount"
							>{$t.finances.amount} <span class="text-destructive">*</span></Label
						>
						<Input id="exp-amount" name="amount" type="number" step="0.01" required placeholder="0.00" />
					</div>
					<div class="space-y-2">
						<Label for="exp-date"
							>{$t.common.date} <span class="text-destructive">*</span></Label
						>
						<Input id="exp-date" name="date" type="date" required />
					</div>
				</div>
				<div class="space-y-2">
					<Label for="exp-category">{$t.finances.category}</Label>
					<select id="exp-category" name="categoryId" class={selectClass}>
						<option value="">— None —</option>
						{#each data.categoryList as category}
							<option value={category.id}>{category.name}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-2">
					<Label for="exp-project">Project</Label>
					<select id="exp-project" name="projectId" class={selectClass}>
						<option value="">— None —</option>
						{#each data.projects as project}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-2">
					<Label for="exp-payment">Payment Method</Label>
					<select id="exp-payment" name="paymentMethod" class={selectClass}>
						<option value="">— None —</option>
						<option value="cash">Cash</option>
						<option value="card">Card</option>
						<option value="transfer">Transfer</option>
						<option value="check">Check</option>
						<option value="other">Other</option>
					</select>
				</div>
				<div class="space-y-2">
					<Label for="exp-vendor">Vendor</Label>
					<Input id="exp-vendor" name="vendor" placeholder="e.g. Carrefour" />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createExpenseOpen = false)}>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.create}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editExpenseOpen} onOpenChange={(o) => { if (!o) expenseToEdit = null; }}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.finances.editExpense}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/updateExpense"
			use:enhance={() =>
				({ result, update }) => {
					if (result.type === 'success') {
						editExpenseOpen = false;
						expenseToEdit = null;
					}
					return update();
				}}
		>
			<input type="hidden" name="id" value={expenseToEdit?.id ?? ''} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="edit-exp-description"
						>{$t.common.description} <span class="text-destructive">*</span></Label
					>
					<Input id="edit-exp-description" name="description" required placeholder="e.g. Grocery shopping" value={expenseToEdit?.description ?? ''} />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="edit-exp-amount"
							>{$t.finances.amount} <span class="text-destructive">*</span></Label
						>
						<Input id="edit-exp-amount" name="amount" type="number" step="0.01" required placeholder="0.00" value={expenseToEdit?.amount ?? ''} />
					</div>
					<div class="space-y-2">
						<Label for="edit-exp-date"
							>{$t.common.date} <span class="text-destructive">*</span></Label
						>
						<Input id="edit-exp-date" name="date" type="date" required value={expenseToEdit?.date ?? ''} />
					</div>
				</div>
				<div class="space-y-2">
					<Label for="edit-exp-category">{$t.finances.category}</Label>
					<select id="edit-exp-category" name="categoryId" class={selectClass}>
						<option value="">— None —</option>
						{#each data.categoryList as category}
							<option value={category.id} selected={expenseToEdit?.categoryId === category.id}>{category.name}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-2">
					<Label for="edit-exp-project">Project</Label>
					<select id="edit-exp-project" name="projectId" class={selectClass}>
						<option value="">— None —</option>
						{#each data.projects as project}
							<option value={project.id} selected={expenseToEdit?.projectId === project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-2">
					<Label for="edit-exp-payment">Payment Method</Label>
					<select id="edit-exp-payment" name="paymentMethod" class={selectClass}>
						<option value="">— None —</option>
						<option value="cash" selected={expenseToEdit?.paymentMethod === 'cash'}>Cash</option>
						<option value="card" selected={expenseToEdit?.paymentMethod === 'card'}>Card</option>
						<option value="transfer" selected={expenseToEdit?.paymentMethod === 'transfer'}>Transfer</option>
						<option value="check" selected={expenseToEdit?.paymentMethod === 'check'}>Check</option>
						<option value="other" selected={expenseToEdit?.paymentMethod === 'other'}>Other</option>
					</select>
				</div>
				<div class="space-y-2">
					<Label for="edit-exp-vendor">Vendor</Label>
					<Input id="edit-exp-vendor" name="vendor" placeholder="e.g. Carrefour" value={expenseToEdit?.vendor ?? ''} />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (editExpenseOpen = false)}>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.save}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={createBudgetOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.finances.newBudget}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/createBudget"
			use:enhance={() =>
				({ update }) =>
					update().then(() => {
						createBudgetOpen = false;
					})}
		>
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="bud-name"
						>{$t.common.name} <span class="text-destructive">*</span></Label
					>
					<Input id="bud-name" name="name" required placeholder="e.g. Kitchen Renovation" />
				</div>
				<div class="space-y-2">
					<Label for="bud-total"
						>Total Amount <span class="text-destructive">*</span></Label
					>
					<Input id="bud-total" name="totalAmount" type="number" step="0.01" required placeholder="0.00" />
				</div>
				<div class="space-y-2">
					<Label for="bud-project">Project</Label>
					<select id="bud-project" name="projectId" class={selectClass}>
						<option value="">— None —</option>
						{#each data.projects as project}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="bud-start">Start Date</Label>
						<Input id="bud-start" name="startDate" type="date" />
					</div>
					<div class="space-y-2">
						<Label for="bud-end">End Date</Label>
						<Input id="bud-end" name="endDate" type="date" />
					</div>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createBudgetOpen = false)}>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.create}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editBudgetOpen} onOpenChange={(o) => { if (!o) budgetToEdit = null; }}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t.finances.editBudget}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/updateBudget"
			use:enhance={() =>
				({ result, update }) => {
					if (result.type === 'success') {
						editBudgetOpen = false;
						budgetToEdit = null;
					}
					return update();
				}}
		>
			<input type="hidden" name="id" value={budgetToEdit?.id ?? ''} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="edit-bud-name"
						>{$t.common.name} <span class="text-destructive">*</span></Label
					>
					<Input id="edit-bud-name" name="name" required placeholder="e.g. Kitchen Renovation" value={budgetToEdit?.name ?? ''} />
				</div>
				<div class="space-y-2">
					<Label for="edit-bud-total"
						>Total Amount <span class="text-destructive">*</span></Label
					>
					<Input id="edit-bud-total" name="totalAmount" type="number" step="0.01" required placeholder="0.00" value={budgetToEdit?.totalAmount ?? ''} />
				</div>
				<div class="space-y-2">
					<Label for="edit-bud-project">Project</Label>
					<select id="edit-bud-project" name="projectId" class={selectClass}>
						<option value="">— None —</option>
						{#each data.projects as project}
							<option value={project.id} selected={budgetToEdit?.projectId === project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="edit-bud-start">Start Date</Label>
						<Input id="edit-bud-start" name="startDate" type="date" value={budgetToEdit?.startDate ?? ''} />
					</div>
					<div class="space-y-2">
						<Label for="edit-bud-end">End Date</Label>
						<Input id="edit-bud-end" name="endDate" type="date" value={budgetToEdit?.endDate ?? ''} />
					</div>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (editBudgetOpen = false)}>
					{$t.common.cancel}
				</Button>
				<Button type="submit">{$t.common.save}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	open={addLineForBudgetId !== null}
	onOpenChange={(o) => {
		if (!o) addLineForBudgetId = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header><Dialog.Title>{$t.finances.addLine}</Dialog.Title></Dialog.Header>
		<form
			method="POST"
			action="?/createBudgetLine"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') addLineForBudgetId = null;
					await update();
				};
			}}
		>
			<input type="hidden" name="budgetId" value={addLineForBudgetId ?? ''} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="line-name">{$t.common.name} <span class="text-destructive">*</span></Label>
					<Input id="line-name" name="name" required />
				</div>
				<div class="space-y-2">
					<Label for="line-amount"
						>{$t.finances.plannedAmount} <span class="text-destructive">*</span></Label
					>
					<Input id="line-amount" name="plannedAmount" type="number" step="0.01" required />
				</div>
				<div class="space-y-2">
					<Label for="line-category">{$t.finances.category}</Label>
					<select id="line-category" name="categoryId" class={selectClass}>
						<option value="">— None —</option>
						{#each data.categoryList as category}
							<option value={category.id}>{category.name}</option>
						{/each}
					</select>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (addLineForBudgetId = null)}
					>{$t.common.cancel}</Button
				>
				<Button type="submit">{$t.common.create}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={createCategoryOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header><Dialog.Title>{$t.finances.newCategory}</Dialog.Title></Dialog.Header>
		<form
			method="POST"
			action="?/createCategory"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') createCategoryOpen = false;
					await update();
				};
			}}
		>
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="cat-name">{$t.common.name} <span class="text-destructive">*</span></Label>
					<Input id="cat-name" name="name" required />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="cat-icon">{$t.finances.icon}</Label>
						<Input id="cat-icon" name="icon" placeholder="e.g. 🏠" />
					</div>
					<div class="space-y-2">
						<Label for="cat-color">{$t.finances.color}</Label>
						<Input id="cat-color" name="color" type="color" />
					</div>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createCategoryOpen = false)}>{$t.common.cancel}</Button>
				<Button type="submit">{$t.common.create}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editCategoryOpen} onOpenChange={(o) => { if (!o) categoryToEdit = null; }}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header><Dialog.Title>{$t.finances.editCategory}</Dialog.Title></Dialog.Header>
		<form
			method="POST"
			action="?/updateCategory"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						editCategoryOpen = false;
						categoryToEdit = null;
					}
					await update();
				};
			}}
		>
			<input type="hidden" name="id" value={categoryToEdit?.id ?? ''} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="edit-cat-name">{$t.common.name} <span class="text-destructive">*</span></Label>
					<Input id="edit-cat-name" name="name" required value={categoryToEdit?.name ?? ''} />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="edit-cat-icon">{$t.finances.icon}</Label>
						<Input id="edit-cat-icon" name="icon" placeholder="e.g. 🏠" value={categoryToEdit?.icon ?? ''} />
					</div>
					<div class="space-y-2">
						<Label for="edit-cat-color">{$t.finances.color}</Label>
						<Input id="edit-cat-color" name="color" type="color" value={categoryToEdit?.color ?? ''} />
					</div>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (editCategoryOpen = false)}>{$t.common.cancel}</Button>
				<Button type="submit">{$t.common.save}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	bind:open={editLineOpen}
	onOpenChange={(o) => {
		if (!o) lineToEdit = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header><Dialog.Title>{$t.finances.editLine}</Dialog.Title></Dialog.Header>
		<form
			method="POST"
			action="?/updateBudgetLine"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						editLineOpen = false;
						lineToEdit = null;
					}
					await update();
				};
			}}
		>
			<input type="hidden" name="id" value={lineToEdit?.id ?? ''} />
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<Label for="edit-line-name"
						>{$t.common.name} <span class="text-destructive">*</span></Label
					>
					<Input id="edit-line-name" name="name" required value={lineToEdit?.name ?? ''} />
				</div>
				<div class="space-y-2">
					<Label for="edit-line-amount"
						>{$t.finances.plannedAmount} <span class="text-destructive">*</span></Label
					>
					<Input
						id="edit-line-amount"
						name="plannedAmount"
						type="number"
						step="0.01"
						required
						value={lineToEdit?.plannedAmount ?? ''}
					/>
				</div>
				<div class="space-y-2">
					<Label for="edit-line-category">{$t.finances.category}</Label>
					<select id="edit-line-category" name="categoryId" class={selectClass}>
						<option value="">— None —</option>
						{#each data.categoryList as category}
							<option value={category.id} selected={lineToEdit?.categoryId === category.id}
								>{category.name}</option
							>
						{/each}
					</select>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (editLineOpen = false)}
					>{$t.common.cancel}</Button
				>
				<Button type="submit">{$t.common.save}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
	bind:open={deleteLineOpen}
	onOpenChange={(o) => {
		if (!o) lineToDelete = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{$t.common.delete} {$t.finances.lineItems}</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{lineToDelete?.name}</strong>? This action cannot be
				undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				onclick={() => {
					deleteLineOpen = false;
					lineToDelete = null;
				}}>{$t.common.cancel}</AlertDialog.Cancel
			>
			<form
				method="POST"
				action="?/deleteBudgetLine"
				use:enhance={() =>
					({ update }) =>
						update().then(() => {
							deleteLineOpen = false;
							lineToDelete = null;
						})}
			>
				<input type="hidden" name="id" value={lineToDelete?.id ?? ''} />
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
	bind:open={deleteExpenseDialogOpen}
	onOpenChange={(o) => {
		if (!o) expenseToDelete = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Expense</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{expenseToDelete?.description}</strong>? This action
				cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				onclick={() => {
					deleteExpenseDialogOpen = false;
					expenseToDelete = null;
				}}>{$t.common.cancel}</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/deleteExpense"
				use:enhance={() =>
					({ update }) =>
						update().then(() => {
							deleteExpenseDialogOpen = false;
							expenseToDelete = null;
						})}
			>
				<input type="hidden" name="id" value={expenseToDelete?.id ?? ''} />
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
	bind:open={deleteBudgetDialogOpen}
	onOpenChange={(o) => {
		if (!o) budgetToDelete = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Budget</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{budgetToDelete?.name}</strong>? This action cannot
				be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				onclick={() => {
					deleteBudgetDialogOpen = false;
					budgetToDelete = null;
				}}>{$t.common.cancel}</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/deleteBudget"
				use:enhance={() =>
					({ update }) =>
						update().then(() => {
							deleteBudgetDialogOpen = false;
							budgetToDelete = null;
						})}
			>
				<input type="hidden" name="id" value={budgetToDelete?.id ?? ''} />
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
	bind:open={deleteCategoryOpen}
	onOpenChange={(o) => {
		if (!o) categoryToDelete = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{$t.common.delete} {$t.finances.category}</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{categoryToDelete?.name}</strong>? This action cannot be
				undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				onclick={() => {
					deleteCategoryOpen = false;
					categoryToDelete = null;
				}}>{$t.common.cancel}</AlertDialog.Cancel
			>
			<form
				method="POST"
				action="?/deleteCategory"
				use:enhance={() =>
					({ update }) =>
						update().then(() => {
							deleteCategoryOpen = false;
							categoryToDelete = null;
						})}
			>
				<input type="hidden" name="id" value={categoryToDelete?.id ?? ''} />
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
