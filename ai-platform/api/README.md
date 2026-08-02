ai-platform API — Developer Quickstart
===================================

This folder contains the OpenAPI spec and a ready-to-run Prism mock server to exercise the `PolicyService` and `VRFExecutionService` endpoints locally.

Quick choices made for this scaffold:
- Prism mock server configured to bind to port `4010`.
- Mock config and compose file are scoped to the `ai-platform` directory.
- Docker Compose includes a simple `HEALTHCHECK` against the mock root.

Prerequisites
-------------

- Docker & Docker Compose (or Docker Desktop)
- A terminal

Start the Prism mock server
---------------------------

From the repository root or the `ai-platform` directory run:

```bash
cd ai-platform
docker compose -f docker-compose.prism.yml up --build -d
```

Verify the mock is running:

```bash
docker compose -f docker-compose.prism.yml ps
curl -v http://localhost:4010/
```

Notes about auth and the mock:
- The mock returns example responses defined in `openapi.yaml` and does not enforce OAuth2 token validation. Include an `Authorization: Bearer <token>` header when testing to mirror production calls; Prism will still return the example payloads.

Example `curl` requests
-----------------------

Replace `MOCK_TOKEN` with your bearer token placeholder when needed.

Create a policy

```bash
curl -X POST "http://localhost:4010/policies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer MOCK_TOKEN" \
  -d '{
    "policyId": "policy-0001",
    "thresholdParameters": { "n": 7, "t": 5 },
    "latticeParameters": { "n": 1024, "q": 12289 },
    "participants": ["node-1","node-2","node-3","node-4","node-5","node-6","node-7"]
  }'
```

Fetch the active policy

```bash
curl -H "Authorization: Bearer MOCK_TOKEN" \
  http://localhost:4010/policies/policy-0001
```

Initialize DKG / generate keys (post-quantum DKG)

```bash
curl -X POST "http://localhost:4010/policies/policy-0001/generate-keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer MOCK_TOKEN" \
  -d '{ "keyType": "dkg", "params": { "curve": "pq-lwe" } }'
```

Proactive share-refresh

```bash
curl -X POST "http://localhost:4010/policies/policy-0001/share-refresh" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer MOCK_TOKEN" \
  -d '{ "reason": "scheduled-refresh", "initiator": "node-1" }'
```

VRF evaluate (distributed allocation)

```bash
curl -X POST "http://localhost:4010/vrf/evaluate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer MOCK_TOKEN" \
  -d '{
    "policyId": "policy-0001",
    "input": "seed-hex-or-base64",
    "params": { "round": 42 }
  }'
```

VRF verify (stateless audit)

```bash
curl -X POST "http://localhost:4010/vrf/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer MOCK_TOKEN" \
  -d '{
    "publicInputs": { "policyId": "policy-0001", "round": 42 },
    "proof": "base64-encoded-proof",
    "output": "base64-output"
  }'
```

Shutting down
--------------

```bash
docker compose -f docker-compose.prism.yml down
```

Where to look next
------------------

- `openapi.yaml` (this directory): canonical API spec used by the mock server.
- If you want token enforcement in the mock, we can add a small auth-proxy (or an OpenAPI policy) that rejects requests without a valid token value.
