// simplebeacon-ignore: Dashboard code, i18n
import { showToast } from "../utils.js";

const PROGRESS_KEY = "sb_getting_started_progress";
const DISMISS_KEY = "sb_getting_started_dismissed";

const TASKS = [
  {
    id: "run_scan",
    icon: "folder-search",
    title: "Run your first scan",
    description:
      "Drop a folder, browse, or paste a path. Privacy mode keeps scans in your browser.",
    route: "analyze",
    actionLabel: "Open Analyze",
  },
  {
    id: "review_findings",
    icon: "clipboard-list",
    title: "Review your findings",
    description:
      "Filter issues by severity and category. See your gate score and what to fix.",
    route: "results",
    actionLabel: "View Results",
  },
  {
    id: "explore_roadmap",
    icon: "map",
    title: "Explore the remediation roadmap",
    description:
      "Prioritized fix steps generated from your latest scan report.",
    route: "roadmap",
    actionLabel: "Open Roadmap",
  },
  {
    id: "setup_ai_keys",
    icon: "key",
    title: "Set up AI provider keys",
    description:
      "Connect OpenAI, Anthropic, or Ollama for AI-powered scan summaries and chat.",
    route: "settings",
    actionLabel: "Open Settings",
  },
  {
    id: "register_security_key",
    icon: "shield-check",
    title: "Register a security key",
    description:
      "Add a FIDO2 hardware key or platform authenticator for passwordless login.",
    route: "profile",
    actionLabel: "Open Profile",
  },
  {
    id: "try_chatbot",
    icon: "bot",
    title: "Try the AI chatbot",
    description:
      "Ask AI about your codebase and scan findings. Use local Ollama for private AI.",
    route: "chatbot",
    actionLabel: "Open Chatbot",
  },
];

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

function isTaskComplete(taskId, appState) {
  const progress = loadProgress();
  if (progress[taskId]) return true;
  if (taskId === "run_scan" && appState.report) return true;
  if (taskId === "review_findings" && appState.report && appState._hadReport)
    return true;
  return false;
}

function getCompletionCount(appState) {
  return TASKS.filter((t) => isTaskComplete(t.id, appState)).length;
}

export class GettingStartedView {
  constructor(app) {
    this.app = app;
  }

  mount(container) {
    window.setSafeHTML(container, "");
    const view = this.render();
    container.appendChild(view);
    this.bindEvents(view);
    if (typeof window.lucide !== "undefined") {
      window.lucide.createIcons();
    }
  }

  render() {
    const appState = this.app.state;
    const progress = loadProgress();
    const completed = getCompletionCount(appState);
    const pct = Math.round((completed / TASKS.length) * 100);
    const allDone = completed === TASKS.length;

    const container = document.createElement("div");
    container.className = "fade-in getting-started-page";
    container.innerHTML = `
            <div class="gs-hero">
                <div class="gs-hero-content">
                    <h1 class="gs-hero-title">Get the most out of SimpleBeacon</h1>
                    <p class="gs-hero-subtitle">Complete these ${TASKS.length} steps to unlock the full power of your code security checkpoint.</p>
                </div>
                <div class="gs-hero-badge">
                    <div class="gs-progress-ring ${allDone ? "complete" : ""}">
                        <div class="gs-progress-ring-value">${pct}%</div>
                    </div>
                    <div class="gs-progress-label">${completed} / ${TASKS.length} done</div>
                </div>
            </div>

            <div class="gs-progress-bar-container">
                <div class="gs-progress-bar-fill" style="width:${pct}%"></div>
            </div>

            ${
              allDone
                ? `
                <div class="gs-complete-banner">
                    <span class="gs-complete-icon">🎉</span>
                    <span class="gs-complete-text">All done! You're ready to use SimpleBeacon like a pro.</span>
                    <button class="btn btn-ghost btn-sm" id="gs-reset">Reset progress</button>
                </div>
            `
                : ""
            }

            <div class="gs-tasks-grid">
                ${TASKS.map((task, i) => {
                  const done = isTaskComplete(task.id, appState);
                  return `
                        <div class="gs-task-card ${done ? "gs-task-complete" : "gs-task-pending"}" data-task-id="${task.id}">
                            <div class="gs-task-header">
                                <div class="gs-task-icon-wrap">
                                    <i data-lucide="${task.icon}" class="gs-task-icon"></i>
                                </div>
                                <div class="gs-task-status">
                                    ${
                                      done
                                        ? '<span class="gs-status-badge gs-status-done">✓ Done</span>'
                                        : `<span class="gs-status-badge gs-status-todo">${i + 1}</span>`
                                    }
                                </div>
                            </div>
                            <h3 class="gs-task-title">${task.title}</h3>
                            <p class="gs-task-description">${task.description}</p>
                            <div class="gs-task-actions">
                                <button class="btn btn-primary btn-sm gs-task-do" data-route="${task.route}">
                                    ${done ? "Revisit" : task.actionLabel}
                                </button>
                                ${!done ? `<button class="btn btn-ghost btn-sm gs-task-skip" data-task-id="${task.id}">Skip</button>` : ""}
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>

            <div class="gs-footer">
                <button class="btn btn-ghost btn-sm" id="gs-reset-bottom">Reset all progress</button>
            </div>
        `;

    return container;
  }

  bindEvents(view) {
    view.querySelectorAll(".gs-task-do").forEach((btn) => {
      btn.addEventListener("click", () => {
        const route = btn.getAttribute("data-route");
        const taskId = TASKS.find((t) => t.route === route)?.id;
        if (taskId) {
          const progress = loadProgress();
          progress[taskId] = true;
          saveProgress(progress);
        }
        this.app.navigate(route);
      });
    });

    view.querySelectorAll(".gs-task-skip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const taskId = btn.getAttribute("data-task-id");
        const progress = loadProgress();
        progress[taskId] = true;
        saveProgress(progress);
        showToast("Task skipped — you can complete it later", "info");
        this.mount(document.getElementById("app-main"));
      });
    });

    const resetBtns = view.querySelectorAll("#gs-reset, #gs-reset-bottom");
    resetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        try {
          localStorage.removeItem(PROGRESS_KEY);
        } catch {
          /* ignore */
        }
        showToast("Progress reset", "info");
        this.mount(document.getElementById("app-main"));
      });
    });
  }

  destroy() {
    /* no-op */
  }
}
