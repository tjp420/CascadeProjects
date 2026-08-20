# Release Workflow

This document describes the automated release pipeline for the SimpleBeacon CLI package (`packages/simplebeacon-cli`).

## How to Release

### 1. Create a Pull Request

Make your changes on a feature branch and open a PR targeting `main`.

### 2. Add a Release Label

Apply one of three labels to your PR before merging:

| Label           | Bump Type | Example           | When to Use                                 |
| --------------- | --------- | ----------------- | ------------------------------------------- |
| `release:patch` | patch     | `1.1.3` → `1.1.4` | Bug fixes, small tweaks, dependency updates |
| `release:minor` | minor     | `1.1.3` → `1.2.0` | New features, no breaking changes           |
| `release:major` | major     | `1.1.3` → `2.0.0` | Breaking changes, API removals              |

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

| Flag               | Description                                      |
| ------------------ | ------------------------------------------------ |
| `--dry-run`        | Preview the release without making any changes   |
| `--skip-tests`     | Skip the test suite (use when tests already ran) |
| `--no-clean-check` | Skip git clean tree check (for CI environments)  |
| `--publish`        | Publish to npm after tagging                     |
| `--otp <code>`     | 2FA code for npm publish                         |

## Commit Message Conventions

The changelog generator categorizes commits by message prefix:

| Prefix                                                             | Category in Changelog |
| ------------------------------------------------------------------ | --------------------- |
| `feat:`, `add `, `new feature`                                     | Features              |
| `fix:`, `bugfix`, `resolve `                                       | Bug Fixes             |
| `chore:`, `refactor:`, `docs:`, `test:`, `ci:`, `build:`, `style:` | Maintenance           |
| Anything else                                                      | Other Changes         |

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

### Severity Levels and Escalation

| Severity          | Scenario                                                      | Who Acts                     | Timeframe            |
| ----------------- | ------------------------------------------------------------- | ---------------------------- | -------------------- |
| **P1 — Critical** | Major version published with breaking changes, users impacted | Engineering Lead + npm owner | Immediate (< 1 hour) |
| **P2 — High**     | Minor version published with a regression, limited impact     | Release engineer on call     | < 4 hours            |
| **P3 — Standard** | Patch version published with a minor bug, no user impact      | Any developer                | Next business day    |

### P1/P2: Emergency Rollback (published to npm)

> **npm's 72-hour rule**: You can unpublish a package version within 72 hours of publishing. After 72 hours, you must publish a new version with the fix instead.

#### Step 1: Notify the Team

```bash
# Post to the engineering channel
echo "🚨 ROLLBACK: v<version> is being reverted — reason: <brief description>" | <team-notification>
```

If the release was published to npm, the npm account owner must act within 72 hours.

#### Step 2: Unpublish from npm (within 72 hours)

```bash
# Check if the version exists on npm
npm view simplebeacon@<version>

# Unpublish the specific version
npm unpublish simplebeacon@<version>
```

> If 72 hours have passed, **do not unpublish**. Instead, publish a new patch version with the fix and deprecate the bad version:
>
> ```bash
> npm deprecate simplebeacon@<version> "Known issue — please upgrade to <fixed-version>"
> ```

#### Step 3: Delete the GitHub Release

```bash
gh release delete v<version> --yes --cleanup-tag
```

#### Step 4: Delete the Git Tag

```bash
git tag -d v<version>
git push origin --delete v<version>
```

#### Step 5: Revert the Version Bump Commit

```bash
# Find the release commit
git log --oneline --grep="chore(release): v<version>"

# Revert it
git revert <commit-hash>
git push origin main
```

#### Step 6: Restore package.json Version (if revert is insufficient)

If the revert commit doesn't cleanly restore the version (e.g., due to subsequent commits), manually fix:

```bash
cd packages/simplebeacon-cli
# Edit package.json and set "version" back to the previous value
git add package.json
git commit -m "fix: restore version to <previous-version> after rollback"
git push origin main
```

#### Step 7: Remove the Changelog Entry

Edit `packages/simplebeacon-cli/CHANGELOG.md` and remove the `## [<version>]` section for the rolled-back version.

#### Step 8: Post-Rollback Verification

```bash
# Verify the version is correct
cd packages/simplebeacon-cli
node -p "require('./package.json').version"  # Should show previous version

# Verify tests still pass
npm test

# Verify the tag is gone
git tag -l "v<version>"  # Should return empty

# Verify npm no longer has the version (if unpublished)
npm view simplebeacon@<version>  # Should return 404
```

#### Step 9: Document the Incident

Create a post-mortem entry in the engineering wiki or incident log:

- What was released and why it needed rollback
- Root cause (bad merge, missed test, etc.)
- Time to detection and time to resolution
- Preventive measures added

### P3: Standard Rollback (not published to npm)

If the release was tagged but not published to npm (no `NPM_TOKEN` set), skip Steps 1-2 above and proceed directly to Steps 3-7. No npm unpublish is needed.

### Re-release After Rollback

Once the fix is ready, create a new PR with the appropriate release label. The pipeline will bump the version and create a fresh release. The version number from the rolled-back release **can be reused** since it was fully removed from git, npm, and GitHub.

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

| File                                            | Purpose                                                     |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `packages/simplebeacon-cli/scripts/release.cjs` | Release script (semver bump, changelog, tag, push, publish) |
| `packages/simplebeacon-cli/CHANGELOG.md`        | Auto-generated changelog                                    |
| `.github/workflows/auto-release.yml`            | Label-triggered release workflow                            |
| `.github/workflows/cli-test-gate.yml`           | PR test gate for CLI changes                                |
| `.github/workflows/release-tagger.yml`          | General-purpose tagger (with skip check)                    |
