/**
 * PublicSpark Sovereign Newsroom Backup Engine
 * Zero-Dependency Pure Node.js PKZIP Archiver, Storage Manager & Cloud Dispatcher
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { sendNewsroomEmail } from './emailSenderService.js';

const deflateRawAsync = promisify(zlib.deflateRaw);

/**
 * Escapes special HTML characters to prevent HTML/XSS injection in email clients.
 * Protects against double-escaping by checking existing entity tokens.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&(?!amp;|lt;|gt;|quot;|#39;|#x[0-9a-fA-F]+;|#[0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const BACKUPS_DIR = path.resolve(DATA_DIR, 'backups');
const SETTINGS_FILE = path.resolve(DATA_DIR, 'settings.json');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export const MAX_LOCAL_BACKUPS = 3;

// -------------------------------------------------------------
// CRC32 & PURE NODE.JS PKZIP 2.0 ARCHIVER ENGINE
// -------------------------------------------------------------

const CRC_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c;
}

export function calculateCrc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

/**
 * Creates a valid PKZIP 2.0 archive buffer in pure Node.js without third-party dependencies.
 * Compatible with Windows Explorer, Mac Archive Utility, Linux unzip, 7-Zip, WinRAR, Python zipfile.
 * @param {Array<{ name: string, data: Buffer | string, mtime?: Date }>} files
 * @returns {Buffer}
 */
