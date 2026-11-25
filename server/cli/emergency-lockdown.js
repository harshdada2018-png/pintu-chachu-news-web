#!/usr/bin/env node
/**
 * PublicSpark Sovereign Master Passphrase Recovery & Emergency Lockdown CLI
 * Usage:
 *   node server/cli/emergency-lockdown.js <passphrase> [action] [options]
 *   npm run lockdown <passphrase> [action]
 * 
 * Supported Actions:
 *   status           : View system account status & global session cutoff
 *   revoke-sessions  : Instantly invalidate all active staff tokens globally
 *   reset-2fa        : Wipe 2FA secret and recovery codes for Super Admin
 *   reset-password   : Restore Super Admin password (default: Admin@2026)
 *   emergency-all    : Full lockdown (Revoke sessions + Reset password + Wipe 2FA)
 *   sql-export       : Export Cloudflare D1 / SQLite emergency recovery SQL
 */

import readline from 'readline';
import {
  verifyMasterPassphrase,
  getSecurityState,
  invalidateAllStaffSessions,
  resetStaff2fa,
  executeEmergencyLockdown,
  generateCloudflareD1LockdownSql,
  getStaffList,
  updateStaffPassword
} from '../services/staffAuthService.js';

// Parse command line arguments
const args = process.argv.slice(2);

let candidatePassphrase = '';
let action = '';
let targetEmail = 'admin@publicspark.in';
let targetPassword = 'Admin@2026';

for (const arg of args) {
  if (arg.startsWith('--passphrase=')) {
    candidatePassphrase = arg.split('=')[1].trim();
  } else if (arg.startsWith('--action=')) {
    action = arg.split('=')[1].trim();
  } else if (arg.startsWith('--email=')) {
    targetEmail = arg.split('=')[1].trim().toLowerCase();
  } else if (arg.startsWith('--password=')) {
    targetPassword = arg.split('=')[1].trim();
  } else if (!candidatePassphrase) {
    candidatePassphrase = arg.trim();
  } else if (!action) {
    action = arg.trim();
  }
}

function printHeader() {
  console.log('=================================================================');
  console.log('PUBLICSPARK SOVEREIGN EMERGENCY SECURITY CONSOLE');
  console.log('Master Passphrase   : [VERIFIED]');
  console.log(`Execution Time      : ${new Date().toISOString()}`);
  console.log('=================================================================');
}

function printHelp() {
  console.log('Usage:');
  console.log('  node server/cli/emergency-lockdown.js <passphrase> [action] [options]');
  console.log('');
  console.log('Available Actions:');
  console.log('  status           : Inspect active accounts & security state');
  console.log('  revoke-sessions  : Terminate all active staff login sessions globally');
  console.log('  reset-2fa        : Wipe Google Authenticator 2FA keys & codes');
  console.log('  reset-password   : Restore Super Admin password (Admin@2026)');
  console.log('  emergency-all    : Complete lockdown (Revoke sessions + Password + 2FA)');
  console.log('  sql-export       : Print Cloudflare D1 / SQLite recovery queries');
  console.log('');
  console.log('Options:');
  console.log('  --email=<email>       : Target specific staff member (default: admin@publicspark.in)');
  console.log('  --password=<password> : Set custom recovery password (default: Admin@2026)');
  console.log('=================================================================');
}

