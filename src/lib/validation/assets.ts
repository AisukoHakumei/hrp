import { z } from 'zod';

export const assetSchema = z.object({
	name: z.string().min(1, 'Name is required').max(200),
	description: z.string().max(2000).optional(),
	category: z.enum(['appliance', 'furniture', 'tool', 'vehicle', 'electronics', 'building_component', 'subscription', 'contract', 'other']).default('other'),
	status: z.enum(['active', 'stored', 'broken', 'maintenance', 'disposed', 'sold']).default('active'),
	roomId: z.string().optional(),
	manufacturer: z.string().max(200).optional(),
	model: z.string().max(200).optional(),
	serialNumber: z.string().max(100).optional(),
	barcode: z.string().max(100).optional(),
	purchaseDate: z.string().optional(),
	purchasePrice: z.number().min(0).optional(),
	purchaseCurrency: z.string().default('EUR'),
	purchaseFrom: z.string().max(200).optional(),
	warrantyExpiresAt: z.string().optional(),
	warrantyNotes: z.string().max(1000).optional(),
	lifetimeWarranty: z.boolean().default(false),
	currentValue: z.number().min(0).optional(),
	recurringCost: z.number().min(0).optional(),
	recurringPeriod: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
	contractStartDate: z.string().optional(),
	contractEndDate: z.string().optional(),
	notes: z.string().max(5000).optional(),
	visibility: z.enum(['household', 'adults', 'private']).default('household')
});

export type AssetInput = z.infer<typeof assetSchema>;
