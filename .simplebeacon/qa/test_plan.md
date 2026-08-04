# Test Plan: Container Orchestration Limits — Helm + Envoy Infrastructure Sprint

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Kubernetes Helm chart with parameterized security thresholds, Envoy sidecar for IPC body sizing, NetworkPolicy for mesh worker isolation, readiness/liveness probes |
| Author (Builder) | Devin |
| Date | 2026-08-04 |
| Branch | `feat/orchestration-helm-envoy` |
| Packages touched | `deploy/helm/` (new), `deploy/envoy/` (new) |

## Scope

### Files in scope (all new)

- `deploy/helm/Chart.yaml` — Helm chart metadata
- `deploy/helm/values.yaml` — Parameterized security thresholds
- `deploy/helm/templates/_helpers.tpl` — Template helpers
- `deploy/helm/templates/deployment.yaml` — ai-platform server deployment
- `deploy/helm/templates/service.yaml` — ClusterIP service
- `deploy/helm/templates/configmap.yaml` — Application configuration
- `deploy/helm/templates/networkpolicy.yaml` — Mesh worker isolation
- `deploy/helm/templates/envoy-configmap.yaml` — Envoy sidecar configuration
- `deploy/helm/templates/envoy-deployment.yaml` — Envoy egress sidecar (optional)
- `deploy/helm/templates/mesh-worker-deployment.yaml` — Mesh load worker deployment
- `deploy/envoy/envoy.yaml` — Standalone Envoy config reference
- `deploy/helm/templates/NOTES.txt` — Post-install notes
- `ai-platform/server/lib/hsm-adapter/__tests__/helm-chart-validation.test.cjs` — Validation tests

### Existing infrastructure (no changes)

- `ai-platform/server/index.cjs` — Express server on port 3000, `/health` endpoint at line 1223
- `ai-platform/server/routes/health-routes.cjs` — `/api/health`, `/api/health/db`, `/api/health/redis` endpoints
- `ai-platform/server/bootstrap/phase2-integration.cjs` — Phase 2 health endpoints
- `ai-platform/docker-compose.phase2.yml` — Existing Docker Compose (untouched)
- `ai-platform/nginx/nginx.conf` — Existing Nginx config (untouched)

### UI / IDE surfaces

- [ ] Not applicable — infrastructure-only

---

## Repository scan findings

### Pre-existing K8s/Helm config: NONE

- Zero Kubernetes manifests found
- Zero Helm charts found
- Zero Envoy configurations found
- Zero NetworkPolicies found
- Documentation references `deploy/k8s/pv/persistent-volume.yaml` but file does not exist
- This is a **greenfield** Helm chart implementation

### Existing Docker infrastructure

| File | Purpose | Port |
|------|---------|------|
| `ai-platform/pipeline/Dockerfile` | Python FastAPI pipeline | 8000 |
| `coming-soon/Dockerfile` | Node.js frontend | 3001 |
| `ai-platform/docker-compose.phase2.yml` | PostgreSQL + Redis + Nginx | 5432, 6379, 80/443 |
| `ai-platform/nginx/nginx.conf` | Reverse proxy with TLS 1.3 | 80, 443 |

### Health endpoints discovered

| Path | File | Line | Response |
|------|------|------|----------|
| `/health` | `server/index.cjs` | 1223 | `{ status: 'ok', timestamp }` |
| `/api/health` | `server/routes/health-routes.cjs` | 42 | `{ status: 'healthy', platform, version }` |
| `/api/health/db` | `server/bootstrap/phase2-integration.cjs` | 271 | Database health |
| `/api/health/redis` | `server/bootstrap/phase2-integration.cjs` | 282 | Redis health |
| `/api/assessment/health` | `server/api/assessment/index.cjs` | 114 | Assessment service health |

