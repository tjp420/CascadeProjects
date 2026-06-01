import { escapeHtml, showToast } from '../utils.js';
import { fetchOutreachConfig, fetchOutreachSent, sendOutreachEmail } from '../services/outreachService.js?v=20260601outreachv2';
import { OUTREACH_PROSPECTS, firstReadyProspectId } from '../data/outreach-prospects.js?v=20260601outreachv2';

const OUTREACH_APP_URL = 'http://localhost:54355/app#/outreach';

const TEMPLATES = [
  {
    id: 'email-1',
    label: 'Email 1 — enterprise guardrails (general)',
    subject: 'Catching data leaks and runaway LLM token spend before merge',
    body: (p) => `Hi ${p.contactName},

${p.personalization || 'Teams using Cursor/Copilot often ship strings that still contain internal IDs, customer tokens, or unbounded LLM calls — issues CVE scanners and Snyk do not scope.'}

Simplebeacon is a read-only local gate: SB-ENT-001 flags corporate identifiers in source strings; SB-ENT-002 flags LLM calls without max_tokens. Runs offline in CI — no repo upload.

I'm offering a complimentary scan on one repo (~15 min on my side). You get a short summary: what blocks, what's noise, and what to fix first.

Open to a 15-minute walkthrough this week?

Best,
Trevor
Founder, Simplebeacon
trevor@simplebeacon.ai · simplebeacon.ai`
  },
  {
    id: 'email-2',
    label: 'Email 2 — Shopify / multi-client',
    subject: 'Mock JSON and fixture drift across client Shopify repos',
    body: (p) => `Hi ${p.contactName},

${p.personalization || 'Agencies juggling multiple merchant rebuilds see theme and app code reference fixture paths that dependency scans miss — then surface in client security reviews.'}

Simplebeacon adds an enterprise guardrail layer: leak tokens in strings, token caps on LLM SDK calls, optional structural-intent checks — all local, CI-friendly.

Complimentary read-only scan on one repo + 15-min debrief. Worth a quick call?

Best,
Trevor
Founder, Simplebeacon
trevor@simplebeacon.ai · simplebeacon.ai`
  },
  {
    id: 'email-3',
    label: 'Email 3 — Rails / vendor diligence',
    subject: 'Vendor diligence gap after Snyk is green',
    body: (p) => `Hi ${p.contactName},

${p.personalization || 'Security questionnaires for enterprise buyers increasingly ask about AI-assisted development — not just whether you run Snyk.'}

Simplebeacon produces an audit-friendly summary: credential patterns, leak tokens bound for LLM context, LLM calls without token budgets. Complements your existing stack — runs on the client runner.

Happy to run a complimentary scan on one repo if useful for your next diligence cycle.

Best,
Trevor
Founder, Simplebeacon
trevor@simplebeacon.ai · simplebeacon.ai`
  },
  {
    id: 'email-4',
    label: 'Email 4 — compliance / evidence pack',
    subject: 'Evidence that mock data never reached production paths',
    body: (p) => `Hi ${p.contactName},

${p.personalization || 'Agencies with compliance-minded clients need evidence that fixtures and sample JSON never leaked into production paths.'}

Simplebeacon runs a deterministic gate before handoff — credentials, leak tokens, production-path references. PDF-ready summary on paid audits; community CLI is free for CI.

Worth a quick call before your next client walkthrough?

Best,
Trevor
Founder, Simplebeacon
trevor@simplebeacon.ai · simplebeacon.ai`
  },
  {
    id: 'email-5',
    label: 'Email 5 — upmarket / security questionnaire',
    subject: 'Pre-handoff scan before the security questionnaire lands',
    body: (p) => `Hi ${p.contactName},

${p.personalization || 'Startups moving toward enterprise deals hit questionnaires about AI development practices and token spend controls.'}

We scan for proprietary strings in code and unbounded LLM API usage before your buyer's review. $499 flat read-only audit + PDF in 48h when you want a signed deliverable.

Open to a 15-min screen share on what we flag?

Best,
Trevor
Founder, Simplebeacon
trevor@simplebeacon.ai · simplebeacon.ai`
  },
  {
    id: 'email-6',
    label: 'Email 6 — AI velocity / full-stack',
    subject: 'Read-only check after AI-assisted velocity',
    body: (p) => `Hi ${p.contactName},

${p.personalization || 'Full-stack agencies using AI-assisted velocity still need a fast pass for leak tokens and unbounded LLM calls before client handoff.'}

Simplebeacon is offline static analysis — enterprise profile, no repo upload. Complements SAST; tuned for what Copilot leaves behind.

Complimentary scan on one repo if you want a second opinion before the next client review.

Best,
Trevor
Founder, Simplebeacon
trevor@simplebeacon.ai · simplebeacon.ai`
  },
  {
    id: 'email-7',
    label: 'Email 7 — SaaS / B2B compliance',
    subject: 'Mock-data and LLM guardrails before the compliance review',
    body: (p) => `Hi ${p.contactName},

${p.personalization || 'SaaS product studios with fintech and B2B clients need hygiene evidence before the next compliance review — beyond dependency scanning.'}

Simplebeacon gates leak tokens in strings, missing max_tokens on LLM SDKs, and credential-like config — locally, in CI.

I can run a complimentary scan on one repo and send a one-page triage summary.

Best,
Trevor
Founder, Simplebeacon
trevor@simplebeacon.ai · simplebeacon.ai`
  },
  {
    id: 'email-8',
    label: 'Email 8 — Node/React vendor diligence',
    subject: 'Vendor diligence after dependency scans pass',
    body: (p) => `Hi ${p.contactName},

${p.personalization || 'Agencies shipping custom Node/React for multiple clients accumulate patterns that surface in vendor diligence — after Snyk is green.'}

Simplebeacon is the hygiene layer SAST does not cover: production-path leaks, fiction KPIs in fixtures, enterprise leak/token-cap rules.

Worth 15 minutes on a complimentary single-repo scan?

Best,
Trevor
Founder, Simplebeacon
trevor@simplebeacon.ai · simplebeacon.ai`
  },
  {
    id: 'email-10',
    label: 'Email 10 — boutique / senior eng',
    subject: 'Second opinion before client security review',
    body: (p) => `Hi ${p.contactName},

${p.personalization || 'Boutique shops with senior-only engineering still pick up AI-assisted patterns — sample paths and leak tokens that automated scanners miss.'}

Simplebeacon runs read-only on your machine: enterprise guardrails + optional structural-intent checks. No legal claims — technical gate only.

Open to a short call and a complimentary scan on one repo?

Best,
Trevor
Founder, Simplebeacon
trevor@simplebeacon.ai · simplebeacon.ai`
  }
];

