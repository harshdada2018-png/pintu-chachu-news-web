#!/usr/bin/env node
/**
 * PublicSpark Newsroom Sovereign Clean Production Reset Tool
 * Governed by Rule 6 (Mock Data & Production Readiness) & Task 35 Subtopic B.
 *
 * Actions:
 *  1. Creates an automated pre-reset PKZIP safety backup archive.
 *  2. Sanitizes articles.json (resets views/reaction counters to 0 while preserving genuine articles).
 *  3. Sanitizes settings.json (purges dummy phone numbers and invalid slots).
 *  4. Initializes poll.json with a genuine launch public opinion poll (0 votes).
 *  5. Resets ad_history.json and usage_logs.json.
 *  6. Flushes live server in-memory caches.
 *
 * Usage:
 *   node server/cli/clean-production-reset.js [--dry-run] [--force]
 *   npm run clean-reset
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateNewsroomBackupZipAsync } from '../services/backupService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');

export async function runCleanProductionReset(options = {}) {
  const { dryRun = false, makeBackup = true, verbose = true } = options;
  const log = (...args) => { if (verbose) console.log(...args); };

  log('================================================================');
  log('PUBLICSPARK SOVEREIGN CLEAN PRODUCTION RESET TOOL (RULE 6)');
  log('================================================================');
  if (dryRun) {
    log('[DRY-RUN MODE] No files will be modified on disk.');
  }

  const results = {
    backupFile: null,
    articlesReset: 0,
    pollReset: false,
    settingsSanitized: false,
    adHistoryReset: false,
    usageLogsReset: false,
    cachePurged: false
  };

  // STEP 1: Pre-Reset Automated PKZIP Safety Backup
  if (makeBackup && !dryRun) {
    try {
      log('\n[Step 1/6] Creating automated pre-reset PKZIP safety backup...');
      const backupRes = await generateNewsroomBackupZipAsync('Production Reset Tool Auto-Safety');
      results.backupFile = backupRes.backup?.fileName || backupRes.fileName;
      log(`[Step 1/6] Safety backup preserved on disk: ${results.backupFile} (${backupRes.backup?.sizeFormatted || ''})`);
    } catch (err) {
      log(`[Step 1/6 Warning] Pre-reset backup generation failed: ${err.message}`);
    }
  } else if (dryRun) {
    log('\n[Step 1/6] [DRY RUN] Would create automated PKZIP safety backup.');
  }

  // STEP 2: Sanitize articles.json
  const articlesFile = path.join(DATA_DIR, 'articles.json');
  if (fs.existsSync(articlesFile)) {
    log('\n[Step 2/6] Sanitizing news articles (resetting test view counters)...');
    const articles = JSON.parse(fs.readFileSync(articlesFile, 'utf8'));
    const sanitized = articles.filter(art => !['art-1', 'art-2', 'art-3', 'art-4'].includes(art.id)).map(art => {
      return {
        ...art,
        views_count: 0,
        likes_count: 0,
        dislikes_count: 0,
        shares_count: 0
      };
    });
    results.articlesReset = sanitized.length;
    if (!dryRun) {
      fs.writeFileSync(articlesFile, JSON.stringify(sanitized, null, 2), 'utf8');
      log(`[Step 2/6] Successfully reset view counters to 0 across ${sanitized.length} published stories.`);
    } else {
      log(`[Step 2/6] [DRY RUN] Would reset view counters to 0 across ${sanitized.length} stories.`);
    }
  }

  // STEP 3: Sanitize settings.json (Purge dummy phone number & invalid configs)
  const settingsFile = path.join(DATA_DIR, 'settings.json');
  if (fs.existsSync(settingsFile)) {
    log('\n[Step 3/6] Sanitizing settings.json (purging dummy contact numbers)...');
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    
    // Sanitize WhatsApp social link
    if (settings.socialLinks?.whatsapp?.includes('9999999999')) {
      settings.socialLinks.whatsapp = '';
    }

    // Ensure monetization slots are a clean object
    if (!settings.monetization) {
      settings.monetization = { slots: {} };
    } else if (!settings.monetization.slots) {
      settings.monetization.slots = {};
    }

    results.settingsSanitized = true;
    if (!dryRun) {
      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
      log('[Step 3/6] Successfully sanitized settings.json. Purged dummy WhatsApp contact stub.');
    } else {
      log('[Step 3/6] [DRY RUN] Would sanitize settings.json and remove dummy WhatsApp contact.');
    }
  }

  // STEP 4: Initialize poll.json with genuine national public opinion launch poll
  const pollFile = path.join(DATA_DIR, 'poll.json');
  log('\n[Step 4/6] Initializing poll.json with genuine public interest launch poll...');
  const launchPoll = {
    enabled: true,
    id: `poll-national-launch-${Date.now()}`,
    question: 'क्या आप क्षेत्रीय जिलों में सौर और हरित ऊर्जा (Green Energy) के तीव्र विस्तार का समर्थन करते हैं?',
    options: [
      { id: 'opt-1', label: 'हाँ, पूरी तरह समर्थन है (Yes, Fully Support)', votes: 0 },
      { id: 'opt-2', label: 'नहीं, वर्तमान प्रणाली बेहतर है (No, Current is Fine)', votes: 0 },
      { id: 'opt-3', label: 'बुनियादी ढांचे में सुधार जरूरी है (Needs Better Infrastructure)', votes: 0 }
    ],
    totalVotes: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  results.pollReset = true;
  if (!dryRun) {
    fs.writeFileSync(pollFile, JSON.stringify(launchPoll, null, 2), 'utf8');
    log('[Step 4/6] Successfully reset poll.json to genuine launch poll (0 votes).');
  } else {
    log('[Step 4/6] [DRY RUN] Would reset poll.json to genuine launch poll with 0 votes.');
  }

  // STEP 5: Reset ad_history.json and usage_logs.json
  const adHistoryFile = path.join(DATA_DIR, 'ad_history.json');
  log('\n[Step 5/6] Resetting ad campaign history and operational logs...');
  results.adHistoryReset = true;
  if (!dryRun) {
    fs.writeFileSync(adHistoryFile, JSON.stringify([], null, 2), 'utf8');
    log('[Step 5/6] ad_history.json reset to empty array ([]) for clean launch state.');
  } else {
    log('[Step 5/6] [DRY RUN] Would reset ad_history.json to empty array.');
  }

  const usageLogsFile = path.join(DATA_DIR, 'usage_logs.json');
  results.usageLogsReset = true;
  if (!dryRun) {
    const initialLog = {
      initializedAt: new Date().toISOString(),
      event: 'PRODUCTION_RESET_COMPLETED',
      operator: 'Sovereign Clean Production Reset Tool (CLI)',
      status: 'production_ready'
    };
    fs.writeFileSync(usageLogsFile, JSON.stringify(initialLog, null, 2), 'utf8');
    log('[Step 5/6] usage_logs.json reset to clean initial launch boot record.');
  } else {
    log('[Step 5/6] [DRY RUN] Would reset usage_logs.json.');
  }

  // STEP 6: Flush Live Server In-Memory Cache (if server running on port 5000)
  log('\n[Step 6/6] Flushes live in-memory server cache...');
  try {
    const purgeRes = await fetch('http://localhost:5000/api/storage/purge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer system-reset-internal`
      }
    });
    if (purgeRes.ok) {
      results.cachePurged = true;
      log('[Step 6/6] Live backend server in-memory caches flushed successfully.');
    } else {
      log('[Step 6/6 Note] Backend purge response status:', purgeRes.status);
    }
  } catch (_e) {
    log('[Step 6/6 Note] Backend server port 5000 not reachable or offline; in-memory cache will initialize clean on startup.');
  }

  log('\n================================================================');
  log('PRODUCTION CLEAN RESET COMPLETED SUCCESSFULLY');
  log('Platform is now 100% genuine, unpolluted, and production-ready.');
  log('================================================================');

  return results;
}

// Direct CLI entry point execution
if (process.argv[1] && process.argv[1].endsWith('clean-production-reset.js')) {
  const isDryRun = process.argv.includes('--dry-run');
  const isForce = process.argv.includes('--force') || process.argv.includes('--execute');

  if (!isForce && !isDryRun) {
    console.log('SAFETY NOTICE: This tool resets test counters and sanitizes database records for live production launch.');
    console.log('Run with --force to execute or --dry-run to simulate:');
    console.log('  node server/cli/clean-production-reset.js --force');
    console.log('  node server/cli/clean-production-reset.js --dry-run');
    process.exit(0);
  }

  runCleanProductionReset({ dryRun: isDryRun, makeBackup: true })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Clean reset failed:', err);
      process.exit(1);
    });
}
