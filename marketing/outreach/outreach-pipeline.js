#!/usr/bin/env node
'use strict';

/**
 * Automated Email Outreach Pipeline — Sequences prospects through the
 * 12-email B2B campaign targeting Chief Legal Officers, Chief Compliance
 * Officers, and Chief Risk Officers.
 *
 * Sequences (from eu-ai-act-compliance-playbook.md):
 *   Sequence A (CLO): 4 emails — Day 1, 4, 8, 15
 *   Sequence B (CCO): 3 emails — Day 1, 5, 10
 *   Sequence C (CRO): 2 emails — Day 1, 5
 *   + 3 reactivation emails — Day 30, 60, 90 (all personas)
 *
 * Email sending is via SMTP (nodemailer) or API (Resend, SendGrid).
 * Campaign state is persisted in a JSON file for tracking.
 *
 * Usage:
 *   node outreach-pipeline.js --prospects ./prospects.json --send
 *   node outreach-pipeline.js --prospects ./prospects.json --dry-run
 *   node outreach-pipeline.js --status
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Email Sequence Definitions ──────────────────────────────────────────────

const SEQUENCES = {
  A: {
    persona: 'CLO',
    name: 'Chief Legal Officer — Regulatory Penalty Focus',
    emails: [
      {
        step: 1,
        dayOffset: 0,
        subject: 'EUR 35M or 7% of turnover — is {{company}} exposed?',
        template: 'clo-email-1-penalty-hook',
        trigger: 'initial',
      },
      {
        step: 2,
        dayOffset: 4,
        subject: 'The question your auditor will ask about AI-generated code',
        template: 'clo-email-2-evidence-gap',
        trigger: 'no-reply',
      },
      {
        step: 3,
        dayOffset: 8,
        subject: 'Board-ready AI risk report — 30-second demo',
        template: 'clo-email-3-board-memo',
        trigger: 'no-reply',
      },
      {
        step: 4,
        dayOffset: 15,
        subject: 'Closing the loop on EU AI Act readiness',
        template: 'clo-email-4-breakup',
        trigger: 'no-reply',
      },
    ],
  },
  B: {
    persona: 'CCO',
    name: 'Chief Compliance Officer — Audit Readiness Focus',
    emails: [
      {
        step: 1,
        dayOffset: 0,
        subject: 'AI-generated code audit trail — can you produce one in 24 hours?',
        template: 'cco-email-1-audit-trail',
        trigger: 'initial',
      },
      {
        step: 2,
        dayOffset: 5,
        subject: 'ISO 42001 (AI Management System) — your evidence gap',
        template: 'cco-email-2-iso-42001',
        trigger: 'no-reply',
      },
      {
        step: 3,
        dayOffset: 10,
        subject: 'How a fintech compliance team cut audit prep from 6 weeks to 2 days',
        template: 'cco-email-3-peer-proof',
        trigger: 'no-reply',
      },
    ],
  },
  C: {
    persona: 'CRO',
    name: 'Chief Risk Officer — Operational Risk Focus',
    emails: [
      {
        step: 1,
        dayOffset: 0,
        subject: 'Quantifying AI-generated code risk in your production systems',
        template: 'cro-email-1-risk-quant',
        trigger: 'initial',
      },
      {
        step: 2,
        dayOffset: 5,
        subject: 'AI code risk and your cyber insurance underwriting',
        template: 'cro-email-2-insurance',
        trigger: 'no-reply',
      },
    ],
  },
  REACTIVATION: {
    persona: 'ALL',
    name: 'Reactivation Sequence — Deadline Urgency',
    emails: [
      {
        step: 1,
        dayOffset: 30,
        subject: 'August 2026: Is your AI governance evidence ready?',
        template: 'reactivate-email-1-deadline',
        trigger: 'no-reply-after-sequence',
      },
      {
        step: 2,
        dayOffset: 60,
        subject: 'EU AI Act enforcement countdown — 5 months remaining',
        template: 'reactivate-email-2-countdown',
        trigger: 'no-reply',
      },
      {
        step: 3,
        dayOffset: 90,
        subject: 'Final check-in: AI compliance readiness assessment',
        template: 'reactivate-email-3-final',
        trigger: 'no-reply',
      },
    ],
  },
};

// ── Template Renderer ───────────────────────────────────────────────────────

const TEMPLATE_VARIABLES = {
  '{{first_name}}': (p) => p.firstName || 'there',
  '{{company}}': (p) => p.company,
  '{{sender_name}}': () => process.env.SENDER_NAME || 'SimpleBeacon Team',
  '{{sender_title}}': () => process.env.SENDER_TITLE || 'Founder, SimpleBeacon',
  '{{date}}': () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  },
  '{{day_of_week}}': () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  },
  '{{calendly_url}}': () => process.env.CALENDLY_URL || 'https://calendly.com/simplebeacon/30min',
};

function renderTemplate(text, prospect) {
  let rendered = text;
  for (const [key, fn] of Object.entries(TEMPLATE_VARIABLES)) {
    rendered = rendered.replaceAll(key, fn(prospect));
  }
  return rendered;
}

// ── Campaign State Management ───────────────────────────────────────────────

const DEFAULT_CAMPAIGN_PATH = path.join(
  process.cwd(),
  'marketing',
  'outreach',
  'campaign-state.json'
);

function loadCampaignState(statePath) {
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prospects: {},
      stats: {
        totalContacted: 0,
        totalReplies: 0,
        totalMeetings: 0,
        totalPilots: 0,
        totalClosed: 0,
      },
    };
  }
}

function saveCampaignState(state, statePath) {
  state.updatedAt = new Date().toISOString();
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = statePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, statePath);
}

/**
 * Determine which email (if any) should be sent to a prospect today.
 */