export function createZipArchive(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const rawData = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
    const nameClean = file.name.replace(/\\/g, '/').replace(/^\/+/, '');
    const nameBuf = Buffer.from(nameClean, 'utf8');

    // Deflate compression
    const compressed = zlib.deflateRawSync(rawData, { level: 6 });
    const crc = calculateCrc32(rawData);

    const mtime = file.mtime || new Date();
    const dosTime = ((mtime.getHours() << 11) | (mtime.getMinutes() << 5) | (mtime.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((mtime.getFullYear() - 1980) << 9) | ((mtime.getMonth() + 1) << 5) | mtime.getDate()) & 0xFFFF;

    // Local file header (30 bytes + nameBuf.length)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed (2.0)
    localHeader.writeUInt16LE(0, 6); // general purpose bit flag
    localHeader.writeUInt16LE(8, 8); // compression method (8 = Deflate)
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localHeaders.push(localHeader, nameBuf, compressed);

    // Central directory header (46 bytes + nameBuf.length)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central dir signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(8, 10); // compression method (8 = Deflate)
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field len
    centralHeader.writeUInt16LE(0, 32); // comment len
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(0, 38); // external file attributes
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header

    centralHeaders.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const h of centralHeaders) centralDirSize += h.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // number of this disk
  eocd.writeUInt16LE(0, 6); // disk where central directory starts
  eocd.writeUInt16LE(files.length, 8); // number of central directory records on this disk
  eocd.writeUInt16LE(files.length, 10); // total number of central directory records
  eocd.writeUInt32LE(centralDirSize, 12); // size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of start of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Creates a valid PKZIP 2.0 archive asynchronously using non-blocking libuv thread pool.
 * Does NOT block the Node.js event loop during heavy compression.
 * @param {Array<{ name: string, data: Buffer | string, mtime?: Date }>} files
 * @returns {Promise<Buffer>}
 */
export async function createZipArchiveAsync(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const rawData = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
    const nameClean = file.name.replace(/\\/g, '/').replace(/^\/+/, '');
    const nameBuf = Buffer.from(nameClean, 'utf8');

    // Asynchronous Deflate compression on background thread pool
    const compressed = await deflateRawAsync(rawData, { level: 6 });
    const crc = calculateCrc32(rawData);

    const mtime = file.mtime || new Date();
    const dosTime = ((mtime.getHours() << 11) | (mtime.getMinutes() << 5) | (mtime.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((mtime.getFullYear() - 1980) << 9) | ((mtime.getMonth() + 1) << 5) | mtime.getDate()) & 0xFFFF;

    // Local file header (30 bytes + nameBuf.length)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed (2.0)
    localHeader.writeUInt16LE(0, 6); // general purpose bit flag
    localHeader.writeUInt16LE(8, 8); // compression method (8 = Deflate)
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localHeaders.push(localHeader, nameBuf, compressed);

    // Central directory header (46 bytes + nameBuf.length)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central dir signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(8, 10); // compression method (8 = Deflate)
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field len
    centralHeader.writeUInt16LE(0, 32); // comment len
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(0, 38); // external file attributes
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header

    centralHeaders.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const h of centralHeaders) centralDirSize += h.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // number of this disk
  eocd.writeUInt16LE(0, 6); // disk where central directory starts
  eocd.writeUInt16LE(files.length, 8); // number of central directory records on this disk
  eocd.writeUInt16LE(files.length, 10); // total number of central directory records
  eocd.writeUInt32LE(centralDirSize, 12); // size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of start of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Extracts a PKZIP archive in pure Node.js with Anti-Zip-Slip directory traversal protection.
 * @param {Buffer} zipBuffer
 * @param {string} targetDir
 * @param {Object} [options]
 * @param {boolean} [options.stripDataPrefix=true] When true, files prefixed with 'data/' are extracted directly into targetDir (e.g. data/articles.json -> articles.json)
 * @returns {Array<string>} List of extracted relative file paths
 */
export function extractZipArchive(zipBuffer, targetDir, options = {}) {
  const { stripDataPrefix = true } = options;
  const normalizedTarget = path.resolve(targetDir);
  const extractedFiles = [];

  // Find End of Central Directory (EOCD) from the end
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= 0; i--) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid archive: End of Central Directory record not found');
  }

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  let currentOffset = centralDirOffset;
  for (let e = 0; e < totalEntries; e++) {
    if (zipBuffer.readUInt32LE(currentOffset) !== 0x02014b50) {
      throw new Error(`Corrupted central directory entry at offset ${currentOffset}`);
    }

    const compressionMethod = zipBuffer.readUInt16LE(currentOffset + 10);
    const uncompressedSize = zipBuffer.readUInt32LE(currentOffset + 24);
    const fileNameLen = zipBuffer.readUInt16LE(currentOffset + 28);
    const extraLen = zipBuffer.readUInt16LE(currentOffset + 30);
    const commentLen = zipBuffer.readUInt16LE(currentOffset + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(currentOffset + 42);

    const rawFileName = zipBuffer.toString('utf8', currentOffset + 46, currentOffset + 46 + fileNameLen);
    currentOffset += 46 + fileNameLen + extraLen + commentLen;

    let fileName = rawFileName;
    if (stripDataPrefix && fileName.startsWith('data/')) {
      fileName = fileName.slice(5);
    }

    if (!fileName || fileName === '') {
      continue;
    }

    // Zip Slip Protection: Guarantee extracted file resolves inside target directory
    const safeDestination = path.resolve(normalizedTarget, fileName);
    if (!safeDestination.startsWith(normalizedTarget + path.sep) && safeDestination !== normalizedTarget) {
      throw new Error(`Security Violation: Illegal path traversal detected in zip archive (${rawFileName})`);
    }

    // Skip directories
    if (fileName.endsWith('/')) {
      if (!fs.existsSync(safeDestination)) {
        fs.mkdirSync(safeDestination, { recursive: true });
      }
      continue;
    }

    // Read local header to get compressed data
    if (zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid local header for ${rawFileName}`);
    }
    const localNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;

    let fileContent;
    if (compressionMethod === 0) {
      // Uncompressed Store
      fileContent = zipBuffer.slice(dataStart, dataStart + uncompressedSize);
    } else if (compressionMethod === 8) {
      // Deflate
      const compressedSize = zipBuffer.readUInt32LE(localHeaderOffset + 18);
      const compressedChunk = zipBuffer.slice(dataStart, dataStart + compressedSize);
      fileContent = zlib.inflateRawSync(compressedChunk);
    } else {
      throw new Error(`Unsupported compression method ${compressionMethod} for ${rawFileName}`);
    }

    const destDir = path.dirname(safeDestination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.writeFileSync(safeDestination, fileContent);
    extractedFiles.push(fileName);
  }

  return extractedFiles;
}

// -------------------------------------------------------------
// NEWSROOM BACKUP GENERATION & STORAGE MANAGEMENT
// -------------------------------------------------------------

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Enforces rolling retention limit by keeping at most maxBackups files.
 */
function pruneOldBackups(maxBackups = MAX_LOCAL_BACKUPS) {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('publicspark-backup-') && f.endsWith('.zip'))
      .map(f => {
        const fullPath = path.join(BACKUPS_DIR, f);
        const stats = fs.statSync(fullPath);
        return { name: f, path: fullPath, mtime: stats.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    const deleted = [];
    if (files.length > maxBackups) {
      const toDelete = files.slice(maxBackups);
      for (const item of toDelete) {
        fs.unlinkSync(item.path);
        deleted.push(item.name);
        console.log(`[Backup Prune] Auto-deleted old backup to preserve disk: ${item.name}`);
      }
    }
    return deleted;
  } catch (err) {
    console.error('[Backup Prune Error]:', err.message);
    return [];
  }
}

function collectFilesForBackup(creatorName) {
  const filesToZip = [];
  let jsonCount = 0;
  let mediaCount = 0;

  // 1. Collect all root JSON files from server/data/
  if (fs.existsSync(DATA_DIR)) {
    const dataEntries = fs.readdirSync(DATA_DIR);
    for (const entry of dataEntries) {
      const fullPath = path.join(DATA_DIR, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && entry.endsWith('.json')) {
          let content = fs.readFileSync(fullPath);
          // SEC-021: Redact 2FA secrets and recovery codes from staff backup archives
          if (entry === 'newsroom_staff.json') {
            try {
              const staff = JSON.parse(content.toString('utf-8'));
              if (Array.isArray(staff)) {
                const sanitizedStaff = staff.map(s => {
                  const copy = { ...s };
                  if (copy.twoFactorSecret) copy.twoFactorSecret = '[REDACTED_FOR_SECURITY]';
                  if (Array.isArray(copy.twoFactorRecoveryCodes)) {
                    copy.twoFactorRecoveryCodes = copy.twoFactorRecoveryCodes.map(() => '[REDACTED_RECOVERY_CODE]');
                  }
                  return copy;
                });
                content = Buffer.from(JSON.stringify(sanitizedStaff, null, 2), 'utf-8');
              }
            } catch (redactErr) {
              console.warn('[Backup Collector] Could not redact newsroom_staff:', redactErr.message);
            }
          }
          filesToZip.push({
            name: `data/${entry}`,
            data: content,
            mtime: stat.mtime
          });
          jsonCount++;
        }
      } catch (err) {
        console.warn(`[Backup Collector] Skipping locked or unreadable file ${entry}:`, err.message);
      }
    }
  }

  // 2. Collect uploaded media files from server/data/uploads/
  if (fs.existsSync(UPLOADS_DIR)) {
    const uploadEntries = fs.readdirSync(UPLOADS_DIR);
    for (const entry of uploadEntries) {
      const fullPath = path.join(UPLOADS_DIR, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          const content = fs.readFileSync(fullPath);
          filesToZip.push({
            name: `uploads/${entry}`,
            data: content,
            mtime: stat.mtime
          });
          mediaCount++;
        }
      } catch (err) {
        console.warn(`[Backup Collector] Skipping upload file ${entry}:`, err.message);
      }
    }
  }

  // 3. Add manifest file
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHmmss
  const randHex = crypto.randomBytes(2).toString('hex');
  const prettyDate = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const manifest = {
    platform: 'PublicSpark Newsroom Engine',
    version: '1.0.0-verified',
    createdAt: now.toISOString(),
    createdAtPretty: prettyDate,
    createdBy: creatorName,
    summary: {
      jsonDatabaseFiles: jsonCount,
      mediaAssetFiles: mediaCount,
      totalFiles: filesToZip.length
    },
    files: filesToZip.map(f => f.name)
  };

  filesToZip.unshift({
    name: 'manifest.json',
    data: JSON.stringify(manifest, null, 2),
    mtime: now
  });

  const fileName = `publicspark-backup-${timestampStr}-${randHex}.zip`;
  return { filesToZip, jsonCount, mediaCount, now, timestampStr, randHex, prettyDate, fileName };
}

/**
 * Generates a full newsroom archive zip synchronously (backward compatible).
 * @param {Object} options
 * @param {string} [options.creatorName='Newsroom Admin']
 * @param {number} [options.maxRetained=MAX_LOCAL_BACKUPS]
 * @returns {Object} Metadata of generated backup
 */
export function generateNewsroomBackupZip(options = {}) {
  const { creatorName = 'Newsroom Admin', maxRetained = MAX_LOCAL_BACKUPS } = options;
  const { filesToZip, jsonCount, mediaCount, now, prettyDate, fileName } = collectFilesForBackup(creatorName);

  const zipBuffer = createZipArchive(filesToZip);
  const filePath = path.join(BACKUPS_DIR, fileName);
  fs.writeFileSync(filePath, zipBuffer);

  const prunedFiles = pruneOldBackups(maxRetained);

  const metadata = {
    fileName,
    filePath,
    sizeBytes: zipBuffer.length,
    sizeFormatted: formatBytes(zipBuffer.length),
    totalFiles: filesToZip.length,
    jsonCount,
    mediaCount,
    createdAt: now.toISOString(),
    createdAtPretty: prettyDate,
    prunedFiles
  };

  recordBackupRun(metadata);

  return {
    success: true,
    backup: metadata,
    buffer: zipBuffer
  };
}

/**
 * Generates a full newsroom archive zip asynchronously (non-blocking).
 * Recommended for web requests and scheduled crons to keep the event loop free.
 * @param {Object} options
 * @param {string} [options.creatorName='Newsroom Admin']
 * @param {number} [options.maxRetained=MAX_LOCAL_BACKUPS]
 * @returns {Promise<Object>} Metadata of generated backup
 */
export async function generateNewsroomBackupZipAsync(options = {}) {
  const { creatorName = 'Newsroom Admin', maxRetained = MAX_LOCAL_BACKUPS } = options;
  const { filesToZip, jsonCount, mediaCount, now, prettyDate, fileName } = collectFilesForBackup(creatorName);

  const zipBuffer = await createZipArchiveAsync(filesToZip);
  const filePath = path.join(BACKUPS_DIR, fileName);
  fs.writeFileSync(filePath, zipBuffer);

  const prunedFiles = pruneOldBackups(maxRetained);

  const metadata = {
    fileName,
    filePath,
    sizeBytes: zipBuffer.length,
    sizeFormatted: formatBytes(zipBuffer.length),
    totalFiles: filesToZip.length,
    jsonCount,
    mediaCount,
    createdAt: now.toISOString(),
    createdAtPretty: prettyDate,
    prunedFiles
  };

  recordBackupRun(metadata);

  return {
    success: true,
    backup: metadata,
    buffer: zipBuffer
  };
}

/**
 * Lists all available backups on disk sorted newest first.
 */
export function listAvailableBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    return { backups: [], totalSizeBytes: 0, totalSizeFormatted: '0 B', count: 0, maxAllowed: MAX_LOCAL_BACKUPS };
  }

  const entries = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('publicspark-backup-') && f.endsWith('.zip'))
    .map(f => {
      const fullPath = path.join(BACKUPS_DIR, f);
      const stat = fs.statSync(fullPath);
      return {
        fileName: f,
        sizeBytes: stat.size,
        sizeFormatted: formatBytes(stat.size),
        createdAt: stat.mtime.toISOString(),
        createdAtPretty: stat.mtime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        mtimeMs: stat.mtimeMs
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const totalSizeBytes = entries.reduce((acc, b) => acc + b.sizeBytes, 0);

  return {
    backups: entries,
    totalSizeBytes,
    totalSizeFormatted: formatBytes(totalSizeBytes),
    count: entries.length,
    maxAllowed: MAX_LOCAL_BACKUPS
  };
}

/**
 * Validates filename and returns safe absolute path inside BACKUPS_DIR.
 * Prevents path traversal vulnerabilities.
 */
export function getSafeBackupFilePath(fileName) {
  if (!fileName || typeof fileName !== 'string') return null;
  const cleanName = path.basename(fileName.trim());
  if (!/^[a-zA-Z0-9._-]+$/.test(cleanName)) return null;
  if (!cleanName.startsWith('publicspark-backup-') || !cleanName.endsWith('.zip')) return null;

  const targetPath = path.resolve(BACKUPS_DIR, cleanName);
  if (!targetPath.startsWith(BACKUPS_DIR + path.sep) && targetPath !== BACKUPS_DIR) {
    return null;
  }

  if (fs.existsSync(targetPath)) {
    return targetPath;
  }
  return null;
}

/**
 * Deletes a specific backup file.
 */
export function deleteBackupFile(fileName) {
  const safePath = getSafeBackupFilePath(fileName);
  if (!safePath) {
    return { success: false, error: 'Backup file not found or invalid filename' };
  }
  fs.unlinkSync(safePath);
  return { success: true, deletedFile: path.basename(safePath) };
}

// -------------------------------------------------------------
// BACKUP SETTINGS & SNAPSHOT METRICS GENERATOR
// -------------------------------------------------------------

/**
 * Compiles a deep statistical snapshot of the entire newsroom for the executive backup digest.
 */
export function buildNewsroomSnapshotStats() {
  let articles = [];
  let staff = [];
  let categories = [];
  let grievances = [];
  let ads = [];
  let media = [];
  let revisions = {};

  try {
    const artPath = path.join(DATA_DIR, 'articles.json');
    if (fs.existsSync(artPath)) articles = JSON.parse(fs.readFileSync(artPath, 'utf8') || '[]');
  } catch (_e) { /* Non-blocking */ }

  try {
    const staffPath = path.join(DATA_DIR, 'newsroom_staff.json');
    if (fs.existsSync(staffPath)) staff = JSON.parse(fs.readFileSync(staffPath, 'utf8') || '[]');
  } catch (_e) { /* Non-blocking */ }

  try {
    const catPath = path.join(DATA_DIR, 'categories.json');
    if (fs.existsSync(catPath)) categories = JSON.parse(fs.readFileSync(catPath, 'utf8') || '[]');
  } catch (_e) { /* Non-blocking */ }

  try {
    const grvPath = path.join(DATA_DIR, 'grievances.json');
    if (fs.existsSync(grvPath)) grievances = JSON.parse(fs.readFileSync(grvPath, 'utf8') || '[]');
  } catch (_e) { /* Non-blocking */ }

  try {
    const adsPath = path.join(DATA_DIR, 'ad_history.json');
    if (fs.existsSync(adsPath)) ads = JSON.parse(fs.readFileSync(adsPath, 'utf8') || '[]');
  } catch (_e) { /* Non-blocking */ }

  try {
    const medPath = path.join(DATA_DIR, 'media_library.json');
    if (fs.existsSync(medPath)) media = JSON.parse(fs.readFileSync(medPath, 'utf8') || '[]');
  } catch (_e) { /* Non-blocking */ }

  try {
    const revPath = path.join(DATA_DIR, 'article_revisions.json');
    if (fs.existsSync(revPath)) revisions = JSON.parse(fs.readFileSync(revPath, 'utf8') || '{}');
  } catch (_e) { /* Non-blocking */ }

  let totalViews = 0;
  let totalLikes = 0;
  for (const art of articles) {
    totalViews += Number(art.views_count || 0);
    totalLikes += Number(art.likes_count || 0);
  }

  // Count uploaded files in uploads/
  let uploadedFilesCount = 0;
  if (fs.existsSync(UPLOADS_DIR)) {
    uploadedFilesCount = fs.readdirSync(UPLOADS_DIR).filter(f => {
      try {
        return fs.statSync(path.join(UPLOADS_DIR, f)).isFile();
      } catch (_e) {
        return false;
      }
    }).length;
  }

  let totalRevisionsCount = 0;
  for (const revList of Object.values(revisions)) {
    if (Array.isArray(revList)) totalRevisionsCount += revList.length;
  }

  // Sort published articles by views descending for the top index (exclude drafts from executive summary)
  const publishedOnly = articles.filter(a => a.status === 'published');
  const sortedArticles = [...publishedOnly].sort((a, b) => (Number(b.views_count || 0)) - (Number(a.views_count || 0)));
  const topArticles = sortedArticles.slice(0, 5).map(a => ({
    id: a.id,
    title: a.title,
    category: a.category || 'General',
    author: a.author?.name || a.author_name || 'Staff Reporter',
    views: Number(a.views_count || 0),
    likes: Number(a.likes_count || 0),
    status: a.status || 'published'
  }));

  // Calculate coverage date range
  let earliestDate = null;
  for (const art of articles) {
    const dt = art.createdAt || art.published_at || art.publish_date;
    if (dt && !isNaN(new Date(dt).getTime())) {
      const parsedTime = new Date(dt).getTime();
      if (!earliestDate || parsedTime < earliestDate) earliestDate = parsedTime;
    }
  }

  const rangeStartPretty = earliestDate
    ? new Date(earliestDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Portal Inception';
  const rangeEndPretty = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata'
  });

  return {
    totalArticles: articles.length,
    publishedArticles: articles.filter(a => a.status === 'published').length,
    draftArticles: articles.filter(a => a.status === 'draft').length,
    totalViews,
    totalLikes,
    totalMediaAssets: uploadedFilesCount,
    totalStaff: staff.filter(s => !s.stealth && s.role !== 'developer').length,
    adminCount: staff.filter(s => s.role === 'admin' && !s.stealth).length,
    editorCount: staff.filter(s => s.role === 'editor' && !s.stealth).length,
    reporterCount: staff.filter(s => s.role === 'reporter' && !s.stealth).length,
    totalCategories: categories.length,
    totalGrievances: grievances.length,
    pendingGrievances: grievances.filter(g => g.status === 'pending' || g.status === 'under_review').length,
    totalAdCampaigns: ads.length,
    totalRevisions: totalRevisionsCount,
    topArticles,
    coverageStart: rangeStartPretty,
    coverageEnd: rangeEndPretty,
    coverageRangeLabel: `${rangeStartPretty} to ${rangeEndPretty}`
  };
}

export function getBackupSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return defaultBackupSettings();
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8') || '{}');
    return {
      deliveryEmail: settings.backupDeliveryEmail || 'harshdada2018@gmail.com',
      scheduleFrequency: settings.backupScheduleFrequency || 'daily',
      maxBackups: settings.backupMaxRetained || MAX_LOCAL_BACKUPS,
      autoEmailEnabled: settings.backupAutoEmailEnabled !== false,
      lastBackupAt: settings.lastBackupAt || null,
      lastBackupDateIST: settings.lastBackupDateIST || null,
      lastEmailSentAt: settings.lastBackupEmailSentAt || null
    };
  } catch (_e) {
    return defaultBackupSettings();
  }
}

function defaultBackupSettings() {
  return {
    deliveryEmail: 'harshdada2018@gmail.com',
    scheduleFrequency: 'daily',
    maxBackups: MAX_LOCAL_BACKUPS,
    autoEmailEnabled: true,
    lastBackupAt: null,
    lastBackupDateIST: null,
    lastEmailSentAt: null
  };
}

export function updateBackupSettings(updates = {}) {
  try {
    let settings = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8') || '{}');
    }

    if (updates.deliveryEmail && typeof updates.deliveryEmail === 'string') {
      const email = updates.deliveryEmail.trim().toLowerCase();
      // Strict RFC 5322 alphanumeric email regex preventing control/script character injection (SEC-009)
      if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        settings.backupDeliveryEmail = email;
      }
    }
    if (updates.scheduleFrequency && ['daily', 'weekly', 'manual'].includes(updates.scheduleFrequency)) {
      settings.backupScheduleFrequency = updates.scheduleFrequency;
    }
    if (typeof updates.autoEmailEnabled === 'boolean') {
      settings.backupAutoEmailEnabled = updates.autoEmailEnabled;
    }
    if (updates.maxBackups && Number.isInteger(Number(updates.maxBackups))) {
      settings.backupMaxRetained = Math.max(1, Math.min(10, Number(updates.maxBackups)));
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    return { success: true, settings: getBackupSettings() };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function recordBackupRun(meta) {
  try {
    let settings = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8') || '{}');
    }
    settings.lastBackupAt = meta.createdAt;
    settings.lastBackupFileName = meta.fileName;
    settings.lastBackupSize = meta.sizeFormatted;
    try {
      settings.lastBackupDateIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch (_e) {
      settings.lastBackupDateIST = new Date().toISOString().split('T')[0];
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (_e) {
    // Non-blocking
  }
}

function recordEmailSent(email) {
  try {
    let settings = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8') || '{}');
    }
    settings.lastBackupEmailSentAt = new Date().toISOString();
    settings.lastBackupEmailRecipient = email;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (_e) {
    // Non-blocking
  }
}

/**
 * Dispatches a backup zip file via official Google Mail SMTP to the designated recipient.
 * @param {Object} params
 * @param {string} [params.fileName] - Name of specific backup file, or latest if omitted
 * @param {string} [params.targetEmail] - Destination Gmail address
 * @param {string} [params.trigger='manual'] - 'manual' | 'scheduled'
 */
export async function dispatchBackupToGmail({ fileName, targetEmail, trigger = 'manual' } = {}) {
  const settings = getBackupSettings();
  const recipient = (targetEmail || settings.deliveryEmail || 'harshdada2018@gmail.com').trim().toLowerCase();

  // Validate recipient email with strict RFC 5322 regex preventing tag/script injection (SEC-009)
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(recipient)) {
    return { success: false, error: 'Invalid recipient email address format' };
  }

  // Find target backup file or latest if not specified
  let safePath = null;
  if (fileName) {
    safePath = getSafeBackupFilePath(fileName);
  } else {
    const list = listAvailableBackups();
    if (list.backups.length > 0) {
      safePath = getSafeBackupFilePath(list.backups[0].fileName);
    }
  }

  // If no backup exists on disk, generate a fresh one immediately
  let backupMeta = null;
  if (!safePath) {
    console.log('[Backup Dispatch] No existing archive found. Generating fresh backup...');
    const fresh = generateNewsroomBackupZip({ creatorName: `Auto-Dispatcher (${trigger})` });
    safePath = fresh.backup.filePath;
    backupMeta = fresh.backup;
  } else {
    const stat = fs.statSync(safePath);
    backupMeta = {
      fileName: path.basename(safePath),
      sizeBytes: stat.size,
      sizeFormatted: formatBytes(stat.size),
      createdAtPretty: stat.mtime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };
  }

  const actualFileName = path.basename(safePath);
  const stats = buildNewsroomSnapshotStats();
  const subject = `[PublicSpark Backup] Disaster Recovery Archive - ${stats.coverageEnd || new Date().toDateString()}`;

  // Attachment ceiling enforcement (24 MB safe boundary for Google Mail SMTP)
  const MAX_GMAIL_ATTACHMENT_BYTES = 24 * 1024 * 1024;
  const isOversized = backupMeta.sizeBytes > MAX_GMAIL_ATTACHMENT_BYTES;
  const attachments = [];

  let sizeWarningBannerHtml = '';
  if (isOversized) {
    console.warn(`[Backup Dispatch Warning] Backup ${actualFileName} (${backupMeta.sizeFormatted}) exceeds Gmail 24 MB limit. Detaching attachment.`);
    sizeWarningBannerHtml = `
      <div style="background: #FFFBEB; border: 1px solid #FCD34D; border-left: 4px solid #D97706; padding: 14px 16px; margin: 16px 0; border-radius: 0 3px 3px 0;">
        <div style="font-weight: 800; font-size: 12px; color: #92400E; text-transform: uppercase; letter-spacing: 0.05em;">Notice: Archive Exceeds Gmail 25 MB Attachment Ceiling</div>
        <div style="font-size: 12px; color: #78350F; margin-top: 4px; line-height: 1.5;">
          The disaster recovery archive (<strong>${escapeHtml(backupMeta.sizeFormatted)}</strong>) is safely preserved on the server disk. Due to Gmail's 25 MB inbound cap, the file was detached. Please download your copy directly from the <strong>Admin Workspace Backup Desk</strong> or via the CLI restore command.
        </div>
      </div>
    `;
  } else {
    attachments.push({
      filename: actualFileName,
      path: safePath,
      contentType: 'application/zip'
    });
  }

  // Top stories rows HTML with strict XSS escaping
  const topArticlesHtml = stats.topArticles.length > 0
    ? stats.topArticles.map((art, idx) => `
      <tr style="border-bottom: 1px solid #E5E7EB; font-size: 12px;">
        <td style="padding: 8px 10px; font-weight: 700; color: #6B7280; font-family: monospace;">#${idx + 1}</td>
        <td style="padding: 8px 10px; color: #111827; font-weight: 600;">${escapeHtml(art.title.length > 70 ? art.title.slice(0, 67) + '...' : art.title)}</td>
        <td style="padding: 8px 10px; color: #4B5563;">${escapeHtml(art.category)}</td>
        <td style="padding: 8px 10px; font-family: monospace; font-weight: 700; color: #991B1B; text-align: right;">${art.views.toLocaleString('en-IN')} views</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #6B7280; font-size: 12px;">No published articles found.</td></tr>';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F3F4F6; color: #111827; margin: 0; padding: 24px; }
    .container { max-width: 680px; margin: 0 auto; background: #FFFFFF; border: 1px solid #D1D5DB; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
    .header { background: #111827; color: #FFFFFF; padding: 22px 28px; border-bottom: 3px solid #991B1B; }
    .logo { font-size: 22px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 11px; color: #9CA3AF; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.1em; }
    .content { padding: 24px 28px; }
    .badge-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid #E5E7EB; padding-bottom: 12px; }
    .badge { display: inline-block; background: #FEF2F2; color: #991B1B; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid #FCA5A5; }
    .period-banner { background: #F9FAFB; border-left: 4px solid #991B1B; border-top: 1px solid #E5E7EB; border-right: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 12px 16px; margin: 16px 0 20px 0; border-radius: 0 3px 3px 0; }
    .period-title { font-size: 11px; color: #6B7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 4px; }
    .period-range { font-size: 14px; color: #111827; font-weight: 700; font-family: monospace; }
    .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #111827; margin: 24px 0 12px 0; border-bottom: 2px solid #111827; padding-bottom: 4px; }
    .table-wrap { width: 100%; border: 1px solid #E5E7EB; border-radius: 3px; overflow: hidden; margin: 12px 0; }
    .table { width: 100%; border-collapse: collapse; text-align: left; }
    .table th { background: #F3F4F6; padding: 8px 10px; font-size: 11px; font-weight: 700; color: #4B5563; text-transform: uppercase; border-bottom: 1px solid #D1D5DB; }
    .manifest-box { background: #F8FAFC; border: 1px solid #CBD5E1; padding: 14px; border-radius: 3px; font-size: 12px; line-height: 1.6; color: #334155; margin: 16px 0; }
    .manifest-item { padding: 4px 0; border-bottom: 1px dashed #E2E8F0; display: flex; justify-content: space-between; }
    .manifest-item:last-child { border-bottom: none; }
    .manifest-file { font-family: monospace; font-weight: 700; color: #0F172A; }
    .manifest-desc { color: #64748B; font-size: 11px; }
    .notice { font-size: 12px; color: #374151; line-height: 1.5; background: #FEF3C7; padding: 12px 16px; border-left: 4px solid #D97706; margin-top: 20px; border-radius: 0 3px 3px 0; }
    .code-pill { background: #1E293B; color: #F8FAFC; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 11px; }
    .footer { background: #F9FAFB; padding: 18px 28px; font-size: 11px; color: #6B7280; border-top: 1px solid #E5E7EB; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">PUBLICSPARK</div>
      <div class="subtitle">Official Sovereign Newsroom Disaster Recovery Cloud Archive</div>
    </div>
    
    <div class="content">
      <div class="badge-bar">
        <span class="badge">Complete Newsroom Snapshot</span>
        <span style="font-size: 11px; color: #6B7280; font-family: monospace;">Archive: ${escapeHtml(actualFileName)}</span>
      </div>

      <div class="period-banner">
        <div class="period-title">Archival Coverage Period (Data Range)</div>
        <div class="period-range">${escapeHtml(stats.coverageRangeLabel)}</div>
      </div>

      ${sizeWarningBannerHtml}

      <div class="section-title">1. Executive Site Telemetry & Readership (All-Time)</div>
      
      <!-- Responsive 2x2 Email-Safe Table Grid (100% resilient across Gmail Android, iOS, Outlook) -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; border-spacing: 8px 8px; margin-bottom: 12px;">
        <tr>
          <td width="50%" style="background: #F9FAFB; border: 1px solid #E5E7EB; padding: 12px 14px; vertical-align: top;">
            <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Total Articles</div>
            <div style="font-size: 18px; font-weight: 800; color: #111827; font-family: monospace; margin: 2px 0;">${stats.totalArticles}</div>
            <div style="font-size: 11px; color: #6B7280;">${stats.publishedArticles} Published &bull; ${stats.draftArticles} Drafts</div>
          </td>
          <td width="50%" style="background: #F9FAFB; border: 1px solid #E5E7EB; padding: 12px 14px; vertical-align: top;">
            <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Total Readership</div>
            <div style="font-size: 18px; font-weight: 800; color: #991B1B; font-family: monospace; margin: 2px 0;">${stats.totalViews.toLocaleString('en-IN')}</div>
            <div style="font-size: 11px; color: #6B7280;">Verified Site Views</div>
          </td>
        </tr>
        <tr>
          <td width="50%" style="background: #F9FAFB; border: 1px solid #E5E7EB; padding: 12px 14px; vertical-align: top;">
            <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Reader Likes</div>
            <div style="font-size: 18px; font-weight: 800; color: #111827; font-family: monospace; margin: 2px 0;">${stats.totalLikes.toLocaleString('en-IN')}</div>
            <div style="font-size: 11px; color: #6B7280;">Active Reactions</div>
          </td>
          <td width="50%" style="background: #F9FAFB; border: 1px solid #E5E7EB; padding: 12px 14px; vertical-align: top;">
            <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Media Assets</div>
            <div style="font-size: 18px; font-weight: 800; color: #111827; font-family: monospace; margin: 2px 0;">${stats.totalMediaAssets}</div>
            <div style="font-size: 11px; color: #6B7280;">Photos & Audio Clips</div>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; border-spacing: 8px 8px; margin-bottom: 16px;">
        <tr>
          <td width="50%" style="background: #F9FAFB; border: 1px solid #E5E7EB; padding: 12px 14px; vertical-align: top;">
            <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Newsroom Staff</div>
            <div style="font-size: 18px; font-weight: 800; color: #111827; font-family: monospace; margin: 2px 0;">${stats.totalStaff}</div>
            <div style="font-size: 11px; color: #6B7280;">${stats.adminCount} Admin &bull; ${stats.editorCount} Ed &bull; ${stats.reporterCount} Rep</div>
          </td>
          <td width="50%" style="background: #F9FAFB; border: 1px solid #E5E7EB; padding: 12px 14px; vertical-align: top;">
            <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Categories</div>
            <div style="font-size: 18px; font-weight: 800; color: #111827; font-family: monospace; margin: 2px 0;">${stats.totalCategories}</div>
            <div style="font-size: 11px; color: #6B7280;">Active Desks</div>
          </td>
        </tr>
        <tr>
          <td width="50%" style="background: #F9FAFB; border: 1px solid #E5E7EB; padding: 12px 14px; vertical-align: top;">
            <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Audit Revisions</div>
            <div style="font-size: 18px; font-weight: 800; color: #111827; font-family: monospace; margin: 2px 0;">${stats.totalRevisions}</div>
            <div style="font-size: 11px; color: #6B7280;">Rollback Snapshots</div>
          </td>
          <td width="50%" style="background: #F9FAFB; border: 1px solid #E5E7EB; padding: 12px 14px; vertical-align: top;">
            <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Grievance Dockets</div>
            <div style="font-size: 18px; font-weight: 800; color: #111827; font-family: monospace; margin: 2px 0;">${stats.totalGrievances}</div>
            <div style="font-size: 11px; color: #6B7280;">${stats.pendingGrievances} Awaiting Action</div>
          </td>
        </tr>
      </table>

      <div class="section-title">2. Top Trending News Stories in Archive</div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Headline</th>
              <th style="width: 90px;">Category</th>
              <th style="width: 100px; text-align: right;">Readership</th>
            </tr>
          </thead>
          <tbody>
            ${topArticlesHtml}
          </tbody>
        </table>
      </div>

      <div class="section-title">3. Exact Inventory Inside Attached .ZIP Archive</div>
      <div class="manifest-box">
        <div class="manifest-item">
          <span class="manifest-file">data/articles.json</span>
          <span class="manifest-desc">${stats.totalArticles} articles with full markdown body, bylines, fact-checks, views & likes</span>
        </div>
        <div class="manifest-item">
          <span class="manifest-file">data/article_revisions.json</span>
          <span class="manifest-desc">${stats.totalRevisions} editorial history snapshots with side-by-side diffs & rollbacks</span>
        </div>
        <div class="manifest-item">
          <span class="manifest-file">data/newsroom_staff.json</span>
          <span class="manifest-desc">${stats.totalStaff} staff profiles, salted scrypt password hashes, and RBAC permissions</span>
        </div>
        <div class="manifest-item">
          <span class="manifest-file">data/newsroom_security.json</span>
          <span class="manifest-desc">Revoked session tokens registry, IP sliding-window rate limit state</span>
        </div>
        <div class="manifest-item">
          <span class="manifest-file">data/categories.json</span>
          <span class="manifest-desc">${stats.totalCategories} taxonomy desks with custom slugs and live article counters</span>
        </div>
        <div class="manifest-item">
          <span class="manifest-file">data/settings.json</span>
          <span class="manifest-desc">Site branding, typography presets, ads.txt, social links, and backup config</span>
        </div>
        <div class="manifest-item">
          <span class="manifest-file">data/grievances.json</span>
          <span class="manifest-desc">${stats.totalGrievances} statutory public complaints & legal dispositions (IT Rules 2021)</span>
        </div>
        <div class="manifest-item">
          <span class="manifest-file">data/ad_history.json</span>
          <span class="manifest-desc">${stats.totalAdCampaigns} direct advertiser campaigns, schedules, impressions & click proof</span>
        </div>
        <div class="manifest-item">
          <span class="manifest-file">data/media_library.json</span>
          <span class="manifest-desc">Digital asset registry, captions, agency photo credits (PTI, Reuters, ANI)</span>
        </div>
        <div class="manifest-item">
          <span class="manifest-file">data/poll.json</span>
          <span class="manifest-desc">Live reader daily poll question, options, and vote tallies</span>
        </div>
        <div class="manifest-item">
          <span class="manifest-file">data/usage_logs.json</span>
          <span class="manifest-desc">Anonymous reader dwell telemetry and country distributions</span>
        </div>
        <div class="manifest-item">
          <span class="manifest-file">uploads/*</span>
          <span class="manifest-desc">${stats.totalMediaAssets} uploaded WebP banners, news photos, and synthesized MP3 audio clips</span>
        </div>
        <div class="manifest-item">
          <span class="manifest-file">manifest.json</span>
          <span class="manifest-desc">Cryptographic checksum and archive verification ledger</span>
        </div>
      </div>

      <div class="notice">
        <strong>Disaster Recovery Instructions:</strong> To restore this complete snapshot onto any new server, VPS, or local environment, simply run:
        <br>
        <span class="code-pill">node server/cli/restore-backup.js ${actualFileName}</span>
        <br>
        Or upload this .zip file directly into the 1-Click Restore tool inside the Admin Workspace.
      </div>
    </div>

    <div class="footer">
      PublicSpark Multilingual Newsroom Engine &bull; Sovereign Disaster Recovery Cloud &bull; Confidential
      <br>
      Automated archive delivered to verified Google Cloud storage.
    </div>
  </div>
</body>
</html>
  `;

  const text = `PUBLICSPARK - Official Sovereign Disaster Recovery Backup
Coverage Period: ${stats.coverageRangeLabel}
Archive File: ${actualFileName} (${backupMeta.sizeFormatted})
Compiled At: ${backupMeta.createdAtPretty}
Trigger: ${trigger}

EXECUTIVE SITE TELEMETRY:
- Total Articles: ${stats.totalArticles} (${stats.publishedArticles} published, ${stats.draftArticles} drafts)
- Total Readership: ${stats.totalViews.toLocaleString('en-IN')} verified views
- Total Reader Likes: ${stats.totalLikes.toLocaleString('en-IN')}
- Uploaded Media Assets: ${stats.totalMediaAssets}
- Newsroom Staff: ${stats.totalStaff} accounts
- Categories: ${stats.totalCategories} active desks
- Grievances: ${stats.totalGrievances} statutory tickets

TOP STORIES IN THIS ARCHIVE:
${stats.topArticles.map((a, i) => `${i + 1}. ${a.title} (${a.category}) - ${a.views} views`).join('\n')}

${isOversized ? `[NOTICE: Archive size (${backupMeta.sizeFormatted}) exceeds Gmail's 25 MB limit. Archive file is preserved on server disk. Download directly via Admin Workspace.]\n` : 'The complete encrypted archive is attached as a .zip file.\n'}To restore on any server, run:
node server/cli/restore-backup.js ${actualFileName}`;

  console.log(`[Backup Dispatch] Dispatching ${actualFileName} to ${recipient}... (Attachments: ${attachments.length})`);
  const result = await sendNewsroomEmail({
    to: recipient,
    subject,
    html,
    text,
    attachments
  });

  if (result.success && result.delivered) {
    recordEmailSent(recipient);
    console.log(`[Backup Dispatch] Successfully delivered backup to ${recipient} (Message ID: ${result.messageId})`);
    return {
      success: true,
      deliveredTo: recipient,
      messageId: result.messageId,
      fileName: actualFileName,
      sizeFormatted: backupMeta.sizeFormatted,
      mode: result.mode
    };
  } else {
    console.error(`[Backup Dispatch Error]: Failed to deliver email:`, result.error);
    return {
      success: false,
      deliveredTo: recipient,
      error: result.error || 'Failed to dispatch email via SMTP transporter',
      mode: result.mode
    };
  }
}

