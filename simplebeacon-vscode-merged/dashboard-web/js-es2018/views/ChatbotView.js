import { escapeHtml } from '../utils/string.js';
import { sanitizePrivacyData } from '../utils/format.js';
import { apiUrl } from '../utils/url.js';
/**
 * Chatbot view.
 */
export class ChatbotView {
    constructor(app) {
        this.app = app;
        this.conversationHistory = [];
        this.isLoading = false;
        this.selectedProvider = 'ollama';
        this.STORAGE_KEY = 'simplebeacon_chatbot_history';
        this.SETTINGS_KEY = 'simplebeacon_chatbot_settings';
        this.personality = 'helpful';
        this.removeFilters = false;
        this.username = localStorage.getItem('simplebeacon_chatbot_username') || '';
        this._mentions = []; // { filePath, content }
        this._attachedFindings = []; // { id, severity, type, filePath, description, snippet }
        this._diffOpenIndex = null;
        this.loadConversationHistory();
        this.loadSettings();
    }
    /**
     * Extract inventory files from report for @mentions.
     * @returns {Array<{path:string}>}
     */
    _getMentionableFiles() {
        var _a;
        const report = this.app.state.report;
        const files = [];
        const seen = new Set();
        const add = (p) => { if (p && !seen.has(p)) {
            seen.add(p);
            files.push({ path: p });
        } };
        // From rawIssues filePaths
        ((report === null || report === void 0 ? void 0 : report.rawIssues) || []).forEach((i) => {
            add(i.filePath);
            (i.filePaths || []).forEach(add);
            (i.affectedFiles || []).forEach(add);
        });
        // From detectedIssues
        ((report === null || report === void 0 ? void 0 : report.detectedIssues) || []).forEach((i) => {
            add(i.filePath);
            (i.filePaths || []).forEach(add);
            (i.affectedFiles || []).forEach(add);
        });
        // From scan paths
        (((_a = this.app.state.config) === null || _a === void 0 ? void 0 : _a.scanPaths) || []).forEach((p) => add(p));
        // From report inventory
        ((report === null || report === void 0 ? void 0 : report.inventory) || []).forEach((item) => add(item.path || item.filePath));
        return files.slice(0, 200);
    }
    /**
     * Get high-severity findings for attachment.
     * @returns {Array}
     */
    _getAttachableFindings() {
        const report = this.app.state.report;
        const raw = (report === null || report === void 0 ? void 0 : report.rawIssues) || [];
        const detected = (report === null || report === void 0 ? void 0 : report.detectedIssues) || [];
        const all = [...raw, ...detected];
        return all
            .filter((i) => ['critical', 'high'].includes(i.severity))
            .slice(0, 20)
            .map((i) => {
            var _a, _b;
            return ({
                id: i.id || `${i.severity}-${i.type}`,
                severity: i.severity,
                type: i.type || 'Issue',
                filePath: i.filePath || ((_a = i.filePaths) === null || _a === void 0 ? void 0 : _a[0]) || ((_b = i.affectedFiles) === null || _b === void 0 ? void 0 : _b[0]) || '—',
                description: i.description || '',
                snippet: i._codeSnippet || ''
            });
        });
    }
    _addMention(path) {
        if (!path)
            return;
        if (!this._mentions.some((m) => m.filePath === path)) {
            this._mentions.push({ filePath: path, content: '' });
        }
    }
    _removeMention(path) {
        this._mentions = this._mentions.filter((m) => m.filePath !== path);
        this._renderInputChips();
    }
    _removeFinding(id) {
        this._attachedFindings = this._attachedFindings.filter((f) => f.id !== id);
        this._renderInputChips();
    }
    _renderInputChips() {
        const container = document.getElementById('cb-input-chips');
        if (!container)
            return;
        const chips = [];
        container.style.display = 'none';
        this._mentions.forEach((m) => {
            const name = m.filePath.split('/').pop() || m.filePath;
            chips.push(`<span class="cb-v3-mention-chip" title="${escapeHtml(m.filePath)}">📎 ${escapeHtml(name)}<button type="button" class="cb-v3-chip-remove" data-remove-mention="${escapeHtml(m.filePath)}" aria-label="Remove mention">×</button></span>`);
        });
        this._attachedFindings.forEach((f) => {
            chips.push(`<span class="cb-v3-mention-chip" style="background:rgba(239,68,68,0.12);color:#f87171;" title="${escapeHtml(f.filePath)}">🐛 ${escapeHtml(f.type)}<button type="button" class="cb-v3-chip-remove" data-remove-finding="${escapeHtml(f.id)}" aria-label="Remove finding">×</button></span>`);
        });
        container.innerHTML = chips.join('');
        container.style.display = chips.length ? 'flex' : 'none';
        container.querySelectorAll('[data-remove-mention]').forEach((btn) => {
            btn.addEventListener('click', () => this._removeMention(btn.dataset.removeMention));
        });
        container.querySelectorAll('[data-remove-finding]').forEach((btn) => {
            btn.addEventListener('click', () => this._removeFinding(btn.dataset.removeFinding));
        });
    }
    mount(container) {
        container.innerHTML = `
      <style>
        @keyframes cb-fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .cb-v3 { animation:cb-fade-up .5s ease both; display:flex; flex-direction:column; height:100%; }
        .cb-v3-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:8px; }
        .cb-v3-header h1 { font-size:2.2rem; font-weight:800; margin:0; letter-spacing:-0.03em; background:linear-gradient(135deg,var(--text-primary) 0%,var(--accent) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .cb-v3-header p { color:var(--text-muted); font-size:0.9rem; margin:6px 0 0; }
        .cb-v3-card { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid rgba(148,163,184,0.08); border-radius:20px; overflow:hidden; backdrop-filter:blur(12px); transition:box-shadow .3s ease; display:flex; flex-direction:column; flex:1; min-height:0; }
        [data-theme='light'] .cb-v3-card { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); border-color:rgba(148,163,184,0.15); }
        @media (max-width: 768px) {
          .cb-v3-card { height:calc(100vh - 120px); min-height:360px; border-radius:14px; }
          .cb-v3-header h1 { font-size:1.6rem; }
          .cb-v3-toolbar { padding:10px 12px; }
          .cb-v3-msg { max-width:95%; }
        }
        .cb-v3-card:hover { box-shadow:0 8px 32px rgba(2,8,20,0.35); }
        [data-theme='light'] .cb-v3-card:hover { box-shadow:0 8px 32px rgba(0,0,0,0.08); }
        .cb-v3-toolbar { display:flex; align-items:center; gap:8px; padding:12px 18px; border-bottom:1px solid rgba(148,163,184,0.08); flex-wrap:wrap; }
        .cb-v3-select { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:8px 12px; font-size:0.8rem; color:var(--text-primary); cursor:pointer; }
        .cb-v3-btn { background:rgba(148,163,184,0.06); border:1px solid rgba(148,163,184,0.1); border-radius:10px; padding:8px 14px; font-size:0.78rem; color:var(--text-secondary); cursor:pointer; transition:all .2s; font-weight:600; }
        .cb-v3-btn:hover { background:rgba(148,163,184,0.12); color:var(--text-primary); }
        .cb-v3-panel { padding:16px 18px; border-bottom:1px solid rgba(148,163,184,0.08); background:rgba(148,163,184,0.03); }
        .cb-v3-messages { flex:1; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:14px; }
        .cb-v3-msg { display:flex; gap:12px; max-width:90%; }
        .cb-v3-msg.user { align-self:flex-end; flex-direction:row-reverse; }
        .cb-v3-msg.assistant { align-self:flex-start; }
        .cb-v3-avatar { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
        .cb-v3-avatar.user { background:var(--accent); }
        .cb-v3-avatar.assistant { background:rgba(34,197,94,0.2); }
        .cb-v3-bubble { padding:12px 16px; border-radius:16px; font-size:0.85rem; line-height:1.6; word-break:break-word; }
        .cb-v3-bubble.user { background:var(--accent); color:#fff; border-bottom-right-radius:4px; }
        .cb-v3-bubble.assistant { background:linear-gradient(145deg, rgba(30,41,59,0.6), rgba(15,23,42,0.5)); border:1px solid rgba(148,163,184,0.08); color:var(--text-primary); border-bottom-left-radius:4px; }
        [data-theme='light'] .cb-v3-bubble.assistant { background:linear-gradient(145deg, rgba(255,255,255,0.9), rgba(248,250,252,0.95)); }
        .cb-v3-bubble pre { background:rgba(0,0,0,0.35); padding:10px 14px; border-radius:10px; overflow-x:auto; font-size:0.78rem; margin:8px 0; }
        [data-theme='light'] .cb-v3-bubble pre { background:rgba(0,0,0,0.06); }
        .cb-v3-bubble code { font-family:var(--font-mono); font-size:0.8rem; }
        .cb-v3-bubble pre code { font-size:0.78rem; }
        .cb-v3-inline-code { background:rgba(148,163,184,0.12); padding:2px 6px; border-radius:4px; font-size:0.8rem; }
        .cb-v3-input-area { padding:10px 14px; border-top:1px solid rgba(148,163,184,0.08); display:flex; gap:8px; align-items:flex-end; flex-shrink:0; }
        .cb-v3-mention-wrap { flex:1; display:flex; flex-direction:column; }
        .cb-v3-textarea { width:100%; box-sizing:border-box; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:8px 12px; font-size:0.85rem; color:var(--text-primary); resize:none; min-height:36px; max-height:200px; overflow-y:auto; transition:border-color .2s,box-shadow .2s; line-height:1.5; }
        .cb-v3-textarea:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .cb-v3-send { background:var(--accent); color:#fff; border:none; border-radius:12px; padding:8px 18px; font-size:0.85rem; font-weight:700; cursor:pointer; transition:transform .2s,box-shadow .2s; }
        .cb-v3-send:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 4px 16px rgba(99,102,241,0.3); }
        .cb-v3-send:disabled { opacity:.5; cursor:not-allowed; }
        .cb-v3-welcome { text-align:center; padding:40px 20px; }
        .cb-v3-welcome-icon { font-size:48px; margin-bottom:14px; }
        .cb-v3-welcome h3 { margin:0 0 8px; font-size:1.1rem; color:var(--text-primary); }
        .cb-v3-welcome p { margin:0; color:var(--text-muted); font-size:0.85rem; }
        .cb-v3-notice { display:flex; align-items:center; gap:8px; padding:10px 14px; background:rgba(245,158,11,0.05); border:1px solid rgba(245,158,11,0.1); border-radius:12px; margin-bottom:16px; font-size:0.78rem; color:var(--text-muted); }
        .cb-v3-typing { display:flex; gap:6px; padding:12px 16px; }
        .cb-v3-typing-dot { width:8px; height:8px; border-radius:50%; background:var(--text-muted); animation:cb-typing 1.4s infinite; }
        .cb-v3-typing-dot:nth-child(2) { animation-delay:.2s; }
        .cb-v3-typing-dot:nth-child(3) { animation-delay:.4s; }
        @keyframes cb-typing { 0%,80%,100% { transform:scale(0); opacity:.5; } 40% { transform:scale(1); opacity:1; } }
        .cb-v3-copy { background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:12px; padding:2px 6px; border-radius:4px; transition:all .2s; margin-left:8px; }
        .cb-v3-copy:hover { background:rgba(148,163,184,0.12); color:var(--text-primary); }
        .cb-v3-copy.copied { color:#22c55e; }
        .cb-v3-label { font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px; display:block; }
        .cb-v3-help { font-size:0.75rem; color:var(--text-muted); margin:4px 0 10px; line-height:1.4; }
        .cb-v3-textarea-prompt { width:100%; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:10px 14px; font-size:0.82rem; color:var(--text-primary); resize:vertical; min-height:80px; transition:border-color .2s,box-shadow .2s; }
        .cb-v3-textarea-prompt:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .cb-v3-mentions-dropdown { position:absolute; bottom:100%; left:0; right:0; margin-bottom:6px; max-height:180px; overflow:auto; background:var(--surface-elevated); border:1px solid var(--border); border-radius:12px; padding:6px; box-shadow:0 8px 32px rgba(0,0,0,0.2); z-index:10; }
        .cb-v3-mention-item { padding:8px 12px; border-radius:8px; cursor:pointer; font-size:0.8rem; color:var(--text-secondary); display:flex; align-items:center; gap:8px; transition:background .15s; }
        .cb-v3-mention-item:hover { background:rgba(99,102,241,0.08); color:var(--text-primary); }
        .cb-v3-mention-chip { display:inline-flex; align-items:center; gap:4px; padding:2px 6px 2px 8px; border-radius:999px; background:rgba(99,102,241,0.15); color:var(--accent); font-size:0.78rem; font-weight:600; margin:0 2px; }
        .cb-v3-chip-remove { display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; border:none; background:rgba(148,163,184,0.15); color:var(--text-secondary); font-size:0.75rem; line-height:1; cursor:pointer; margin-left:2px; transition:all .15s; }
        .cb-v3-chip-remove:hover { background:rgba(239,68,68,0.2); color:#ef4444; }
        .cb-v3-finding-dropdown { position:absolute; bottom:100%; left:auto; right:0; margin-bottom:6px; max-height:220px; overflow:auto; width:320px; background:var(--surface-elevated); border:1px solid var(--border); border-radius:12px; padding:8px; box-shadow:0 8px 32px rgba(0,0,0,0.2); z-index:10; }
        .cb-v3-finding-item { padding:8px 10px; border-radius:8px; cursor:pointer; font-size:0.78rem; margin-bottom:4px; border-left:3px solid transparent; transition:background .15s; }
        .cb-v3-finding-item:hover { background:rgba(148,163,184,0.06); }
        .cb-v3-finding-item.critical { border-left-color:#ef4444; }
        .cb-v3-finding-item.high { border-left-color:#f97316; }
        .cb-v3-diff-banner { display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.15); border-radius:10px; margin-top:8px; font-size:0.78rem; }
        .cb-v3-diff-panel { margin-top:8px; padding:10px 14px; background:rgba(15,23,42,0.5); border:1px solid rgba(148,163,184,0.1); border-radius:10px; font-family:var(--font-mono); font-size:0.72rem; overflow:auto; max-height:200px; }
        .cb-v3-diff-line { white-space:pre-wrap; line-height:1.5; }
        .cb-v3-diff-add { color:#4ade80; }
        .cb-v3-diff-del { color:#f87171; }
        .cb-v3-apply-btn { background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3); color:#4ade80; padding:4px 12px; border-radius:8px; font-size:0.72rem; font-weight:700; cursor:pointer; transition:all .2s; }
        .cb-v3-apply-btn:hover { background:rgba(34,197,94,0.25); }
        .cb-v3-mention-wrap { position:relative; }
      </style>

      <div class="cb-v3-header">
        <div>
          <h1>🤖 Chatbot</h1>
          <p>AI-powered assistance for your codebase</p>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="cb-username-display" style="font-size:0.78rem;color:var(--text-muted);font-weight:600;">${this.username ? escapeHtml(this.username) : 'You'}</span>
          <button id="cb-username-edit" class="cb-v3-btn" title="Change display name" style="padding:4px 8px;font-size:0.7rem;">✏️</button>
        </div>
      </div>

      <div class="cb-v3-notice">
        <span>🤖</span>
        <span>You are interacting with an AI system. Responses are generated by AI models and may contain inaccuracies.</span>
      </div>

      <div class="cb-v3-card">
        <div class="cb-v3-toolbar">
          <label for="chatbot-provider" class="visually-hidden">AI Provider</label>
          <select id="chatbot-provider" class="cb-v3-select" aria-label="AI Provider">
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
          <button id="chatbot-prompt-toggle" class="cb-v3-btn" title="Toggle custom system prompt">📝 Prompt</button>
          <button id="chatbot-settings-toggle" class="cb-v3-btn" title="Chatbot settings">⚙️ Settings</button>
          <button id="chatbot-attach-finding" class="cb-v3-btn" title="Attach scan finding">🐛 Attach Finding</button>
          <button id="chatbot-clear" class="cb-v3-btn">🗑️ Clear</button>
        </div>

        <div id="chatbot-settings-panel" class="cb-v3-panel" style="display:none;">
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">
            <div>
              <label class="cb-v3-label">Personality</label>
              <p class="cb-v3-help">Choose how the chatbot responds to you.</p>
              <select id="chatbot-personality" class="cb-v3-select" style="width:100%;" aria-label="Personality">
                <option value="helpful">Helpful (default)</option>
                <option value="professional">Professional</option>
                <option value="casual">Casual / Friendly</option>
                <option value="sarcastic">Sarcastic / Witty</option>
                <option value="technical">Deep Technical</option>
                <option value="creative">Creative / Exploratory</option>
              </select>
            </div>
            <div>
              <label class="cb-v3-label">Display Name</label>
              <p class="cb-v3-help">Name shown next to your messages.</p>
              <input type="text" id="chatbot-username" class="cb-v3-select" style="width:100%;padding:8px 12px;" value="${escapeHtml(this.username)}" placeholder="Your name..." />
            </div>
            <div>
              <label class="cb-v3-label">Content Filters</label>
              <p class="cb-v3-help">When disabled, the AI will not apply safety or content filtering.</p>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.82rem;color:var(--text-secondary);">
                <input type="checkbox" id="chatbot-remove-filters" aria-label="Remove all content filters" />
                <span>Remove all content filters</span>
              </label>
            </div>
          </div>
          <div style="margin-top:12px;">
            <button type="button" id="chatbot-settings-save" class="btn btn-primary btn-sm">Save Settings</button>
          </div>
        </div>

        <div id="chatbot-prompt-panel" class="cb-v3-panel" style="display:none;">
          <label for="chatbot-custom-prompt" class="cb-v3-label">Custom System Prompt</label>
          <p class="cb-v3-help">An invisible instruction sent at the start of every conversation. Example: <em>"Focus on security vulnerabilities"</em> or <em>"Explain for a junior developer"</em>.</p>
          <textarea id="chatbot-custom-prompt" class="cb-v3-textarea-prompt" rows="3" placeholder="e.g. Focus on security vulnerabilities and OWASP compliance..."></textarea>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button type="button" id="chatbot-prompt-save" class="btn btn-primary btn-sm">Save Prompt</button>
            <button type="button" id="chatbot-prompt-reset" class="btn btn-ghost btn-sm">Reset to Default</button>
          </div>
        </div>

        <div id="chatbot-messages" class="cb-v3-messages"></div>

        <div class="cb-v3-input-area">
          <div class="cb-v3-mention-wrap" style="position:relative;">
            <textarea id="chatbot-input" class="cb-v3-textarea" placeholder="Ask about your codebase... Type @ to mention a file" rows="1"></textarea>
            <div id="cb-mentions-dropdown" class="cb-v3-mentions-dropdown" style="display:none;"></div>
            <div id="cb-findings-dropdown" class="cb-v3-finding-dropdown" style="display:none;"></div>
            <div id="cb-input-chips" style="display:none;flex-wrap:wrap;gap:4px;margin-top:4px;"></div>
          </div>
          <button id="chatbot-send" class="cb-v3-send" ${this.isLoading ? 'disabled' : ''}>
            ${this.isLoading ? '⏳' : 'Send'}
          </button>
        </div>
      </div>
    `;
        this.bindEvents();
        this.loadProviders();
        this.renderMessages();
        this._renderInputChips();
        const input = document.getElementById('chatbot-input');
        if (input)
            this.autoResizeTextarea(input);
        // Lock viewport: remove page scroll and padding so chat fills the screen
        const appMain = document.getElementById('app-main');
        if (appMain) {
            this._savedAppMainStyles = {
                padding: appMain.style.padding,
                overflow: appMain.style.overflow,
                display: appMain.style.display,
                flexDirection: appMain.style.flexDirection
            };
            appMain.style.padding = '0';
            appMain.style.overflow = 'hidden';
            appMain.style.display = 'flex';
            appMain.style.flexDirection = 'column';
        }
        return container;
    }
    bindEvents() {
        const sendBtn = document.getElementById('chatbot-send');
        const input = document.getElementById('chatbot-input');
        const clearBtn = document.getElementById('chatbot-clear');
        const providerSelect = document.getElementById('chatbot-provider');
        sendBtn.addEventListener('click', () => this.sendMessage());
        // Mention autocomplete
        const mentionDropdown = document.getElementById('cb-mentions-dropdown');
        const findingDropdown = document.getElementById('cb-findings-dropdown');
        input.addEventListener('input', (e) => {
            this.autoResizeTextarea(input);
            const val = input.value;
            const lastAt = val.lastIndexOf('@');
            if (lastAt >= 0 && (lastAt === val.length - 1 || /[@a-zA-Z0-9_.\/\-]/.test(val.slice(lastAt + 1, lastAt + 2)))) {
                const query = val.slice(lastAt + 1).toLowerCase();
                const files = this._getMentionableFiles().filter((f) => f.path.toLowerCase().includes(query));
                if (files.length && mentionDropdown) {
                    mentionDropdown.style.display = 'block';
                    mentionDropdown.innerHTML = files.slice(0, 8).map((f) => `
            <div class="cb-v3-mention-item" data-mention-path="${escapeHtml(f.path)}">📎 ${escapeHtml(f.path)}</div>
          `).join('');
                    mentionDropdown.querySelectorAll('.cb-v3-mention-item').forEach((item) => {
                        item.addEventListener('click', () => {
                            const path = item.dataset.mentionPath;
                            const before = val.slice(0, lastAt);
                            input.value = before + '@' + path + ' ';
                            this._addMention(path);
                            mentionDropdown.style.display = 'none';
                            input.focus();
                            this._renderInputChips();
                        });
                    });
                }
                else if (mentionDropdown) {
                    mentionDropdown.style.display = 'none';
                }
            }
            else if (mentionDropdown) {
                mentionDropdown.style.display = 'none';
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
            if (e.key === 'Escape') {
                if (mentionDropdown)
                    mentionDropdown.style.display = 'none';
                if (findingDropdown)
                    findingDropdown.style.display = 'none';
            }
        });
        // Hide dropdowns on click outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && mentionDropdown && !mentionDropdown.contains(e.target)) {
                mentionDropdown.style.display = 'none';
            }
            if (findingDropdown && !findingDropdown.contains(e.target)) {
                const btn = document.getElementById('chatbot-attach-finding');
                if (btn && !btn.contains(e.target))
                    findingDropdown.style.display = 'none';
            }
        });
        clearBtn.addEventListener('click', () => {
            this.conversationHistory = [];
            this._mentions = [];
            this._attachedFindings = [];
            this.saveConversationHistory();
            this.renderMessages();
            this._renderInputChips();
        });
        providerSelect.addEventListener('change', (e) => {
            this.selectedProvider = e.target.value;
            this.saveSettings();
        });
        // Attach finding dropdown
        const attachFindingBtn = document.getElementById('chatbot-attach-finding');
        if (attachFindingBtn && findingDropdown) {
            attachFindingBtn.addEventListener('click', () => {
                const findings = this._getAttachableFindings();
                if (!findings.length) {
                    this.showPromptToast('No critical/high findings available — run a scan first');
                    return;
                }
                findingDropdown.style.display = findingDropdown.style.display === 'none' ? 'block' : 'none';
                findingDropdown.innerHTML = findings.map((f) => `
          <div class="cb-v3-finding-item ${escapeHtml(f.severity)}" data-finding-id="${escapeHtml(f.id)}">
            <div style="font-weight:700;color:var(--text-primary);">${escapeHtml(f.type)}</div>
            <div style="color:var(--text-muted);font-size:0.72rem;">${escapeHtml(f.filePath)}</div>
            <div style="color:var(--text-secondary);margin-top:2px;">${escapeHtml(f.description.slice(0, 60))}${f.description.length > 60 ? '…' : ''}</div>
          </div>
        `).join('');
                findingDropdown.querySelectorAll('.cb-v3-finding-item').forEach((item) => {
                    item.addEventListener('click', () => {
                        const id = item.dataset.findingId;
                        const finding = findings.find((f) => f.id === id);
                        if (finding && !this._attachedFindings.some((af) => af.id === id)) {
                            this._attachedFindings.push(finding);
                            this.showPromptToast(`Attached ${finding.severity} finding: ${finding.type}`);
                        }
                        findingDropdown.style.display = 'none';
                        this._renderInputChips();
                    });
                });
            });
        }
        // Custom prompt panel
        const promptToggle = document.getElementById('chatbot-prompt-toggle');
        const promptPanel = document.getElementById('chatbot-prompt-panel');
        const promptSave = document.getElementById('chatbot-prompt-save');
        const promptReset = document.getElementById('chatbot-prompt-reset');
        const promptTextarea = document.getElementById('chatbot-custom-prompt');
        if (promptToggle && promptPanel) {
            promptToggle.addEventListener('click', () => {
                promptPanel.style.display = promptPanel.style.display === 'none' ? 'block' : 'none';
            });
        }
        if (promptSave && promptTextarea) {
            promptSave.addEventListener('click', async () => {
                var _a, _b, _c;
                const prompt = promptTextarea.value.trim();
                const userId = ((_c = (_b = (_a = this.app) === null || _a === void 0 ? void 0 : _a.state) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.email) || localStorage.getItem('simplebeacon_user_id') || 'anonymous';
                try {
                    await fetch(apiUrl('/api/prompts/set'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, prompt })
                    });
                    this.showPromptToast('Custom prompt saved');
                }
                catch (e) {
                    console.warn('Failed to save prompt:', e);
                    // Fallback to localStorage
                    localStorage.setItem('chatbot_custom_prompt', prompt);
                    this.showPromptToast('Custom prompt saved locally');
                }
            });
        }
        if (promptReset && promptTextarea) {
            promptReset.addEventListener('click', () => {
                promptTextarea.value = '';
                localStorage.removeItem('chatbot_custom_prompt');
                this.showPromptToast('Custom prompt reset to default');
            });
        }
        // Load existing custom prompt
        this.loadCustomPrompt();
        // Settings panel
        const settingsToggle = document.getElementById('chatbot-settings-toggle');
        const settingsPanel = document.getElementById('chatbot-settings-panel');
        const settingsSave = document.getElementById('chatbot-settings-save');
        const personalitySelect = document.getElementById('chatbot-personality');
        const removeFiltersCheckbox = document.getElementById('chatbot-remove-filters');
        if (settingsToggle && settingsPanel) {
            settingsToggle.addEventListener('click', () => {
                settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
            });
        }
        if (personalitySelect) {
            personalitySelect.value = this.personality;
        }
        if (removeFiltersCheckbox) {
            removeFiltersCheckbox.checked = this.removeFilters;
        }
        const usernameInput = document.getElementById('chatbot-username');
        if (usernameInput) {
            usernameInput.value = this.username;
        }
        if (settingsSave) {
            settingsSave.addEventListener('click', () => {
                this.personality = (personalitySelect === null || personalitySelect === void 0 ? void 0 : personalitySelect.value) || 'helpful';
                this.removeFilters = (removeFiltersCheckbox === null || removeFiltersCheckbox === void 0 ? void 0 : removeFiltersCheckbox.checked) || false;
                this.username = (usernameInput === null || usernameInput === void 0 ? void 0 : usernameInput.value.trim()) || '';
                localStorage.setItem('simplebeacon_chatbot_username', this.username);
                this.saveSettings();
                this.showPromptToast('Settings saved');
                if (settingsPanel)
                    settingsPanel.style.display = 'none';
                // Update username display
                const display = document.getElementById('cb-username-display');
                if (display)
                    display.textContent = this.username || 'You';
            });
        }
        // Username quick-edit button
        const usernameEditBtn = document.getElementById('cb-username-edit');
        if (usernameEditBtn && settingsPanel) {
            usernameEditBtn.addEventListener('click', () => {
                settingsPanel.style.display = 'block';
                if (usernameInput)
                    usernameInput.focus();
            });
        }
    }
    showPromptToast(text) {
        const toast = document.createElement('div');
        toast.textContent = text;
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:10px 16px;border-radius:8px;background:var(--success);color:#fff;font-size:0.875rem;z-index:9999;transition:opacity 300ms;';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
    }
    async loadCustomPrompt() {
        var _a, _b, _c;
        const promptTextarea = document.getElementById('chatbot-custom-prompt');
        if (!promptTextarea)
            return;
        const userId = ((_c = (_b = (_a = this.app) === null || _a === void 0 ? void 0 : _a.state) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.email) || localStorage.getItem('simplebeacon_user_id') || 'anonymous';
        try {
            const res = await fetch(apiUrl('/api/prompts/get?userId=' + encodeURIComponent(userId)));
            if (res.ok) {
                const data = await res.json();
                if (data.prompt)
                    promptTextarea.value = data.prompt;
                return;
            }
        }
        catch (e) {
            console.warn('Failed to load custom prompt from API:', e);
        }
        // Fallback to localStorage
        const localPrompt = localStorage.getItem('chatbot_custom_prompt');
        if (localPrompt)
            promptTextarea.value = localPrompt;
    }
    async loadProviders() {
        try {
            const res = await fetch(apiUrl('/api/chatbot/providers'));
            const data = await res.json();
            const select = document.getElementById('chatbot-provider');
            select.innerHTML = '';
            if (!Array.isArray(data.providers)) {
                console.warn('No providers available or unauthorized');
                return;
            }
            data.providers.forEach(provider => {
                const option = document.createElement('option');
                option.value = provider.id;
                option.textContent = provider.label;
                option.disabled = !provider.available;
                if (!provider.available) {
                    option.textContent += ' (not configured)';
                }
                select.appendChild(option);
            });
            // Select first available provider
            const firstAvailable = data.providers.find(p => p.available);
            if (firstAvailable) {
                select.value = firstAvailable.id;
                this.selectedProvider = firstAvailable.id;
            }
            // Restore saved provider selection if it is still available
            if (this.selectedProvider) {
                const saved = data.providers.find(p => p.id === this.selectedProvider && p.available);
                if (saved) {
                    select.value = saved.id;
                    this.selectedProvider = saved.id;
                }
            }
        }
        catch (error) {
            console.error('Failed to load providers:', error);
        }
    }
    async sendMessage() {
        var _a, _b, _c, _d;
        const input = document.getElementById('chatbot-input');
        const rawMessage = input.value.trim();
        if (!rawMessage || this.isLoading)
            return;
        // Sanitize message to remove PII before processing
        const message = sanitizePrivacyData(rawMessage);
        // Add user message to history
        this.conversationHistory.push({ role: 'user', content: message });
        this.renderMessages();
        this.saveConversationHistory();
        input.value = '';
        const mentionsToSend = this._mentions.map((m) => ({ filePath: m.filePath, content: m.content }));
        const findingsToSend = this._attachedFindings.map((f) => ({ id: f.id, severity: f.severity, type: f.type, filePath: f.filePath, description: f.description, snippet: f.snippet }));
        this._mentions = [];
        this._attachedFindings = [];
        this._renderInputChips();
        this.isLoading = true;
        this.updateSendButton();
        // Show typing indicator
        this.showTypingIndicator();
        try {
            const res = await fetch(apiUrl('/api/chatbot/message'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    conversationHistory: this.conversationHistory.slice(0, -1),
                    provider: this.selectedProvider,
                    projectPath: this.app.state.defaultProjectPath || null,
                    userId: ((_c = (_b = (_a = this.app) === null || _a === void 0 ? void 0 : _a.state) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.email) || localStorage.getItem('simplebeacon_user_id') || 'anonymous',
                    personality: this.personality,
                    removeFilters: this.removeFilters,
                    username: this.username,
                    mentions: mentionsToSend,
                    findings: findingsToSend
                })
            });
            // Remove typing indicator
            this.hideTypingIndicator();
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            // Create placeholder for assistant response
            const assistantMessageIndex = this.conversationHistory.length;
            this.conversationHistory.push({ role: 'assistant', content: '' });
            this.renderMessages();
            // Get the message container for streaming updates
            const container = document.getElementById('chatbot-messages');
            const messageElements = container.querySelectorAll('.cb-v3-msg');
            const targetBubble = (_d = messageElements[assistantMessageIndex]) === null || _d === void 0 ? void 0 : _d.querySelector('.cb-v3-bubble');
            if (targetBubble) {
                // Consume streaming response
                await this.consumeTokenStream(res, targetBubble);
                // Update history with final content
                this.conversationHistory[assistantMessageIndex].content = targetBubble.textContent;
            }
            else {
                // Fallback to non-streaming if streaming fails
                const data = await res.json();
                if (data.success) {
                    this.conversationHistory[assistantMessageIndex].content = data.response;
                }
                else {
                    this.conversationHistory[assistantMessageIndex].content = `Error: ${data.message || 'Failed to get response'}`;
                }
            }
        }
        catch (error) {
            this.hideTypingIndicator();
            this.conversationHistory.push({
                role: 'assistant',
                content: `Error: ${error.message}`
            });
        }
        finally {
            this.isLoading = false;
            this.updateSendButton();
            this.renderMessages();
            this.saveConversationHistory();
        }
    }
    /**
     * Consumes the streaming response chunks from the chatbot api
     * and renders tokens incrementally on screen.
     * @param {Response} response - The active fetch response stream.
     * @param {HTMLElement} targetBubble - The UI text node container.
     */
    async consumeTokenStream(response, targetBubble) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulatedText = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                // Decode the binary stream chunk
                const chunkText = decoder.decode(value, { stream: true });
                // Handle server-sent chunk structures (e.g. splitting text lines if SSE formatted)
                const lines = chunkText.split('\n');
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.response) {
                            accumulatedText += parsed.response;
                            // Incrementally render and update the active bubble using stream-safe formatter
                            targetBubble.innerHTML = this.formatStreamedMessage(accumulatedText);
                            // Smoothly anchor view to latest token
                            const container = document.getElementById('chatbot-messages');
                            if (container) {
                                container.scrollTo({
                                    top: container.scrollHeight,
                                    behavior: 'auto'
                                });
                            }
                        }
                    }
                    catch (e) {
                        // Ignore partial or trailing newline evaluation errors
                    }
                }
            }
        }
        catch (error) {
            console.error('Streaming connection interrupted:', error);
            targetBubble.innerHTML += '<p class="error">[Stream Interrupted]</p>';
        }
        finally {
            reader.releaseLock();
        }
    }
    renderMessages() {
        const container = document.getElementById('chatbot-messages');
        if (!container)
            return;
        if (this.conversationHistory.length === 0) {
            container.innerHTML = `
        <div class="cb-v3-welcome">
          <div class="cb-v3-welcome-icon">🤖</div>
          <h3>Start a conversation</h3>
          <p>Ask about your codebase, get help with issues, or request code improvements.</p>
        </div>
      `;
            return;
        }
        container.innerHTML = this.conversationHistory.map((msg, index) => `
      <div class="cb-v3-msg ${msg.role}">
        <div class="cb-v3-avatar ${msg.role}">${msg.role === 'user' ? '👤' : '🤖'}</div>
        <div style="min-width:0;">
          <div style="display:flex;align-items:center;margin-bottom:4px;">
            <span style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">${msg.role === 'user' ? escapeHtml(this.username || 'You') : 'AI'}</span>
            ${msg.role === 'assistant' ? `<button class="cb-v3-copy" data-index="${index}" title="Copy response">📋</button>` : ''}
          </div>
          <div class="cb-v3-bubble ${msg.role}">${this.formatMessage(msg.content)}</div>
        </div>
      </div>
    `).join('');
        // Add copy button event listeners
        container.querySelectorAll('.cb-v3-copy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.copyMessage(index);
            });
        });
        // Bind diff reviewer events
        this._bindDiffEvents(container);
        // Smooth scroll to bottom
        this.scrollToBottom(container);
    }
    formatMessage(content) {
        // First, extract and protect code blocks to prevent XSS
        const codeBlocks = [];
        let processed = content.replace(/```([\s\S]*?)```/g, (match, code) => {
            const index = codeBlocks.length;
            codeBlocks.push(escapeHtml(code));
            return `__CODEBLOCK_${index}__`;
        });
        // Protect inline code
        const inlineCodes = [];
        processed = processed.replace(/`([^`]+)`/g, (match, code) => {
            const index = inlineCodes.length;
            inlineCodes.push(escapeHtml(code));
            return `__INLINECODE_${index}__`;
        });
        // Escape remaining content
        processed = escapeHtml(processed);
        // Restore code blocks with proper HTML + diff reviewer
        processed = processed.replace(/__CODEBLOCK_(\d+)__/g, (match, index) => {
            const code = codeBlocks[index];
            const isPatch = /^\s*[\+\-@]/.test(code) || /^(diff |--- |\+\+\+ )/m.test(code);
            const blockId = `cb-code-${index}`;
            const diffHtml = isPatch ? this._renderDiffPreview(code, blockId) : '';
            return `
        <div style="position:relative;">
          <pre class="chatbot-code-block" id="${blockId}"><code>${code}</code></pre>
          ${diffHtml}
        </div>
      `;
        });
        // Restore inline code
        processed = processed.replace(/__INLINECODE_(\d+)__/g, (match, index) => {
            return `<code class="cb-v3-inline-code">${inlineCodes[index]}</code>`;
        });
        // Preserve line breaks (but not in code blocks)
        processed = processed.replace(/<pre class="chatbot-code-block">[\s\S]*?<\/pre>/g, (match) => {
            return match.replace(/\n/g, '&#10;');
        });
        processed = processed.replace(/\n/g, '<br>');
        // Restore newlines in code blocks
        processed = processed.replace(/&#10;/g, '\n');
        return processed;
    }
    /**
     * Safely converts markdown strings to HTML blocks during an active token stream.
     * Automatically wraps unclosed backticks to prevent layout breakage.
     * @param {string} text - The raw, accumulating token stream text.
     * @returns {string} Safe, rendered HTML layout content.
     */
    _renderDiffPreview(code, blockId) {
        const lines = code.split('\n');
        const diffLines = [];
        let hasDiff = false;
        for (const line of lines) {
            if (line.startsWith('+') && !line.startsWith('+++')) {
                diffLines.push(`<div class="cb-v3-diff-line cb-v3-diff-add">${escapeHtml(line)}</div>`);
                hasDiff = true;
            }
            else if (line.startsWith('-') && !line.startsWith('---')) {
                diffLines.push(`<div class="cb-v3-diff-line cb-v3-diff-del">${escapeHtml(line)}</div>`);
                hasDiff = true;
            }
            else if (line.startsWith('@@')) {
                diffLines.push(`<div class="cb-v3-diff-line" style="color:#a78bfa;">${escapeHtml(line)}</div>`);
                hasDiff = true;
            }
            else {
                diffLines.push(`<div class="cb-v3-diff-line">${escapeHtml(line)}</div>`);
            }
        }
        if (!hasDiff)
            return '';
        return `
      <div class="cb-v3-diff-banner">
        <span>🔍 AI Suggestion Detected</span>
        <button type="button" class="cb-v3-btn" data-diff-toggle="${blockId}" style="font-size:0.72rem;padding:4px 10px;">Review Diff</button>
      </div>
      <div class="cb-v3-diff-panel" id="${blockId}-diff" style="display:none;">
        ${diffLines.join('')}
        <div style="margin-top:8px;display:flex;gap:8px;">
          <button type="button" class="cb-v3-apply-btn" data-apply-patch="${blockId}">✓ Apply Fix to Workspace</button>
          <button type="button" class="cb-v3-btn" data-dismiss-diff="${blockId}" style="font-size:0.72rem;padding:4px 10px;">Dismiss</button>
        </div>
      </div>
    `;
    }
    _applyPatch(blockId) {
        const pre = document.getElementById(blockId);
        if (!pre)
            return;
        const code = pre.textContent || '';
        const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
        if (!vscode) {
            this.showPromptToast('VS Code: API not available — copy patch manually');
            return;
        }
        // Post message to extension host
        vscode.postMessage({
            command: 'applyPatch',
            patch: code,
            projectPath: this.app.state.defaultProjectPath || this.app.state.lastProjectPath || ''
        });
        this.showPromptToast('Patch sent to VS Code: extension — applying…');
    }
    _bindDiffEvents(container) {
        container.querySelectorAll('[data-diff-toggle]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.diffToggle;
                const panel = document.getElementById(`${id}-diff`);
                if (panel)
                    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            });
        });
        container.querySelectorAll('[data-apply-patch]').forEach((btn) => {
            btn.addEventListener('click', () => this._applyPatch(btn.dataset.applyPatch));
        });
        container.querySelectorAll('[data-dismiss-diff]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.dismissDiff;
                const panel = document.getElementById(`${id}-diff`);
                if (panel)
                    panel.style.display = 'none';
            });
        });
    }
    formatStreamedMessage(text) {
        if (!text)
            return '';
        let processedText = text;
        // 1. Stream-Safe Guard: Detect unclosed triple backticks
        const backtickCount = (processedText.match(/```/g) || []).length;
        if (backtickCount % 2 !== 0) {
            // Dynamically append a temporary closing block for visual stability
            processedText += '\n```';
        }
        // 2. Stream-Safe Guard: Detect unclosed inline code backticks
        const inlineBacktickCount = (processedText.match(/`/g) || []).length;
        if (inlineBacktickCount % 2 !== 0) {
            processedText += '`';
        }
        // 3. Extract and protect code blocks using unique placeholders
        const codeBlocks = [];
        processedText = processedText.replace(/```([\s\S]*?)```/g, (match, code) => {
            const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}__`;
            codeBlocks.push(code);
            return placeholder;
        });
        // 4. Extract and protect inline code
        const inlineBlocks = [];
        processedText = processedText.replace(/`([^`]+)`/g, (match, code) => {
            const placeholder = `__INLINE_PLACEHOLDER_${inlineBlocks.length}__`;
            inlineBlocks.push(code);
            return placeholder;
        });
        // 5. Run native XSS escaping on standard paragraph text strings
        processedText = escapeHtml(processedText);
        // 6. Restore protected inline code with safe text nodes
        inlineBlocks.forEach((code, index) => {
            const safeInline = `<code class="cb-v3-inline-code">${escapeHtml(code)}</code>`;
            processedText = processedText.replace(`__INLINE_PLACEHOLDER_${index}__`, safeInline);
        });
        // 7. Restore protected structural code blocks with syntax wrappers
        codeBlocks.forEach((code, index) => {
            const safeBlock = `<pre class="chatbot-code-block"><code>${escapeHtml(code)}</code></pre>`;
            processedText = processedText.replace(`__CODE_BLOCK_PLACEHOLDER_${index}__`, safeBlock);
        });
        // 8. Preserve line breaks (but not in code blocks)
        processedText = processedText.replace(/<pre class="chatbot-code-block">[\s\S]*?<\/pre>/g, (match) => {
            return match.replace(/\n/g, '&#10;');
        });
        processedText = processedText.replace(/\n/g, '<br>');
        // 9. Restore newlines in code blocks
        processedText = processedText.replace(/&#10;/g, '\n');
        return processedText;
    }
    updateSendButton() {
        const btn = document.getElementById('chatbot-send');
        if (btn) {
            btn.disabled = this.isLoading;
            btn.textContent = this.isLoading ? '⏳' : 'Send';
        }
    }
    showTypingIndicator() {
        const container = document.getElementById('chatbot-messages');
        if (!container)
            return;
        const indicator = document.createElement('div');
        indicator.id = 'chatbot-typing-indicator';
        indicator.className = 'cb-v3-msg assistant';
        indicator.innerHTML = `
      <div class="cb-v3-avatar assistant">🤖</div>
      <div style="min-width:0;">
        <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">AI</div>
        <div class="cb-v3-bubble assistant">
          <div class="cb-v3-typing">
            <span class="cb-v3-typing-dot"></span>
            <span class="cb-v3-typing-dot"></span>
            <span class="cb-v3-typing-dot"></span>
          </div>
        </div>
      </div>
    `;
        container.appendChild(indicator);
        this.scrollToBottom(container);
    }
    hideTypingIndicator() {
        const indicator = document.getElementById('chatbot-typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    scrollToBottom(container) {
        if (!container)
            return;
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
    }
    loadConversationHistory() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                this.conversationHistory = JSON.parse(stored);
            }
        }
        catch (error) {
            console.error('Failed to load conversation history:', error);
            this.conversationHistory = [];
        }
    }
    saveConversationHistory() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.conversationHistory));
        }
        catch (error) {
            console.error('Failed to save conversation history:', error);
        }
    }
    loadSettings() {
        try {
            const stored = localStorage.getItem(this.SETTINGS_KEY);
            if (stored) {
                const settings = JSON.parse(stored);
                this.personality = settings.personality || 'helpful';
                this.removeFilters = settings.removeFilters || false;
                this.selectedProvider = settings.selectedProvider || this.selectedProvider || 'ollama';
                this.username = settings.username || localStorage.getItem('simplebeacon_chatbot_username') || '';
            }
        }
        catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
    saveSettings() {
        try {
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify({
                personality: this.personality,
                removeFilters: this.removeFilters,
                selectedProvider: this.selectedProvider,
                username: this.username
            }));
        }
        catch (error) {
            console.error('Failed to save settings:', error);
        }
    }
    copyMessage(index) {
        const message = this.conversationHistory[index];
        if (!message || !message.content)
            return;
        navigator.clipboard.writeText(message.content).then(() => {
            // Show brief success feedback
            const btn = document.querySelector(`.cb-v3-copy[data-index="${index}"]`);
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = '✓';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('copied');
                }, 1500);
            }
        }).catch(err => {
            console.error('Failed to copy message:', err);
        });
    }
    autoResizeTextarea(textarea) {
        if (!textarea)
            return;
        textarea.style.height = 'auto';
        const newHeight = Math.min(Math.max(textarea.scrollHeight, 44), 200);
        textarea.style.height = `${newHeight}px`;
    }
    destroy() {
        const appMain = document.getElementById('app-main');
        if (appMain && this._savedAppMainStyles) {
            appMain.style.padding = this._savedAppMainStyles.padding;
            appMain.style.overflow = this._savedAppMainStyles.overflow;
            appMain.style.display = this._savedAppMainStyles.display;
            appMain.style.flexDirection = this._savedAppMainStyles.flexDirection;
        }
    }
}
