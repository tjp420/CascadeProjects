# Prometheus for SimpleBeacon staging

This folder contains the Prometheus configuration used by the monitoring Docker Compose stack.

Files:

- `prometheus.yml` — main Prometheus configuration (scrapes `node_exporter` and itself, points to Alertmanager).
- `rules/` — alerting rules (e.g., `scan-resource-guard-rules.yml`) are loaded from `/etc/prometheus/rules/*.yml` inside the container.

Quick start (from repository root):

```bash
# Bring up the monitoring stack
docker compose -f docker-compose.monitoring.yml up -d

# Reload Prometheus rules on the fly after edits
curl -X POST http://localhost:9090/-/reload
```

Notes:

- Ensure the `monitoring/alertmanager` directory contains the `alertmanager.yml` and `templates/` files (we already added those in this repo).
- The `node_exporter` service exposes host metrics; run with care on production hosts.
- Adjust retention, ports, and image tags to match your staging environment policy.