function handleStatus() {
  const secState = getSecurityState();
  const staffList = getStaffList();
  const superAdmin = staffList.find(s => s.email === 'admin@publicspark.in');

  console.log('[SYSTEM SECURITY STATUS]');
  console.log(`Global Lockdown Active    : ${secState.lockdownActive ? 'YES (Active)' : 'No'}`);
  console.log(`Last Lockdown Timestamp   : ${secState.lastLockdownAt || 'None recorded'}`);
  console.log(`Last Lockdown Reason      : ${secState.lastLockdownReason || 'N/A'}`);
  console.log(`Sessions Revocation Cutoff: ${secState.sessionsInvalidatedBefore ? new Date(secState.sessionsInvalidatedBefore).toISOString() : 'Never (All sessions valid)'}`);
  console.log('-----------------------------------------------------------------');
  console.log('[PRIMARY SUPER ADMIN ACCOUNT]');
  if (superAdmin) {
    console.log(`Email                     : ${superAdmin.email}`);
    console.log(`Status                    : ${superAdmin.status}`);
    console.log(`2FA Protection            : ${superAdmin.twoFactorEnabled ? 'Active (RFC 6238 TOTP)' : 'Fresh / Not Configured'}`);
    console.log(`Active Recovery Codes     : ${Array.isArray(superAdmin.twoFactorRecoveryCodes) ? superAdmin.twoFactorRecoveryCodes.length : 0}`);
    console.log(`Last Profile Update       : ${superAdmin.updatedAt || superAdmin.createdAt}`);
  } else {
    console.log('WARNING: Primary super admin account not found in database.');
  }
  console.log('-----------------------------------------------------------------');
  console.log(`[STAFF DIRECTORY SUMMARY: ${staffList.length} TOTAL ACCOUNTS]`);
  staffList.forEach((s, idx) => {
    const twoFaStr = s.twoFactorEnabled ? '2FA-ON' : '2FA-OFF';
    console.log(`  ${idx + 1}. [${s.role.toUpperCase().padEnd(8)}] ${s.email.padEnd(32)} | Status: ${s.status.padEnd(8)} | ${twoFaStr}`);
  });
  console.log('=================================================================');
}

function handleRevokeSessions() {
  const result = invalidateAllStaffSessions('Emergency Terminal Reset by CLI');
  console.log('[ACTION: REVOKE ALL SESSIONS]');
  console.log(`Result                    : SUCCESS`);
  console.log(`Revocation Cutoff Epoch   : ${result.cutoff} ms`);
  console.log(`Revocation Cutoff ISO     : ${new Date(result.cutoff).toISOString()}`);
  console.log('All active staff & admin tokens across all devices are now revoked.');
  console.log('Every staff member must re-authenticate with their password.');
  console.log('=================================================================');
}

function handleReset2fa() {
  const result = resetStaff2fa(targetEmail);
  console.log('[ACTION: EMERGENCY 2FA RESET]');
  console.log(`Target Email              : ${result.email} (${result.name})`);
  console.log(`Previous Status           : ${result.previousStatus}`);
  console.log(`New Status                : ${result.newStatus}`);
  console.log('2FA secret and recovery code hashes have been purged from database.');
  console.log('The user can now log in directly with their password and pair cleanly.');
  console.log('=================================================================');
}

function handleResetPassword() {
  const result = updateStaffPassword(targetEmail, targetPassword);
  if (!result.success) {
    console.error(`[ERROR]: ${result.error}`);
    process.exit(1);
  }
  console.log('[ACTION: EMERGENCY PASSWORD RESET]');
  console.log(`Target Email              : ${result.email} (${result.name})`);
  console.log(`Role                      : ${result.role}`);
  console.log(`New Plaintext Password    : ${targetPassword}`);
  console.log(`Password Hash             : Re-salted with high-entropy scrypt`);
  console.log('The account is immediately accessible with this new password.');
  console.log('=================================================================');
}

function handleEmergencyAll() {
  const result = executeEmergencyLockdown({
    email: targetEmail,
    newPassword: targetPassword,
    reset2fa: true
  });
  console.log('[ACTION: COMPLETE EMERGENCY LOCKDOWN]');
  console.log(`Target Email              : ${result.email} (${result.name})`);
  console.log(`Role                      : ${result.role}`);
  console.log(`Sessions Revoked At       : ${new Date(result.sessionsRevokedAt).toISOString()}`);
  console.log(`Password Reset Status     : Completed (New password: ${targetPassword})`);
  console.log(`2FA Reset Status          : Completed (2FA wiped to fresh unconfigured)`);
  console.log('All active logins have been killed. Super Admin direct access restored.');
  console.log('=================================================================');
}

