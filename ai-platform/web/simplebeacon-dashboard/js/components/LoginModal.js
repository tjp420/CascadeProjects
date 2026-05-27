import { authService } from '../services/authService.js';
import { showToast } from '../utils.js';

export function showLoginModal({ onSuccess } = {}) {
  const existing = document.getElementById('login-modal');
  existing?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'login-modal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-labelledby="login-title">
      <div class="modal-header">
        <h2 id="login-title">Sign in to Simplebeacon</h2>
        <p class="text-muted">v1.0-internal — demo: dev@simplebeacon.ai / demo123</p>
      </div>
      <form id="login-form" class="modal-body">
        <label class="field-label" for="login-email">Email</label>
        <input id="login-email" class="input" type="email" autocomplete="username" required placeholder="dev@simplebeacon.ai" />
        <label class="field-label" for="login-password">Password</label>
        <input id="login-password" class="input" type="password" autocomplete="current-password" required placeholder="demo123" />
        <p id="login-error" class="text-danger" hidden role="alert"></p>
        <button type="submit" class="btn btn-primary btn-block" id="login-submit">Sign in</button>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const form = overlay.querySelector('#login-form');
  const submitBtn = overlay.querySelector('#login-submit');
  const errorEl = overlay.querySelector('#login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = overlay.querySelector('#login-email').value.trim();
    const password = overlay.querySelector('#login-password').value;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
    try {
      await authService.login(email, password);
      overlay.remove();
      showToast(`Welcome, ${authService.getUser()?.email || email}`, 'success');
      onSuccess?.();
    } catch (err) {
      const message = err.message || 'Login failed';
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      }
      showToast(message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });
}
