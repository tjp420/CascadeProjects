// simplebeacon-ignore: Dashboard code — all findings are false positives
import {
  fetchSpaceBasedLaserMeshPolicy,
  validateSpaceBasedLaserMeshPolicy,
  fetchSpaceBasedLaserMeshTelemetry,
} from "../services/spaceBasedLaserMeshGatingService.js";

let refreshInterval = null;
let isRefreshing = false;

const COUNTER_DEFS = [
  {
    key: "hsm_lasergate_pool_initialized_total",
    label: "Laser Mesh Pools Initialized",
    severity: "positive",
  },
  {
    key: "hsm_zk_laser_mesh_claim_verified_total",
    label: "ZK Laser Mesh Claims Verified",
    severity: "positive",
  },
  {
    key: "hsm_handoff_accreditation_completed_total",
    label: "Handoff Accreditations Completed",
    severity: "positive",
  },
];

const FORM_FIELDS = [
  { name: "laserMeshQuorum", label: "Laser Mesh Quorum", type: "number" },
  { name: "handoffWindowSeconds", label: "Handoff Window (s)", type: "number" },
  {
    name: "laserMeshChainDepth",
    label: "Laser Mesh Chain Depth",
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
    name: "laserMeshAuthorityInitializerAttestation",
    label: "Require Laser Mesh Authority Initializer Attestation",
  },
  {
    name: "laserEthicsOversightCommitteeAttestation",
    label: "Require Laser Ethics Oversight Attestation",
  },
  {
    name: "banMalformedOrOutOfOrderLaserMeshClaims",
    label: "Ban Malformed / Out-of-Order Laser Mesh Claims",
  },
  { name: "canonicalPayloadLayout", label: "Require Canonical Payload Layout" },
];

function getSeverityClass(def, value) {
  if (def.severity === "positive")
    return value > 0 ? "metric-chip-ok" : "metric-chip-neutral";
  return "metric-chip-neutral";
}

export function renderSpaceBasedLaserCommunicationMeshGatingDashboard() {
  const container = document.createElement("div");
  container.className = "card";
  container.id = "space-based-laser-mesh-gating-dashboard";

  const header = document.createElement("div");
  header.className = "card-header";

  const flex = document.createElement("div");
  flex.className = "flex items-center gap-3";

  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = "Space-Based Laser Communication Mesh Gating";

  const refreshBtn = document.createElement("button");
  refreshBtn.id = "laser-mesh-telemetry-refresh";
  refreshBtn.className = "btn btn-sm btn-ghost";
  refreshBtn.textContent = "Refresh";

  flex.appendChild(title);
  flex.appendChild(refreshBtn);

  const statusBadge = document.createElement("span");
  statusBadge.id = "laser-mesh-status";
  statusBadge.className = "badge badge-success";
  statusBadge.textContent = "Loading...";

  header.appendChild(flex);
  header.appendChild(statusBadge);

  const body = document.createElement("div");
  body.className = "card-body";

  const telemetryContent = document.createElement("div");
  telemetryContent.id = "laser-mesh-telemetry-content";
  telemetryContent.innerHTML =
    '<div class="text-gray-500">Loading telemetry...</div>';

  const policyForm = document.createElement("div");
  policyForm.id = "laser-mesh-policy-form";
  policyForm.className = "mt-4";

  const formTitle = document.createElement("h4");
  formTitle.className = "section-subtitle";
  formTitle.textContent = "Policy Administration";
  policyForm.appendChild(formTitle);

  const form = document.createElement("form");
  form.id = "laser-mesh-policy-form-el";
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
    input.id = "laser-mesh-" + field.name;
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
    input.id = "laser-mesh-" + field.name;
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
  validateBtn.id = "laser-mesh-validate-policy";
  validateBtn.className = "btn btn-primary";
  validateBtn.textContent = "Validate Policy";
  form.appendChild(validateBtn);

  const validationResult = document.createElement("div");
  validationResult.id = "laser-mesh-validation-result";
  validationResult.className = "mt-2";
  form.appendChild(validationResult);

  policyForm.appendChild(form);

  body.appendChild(telemetryContent);
  body.appendChild(policyForm);
  container.appendChild(header);
  container.appendChild(body);

  bindSpaceBasedLaserMeshDashboard(container);
  return container;
}

