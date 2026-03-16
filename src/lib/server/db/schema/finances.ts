import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { id, createdAt, updatedAt, visibility } from './common';
import { households } from './household';
import { users } from './users';
import { projects } from './projects';
import { assets } from './assets';

/** Expense categories */
export const expenseCategories = sqliteTable(
	'expense_categories',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		icon: text('icon'),
		color: text('color'),
		parentId: text('parent_id'), // self-referential for sub-categories
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [index('expense_categories_household_idx').on(t.householdId)]
);

/** Budgets — can be per-project or standalone */
export const budgets = sqliteTable(
	'budgets',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
		name: text('name').notNull(),
		description: text('description'),
		totalAmount: real('total_amount').notNull(),
		currency: text('currency').notNull().default('EUR'),
		startDate: text('start_date'),
		endDate: text('end_date'),
		// Alert thresholds
		warningThresholdPercent: integer('warning_threshold_percent').default(80),
		criticalThresholdPercent: integer('critical_threshold_percent').default(100),
		visibility: visibility(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('budgets_household_idx').on(t.householdId),
		index('budgets_project_idx').on(t.projectId)
	]
);

/** Budget line items — breakdown of a budget */
export const budgetLines = sqliteTable(
	'budget_lines',
	{
		id: id(),
		budgetId: text('budget_id')
			.notNull()
			.references(() => budgets.id, { onDelete: 'cascade' }),
		categoryId: text('category_id').references(() => expenseCategories.id, { onDelete: 'set null' }),
		name: text('name').notNull(),
		plannedAmount: real('planned_amount').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [index('budget_lines_budget_idx').on(t.budgetId)]
);

/** Expenses — individual transactions */
export const expenses = sqliteTable(
	'expenses',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		// Links
		projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
		budgetId: text('budget_id').references(() => budgets.id, { onDelete: 'set null' }),
		budgetLineId: text('budget_line_id').references(() => budgetLines.id, { onDelete: 'set null' }),
		categoryId: text('category_id').references(() => expenseCategories.id, { onDelete: 'set null' }),
		assetId: text('asset_id').references(() => assets.id, { onDelete: 'set null' }),
		// Content
		description: text('description').notNull(),
		amount: real('amount').notNull(),
		currency: text('currency').notNull().default('EUR'),
		date: text('date').notNull(), // ISO date
		// Payment
		paymentMethod: text('payment_method').$type<'cash' | 'card' | 'transfer' | 'check' | 'other'>(),
		vendor: text('vendor'),
		invoiceNumber: text('invoice_number'),
		// Type
		isIncome: integer('is_income', { mode: 'boolean' }).notNull().default(false),
		isRefund: integer('is_refund', { mode: 'boolean' }).notNull().default(false),
		// Metadata
		notes: text('notes'),
		visibility: visibility(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('expenses_household_idx').on(t.householdId),
		index('expenses_project_idx').on(t.projectId),
		index('expenses_budget_idx').on(t.budgetId),
		index('expenses_category_idx').on(t.categoryId),
		index('expenses_date_idx').on(t.date)
	]
);

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type BudgetLine = typeof budgetLines.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
