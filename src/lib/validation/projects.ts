import { z } from 'zod';

export const projectSchema = z.object({
	name: z.string().min(1, 'Name is required').max(200),
	description: z.string().max(2000).optional(),
	type: z.enum(['renovation', 'repair', 'installation', 'decoration', 'landscaping', 'construction', 'administrative', 'other']).default('other'),
	status: z.enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']).default('planning'),
	priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	budgetAmount: z.number().min(0).optional(),
	budgetCurrency: z.string().default('EUR'),
	notes: z.string().max(5000).optional(),
	visibility: z.enum(['household', 'adults', 'private']).default('household'),
	roomIds: z.array(z.string()).default([]),
	assetIds: z.array(z.string()).default([])
});

export const projectPhaseSchema = z.object({
	name: z.string().min(1, 'Name is required').max(200),
	description: z.string().max(1000).optional(),
	status: z.enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']).default('planning'),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	sortOrder: z.number().int().min(0).default(0)
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectPhaseInput = z.infer<typeof projectPhaseSchema>;