function templateById(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}

function buildDraftFromProspect(prospectId) {
  const p = OUTREACH_PROSPECTS.find((row) => row.id === prospectId);
  if (!p) return null;
  const tpl = templateById(p.templateId);
  return {
    prospectId: p.id,
    company: p.company,
    to: p.email || '',
    templateId: tpl.id,
    subject: tpl.subject,
    contactUrl: p.contactUrl || '',
    note: p.note || '',
    text: tpl.body({
      contactName: p.contactName,
      personalization: p.personalization || ''
    })
  };
}

function buildDraftFromTemplate(templateId, draft = {}) {
  const tpl = templateById(templateId);
  const contactName = draft.contactName || 'there';
  return {
    ...draft,
    templateId: tpl.id,
    subject: tpl.subject,
    text: tpl.body({ contactName, personalization: draft.personalization || '' })
  };
}

function pipelineStats() {
  const total = OUTREACH_PROSPECTS.length;
  const sent = OUTREACH_PROSPECTS.filter((p) => p.sent).length;
  const ready = OUTREACH_PROSPECTS.filter((p) => !p.sent && p.email).length;
  const needsChannel = OUTREACH_PROSPECTS.filter((p) => !p.sent && !p.email).length;
  return { total, sent, ready, needsChannel };
}

