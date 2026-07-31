# Configuration Reference

## Profiles

| Profile    | Use case                        | Rules enabled                              |
| ---------- | ------------------------------- | ------------------------------------------ |
| `minimal`  | Any repo, quick start           | credentials, production-leak               |
| `standard` | Generic projects with mock JSON | all rules, generic fiction patterns        |
| `cascade`  | ai-platform dashboard monorepo  | all rules + cascade anchors and allowlists |

```bash
npx simplebeacon init --profile minimal
```

## `.simplebeacon/config.json`

```json
{
  "profile": "standard",
  "scanPaths": ["fixtures", "__mocks__", "data"],
  "productionPaths": ["src/", "server/"],
  "sampleDir": "data",
  "consistencyAnchorSamples": [],
  "ignore": ["node_modules/**", "tests/**", "**/*.test.js"],
  "rules": {
    "credentials": { "enabled": true, "scanProduction": true },
    "json-schema": { "enabled": true },
    "sample-consistency": { "enabled": true },
    "roadmap": { "enabled": true },
    "production-leak": {
      "enabled": true,
      "severity": "high",
      "productionPaths": ["src/"],
      "allowlistFiles": []
    },
    "jest-baseline": {
      "enabled": false,
      "runTests": false,
      "testCommand": "npm test -- --no-coverage --passWithNoTests"
    }
  },
  "gate": {
    "failOn": ["high"],
    "warnOn": ["medium", "low"]
  }
}
```

## `.simplebeacon/baseline.json`

Stores measured KPIs for consistency and Jest baseline rules:

```json
{
  "dataSource": "repository-audit",
  "jestTestsPassing": 578,
  "jestTestsLabel": "578/578",
  "jestSuites": 27,
  "rejectedFiction": {}
}
```

Sync after a green test run:

```bash
npx simplebeacon baseline sync
```

## Auto-detection

On `init`, simplebeacon detects:

- Common mock directories (`fixtures`, `__mocks__`, `web/data`, etc.)
- Production code paths (`src/`, `server/`, `lib/`)
- Cascade monorepo layout → `cascade` profile
- Package manager (npm/yarn/pnpm)

## Configuration-as-Code (Startup+ tiers)

Starting with the **Startup** tier, you can customize which scanners run and how they behave via your `.simplebeacon/config.json`:

```json
{
  "profile": "standard",
  "scanners": {
    "credential_leak": { "enabled": true, "action": "BLOCK", "severity": "high" },
    "hallucinated_urls": { "enabled": true, "action": "WARN", "severity": "medium" },
    "fictional_kpis": { "enabled": false },
    "mock_data_paths": { "enabled": true, "action": "WARN" },
    "debug_artifacts": { "enabled": true, "action": "WARN" },
    "eu_ai_act": { "enabled": false, "action": "BLOCK" }
  },
  "allowlist": ["sandbox.internal-api.local", "://company.com"],
  "gate": {
    "failOn": ["high"],
    "warnOn": ["medium", "low"]
  }
}
```

### Scanner actions

| Action  | Behavior                                    |
| ------- | ------------------------------------------- |
| `BLOCK` | Fails the gate if findings detected         |
| `WARN`  | Reports findings but does not fail the gate |
| `SKIP`  | Disables the scanner entirely               |

### Tier-gated config rights

| Tier                    | Config rights                                                                 |
| ----------------------- | ----------------------------------------------------------------------------- |
| **Developer (Free)**    | Fixed `standard` profile only. Custom `scanners` and `allowlist` are ignored. |
| **Startup ($49)**       | Can toggle scanners ON/OFF. `allowlist` is ignored.                           |
| **Growth ($149)**       | Full scanner toggles + `allowlist` for internal URLs.                         |
| **Enterprise (Custom)** | Full config + custom rule development.                                        |

### Allowlist

The `allowlist` array contains URL substrings that should never be flagged as hallucinated. Useful for internal corporate domains:

```json
{
  "allowlist": ["internal-api.company.com", "staging.local", "://company.com"]
}
```

## Validation

Invalid config files produce warnings with `--verbose`:

```bash
npx simplebeacon scan --verbose
```
