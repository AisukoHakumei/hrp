import { sqliteTable, text, integer, index, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { id, createdAt } from './common';
import { households } from './household';

export type TaggableEntity = 'project' | 'task' | 'asset' | 'room' | 'document' | 'knowledge' | 'expense' | 'maintenance';

/** Tags — shared across all entity types */
export const tags = sqliteTable(
	'tags',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		color: text('color'), // hex color
		icon: text('icon'),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('tags_household_name_unique').on(t.householdId, t.name),
		index('tags_household_idx').on(t.householdId)
	]
);

/** Polymorphic entity-tag junction */
export const entityTags = sqliteTable(
	'entity_tags',
	{
		tagId: text('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' }),
		entityType: text('entity_type').$type<TaggableEntity>().notNull(),
		entityId: text('entity_id').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.tagId, t.entityType, t.entityId] }),
		index('entity_tags_entity_idx').on(t.entityType, t.entityId),
		index('entity_tags_tag_idx').on(t.tagId)
	]
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
