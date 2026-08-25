# Contributing to SimpleBeacon

Thank you for your interest in contributing! This document outlines the process for submitting changes, reporting issues, and proposing features.

## How to Contribute

### Reporting Bugs

- Check existing issues to avoid duplicates.
- Open a new issue with a clear title and description.
- Include steps to reproduce, expected vs. actual behavior, and environment details.
- Attach relevant logs, screenshots, or minimal reproductions when possible.

### Suggesting Features

- Open a new issue with the `enhancement` label.
- Describe the use case and proposed solution.
- Discuss with maintainers before starting large changes.

### Pull Requests

1. Fork the repository and create a feature branch (`git checkout -b feature/my-change`).
2. Follow existing code style and conventions.
3. Add or update tests for new functionality.
4. Ensure `npm test` passes and `npm audit` is clean.
5. Update relevant documentation.
6. Open a pull request with a clear description referencing any related issues.
7. **Apply a release label** before merging (see below).

## Release Labels

The [Matrix Release Pipeline](https://github.com/tjp420/CascadeProjects/blob/main/.github/workflows/matrix-release.yml) automates version bumping, changelog generation, and publishing when PRs are merged to `main`. It uses PR labels to determine the semver bump type and which packages to release.

### Bump Type Labels (apply exactly one)

| Label           | Bump  | Example           | Use When                                    |
| --------------- | ----- | ----------------- | ------------------------------------------- |
| `release:patch` | patch | `1.1.2` → `1.1.3` | Bug fixes, small tweaks, dependency updates |
| `release:minor` | minor | `1.1.2` → `1.2.0` | New features, no breaking changes           |
| `release:major` | major | `1.1.2` → `2.0.0` | Breaking changes that require user action   |
| _(no label)_    | —     | —                 | Documentation, CI tweaks, chores            |

### Scope Labels (optional — defaults to both)

| Label                 | Scope        | Packages Released                    |
| --------------------- | ------------ | ------------------------------------ |
| `release:cli-only`    | CLI only     | `simplebeacon` on npm                |
| `release:vscode-only` | VS Code only | `simplebeacon-vscode` on Marketplace |
| _(no scope label)_    | Both         | CLI + VS Code extension in parallel  |

### Fallback: Commit Message Conventions

If no release label is applied, the pipeline falls back to commit message conventions:

| Pattern                                   | Bump       |
| ----------------------------------------- | ---------- |
| `breaking:` or `BREAKING CHANGE`          | major      |
| `feat:` or `feature:`                     | minor      |
| `fix:` or `bugfix:` or `resolve:`         | patch      |
| only `chore:` / `docs:` / `test:` / `ci:` | no release |

### Dry-Run the Bump Resolution

```bash
# Test with labels
node scripts/resolve-bump-type.cjs --labels '["release:minor"]' --commits ''

# Test with commit messages
node scripts/resolve-bump-type.cjs --labels '[]' --commits 'feat: add thing\nfix: fix bug'

# Dry-run with debug output
node scripts/resolve-bump-type.cjs --dry-run --labels '["release:patch","release:cli-only"]' --commits 'fix: small bug'
```

### How It Works

1. PR is merged to `main` with a `release:*` label
2. `matrix-release.yml` resolves the bump type (labels take priority over commit messages)
3. Matrix jobs run in parallel: CLI bumps + tags `simplebeacon-v*`, VS Code bumps + tags `vscode-v*`
4. `unified-release.yml` publishes to npm / VS Code Marketplace (triggered by GitHub Release)

## Development Setup

```bash
npm install
npm test
```

## Code Style

- Use ESLint and Prettier configurations already in the repository.
- Prefer minimal, focused changes over large refactors.
- Keep commits atomic with clear messages.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
