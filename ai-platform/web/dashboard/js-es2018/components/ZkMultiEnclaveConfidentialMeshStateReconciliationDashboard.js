// simplebeacon-ignore: Dashboard code — all findings are false positives
import {
  fetchMultiEnclaveConfidentialMeshStateReconciliationPolicy,
  validateMultiEnclaveConfidentialMeshStateReconciliationPolicy,
  fetchMultiEnclaveConfidentialMeshStateReconciliationTelemetry,
} from "../services/zkMultiEnclaveConfidentialMeshStateReconciliationService.js";

let refreshInterval = null;
let isRefreshing = false;

const COUNTER_DEFS = [
  {
    key: "hsm_meshgate_pool_initialized_total",
    label: "Mesh State-Reconciliation Pools Initialized",
    severity: "positive",
  },
  {
    key: "hsm_zk_mesh_state_reconciled_total",
    label: "ZK Mesh State Reconciled",
    severity: "positive",
  },
  {
    key: "hsm_epoch_finality_completed_total",
    label: "Epoch Finality Completions",
    severity: "positive",
  },
];

const FORM_FIELDS = [
  { name: "meshQuorum", label: "Mesh Quorum", type: "number" },
  {
    name: "epochFinalityWindowSeconds",
    label: "Epoch Finality Window (s)",
    type: "number",
  },
  {
    name: "reconciliationChainDepth",
    label: "Reconciliation Chain Depth",
    type: "number",
  },
  {
    name: "pqcSignatureScheme",
    label: "PQC Signature Scheme",
    type: "select",
    options: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  },
  {
    name: "attestationAuthority",
    label: "Attestation Authority",
    type: "text",
  },
];

const BOOLEAN_FIELDS = [
  {
    name: "meshReconciliationAuthorityInitializerAttestation",
    label: "Require Mesh Reconciliation Authority Initializer Attestation",
  },
  {
    name: "meshEthicsOversightCommitteeAttestation",
    label: "Require Mesh Ethics Oversight Committee Attestation",
  },
  {
    name: "banMalformedOrOutOfOrderMeshStateReconciliationClaims",
    label: "Ban Malformed / Out-of-Order Mesh State-Reconciliation Claims",
  },
  { name: "canonicalPayloadLayout", label: "Require Canonical Payload Layout" },
];

function getSeverityClass(def, value) {
  if (def.severity === "positive")
    return value > 0 ? "metric-chip-ok" : "metric-chip-neutral";
  if (def.severity === "negative")
    return value > 0 ? "metric-chip-alert" : "metric-chip-neutral";
  return "metric-chip-neutral";
}

export function renderMultiEnclaveConfidentialMeshStateReconciliationDashboard() {
  const container = document.createElement("div");
  container.className = "card";
  container.id =
    "multi-enclave-confidential-mesh-state-reconciliation-dashboard";

  const header = document.createElement("div");
  header.className = "card-header";

  const flex = document.createElement("div");
  flex.className = "flex items-center gap-3";

  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent =
    "Multi-Enclave Confidential Mesh State-Reconciliation Gating";

  const refreshBtn = document.createElement("button");
  refreshBtn.id = "mesh-reconciliation-refresh";
  refreshBtn.className = "btn btn-sm btn-ghost";
  refreshBtn.textContent = "Refresh";

  flex.appendChild(title);
  flex.appendChild(refreshBtn);

  const statusBadge = document.createElement("span");
  statusBadge.id = "mesh-reconciliation-status";
  statusBadge.className = "badge badge-success";
  statusBadge.textContent = "Loading...";

  header.appendChild(flex);
  header.appendChild(statusBadge);

  const body = document.createElement("div");
  body.className = "card-body";

  const telemetryContent = document.createElement("div");
  telemetryContent.id = "mesh-reconciliation-content";
  telemetryContent.innerHTML =
    '<div class="text-gray-500">Loading telemetry...</div>';

  const policyForm = document.createElement("div");
  policyForm.id = "mesh-reconciliation-policy-form";
  policyForm.className = "mt-4";

  const formTitle = document.createElement("h4");
  formTitle.className = "section-subtitle";
  formTitle.textContent = "Policy Administration";
  policyForm.appendChild(formTitle);

  const form = document.createElement("form");
  form.id = "mesh-reconciliation-policy-form-el";
  form.className = "admin-form grid gap-2";

  for (const field of FORM_FIELDS) {
    const label = document.createElement("label");
    label.textContent = field.label;
    label.className = "form-label";
    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      for (const opt of field.options) {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        input.appendChild(option);
      }
    } else {
      input = document.createElement("input");
      input.type = field.type;
    }
    input.name = field.name;
    input.id = "mesh-reconciliation-" + field.name;
    input.className = "settings-input";
    form.appendChild(label);
    form.appendChild(input);
  }

  for (const field of BOOLEAN_FIELDS) {
    const wrapper = document.createElement("div");
    wrapper.className = "form-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = field.name;
    input.id = "mesh-reconciliation-" + field.name;
    input.className = "form-check-input";
    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.className = "form-check-label";
    label.textContent = field.label;
    wrapper.appendChild(input);
    wrapper.appendChild(label);
    form.appendChild(wrapper);
  }

  const validateBtn = document.createElement("button");
  validateBtn.type = "button";
  validateBtn.id = "mesh-reconciliation-validate-policy";
  validateBtn.className = "btn btn-primary";
  validateBtn.textContent = "Validate Policy";
  form.appendChild(validateBtn);

  const validationResult = document.createElement("div");
  validationResult.id = "mesh-reconciliation-validation-result";
  validationResult.className = "mt-2";
  form.appendChild(validationResult);

  policyForm.appendChild(form);

  body.appendChild(telemetryContent);
  body.appendChild(policyForm);
  container.appendChild(header);
  container.appendChild(body);

  bindMultiEnclaveConfidentialMeshStateReconciliationDashboard(container);
  return container;
}

