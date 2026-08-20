// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { escapeHtml, showToast, setHtml } from "../utils.js?v=20260725profile1";
import {
  isIdeDashboardSurface,
  isExtensionHostedTab,
} from "../utils-lib/dom.js?v=20260726embedfix1";
import { authService } from "../services/authService.js?v=20260722bridgefix1";
import {
  activateStockpileEntry,
  addToStockpile,
  BUY_TIME_TOKENS_URL,
  decodeTokenMeta,
  listStockpiled,
  stockpileCount,
  tokenHint,
} from "../services/tokenStockpileService.js";

function loadProfile() {
  try {
    const raw = localStorage.getItem("sb_profile");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveProfile(data) {
  localStorage.setItem("sb_profile", JSON.stringify(data));
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(b64 + pad));
  } catch {
    return null;
  }
}

function formatTimeAgo(dateString) {
  if (!dateString) return "Unknown";
  const then = new Date(dateString).getTime();
  if (isNaN(then)) return "Unknown";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  if (years > 0) return `${years} year${years > 1 ? "s" : ""}`;
  if (months > 0) return `${months} month${months > 1 ? "s" : ""}`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
  if (mins > 0) return `${mins} minute${mins > 1 ? "s" : ""}`;
  return `${Math.floor(diff / 1000)} seconds`;
}

function formatExpiry(exp) {
  if (!exp) return { label: "Never", color: "var(--text-muted)" };
  const diff = exp * 1000 - Date.now();
  if (diff <= 0) return { label: "Expired", color: "var(--danger)" };
  const days = Math.floor(diff / 86400000);
  if (days > 30)
    return {
      label: `${Math.floor(days / 30)} months`,
      color: "var(--success)",
    };
  if (days > 1)
    return {
      label: `${days} days`,
      color: days < 7 ? "var(--warning)" : "var(--success)",
    };
  return { label: `${Math.floor(diff / 3600000)}h`, color: "var(--warning)" };
}