function handleSqlExport() {
  const sql = generateCloudflareD1LockdownSql({
    adminEmail: targetEmail,
    newPassword: targetPassword
  });
  console.log('[ACTION: CLOUDFLARE D1 / SQLITE RECOVERY SCRIPT]');
  console.log('Copy and execute the following SQL in Cloudflare D1 Console / Wrangler:');
  console.log('-----------------------------------------------------------------');
  console.log(sql);
  console.log('-----------------------------------------------------------------');
  console.log('[INSTRUCTION]: Execute via: wrangler d1 execute <DATABASE_NAME> --file=lockdown.sql');
  console.log('Or paste directly into the Cloudflare Dashboard Web Console.');
  console.log('=================================================================');
}

async function runInteractiveMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('Available Security Actions:');
  console.log('  1. Status            : Inspect active staff accounts & security state');
  console.log('  2. Invalidate Sessions: Terminate all active staff login sessions globally');
  console.log('  3. Reset 2FA         : Wipe Google Authenticator keys & recovery codes');
  console.log('  4. Reset Password    : Emergency restore Super Admin password (Admin@2026)');
  console.log('  5. Emergency ALL     : Complete Lockdown (Sessions + Password + 2FA Wipe)');
  console.log('  6. Export D1 SQL     : Print Cloudflare D1 / SQLite emergency SQL commands');
  console.log('  7. Exit');
  console.log('-----------------------------------------------------------------');

  rl.question('Select an action [1-7]: ', (answer) => {
    rl.close();
    const choice = answer.trim();
    switch (choice) {
      case '1':
        handleStatus();
        break;
      case '2':
        handleRevokeSessions();
        break;
      case '3':
        handleReset2fa();
        break;
      case '4':
        handleResetPassword();
        break;
      case '5':
        handleEmergencyAll();
        break;
      case '6':
        handleSqlExport();
        break;
      case '7':
        console.log('Exiting emergency console.');
        break;
      default:
        console.log('Invalid choice selected. Exiting.');
        break;
    }
  });
}

// -------------------------------------------------------------
// MAIN ENTRY POINT
// -------------------------------------------------------------
async function main() {
  // 1. Verify Passphrase
  if (!candidatePassphrase || !verifyMasterPassphrase(candidatePassphrase)) {
    console.error('=================================================================');
    console.error('[PUBLICSPARK EMERGENCY RECOVERY CONSOLE]');
    console.error('=================================================================');
    console.error('[ACCESS DENIED]: Master recovery passphrase is required or invalid.');
    console.error('Usage: node server/cli/emergency-lockdown.js <passphrase> [action]');
    console.error('Example: node server/cli/emergency-lockdown.js 4552768 status');
    console.error('=================================================================');
    process.exit(1);
  }

  printHeader();

  const normalizedAction = (action || '').toLowerCase().trim();

  switch (normalizedAction) {
    case 'status':
      handleStatus();
      break;
    case 'revoke-sessions':
    case 'revoke':
      handleRevokeSessions();
      break;
    case 'reset-2fa':
    case '2fa':
      handleReset2fa();
      break;
    case 'reset-password':
    case 'password':
      handleResetPassword();
      break;
    case 'emergency-all':
    case 'all':
    case 'lockdown':
      handleEmergencyAll();
      break;
    case 'sql-export':
    case 'sql':
      handleSqlExport();
      break;
    case 'help':
      printHelp();
      break;
    case '':
      if (process.stdin.isTTY) {
        await runInteractiveMenu();
      } else {
        handleStatus();
      }
      break;
    default:
      console.error(`[UNKNOWN ACTION]: "${action}"`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[FATAL ERROR]: ${err.message}`);
  process.exit(1);
});