export class OutreachView {
  constructor(app) {
    this.app = app;
    this.config = null;
    this.sent = [];
    this.loading = true;
    this.sending = false;
    this.error = null;
    this._root = null;
    this.draft = {
      prospectId: '',
      templateId: TEMPLATES[0].id,
      to: '',
      company: '',
      subject: '',
      text: '',
      contactUrl: '',
      note: ''
    };
  }

  captureDraftFromDom() {
    const form = this._root?.querySelector('#outreach-compose-form');
    if (!form) return;
    this.draft = {
      prospectId: form.querySelector('[name=prospect]')?.value || '',
      templateId: form.querySelector('[name=template]')?.value || this.draft.templateId,
      to: form.querySelector('[name=to]')?.value || '',
      company: form.querySelector('[name=company]')?.value || '',
      subject: form.querySelector('[name=subject]')?.value || '',
      text: form.querySelector('[name=text]')?.value || '',
      contactUrl: this.draft.contactUrl || '',
      note: this.draft.note || ''
    };
  }

  seedDraftIfEmpty() {
    if (this.draft.to || this.draft.subject || this.draft.prospectId) return;
    const nextId = firstReadyProspectId();
    if (!nextId) return;
    const next = buildDraftFromProspect(nextId);
    if (next) this.draft = { ...this.draft, ...next };
  }

  async load() {
    this.loading = true;
    this.error = null;
    try {
      const [config, sentData] = await Promise.all([
        fetchOutreachConfig(),
        fetchOutreachSent(20)
      ]);
      this.config = config;
      this.sent = sentData.items || [];
      this.seedDraftIfEmpty();
    } catch (err) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }

  renderSetupCollapsible() {
    return `
      <div class="outreach-setup card outreach-sidebar-card">
        <details open>
          <summary>Resend setup (required to send)</summary>
          <ol>
            <li>API key at <a href="https://resend.com/api-keys" target="_blank" rel="noopener">resend.com/api-keys</a></li>
            <li>Verify <code>simplebeacon.ai</code> at resend.com/domains</li>
            <li>Add to <code>.env.v1-internal</code>: <code>RESEND_API_KEY</code>, <code>OUTREACH_FROM</code>, <code>OUTREACH_REPLY_TO</code></li>
            <li>Restart: <code>npm run dashboard:v1-internal</code>, open <a href="${OUTREACH_APP_URL}">${OUTREACH_APP_URL}</a></li>
          </ol>
        </details>
      </div>
    `;
  }

  renderPipelineCard() {
    const { total, sent, ready, needsChannel } = pipelineStats();
    return `
      <div class="card outreach-sidebar-card">
        <div class="card-header">
          <span class="card-title">Pipeline</span>
        </div>
        <p class="outreach-pipeline-stats mb-2">
          <span class="badge badge-success">${sent} sent</span>
          <span class="badge">${ready} ready (email)</span>
          <span class="badge badge-warning">${needsChannel} need form/LI</span>
          <span class="text-muted">· ${total} total</span>
        </p>
        <p class="text-muted mb-0" style="font-size:var(--font-size-xs);">
          Edit rows in <code>js/data/outreach-prospects.js</code> after each send.
        </p>
      </div>
    `;
  }

