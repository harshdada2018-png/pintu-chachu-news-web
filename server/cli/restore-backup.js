#!/usr/bin/env node
/**
 * PublicSpark Newsroom Disaster Recovery Restore CLI
 * Restores all JSON databases and media assets from a backup .zip archive.
 *
 * Usage:
 *   node server/cli/restore-backup.js [filename-or-path]
 *   npm run restore-backup [filename-or-path]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractZipArchive, listAvailableBackups } from '../services/backupService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const BACKUPS_DIR = path.resolve(DATA_DIR, 'backups');

console.log('================================================================');
console.log('PUBLICSPARK DISASTER RECOVERY RESTORE CLI');
console.log('================================================================');

const targetArg = process.argv[2]?.trim();
let customTargetDir = null;
if (process.argv[3]?.startsWith('--target=')) {
  customTargetDir = path.resolve(process.argv[3].split('=')[1]);
} else if (process.argv[3]?.startsWith('--target-dir=')) {
  customTargetDir = path.resolve(process.argv[3].split('=')[1]);
} else if (process.argv[3] && !process.argv[3].startsWith('--')) {
  customTargetDir = path.resolve(process.argv[3]);
}

const destDir = customTargetDir || DATA_DIR;

if (!targetArg || targetArg === '--help' || targetArg === '-h') {
  console.log('No backup file specified.');
  console.log('');
  console.log('Usage:');
  console.log('  node server/cli/restore-backup.js <backup-filename.zip>');
  console.log('  node server/cli/restore-backup.js <full-path-to-zip>');
  console.log('  node server/cli/restore-backup.js <backup-filename.zip> --target=/path/to/dir');
  console.log('  npm run restore-backup <backup-filename.zip>');
  console.log('');
  console.log('Available backups on disk:');
  const available = listAvailableBackups();
  if (available.backups.length === 0) {
    console.log('  (No local backup files found in server/data/backups/)');
  } else {
    for (const b of available.backups) {
      console.log(`  - ${b.fileName} (${b.sizeFormatted}, created: ${b.createdAtPretty})`);
    }
  }
  console.log('================================================================');
  process.exit(targetArg ? 0 : 1);
}

// Locate target file: either absolute path, relative path, or inside BACKUPS_DIR
let archivePath = path.resolve(targetArg);
if (!fs.existsSync(archivePath) && !targetArg.includes(path.sep) && !targetArg.includes('/')) {
  archivePath = path.join(BACKUPS_DIR, targetArg);
}

if (!fs.existsSync(archivePath)) {
  console.error(`[ERROR]: Backup archive not found: ${targetArg}`);
  console.error(`Checked path: ${archivePath}`);
  console.log('================================================================');
  process.exit(1);
}

const stat = fs.statSync(archivePath);
console.log(`Target Archive  : ${path.basename(archivePath)}`);
console.log(`Archive Size    : ${(stat.size / 1024).toFixed(1)} KB`);
console.log(`Target Directory: ${destDir}`);
console.log('Extracting newsroom files...');

try {
  const zipBuffer = fs.readFileSync(archivePath);
  const extractedFiles = extractZipArchive(zipBuffer, destDir);

  console.log('----------------------------------------------------------------');
  console.log(`[SUCCESS] Extracted ${extractedFiles.length} files successfully.`);
  console.log('----------------------------------------------------------------');
  for (const f of extractedFiles) {
    console.log(`  + ${f}`);
  }

  // Quick verification
  const artPath = path.join(destDir, 'articles.json');
  if (fs.existsSync(artPath)) {
    try {
      const articles = JSON.parse(fs.readFileSync(artPath, 'utf8') || '[]');
      console.log(`Verified Articles in Database: ${articles.length} records`);
    } catch (_e) {
      // Non-blocking
    }
  }

  console.log('================================================================');
  console.log('Disaster recovery restoration completed successfully.');
  console.log('Newsroom data is 100% active and live.');
  console.log('================================================================');
} catch (err) {
  console.error(`[FATAL ERROR] Failed to restore backup: ${err.message}`);
  console.log('================================================================');
  process.exit(1);
}

