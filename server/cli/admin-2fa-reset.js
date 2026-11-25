#!/usr/bin/env node
/**
 * Developer Emergency 2FA Reset Utility (Protected by Sovereign Master Passphrase)
 * Usage:
 *   node server/cli/admin-2fa-reset.js [email]
 *   npm run reset-2fa [email]
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..', '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');

// Load .env before importing staffAuthService so MASTER_PASSPHRASE_HASH is populated
if (fs.existsSync(ENV_FILE)) {
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const { verifyMasterPassphrase, resetStaff2fa } = await import('../services/staffAuthService.js');

const args = process.argv.slice(2);
let targetEmail = 'admin@publicspark.in';
let cliPassphrase = '';

for (const arg of args) {
  if (arg.startsWith('--passphrase=')) {
    cliPassphrase = arg.slice('--passphrase='.length).trim();
  } else if (!arg.startsWith('--')) {
    targetEmail = arg.toLowerCase().trim();
  }
}

function promptPassphrase() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Enter Sovereign Master Passphrase to authorize 2FA Reset: ', (answer) => {
      rl.close();
      resolve((answer || '').trim());
    });
  });
}

async function main() {
  const candidatePassphrase = cliPassphrase || await promptPassphrase();

  if (!candidatePassphrase || !verifyMasterPassphrase(candidatePassphrase)) {
    console.error('[ACCESS DENIED]: Invalid or missing Master Passphrase. 2FA reset aborted.');
    process.exit(1);
  }

  try {
    const result = resetStaff2fa(targetEmail);
    console.log('====================================================');
    console.log('[PUBLICSPARK DEVELOPER SECURITY CLI: 2FA RESET]');
    console.log('Master Passphrase   : [VERIFIED]');
    console.log('====================================================');
    console.log(`Target Staff Member : ${result.name} (${result.email})`);
    console.log(`Role                : ${result.role}`);
    console.log(`Previous 2FA Status : ${result.previousStatus}`);
    console.log('New 2FA Status      : Reset to Fresh / Unconfigured');
    console.log('Recovery Codes      : All previous hashes purged');
    console.log(`Timestamp           : ${new Date().toISOString()}`);
    console.log('----------------------------------------------------');
    console.log('[SUCCESS] Next time the user logs in, they will be');
    console.log('prompted to pair a fresh phone and receive 10 new');
    console.log('emergency recovery codes.');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error(`[FATAL]: Failed to reset 2FA: ${err.message}`);
    process.exit(1);
  }
}

main();