function getNextEmail(prospect, prospectState) {
  const sequenceKey = prospectState.sequence || getSequenceForPersona(prospect.persona);
  const sequence = SEQUENCES[sequenceKey];
  if (!sequence) return null;

  const currentStep = prospectState.currentStep || 0;
  if (currentStep >= sequence.emails.length) {
    // Check reactivation sequence
    const reactivationStep = prospectState.reactivationStep || 0;
    if (reactivationStep < SEQUENCES.REACTIVATION.emails.length) {
      const reactivationEmail = SEQUENCES.REACTIVATION.emails[reactivationStep];
      const lastEmailDate = prospectState.lastEmailDate || prospectState.sequenceCompleteDate;
      if (!lastEmailDate) return null;
      const daysSinceLast = Math.floor(
        (Date.now() - new Date(lastEmailDate).getTime()) / (24 * 60 * 60 * 1000)
      );
      if (daysSinceLast >= reactivationEmail.dayOffset) {
        return {
          sequence: 'REACTIVATION',
          step: reactivationStep + 1,
          email: reactivationEmail,
          isReactivation: true,
        };
      }
    }
    return null;
  }

  const email = sequence.emails[currentStep];
  const firstEmailDate = prospectState.firstEmailDate;
  if (!firstEmailDate) {
    // First email
    if (email.trigger === 'initial') {
      return { sequence: sequenceKey, step: 1, email, isReactivation: false };
    }
    return null;
  }

  const daysSinceFirst = Math.floor(
    (Date.now() - new Date(firstEmailDate).getTime()) / (24 * 60 * 60 * 1000)
  );
  if (daysSinceFirst >= email.dayOffset && !prospectState.replied) {
    return { sequence: sequenceKey, step: currentStep + 1, email, isReactivation: false };
  }

  return null;
}

function getSequenceForPersona(persona) {
  const map = { CLO: 'A', CCO: 'B', CRO: 'C' };
  return map[persona] || 'A';
}

/**
 * Process a single prospect — determine if an email should be sent today.
 */