**Note:** `HEALTH_PROBE_CI` environment variable was NOT found in the codebase. The probes will target the existing `/health` and `/api/health` endpoints.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Helm chart structure valid | `helm lint deploy/helm/` (if helm installed) or `node -e "require('js-yaml').load(fs.readFileSync('deploy/helm/Chart.yaml','utf8'))"` | [ ] |
| L1-02 | values.yaml parses as valid YAML | `node -e "require('js-yaml').load(fs.readFileSync('deploy/helm/values.yaml','utf8'))"` | [ ] |
| L1-03 | All template files parse as valid YAML (rendered) | `helm template deploy/helm/` (if helm installed) or YAML lint each template | [ ] |
| L1-04 | Envoy config parses as valid YAML | `node -e "require('js-yaml').load(fs.readFileSync('deploy/envoy/envoy.yaml','utf8'))"` | [ ] |
| L1-05 | Helm chart validation tests | `cd ai-platform && npx jest helm-chart-validation --coverage=false` | [ ] |
| L1-06 | Regression: sandbox memory audit tests | `cd ai-platform && npx jest sandbox-memory-audit --coverage=false` | [ ] |
| L1-07 | Regression: state-snapshot tests | `cd ai-platform && npx jest state-snapshot --coverage=false` | [ ] |
| L1-08 | Regression: IPC boundary tests | `cd ai-platform && npx jest ipc-boundary --coverage=false` | [ ] |
| L1-09 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | values.yaml exposes IPC_PAYLOAD_LIMIT_BYTES | Read values.yaml, check `security.ipcPayloadLimitBytes` | Value is `1048576` (1MB) | [ ] |
| L2-02 | values.yaml exposes SANDBOX_MEMORY_ENTRY_LIMIT_BYTES | Read values.yaml, check `security.sandboxMemoryEntryLimitBytes` | Value is `65536` (64KB) | [ ] |
| L2-03 | values.yaml exposes SANDBOX_MEMORY_MAX_ENTRIES | Read values.yaml, check `security.sandboxMemoryMaxEntries` | Value is `16` | [ ] |
| L2-04 | Deployment template has readiness probe on /health | Render deployment template, check readinessProbe.httpGet.path | Path is `/health`, port is `http` | [ ] |
| L2-05 | Deployment template has liveness probe on /api/health | Render deployment template, check livenessProbe.httpGet.path | Path is `/api/health`, port is `http` | [ ] |
| L2-06 | Container memory limit reflects sandbox threshold | Render deployment template, check resources.limits.memory | Memory limit is parameterized from values.yaml | [ ] |
| L2-07 | Envoy config has max_request_bytes matching IPC limit | Read envoy.yaml, check max_request_bytes | Value is `1048576` (1MB) + overhead = `2097152` (2MB) | [ ] |
| L2-08 | NetworkPolicy restricts mesh worker egress | Render networkpolicy template, check egress rules | Only allows ingress gateway + DNS | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | values.yaml with custom thresholds overrides defaults | Set `security.ipcPayloadLimitBytes: 524288`, render templates | Deployment env vars reflect 512KB | [ ] |
| L3-02 | Envoy config rejects body > max_request_bytes | Send a 3MB request through Envoy config | HTTP 413 Request Entity Too Large | [ ] |
| L3-03 | NetworkPolicy denies mesh worker → external traffic | Check egress rules for mesh-worker label | No external CIDR blocks allowed | [ ] |
| L3-04 | Helm chart installs with default values | `helm install --dry-run deploy/helm/` | No errors, all resources rendered | [ ] |
| L3-05 | ConfigMap injects security thresholds as env vars | Render configmap template, check env vars | IPC_PAYLOAD_LIMIT_BYTES, SANDBOX_MEMORY_ENTRY_LIMIT_BYTES, SANDBOX_MEMORY_MAX_ENTRIES present | [ ] |
| L3-06 | Mesh worker deployment has separate resource limits | Render mesh-worker-deployment template | Lower memory limit than main server | [ ] |
| L3-07 | Service exposes only http port (no debug ports) | Render service template, check ports | Only port 3000 (http) exposed | [ ] |
| L3-08 | All templates have standard Helm labels | Check labels in each template | app.kubernetes.io/name, instance, version, managed-by | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | IPC payload limit (1MB) parameterized in values.yaml and injected as env var | [ ] |
| S-02 | Sandbox memory entry limit (64KB) parameterized in values.yaml and injected as env var | [ ] |
| S-03 | Sandbox max entries (16) parameterized in values.yaml and injected as env var | [ ] |
| S-04 | Envoy max_request_bytes enforces 1MB + overhead at network layer | [ ] |
| S-05 | NetworkPolicy restricts mesh worker egress to validated gateways only | [ ] |
| S-06 | Container runs as non-root user (securityContext.runAsNonRoot: true) | [ ] |
| S-07 | Read-only root filesystem (securityContext.readOnlyRootFilesystem: true) | [ ] |
| S-08 | Readiness probe targets /health endpoint | [ ] |
| S-09 | Liveness probe targets /api/health endpoint | [ ] |
| S-10 | No secrets in values.yaml (only references to Secret resources) | [ ] |

