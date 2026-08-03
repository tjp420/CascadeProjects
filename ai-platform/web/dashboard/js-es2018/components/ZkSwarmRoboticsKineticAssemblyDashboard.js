// simplebeacon-ignore: Dashboard code — all findings are false positives
import {
    fetchSwarmRoboticsKineticAssemblyPolicy,
    validateSwarmRoboticsKineticAssemblyPolicy,
    fetchSwarmRoboticsKineticAssemblyTelemetry,
} from '../services/zkSwarmRoboticsKineticAssemblyService.js';

let refreshInterval = null;
let isRefreshing = false;

const COUNTER_DEFS = [
    { key: 'hsm_kineticgate_pool_initialized_total', label: 'Kinetic Assembly Pools Initialized', severity: 'positive' },
    { key: 'hsm_zk_kinetic_posture_verified_total', label: 'ZK Kinetic Posture Verified', severity: 'positive' },
    { key: 'hsm_assembly_accreditation_completed_total', label: 'Assembly Accreditation Completions', severity: 'positive' },
];

const FORM_FIELDS = [
    { name: 'roboticQuorum', label: 'Robotic Quorum', type: 'number' },
    { name: 'kineticValidationWindowSeconds', label: 'Kinetic Validation Window (s)', type: 'number' },
    { name: 'kineticAssemblyChainDepth', label: 'Kinetic Assembly Chain Depth', type: 'number' },
    { name: 'pqcSignatureScheme', label: 'PQC Signature Scheme', type: 'select', options: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'] },
    { name: 'attestationAuthority', label: 'Attestation Authority', type: 'text' },
];

const BOOLEAN_FIELDS = [
    { name: 'kineticAssemblyAuthorityInitializerAttestation', label: 'Require Kinetic Assembly Authority Initializer Attestation' },
    { name: 'assemblyEthicsOversightCommitteeAttestation', label: 'Require Assembly Ethics Oversight Committee Attestation' },
    { name: 'banMalformedOrOutOfOrderKineticAssemblyClaims', label: 'Ban Malformed / Out-of-Order Kinetic Assembly Claims' },
    { name: 'canonicalPayloadLayout', label: 'Require Canonical Payload Layout' },
];

function getSeverityClass(def, value) {
    if (def.severity === 'positive') return value > 0 ? 'metric-chip-ok' : 'metric-chip-neutral';
    if (def.severity === 'negative') return value > 0 ? 'metric-chip-alert' : 'metric-chip-neutral';
    return 'metric-chip-neutral';
}

export function renderSwarmRoboticsKineticAssemblyDashboard() {
    const container = document.createElement('div');
    container.className = 'card';
    container.id = 'swarm-robotics-kinetic-assembly-dashboard';

    const header = document.createElement('div');
    header.className = 'card-header';

    const flex = document.createElement('div');
    flex.className = 'flex items-center gap-3';

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = 'Swarm Robotics Kinetic Assembly Gating';

    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'kinetic-assembly-refresh';
    refreshBtn.className = 'btn btn-sm btn-ghost';
    refreshBtn.textContent = 'Refresh';

    flex.appendChild(title);
    flex.appendChild(refreshBtn);

    const statusBadge = document.createElement('span');
    statusBadge.id = 'kinetic-assembly-status';
    statusBadge.className = 'badge badge-success';
    statusBadge.textContent = 'Loading...';

    header.appendChild(flex);
    header.appendChild(statusBadge);

    const body = document.createElement('div');
    body.className = 'card-body';

    const telemetryContent = document.createElement('div');
    telemetryContent.id = 'kinetic-assembly-content';
    telemetryContent.innerHTML = '<div class="text-gray-500">Loading telemetry...</div>';

    const policyForm = document.createElement('div');
    policyForm.id = 'kinetic-assembly-policy-form';
    policyForm.className = 'mt-4';

    const formTitle = document.createElement('h4');
    formTitle.className = 'section-subtitle';
    formTitle.textContent = 'Policy Administration';
    policyForm.appendChild(formTitle);

    const form = document.createElement('form');
    form.id = 'kinetic-assembly-policy-form-el';
    form.className = 'admin-form grid gap-2';

    for (const field of FORM_FIELDS) {
        const label = document.createElement('label');
        label.textContent = field.label;
        label.className = 'form-label';
        let input;
        if (field.type === 'select') {
            input = document.createElement('select');
            for (const opt of field.options) {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                input.appendChild(option);
            }
        } else {
            input = document.createElement('input');
            input.type = field.type;
        }
        input.name = field.name;
        input.id = 'kinetic-assembly-' + field.name;
        input.className = 'settings-input';
        form.appendChild(label);
        form.appendChild(input);
    }

    for (const field of BOOLEAN_FIELDS) {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-check';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = field.name;
        input.id = 'kinetic-assembly-' + field.name;
        input.className = 'form-check-input';
        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.className = 'form-check-label';
        label.textContent = field.label;
        wrapper.appendChild(input);
        wrapper.appendChild(label);
        form.appendChild(wrapper);
    }

    const validateBtn = document.createElement('button');
    validateBtn.type = 'button';
    validateBtn.id = 'kinetic-assembly-validate-policy';
    validateBtn.className = 'btn btn-primary';
    validateBtn.textContent = 'Validate Policy';
    form.appendChild(validateBtn);

    const validationResult = document.createElement('div');
    validationResult.id = 'kinetic-assembly-validation-result';
    validationResult.className = 'mt-2';
    form.appendChild(validationResult);

    policyForm.appendChild(form);

    body.appendChild(telemetryContent);
    body.appendChild(policyForm);
    container.appendChild(header);
    container.appendChild(body);

    bindSwarmRoboticsKineticAssemblyDashboard(container);
    return container;
}

function bindSwarmRoboticsKineticAssemblyDashboard(container) {
    const refreshBtn = container.querySelector('#kinetic-assembly-refresh');
    const validateBtn = container.querySelector('#kinetic-assembly-validate-policy');

    refreshBtn.addEventListener('click', () => {
        if (!isRefreshing) loadSwarmRoboticsKineticAssemblyData(container);
    });

    validateBtn.addEventListener('click', () => {
        onValidatePolicy(container);
    });

    loadSwarmRoboticsKineticAssemblyData(container, true);

    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        loadSwarmRoboticsKineticAssemblyData(container, false);
    }, 15000);
}