function processProspect(prospect, campaignState, options = {}) {
  const prospectState = campaignState.prospects[prospect.id] || {
    status: 'pending',
    sequence: getSequenceForPersona(prospect.persona),
    currentStep: 0,
    firstEmailDate: null,
    lastEmailDate: null,
    replied: false,
    repliedAt: null,
    meetingBooked: false,
    meetingDate: null,
    pilotStarted: false,
    pilotDate: null,
    closed: false,
    closedDate: null,
    closedValue: 0,
    reactivationStep: 0,
    sequenceCompleteDate: null,
    emailHistory: [],
  };

  if (prospectState.replied || prospectState.closed) {
    return { action: 'skip', reason: 'already_replied_or_closed', prospectState };
  }

  const nextEmail = getNextEmail(prospect, prospectState);
  if (!nextEmail) {
    return { action: 'wait', reason: 'no_email_due', prospectState };
  }

  const subject = renderTemplate(nextEmail.email.subject, prospect);
  const emailPayload = {
    to: prospect.email,
    subject,
    template: nextEmail.email.template,
    prospect,
    sequence: nextEmail.sequence,
    step: nextEmail.step,
    isReactivation: nextEmail.isReactivation,
  };

  if (options.dryRun) {
    return { action: 'dry-run', emailPayload, prospectState };
  }

  // Update state
  const now = new Date().toISOString();
  if (!prospectState.firstEmailDate) {
    prospectState.firstEmailDate = now;
  }
  prospectState.lastEmailDate = now;
  prospectState.currentStep = nextEmail.step;
  prospectState.emailHistory.push({
    sequence: nextEmail.sequence,
    step: nextEmail.step,
    template: nextEmail.email.template,
    subject,
    sentAt: now,
  });

  // Check if sequence is complete
  const sequence = SEQUENCES[nextEmail.sequence];
  if (nextEmail.step >= sequence.emails.length && !nextEmail.isReactivation) {
    prospectState.sequenceCompleteDate = now;
  }
  if (nextEmail.isReactivation) {
    prospectState.reactivationStep = nextEmail.step;
  }

  prospectState.status = 'contacted';
  campaignState.prospects[prospect.id] = prospectState;
  campaignState.stats.totalContacted++;

  return { action: 'send', emailPayload, prospectState };
}

// ── SMTP Sending (nodemailer — optional dependency) ─────────────────────────

async function sendEmail(emailPayload) {
  // Try to use nodemailer if available
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    console.log('[outreach-pipeline] nodemailer not installed — email would be sent:');
    console.log(`  To: ${emailPayload.to}`);
    console.log(`  Subject: ${emailPayload.subject}`);
    console.log(`  Template: ${emailPayload.template}`);
    return { success: true, simulated: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const templatePath = path.join(__dirname, 'templates', `${emailPayload.template}.txt`);
  let body;
  try {
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    body = renderTemplate(templateContent, emailPayload.prospect);
  } catch {
    body = renderTemplate(
      `Dear {{first_name}},\n\n[Email body for ${emailPayload.template}]\n\nBest regards,\n{{sender_name}}\n{{sender_title}}\nSimpleBeacon.ai`,
      emailPayload.prospect
    );
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || 'SimpleBeacon <outreach@simplebeacon.ai>',
    to: emailPayload.to,
    subject: emailPayload.subject,
    text: body,
  });

  return { success: true, messageId: info.messageId, simulated: false };
}

// ── Campaign Analytics ──────────────────────────────────────────────────────

