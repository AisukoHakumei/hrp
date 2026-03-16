import { z } from 'zod';

export const roomSchema = z.object({
	name: z.string().min(1, 'Name is required').max(200),
	description: z.string().max(1000).optional(),
	type: z.enum(['room', 'hallway', 'bathroom', 'kitchen', 'garage', 'garden', 'attic', 'basement', 'balcony', 'storage', 'other']).default('room'),
	floorPlanId: z.string().optional(),
	parentId: z.string().optional(),
	area: z.number().min(0).optional(),
	color: z.string().max(7).optional(),
	icon: z.string().max(50).optional(),
	visibility: z.enum(['household', 'adults', 'private']).default('household')
});

export type RoomInput = z.infer<typeof roomSchema>;
