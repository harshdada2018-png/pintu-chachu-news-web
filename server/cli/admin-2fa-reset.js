#!/usr/bin/env node
/**
 * Developer Emergency 2FA Reset Utility
 * Usage:
 *   node server/cli/admin-2fa-reset.js [email]
 *   npm run reset-2fa [email]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STAFF_FILE = path.join(__dirname, '..', 'data', 'newsroom_staff.json');

const targetEmail = (process.argv[2] || 'admin@publicspark.in').toLowerCase().trim();

if (!fs.existsSync(STAFF_FILE)) {
  console.error(`[ERROR]: Staff database file not found at ${STAFF_FILE}`);
  process.exit(1);
}

try {
  const staffList = JSON.parse(fs.readFileSync(STAFF_FILE, 'utf-8'));
  const staff = staffList.find(s => s.email.toLowerCase() === targetEmail);

  if (!staff) {
    console.error(`[ERROR]: No staff member found with email: ${targetEmail}`);
    process.exit(1);
  }

  const previousStatus = staff.twoFactorEnabled ? 'Active' : 'Not Active';

  // Wipe out 2FA secret and recovery codes
  staff.twoFactorEnabled = false;
  staff.twoFactorSecret = null;
  staff.twoFactorRecoveryCodes = [];
  staff.twoFactorActivatedAt = null;
  staff.updatedAt = new Date().toISOString();

  fs.writeFileSync(STAFF_FILE, JSON.stringify(staffList, null, 2), 'utf-8');

  console.log('====================================================');
  console.log('[PUBLICSPARK DEVELOPER SECURITY CLI: 2FA RESET]');
  console.log('====================================================');
  console.log(`Target Staff Member : ${staff.name} (${staff.email})`);
  console.log(`Role                : ${staff.role}`);
  console.log(`Previous 2FA Status : ${previousStatus}`);
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

