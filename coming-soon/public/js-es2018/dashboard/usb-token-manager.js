// simplebeacon-ignore git-sensitive-file — auth/token implementation file, not a leaked secret
/**
 * USB Token Manager — Load .tokenkey files from USB drives
 * Uses File System Access API + WebUSB for device detection
 */
(function () {
    'use strict';
    const TOKENKEY_FILENAME = 'simplebeacon.tokenkey';
    const TOKENKEY_EXTENSION = '.tokenkey';
    /**
     * USB Token Manager
     */
    class UsbTokenManager {
        constructor(options = {}) {
            this.onTokenLoaded = options.onTokenLoaded || (() => {});
            this.onStatusChange = options.onStatusChange || (() => {});
            this.onError = options.onError || (() => {});
            this.usbDevice = null;
            this.isMonitoring = false;
        }
        /**
         * Start monitoring for USB connections (WebUSB)
         */
        async startMonitoring() {
            if (this.isMonitoring) return;
            if (!this.isWebUSBSupported()) {
                this.onStatusChange({
                    type: 'info',
                    message: 'WebUSB not supported — use file picker or drag-and-drop'
                });
                return;
            }
            try {
                // Request permission to access USB devices
                const devices = await navigator.usb.getDevices();
                if (devices.length > 0) {
                    this.usbDevice = devices[0];
                    this.onStatusChange({
                        type: 'connected',
                        message: 'USB device remembered',
                        device: this.usbDevice
                    });
                }
                navigator.usb.addEventListener('connect', e => this._handleUSBConnect(e));
                navigator.usb.addEventListener('disconnect', e => this._handleUSBDisconnect(e));
                this.isMonitoring = true;
                this.onStatusChange({ type: 'monitoring', message: 'USB monitoring active' });
            } catch (err) {
                this.onError('Failed to start USB monitoring: ' + err.message);
            }
        }
        /**
         * Stop monitoring
         */
        stopMonitoring() {
            this.isMonitoring = false;
            this.onStatusChange({ type: 'stopped', message: 'USB monitoring stopped' });
        }
        /**
         * Request USB device access via picker
         */
        async requestUSBDevice() {
            if (!this.isWebUSBSupported()) {
                this.onError('WebUSB not supported in this browser');
                return null;
            }
            try {
                const device = await navigator.usb.requestDevice({ filters: [] });
                this.usbDevice = device;
                this.onStatusChange({
                    type: 'connected',
                    message: `USB: ${device.productName || 'Unknown device'}`,
                    device
                });
                return device;
            } catch (err) {
                if (err.name !== 'NotFoundError') {
                    this.onError('USB access denied: ' + err.message);
                }
                return null;
            }
        }
        /**
         * Browse for tokenkey file using File System Access API
         */
        async browseForTokenKey() {
            try {
                const options = {
                    types: [
                        {
                            description: 'Token Key Files',
                            accept: { 'application/json': [TOKENKEY_EXTENSION] }
                        }
                    ],
                    excludeAcceptAllOption: false
                };
                let fileHandle;
                if (window.showOpenFilePicker) {
                    [fileHandle] = await window.showOpenFilePicker(options);
                    const file = await fileHandle.getFile();
                    return await this._readAndValidateTokenFile(file);
                } else {
                    // Fallback to traditional file input
                    return await this._legacyFilePicker();
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    this.onError('File picker failed: ' + err.message);
                }
                return null;
            }
        }
        /**
         * Auto-scan a directory for tokenkey files
         */
        async scanDirectoryForToken(dirHandle) {
            const entries = [];
            try {
                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith(TOKENKEY_EXTENSION)) {
                        entries.push(entry);
                    }
                }
            } catch (err) {
                this.onError('Directory scan failed: ' + err.message);
            }
            return entries;
        }
        /**
         * Read and validate a tokenkey file
         */
        async _readAndValidateTokenFile(file) {
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (!data.format || data.format !== 'simplebeacon-tokenkey') {
                    this.onError('Invalid tokenkey file format');
                    return null;
                }
                if (!data.token || typeof data.token !== 'string') {
                    this.onError('No token found in file');
                    return null;
                }
                if (data.expiresAt && Date.now() > new Date(data.expiresAt).getTime()) {
                    this.onError('Token has expired');
                    return null;
                }
                this.onStatusChange({
                    type: 'loaded',
                    message: `Token loaded: ${data.label || 'Unnamed'}`,
                    fileName: file.name
                });
                this.onTokenLoaded({
                    token: data.token,
                    label: data.label,
                    tier: data.tier,
                    modules: data.modules,
                    expiresAt: data.expiresAt,
                    fileName: file.name
                });
                return data;
            } catch (err) {
                this.onError('Failed to read tokenkey: ' + err.message);
                return null;
            }
        }
        /**
         * Legacy file picker fallback
         */
        _legacyFilePicker() {
            return new Promise(resolve => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.tokenkey,application/json';
                input.style.display = 'none';
                document.body.appendChild(input);
                input.addEventListener('change', async e => {
                    var _a;
                    const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                    document.body.removeChild(input);
                    if (file) {
                        const result = await this._readAndValidateTokenFile(file);
                        resolve(result);
                    } else {
                        resolve(null);
                    }
                });
                input.click();
            });
        }
        /**
         * Handle USB connect event
         */
        _handleUSBConnect(e) {
            const device = e.device;
            this.usbDevice = device;
            this.onStatusChange({
                type: 'connected',
                message: `USB connected: ${device.productName || 'Unknown'}`,
                device
            });
            // Attempt to auto-load token if device is a mass storage device
            // Note: WebUSB can't directly access mass storage, but we can prompt
            this._promptForTokenLoad();
        }
        /**
         * Handle USB disconnect event
         */
        _handleUSBDisconnect(e) {
            const device = e.device;
            if (this.usbDevice && this.usbDevice.serialNumber === device.serialNumber) {
                this.usbDevice = null;
                this.onStatusChange({ type: 'disconnected', message: 'USB device removed' });
            }
        }
        /**
         * Prompt user to load token after USB connect
         */
        _promptForTokenLoad() {
            // Show a toast or notification prompting user to browse for token
            if (window.showToast) {
                window.showToast('USB detected. Click "Load from USB" to authenticate.', 'info');
            }
        }
        /**
         * Check if WebUSB is supported
         */
        isWebUSBSupported() {
            return typeof navigator !== 'undefined' && !!navigator.usb;
        }
        /**
         * Check if File System Access API is supported
         */
        isFileSystemAccessSupported() {
            return typeof window !== 'undefined' && !!window.showOpenFilePicker;
        }
    }
    /**
     * Setup USB token UI
     */
    function setupUsbTokenUI(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const manager = new UsbTokenManager(options);
        // Create UI
        const panel = document.createElement('div');
        panel.className = 'usb-token-panel';
        panel.style.cssText =
            'padding:16px;background:var(--surface-elevated);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:16px;';
        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:12px;';
        const statusIndicator = document.createElement('div');
        statusIndicator.className = 'usb-status-indicator';
        statusIndicator.id = 'usb-status-indicator';
        statusIndicator.style.cssText =
            'width:12px;height:12px;border-radius:50%;background:var(--text-muted);transition:background 0.3s;';
        const statusText = document.createElement('span');
        statusText.id = 'usb-status-text';
        statusText.style.cssText = 'font-size:0.85rem;color:var(--text-secondary);';
        statusText.textContent = 'USB Token Drive';
        headerRow.appendChild(statusIndicator);
        headerRow.appendChild(statusText);
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
        function makeBtn(id, icon, label) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary btn-sm';
            btn.id = id;
            btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
            const iconSpan = document.createElement('span');
            iconSpan.style.cssText = 'font-size:1rem;';
            iconSpan.textContent = icon;
            btn.appendChild(iconSpan);
            btn.appendChild(document.createTextNode(' ' + label));
            return btn;
        }
        btnRow.appendChild(makeBtn('usb-browse-btn', '\uD83D\uDCBE', 'Browse USB'));
        btnRow.appendChild(makeBtn('usb-monitor-btn', '\uD83D\uDD0C', 'Monitor USB'));
        btnRow.appendChild(makeBtn('usb-save-btn', '\uD83D\uDCE5', 'Save to USB'));
        const infoBox = document.createElement('div');
        infoBox.id = 'usb-token-info';
        infoBox.style.cssText =
            'margin-top:12px;padding:8px;background:var(--background);border-radius:var(--radius-sm);font-size:0.8rem;color:var(--text-muted);display:none;';
        panel.appendChild(headerRow);
        panel.appendChild(btnRow);
        panel.appendChild(infoBox);
        container.appendChild(panel);
        // Wire up buttons
        const browseBtn = container.querySelector('#usb-browse-btn');
        const monitorBtn = container.querySelector('#usb-monitor-btn');
        const saveBtn = container.querySelector('#usb-save-btn');
        const elStatusIndicator = container.querySelector('#usb-status-indicator');
        const elStatusText = container.querySelector('#usb-status-text');
        const elInfoBox = container.querySelector('#usb-token-info');
        function updateStatus(status) {
            elStatusText.textContent = status.message;
            switch (status.type) {
                case 'connected':
                case 'loaded':
                    elStatusIndicator.style.background = 'var(--success)';
                    break;
                case 'error':
                    elStatusIndicator.style.background = 'var(--danger)';
                    break;
                case 'monitoring':
                    elStatusIndicator.style.background = 'var(--warning)';
                    break;
                default:
                    elStatusIndicator.style.background = 'var(--text-muted)';
            }
        }
        // Override status handler
        const originalOnStatus = manager.onStatusChange;
        manager.onStatusChange = status => {
            updateStatus(status);
            originalOnStatus(status);
        };
        browseBtn === null || browseBtn === void 0
            ? void 0
            : browseBtn.addEventListener('click', () => manager.browseForTokenKey());
        monitorBtn === null || monitorBtn === void 0
            ? void 0
            : monitorBtn.addEventListener('click', () => {
                  if (manager.isMonitoring) {
                      manager.stopMonitoring();
                      monitorBtn.textContent = '\u{1F50C} Monitor USB';
                  } else {
                      manager.startMonitoring();
                      monitorBtn.textContent = '\u{23F9} Stop Monitoring';
                  }
              });
        saveBtn === null || saveBtn === void 0
            ? void 0
            : saveBtn.addEventListener('click', () => {
                  if (options.onSaveRequest) options.onSaveRequest();
              });
        // Override token loaded to show info
        const originalOnToken = manager.onTokenLoaded;
        manager.onTokenLoaded = data => {
            elInfoBox.style.display = 'block';
            elInfoBox.textContent = '';
            const strong = document.createElement('strong');
            strong.style.color = 'var(--success)';
            strong.textContent = 'Token Loaded';
            elInfoBox.appendChild(strong);
            elInfoBox.appendChild(document.createElement('br'));
            if (data.label) {
                elInfoBox.appendChild(document.createTextNode('Label: ' + data.label));
                elInfoBox.appendChild(document.createElement('br'));
            }
            elInfoBox.appendChild(document.createTextNode('Tier: ' + (data.tier || 'Unknown')));
            elInfoBox.appendChild(document.createElement('br'));
            elInfoBox.appendChild(document.createTextNode('File: ' + (data.fileName || 'Unknown')));
            elInfoBox.appendChild(document.createElement('br'));
            if (data.expiresAt) {
                elInfoBox.appendChild(
                    document.createTextNode('Expires: ' + new Date(data.expiresAt).toLocaleDateString())
                );
                elInfoBox.appendChild(document.createElement('br'));
            }
            const span = document.createElement('span');
            span.style.fontSize = '0.7rem';
            span.style.color = 'var(--text-muted)';
            span.textContent = 'Token ready for authentication';
            elInfoBox.appendChild(span);
            originalOnToken(data);
        };
        // Override error to show in info box
        const originalOnError = manager.onError;
        manager.onError = msg => {
            elInfoBox.style.display = 'block';
            elInfoBox.textContent = '';
            const errSpan = document.createElement('span');
            errSpan.style.color = 'var(--danger)';
            errSpan.textContent = 'Error: ' + msg;
            elInfoBox.appendChild(errSpan);
            originalOnError(msg);
        };
        return manager;
    }
    // Expose globally
    window.UsbTokenManager = UsbTokenManager;
    window.setupUsbTokenUI = setupUsbTokenUI;
})();
