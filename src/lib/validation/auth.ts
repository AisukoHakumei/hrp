import { z } from 'zod';

export const loginSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string().min(1, 'Password is required')
});

export const setupSchema = z.object({
	householdName: z.string().min(1, 'Household name is required').max(100),
	name: z.string().min(1, 'Name is required').max(100),
	email: z.string().email('Invalid email address'),
	password: z.string().min(8, 'Password must be at least 8 characters'),
	confirmPassword: z.string(),
	currency: z.string().default('EUR'),
	timezone: z.string().default('Europe/Paris'),
	locale: z.enum(['en', 'fr']).default('en')
}).refine((data) => data.password === data.confirmPassword, {
	message: 'Passwords do not match',
	path: ['confirmPassword']
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SetupInput = z.infer<typeof setupSchema>;