  renderSidebar() {
    const cfg = this.config || {};
    const ready = cfg.configured;
    return `
      <aside class="outreach-sidebar">
        <div class="card outreach-sidebar-card">
          <div class="card-header">
            <span class="card-title">Sender</span>
            <span class="outreach-status-pill ${ready ? 'ready' : 'pending'}">${ready ? 'Ready' : 'Setup'}</span>
          </div>
          ${this.loading ? '<p class="text-muted mb-0">Loading…</p>' : `
            <p class="outreach-envelope-row" style="grid-template-columns:1fr;margin:0 0 0.5rem;">
              <span class="outreach-envelope-value"><strong>From</strong><br><code>${escapeHtml(cfg.from || '—')}</code></span>
            </p>
            <p class="outreach-envelope-row" style="grid-template-columns:1fr;margin:0;">
              <span class="outreach-envelope-value"><strong>Reply-To</strong><br><code>${escapeHtml(cfg.replyTo || '—')}</code></span>
            </p>
            <p class="text-muted mt-3 mb-0" style="font-size:var(--font-size-xs);">Replies forward to Live.com via Cloudflare routing.</p>
          `}
        </div>
        ${this.renderPipelineCard()}
        ${ready ? '' : this.renderSetupCollapsible()}
        <div class="card outreach-sidebar-card">
          <div class="card-header">
            <span class="card-title">Recent sends</span>
            <button type="button" class="btn btn-ghost btn-sm" id="outreach-reload" style="padding:0.2rem 0.5rem;font-size:var(--font-size-xs);">Refresh</button>
          </div>
          ${this.sent.length ? this.sent.slice(0, 8).map((row) => `
            <div class="outreach-sent-item">
              <div class="outreach-sent-to">${escapeHtml(row.to)}${row.company ? ` · ${escapeHtml(row.company)}` : ''}</div>
              <div class="outreach-sent-subject">${escapeHtml(row.subject)} · ${escapeHtml(new Date(row.sentAt).toLocaleString())}</div>
            </div>
          `).join('') : '<p class="text-muted mb-0" style="font-size:var(--font-size-sm);">No sends logged yet.</p>'}
        </div>
      </aside>
    `;
  }

  renderProspectHint() {
    const d = this.draft;
    if (!d.prospectId) return '';
    const p = OUTREACH_PROSPECTS.find((row) => row.id === d.prospectId);
    if (!p) return '';
    if (p.sent) {
      return `<p class="outreach-prospect-hint text-muted">Marked sent ${escapeHtml(p.sentAt || '')} in pipeline data.</p>`;
    }
    if (!d.to && (d.contactUrl || d.note)) {
      const link = d.contactUrl
        ? `<a href="${escapeHtml(d.contactUrl)}" target="_blank" rel="noopener">${escapeHtml(d.contactUrl)}</a>`
        : escapeHtml(d.note);
      return `<p class="outreach-prospect-hint text-warning">No email on file — use ${link}</p>`;
    }
    return '';
  }