function getCampaignAnalytics(campaignState) {
  const prospects = Object.entries(campaignState.prospects);
  const total = prospects.length;
  const contacted = prospects.filter(([, s]) => s.status === 'contacted').length;
  const replied = prospects.filter(([, s]) => s.replied).length;
  const meetings = prospects.filter(([, s]) => s.meetingBooked).length;
  const pilots = prospects.filter(([, s]) => s.pilotStarted).length;
  const closed = prospects.filter(([, s]) => s.closed).length;
  const totalValue = prospects
    .filter(([, s]) => s.closed)
    .reduce((sum, [, s]) => sum + (s.closedValue || 0), 0);

  const replyRate = contacted > 0 ? ((replied / contacted) * 100).toFixed(1) : '0.0';
  const meetingRate = contacted > 0 ? ((meetings / contacted) * 100).toFixed(1) : '0.0';
  const pilotRate = meetings > 0 ? ((pilots / meetings) * 100).toFixed(1) : '0.0';
  const closeRate = pilots > 0 ? ((closed / pilots) * 100).toFixed(1) : '0.0';

  const bySequence = {};
  for (const [id, s] of prospects) {
    const seq = s.sequence || 'unknown';
    if (!bySequence[seq]) {
      bySequence[seq] = { total: 0, contacted: 0, replied: 0, meetings: 0, pilots: 0, closed: 0 };
    }
    bySequence[seq].total++;
    if (s.status === 'contacted') bySequence[seq].contacted++;
    if (s.replied) bySequence[seq].replied++;
    if (s.meetingBooked) bySequence[seq].meetings++;
    if (s.pilotStarted) bySequence[seq].pilots++;
    if (s.closed) bySequence[seq].closed++;
  }

  return {
    total,
    contacted,
    replied,
    meetings,
    pilots,
    closed,
    totalContractValue: totalValue,
    replyRate: `${replyRate}%`,
    meetingRate: `${meetingRate}%`,
    pilotRate: `${pilotRate}%`,
    closeRate: `${closeRate}%`,
    bySequence,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = value;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const statePath = args.state || DEFAULT_CAMPAIGN_PATH;
  const campaignState = loadCampaignState(statePath);

  if (args.status) {
    const analytics = getCampaignAnalytics(campaignState);
    console.log('\n=== Campaign Analytics ===\n');
    console.log(`Total prospects: ${analytics.total}`);
    console.log(`Contacted: ${analytics.contacted}`);
    console.log(`Replied: ${analytics.replied} (${analytics.replyRate} reply rate)`);
    console.log(`Meetings: ${analytics.meetings} (${analytics.meetingRate} meeting rate)`);
    console.log(`Pilots: ${analytics.pilots} (${analytics.pilotRate} pilot conversion)`);
    console.log(`Closed: ${analytics.closed} (${analytics.closeRate} close rate)`);
    console.log(`Total contract value: $${analytics.totalContractValue.toLocaleString()}`);
    console.log('\nBy sequence:');
    for (const [seq, stats] of Object.entries(analytics.bySequence)) {
      console.log(
        `  ${seq}: ${stats.total} prospects, ${stats.contacted} contacted, ${stats.replied} replied, ${stats.closed} closed`
      );
    }
    return;
  }

  if (!args.prospects) {
    console.log(`
Usage:
  node outreach-pipeline.js --prospects <prospects.json> [--send] [--dry-run]
  node outreach-pipeline.js --status [--state <state-file>]

Options:
  --prospects <file>    Path to prospects JSON from prospect-scraper.js
  --send                Actually send emails (requires SMTP env vars)
  --dry-run             Show what would be sent without sending
  --status              Show campaign analytics
  --state <file>        Campaign state file (default: campaign-state.json)

Environment variables for SMTP:
  SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
  SENDER_NAME, SENDER_TITLE, CALENDLY_URL

Sequences:
  A (CLO): 4 emails — Day 1, 4, 8, 15
  B (CCO): 3 emails — Day 1, 5, 10
  C (CRO): 2 emails — Day 1, 5
  Reactivation: 3 emails — Day 30, 60, 90 (post-sequence)
`);
    return;
  }

  const prospectsData = JSON.parse(fs.readFileSync(args.prospects, 'utf8'));
  const prospects = prospectsData.prospects || [];
  console.log(`[outreach-pipeline] Loaded ${prospects.length} prospects`);

  let sent = 0;
  let skipped = 0;
  let waiting = 0;
  const shouldSend = args.send && !args.dryRun;

  for (const prospect of prospects) {
    if (prospect.status === 'disqualified') {
      skipped++;
      continue;
    }

    const result = processProspect(prospect, campaignState, { dryRun: !shouldSend });

    if (result.action === 'send' || result.action === 'dry-run') {
      if (!shouldSend) {
        console.log(
          `[dry-run] ${prospect.email} — "${result.emailPayload.subject}" (seq ${result.emailPayload.sequence}, step ${result.emailPayload.step})`
        );
        sent++;
      } else {
        try {
          const sendResult = await sendEmail(result.emailPayload);
          if (sendResult.success) {
            console.log(
              `[sent] ${prospect.email} — "${result.emailPayload.subject}"${sendResult.simulated ? ' (simulated)' : ''}`
            );
            sent++;
          }
        } catch (err) {
          console.error(`[error] Failed to send to ${prospect.email}: ${err.message}`);
        }
      }
    } else if (result.action === 'wait') {
      waiting++;
    } else {
      skipped++;
    }
  }

  if (shouldSend) {
    saveCampaignState(campaignState, statePath);
    console.log(`[outreach-pipeline] State saved to ${statePath}`);
  }

  console.log(`\n[outreach-pipeline] Done: ${sent} sent, ${waiting} waiting, ${skipped} skipped`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[outreach-pipeline] Error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  SEQUENCES,
  TEMPLATE_VARIABLES,
  renderTemplate,
  loadCampaignState,
  saveCampaignState,
  getNextEmail,
  getSequenceForPersona,
  processProspect,
  sendEmail,
  getCampaignAnalytics,
};
