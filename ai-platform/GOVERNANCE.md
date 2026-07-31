# AI Platform Governance Policy

## License

This project is licensed under the [MIT License](./LICENSE).

## Distribution Model

The AI Platform is distributed as:

- **Open source**: Core scanner and CLI tools (MIT)
- **Proprietary add-ons**: Dashboard features, EU AI Act compliance reports, and pre-launch audit PDFs are paid deliverables

## Dependency License Audit

All runtime and build dependencies use licenses compatible with MIT distribution:

- MIT / ISC (permissive)
- Apache-2.0 (permissive)
- BSD-3-Clause (permissive)

No GPL, AGPL, LGPL, or other copyleft dependencies are present in the dependency tree.

## Security Reporting

See [SECURITY.md](./SECURITY.md) for vulnerability reporting procedures.

## Code of Conduct

- Follow the canonical file locations documented in `../QUALITY-PROCESS.md`
- All changes must pass the pre-commit gate scan (`npx simplebeacon scan --gate`)
- Maintain quality score >= 85
- No new duplicate analyzer groups without consolidation plan

## Decision Making

| Decision Type        | Authority                            |
| -------------------- | ------------------------------------ |
| Scanner rule changes | Principal Engineer                   |
| New analyzer engines | Principal Engineer + product review  |
| Breaking API changes | Team consensus                       |
| Dependency additions | License compatibility check required |

## Compliance

- EU AI Act readiness indicators are provided as informational scans only
- No legal advice is embedded in automated findings
- Human review is required before acting on any compliance recommendation
