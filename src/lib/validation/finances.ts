import { z } from 'zod';

export const expenseSchema = z.object({
	description: z.string().min(1, 'Description is required').max(500),
	amount: z.number().positive('Amount must be positive'),
	currency: z.string().default('EUR'),
	date: z.string().min(1, 'Date is required'),
	projectId: z.string().optional(),
	budgetId: z.string().optional(),
	budgetLineId: z.string().optional(),
	categoryId: z.string().optional(),
	assetId: z.string().optional(),
	paymentMethod: z.enum(['cash', 'card', 'transfer', 'check', 'other']).optional(),
	vendor: z.string().max(200).optional(),
	invoiceNumber: z.string().max(100).optional(),
	isIncome: z.boolean().default(false),
	isRefund: z.boolean().default(false),
	notes: z.string().max(2000).optional(),
	visibility: z.enum(['household', 'adults', 'private']).default('adults')
});

export const budgetSchema = z.object({
	name: z.string().min(1, 'Name is required').max(200),
	description: z.string().max(1000).optional(),
	totalAmount: z.number().positive('Amount must be positive'),
	currency: z.string().default('EUR'),
	projectId: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	warningThresholdPercent: z.number().int().min(0).max(100).default(80),
	criticalThresholdPercent: z.number().int().min(0).max(200).default(100),
	visibility: z.enum(['household', 'adults', 'private']).default('adults')
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
