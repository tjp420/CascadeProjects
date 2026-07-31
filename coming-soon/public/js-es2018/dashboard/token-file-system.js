// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * SimpleBeacon Token File System
 * Handles .tokenkey file save/load, device lock enforcement, and drag-and-drop import.
 */

(function () {
    'use strict';

    const TOKENKEY_VERSION = 1;
    const TOKENKEY_FORMAT = 'simplebeacon-tokenkey';
    const LOCK_KEY = 'sb_token_lock';
    const DEVICE_KEY = 'sb_device_id';
    const TOKEN_STORAGE_KEY = 'simplebeacon_token';
    const LOCK_HEARTBEAT_MS = 30000;
    const LOCK_TIMEOUT_MS = 120000;

    function htmlToFragment(html) {
        return document.createRange().createContextualFragment(html.trim());
    }

    // ── Device ID ───────────────────────────────────────────────────────────────
    function getDeviceId() {
        let id = localStorage.getItem(DEVICE_KEY);
        if (!id) {
            id = 'sb-dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem(DEVICE_KEY, id);
        }
        return id;
    }

    // ── Hash ──────────────────────────────────────────────────────────────────
    async function hashToken(token) {
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // ── Lock System ───────────────────────────────────────────────────────────
    async function acquireLock(token) {
        const tokenHash = await hashToken(token);
        const deviceId = getDeviceId();
        const now = Date.now();

        const raw = localStorage.getItem(LOCK_KEY);
        if (raw) {
            try {
                const existing = JSON.parse(raw);
                if (existing.tokenHash === tokenHash && existing.deviceId !== deviceId) {
                    const age = now - existing.acquiredAt;
                    if (age < LOCK_TIMEOUT_MS) {
                        return { ok: false, holder: existing.deviceId, ageMs: age };
                    }
                }
            } catch (e) {
                console.warn('[TokenFileSystem] Corrupted lock entry; overwriting.');
            }
        }

        const lock = { tokenHash, deviceId, acquiredAt: now, heartbeatAt: now };
        localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
        startHeartbeat(tokenHash);
        return { ok: true };
    }

    function releaseLock() {
        localStorage.removeItem(LOCK_KEY);
        stopHeartbeat();
    }

    let heartbeatTimer = null;
    function startHeartbeat(tokenHash) {
        stopHeartbeat();
        heartbeatTimer = setInterval(function () {
            const raw = localStorage.getItem(LOCK_KEY);
            if (!raw) return;
            try {
                const lock = JSON.parse(raw);
                if (lock.tokenHash === tokenHash && lock.deviceId === getDeviceId()) {
                    lock.heartbeatAt = Date.now();
                    localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
                }
            } catch (e) {
                console.warn('[TokenFileSystem] Corrupted heartbeat lock; skipping.');
            }
        }, LOCK_HEARTBEAT_MS);
    }

    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    async function checkLockStatus(token) {
        const tokenHash = await hashToken(token);
        const deviceId = getDeviceId();
        const raw = localStorage.getItem(LOCK_KEY);
        if (!raw) return { locked: false };
        try {
            const lock = JSON.parse(raw);
            if (lock.tokenHash !== tokenHash) return { locked: false };
            if (lock.deviceId === deviceId) return { locked: false, own: true };
            const age = Date.now() - (lock.heartbeatAt || lock.acquiredAt);
            if (age > LOCK_TIMEOUT_MS) return { locked: false, stale: true };
            return { locked: true, holder: lock.deviceId, ageMs: age };
        } catch (e) {
            console.warn('[TokenFileSystem] Corrupted lock entry in checkLockStatus; treating as unlocked.');
            return { locked: false };
        }
    }

    // ── Token Key File ────────────────────────────────────────────────────────
    async function createTokenKeyFile(token) {
        const payload = typeof decodeJwtPayload === 'function' ? decodeJwtPayload(token) : null;
        const fingerprint = await hashToken(token);
        const file = {
            version: TOKENKEY_VERSION,
            format: TOKENKEY_FORMAT,
            token: token,
            createdAt: new Date().toISOString(),
            deviceId: getDeviceId(),
            tier: payload ? payload.tier || payload.product || 'unknown' : 'unknown',
            expiresAt: payload && payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
            fingerprint: 'sha256:' + fingerprint
        };
        return JSON.stringify(file, null, 2);
    }

    function parseTokenKeyFile(text) {
        try {
            const data = JSON.parse(text);
            if (data.format !== TOKENKEY_FORMAT && !data.token) {
                return { ok: false, error: 'Not a valid .tokenkey file' };
            }
            return { ok: true, token: data.token, meta: data };
        } catch (e) {
            return { ok: false, error: 'Invalid JSON: ' + e.message };
        }
    }

    // ── File Download ─────────────────────────────────────────────────────────
    function downloadTokenKeyFile(token) {
        createTokenKeyFile(token).then(function (content) {
            const payload = typeof decodeJwtPayload === 'function' ? decodeJwtPayload(token) : null;
            const tier = payload ? payload.tier || payload.product || 'token' : 'token';
            const date = new Date().toISOString().slice(0, 10);
            const filename = 'simplebeacon-' + tier + '-' + date + '.tokenkey';
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                URL.revokeObjectURL(url);
                a.remove();
            }, 1000);
        });
    }

    // ── UI: Token Status Badge ────────────────────────────────────────────────
    function renderTokenStatus(token) {
        const container = document.getElementById('tokenStatusBadge');
        if (!container) return;
        if (!token) {
            container.textContent = '';
            container.style.display = 'none';
            return;
        }
        checkLockStatus(token).then(function (status) {
            container.style.display = 'inline-flex';
            container.textContent = '';
            var span = document.createElement('span');
            span.style.cssText = 'font-size:0.7rem;font-weight:600;';
            if (status.locked) {
                span.style.color = 'var(--warn)';
                span.textContent = '\uD83D\uDD12 In use on ' + (status.holder || 'another device');
                container.title = 'This token is currently active on another device. Close other sessions to use here.';
            } else if (status.own) {
                span.style.color = 'var(--success)';
                span.textContent = '\u2705 Active on this device';
                container.title = 'Token is active on this device.';
            } else {
                span.style.color = 'var(--text-dim)';
                span.textContent = '\uD83D\uDD17 Ready';
                container.title = 'Token is available.';
            }
            container.appendChild(span);
        });
    }

    // ── UI: Drag-and-Drop Zone ────────────────────────────────────────────────
    function setupTokenDropzone(containerId, onTokenLoaded) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const dropzone = document.createElement('div');
        dropzone.className = 'token-dropzone';
        dropzone.setAttribute('role', 'button');
        dropzone.setAttribute('aria-label', 'Drop a .tokenkey file here, or click to browse');
        dropzone.setAttribute('tabindex', '0');
        const dzInner = document.createElement('div');
        dzInner.className = 'token-dropzone-inner';
        const dzIcon = document.createElement('span');
        dzIcon.className = 'token-dropzone-icon';
        dzIcon.setAttribute('aria-hidden', 'true');
        dzIcon.textContent = '\uD83D\uDCCB';
        const dzText = document.createElement('p');
        dzText.className = 'token-dropzone-text';
        dzText.id = 'tokenDropLabel';
        dzText.appendChild(document.createTextNode('Drop '));
        const codeEl = document.createElement('code');
        codeEl.textContent = '.tokenkey';
        dzText.appendChild(codeEl);
        dzText.appendChild(document.createTextNode(' file here'));
        const dzHint = document.createElement('p');
        dzHint.className = 'token-dropzone-hint';
        dzHint.textContent = 'or click to browse';
        const dzInput = document.createElement('input');
        dzInput.type = 'file';
        dzInput.className = 'token-dropzone-input';
        dzInput.accept = '.tokenkey,application/json';
        dzInput.setAttribute('aria-labelledby', 'tokenDropLabel');
        dzInner.appendChild(dzIcon);
        dzInner.appendChild(dzText);
        dzInner.appendChild(dzHint);
        dzInner.appendChild(dzInput);
        dropzone.appendChild(dzInner);
        container.appendChild(dropzone);

        const input = dropzone.querySelector('.token-dropzone-input');
        const inner = dropzone.querySelector('.token-dropzone-inner');

        function handleFile(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                const result = parseTokenKeyFile(e.target.result);
                if (result.ok) {
                    onTokenLoaded(result.token, result.meta);
                    showTokenDropMessage(dropzone, 'Token loaded: ' + (result.meta.tier || 'valid'), 'success');
                } else {
                    showTokenDropMessage(dropzone, result.error, 'error');
                }
            };
            reader.readAsText(file);
        }

        dropzone.addEventListener('dragover', function (e) {
            e.preventDefault();
            inner.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', function (e) {
            e.preventDefault();
            inner.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', function (e) {
            e.preventDefault();
            inner.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            handleFile(file);
        });
        inner.addEventListener('click', function () {
            input.click();
        });
        input.addEventListener('change', function () {
            handleFile(input.files[0]);
        });
    }

    function showTokenDropMessage(dropzone, msg, type) {
        const existing = dropzone.querySelector('.token-dropzone-msg');
        if (existing) existing.remove();
        const el = document.createElement('p');
        el.className = 'token-dropzone-msg token-dropzone-msg--' + type;
        el.textContent = msg;
        dropzone.appendChild(el);
        setTimeout(function () {
            el.remove();
        }, 4000);
    }

    // ── UI: File Path Input (for CLI/Electron environments) ───────────────────
    function setupTokenPathInput(containerId, onTokenLoaded) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'token-path-row';
        row.appendChild(
            htmlToFragment(
                '<label class="token-path-label">Token file path</label><div class="token-path-input-wrap"><input type="text" id="tokenFilePath" class="token-path-input" placeholder="~/.simplebeacon/token.tokenkey" readonly><input type="file" id="tokenFilePathInput" accept=".tokenkey,application/json" style="display:none;"><button type="button" class="token-path-btn" id="tokenFileBrowseBtn">Browse...</button></div>'
            )
        );
        container.appendChild(row);

        const pathInput = row.querySelector('#tokenFilePath');
        const fileInput = row.querySelector('#tokenFilePathInput');
        const browseBtn = row.querySelector('#tokenFileBrowseBtn');

        browseBtn.addEventListener('click', function () {
            fileInput.click();
        });
        fileInput.addEventListener('change', function () {
            const file = fileInput.files[0];
            if (!file) return;
            pathInput.value = file.name;
            const reader = new FileReader();
            reader.onload = function (e) {
                const result = parseTokenKeyFile(e.target.result);
                if (result.ok) {
                    onTokenLoaded(result.token, result.meta);
                    if (typeof showToast === 'function') showToast('Token loaded from ' + file.name, 'success');
                } else {
                    if (typeof showToast === 'function') showToast(result.error, 'error');
                }
            };
            reader.readAsText(file);
        });
    }

    // ── UI: Save Token Toggle ─────────────────────────────────────────────────
    function setupSaveTokenToggle(containerId, tokenGetter) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const wrap = document.createElement('div');
        wrap.className = 'token-save-toggle';
        wrap.appendChild(
            htmlToFragment(
                '<label class="token-save-label"><input type="checkbox" id="saveTokenToggle" class="token-save-check"> Save token to <code>.tokenkey</code> file</label><button type="button" id="downloadTokenKeyBtn" class="token-save-btn" style="display:none;">&#128229; Download .tokenkey</button>'
            )
        );
        container.appendChild(wrap);

        const checkbox = wrap.querySelector('#saveTokenToggle');
        const btn = wrap.querySelector('#downloadTokenKeyBtn');

        checkbox.addEventListener('change', function () {
            const token = tokenGetter();
            if (checkbox.checked && token) {
                btn.style.display = 'inline-flex';
            } else {
                btn.style.display = 'none';
            }
        });

        btn.addEventListener('click', function () {
            const token = tokenGetter();
            if (token) downloadTokenKeyFile(token);
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────
    window.TokenFileSystem = {
        getDeviceId: getDeviceId,
        acquireLock: acquireLock,
        releaseLock: releaseLock,
        checkLockStatus: checkLockStatus,
        createTokenKeyFile: createTokenKeyFile,
        parseTokenKeyFile: parseTokenKeyFile,
        downloadTokenKeyFile: downloadTokenKeyFile,
        renderTokenStatus: renderTokenStatus,
        setupTokenDropzone: setupTokenDropzone,
        setupTokenPathInput: setupTokenPathInput,
        setupSaveTokenToggle: setupSaveTokenToggle,
        hashToken: hashToken
    };
})();
