/**
 * PublicSpark Newsroom - 5-Day Automated Google Drive Backup Script
 * Zero Gmail emails sent. Creates a single outer zip ("PublicSpark_5Day_Backup.zip")
 * containing 2 files:
 *   1. 1_backup_summary.txt
 *   2. 2_database_backup.zip (all D1 JSON datasets)
 * Overwrites the previous backup file in Google Drive so storage stays clean.
 *
 * Setup (2 minutes, Zero Credit Card):
 *   1. Open https://script.google.com -> New Project.
 *   2. Paste this entire file and fill BACKUP_API_URL & CRON_BACKUP_SECRET below.
 *   3. (Recommended for overwrite without Trash) Left sidebar -> Services (+) -> Add "Drive API".
 *   4. Run testBackupNow() once to grant Drive permission.
 *   5. Left sidebar -> Triggers (Clock icon) -> Add Trigger:
 *      - Function: runFiveDayBackup
 *      - Event source: Time-driven
 *      - Type: Day timer (runs daily, script enforces strict 5-day cooldown via PropertiesService)
 */

const CONFIG = {
  BACKUP_API_URL: 'https://pintu-chachu-news-web.pages.dev/api/cron/export-backup',
  CRON_BACKUP_SECRET: 'PASTE_YOUR_CRON_BACKUP_SECRET_HERE',
  DRIVE_FOLDER_NAME: 'PublicSpark_Backups',
  OUTER_ZIP_NAME: 'PublicSpark_5Day_Backup.zip',
  DAYS_INTERVAL: 5
};

function runFiveDayBackup() {
  const props = PropertiesService.getScriptProperties();
  const lastRunMs = Number(props.getProperty('LAST_DRIVE_BACKUP_MS') || '0');
  const fiveDaysMs = CONFIG.DAYS_INTERVAL * 24 * 60 * 60 * 1000;
  // Allow 1-hour tolerance so scheduled daily trigger never skips day 5
  if (lastRunMs > 0 && Date.now() - lastRunMs < fiveDaysMs - 60 * 60 * 1000) {
    Logger.log('Skipping backup: 5-day interval not yet reached.');
    return;
  }
  executeDriveBackup();
  props.setProperty('LAST_DRIVE_BACKUP_MS', String(Date.now()));
}

function testBackupNow() {
  executeDriveBackup();
  PropertiesService.getScriptProperties().setProperty('LAST_DRIVE_BACKUP_MS', String(Date.now()));
}

function executeDriveBackup() {
  const res = UrlFetchApp.fetch(CONFIG.BACKUP_API_URL, {
    method: 'get',
    headers: { 'x-cron-secret': CONFIG.CRON_BACKUP_SECRET },
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    throw new Error('Backup API failed (' + res.getResponseCode() + '): ' + res.getContentText());
  }

  const payload = JSON.parse(res.getContentText());
  if (!payload || !payload.success || !payload.datasets) {
    throw new Error('Invalid backup payload received.');
  }

  const s = payload.summary || {};
  const istTime = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a IST');

  // File 1: Summary Report
  const summaryLines = [
    'PUBLICSPARK NEWSROOM - 5-DAY DATABASE BACKUP SUMMARY',
    '====================================================',
    'Exported At (IST): ' + istTime,
    'Exported At (UTC): ' + (s.exportedAt || ''),
    'Database Source  : ' + (s.source || 'Cloudflare D1'),
    '',
    'DATASET COUNTS:',
    '- Total Articles        : ' + (s.totalArticles || 0),
    '- Published Articles    : ' + (s.publishedArticles || 0),
    '- Draft Articles        : ' + (s.draftArticles || 0),
    '- Categories            : ' + (s.totalCategories || 0),
    '- Cached Translations   : ' + (s.cachedTranslations || 0),
    '- Staff Accounts        : ' + (s.staffCount || 0),
    '- Confidential Tips     : ' + (s.confidentialTipsCount || 0),
    '- Grievances            : ' + (s.grievancesCount || 0),
    '',
    'ARCHIVE STRUCTURE:',
    '- Inside PublicSpark_5Day_Backup.zip:',
    '  1) 1_backup_summary.txt',
    '  2) 2_database_backup.zip (all JSON tables)'
  ];
  const summaryBlob = Utilities.newBlob(summaryLines.join('\n'), 'text/plain', '1_backup_summary.txt');

  // File 2: Inner Zip containing all JSON datasets
  const jsonBlobs = Object.keys(payload.datasets).map(function (key) {
    return Utilities.newBlob(JSON.stringify(payload.datasets[key], null, 2), 'application/json', key + '.json');
  });
  const innerZipBlob = Utilities.zip(jsonBlobs, '2_database_backup.zip');

  // Single Outer Zip containing exact 2 files (1_backup_summary.txt + 2_database_backup.zip)
  const outerZipBlob = Utilities.zip([summaryBlob, innerZipBlob], CONFIG.OUTER_ZIP_NAME);

  // Save or Replace in Google Drive Folder (Zero Gmail sent)
  const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);

  const existing = folder.getFilesByName(CONFIG.OUTER_ZIP_NAME);
  if (existing.hasNext()) {
    const oldFile = existing.next();
    try {
      if (typeof Drive !== 'undefined' && Drive.Files && typeof Drive.Files.update === 'function') {
        Drive.Files.update({}, oldFile.getId(), outerZipBlob);
        Logger.log('Replaced existing Google Drive backup in-place: ' + oldFile.getId());
        return;
      }
    } catch (driveErr) {
      Logger.log('Drive.Files.update fallback to Trash + Create: ' + driveErr.message);
    }
    oldFile.setTrashed(true);
    while (existing.hasNext()) existing.next().setTrashed(true);
  }

  const created = folder.createFile(outerZipBlob);
  Logger.log('Created Google Drive backup: ' + created.getId());
}
