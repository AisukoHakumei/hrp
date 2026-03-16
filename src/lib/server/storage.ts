import { randomBytes } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { mkdir, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { config } from '$lib/server/config.js';
import { createLogger } from '$lib/server/logger.js';

const log = createLogger('storage');

const STORAGE_ENTITY_TYPES = ['documents', 'floor-plans', 'avatars'] as const;
type StorageEntityType = (typeof STORAGE_ENTITY_TYPES)[number];

const SAFE_FILENAME_REGEX = /[^a-zA-Z0-9._-]/g;
const uploadRoot = resolve(config.uploadDir);

export interface StorageResult {
	storagePath: string;
	fileName: string;
	mimeType: string;
	fileSize: number;
}

function sanitizeSegment(value: string): string {
	return value.replace(SAFE_FILENAME_REGEX, '_');
}

function toPortablePath(relativePath: string): string {
	return relativePath.split(sep).join('/');
}

function normalizeStoragePath(storagePath: string): string {
	return storagePath.replaceAll('\\', '/');
}

function resolveStoragePath(storagePath: string): string {
	const normalized = normalizeStoragePath(storagePath);
	const absolutePath = resolve(uploadRoot, normalized);

	if (absolutePath !== uploadRoot && !absolutePath.startsWith(`${uploadRoot}${sep}`)) {
		throw new Error('Invalid storage path');
	}

	return absolutePath;
}

function buildStoragePath(
	entityType: StorageEntityType,
	entityId: string,
	fileName: string,
	subId?: string
): string {
	const safeEntityId = sanitizeSegment(entityId);
	const safeFileName = sanitizeSegment(fileName);

	if (entityType === 'documents') {
		const versionPrefix = sanitizeSegment(subId ?? randomBytes(6).toString('hex'));
		return join('documents', safeEntityId, `${versionPrefix}_${safeFileName}`);
	}

	if (entityType === 'floor-plans') {
		return join('floor-plans', `${safeEntityId}_${safeFileName}`);
	}

	return join('avatars', `${safeEntityId}_${safeFileName}`);
}

export async function storeFile(
	entityType: 'documents' | 'floor-plans' | 'avatars',
	entityId: string,
	file: File,
	subId?: string
): Promise<StorageResult> {
	const relativePath = buildStoragePath(entityType, entityId, file.name, subId);
	const absolutePath = resolveStoragePath(relativePath);
	const directoryPath = dirname(absolutePath);

	await mkdir(directoryPath, { recursive: true });
	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(absolutePath, buffer);

	const storedPath = toPortablePath(relativePath);
	log.info(
		{
			entityType,
			entityId,
			storagePath: storedPath,
			fileSize: file.size,
			mimeType: file.type
		},
		'Stored file'
	);

	return {
		storagePath: storedPath,
		fileName: sanitizeSegment(file.name),
		mimeType: file.type,
		fileSize: file.size
	};
}

export function getFilePath(storagePath: string): string {
	return resolveStoragePath(storagePath);
}

export async function deleteFile(storagePath: string): Promise<void> {
	const absolutePath = resolveStoragePath(storagePath);

	try {
		await unlink(absolutePath);
		log.info({ storagePath }, 'Deleted stored file');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return;
		}

		throw error;
	}
}

export async function deleteEntityFiles(
	entityType: 'documents' | 'floor-plans' | 'avatars',
	entityId: string
): Promise<void> {
	const safeEntityId = sanitizeSegment(entityId);

	if (entityType === 'documents') {
		const targetDir = resolveStoragePath(join('documents', safeEntityId));
		await rm(targetDir, { recursive: true, force: true });
		log.info({ entityType, entityId }, 'Deleted document files');
		return;
	}

	const entityDir = resolveStoragePath(entityType);
	if (!existsSync(entityDir)) {
		return;
	}

	const files = await readdir(entityDir);
	const prefix = `${safeEntityId}_`;

	await Promise.all(
		files
			.filter((fileName) => fileName.startsWith(prefix))
			.map(async (fileName) => {
				await unlink(join(entityDir, fileName));
			})
	);

	log.info({ entityType, entityId }, 'Deleted entity files');
}

export function getFileInfo(storagePath: string): { size: number; exists: boolean } {
	const absolutePath = resolveStoragePath(storagePath);

	if (!existsSync(absolutePath)) {
		return { size: 0, exists: false };
	}

	const stats = statSync(absolutePath);
	return {
		size: stats.size,
		exists: true
	};
}

export function validateUpload(
	file: File,
	options?: {
		maxSizeMb?: number;
		allowedMimeTypes?: string[];
	}
): { valid: boolean; error?: string } {
	const maxSizeMb = options?.maxSizeMb ?? config.maxUploadMb;
	const maxSizeBytes = maxSizeMb * 1024 * 1024;

	if (file.size > maxSizeBytes) {
		return {
			valid: false,
			error: `File too large. Maximum size is ${maxSizeMb}MB.`
		};
	}

	if (options?.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
		if (!options.allowedMimeTypes.includes(file.type)) {
			return {
				valid: false,
				error: 'File type is not allowed.'
			};
		}
	}

	return { valid: true };
}