export function cleanupMultiEnclaveConfidentialMeshStateReconciliationDashboard() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

function bindMultiEnclaveConfidentialMeshStateReconciliationDashboard(
  container,
) {
  const refreshBtn = container.querySelector("#mesh-reconciliation-refresh");
  const validateBtn = container.querySelector(
    "#mesh-reconciliation-validate-policy",
  );

  refreshBtn.addEventListener("click", () => {
    if (!isRefreshing)
      loadMultiEnclaveConfidentialMeshStateReconciliationData(container);
  });

  validateBtn.addEventListener("click", () => {
    onValidatePolicy(container);
  });

  loadMultiEnclaveConfidentialMeshStateReconciliationData(container, true);

  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    loadMultiEnclaveConfidentialMeshStateReconciliationData(container, false);
  }, 15000);
}

async function loadMultiEnclaveConfidentialMeshStateReconciliationData(
  container,
  isInitial,
) {
  const content = container.querySelector("#mesh-reconciliation-content");
  const statusBadge = container.querySelector("#mesh-reconciliation-status");
  const refreshBtn = container.querySelector("#mesh-reconciliation-refresh");

  if (isRefreshing) return;
  isRefreshing = true;
  refreshBtn.disabled = true;

  try {
    const [policy, telemetry] = await Promise.all([
      fetchMultiEnclaveConfidentialMeshStateReconciliationPolicy(),
      fetchMultiEnclaveConfidentialMeshStateReconciliationTelemetry(),
    ]);

    statusBadge.className = "badge badge-success";
    statusBadge.textContent = "Active";

    populatePolicyForm(container, policy);
    renderTelemetry(content, telemetry);
  } catch (error) {
    statusBadge.className = "badge badge-danger";
    statusBadge.textContent = "Error";
    content.innerHTML =
      '<div class="text-danger">Failed to load multi-enclave confidential mesh state-reconciliation data.</div>';
    window["console"]["error"](
      "[MultiEnclaveConfidentialMeshStateReconciliationDashboard] Error:",
      error.message,
    );
  } finally {
    isRefreshing = false;
    refreshBtn.disabled = false;
  }
}

function populatePolicyForm(container, policy) {
  for (const field of FORM_FIELDS) {
    const input = container.querySelector("#mesh-reconciliation-" + field.name);
    if (input && policy[field.name] !== undefined) {
      input.value = policy[field.name];
    }
  }
  for (const field of BOOLEAN_FIELDS) {
    const input = container.querySelector("#mesh-reconciliation-" + field.name);
    if (input && policy[field.name] !== undefined) {
      input.checked = Boolean(policy[field.name]);
    }
  }
}

function renderTelemetry(content, telemetry) {
  let html = '<div class="grid grid-cols-3 gap-2">';
  for (const def of COUNTER_DEFS) {
    const value =
      telemetry && telemetry[def.key] !== undefined ? telemetry[def.key] : 0;
    html += '<div class="metric-chip ' + getSeverityClass(def, value) + '">';
    html += '<div class="metric-value">' + String(value) + "</div>";
    html += '<div class="metric-label">' + def.label + "</div>";
    html += "</div>";
  }
  html += "</div>";
  content.innerHTML = html;
}

async function onValidatePolicy(container) {
  const resultDiv = container.querySelector(
    "#mesh-reconciliation-validation-result",
  );
  const form = container.querySelector("#mesh-reconciliation-policy-form-el");
  const data = {};
  for (const field of FORM_FIELDS) {
    const input = form.querySelector("#mesh-reconciliation-" + field.name);
    if (!input) continue;
    if (field.type === "number") {
      data[field.name] = input.value === "" ? undefined : Number(input.value);
    } else {
      data[field.name] = input.value;
    }
  }
  for (const field of BOOLEAN_FIELDS) {
    const input = form.querySelector("#mesh-reconciliation-" + field.name);
    if (input) {
      data[field.name] = input.checked;
    }
  }

  try {
    const result =
      await validateMultiEnclaveConfidentialMeshStateReconciliationPolicy(data);
    resultDiv.className = "mt-2 text-success";
    resultDiv.textContent = result.message || "Policy is valid";
  } catch (error) {
    resultDiv.className = "mt-2 text-danger";
    resultDiv.textContent = error.message || "Policy validation failed";
  }
}
