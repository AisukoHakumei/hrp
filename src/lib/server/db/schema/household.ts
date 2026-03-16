import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { id, createdAt, updatedAt } from './common';

export const households = sqliteTable('households', {
	id: id(),
	name: text('name').notNull(),
	currency: text('currency').notNull().default('EUR'),
	timezone: text('timezone').notNull().default('Europe/Paris'),
	locale: text('locale').notNull().default('en'),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;