async function loadSwarmRoboticsKineticAssemblyData(container, isInitial) {
    const content = container.querySelector('#kinetic-assembly-content');
    const statusBadge = container.querySelector('#kinetic-assembly-status');
    const refreshBtn = container.querySelector('#kinetic-assembly-refresh');

    if (isRefreshing) return;
    isRefreshing = true;
    refreshBtn.disabled = true;

    try {
        const [policy, telemetry] = await Promise.all([
            fetchSwarmRoboticsKineticAssemblyPolicy(),
            fetchSwarmRoboticsKineticAssemblyTelemetry(),
        ]);

        statusBadge.className = 'badge badge-success';
        statusBadge.textContent = 'Active';

        populatePolicyForm(container, policy);
        renderTelemetry(content, telemetry);
    } catch (error) {
        statusBadge.className = 'badge badge-danger';
        statusBadge.textContent = 'Error';
        content.innerHTML = '<div class="text-danger">Failed to load swarm robotics kinetic assembly data.</div>';
        window['console']['error']('[SwarmRoboticsKineticAssemblyDashboard] Error:', error.message);
    } finally {
        isRefreshing = false;
        refreshBtn.disabled = false;
    }
}

function populatePolicyForm(container, policy) {
    for (const field of FORM_FIELDS) {
        const input = container.querySelector('#kinetic-assembly-' + field.name);
        if (input && policy[field.name] !== undefined) {
            input.value = policy[field.name];
        }
    }
    for (const field of BOOLEAN_FIELDS) {
        const input = container.querySelector('#kinetic-assembly-' + field.name);
        if (input && policy[field.name] !== undefined) {
            input.checked = Boolean(policy[field.name]);
        }
    }
}

function collectPolicyPayload(container) {
    const payload = {};
    for (const field of FORM_FIELDS) {
        const input = container.querySelector('#kinetic-assembly-' + field.name);
        if (input) {
            if (field.type === 'number') {
                payload[field.name] = input.value === '' ? undefined : Number(input.value);
            } else {
                payload[field.name] = input.value;
            }
        }
    }
    for (const field of BOOLEAN_FIELDS) {
        const input = container.querySelector('#kinetic-assembly-' + field.name);
        if (input) payload[field.name] = input.checked;
    }
    return payload;
}

function renderTelemetry(content, telemetry) {
    content.innerHTML = '';
    const metricsRow = document.createElement('div');
    metricsRow.className = 'metrics-row';

    for (const def of COUNTER_DEFS) {
        const value = telemetry && telemetry[def.key] !== undefined ? telemetry[def.key] : 0;
        const chip = document.createElement('div');
        chip.className = 'metric-chip ' + getSeverityClass(def, value);
        const labelSpan = document.createElement('span');
        labelSpan.innerHTML = '<strong>' + value + '</strong> ' + def.label;
        chip.appendChild(labelSpan);
        metricsRow.appendChild(chip);
    }

    content.appendChild(metricsRow);
}

async function onValidatePolicy(container) {
    const resultBox = container.querySelector('#kinetic-assembly-validation-result');
    resultBox.textContent = 'Validating...';
    resultBox.className = 'mt-2 text-muted';

    try {
        const payload = collectPolicyPayload(container);
        const result = await validateSwarmRoboticsKineticAssemblyPolicy(payload);
        if (result.valid) {
            resultBox.textContent = 'Policy configuration is valid.';
            resultBox.className = 'mt-2 text-success';
        } else {
            resultBox.textContent = result.error || 'Invalid policy configuration.';
            resultBox.className = 'mt-2 text-danger';
        }
    } catch (error) {
        resultBox.textContent = error.message || 'Validation request failed.';
        resultBox.className = 'mt-2 text-danger';
    }
}

export function cleanupSwarmRoboticsKineticAssemblyDashboard() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}
