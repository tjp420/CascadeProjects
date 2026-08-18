Agent Capabilities Server

This small server exposes plugin capabilities and lightweight handler metrics for the ai-agent plugin system.

Endpoints:
- GET /capabilities — returns `{ capabilities: [...], plugins: [...] }`
- GET /metrics — returns `{ handlers: [...] }` where each handler includes `ev`, `fnName`, `opts`, `failures`, `trippedUntil`.

Usage:

Run locally:

```bash
node tools/agent-capabilities-server.cjs
```

Change default port by setting `AGENT_CAPABILITIES_PORT` environment variable.

Authentication:
- If you set the `METRICS_AUTH_TOKEN` environment variable, the server will require a bearer token for protected endpoints. Example:

```bash
export METRICS_AUTH_TOKEN=supersecret
node tools/agent-capabilities-server.cjs
# then
curl -H "Authorization: Bearer supersecret" http://localhost:3007/metrics
```

Prometheus & Grafana snippets:
- Example Prometheus scrape config: `tools/prometheus-scrape.simplebeacon.yml` — it scrapes `/metrics` on the capabilities server and can proxy a runtime agent via the `runtime=1` param or `AGENT_RUNTIME_METRICS_TARGET` env var.
- Example Grafana dashboard JSON: `tools/grafana-dashboard.simplebeacon.json` with panels for `ai_agent_handler_failures_total` and `ai_agent_handler_tripped`.

Runtime agent metrics:
- You can start the agent with a runtime metrics port by setting `AGENT_RUNTIME_METRICS_PORT` (e.g., `3008`) and `METRICS_AUTH_TOKEN` if desired. The capabilities server can be configured to fetch runtime metrics by setting `AGENT_RUNTIME_METRICS_TARGET` or using the `runtime=1&target=` query params on `/metrics`.

Docker:
- Build and run the capabilities server via Docker. From repo root:

```bash
docker build -f tools/Dockerfile.agent-capabilities -t simplebeacon-agent-capabilities .
docker run -e AGENT_CAPABILITIES_PORT=3007 -p 3007:3007 simplebeacon-agent-capabilities
```

Systemd (deb/rpm deployments):
- Example unit file: `tools/agent-capabilities.service`. Install as `/etc/systemd/system/agent-capabilities.service` and place runtime env in `/etc/simplebeacon/agent.env` (e.g. `AGENT_CAPABILITIES_PORT=3007`, `METRICS_AUTH_TOKEN=...`). Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now agent-capabilities.service
sudo journalctl -u agent-capabilities -f
```

Helper-runner & drop-in:
- The repository includes a helper-runner unit `tools/agent-capabilities-helper.service` that runs the build-and-run helper script. You can add a drop-in to tune timeouts, user, and env file. Example drop-in provided at `tools/agent-capabilities-helper.override.conf` — install as `/etc/systemd/system/agent-capabilities-helper.service.d/override.conf` then:

```bash
sudo mkdir -p /etc/systemd/system/agent-capabilities-helper.service.d
sudo cp tools/agent-capabilities-helper.override.conf /etc/systemd/system/agent-capabilities-helper.service.d/override.conf
sudo systemctl daemon-reload
sudo systemctl enable --now agent-capabilities-helper.service
sudo journalctl -u agent-capabilities-helper -f
```

Install helper & units (script):
- The repository includes `tools/install-systemd-units.sh` to install all units and drop-ins in one step. Run as root:

```bash
sudo bash tools/install-systemd-units.sh
```

Kubernetes manifests:
- See `tools/k8s/` for a secret, deployment, and service YAML. The deployment config uses `/health` for readiness and liveness probes and reads `METRICS_AUTH_TOKEN` from a Kubernetes secret.

Publishing Docker image:
- Use `tools/publish-image.sh IMAGE[:TAG] REGISTRY` to tag and push the built image to a registry. Provide `DOCKER_USERNAME` and `DOCKER_PASSWORD` as environment variables to allow the script to log in, otherwise ensure you're already `docker login`-ed.

```bash
# Example: push to Docker Hub under your user namespace
export DOCKER_USERNAME=youruser
export DOCKER_PASSWORD=supersecret
./tools/publish-image.sh simplebeacon-agent-capabilities:latest registry.hub.docker.com/youruser
```

Kubernetes exec-based readiness probe:
- If your `/metrics` endpoint requires an Authorization header, use the `exec` probe variant `tools/k8s/agent-capabilities-deployment-execprobe.yaml` which runs `curl` inside the pod using the token from the secret.


Prometheus note:
- The Prometheus example `tools/prometheus-scrape.simplebeacon.yml` uses `bearer_token_file: /etc/prometheus/secrets/agent_metrics_token`. Put the token into that file and secure permissions (owned by Prometheus user).

Self-signed TLS (quickstart):
- You can generate a quick self-signed certificate for local testing with the provided script `tools/generate-selfsigned-cert.sh`.

```bash
# generate certs in ./certs (or pass a directory)
chmod +x tools/generate-selfsigned-cert.sh
./tools/generate-selfsigned-cert.sh ./certs
# optional: create a PKCS#12 bundle with a passphrase
./tools/generate-selfsigned-cert.sh ./certs mypfxpass
```

Install to the host (example):

```bash
sudo mkdir -p /etc/simplebeacon/tls
sudo cp certs/cert.pem /etc/simplebeacon/tls/
sudo cp certs/key.pem /etc/simplebeacon/tls/
sudo chown root:root /etc/simplebeacon/tls/*
sudo chmod 644 /etc/simplebeacon/tls/cert.pem
sudo chmod 640 /etc/simplebeacon/tls/key.pem

# Point the service at the certs via /etc/simplebeacon/agent.env
sudo mkdir -p /etc/simplebeacon
sudo tee /etc/simplebeacon/agent.env > /dev/null <<'EOF'
AGENT_CAPABILITIES_PORT=3007
METRICS_AUTH_TOKEN=supersecret
AGENT_CAPABILITIES_TLS_CERT=/etc/simplebeacon/tls/cert.pem
AGENT_CAPABILITIES_TLS_KEY=/etc/simplebeacon/tls/key.pem
EOF

# install systemd drop-in (example provided at tools/agent-capabilities.service.d.env.conf)
sudo mkdir -p /etc/systemd/system/agent-capabilities.service.d
sudo cp tools/agent-capabilities.service.d.env.conf /etc/systemd/system/agent-capabilities.service.d/env.conf
sudo systemctl daemon-reload
sudo systemctl restart agent-capabilities.service
sudo journalctl -u agent-capabilities -f
```


Quick CLI:
- `node tools/agent-capabilities.cjs` — shows JSON capabilities
- `node tools/agent-capabilities.cjs --pretty` — pretty-printed capabilities
- `node tools/agent-capabilities.cjs --meta` — show plugin metadata

Notes:
- The server uses the same plugin loader but supplies a fake `agentApi` that records registrations only — it does not execute handlers or run any network calls.
- This tool has no external dependencies and is meant for local debugging and discovery.
