# Release Workflow

This document describes the automated release pipeline for the SimpleBeacon CLI package (`packages/simplebeacon-cli`).

## How to Release

### 1. Create a Pull Request

Make your changes on a feature branch and open a PR targeting `main`.

### 2. Add a Release Label

Apply one of three labels to your PR before merging:

| Label | Bump Type | Example | When to Use |
|-------|-----------|---------|-------------|
| `release:patch` | patch | `1.1.3` → `1.1.4` | Bug fixes, small tweaks, dependency updates |
| `release:minor` | minor | `1.1.3` → `1.2.0` | New features, no breaking changes |
| `release:major` | major | `1.1.3` → `2.0.0` | Breaking changes, API removals |

> If no release label is present, the auto-release workflow skips entirely. The PR can still be merged — it just won't trigger a release.

### 3. Merge the PR

Merge your PR to `main`. The release pipeline fires automatically.

## What Happens on Merge

### cli-test-gate.yml (runs on PR, before merge)

1. **Syntax check** — `npm run build`
2. **Test suite** — `npm test`
3. **MCP smoke test** — `node bin/simplebeacon-mcp.js --smoke-test`
4. **Pack check** — verifies no stray files in the npm tarball
5. **PR comment** — posts pass/fail results to the PR

### auto-release.yml (runs after merge, if label present)

1. **Label check** — inspects PR labels for `release:patch`, `release:minor`, or `release:major`
2. **Tests** — runs full test suite + MCP smoke test
3. **Version bump** — `scripts/release.cjs` increments `package.json` version
4. **Changelog generation** — parses git log since last tag, categorizes commits into Features / Bug Fixes / Maintenance / Other, updates `CHANGELOG.md`
5. **Commit** — `chore(release): v<version>` with `package.json` + `CHANGELOG.md`
6. **Tag** — creates annotated git tag `v<version>`
7. **Push** — pushes commit + tag to `origin/main`
8. **GitHub Release** — creates a GitHub Release with auto-generated notes and PR attribution
9. **npm publish** — publishes to npm if `NPM_TOKEN` secret is set (gracefully skips otherwise)
10. **Release summary** — emits a step summary table to the Actions run page

## Local Release (Manual)

You can also run a release locally without GitHub Actions:

```bash
# Preview a patch bump without making changes
npm run release:dry-run

# Bump patch, create tag, push
npm run release:patch

# Bump minor, create tag, push
npm run release:minor

# Bump major, create tag, push
npm run release:major

# Bump and publish to npm (requires 2FA code)
npm run release:patch:publish -- --otp 123456
```

### release.cjs Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview the release without making any changes |
| `--skip-tests` | Skip the test suite (use when tests already ran) |
| `--no-clean-check` | Skip git clean tree check (for CI environments) |
| `--publish` | Publish to npm after tagging |
| `--otp <code>` | 2FA code for npm publish |

## Commit Message Conventions

The changelog generator categorizes commits by message prefix:

| Prefix | Category in Changelog |
|--------|----------------------|
| `feat:`, `add `, `new feature` | Features |
| `fix:`, `bugfix`, `resolve ` | Bug Fixes |
| `chore:`, `refactor:`, `docs:`, `test:`, `ci:`, `build:`, `style:` | Maintenance |
| Anything else | Other Changes |

Use conventional commit prefixes (`feat:`, `fix:`, `chore:`, etc.) for best changelog quality.

## Coexistence with release-tagger.yml

The repository has two release workflows:

- **`auto-release.yml`** — controlled, label-triggered CLI releases with changelog generation and npm publish
- **`release-tagger.yml`** — general-purpose tagger that fires on every push to main

`release-tagger.yml` includes a skip check that prevents duplicate releases:
- Skips if the latest commit message starts with `chore(release):` (auto-release commit)
- Skips if HEAD already has a git tag

This means `auto-release.yml` and `release-tagger.yml` can coexist without creating duplicate tags.

## Rollback Procedure

If a release needs to be reverted:

### 1. Delete the GitHub Release

```bash
gh release delete v<version> --yes --cleanup-tag
```

### 2. Delete the Git Tag

```bash
git tag -d v<version>
git push origin --delete v<version>
```

### 3. Revert the Version Bump Commit

```bash
git revert <commit-hash>
git push origin main
```

### 4. Restore package.json Version (if needed)

If the revert doesn't restore the correct version, manually edit `packages/simplebeacon-cli/package.json` and set the `version` field back to the previous value.

### 5. Remove the Changelog Entry

Edit `packages/simplebeacon-cli/CHANGELOG.md` and remove the entry for the rolled-back version.

## npm Token Setup

To enable automatic npm publishing:

1. Go to [npmjs.com](https://www.npmjs.com) → Access Tokens → Generate New Token
2. Select **Granular Access Token** with:
   - **Permissions**: Read and write
   - **Packages**: `simplebeacon` only
   - **Expiration**: 90 days (rotate before expiry)
3. Enable 2FA on your npm account (required for publish)
4. Go to GitHub repo → Settings → Secrets and variables → Actions → New repository secret
5. Name: `NPM_TOKEN`, Value: the token from step 2
6. If your token does not have bypass-2FA, you'll need to pass `--otp <code>` or use `workflow_dispatch` with the `otp` input

## Files

| File | Purpose |
|------|---------|
| `packages/simplebeacon-cli/scripts/release.cjs` | Release script (semver bump, changelog, tag, push, publish) |
| `packages/simplebeacon-cli/CHANGELOG.md` | Auto-generated changelog |
| `.github/workflows/auto-release.yml` | Label-triggered release workflow |
| `.github/workflows/cli-test-gate.yml` | PR test gate for CLI changes |
| `.github/workflows/release-tagger.yml` | General-purpose tagger (with skip check) |
