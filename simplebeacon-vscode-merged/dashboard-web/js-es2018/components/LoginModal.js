import { authService } from '../services/authService.js';
import { showToast, apiUrl } from '../utils.js';
/**
 * Show login modal.
 * @param {Object} options
 * @returns {any}
 */
export function showLoginModal({ onSuccess } = {}) {
    const existing = document.getElementById('login-modal');
    existing === null || existing === void 0 ? void 0 : existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'login-modal';
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal-card';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'login-title');
    const header = document.createElement('div');
    header.className = 'modal-header';
    const title = document.createElement('h2');
    title.id = 'login-title';
    title.textContent = 'Enter license token';
    const desc = document.createElement('p');
    desc.className = 'text-muted';
    desc.textContent = 'Paste your Simplebeacon license token to unlock the dashboard.';
    header.appendChild(title);
    header.appendChild(desc);
    const form = document.createElement('form');
    form.id = 'login-form';
    form.className = 'modal-body';
    const label = document.createElement('label');
    label.className = 'field-label';
    label.setAttribute('for', 'login-token');
    label.textContent = 'License Token';
    const input = document.createElement('input');
    input.id = 'login-token';
    input.className = 'input';
    input.type = 'text';
    input.autocomplete = 'off';
    input.required = true;
    input.placeholder = 'sb-pro-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX';
    input.setAttribute('aria-label', 'License token');
    const passwordLabel = document.createElement('label');
    passwordLabel.className = 'field-label';
    passwordLabel.setAttribute('for', 'login-token-password');
    passwordLabel.textContent = 'Password (optional)';
    const passwordInput = document.createElement('input');
    passwordInput.id = 'login-token-password';
    passwordInput.className = 'input';
    passwordInput.type = 'password';
    passwordInput.autocomplete = 'off';
    passwordInput.placeholder = 'Assign or enter a password for this token…';
    const error = document.createElement('p');
    error.id = 'login-error';
    error.className = 'text-danger';
    error.hidden = true;
    error.setAttribute('role', 'alert');
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary btn-block';
    submitBtn.id = 'login-submit';
    submitBtn.textContent = 'Unlock Dashboard';
    const recoveryBtn = document.createElement('button');
    recoveryBtn.type = 'button';
    recoveryBtn.className = 'btn btn-secondary btn-block';
    recoveryBtn.id = 'login-recovery-btn';
    recoveryBtn.style.cssText = 'margin-top:8px;background:var(--warning-bg,#fef3c7);color:var(--warning,#f59e0b);border-color:var(--warning,#f59e0b);';
    recoveryBtn.textContent = '🔐 Account Recovery';
    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(passwordLabel);
    form.appendChild(passwordInput);
    form.appendChild(error);
    form.appendChild(submitBtn);
    form.appendChild(recoveryBtn);
    modal.appendChild(header);
    modal.appendChild(form);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const errorEl = overlay.querySelector('#login-error');
    form.addEventListener('submit', async (e) => {
        var _a;
        e.preventDefault();
        const token = overlay.querySelector('#login-token').value.trim();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Validating…';
        if (errorEl) {
            errorEl.hidden = true;
            errorEl.textContent = '';
        }
        if (authService.isTokenActivated(token)) {
            const binding = authService.getTokenBinding(token);
            const emailHint = (binding === null || binding === void 0 ? void 0 : binding.email) ? ` (${binding.email})` : '';
            overlay.remove();
            showToast(`This token is registered to an account${emailHint}. Redirecting to email sign-in.`, 'info');
            if (window.__SB_DASHBOARD_APP__) {
                window.__SB_DASHBOARD_APP__.navigate('signin');
            }
            return;
        }
        try {
            const password = ((_a = overlay.querySelector('#login-token-password')) === null || _a === void 0 ? void 0 : _a.value) || '';
            authService.setSession(token, { token, source: 'modal', password });
            const valid = await authService.validateSession(password ? { password } : undefined);
            if (!valid) {
                throw new Error('Invalid or expired token. Check your license token and try again.');
            }
            overlay.remove();
            showToast('Dashboard unlocked', 'success');
            onSuccess === null || onSuccess === void 0 ? void 0 : onSuccess();
        }
        catch (err) {
            authService.clearSession();
            const message = err.message || 'Token validation failed';
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.hidden = false;
            }
            showToast(message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Unlock Dashboard';
        }
    });
    // Account Recovery — show recovery form inside the same modal
    recoveryBtn.addEventListener('click', () => {
        const existingRecovery = overlay.querySelector('#recovery-form');
        if (existingRecovery)
            return;
        // Hide login form elements
        label.style.display = 'none';
        input.style.display = 'none';
        passwordLabel.style.display = 'none';
        passwordInput.style.display = 'none';
        submitBtn.style.display = 'none';
        recoveryBtn.style.display = 'none';
        if (errorEl)
            errorEl.hidden = true;
        // Build recovery form
        const recoveryForm = document.createElement('div');
        recoveryForm.id = 'recovery-form';
        const emailLabel = document.createElement('label');
        emailLabel.className = 'field-label';
        emailLabel.setAttribute('for', 'recovery-email');
        emailLabel.style.marginTop = '12px';
        emailLabel.textContent = 'Email Address';
        recoveryForm.appendChild(emailLabel);
        const emailInput = document.createElement('input');
        emailInput.className = 'input';
        emailInput.id = 'recovery-email';
        emailInput.type = 'email';
        emailInput.placeholder = 'you@company.com';
        emailInput.autocomplete = 'email';
        recoveryForm.appendChild(emailInput);
        const hintP = document.createElement('p');
        hintP.className = 'text-muted';
        hintP.style.fontSize = '0.75rem';
        hintP.style.margin = '4px 0 12px';
        hintP.textContent = 'Enter the email associated with your account. A recovery link will be sent.';
        recoveryForm.appendChild(hintP);
        const submitBtn2 = document.createElement('button');
        submitBtn2.type = 'button';
        submitBtn2.className = 'btn btn-primary btn-block';
        submitBtn2.id = 'recovery-submit';
        submitBtn2.textContent = 'Send Recovery Link';
        recoveryForm.appendChild(submitBtn2);
        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'btn btn-ghost btn-block';
        backBtn.id = 'recovery-back';
        backBtn.style.marginTop = '8px';
        backBtn.textContent = '\u2190 Back to Login';
        recoveryForm.appendChild(backBtn);
        const statusP = document.createElement('p');
        statusP.id = 'recovery-status';
        statusP.style.textAlign = 'center';
        statusP.style.marginTop = '10px';
        statusP.style.minHeight = '1.2em';
        statusP.style.fontSize = '0.85rem';
        recoveryForm.appendChild(statusP);
        form.appendChild(recoveryForm);
        const recoveryEmail = recoveryForm.querySelector('#recovery-email');
        const recoverySubmit = recoveryForm.querySelector('#recovery-submit');
        const recoveryBack = recoveryForm.querySelector('#recovery-back');
        const recoveryStatus = recoveryForm.querySelector('#recovery-status');
        recoveryEmail === null || recoveryEmail === void 0 ? void 0 : recoveryEmail.focus();
        recoverySubmit.addEventListener('click', async () => {
            var _a;
            const email = (_a = recoveryEmail === null || recoveryEmail === void 0 ? void 0 : recoveryEmail.value) === null || _a === void 0 ? void 0 : _a.trim();
            if (!email) {
                recoveryStatus.textContent = 'Please enter an email address.';
                recoveryStatus.style.color = 'var(--error)';
                return;
            }
            recoveryStatus.textContent = 'Sending recovery link…';
            recoveryStatus.style.color = 'var(--text-muted)';
            try {
                const res = await fetch(apiUrl('/api/auth/recover'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.success) {
                    recoveryStatus.textContent = 'Recovery link sent! Check your inbox.';
                    recoveryStatus.style.color = 'var(--success)';
                    setTimeout(() => { recoveryBack.click(); }, 2500);
                }
                else {
                    recoveryStatus.textContent = data.error || 'Failed to send recovery link.';
                    recoveryStatus.style.color = 'var(--error)';
                }
            }
            catch (_b) {
                recoveryStatus.textContent = 'Network error. Please try again.';
                recoveryStatus.style.color = 'var(--error)';
            }
        });
        recoveryBack.addEventListener('click', () => {
            recoveryForm.remove();
            label.style.display = '';
            input.style.display = '';
            passwordLabel.style.display = '';
            passwordInput.style.display = '';
            submitBtn.style.display = '';
            recoveryBtn.style.display = '';
            if (errorEl)
                errorEl.hidden = true;
            input.focus();
        });
    });
}
// Global fallback so inline handlers and non-module contexts can access the modal
if (typeof window !== 'undefined') {
    window.showLoginModal = showLoginModal;
}
