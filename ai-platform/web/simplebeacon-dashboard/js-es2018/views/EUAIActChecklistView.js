import { showToast } from "../utils.js?v=20260721corsfix1";
export class EUAIActChecklistView {
  constructor(app) {
    this.app = app;
    this.checklistItems = [
      {
        id: "art6",
        article: "Article 6",
        title: "Risk Classification Tagging",
        status: "PASS",
        desc: "No prohibited practice code patterns or untargeted biometric scraping detected.",
      },
      {
        id: "art10",
        article: "Article 10",
        title: "Data Governance & Bias Auditing",
        status: "FAIL",
        desc: "Missing validation steps or safety sanitization checks on local fine-tuning datasets.",
      },
      {
        id: "art52",
        article: "Article 52",
        title: "Transparency & Watermarking",
        status: "PASS",
        desc: "AI-generated content endpoints include appropriate cryptographic or metadata disclosures.",
      },
      {
        id: "art11",
        article: "Article 11 & 12",
        title: "Technical Logging Automation",
        status: "PASS",
        desc: "Automated runtime error logging and prompt template versioning verified.",
      },
    ];
    this._container = null;
  }
  mount(container) {
    this._container = container;
    this.render();
  }
  render() {
    if (!this._container) return;
    this._container.innerHTML = `
      <div class="compliance-panel">
        <div class="compliance-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="margin:0">EU AI Act Readiness Audit</h2>
          <div>
            <button id="export-pdf-btn" class="btn btn-primary">Download PDF Report</button>
            <button id="toggle-mock-btn" class="btn btn-ghost">Toggle Mock Scan</button>
          </div>
        </div>
        <div class="checklist-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
          ${this.checklistItems
            .map(
              (item) => `
            <div class="checklist-card ${item.status.toLowerCase()} card">
              <div class="card-meta" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span class="article-badge" style="font-size:0.85rem;color:var(--text-muted);">${item.article}</span>
                <span class="status-badge ${item.status.toLowerCase()}" style="font-weight:700">${item.status}</span>
              </div>
              <h3 style="margin:0 0 8px 0">${item.title}</h3>
              <p class="text-muted" style="margin:0">${item.desc}</p>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
    this.bindEvents();
  }
  bindEvents() {
    var _a;
    (_a = this._container.querySelector("#export-pdf-btn")) === null ||
    _a === void 0
      ? void 0
      : _a.addEventListener("click", () => {
          import("../utils/pdf-export.js?v=20260721corsfix1").then((m) => {
            try {
              m.exportToPDF(this.checklistItems);
            } catch (err) {
              showToast("Failed to export PDF", "error");
            }
          });
        });
    this._container
      .querySelector("#toggle-mock-btn")
      ?.addEventListener("click", () => {
        const item = this.checklistItems[1];
        item.status = item.status === "PASS" ? "FAIL" : "PASS";
        this.render();
        showToast("Mock status toggled", "info");
      });
  }
}
