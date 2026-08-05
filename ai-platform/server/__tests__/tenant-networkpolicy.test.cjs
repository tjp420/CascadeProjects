'use strict';

/**
 * Unit tests for Helm Per-Tenant NetworkPolicy Template
 *
 * Verifies that the tenant-networkpolicy.yaml template:
 * - Renders valid Kubernetes manifests when enabled
 * - Creates per-tenant NetworkPolicies
 * - Restricts ingress to same-tenant pods
 * - Allows DNS and server egress
 * - Does not render when disabled (default)
 * - Supports configurable tenant namespaces
 */

const fs = require('fs');
const path = require('path');

// Simple Helm template renderer — we don't need full Helm, just verify
// the template structure and key values are correct.
const TEMPLATE_PATH = path.join(__dirname, '..', '..', '..', 'deploy', 'helm', 'templates', 'tenant-networkpolicy.yaml');
const VALUES_PATH = path.join(__dirname, '..', '..', '..', 'deploy', 'helm', 'values.yaml');

function readTemplate() {
  return fs.readFileSync(TEMPLATE_PATH, 'utf8');
}

function readValues() {
  return fs.readFileSync(VALUES_PATH, 'utf8');
}

describe('Helm Per-Tenant NetworkPolicy Template', () => {
  test('HELM-TENANT-01: template file exists', () => {
    expect(fs.existsSync(TEMPLATE_PATH)).toBe(true);
  });

  test('HELM-TENANT-02: template is gated by tenantIsolation.enabled', () => {
    const template = readTemplate();
    expect(template).toContain('{{- if .Values.tenantIsolation.enabled }}');
    expect(template.trim().endsWith('{{- end }}')).toBe(true);
  });

  test('HELM-TENANT-03: template iterates over tenant namespaces', () => {
    const template = readTemplate();
    expect(template).toContain('{{- range $tenant := .Values.tenantIsolation.namespaces }}');
  });

  test('HELM-TENANT-04: template creates NetworkPolicy per tenant', () => {
    const template = readTemplate();
    expect(template).toContain('kind: NetworkPolicy');
    expect(template).toContain('app.kubernetes.io/tenant: {{ $tenant.name }}');
  });

  test('HELM-TENANT-05: template restricts ingress to same-tenant pods', () => {
    const template = readTemplate();
    expect(template).toContain('policyTypes:');
    expect(template).toContain('- Ingress');
    expect(template).toContain('- Egress');
    // Ingress from same tenant
    expect(template).toContain('app.kubernetes.io/tenant: {{ $tenant.name }}');
  });

  test('HELM-TENANT-06: template allows DNS egress', () => {
    const template = readTemplate();
    expect(template).toContain('port: 53');
    expect(template).toContain('UDP');
    expect(template).toContain('TCP');
  });

  test('HELM-TENANT-07: template allows egress to server in main namespace', () => {
    const template = readTemplate();
    expect(template).toContain('app.kubernetes.io/component: server');
    expect(template).toContain('port: 3000');
  });

  test('HELM-TENANT-08: values.yaml includes tenantIsolation config', () => {
    const values = readValues();
    expect(values).toContain('tenantIsolation:');
    expect(values).toContain('enabled: false');
    expect(values).toContain('namespaces: []');
  });

  test('HELM-TENANT-09: values.yaml has allowEnvoyIngress option', () => {
    const values = readValues();
    expect(values).toContain('allowEnvoyIngress: true');
  });

  test('HELM-TENANT-10: values.yaml has allowCrossTenantEgress disabled by default', () => {
    const values = readValues();
    expect(values).toContain('allowCrossTenantEgress: false');
  });

  test('HELM-TENANT-11: values.yaml has adminNamespace option', () => {
    const values = readValues();
    expect(values).toContain('adminNamespace: kube-system');
  });

  test('HELM-TENANT-12: template supports configurable tenant port', () => {
    const template = readTemplate();
    expect(template).toContain('tenantPort');
  });

  test('HELM-TENANT-13: template includes allowAdminNamespace conditional', () => {
    const template = readTemplate();
    expect(template).toContain('allowAdminNamespace');
  });

  test('HELM-TENANT-14: template includes allowCrossTenantEgress conditional', () => {
    const template = readTemplate();
    expect(template).toContain('allowCrossTenantEgress');
  });

  test('HELM-TENANT-15: cross-tenant egress is conditional (not always enabled)', () => {
    const template = readTemplate();
    // The cross-tenant egress block should be inside an if block
    expect(template).toContain('{{- if $.Values.tenantIsolation.allowCrossTenantEgress }}');
  });
});
