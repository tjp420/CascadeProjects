/**
 * Email queue cleanup script.
 *
 * Processes queued emails from disk and attempts delivery via:
 *   1. Resend REST API
 *   2. SMTP via nodemailer
 *
 * Successfully sent emails are removed from the queue.
 * Stale queued emails (older than 7 days) are purged regardless of delivery status.
 *
 * Usage:
 *   node ai-platform/tools/cleanup-email-queue.cjs
 *   node ai-platform/tools/cleanup-email-queue.cjs --dry-run
 *   node ai-platform/tools/cleanup-email-queue.cjs --max-age-days 3
 */

const path = require('path');
const fs = require('fs');

// Resolve project root so we can import the email service
const projectRoot = path.resolve(__dirname, '..');
const { sendEmail, QUEUE_DIR } = require(
  path.join(projectRoot, 'server', 'lib', 'email-service.cjs')
);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const maxAgeArg = args.find((a) => a.startsWith('--max-age-days='));
const MAX_AGE_DAYS = maxAgeArg ? parseInt(maxAgeArg.split('=')[1], 10) : 7;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

function log(...msgs) {
  console.log('[Cleanup]', ...msgs);
}

function listQueueFiles() {
  if (!fs.existsSync(QUEUE_DIR)) return [];
  return fs
    .readdirSync(QUEUE_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(QUEUE_DIR, name));
}

function parseQueueFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { _parseError: err.message };
  }
}

function isStale(queuedAt) {
  if (!queuedAt) return false;
  const age = Date.now() - new Date(queuedAt).getTime();
  return age > MAX_AGE_MS;
}

async function processQueue() {
  const files = listQueueFiles();
  if (files.length === 0) {
    log('Queue directory empty — nothing to process.');
    return { processed: 0, sent: 0, failed: 0, purged: 0 };
  }

  log(`Found ${files.length} queued email(s)`); // simplebeacon-ignore pii-logging — queue processing status, count only no user data

  let sentCount = 0;
  let failCount = 0;
  let purgeCount = 0;

  for (const filePath of files) {
    const payload = parseQueueFile(filePath);
    if (payload._parseError) {
      log('Skipping corrupt file:', path.basename(filePath), '-', payload._parseError);
      if (!dryRun) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
      }
      purgeCount++;
      continue;
    }

    const id = payload.id || path.basename(filePath, '.json');
    const to = payload.to;
    const subject = payload.subject;

    if (!to || !subject) {
      log('Skipping incomplete payload:', id);
      if (!dryRun) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
      }
      purgeCount++;
      continue;
    }

    if (isStale(payload.queuedAt)) {
      log('Purging stale queue item');
      if (!dryRun) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
      }
      purgeCount++;
      continue;
    }

    if (dryRun) {
      log('[DRY-RUN] Would attempt to send:', id, '→', to);
      continue;
    }

    try {
      const result = await sendEmail({
        to,
        subject,
        text: payload.text || '',
        html: payload.html || undefined,
        attachments: (payload.attachments || []).map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      });

      if (result.sent) {
        log('Sent and removed from queue:', id, '→', to);
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
        sentCount++;
      } else if (result.queued) {
        log('Re-queued to disk (no live transport):', id, '→', to);
        failCount++;
      } else {
        log('Failed to send:', id, '→', to, '-', result.error || 'unknown error');
        failCount++;
      }
    } catch (err) {
      log('Exception sending:', id, '→', to, '-', err.message);
      failCount++;
    }
  }

  return { processed: files.length, sent: sentCount, failed: failCount, purged: purgeCount };
}

(async () => {
  log('Starting queue cleanup...');
  log('Queue directory:', QUEUE_DIR);
  log('Max age threshold:', MAX_AGE_DAYS, 'days');
  if (dryRun) log('DRY-RUN mode — no files will be deleted or sent.');

  const stats = await processQueue();

  log('Cleanup complete.');
  log(`  Total processed: ${stats.processed}`);
  log(`  Successfully sent: ${stats.sent}`);
  log(`  Delivery failed:   ${stats.failed}`);
  log(`  Purged (stale/bad): ${stats.purged}`);
})();