  renderCompose() {
    const d = this.draft;
    const disabled = this.sending || !this.config?.configured;
    const charCount = (d.text || '').length;
    const cfg = this.config || {};

    const prospectOptions = [
      '<option value="">— Pick pipeline row —</option>',
      ...OUTREACH_PROSPECTS.map((p) => {
        const sentMark = p.sent ? ' ✓ sent' : '';
        const channel = p.email ? '' : ` (${p.note || 'no email'})`;
        const label = `#${p.id} ${p.company}${sentMark}${channel}`;
        return `<option value="${p.id}" ${d.prospectId === p.id ? 'selected' : ''}>${escapeHtml(label)}</option>`;
      })
    ].join('');

    const templateOptions = TEMPLATES.map((t) =>
      `<option value="${t.id}" ${d.templateId === t.id ? 'selected' : ''}>${escapeHtml(t.label)}</option>`
    ).join('');

    return `
      <form class="card outreach-compose mb-4" id="outreach-compose-form">
        <div class="outreach-compose-header">
          <h2 class="outreach-compose-title">New message</h2>
          <span class="badge ${cfg.configured ? 'badge-success' : 'badge-warning'}">${cfg.configured ? 'Resend ready' : 'Send disabled'}</span>
        </div>

        <div class="outreach-compose-meta">
          <div class="outreach-envelope-row">
            <span class="outreach-envelope-label">From</span>
            <span class="outreach-envelope-value"><code>${escapeHtml(cfg.from || 'Trevor Punt <trevor@simplebeacon.ai>')}</code></span>
          </div>
          <div class="outreach-envelope-row">
            <span class="outreach-envelope-label">Reply</span>
            <span class="outreach-envelope-value"><code>${escapeHtml(cfg.replyTo || 'trevor@simplebeacon.ai')}</code></span>
          </div>
        </div>

        <div class="outreach-compose-body">
          <div class="outreach-field outreach-field-full">
            <span>Pipeline prospect</span>
            <select class="settings-input settings-select" name="prospect" id="outreach-prospect" ${disabled ? 'disabled' : ''}>
              ${prospectOptions}
            </select>
            ${this.renderProspectHint()}
          </div>

          <div class="outreach-field-row">
            <label class="outreach-field">
              <span>To</span>
              <input class="settings-input" type="email" name="to" placeholder="founder@agency.example" value="${escapeHtml(d.to)}" ${disabled ? 'disabled' : ''}>
            </label>
            <label class="outreach-field">
              <span>Company (log)</span>
              <input class="settings-input" type="text" name="company" placeholder="Agency name" value="${escapeHtml(d.company)}" ${disabled ? 'disabled' : ''}>
            </label>
          </div>

          <label class="outreach-field outreach-field-full">
            <span>Template</span>
            <select class="settings-input settings-select" name="template" id="outreach-template" ${disabled ? 'disabled' : ''}>
              ${templateOptions}
            </select>
          </label>

          <label class="outreach-field outreach-field-full">
            <span>Subject</span>
            <input class="settings-input" type="text" name="subject" required placeholder="Enterprise guardrails before your next client review?" value="${escapeHtml(d.subject)}" ${disabled ? 'disabled' : ''}>
          </label>

          <label class="outreach-field outreach-field-full outreach-message-wrap">
            <span>Message</span>
            <textarea class="settings-input" name="text" required placeholder="Body…" ${disabled ? 'disabled' : ''}>${escapeHtml(d.text)}</textarea>
            <span class="outreach-char-count" id="outreach-char-count">${charCount} chars</span>
          </label>
        </div>

        <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;height:0;width:0;opacity:0;">

        <div class="outreach-toolbar">
          <button type="submit" class="btn btn-primary" ${disabled ? 'disabled' : ''}>
            ${this.sending ? 'Sending…' : 'Send'}
          </button>
          <button type="button" class="btn btn-ghost" id="outreach-next-ready">Next ready</button>
          <button type="button" class="btn btn-ghost" id="outreach-recheck">Check config</button>
          <span class="outreach-toolbar-spacer"></span>
          <span class="text-muted" style="font-size:var(--font-size-xs);">Sends as @simplebeacon.ai</span>
        </div>
      </form>
    `;
  }

  render() {
    if (!this._root) return;

    if (this.error) {
      const signInHint = this.error.includes('Sign in') ? ' <a href="#/signin">Sign in</a>' : '';
      const vaultHint = this.error.includes('Vault')
        ? ' <a href="/private-dashboard-vault?returnTo=%2Fapp%23%2Foutreach">Unlock vault</a>'
        : '';
      const localHint = this.error.includes('localhost')
        ? ` <a href="${OUTREACH_APP_URL}">Open ${OUTREACH_APP_URL}</a>`
        : '';
      this._root.innerHTML = `
        <header class="page-header mb-4">
          <h1 class="page-title">Outreach</h1>
          <p class="page-subtitle text-danger">${escapeHtml(this.error)}${signInHint}${vaultHint}${localHint}</p>
        </header>`;
      return;
    }

    this._root.innerHTML = `
      <header class="page-header mb-4">
        <h1 class="page-title">Outreach</h1>
        <p class="page-subtitle">
          Tier 0 founder email — enterprise guardrails (leak tokens + LLM token caps). Localhost + Resend only.
          <a href="${OUTREACH_APP_URL}" class="ml-2">${OUTREACH_APP_URL}</a>
        </p>
      </header>
      <div class="outreach-layout">
        <div class="outreach-main">${this.renderCompose()}</div>
        ${this.renderSidebar()}
      </div>
    `;
  }

