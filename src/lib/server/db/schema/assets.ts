import { sqliteTable, text, integer, real, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { id, createdAt, updatedAt, visibility } from './common';
import { households } from './household';
import { users } from './users';
import { rooms } from './rooms';
import { projects } from './projects';

export type AssetStatus = 'active' | 'stored' | 'broken' | 'maintenance' | 'disposed' | 'sold';
export type AssetCategory =
	| 'appliance'
	| 'furniture'
	| 'tool'
	| 'vehicle'
	| 'electronics'
	| 'building_component'
	| 'subscription'
	| 'contract'
	| 'other';

export const assets = sqliteTable(
	'assets',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		roomId: text('room_id').references(() => rooms.id, { onDelete: 'set null' }),
		name: text('name').notNull(),
		description: text('description'),
		category: text('category').$type<AssetCategory>().notNull().default('other'),
		status: text('status').$type<AssetStatus>().notNull().default('active'),
		// Identification
		manufacturer: text('manufacturer'),
		model: text('model'),
		serialNumber: text('serial_number'),
		barcode: text('barcode'),
		// Purchase info
		purchaseDate: text('purchase_date'),
		purchasePrice: real('purchase_price'),
		purchaseCurrency: text('purchase_currency').default('EUR'),
		purchaseFrom: text('purchase_from'),
		// Warranty
		warrantyExpiresAt: text('warranty_expires_at'),
		warrantyNotes: text('warranty_notes'),
		lifetimeWarranty: integer('lifetime_warranty', { mode: 'boolean' }).notNull().default(false),
		// Value tracking
		currentValue: real('current_value'),
		// Subscription/contract specific
		recurringCost: real('recurring_cost'),
		recurringPeriod: text('recurring_period').$type<'monthly' | 'quarterly' | 'yearly'>(),
		contractStartDate: text('contract_start_date'),
		contractEndDate: text('contract_end_date'),
		// Metadata
		notes: text('notes'),
		icon: text('icon'),
		imageUrl: text('image_url'),
		visibility: visibility(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('assets_household_idx').on(t.householdId),
		index('assets_room_idx').on(t.roomId),
		index('assets_category_idx').on(t.category),
		index('assets_status_idx').on(t.status)
	]
);

/** Junction: project ↔ asset */
export const projectAssets = sqliteTable(
	'project_assets',
	{
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		assetId: text('asset_id')
			.notNull()
			.references(() => assets.id, { onDelete: 'cascade' }),
		relationship: text('relationship')
			.$type<'affected' | 'installed' | 'replaced' | 'repaired'>()
			.notNull()
			.default('affected')
	},
	(t) => [primaryKey({ columns: [t.projectId, t.assetId] })]
);

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
