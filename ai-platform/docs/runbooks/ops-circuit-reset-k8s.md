---
title: Ops — HSM Circuit Reset (Kubernetes)
---

Purpose

- Quick runbook to run `ops-circuit-reset.cjs` inside a running ai-platform pod via `kubectl exec`.

Prerequisites

- `kubectl` configured for the cluster and namespace where `ai-platform` is running.
- User has permissions to exec into pods and view logs.
- The container image includes Node.js and the repo worktree (or the tool is present in a mounted volume).

Common patterns

- Find a running pod (namespace `ai-platform` used here as example):

```bash
kubectl get pods -n ai-platform
```

- Exec into a pod and run the tool in-place (preferred when the repo files exist in the container):

```bash
# open an interactive shell in the first matching pod
POD=$(kubectl get pods -n ai-platform -l app=ai-platform -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n ai-platform -it $POD -- /bin/sh -c 'node /opt/app/ai-platform/tools/ops-circuit-reset.cjs list'
```

- Run a single command non-interactively (list):

```bash
kubectl exec -n ai-platform $POD -- node /opt/app/ai-platform/tools/ops-circuit-reset.cjs list
```

- Force-close the circuit for component `enclave-state` (operator escalation):

```bash
kubectl exec -n ai-platform $POD -- node /opt/app/ai-platform/tools/ops-circuit-reset.cjs close enclave-state
```

- Show status for a specific component:

```bash
kubectl exec -n ai-platform $POD -- node /opt/app/ai-platform/tools/ops-circuit-reset.cjs status enclave-state
```

If the tool is not present in the container image

- Copy the binary/script into the pod with `kubectl cp` (from workstation):

```bash
kubectl cp ai-platform/tools/ops-circuit-reset.cjs -n ai-platform $POD:/tmp/ops-circuit-reset.cjs
kubectl exec -n ai-platform $POD -- node /tmp/ops-circuit-reset.cjs list
```

Operational notes

- Use `close` only during planned maintenance windows when external HSM access is known-broken and a fast-fail is required.
- Use `open` only when you are certain the hardware is restored — forcing OPEN prevents any HSM activity.
- Prefer `status` and `list` first to verify instance names and states before forcing transitions.
- For Kubernetes operators: consider creating an RBAC role that restricts `exec` access to SRE/operator groups only.

Troubleshooting

- If `No registered HSM circuit instances found.` appears, ensure the running process has created the wrapper instances (typically after `EnclaveWorker.start()` runs).
- Container uses ESM module type? Use the `.cjs` CLI variant: `ops-circuit-reset.cjs`.

Example run (full sequence)

```bash
# pick the pod
kubectl get pods -n ai-platform -l app=ai-platform
POD=ai-platform-xxxxx
kubectl exec -n ai-platform $POD -- node /opt/app/ai-platform/tools/ops-circuit-reset.cjs list
kubectl exec -n ai-platform $POD -- node /opt/app/ai-platform/tools/ops-circuit-reset.cjs status enclave-state
kubectl exec -n ai-platform $POD -- node /opt/app/ai-platform/tools/ops-circuit-reset.cjs close enclave-state
```

Security

- Do not store the CLI or credentials in public images. Use ephemeral exec, and prefer mounting the tool from a secured configmap/volume for emergency ops.