---

## Implementation notes

### Chart structure

```
deploy/helm/
├── Chart.yaml              # Chart metadata (name: simplebeacon, version: 0.1.0)
├── values.yaml             # Parameterized security thresholds
├── templates/
│   ├── _helpers.tpl        # Template helpers (names, labels)
│   ├── deployment.yaml     # ai-platform server deployment
│   ├── service.yaml        # ClusterIP service
│   ├── configmap.yaml      # Security threshold env vars
│   ├── networkpolicy.yaml  # Mesh worker isolation
│   ├── envoy-configmap.yaml # Envoy sidecar config
│   ├── mesh-worker-deployment.yaml # Mesh load worker
│   └── NOTES.txt           # Post-install notes
└── values.schema.json      # (optional) Schema validation for values
```

### Key values.yaml thresholds

```yaml
security:
  ipcPayloadLimitBytes: 1048576        # 1 MB — matches mesh-load-worker.cjs MAX_IPC_PAYLOAD_BYTES
  sandboxMemoryEntryLimitBytes: 65536  # 64 KB — matches confidential-sandbox-engine.cjs MAX_MEMORY_ENTRY_BYTES
  sandboxMemoryMaxEntries: 16          # matches MAX_MEMORY_ENTRIES
  sandboxMaxExecutionTimeSeconds: 30   # matches default maxExecutionTimeSeconds

resources:
  server:
    limits:
      memory: "512Mi"
      cpu: "1000m"
    requests:
      memory: "256Mi"
      cpu: "500m"
  meshWorker:
    limits:
      memory: "128Mi"
      cpu: "500m"
    requests:
      memory: "64Mi"
      cpu: "250m"

envoy:
  enabled: true
  maxRequestBytes: 2097152  # 2MB (1MB IPC + 1MB overhead)
  image: "envoyproxy/envoy:v1.29-latest"

probes:
  readiness:
    path: /health
    port: http
    initialDelaySeconds: 5
    periodSeconds: 10
  liveness:
    path: /api/health
    port: http
    initialDelaySeconds: 15
    periodSeconds: 20
```

### Envoy config (envoy.yaml)

```yaml
static_resources:
  listeners:
  - name: ingress_listener
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 8080
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: ingress_http
          route_config:
            name: local_route
            virtual_hosts:
            - name: backend
              domains: ["*"]
              routes:
              - match: { prefix: "/" }
                route: { cluster: backend }
          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
          request_headers_timeout: 1s
          max_request_headers_size_kb: 8
          # Body size limit enforced via route config
          route_config:
            name: local_route
            virtual_hosts:
            - name: backend
              domains: ["*"]
              routes:
              - match: { prefix: "/" }
                route: { cluster: backend, max_request_bytes: 2097152 }
  clusters:
  - name: backend
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: backend
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: simplebeacon-server
                port_value: 3000
```

### Readiness/liveness probes

**Readiness probe** — `/health` (lightweight, line 1223 of index.cjs):
- Returns `{ status: 'ok', timestamp }` immediately
- No database or Redis dependency check
- `initialDelaySeconds: 5`, `periodSeconds: 10`

**Liveness probe** — `/api/health` (detailed, line 42 of health-routes.cjs):
- Returns `{ status: 'healthy', platform, version }`
- Includes platform version for diagnostic purposes
- `initialDelaySeconds: 15`, `periodSeconds: 20`

**Why two different endpoints:** Readiness uses the lightweight `/health` to avoid marking the pod as not-ready during transient database/Redis issues. Liveness uses `/api/health` for richer diagnostic data. If the pod is truly dead, the liveness probe will fail and trigger a restart.

---

## Approval

- [ ] User approved this plan
- Approved by: __________  Date: __________