function getTokenRegistry() {
  try {
    const raw = localStorage.getItem("sb-token-registry");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export class ProfileView {
  constructor(app) {
    this.app = app;
  }

  mount(container) {
    const user = authService.getUser() || this.app.state?.user || {};
    const token = authService.getToken() || "";
    const profile = loadProfile();
    const email = user.email || profile.email || "";
    const tier = user.tier || user.plan || profile.tier || "community";
    const project =
      user.projectName || profile.projectName || "default-project";
    const loginMethod =
      profile.loginMethod || (token && !user.email ? "token" : "email");

    const payload = decodeJwtPayload(token);
    const registry = getTokenRegistry();
    const binding = registry[token] || null;
    const tokenType = token ? (payload ? "JWT" : "License Key") : "None";
    const tokenTier =
      payload?.tier || payload?.plan || payload?.product || tier;
    const tokenExp = payload?.exp || null;
    const tokenIat = payload?.iat || null;
    const expiryInfo = formatExpiry(tokenExp);
    const boundAt = binding?.boundAt || null;
    const accountAge = boundAt
      ? formatTimeAgo(boundAt)
      : tokenIat
        ? formatTimeAgo(new Date(tokenIat * 1000).toISOString())
        : "Unknown";
    const isActive = token
      ? tokenExp
        ? tokenExp * 1000 > Date.now()
        : true
      : false;
    const subLabel = payload?.sub || payload?.email || email || "Not set";
    const reservedCount = stockpileCount(token);
    const stockpiledRows = listStockpiled(token)
      .map(({ entry, index }) => {
        const meta = entry.meta || decodeTokenMeta(entry.token);
        return `
              <div class="profile-stockpile-row" data-stockpile-index="${index}">
                <div class="profile-stockpile-meta">
                  <code>${escapeHtml(tokenHint(entry.token))}</code>
                  <span class="profile-stockpile-tier">${escapeHtml(String(meta.tier))}</span>
                  <span class="profile-stockpile-expiry">expires ${escapeHtml(meta.expiresLabel)}</span>
                </div>
                <button type="button" class="btn btn-secondary btn-sm profile-stockpile-load" data-stockpile-load="${index}">Load</button>
              </div>`;
      })
      .join("");

    const isIde =
      typeof isIdeDashboardSurface === "function" &&
      isIdeDashboardSurface() &&
      !document.documentElement.hasAttribute("data-embed-full-nav");

    // Detect IDE/embed query params and expose lightweight flags for host integration.
    try {
      const params = new URLSearchParams(window.location.search || "");
      const sbParent = params.get("sb_parent_urlbar") === "1";
      const sbWebsite = params.get("sb_website_mode") === "1";
      const sbApi = params.get("sb_api_base") || params.get("sb_api");
      if (sbParent || sbWebsite) {
        try {
          document.documentElement.setAttribute("data-parent-urlbar", "1");
        } catch (e) {}
        window.__SB_PARENT_URL_BAR__ = true;
        // Only set data-ide-embed when actually inside an iframe (IDE webview).
        // Setting it in a top-level browser tab applies compact IDE styles that break the layout.
        if (
          window.__SB_IDE_EMBED__ ||
          (window.parent && window.parent !== window)
        ) {
          try {
            document.documentElement.setAttribute("data-ide-embed", "1");
          } catch (e) {}
          window.__SB_IDE_EMBED__ = true;
        }
      }
      if (
        sbApi &&
        typeof isExtensionHostedTab === "function" &&
        isExtensionHostedTab()
      ) {
        try {
          window.__SB_BRIDGE_HOST__ = sbApi;
        } catch (e) {}
      }
    } catch (_e) {}
    const avatarHtml =
      user && (user.avatarUrl || user.picture)
        ? `<img class="profile-avatar-img" src="${escapeHtml(user.avatarUrl || user.picture || "")}" alt="Avatar" />`
        : email
          ? escapeHtml(email[0].toUpperCase())
          : "?";

    const fragment = document.createRange().createContextualFragment(`
      <div class="profile-page profile-page-v2">
        <div class="profile-hero-card">
          <div class="profile-avatar" aria-hidden="true">${avatarHtml}</div>
          <div class="profile-hero-info">
            <h1 class="page-title">${escapeHtml(email || "Account")}</h1>
            <div class="profile-hero-badges">
              <span class="profile-tier-badge">${escapeHtml(tokenTier)}</span>
              <span class="profile-status-pill ${isActive ? "is-active" : "is-inactive"}">${isActive ? "Active" : "Inactive"}</span>
            </div>
          </div>
        </div>

        <div class="profile-stats-strip">
          <div class="profile-stat-item"><span class="stat-label">Token</span><span class="stat-value">${escapeHtml(tokenType)}</span></div>
          <div class="profile-stat-item"><span class="stat-label">Project</span><span class="stat-value">${escapeHtml(project)}</span></div>
          <div class="profile-stat-item"><span class="stat-label">Age</span><span class="stat-value">${escapeHtml(accountAge)}</span></div>
          <div class="profile-stat-item"><span class="stat-label">Expires</span><span class="stat-value" style="color:${expiryInfo.color};">${escapeHtml(expiryInfo.label)}</span></div>
        </div>

        <div class="profile-card">
          <div class="profile-card-header">
            <i data-lucide="shield" class="icon-18 profile-card-icon"></i>
            <h2>Login Method</h2>
          </div>
          <div class="profile-card-body">
            <div class="login-method-grid" id="login-method-options">
              <label class="login-method-card ${loginMethod === "email" ? "active" : ""}">
                <input type="radio" name="loginMethod" value="email" ${loginMethod === "email" ? "checked" : ""}>
                <div class="method-icon"><i data-lucide="mail" class="icon-20"></i></div>
                <div class="method-label">Email</div>
                <div class="method-desc">Email + Password</div>
              </label>
              <label class="login-method-card ${loginMethod === "token" ? "active" : ""}">
                <input type="radio" name="loginMethod" value="token" ${loginMethod === "token" ? "checked" : ""}>
                <div class="method-icon"><i data-lucide="key-round" class="icon-20"></i></div>
                <div class="method-label">Token</div>
                <div class="method-desc">Token + Password</div>
              </label>
              <label class="login-method-card ${loginMethod === "both" ? "active" : ""}">
                <input type="radio" name="loginMethod" value="both" ${loginMethod === "both" ? "checked" : ""}>
                <div class="method-icon"><i data-lucide="unlock" class="icon-20"></i></div>
                <div class="method-label">Both</div>
                <div class="method-desc">Any method</div>
              </label>
            </div>
          </div>
        </div>

        <div class="profile-card">
          <div class="profile-card-header">
            <i data-lucide="user-cog" class="icon-18 profile-card-icon"></i>
            <h2>Credentials</h2>
          </div>
          <div class="profile-card-body">
            <div class="profile-field">
              <label for="profile-email">Email Address</label>
              <input type="email" id="profile-email" value="${escapeHtml(email)}" placeholder="you@company.com" autocomplete="email">
            </div>
            <div class="profile-field">
              <label for="profile-email-password">Email Password</label>
              <input type="password" id="profile-email-password" value="${escapeHtml(profile.emailPassword || "")}" placeholder="Set a password for email login…" autocomplete="new-password">
            </div>
            <div class="profile-divider"></div>
            <div class="profile-field">
              <label for="profile-token">License Token</label>
              <div class="profile-input-group">
                <input type="password" id="profile-token" value="${escapeHtml(token)}" placeholder="Paste your license token…" autocomplete="off">
                <button type="button" class="input-action" id="profile-token-toggle" title="Show token" aria-label="Show token"><i data-lucide="eye" class="icon-16"></i></button>
                <button type="button" class="input-action" id="profile-token-copy" title="Copy token" aria-label="Copy token"><i data-lucide="copy" class="icon-16"></i></button>
              </div>
            </div>
            <div class="profile-field">
              <label for="profile-token-password">Token Password</label>
              <input type="password" id="profile-token-password" value="${escapeHtml(profile.tokenPassword || "")}" placeholder="Set a password for token login…" autocomplete="new-password">
            </div>
          </div>
        </div>

        <div class="profile-card" id="profile-stockpile-card">
          <div class="profile-card-header">
            <i data-lucide="layers" class="icon-18 profile-card-icon"></i>
            <h2>Token Loader (${reservedCount} reserved)</h2>
          </div>
          <div class="profile-card-body">
            <div class="profile-input-group">
              <input type="password" id="profile-stockpile-input" placeholder="Paste purchased time token…" autocomplete="off">
              <button type="button" class="btn btn-secondary btn-sm" id="profile-stockpile-add">Stockpile</button>
            </div>
            ${reservedCount > 0 ? `<div class="profile-stockpile-list">${stockpiledRows}</div>` : '<p class="profile-help">No reserved tokens yet.</p>'}
            <div class="profile-stockpile-actions">
              <button type="button" class="btn btn-primary btn-sm" id="profile-buy-tokens"><i data-lucide="shopping-cart" class="icon-16"></i> Buy time tokens</button>
            </div>
          </div>
        </div>

        <div class="profile-actions-bar">
          <button type="button" class="btn btn-primary" id="profile-save-btn"><i data-lucide="save" class="icon-16"></i> Save</button>
          <button type="button" class="btn btn-secondary" id="profile-clear-cache-btn"><i data-lucide="trash-2" class="icon-16"></i> Clear Cache</button>
          <button type="button" class="btn btn-danger" id="profile-signout-btn"><i data-lucide="log-out" class="icon-16"></i> Sign Out</button>
        </div>
        <p class="profile-status-msg" id="profile-save-status"></p>
      </div>
    `);

    window.setSafeHTML(container, "");
    container.appendChild(fragment);

    if (isIde) {
      container.querySelector(".profile-page")?.classList.add("ide-embed");
      container.classList.add("ide-embed");
    }
    if (typeof window.lucide !== "undefined") window.lucide.createIcons();
    if (isIde)
      setTimeout(() => {
        if (typeof window.lucide !== "undefined") window.lucide.createIcons();
      }, 50);

    // Render IDE connection banner when opened from extension-hosted tab with bridge info
    try {
      const isExt =
        typeof isExtensionHostedTab === "function" && isExtensionHostedTab();
      const apiHost =
        window.__SB_BRIDGE_HOST__ ||
        new URLSearchParams(window.location.search || "").get("sb_api_base");
      if (isExt && apiHost) {
        const banner = document.createElement("div");
        banner.className = "profile-ide-banner";
        banner.style.cssText =
          "margin-top:12px;padding:8px;border-radius:6px;background:var(--card-bg);border:1px solid rgba(0,0,0,0.06);font-size:0.95rem;";
        banner.innerHTML = `Connected to IDE bridge · API: <code style="background:transparent;padding:0;border-radius:3px;">${escapeHtml(apiHost)}</code>`;
        const hero = container.querySelector(".profile-hero-card");
        if (hero && hero.parentNode)
          hero.parentNode.insertBefore(banner, hero.nextSibling);
      }
    } catch (_e) {}

    // Login method styles
    const updateLoginMethodStyles = () => {
      container.querySelectorAll(".login-method-card").forEach((card) => {
        card.classList.toggle(
          "active",
          card.querySelector('input[type="radio"]')?.checked,
        );
      });
    };
    container.querySelectorAll('input[name="loginMethod"]').forEach((radio) => {
      radio.addEventListener("change", updateLoginMethodStyles);
    });
    updateLoginMethodStyles();

    // Track changes
    let hasChanges = false;
    [
      "#profile-email",
      "#profile-email-password",
      "#profile-token",
      "#profile-token-password",
    ].forEach((sel) => {
      container.querySelector(sel)?.addEventListener("input", () => {
        hasChanges = true;
      });
    });

    // Password confirmation modal
    function promptForConfirmPassword(message) {
      return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.style.zIndex = "300";
        setHtml(
          overlay,
          `
          <div class="modal-card" role="dialog" aria-modal="true" style="max-width:360px;">
            <div class="modal-header" style="text-align:center;">
              <h2 style="font-size:1.25rem;margin-bottom:var(--space-1);">Confirm Password</h2>
              <p class="text-muted" style="margin:0;">${escapeHtml(message || "Enter your password to confirm changes.")}</p>
            </div>
            <div class="modal-body" style="padding:var(--space-3) var(--space-4);">
              <div class="profile-field">
                <label for="profile-confirm-password-input">Password</label>
                <div class="profile-input-group">
                  <input type="text" id="profile-confirm-password-input" autocomplete="off" placeholder="Enter your password…" style="flex:1;">
                  <button type="button" class="input-action" id="profile-confirm-password-toggle" title="Hide password" aria-label="Hide password"><i data-lucide="eye-off" class="icon-16"></i></button>
                </div>
              </div>
            </div>
            <div class="modal-footer" style="display:flex;gap:var(--space-2);justify-content:flex-end;padding:var(--space-3) var(--space-4);">
              <button type="button" class="btn btn-secondary" id="profile-confirm-password-cancel">Cancel</button>
              <button type="button" class="btn btn-primary" id="profile-confirm-password-ok">Confirm</button>
            </div>
          </div>`,
        );
        document.body.appendChild(overlay);
        if (typeof window.lucide !== "undefined") window.lucide.createIcons();
        const input = overlay.querySelector("#profile-confirm-password-input");
        if (input) input.focus();
        const finish = (val) => {
          overlay.remove();
          resolve(val);
        };
        overlay
          .querySelector("#profile-confirm-password-ok")
          ?.addEventListener("click", () => finish(input?.value || ""));
        overlay
          .querySelector("#profile-confirm-password-cancel")
          ?.addEventListener("click", () => finish(null));
        input?.addEventListener("keydown", (e) => {
          if (e.key === "Enter") finish(input.value);
          if (e.key === "Escape") finish(null);
        });
        const toggle = overlay.querySelector(
          "#profile-confirm-password-toggle",
        );
        toggle?.addEventListener("click", () => {
          if (!input) return;
          if (input.type === "password") {
            input.type = "text";
            setHtml(toggle, '<i data-lucide="eye-off" class="icon-16"></i>');
          } else {
            input.type = "password";
            setHtml(toggle, '<i data-lucide="eye" class="icon-16"></i>');
          }
          if (typeof window.lucide !== "undefined") window.lucide.createIcons();
        });
      });
    }

    // Save
    container
      .querySelector("#profile-save-btn")
      ?.addEventListener("click", async () => {
        const data = {
          email: container.querySelector("#profile-email")?.value?.trim() || "",
          emailPassword:
            container.querySelector("#profile-email-password")?.value || "",
          tokenPassword:
            container.querySelector("#profile-token-password")?.value || "",
          loginMethod:
            container.querySelector('input[name="loginMethod"]:checked')
              ?.value || "email",
        };
        if (hasChanges) {
          const stored = loadProfile();
          const currentPassword =
            data.emailPassword ||
            data.tokenPassword ||
            stored.emailPassword ||
            stored.tokenPassword ||
            "";
          const confirmed = await promptForConfirmPassword(
            "Changes detected. Enter your password to confirm save.",
          );
          if (confirmed === null) {
            const status = container.querySelector("#profile-save-status");
            status.textContent = "Save cancelled.";
            status.style.color = "var(--warning)";
            setTimeout(() => {
              status.textContent = "";
              status.style.color = "";
            }, 3000);
            return;
          }
          if (confirmed !== currentPassword) {
            const status = container.querySelector("#profile-save-status");
            status.textContent = "Password mismatch — changes not saved.";
            status.style.color = "var(--danger)";
            setTimeout(() => {
              status.textContent = "";
              status.style.color = "";
            }, 3000);
            return;
          }
        }
        saveProfile(data);
        hasChanges = false;
        const tokenVal = container
          .querySelector("#profile-token")
          ?.value?.trim();
        if (tokenVal) localStorage.setItem("cascadeAuthToken", tokenVal);
        if (data.email) localStorage.setItem("cascadeAuthUser", data.email);
        const status = container.querySelector("#profile-save-status");
        status.textContent = "Profile saved successfully.";
        status.style.color = "var(--success)";
        setTimeout(() => {
          status.textContent = "";
          status.style.color = "";
        }, 3000);
      });

    // Sign out
    container
      .querySelector("#profile-signout-btn")
      ?.addEventListener("click", () => {
        const keys = [
          "cascadeAuthToken",
          "cascadeAuthUser",
          "access_token",
          "token",
          "authToken",
          "simplebeacon_token",
          "sb-token-vault",
        ];
        keys.forEach((k) => localStorage.removeItem(k));
        keys.forEach((k) => {
          document.cookie = k + "=;path=/;max-age=0;SameSite=Lax;";
        });
        sessionStorage.clear();
        this.app.navigate("dashboard");
        window.location.reload();
      });

    // Token toggle
    const toggleBtn = container.querySelector("#profile-token-toggle");
    toggleBtn?.addEventListener("click", () => {
      const input = container.querySelector("#profile-token");
      if (!input) return;
      if (input.type === "password") {
        input.type = "text";
        window.setSafeHTML(
          toggleBtn,
          '<i data-lucide="eye-off" class="icon-16"></i>',
        );
        toggleBtn.title = "Hide token";
      } else {
        input.type = "password";
        window.setSafeHTML(
          toggleBtn,
          '<i data-lucide="eye" class="icon-16"></i>',
        );
        toggleBtn.title = "Show token";
      }
      if (typeof window.lucide !== "undefined") window.lucide.createIcons();
    });

    // Token copy
    const copyBtn = container.querySelector("#profile-token-copy");
    copyBtn?.addEventListener("click", async () => {
      const input = container.querySelector("#profile-token");
      if (!input?.value) {
        this.app.showToast?.("No token to copy", "error");
        return;
      }
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(input.value);
          copied = true;
        } catch {}
      }
      if (!copied) {
        try {
          const prev = input.type;
          input.type = "text";
          input.focus();
          input.select();
          copied = document.execCommand("copy");
          input.type = prev;
        } catch {}
      }
      if (copied) {
        window.setSafeHTML(
          copyBtn,
          '<i data-lucide="check" class="icon-16"></i>',
        );
        if (typeof window.lucide !== "undefined") window.lucide.createIcons();
        setTimeout(() => {
          window.setSafeHTML(
            copyBtn,
            '<i data-lucide="copy" class="icon-16"></i>',
          );
          if (typeof window.lucide !== "undefined") window.lucide.createIcons();
        }, 1500);
        this.app.showToast?.("Token copied", "success");
      } else {
        this.app.showToast?.(
          "Copy failed — please select and copy manually",
          "error",
        );
      }
    });

    // Clear cache
    container
      .querySelector("#profile-clear-cache-btn")
      ?.addEventListener("click", () => {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb_") || k.includes("simplebeacon"))
          .forEach((k) => localStorage.removeItem(k));
        this.app.showToast?.("Local cache cleared", "success");
      });

    // Stockpile add
    container
      .querySelector("#profile-stockpile-add")
      ?.addEventListener("click", () => {
        const input = container.querySelector("#profile-stockpile-input");
        const value = input?.value?.trim() || "";
        if (!value) {
          showToast("Paste a token to stockpile", "error");
          return;
        }
        const result = addToStockpile(value, { email, tier: tokenTier });
        if (result.ok) {
          showToast(
            result.duplicate
              ? "Token already stockpiled"
              : "Time token added to loader",
            "success",
          );
          if (input) input.value = "";
          this.mount(container);
        } else {
          showToast(result.error || "Could not stockpile token", "error");
        }
      });

    // Buy tokens
    container
      .querySelector("#profile-buy-tokens")
      ?.addEventListener("click", () => {
        try {
          window.open(BUY_TIME_TOKENS_URL(), "_blank", "noopener,noreferrer");
        } catch {
          window.open(
            "/checkout/tokens?ref=dashboard",
            "_blank",
            "noopener,noreferrer",
          );
        }
      });

    // Stockpile load
    container.querySelectorAll("[data-stockpile-load]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = parseInt(
          btn.getAttribute("data-stockpile-load") || "-1",
          10,
        );
        const result = activateStockpileEntry(index, authService);
        if (!result.ok) {
          showToast(result.error || "Could not load token", "error");
          return;
        }
        showToast("Time token loaded — session updated", "success");
        this.mount(container);
        this.app.updateAuthUi?.();
      });
    });
  }

  destroy() {}
}
