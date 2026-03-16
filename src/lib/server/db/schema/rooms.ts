import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { id, createdAt, updatedAt, visibility } from './common';
import { households } from './household';
import { users } from './users';

/** Floor plans — background images for spatial mapping */
export const floorPlans = sqliteTable(
	'floor_plans',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		imagePath: text('image_path').notNull(),
		imageWidth: integer('image_width'),
		imageHeight: integer('image_height'),
		floor: integer('floor').notNull().default(0), // 0 = ground, -1 = basement, 1 = first floor
		sortOrder: integer('sort_order').notNull().default(0),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('floor_plans_household_idx').on(t.householdId)]
);

/** Rooms / locations — linked to floor plans, self-referential for sub-locations */
export const rooms = sqliteTable(
	'rooms',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		floorPlanId: text('floor_plan_id').references(() => floorPlans.id, { onDelete: 'set null' }),
		parentId: text('parent_id'), // self-referential: sub-locations
		name: text('name').notNull(),
		description: text('description'),
		type: text('type')
			.$type<
				| 'room'
				| 'hallway'
				| 'bathroom'
				| 'kitchen'
				| 'garage'
				| 'garden'
				| 'attic'
				| 'basement'
				| 'balcony'
				| 'storage'
				| 'other'
			>()
			.notNull()
			.default('room'),
		area: real('area'), // square meters
		// Position on floor plan (for spatial mapping)
		posX: real('pos_x'),
		posY: real('pos_y'),
		posWidth: real('pos_width'),
		posHeight: real('pos_height'),
		color: text('color'), // hex color for floor plan display
		icon: text('icon'), // lucide icon name
		visibility: visibility(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('rooms_household_idx').on(t.householdId),
		index('rooms_floor_plan_idx').on(t.floorPlanId),
		index('rooms_parent_idx').on(t.parentId)
	]
);

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type FloorPlan = typeof floorPlans.$inferSelect;
