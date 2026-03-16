import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { id, createdAt, updatedAt, visibility } from './common';
import { households } from './household';
import { users } from './users';
import { projects } from './projects';
import { assets } from './assets';
import { rooms } from './rooms';

export type DocumentType =
	| 'invoice'
	| 'contract'
	| 'warranty'
	| 'manual'
	| 'receipt'
	| 'photo'
	| 'plan'
	| 'certificate'
	| 'report'
	| 'other';

/** Documents — metadata in DB, files on disk */
export const documents = sqliteTable(
	'documents',
	{
		id: id(),
		householdId: text('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description'),
		type: text('type').$type<DocumentType>().notNull().default('other'),
		// Current version info (denormalized for quick access)
		currentVersionId: text('current_version_id'),
		fileName: text('file_name').notNull(),
		mimeType: text('mime_type').notNull().default('application/octet-stream'),
		fileSize: integer('file_size').notNull().default(0),
		storagePath: text('storage_path').notNull(),
		// Metadata for search
		notes: text('notes'),
		visibility: visibility(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('documents_household_idx').on(t.householdId),
		index('documents_type_idx').on(t.type),
		index('documents_created_by_idx').on(t.createdBy)
	]
);

/** Document versions — history of file changes */
export const documentVersions = sqliteTable(
	'document_versions',
	{
		id: id(),
		documentId: text('document_id')
			.notNull()
			.references(() => documents.id, { onDelete: 'cascade' }),
		versionNumber: integer('version_number').notNull(),
		fileName: text('file_name').notNull(),
		mimeType: text('mime_type').notNull(),
		fileSize: integer('file_size').notNull(),
		storagePath: text('storage_path').notNull(),
		changelog: text('changelog'),
		uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt()
	},
	(t) => [index('document_versions_document_idx').on(t.documentId)]
);

/** Junction: project ↔ document */
export const projectDocuments = sqliteTable(
	'project_documents',
	{
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		documentId: text('document_id')
			.notNull()
			.references(() => documents.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.projectId, t.documentId] })]
);

/** Junction: asset ↔ document */
export const assetDocuments = sqliteTable(
	'asset_documents',
	{
		assetId: text('asset_id')
			.notNull()
			.references(() => assets.id, { onDelete: 'cascade' }),
		documentId: text('document_id')
			.notNull()
			.references(() => documents.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.assetId, t.documentId] })]
);

/** Junction: room ↔ document */
export const roomDocuments = sqliteTable(
	'room_documents',
	{
		roomId: text('room_id')
			.notNull()
			.references(() => rooms.id, { onDelete: 'cascade' }),
		documentId: text('document_id')
			.notNull()
			.references(() => documents.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.roomId, t.documentId] })]
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentVersion = typeof documentVersions.$inferSelect;
