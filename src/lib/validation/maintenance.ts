import { z } from 'zod';

export const maintenanceScheduleSchema = z.object({
	name: z.string().min(1, 'Name is required').max(200),
	description: z.string().max(1000).optional(),
	assetId: z.string().optional(),
	roomId: z.string().optional(),
	frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'biannual', 'yearly', 'custom']).default('yearly'),
	customIntervalDays: z.number().int().min(1).optional(),
	nextDueDate: z.string().min(1, 'Next due date is required'),
	reminderDaysBefore: z.number().int().min(0).default(7),
	estimatedCost: z.number().min(0).optional(),
	assigneeId: z.string().optional(),
	visibility: z.enum(['household', 'adults', 'private']).default('household')
});

export const maintenanceLogSchema = z.object({
	scheduleId: z.string().min(1),
	completedDate: z.string().min(1, 'Completed date is required'),
	notes: z.string().max(2000).optional(),
	cost: z.number().min(0).optional(),
	durationMinutes: z.number().int().min(0).optional()
});

export type MaintenanceScheduleInput = z.infer<typeof maintenanceScheduleSchema>;
export type MaintenanceLogInput = z.infer<typeof maintenanceLogSchema>;
