import { escapeHtml } from '../utils.js';
import { authService } from '../services/authService.js';

/**
 * Render a small inline locked/upgrade badge for a paid feature.
 * @param {string} featureLabel Human-readable feature name (e.g. 'Remote Clones')
 * @param {Object} options
 * @returns {string}
 */
export function renderLockedBadge(featureLabel = 'Paid feature', {
  tier = 'Pro',
  cta = 'Upgrade',
  extraClass = ''
} = {}) {
  return `
    <span class="tier-badge tier-badge-locked ${escapeHtml(extraClass)}" title="${escapeHtml(featureLabel)} requires ${escapeHtml(tier)} tier">
      <span class="codicon codicon-lock"></span>
      <span class="tier-badge-label">${escapeHtml(featureLabel)}</span>
      <span class="tier-badge-pill">${escapeHtml(tier)}</span>
    </span>
  `;
}

/**
 * Render a chip showing the current account tier.
 * @param {string} label
 * @param {string} extraClass
 * @returns {string}
 */
export function renderTierChip(label, extraClass = '') {
  const isPaid = typeof authService !== 'undefined' ? authService.isPaidTier() : /pro|enterprise|team|business|paid|premium|license|auditor|compliance|admin/i.test(label);
  return `
    <span class="tier-badge ${isPaid ? 'tier-badge-paid' : 'tier-badge-free'} ${escapeHtml(extraClass)}">
      ${isPaid ? '<span class="codicon codicon-gem"></span>' : '<span class="codicon codicon-person"></span>'}
      <span class="tier-badge-label">${escapeHtml(label)}</span>
    </span>
  `;
}

/**
 * Render a gated button wrapper: active if allowed, locked badge otherwise.
 * @param {string} htmlButton The real button HTML when allowed
 * @param {boolean} allowed
 * @param {string} featureLabel
 * @param {string} tier
 * @returns {string}
 */
export function renderGatedButton(htmlButton, allowed, featureLabel = 'Paid feature', tier = 'Pro') {
  if (allowed) return htmlButton;
  return `
    <span class="tier-gated-button-wrapper" data-gated-feature="${escapeHtml(featureLabel)}">
      ${htmlButton.replace(/class="([^"]*)"/, (match, cls) => `class="${escapeHtml(cls)} disabled" disabled`)}
      ${renderLockedBadge(featureLabel, { tier })}
    </span>
  `;
}
