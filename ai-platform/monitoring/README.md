# ai-platform — Monitoring Runbook for Agentic Orchestration Metrics

This runbook documents how to scrape the agentic orchestration metrics endpoint exposed by ai-platform.
The endpoint is:

- `GET /api/agentic/metrics`

It exposes Prometheus exposition-format plaintext (version 0.0.4) containing counters such as:

- `siem_delivery_retries_total` — Total count of SIEM delivery retry attempts.
- `siem_delivery_dropped_total` — Total number of SIEM events dropped due to queue trimming.

## Example Prometheus scrape configuration

Add this snippet to your Prometheus `prometheus.yml` under `scrape_configs`:

```yaml
scrape_configs:
  - job_name: "ai-platform-agentic-orchestration"
    scrape_interval: 15s
    metrics_path: "/api/agentic/metrics"
    bearer_token: "YOUR_ADMIN_ROLE_BEARER_TOKEN"
    static_configs:
      - targets: ["localhost:3000"]
```

> NOTE: The `/api/agentic/metrics` endpoint is protected by the application's RBAC layer and requires an admin-scoped bearer token or equivalent authentication configured in your environment.

## Authentication

- Prefer short-lived service account tokens or secrets injected via your orchestration platform's secret manager (Kubernetes `Secret`, Vault, etc.).
- Avoid checking long-lived tokens into source control. Use environment variables, mounted secrets, or a secrets provider to supply `bearer_token` to Prometheus.
- If your Prometheus instance runs inside the same secure network boundary as the application, consider mTLS + service account bindings instead of bearer tokens.

### Example using Kubernetes `Secret` (Kustomize / helm)

1. Create a `Secret` containing the admin token:

```bash
kubectl create secret generic ai-platform-metrics-token --from-literal=token="$(cat /secrets/ai-platform-admin-token)" -n monitoring
```

2. Mount the secret into Prometheus or use `bearer_token_file` to reference the file.

## TLS & Network Hardening

- Serve the application over HTTPS behind a load balancer or ingress controller.
- Configure `tls_config` in Prometheus when using self-signed CA or private PKI:

```yaml
tls_config:
  ca_file: /etc/prometheus/certs/ca.crt
  cert_file: /etc/prometheus/certs/prometheus.crt
  key_file: /etc/prometheus/certs/prometheus.key
  insecure_skip_verify: false
```

- Enforce firewall rules so only trusted Prometheus servers can reach the metrics endpoint.
- Rotate TLS certificates and tokens regularly.

## Scrape cadence & performance

- Default recommended `scrape_interval` is `15s`. Increase frequency only if you need higher-resolution metrics and confirm the exporter can handle the additional load.
- This exporter uses an in-memory registry — consider swapping to a Prometheus client library if you need high-cardinality labels, histograms, or large-volume metrics.

## Troubleshooting

- 401/403 errors: Verify the bearer token or service account has the `admin:all` permission mapped in the application.
- No metrics returned: Ensure the application process is running and `/api/agentic/metrics` returns `text/plain; version=0.0.4` (use `curl -v` to inspect headers).
- Prometheus scraping fails with TLS errors: Verify `tls_config` paths and that the Prometheus host trusts the application's CA.

## Next steps (recommended)

- Integrate `prom-client` in the application to emit histograms for `sendBatch` latency and counters for total events enqueued.
- Add alerting rules for sustained high `siem_delivery_retries_total` or increasing `siem_delivery_dropped_total`.

---

Saved from commit: feat/agentic-orchestration
