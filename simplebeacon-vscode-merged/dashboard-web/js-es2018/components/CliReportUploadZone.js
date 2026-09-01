// simplebeacon-ignore: Dashboard code — all findings are false positives in scanner definitions
/**
 * CLI Report Upload Zone
 *
 * A drag-and-drop file upload zone that accepts SimpleBeacon CLI JSON
 * report files and renders them using the CliMetricsWidget. Supports:
 * - Drag and drop .json files
 * - Click to browse file picker
 * - Paste JSON text
 * - Error handling for invalid JSON or non-report files
 * - File size validation (max 50 MB)
 *
 * Usage:
 *   import { CliReportUploadZone } from './CliReportUploadZone.js';
 *   const zone = new CliReportUploadZone(containerEl, { onReportLoaded });
 *   zone.mount();
 *   // Later: zone.unmount();
 */

import { adaptCliReport } from "../utils/cli-report-adapter.js";
import { generateSampleReport } from "../utils/sample-report.js";
import { CliMetricsWidget } from "./CliMetricsWidget.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ACCEPTED_EXTENSIONS = [".json"];
const ACCEPTED_MIME_TYPES = ["application/json", "text/plain"];

export class CliReportUploadZone {
  /**
   * @param {HTMLElement} container - The DOM element to mount into
   * @param {object} options
   * @param {function} [options.onReportLoaded] - Callback(adaptedReport, rawReport) when a report is loaded
   * @param {function} [options.onError] - Callback(error) when an error occurs
   * @param {boolean} [options.showWidget] - Whether to render the CliMetricsWidget below the drop zone (default: true)
   */
  constructor(container, options = {}) {
    this.container = container;
    this.onReportLoaded = options.onReportLoaded || null;
    this.onError = options.onError || null;
    this.showWidget = options.showWidget !== false;

    this._dropZone = null;
    this._fileInput = null;
    this._pasteInput = null;
    this._widgetContainer = null;
    this._metricsWidget = null;
    this._isDragging = false;
    this._boundHandlers = {};
  }

  /**
   * Mount the upload zone into the container.
   */
  mount() {
    if (!this.container) return;
    this.container.replaceChildren();
    this.container.appendChild(this._renderDropZone());
    if (this.showWidget) {
      this._widgetContainer = document.createElement("div");
      this._widgetContainer.className = "cli-upload-widget-container";
      this.container.appendChild(this._widgetContainer);
    }
    this._bindEvents();
  }

  /**
   * Unmount and clean up event listeners.
   */
  unmount() {
    this._unbindEvents();
    if (this.container) this.container.replaceChildren();
    this._dropZone = null;
    this._fileInput = null;
    this._pasteInput = null;
    this._widgetContainer = null;
    this._metricsWidget = null;
  }

  /**
   * Load a report from a JSON string.
   * @param {string} jsonText - Raw JSON text from a CLI report
   * @returns {object} The adapted report
   */
  loadFromText(jsonText) {
    let raw;
    try {
      raw = JSON.parse(jsonText);
    } catch (err) {
      this._handleError(new Error("Invalid JSON: " + err.message));
      return null;
    }
    return this._processReport(raw);
  }

  /**
   * Load a report from a File object (from drag-drop or file picker).
   * @param {File} file - The JSON file to load
   * @returns {Promise<object|null>} The adapted report, or null on error
   */
  async loadFromFile(file) {
    if (!file) return null;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      this._handleError(
        new Error(
          `File too large (${this._formatBytes(file.size)}). Maximum size is ${this._formatBytes(MAX_FILE_SIZE)}.`,
        ),
      );
      return null;
    }

    // Validate file extension
    const ext = this._getFileExtension(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      this._handleError(
        new Error(`Unsupported file type: ${ext}. Please upload a .json file.`),
      );
      return null;
    }

    // Read file
    let text;
    try {
      text = await this._readFileAsText(file);
    } catch (err) {
      this._handleError(new Error("Failed to read file: " + err.message));
      return null;
    }

