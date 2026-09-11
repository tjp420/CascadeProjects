# 📡 SimpleBeacon Telemetry & SRE Observability

SimpleBeacon exposes an enterprise-grade Prometheus version-0.0.4 text scraping endpoint natively at `/metrics`. This endpoint runs on pure presentation-driven lookups with an invariant zero-mutation guarantee on underlying code-scanning records.

---

### ⚙️ Prometheus Scrape Target Configuration

To ingest SimpleBeacon metrics into a centralized monitoring pool, append the following target mapping directly to your production cluster's `prometheus.yml` configuration:

```yaml
scrape_configs:
  - job_name: 'simplebeacon-data-refinery'
    scrape_interval: 15s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['localhost:58123'] # Update with your production server IP/Port context
```

---

### 📊 Exported Gauges & Metrics Directory

The endpoint exposes the following dimensional gauges to track pipeline performance and security compliance drift over time:

1. **`simplebeacon_scans_total`** (Counter)
   * *Description:* Total cumulative number of scan execution runs processed by the refinery.
2. **`simplebeacon_gate_failures_total`** (Counter)
   * *Description:* Total number of active deployment pipeline blocks triggered by policy violations.
3. **`simplebeacon_exposed_vulnerabilities_current`** (Gauge)
   * *Labels:* `{severity="critical"|"high"|"medium"|"low"}`
   * *Description:* Current volumetric distribution of active, unsuppressed hazards present in the latest target codebase footprint.

---

### 🛠️ Verification Scraping Pass

To quickly confirm the network pipeline is active via your local workstation terminal, use `curl` to pull the raw text stream directly:

```bash
curl -i http://localhost:58123/metrics
```

*Expected Response Header:* `Content-Type: text/plain; version=0.0.4; charset=utf-8`

---

## 🚀 Verification Action Plan
Go ahead and place this documentation asset in your workspace root layer. Once saved:

1. Type-Safety Re-Verification: Run a final full-project type safety loop to ensure zero compilation regressions leak into the code paths:

```
npx tsc --noEmit
```
2. Monitor the Remote Gate: Keep checking Pull Request #869 in your web browser interface. Once the remote integration suite completes with a solid green light, click Squash and Merge to land the changes!

---

If you want, I can also add a short README snippet in `packages/simplebeacon-cli` or a Prometheus `scrape_config` example as a JSON/ConfigMap for Kubernetes deployments. Tell me which variant you'd prefer.
