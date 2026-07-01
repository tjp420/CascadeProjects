/**
 * Email Retry Worker
 * Polls the email_queue table for pending emails with fewer than 3 attempts
 * and retries them via Resend or SMTP.
 *
 * Usage:
 *   node scripts/email-retry-worker.cjs          # one-shot run
 *   node scripts/email-retry-worker.cjs --daemon # run every 5 minutes
 */

const path = require('path');

// Resolve project root so this script works from any cwd
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Bootstrap: ensure DB + email service are loaded from the right paths
const db = require(path.join(PROJECT_ROOT, 'lib', 'db.cjs'));
const { sendEmail } = require(path.join(PROJECT_ROOT, 'services', 'email.cjs'));

const logger = {
    info: (...a) => console.log('[EmailRetryWorker]', ...a),
    error: (...a) => console.error('[EmailRetryWorker]', ...a),
    warn: (...a) => console.warn('[EmailRetryWorker]', ...a)
};

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 3;

async function processPendingEmails() {
    const pending = db.getEmailsForRetry(MAX_ATTEMPTS);
    if (!pending || pending.length === 0) {
        logger.info('No pending emails to retry.');
        return { processed: 0, sent: 0, failed: 0 };
    }

    logger.info(`Found ${pending.length} pending email(s) to retry.`);
    let sentCount = 0;
    let failedCount = 0;

    for (const email of pending) {
        try {
            db.incrementEmailAttempts(email.id);
            const result = await sendEmail({
                to: email.recipient,
                subject: email.subject,
                text: email.body_text,
                html: email.body_html,
                queueId: email.id
            });

            if (result.sent) {
                sentCount++;
                logger.info(`Sent ${email.id} via ${result.provider}`);
            } else if (result.queued) {
                // Still pending after retry — will be picked up next cycle if attempts < MAX
                logger.warn(`Retry ${email.id} failed again. attempts=${email.attempts + 1}`);
                if ((email.attempts + 1) >= MAX_ATTEMPTS) {
                    db.updateEmailStatus(email.id, 'failed', result.error || 'Max retries exceeded');
                    failedCount++;
                    logger.error(`Email ${email.id} permanently failed after ${MAX_ATTEMPTS} attempts.`);
                }
            } else {
                db.updateEmailStatus(email.id, 'failed', result.error || 'Unknown error');
                failedCount++;
                logger.error(`Email ${email.id} failed:`, result.error);
            }
        } catch (err) {
            failedCount++;
            db.updateEmailStatus(email.id, 'failed', err.message);
            logger.error(`Unexpected error processing ${email.id}:`, err.message);
        }
    }

    logger.info(`Retry cycle complete. processed=${pending.length}, sent=${sentCount}, failed=${failedCount}`);
    return { processed: pending.length, sent: sentCount, failed: failedCount };
}

async function main() {
    logger.info('Email Retry Worker started.');
    await processPendingEmails();

    if (process.argv.includes('--daemon')) {
        logger.info(`Daemon mode: polling every ${POLL_INTERVAL_MS / 1000}s`);
        setInterval(async () => {
            try {
                await processPendingEmails();
            } catch (err) {
                logger.error('Daemon cycle error:', err.message);
            }
        }, POLL_INTERVAL_MS);
    } else {
        logger.info('One-shot run complete. Exiting.');
        process.exit(0);
    }
}

if (require.main === module) {
    main().catch((err) => {
        logger.error('Fatal error:', err.message);
        process.exit(1);
    });
}

module.exports = { processPendingEmails };
