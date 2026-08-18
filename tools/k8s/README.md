Kubernetes manifests for Agent Capabilities server

1) Create the secret (contains `METRICS_AUTH_TOKEN` and optionally `cert.pem`/`key.pem`):

```bash
kubectl apply -f tools/k8s/agent-capabilities-secret.yaml
```

2) Deploy the app and service:

```bash
kubectl apply -f tools/k8s/agent-capabilities-deployment.yaml
kubectl apply -f tools/k8s/agent-capabilities-service.yaml
```

Notes:
- The deployment uses `/health` as readiness and liveness probes. If you want HTTPS inside the pod, add the TLS keys to the secret and uncomment the `volumeMounts` and `volumes` sections in the deployment, and set `AGENT_CAPABILITIES_TLS_CERT` and `AGENT_CAPABILITIES_TLS_KEY` env vars accordingly.
- In a cluster, it's common to terminate TLS at the ingress or service mesh and keep the pod speaking plain HTTP on port 3007.
