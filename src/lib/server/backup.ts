import archiver from 'archiver';
import {
	createReadStream,
	existsSync,
	readdirSync,
	statSync,
	unlinkSync
} from 'node:fs';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { config } from '$lib/server/config.js';
import { getRawDb } from '$lib/server/db/index.js';
import { createLogger } from '$lib/server/logger.js';

const log = createLogger('backup');
const backupRoot = resolve(config.backupDir);

export interface BackupInfo {
	filename: string;
	createdAt: string;
	sizeBytes: number;
}

function formatBackupTimestamp(date = new Date()): string {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');
	const hours = `${date.getHours()}`.padStart(2, '0');
	const minutes = `${date.getMinutes()}`.padStart(2, '0');
	const seconds = `${date.getSeconds()}`.padStart(2, '0');

	return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

async function ensureBackupDirectory(): Promise<void> {
	await mkdir(backupRoot, { recursive: true });
}

function parseZipEntries(buffer: Buffer): { entries: string[]; error?: string } {
	const EOCD_SIGNATURE = 0x06054b50;
	const CENTRAL_SIGNATURE = 0x02014b50;
	const minimumEocdSize = 22;

	if (buffer.length < minimumEocdSize) {
		return { entries: [], error: 'File is too small to be a valid zip archive' };
	}

	const maxCommentLength = 0xffff;
	const searchStart = Math.max(0, buffer.length - (minimumEocdSize + maxCommentLength));
	let eocdOffset = -1;

	for (let index = buffer.length - minimumEocdSize; index >= searchStart; index--) {
		if (buffer.readUInt32LE(index) === EOCD_SIGNATURE) {
			eocdOffset = index;
			break;
		}
	}

	if (eocdOffset === -1) {
		return { entries: [], error: 'Invalid zip: end-of-central-directory record not found' };
	}

	const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
	const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

	if (centralDirOffset >= buffer.length) {
		return { entries: [], error: 'Invalid zip: central directory offset out of bounds' };
	}

	const entries: string[] = [];
	let offset = centralDirOffset;

	for (let i = 0; i < totalEntries; i++) {
		if (offset + 46 > buffer.length) {
			return { entries: [], error: 'Invalid zip: truncated central directory header' };
		}

		if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
			return { entries: [], error: 'Invalid zip: malformed central directory entry' };
		}

		const fileNameLength = buffer.readUInt16LE(offset + 28);
		const extraLength = buffer.readUInt16LE(offset + 30);
		const commentLength = buffer.readUInt16LE(offset + 32);
		const nameStart = offset + 46;
		const nameEnd = nameStart + fileNameLength;

		if (nameEnd > buffer.length) {
			return { entries: [], error: 'Invalid zip: truncated filename entry' };
		}

		entries.push(buffer.toString('utf8', nameStart, nameEnd));
		offset = nameEnd + extraLength + commentLength;
	}

	return { entries };
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
	return new Promise((resolvePromise, rejectPromise) => {
		const chunks: Buffer[] = [];

		stream.on('data', (chunk: Buffer | string) => {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		});

		stream.on('end', () => {
			resolvePromise(Buffer.concat(chunks));
		});

		stream.on('error', (error) => {
			rejectPromise(error);
		});
	});
}

export async function createBackup(): Promise<{ stream: NodeJS.ReadableStream; filename: string }> {
	await ensureBackupDirectory();

	const timestamp = formatBackupTimestamp();
	const filename = `hrp-backup-${timestamp}.zip`;
	const sqlite = getRawDb();
	const tempDir = await mkdtemp(join(tmpdir(), 'hrp-backup-'));
	const tempDbPath = join(tempDir, basename(config.databasePath));
	const outputStream = new PassThrough();

	try {
		await sqlite.backup(tempDbPath);
	} catch (error) {
		await rm(tempDir, { recursive: true, force: true });
		throw error;
	}

	const archive = archiver('zip', { zlib: { level: 9 } });

	archive.on('warning', (warning) => {
		log.warn({ warning }, 'Backup archive warning');
	});

	archive.on('error', (error) => {
		log.error({ error }, 'Failed to create backup archive');
		outputStream.destroy(error);
	});

	outputStream.on('close', () => {
		void rm(tempDir, { recursive: true, force: true });
	});

	archive.pipe(outputStream);
	archive.file(tempDbPath, { name: 'hrp.db' });

	const uploadPath = resolve(config.uploadDir);
	if (existsSync(uploadPath)) {
		archive.directory(uploadPath, 'uploads');
	}

	void archive.finalize();

	log.info({ filename }, 'Created full backup stream');
	return { stream: outputStream, filename };
}

export async function createDbBackup(): Promise<BackupInfo> {
	await ensureBackupDirectory();

	const timestamp = formatBackupTimestamp();
	const filename = `hrp-db-${timestamp}.db`;
	const destinationPath = join(backupRoot, filename);
	const sqlite = getRawDb();

	await sqlite.backup(destinationPath);
	const fileStats = await stat(destinationPath);

	const backupInfo: BackupInfo = {
		filename,
		createdAt: fileStats.mtime.toISOString(),
		sizeBytes: fileStats.size
	};

	log.info({ filename, sizeBytes: backupInfo.sizeBytes }, 'Created database backup');
	return backupInfo;
}

export function listBackups(): BackupInfo[] {
	if (!existsSync(backupRoot)) {
		return [];
	}

	return readdirSync(backupRoot)
		.filter((fileName) => fileName.startsWith('hrp-db-') && fileName.endsWith('.db'))
		.map((fileName) => {
			const filePath = join(backupRoot, fileName);
			const fileStats = statSync(filePath);
			if (!fileStats.isFile()) {
				return null;
			}

			return {
				filename: fileName,
				createdAt: fileStats.mtime.toISOString(),
				sizeBytes: fileStats.size
			};
		})
		.filter((backup): backup is BackupInfo => backup !== null)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function cleanOldBackups(keep: number): number {
	const safeKeep = Math.max(keep, 0);
	const backups = listBackups();

	if (backups.length <= safeKeep) {
		return 0;
	}

	const toDelete = backups.slice(safeKeep);
	for (const backup of toDelete) {
		const filePath = join(backupRoot, backup.filename);
		unlinkSync(filePath);
	}

	log.info({ removed: toDelete.length, kept: safeKeep }, 'Cleaned old backups');
	return toDelete.length;
}

export async function validateBackup(
	zipPath: string
): Promise<{ valid: boolean; error?: string; hasUploads: boolean }> {
	try {
		const fileBuffer = await streamToBuffer(createReadStream(zipPath));
		const parsed = parseZipEntries(fileBuffer);

		if (parsed.error) {
			return { valid: false, error: parsed.error, hasUploads: false };
		}

		const hasDb = parsed.entries.some((entry) => entry === 'hrp.db' || entry.endsWith('.db'));
		const hasUploads = parsed.entries.some((entry) => entry.startsWith('uploads/'));

		if (!hasDb) {
			return {
				valid: false,
				error: 'Backup does not contain a database file',
				hasUploads
			};
		}

		return { valid: true, hasUploads };
	} catch (error) {
		log.error({ error, zipPath }, 'Failed to validate backup file');
		return {
			valid: false,
			error: 'Failed to read or parse backup file',
			hasUploads: false
		};
	}
}
