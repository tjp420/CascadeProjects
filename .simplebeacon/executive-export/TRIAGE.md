# Triage lanes

These lanes are a starting sort, not a verdict. Confirm each production-review item before you send this folder to a client.

## Production-path review (7)

Treat these as launch blockers until a reviewer clears them (env defaults, production leaks, reachable supply-chain issues).

- **high** `packages/simplebeacon-cli/src/lib/finding-validation.js` — packages/simplebeacon-cli/src/lib/finding-validation.js: eval(), new Function(), or dynamic code execution — code injection risk
- **low** `ai-platform-openapi-prism.yml:62` — ai-platform-openapi-prism.yml:62 api-contract pattern detected
- **low** `ai-platform/docker-compose.prism.yml:8` — ai-platform/docker-compose.prism.yml:8 api-contract pattern detected
- **low** `.github/workflows/ai-platform-openapi-prism-dispatch.yml:29` — .github/workflows/ai-platform-openapi-prism-dispatch.yml:29 api-contract pattern detected
- **low** `.github/workflows/ai-platform-openapi-prism.yml:62` — .github/workflows/ai-platform-openapi-prism.yml:62 api-contract pattern detected
- **low** `ai-platform/api/openapi.yaml:1` — ai-platform/api/openapi.yaml:1 api-contract pattern detected
- **low** `tmp_compare_spec_routes.js:7` — tmp_compare_spec_routes.js:7 api-contract pattern detected

## Dev-only / install-time (0)

Useful for shrinking install surface and supply-chain review. Not a live production exploit by itself.

_None sorted here._

## Test-suite / fixture noise (1)

Keep these off the launch punch list unless they leak into production paths. Do not file them as bounty tickets.

- **high** `ai-platform/web/simplebeacon-dashboard/src/lib/evidence-state.test.mjs` — ai-platform/web/simplebeacon-dashboard/src/lib/evidence-state.test.mjs: eval(), new Function(), or dynamic code execution — code injection risk
