## Summary

<!-- What does this PR do? Why? Reference any related issues (e.g. "Closes #123"). -->

## Type of Change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Documentation only
- [ ] Refactor / chore (no functional changes)
- [ ] CI/CD / build pipeline

## Release Label

> **Required for merges to `main`.** The [Matrix Release Pipeline](https://github.com/tjp420/CascadeProjects/blob/main/.github/workflows/matrix-release.yml) uses PR labels to determine the semver bump and which packages to release. Apply **one** bump label and **optionally** one scope label before merging.
>
> If no release label is applied, the pipeline falls back to commit message conventions (`breaking:` → major, `feat:` → minor, `fix:` → patch). If neither labels nor commit messages match, **no release is created**.

### Bump Type (apply exactly one)

- [ ] `release:patch` — bug fixes, small tweaks (e.g. `1.1.2` → `1.1.3`)
- [ ] `release:minor` — new features, no breaking changes (e.g. `1.1.2` → `1.2.0`)
- [ ] `release:major` — breaking changes (e.g. `1.1.2` → `2.0.0`)
- [ ] No release — documentation, CI tweaks, or chores that don't need a publish

### Release Scope (optional — defaults to both)

- [ ] `release:cli-only` — release only the CLI package (`simplebeacon` on npm)
- [ ] `release:vscode-only` — release only the VS Code extension (`simplebeacon-vscode` on Marketplace)
- [ ] (default) — release both packages in parallel

<details>
<summary><b>How the release pipeline works</b></summary>

1. **PR merged to `main`** with a `release:*` label
2. **`matrix-release.yml`** resolves the bump type (labels take priority over commit messages)
3. **Matrix jobs** run in parallel:
   - **CLI**: bumps `packages/simplebeacon-cli/package.json`, generates changelog, tags `simplebeacon-v*`, creates GitHub Release
   - **VS Code**: bumps `simplebeacon-vscode-merged/package.json`, generates changelog, tags `vscode-v*`, creates GitHub Release
4. **`unified-release.yml`** is triggered by the GitHub Release event:
   - **CLI**: publishes to npm, signs tarball with GPG, uploads artifact
   - **VS Code**: packages VSIX, publishes to Marketplace, signs with GPG, uploads artifact

> **Tip:** You can dry-run the bump resolution locally:
> ```bash
> node scripts/resolve-bump-type.cjs --labels '["release:minor"]' --commits 'feat: add thing'
> ```

</details>

## Test Plan

- [ ] `npm test` passes (or `node --test scripts/test-*.cjs` for specific suites)
- [ ] `npm run simplebeacon:pre-pr` passes locally (if ai-platform changes)
- [ ] Manual testing completed (describe below)

### Manual Testing Notes

<!-- If applicable, describe what you tested manually and the results. -->

## Checklist

- [ ] No hardcoded credentials, API keys, or secrets added
- [ ] No mock/fiction KPI data in production paths
- [ ] No `debugger` statements or `console.log` left in production code
- [ ] `node_modules` / `coverage` not committed accidentally
- [ ] New tests added for new functionality
- [ ] Documentation updated (AGENTS.md, CONTRIBUTING.md, or inline comments)

---

> **Pre-PR hygiene gate:**
> ```bash
> cd ai-platform
> npm run simplebeacon:hygiene-gate
> ```
>
> **Install git hooks for automatic pre-commit checks:**
> ```bash
> npx simplebeacon hook install
> ```
