import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { id, createdAt, updatedAt, visibility } from './common';
import { households } from './household';
import { users } from './users';

/** Knowledge articles — notes, procedures, how-tos */
export const knowledgeArticles = sqliteTable(
	'knowledge_articles',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		content: text('content').notNull(), // Markdown
		excerpt: text('excerpt'),
		category: text('category')
			.$type<'note' | 'procedure' | 'howto' | 'reference' | 'troubleshooting' | 'other'>()
			.notNull()
			.default('note'),
		isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
		visibility: visibility(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('knowledge_articles_household_idx').on(t.householdId),
		index('knowledge_articles_category_idx').on(t.category)
	]
);

/**
 * Polymorphic links from knowledge articles to other entities.
 * An article about "How to maintain the boiler" links to the boiler asset,
 * the heating room, and the installation project.
 */
export const knowledgeLinks = sqliteTable(
	'knowledge_links',
	{
		id: id(),
		articleId: text('article_id')
			.notNull()
			.references(() => knowledgeArticles.id, { onDelete: 'cascade' }),
		targetType: text('target_type')
			.$type<'project' | 'asset' | 'room' | 'document' | 'task'>()
			.notNull(),
		targetId: text('target_id').notNull()
	},
	(t) => [
		index('knowledge_links_article_idx').on(t.articleId),
		index('knowledge_links_target_idx').on(t.targetType, t.targetId)
	]
);

export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;
export type NewKnowledgeArticle = typeof knowledgeArticles.$inferInsert;