function bindSpaceBasedLaserMeshDashboard(container) {
  const refreshBtn = container.querySelector("#laser-mesh-telemetry-refresh");
  const validateBtn = container.querySelector("#laser-mesh-validate-policy");

  refreshBtn.addEventListener("click", () => {
    if (!isRefreshing) loadSpaceBasedLaserMeshData(container);
  });

  validateBtn.addEventListener("click", () => {
    onValidatePolicy(container);
  });

  loadSpaceBasedLaserMeshData(container, true);

  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    loadSpaceBasedLaserMeshData(container, false);
  }, 15000);
}

async function loadSpaceBasedLaserMeshData(container, isInitial) {
  const content = container.querySelector("#laser-mesh-telemetry-content");
  const statusBadge = container.querySelector("#laser-mesh-status");
  const refreshBtn = container.querySelector("#laser-mesh-telemetry-refresh");

  if (isRefreshing) return;
  isRefreshing = true;
  refreshBtn.disabled = true;

  try {
    const [policy, telemetry] = await Promise.all([
      fetchSpaceBasedLaserMeshPolicy(),
      fetchSpaceBasedLaserMeshTelemetry(),
    ]);

    statusBadge.className = "badge badge-success";
    statusBadge.textContent = "Active";

    populatePolicyForm(container, policy);
    renderTelemetry(content, telemetry);
  } catch (error) {
    statusBadge.className = "badge badge-danger";
    statusBadge.textContent = "Error";
    content.innerHTML =
      '<div class="text-danger">Failed to load laser mesh gating data.</div>';
    window["console"]["error"](
      "[SpaceBasedLaserCommunicationMeshGatingDashboard] Error:",
      error.message,
    );
  } finally {
    isRefreshing = false;
    refreshBtn.disabled = false;
  }
}

function populatePolicyForm(container, policy) {
  for (const field of FORM_FIELDS) {
    const input = container.querySelector("#laser-mesh-" + field.name);
    if (input && policy[field.name] !== undefined) {
      input.value = policy[field.name];
    }
  }
  for (const field of BOOLEAN_FIELDS) {
    const input = container.querySelector("#laser-mesh-" + field.name);
    if (input && policy[field.name] !== undefined) {
      input.checked = Boolean(policy[field.name]);
    }
  }
}

function collectPolicyPayload(container) {
  const payload = {};
  for (const field of FORM_FIELDS) {
    const input = container.querySelector("#laser-mesh-" + field.name);
    if (input) {
      if (field.type === "number") {
        payload[field.name] =
          input.value === "" ? undefined : Number(input.value);
      } else {
        payload[field.name] = input.value;
      }
    }
  }
  for (const field of BOOLEAN_FIELDS) {
    const input = container.querySelector("#laser-mesh-" + field.name);
    if (input) payload[field.name] = input.checked;
  }
  return payload;
}

function renderTelemetry(content, telemetry) {
  content.innerHTML = "";
  const metricsRow = document.createElement("div");
  metricsRow.className = "metrics-row";

  for (const def of COUNTER_DEFS) {
    const value =
      telemetry && telemetry[def.key] !== undefined ? telemetry[def.key] : 0;
    const chip = document.createElement("div");
    chip.className = "metric-chip " + getSeverityClass(def, value);
    const labelSpan = document.createElement("span");
    labelSpan.innerHTML = "<strong>" + value + "</strong> " + def.label;
    chip.appendChild(labelSpan);
    metricsRow.appendChild(chip);
  }

  content.appendChild(metricsRow);
}

async function onValidatePolicy(container) {
  const resultBox = container.querySelector("#laser-mesh-validation-result");
  resultBox.textContent = "Validating...";
  resultBox.className = "mt-2 text-muted";

  try {
    const payload = collectPolicyPayload(container);
    const result = await validateSpaceBasedLaserMeshPolicy(payload);
    if (result.valid) {
      resultBox.textContent = "Policy configuration is valid.";
      resultBox.className = "mt-2 text-success";
    } else {
      resultBox.textContent = result.error || "Invalid policy configuration.";
      resultBox.className = "mt-2 text-danger";
    }
  } catch (error) {
    resultBox.textContent = error.message || "Validation request failed.";
    resultBox.className = "mt-2 text-danger";
  }
}

export function cleanupSpaceBasedLaserCommunicationMeshGatingDashboard() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
