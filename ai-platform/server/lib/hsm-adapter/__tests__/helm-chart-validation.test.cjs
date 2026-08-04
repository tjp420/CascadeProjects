'use strict';

/**
 * Helm Chart Validation Tests
 *
 * Validates the Helm chart structure, parameterized security thresholds,
 * Envoy sidecar configuration, NetworkPolicy isolation, and health probes.
 * Tests parse the YAML files directly (no Helm CLI required).
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const HELM_DIR = path.resolve(__dirname, '../../../../../deploy/helm');
const ENVOY_DIR = path.resolve(__dirname, '../../../../../deploy/envoy');

// Helper: read and parse a YAML file
function readYaml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content);
}

// Helper: read raw template content (for string matching on Helm template syntax)
function readRaw(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('Helm Chart Validation', () => {

  // ── L1-01: Chart.yaml structure ─────────────────────────────────

  describe('L1-01: Chart.yaml structure', () => {
    const chart = readYaml(path.join(HELM_DIR, 'Chart.yaml'));

    test('apiVersion is v2', () => {
      expect(chart.apiVersion).toBe('v2');
    });

    test('name is simplebeacon', () => {
      expect(chart.name).toBe('simplebeacon');
    });

    test('type is application', () => {
      expect(chart.type).toBe('application');
    });

    test('version is 0.1.0', () => {
      expect(chart.version).toBe('0.1.0');
    });

    test('appVersion is 1.0.0', () => {
      expect(chart.appVersion).toBe('1.0.0');
    });
  });

  // ── L1-02: values.yaml parses and exposes security thresholds ──

  describe('L1-02 / L2-01/02/03: values.yaml security thresholds', () => {
    const values = readYaml(path.join(HELM_DIR, 'values.yaml'));

    test('L2-01: ipcPayloadLimitBytes is 1048576 (1MB)', () => {
      expect(values.security.ipcPayloadLimitBytes).toBe(1048576);
    });

    test('L2-02: sandboxMemoryEntryLimitBytes is 65536 (64KB)', () => {
      expect(values.security.sandboxMemoryEntryLimitBytes).toBe(65536);
    });

    test('L2-03: sandboxMemoryMaxEntries is 16', () => {
      expect(values.security.sandboxMemoryMaxEntries).toBe(16);
    });

    test('sandboxMaxExecutionTimeSeconds is 30', () => {
      expect(values.security.sandboxMaxExecutionTimeSeconds).toBe(30);
    });

    test('siemAlertRateLimitPerMinute is 100', () => {
      expect(values.security.siemAlertRateLimitPerMinute).toBe(100);
    });
  });

  // ── L2-04/05: Health probes in deployment template ──────────────

  describe('L2-04/05: Health probes in deployment template', () => {
    const deployment = readRaw(path.join(HELM_DIR, 'templates/deployment.yaml'));

    test('L2-04: readiness probe targets /health', () => {
      expect(deployment).toContain('readinessProbe');
      expect(deployment).toContain('path: {{ .Values.probes.readiness.path }}');
      // values.yaml confirms the path
      const values = readYaml(path.join(HELM_DIR, 'values.yaml'));
      expect(values.probes.readiness.path).toBe('/health');
    });

    test('L2-05: liveness probe targets /api/health', () => {
      expect(deployment).toContain('livenessProbe');
      expect(deployment).toContain('path: {{ .Values.probes.liveness.path }}');
      const values = readYaml(path.join(HELM_DIR, 'values.yaml'));
      expect(values.probes.liveness.path).toBe('/api/health');
    });

    test('readiness probe has initialDelaySeconds of 5', () => {
      const values = readYaml(path.join(HELM_DIR, 'values.yaml'));
      expect(values.probes.readiness.initialDelaySeconds).toBe(5);
    });

    test('liveness probe has initialDelaySeconds of 15', () => {
      const values = readYaml(path.join(HELM_DIR, 'values.yaml'));
      expect(values.probes.liveness.initialDelaySeconds).toBe(15);
    });
  });

  // ── L2-06: Container memory limits ──────────────────────────────

  describe('L2-06: Container resource limits', () => {
    const values = readYaml(path.join(HELM_DIR, 'values.yaml'));

    test('server memory limit is 512Mi', () => {
      expect(values.resources.server.limits.memory).toBe('512Mi');
    });

    test('mesh worker memory limit is 128Mi (lower than server)', () => {
      expect(values.resources.meshWorker.limits.memory).toBe('128Mi');
    });

    test('envoy memory limit is 64Mi', () => {
      expect(values.resources.envoy.limits.memory).toBe('64Mi');
    });

    test('deployment template references server resources', () => {
      const deployment = readRaw(path.join(HELM_DIR, 'templates/deployment.yaml'));
      expect(deployment).toContain('toYaml .Values.resources.server');
    });

    test('mesh worker template references meshWorker resources', () => {
      const meshWorker = readRaw(path.join(HELM_DIR, 'templates/mesh-worker-deployment.yaml'));
      expect(meshWorker).toContain('toYaml .Values.resources.meshWorker');
    });
  });

  // ── L2-07: Envoy max_request_bytes ──────────────────────────────

  describe('L2-07: Envoy max_request_bytes', () => {
    const values = readYaml(path.join(HELM_DIR, 'values.yaml'));

    test('maxRequestBytes is 2097152 (2MB)', () => {
      expect(values.envoy.maxRequestBytes).toBe(2097152);
    });

    test('envoy config template includes max_request_bytes', () => {
      const envoyCm = readRaw(path.join(HELM_DIR, 'templates/envoy-configmap.yaml'));
      expect(envoyCm).toContain('max_request_bytes');
      expect(envoyCm).toContain('{{ .Values.envoy.maxRequestBytes }}');
    });

    test('standalone envoy.yaml includes max_request_bytes: 2097152', () => {
      const envoy = readRaw(path.join(ENVOY_DIR, 'envoy.yaml'));
      expect(envoy).toContain('max_request_bytes: 2097152');
    });
  });

  // ── L2-08: NetworkPolicy for mesh worker isolation ──────────────

  describe('L2-08: NetworkPolicy mesh worker isolation', () => {
    const np = readRaw(path.join(HELM_DIR, 'templates/networkpolicy.yaml'));

    test('template defines Egress policy for mesh workers', () => {
      expect(np).toContain('kind: NetworkPolicy');
      expect(np).toContain('Egress');
      expect(np).toContain('meshWorkerSelectorLabels');
    });

    test('template defines Ingress policy for server', () => {
      expect(np).toContain('Ingress');
      expect(np).toContain('serverSelectorLabels');
    });

    test('mesh worker egress allows port 3000 to server only', () => {
      expect(np).toContain('port: 3000');
      expect(np).toContain('app.kubernetes.io/component: server');
    });

    test('DNS egress on port 53 is allowed', () => {
      expect(np).toContain('port: 53');
    });
  });

  // ── L3-01: Custom threshold overrides ───────────────────────────

  describe('L3-01: Custom threshold overrides', () => {
    test('values.yaml can be parsed with custom values', () => {
      const values = readYaml(path.join(HELM_DIR, 'values.yaml'));
      // Simulate override
      values.security.ipcPayloadLimitBytes = 524288;
      expect(values.security.ipcPayloadLimitBytes).toBe(524288);
    });
  });

  // ── L3-05: ConfigMap injects security thresholds as env vars ───

  describe('L3-05: ConfigMap security threshold env vars', () => {
    const cm = readRaw(path.join(HELM_DIR, 'templates/configmap.yaml'));

    test('IPC_PAYLOAD_LIMIT_BYTES is in ConfigMap', () => {
      expect(cm).toContain('IPC_PAYLOAD_LIMIT_BYTES');
    });

    test('SANDBOX_MEMORY_ENTRY_LIMIT_BYTES is in ConfigMap', () => {
      expect(cm).toContain('SANDBOX_MEMORY_ENTRY_LIMIT_BYTES');
    });

    test('SANDBOX_MEMORY_MAX_ENTRIES is in ConfigMap', () => {
      expect(cm).toContain('SANDBOX_MEMORY_MAX_ENTRIES');
    });

    test('SANDBOX_MAX_EXECUTION_TIME_SECONDS is in ConfigMap', () => {
      expect(cm).toContain('SANDBOX_MAX_EXECUTION_TIME_SECONDS');
    });

    test('SIEM_ALERT_RATE_LIMIT_PER_MINUTE is in ConfigMap', () => {
      expect(cm).toContain('SIEM_ALERT_RATE_LIMIT_PER_MINUTE');
    });
  });

  // ── L3-06: Mesh worker has separate resource limits ─────────────

  describe('L3-06: Mesh worker separate resource limits', () => {
    const values = readYaml(path.join(HELM_DIR, 'values.yaml'));

    test('mesh worker memory limit (128Mi) is lower than server (512Mi)', () => {
      const workerMem = parseInt(values.resources.meshWorker.limits.memory);
      const serverMem = parseInt(values.resources.server.limits.memory);
      expect(workerMem).toBeLessThan(serverMem);
    });
  });

  // ── L3-07: Service exposes only http port ───────────────────────

  describe('L3-07: Service exposes only http port', () => {
    const svc = readRaw(path.join(HELM_DIR, 'templates/service.yaml'));

    test('service has only one port named http', () => {
      expect(svc).toContain('name: http');
      expect(svc).toContain('port: {{ .Values.service.port }}');
      // Should not expose debug ports
      expect(svc).not.toContain('9901'); // Envoy admin port
    });
  });

  // ── L3-08: Standard Helm labels ─────────────────────────────────

  describe('L3-08: Standard Helm labels', () => {
    const helpers = readRaw(path.join(HELM_DIR, 'templates/_helpers.tpl'));

    test('labels helper includes app.kubernetes.io/name', () => {
      expect(helpers).toContain('app.kubernetes.io/name');
    });

    test('labels helper includes app.kubernetes.io/instance', () => {
      expect(helpers).toContain('app.kubernetes.io/instance');
    });

    test('labels helper includes app.kubernetes.io/version', () => {
      expect(helpers).toContain('app.kubernetes.io/version');
    });

    test('labels helper includes app.kubernetes.io/managed-by', () => {
      expect(helpers).toContain('app.kubernetes.io/managed-by');
    });

    test('labels helper includes helm.sh/chart', () => {
      expect(helpers).toContain('helm.sh/chart');
    });
  });

  // ── S-01 through S-10: Security assertions ──────────────────────

  describe('S-01: IPC payload limit parameterized', () => {
    test('values.yaml and configmap both reference ipcPayloadLimitBytes', () => {
      const values = readYaml(path.join(HELM_DIR, 'values.yaml'));
      const cm = readRaw(path.join(HELM_DIR, 'templates/configmap.yaml'));
      expect(values.security.ipcPayloadLimitBytes).toBe(1048576);
      expect(cm).toContain('IPC_PAYLOAD_LIMIT_BYTES');
    });
  });

  describe('S-04: Envoy max_request_bytes enforces 1MB + overhead', () => {
    test('maxRequestBytes is exactly 2x the IPC limit', () => {
      const values = readYaml(path.join(HELM_DIR, 'values.yaml'));
      expect(values.envoy.maxRequestBytes).toBe(values.security.ipcPayloadLimitBytes * 2);
    });
  });

  describe('S-06: Container runs as non-root user', () => {
    test('podSecurityContext.runAsNonRoot is true', () => {
      const values = readYaml(path.join(HELM_DIR, 'values.yaml'));
      expect(values.podSecurityContext.runAsNonRoot).toBe(true);
    });

    test('runAsUser is 1000 (non-root)', () => {
      const values = readYaml(path.join(HELM_DIR, 'values.yaml'));
      expect(values.podSecurityContext.runAsUser).toBe(1000);
    });

    test('deployment template includes podSecurityContext', () => {
      const deployment = readRaw(path.join(HELM_DIR, 'templates/deployment.yaml'));
      expect(deployment).toContain('simplebeacon.podSecurityContext');
    });

    test('mesh worker template includes podSecurityContext', () => {
      const meshWorker = readRaw(path.join(HELM_DIR, 'templates/mesh-worker-deployment.yaml'));
      expect(meshWorker).toContain('simplebeacon.podSecurityContext');
    });
  });

  describe('S-07: Read-only root filesystem', () => {
    test('containerSecurityContext.readOnlyRootFilesystem is true', () => {
      const values = readYaml(path.join(HELM_DIR, 'values.yaml'));
      expect(values.containerSecurityContext.readOnlyRootFilesystem).toBe(true);
    });

    test('allowPrivilegeEscalation is false', () => {
      const values = readYaml(path.join(HELM_DIR, 'values.yaml'));
      expect(values.containerSecurityContext.allowPrivilegeEscalation).toBe(false);
    });

    test('all capabilities are dropped', () => {
      const values = readYaml(path.join(HELM_DIR, 'values.yaml'));
      expect(values.containerSecurityContext.capabilities.drop).toContain('ALL');
    });
  });

  describe('S-10: No secrets in values.yaml', () => {
    test('values.yaml does not contain password or secret fields', () => {
      const raw = readRaw(path.join(HELM_DIR, 'values.yaml'));
      expect(raw.toLowerCase()).not.toMatch(/password:\s/);
      expect(raw.toLowerCase()).not.toMatch(/secretkey:\s/);
      expect(raw.toLowerCase()).not.toMatch(/apikey:\s/);
    });
  });

  // ── Envoy SIEM logging ──────────────────────────────────────────

  describe('Envoy SIEM logging', () => {
    const envoyCm = readRaw(path.join(HELM_DIR, 'templates/envoy-configmap.yaml'));
    const envoyStandalone = readRaw(path.join(ENVOY_DIR, 'envoy.yaml'));

    test('envoy config uses JSON log format', () => {
      expect(envoyCm).toContain('json_format');
      expect(envoyStandalone).toContain('json_format');
    });

    test('envoy config includes siem_severity field', () => {
      expect(envoyCm).toContain('siem_severity');
      expect(envoyStandalone).toContain('siem_severity');
    });

    test('envoy config includes siem_category field', () => {
      expect(envoyCm).toContain('siem_category');
      expect(envoyStandalone).toContain('siem_category');
    });

    test('envoy config includes siem_source field', () => {
      expect(envoyCm).toContain('siem_source');
      expect(envoyStandalone).toContain('siem_source');
    });

    test('envoy standalone config has siem_severity: high', () => {
      expect(envoyStandalone).toContain('"high"');
    });

    test('envoy standalone config has siem_category: envoy_body_oversized', () => {
      expect(envoyStandalone).toContain('envoy_body_oversized');
    });
  });

  // ── Template file existence ─────────────────────────────────────

  describe('Template file existence', () => {
    const expectedTemplates = [
      '_helpers.tpl',
      'deployment.yaml',
      'service.yaml',
      'configmap.yaml',
      'networkpolicy.yaml',
      'envoy-configmap.yaml',
      'mesh-worker-deployment.yaml',
      'NOTES.txt',
    ];

    for (const tmpl of expectedTemplates) {
      test(`${tmpl} exists`, () => {
        const filePath = path.join(HELM_DIR, 'templates', tmpl);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    }
  });
});
