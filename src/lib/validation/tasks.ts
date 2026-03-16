import { z } from 'zod';

export const taskSchema = z.object({
	title: z.string().min(1, 'Title is required').max(200),
	description: z.string().max(2000).optional(),
	status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).default('todo'),
	priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
	assigneeId: z.string().optional(),
	projectId: z.string().optional(),
	phaseId: z.string().optional(),
	roomId: z.string().optional(),
	assetId: z.string().optional(),
	dueDate: z.string().optional(),
	startDate: z.string().optional(),
	estimatedMinutes: z.number().int().min(0).optional(),
	visibility: z.enum(['household', 'adults', 'private']).default('household')
});

export type TaskInput = z.infer<typeof taskSchema>;