    return this.loadFromText(text);
  }

  // ═══════════════════════════════════════════════
  // Private: Rendering
  // ═══════════════════════════════════════════════

  _renderDropZone() {
    const zone = document.createElement("div");
    zone.className = "cli-upload-zone";
    zone.style.cssText = `
            border: 2px dashed var(--border, #334155);
            border-radius: var(--radius-lg, 12px);
            padding: 32px 24px;
            text-align: center;
            transition: all 0.2s ease;
            background: var(--surface, #f8fafc);
            cursor: pointer;
            position: relative;
        `;

    zone.innerHTML = `
            <div class="cli-upload-icon" style="font-size:2.5rem;margin-bottom:8px;">📄</div>
            <div class="cli-upload-title" style="font-size:1.125rem;font-weight:600;margin-bottom:4px;color:var(--text-primary,#1e293b);">
                Drop CLI Report JSON Here
            </div>
            <div class="cli-upload-subtitle" style="font-size:0.875rem;color:var(--text-muted,#94a3b8);margin-bottom:16px;">
                Drag & drop a <code>simplebeacon scan --format json</code> output file, or click to browse
            </div>
            <div class="cli-upload-actions" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                <button type="button" class="btn btn-primary btn-sm cli-upload-browse-btn">
                    Choose File
                </button>
                <button type="button" class="btn btn-outline btn-sm cli-upload-paste-btn">
                    Paste JSON
                </button>
                <button type="button" class="btn btn-ghost btn-sm cli-upload-sample-btn" title="Load a sample report to preview the dashboard">
                    Try Sample Report
                </button>
            </div>
            <input type="file" class="cli-upload-file-input" accept=".json,application/json" hidden>
            <div class="cli-upload-paste-area" style="display:none;margin-top:16px;text-align:left;">
                <textarea class="cli-upload-paste-input" rows="8"
                    style="width:100%;font-family:monospace;font-size:0.8125rem;padding:12px;border:1px solid var(--border,#334155);border-radius:8px;background:var(--surface-elevated,#fff);color:var(--text-primary,#1e293b);resize:vertical;"
                    placeholder='Paste your CLI JSON report here...&#10;{"type":"simplebeacon-scan","reportVersion":2,...}'></textarea>
                <div style="display:flex;gap:8px;margin-top:8px;">
                    <button type="button" class="btn btn-primary btn-sm cli-upload-paste-submit">Load Report</button>
                    <button type="button" class="btn btn-ghost btn-sm cli-upload-paste-cancel">Cancel</button>
                </div>
            </div>
            <div class="cli-upload-status" style="margin-top:12px;font-size:0.8125rem;"></div>
        `;

    this._dropZone = zone;
    this._fileInput = zone.querySelector(".cli-upload-file-input");
    this._pasteInput = zone.querySelector(".cli-upload-paste-input");
    return zone;
  }

  // ═══════════════════════════════════════════════
  // Private: Event binding
  // ═══════════════════════════════════════════════

  _bindEvents() {
    if (!this._dropZone) return;

    // Click to browse
    const browseBtn = this._dropZone.querySelector(".cli-upload-browse-btn");
    this._boundHandlers.browseClick = () => this._fileInput?.click();
    browseBtn?.addEventListener("click", this._boundHandlers.browseClick);

    // Click on zone itself (but not when clicking paste area)
    this._boundHandlers.zoneClick = (e) => {
      if (
        e.target.closest(".cli-upload-paste-area") ||
        e.target.closest("button")
      )
        return;
      this._fileInput?.click();
    };
    this._dropZone.addEventListener("click", this._boundHandlers.zoneClick);

    // File input change
    this._boundHandlers.fileChange = async (e) => {
      const file = e.target.files?.[0];
      if (file) await this.loadFromFile(file);
      e.target.value = "";
    };
    this._fileInput?.addEventListener("change", this._boundHandlers.fileChange);

    // Drag and drop
    this._boundHandlers.dragOver = (e) => this._onDragOver(e);
    this._boundHandlers.dragLeave = (e) => this._onDragLeave(e);
    this._boundHandlers.drop = (e) => this._onDrop(e);
    this._dropZone.addEventListener("dragover", this._boundHandlers.dragOver);
    this._dropZone.addEventListener("dragleave", this._boundHandlers.dragLeave);
    this._dropZone.addEventListener("drop", this._boundHandlers.drop);

    // Paste JSON toggle
    const pasteBtn = this._dropZone.querySelector(".cli-upload-paste-btn");
    const pasteArea = this._dropZone.querySelector(".cli-upload-paste-area");
    this._boundHandlers.pasteToggle = () => {
      if (pasteArea)
        pasteArea.style.display =
          pasteArea.style.display === "none" ? "block" : "none";
      if (pasteArea.style.display === "block") this._pasteInput?.focus();
    };
    pasteBtn?.addEventListener("click", this._boundHandlers.pasteToggle);

    // Paste submit
    const pasteSubmit = this._dropZone.querySelector(
      ".cli-upload-paste-submit",
    );
    this._boundHandlers.pasteSubmit = () => {
      const text = this._pasteInput?.value?.trim();
      if (!text) {
        this._setStatus("Please paste JSON text first", "error");
        return;
      }
      this.loadFromText(text);
    };
    pasteSubmit?.addEventListener("click", this._boundHandlers.pasteSubmit);

    // Paste cancel
    const pasteCancel = this._dropZone.querySelector(
      ".cli-upload-paste-cancel",
    );
    this._boundHandlers.pasteCancel = () => {
      if (pasteArea) pasteArea.style.display = "none";
      if (this._pasteInput) this._pasteInput.value = "";
    };
    pasteCancel?.addEventListener("click", this._boundHandlers.pasteCancel);

    // Sample report button
    const sampleBtn = this._dropZone.querySelector(".cli-upload-sample-btn");
    this._boundHandlers.sampleClick = () => this._loadSampleReport();
    sampleBtn?.addEventListener("click", this._boundHandlers.sampleClick);
  }

  _unbindEvents() {
    if (!this._dropZone) return;
    for (const [name, handler] of Object.entries(this._boundHandlers)) {
      const targets = {
        browseClick: this._dropZone.querySelector(".cli-upload-browse-btn"),
        zoneClick: this._dropZone,
        fileChange: this._fileInput,
        dragOver: this._dropZone,
        dragLeave: this._dropZone,
        drop: this._dropZone,
        pasteToggle: this._dropZone.querySelector(".cli-upload-paste-btn"),
        pasteSubmit: this._dropZone.querySelector(".cli-upload-paste-submit"),
        pasteCancel: this._dropZone.querySelector(".cli-upload-paste-cancel"),
        sampleClick: this._dropZone.querySelector(".cli-upload-sample-btn"),
      };
      targets[name]?.removeEventListener(
        name
          .replace(/([A-Z])/g, (_, c) => c.toLowerCase())
          .replace(/^./, (c) => c.toLowerCase()),
        handler,
      );
    }
    this._boundHandlers = {};
  }

  _onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!this._isDragging) {
      this._isDragging = true;
      this._dropZone.style.borderColor = "var(--primary, #6366f1)";
      this._dropZone.style.background = "rgba(99, 102, 241, 0.05)";
    }
  }

  _onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    // Only reset if leaving the zone itself (not a child element)
    if (e.target === this._dropZone) {
      this._isDragging = false;
      this._dropZone.style.borderColor = "var(--border, #334155)";
      this._dropZone.style.background = "var(--surface, #f8fafc)";
    }
  }

  async _onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this._isDragging = false;
    this._dropZone.style.borderColor = "var(--border, #334155)";
    this._dropZone.style.background = "var(--surface, #f8fafc)";

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    await this.loadFromFile(file);
  }

  // ═══════════════════════════════════════════════
  // Private: Report processing
  // ═══════════════════════════════════════════════

  _loadSampleReport() {
    try {
      const sample = generateSampleReport();
      this._setStatus("Loading sample report...", "info");
      this._processReport(sample);
    } catch (err) {
      this._handleError(
        new Error("Failed to generate sample report: " + err.message),
      );
    }
  }

  _processReport(rawReport) {
    // Validate it looks like a SimpleBeacon report
    if (!rawReport || typeof rawReport !== "object") {
      this._handleError(new Error("File does not contain a valid JSON object"));
      return null;
    }

    // Check for SimpleBeacon report markers
    const isSbReport =
      rawReport.type?.includes("simplebeacon") ||
      rawReport.reportVersion !== undefined ||
      rawReport.gate !== undefined ||
      rawReport.severityCounts !== undefined ||
      rawReport.rawIssues !== undefined ||
      rawReport.scan_summary !== undefined;

    if (!isSbReport) {
      this._handleError(
        new Error(
          "File does not appear to be a SimpleBeacon CLI report. " +
            "Expected fields: type, reportVersion, gate, severityCounts, or rawIssues.",
        ),
      );
      return null;
    }

    // Adapt the report for dashboard consumption
    const adapted = adaptCliReport(rawReport);

    // Render the metrics widget
    if (this.showWidget && this._widgetContainer) {
      this._metricsWidget = new CliMetricsWidget(this._widgetContainer);
      this._metricsWidget.render(rawReport);
    }

    // Update status
    const issueCount = adapted.issueCount || 0;
    const gateStatus = adapted.gate?.pass ? "PASSED" : "FAILED";
    this._setStatus(
      `Report loaded: ${issueCount} issue${issueCount === 1 ? "" : "s"} · Gate: ${gateStatus}`,
      "success",
    );

    // Callback
    if (this.onReportLoaded) {
      this.onReportLoaded(adapted, rawReport);
    }

    return adapted;
  }

  // ═══════════════════════════════════════════════
  // Private: Utilities
  // ═══════════════════════════════════════════════

  _handleError(error) {
    this._setStatus(error.message, "error");
    if (this.onError) this.onError(error);
  }

  _setStatus(message, type = "info") {
    const status = this._dropZone?.querySelector(".cli-upload-status");
    if (!status) return;
    const colors = {
      info: "var(--text-muted, #94a3b8)",
      success: "#10B981",
      error: "#EF4444",
    };
    status.style.color = colors[type] || colors.info;
    status.textContent = message;
  }

  _readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsText(file);
    });
  }

  _getFileExtension(filename) {
    const idx = filename.lastIndexOf(".");
    return idx > 0 ? filename.slice(idx).toLowerCase() : "";
  }

  _formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
}