  mount(container) {
    this._root = container;
    this.render();
    if (!this._eventsBound) {
      this._eventsBound = true;
      this.bindEvents();
    }
    this.load().then(() => {
      this.render();
    });
  }

  bindEvents() {
    this._root?.addEventListener('change', (e) => {
      if (e.target?.id === 'outreach-prospect') {
        this.captureDraftFromDom();
        const next = buildDraftFromProspect(e.target.value);
        if (next) this.draft = { ...this.draft, ...next };
        this.render();
        return;
      }
      if (e.target?.id === 'outreach-template') {
        this.captureDraftFromDom();
        const prospect = OUTREACH_PROSPECTS.find((p) => p.id === this.draft.prospectId);
        this.draft = buildDraftFromTemplate(e.target.value, {
          ...this.draft,
          contactName: prospect?.contactName || 'there',
          personalization: prospect?.personalization || ''
        });
        this.render();
      }
    });

    this._root?.addEventListener('input', (e) => {
      if (e.target?.name === 'text') {
        const el = this._root?.querySelector('#outreach-char-count');
        if (el) el.textContent = `${e.target.value.length} chars`;
      }
    });

    this._root?.addEventListener('submit', async (e) => {
      const form = e.target.closest('#outreach-compose-form');
      if (!form) return;
      e.preventDefault();
      if (this.sending || !this.config?.configured) return;

      const fd = new FormData(form);
      const to = String(fd.get('to') || '').trim();
      if (!to) {
        showToast('Enter a recipient email (or pick a prospect with email on file)', 'error');
        return;
      }
      this.sending = true;
      this.captureDraftFromDom();
      this.render();

      try {
        const result = await sendOutreachEmail({
          to: fd.get('to'),
          company: fd.get('company'),
          subject: fd.get('subject'),
          text: fd.get('text'),
          website: fd.get('website'),
          prospectId: fd.get('prospect')
        });
        showToast(`Sent to ${result.to}`, 'success');
        this.draft = { prospectId: '', templateId: TEMPLATES[0].id, to: '', company: '', subject: '', text: '', contactUrl: '', note: '' };
        this.seedDraftIfEmpty();
        const sentData = await fetchOutreachSent(20);
        this.sent = sentData.items || [];
      } catch (err) {
        showToast(err.message || 'Send failed', 'error');
      } finally {
        this.sending = false;
        this.render();
      }
    });

    this._root?.addEventListener('click', async (e) => {
      if (e.target?.id === 'outreach-reload') {
        try {
          const sentData = await fetchOutreachSent(20);
          this.sent = sentData.items || [];
          this.render();
          showToast('Send log refreshed', 'info');
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }
      if (e.target?.id === 'outreach-next-ready') {
        this.captureDraftFromDom();
        const nextId = firstReadyProspectId();
        if (!nextId) {
          showToast('No unsent prospects with email on file', 'info');
          return;
        }
        const next = buildDraftFromProspect(nextId);
        if (next) this.draft = { ...this.draft, ...next };
        this.render();
        showToast(`Loaded #${nextId}`, 'info');
        return;
      }
      if (e.target?.id === 'outreach-recheck') {
        this.captureDraftFromDom();
        this.loading = true;
        this.render();
        try {
          await this.load();
          showToast(
            this.config?.configured ? 'Resend ready' : 'Add RESEND_API_KEY and restart',
            this.config?.configured ? 'success' : 'info'
          );
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          this.render();
        }
      }
    });
  }
}
