# Advanced Guardrails

This document collects additional guidance for enterprise guardrails and advanced configuration patterns used by SimpleBeacon.

## Troubleshooting / Path Resolution

- In CI environments and cross-platform runners, file path separators are normalized automatically when authoring custom rule `paths` and when the bundler collects artifacts. If you see missing files during packaging, ensure your rule patterns do not hardcode backslashes (`\\`) and prefer forward slashes or glob patterns.

- Example: use `web/simplebeacon-dashboard/assets/**` instead of `web\\simplebeacon-dashboard\\assets\\**`.

If you need further help, file an issue and tag `@infra-team` for assistance.
