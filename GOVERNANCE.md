# SimpleBeacon Governance Policy

## License

This project is licensed under the [MIT License](./LICENSE).

## Distribution Model

- **Open source**: Core scanner, CLI, and VS Code extension (MIT)
- **Commercial add-ons**: Dashboard features, EU AI Act compliance reports, and pre-launch audit bundles are paid deliverables

## Dependency License Audit

All runtime and build dependencies are compatible with MIT distribution. The current license summary is:

| License          | Count |
| ---------------- | ----- |
| MIT              | 736   |
| ISC              | 53    |
| Apache-2.0       | 48    |
| BSD-3-Clause     | 38    |
| BSD-2-Clause     | 18    |
| Other permissive | ~20   |

No GPL/AGPL/LGPL-only packages are present. Dual-licensed packages are used under their permissive option.

## Security Reporting

See [SECURITY.md](./SECURITY.md) for vulnerability reporting procedures.

## Code of Conduct

- All changes must pass the pre-commit gate scan (`npx simplebeacon scan --gate`)
- Maintain quality score >= 85
- Keep dependency audit clean and update [DEPENDENCY-POLICY.md](./DEPENDENCY-POLICY.md) after reviews

## Decision Making

| Decision Type        | Authority                            |
| -------------------- | ------------------------------------ |
| Scanner rule changes | Principal Engineer                   |
| New analyzer engines | Principal Engineer + product review  |
| Breaking API changes | Team consensus                       |
| Dependency additions | License compatibility check required |
