import { showToast } from '../utils.js';

/**
 * Reusable pending-activation fallback card.
 *
 * Shows when a Stripe payment has been received but the webhook-driven
 * database update hasn't landed yet (e.g. user closed the tab or network
 * blip). Can be rendered inside the Dashboard, Profile, or Billing
 * landing pages.
 */
export class PendingActivationCard {
  constructor({ sessionId, tier, onRefresh, onContactSupport } = {}) {
    this.sessionId = sessionId || '';
    this.tier = tier || 'premium';
    this.onRefresh = onRefresh || (() => {});
    this.onContactSupport = onContactSupport || (() => {});
  }

  render() {
    const el = document.createElement('div');
    el.className = 'pending-activation-card fade-in';
    el.innerHTML = `
      <style>
        .pending-activation-card {
          background: linear-gradient(145deg, rgba(30,41,59,0.6), rgba(15,23,42,0.5));
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 20px;
          padding: 28px 32px;
          max-width: 520px;
          margin: 0 auto;
          backdrop-filter: blur(12px);
          position: relative;
          overflow: hidden;
        }
        [data-theme='light'] .pending-activation-card {
          background: linear-gradient(145deg, rgba(255,255,255,0.75), rgba(248,250,252,0.85));
          border-color: rgba(245,158,11,0.35);
        }
        .pending-activation-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, #f59e0b, #fbbf24);
          border-radius: 20px 20px 0 0;
        }
        .pending-card-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 18px;
        }
        .pending-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: rgba(245,158,11,0.12);
          color: #fbbf24;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
          flex-shrink: 0;
        }
        .pending-card-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 4px;
        }
        .pending-card-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin: 0;
        }
        .pending-card-body {
          font-size: 0.88rem;
          line-height: 1.65;
          color: var(--text-secondary);
          margin-bottom: 20px;
        }
        .pending-card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }
        .pending-meta-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(148,163,184,0.06);
          border: 1px solid rgba(148,163,184,0.08);
          font-size: 0.78rem;
          color: var(--text-secondary);
        }
        .pending-card-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .pending-card-actions .btn {
          flex: 1;
          min-width: 120px;
        }
        @keyframes pendingPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .pending-live-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #fbbf24;
          animation: pendingPulse 2s infinite;
          display: inline-block;
        }
      </style>

      <div class="pending-card-header">
        <div class="pending-card-icon">⏳</div>
        <div>
          <h3 class="pending-card-title">Activation Pending</h3>
          <p class="pending-card-subtitle">
            <span class="pending-live-dot"></span>
            Waiting for billing system sync
          </p>
        </div>
      </div>

      <div class="pending-card-body">
        Your payment was successfully processed by Stripe.
        Our servers are finalising your license upgrade in the background.
        This usually takes a few seconds, but can occasionally take up to a minute during high traffic.
      </div>

      <div class="pending-card-meta">
        <span class="pending-meta-chip">Target tier: <strong>${this.tier}</strong></span>
        ${this.sessionId ? `<span class="pending-meta-chip">Session: <strong>${this.sessionId.slice(0, 12)}…</strong></span>` : ''}
      </div>

      <div class="pending-card-actions">
        <button type="button" class="btn btn-primary" id="pending-refresh-btn">
          🔄 Check Again
        </button>
        <button type="button" class="btn btn-ghost" id="pending-support-btn">
          📨 Contact Support
        </button>
      </div>
    `;

    el.querySelector('#pending-refresh-btn')?.addEventListener('click', () => {
      const btn = el.querySelector('#pending-refresh-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Checking…';
      }
      this.onRefresh()
        .then((upgraded) => {
          if (upgraded) {
            showToast('Account activated — refreshing page…', 'success');
            setTimeout(() => window.location.reload(), 1200);
          } else {
            showToast('Still processing. Please wait a moment and try again.', 'info');
          }
        })
        .catch(() => showToast('Refresh failed. Please retry.', 'error'))
        .finally(() => {
          if (btn) {
            btn.disabled = false;
            btn.textContent = '🔄 Check Again';
          }
        });
    });

    el.querySelector('#pending-support-btn')?.addEventListener('click', () => {
      this.onContactSupport();
    });

    return el;
  }
}
