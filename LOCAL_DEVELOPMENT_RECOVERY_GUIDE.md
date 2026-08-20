# SimpleBeacon Local Development Recovery Guide

**Version:** 1.0.0
**Date:** 2026-06-27
**Audience:** Core developers, contributors, 2.0 feature teams

---

## 1. Overview

This guide covers how to completely reset your local SimpleBeacon monorepo when things go wrong — corrupted caches, broken database migrations, stale scan artifacts, or conflicting build outputs. Use it during aggressive 2.0 development when schema changes and local testing inevitably break things.

---

## 2. Quick Reset (Preserve Git History & Config)

Use this for 90% of recovery scenarios. It deletes all generated artifacts but keeps your source code, `.git/`, and custom configs intact.

### 2.1 One-Liner (PowerShell)

```powershell
# Run from repo root: C:\Users\Trevor\CascadeProjects
$dirs = @(
    'node_modules',
    'ai-platform/node_modules',
    'coming-soon/node_modules',
    'simplebeacon-vscode-merged/node_modules',
    '.simplebeacon-stress-test',
    'sales/marketplace/screenshots/*.png',
    'coming-soon/public/js',
    'coming-soon/js-es2018',
    'simplebeacon-vscode-merged/.vscode-test',
    'simplebeacon-vscode-merged/out',
    'simplebeacon-vscode-merged/.vsix-patch-temp',
    'ai-platform/.simplebeacon/*.json',
    'ai-platform/.simplebeacon/*.md',
    'ai-platform/.simplebeacon/*.bak',
    '.simplebeacon/*.json',
    '.simplebeacon/*.md',
    '.simplebeacon/*.bak',
    '.simplebeacon/email-queue',
    'test-output-*.txt'
);
foreach ($d in $dirs) {
    if (Test-Path $d) {
        Remove-Item -Recurse -Force -Path $d;
        Write-Host "Removed: $d" -ForegroundColor Green;
    }
}
# Clear npm cache
npm cache clean --force
# Reinstall root dependencies
npm install
Write-Host "Quick reset complete. Run 'npm run build' or 'npm test' as needed." -ForegroundColor Cyan
```

### 2.2 One-Liner (Bash/macOS/Linux)

```bash
# Run from repo root
dirs=(
    node_modules
    ai-platform/node_modules
    coming-soon/node_modules
    simplebeacon-vscode-merged/node_modules
    .simplebeacon-stress-test
    coming-soon/public/js
    coming-soon/js-es2018
    simplebeacon-vscode-merged/.vscode-test
    simplebeacon-vscode-merged/out
    simplebeacon-vscode-merged/.vsix-patch-temp
    ai-platform/.simplebeacon/*.json
    ai-platform/.simplebeacon/*.md
    ai-platform/.simplebeacon/*.bak
    .simplebeacon/*.json
    .simplebeacon/*.md
    .simplebeacon/*.bak
    .simplebeacon/email-queue
    test-output-*.txt
)
for d in "${dirs[@]}"; do
    if [ -e "$d" ]; then
        rm -rf "$d"
        echo "Removed: $d"
    fi
done
npm cache clean --force
npm install
echo "Quick reset complete."
```

---

## 3. Full Reset (Nuclear Option)

Use this when the quick reset doesn't fix it — e.g., after a bad database migration, corrupted git index, or when switching between major feature branches.

### 3.1 Preserve Your Work First

```bash
# Stash everything including untracked files
git stash push --include-untracked -m "pre-nuclear-reset-$(date +%Y%m%d-%H%M%S)"

# Or create a backup branch
git branch backup/pre-reset-$(date +%Y%m%d-%H%M%S)
```

### 3.2 Nuclear Reset Script

```powershell
# PowerShell — Run from repo root
Write-Host "=== SIMPLEBEACON NUCLEAR RESET ===" -ForegroundColor Red
Write-Host "This will delete ALL untracked files and reset to HEAD." -ForegroundColor Yellow
$confirm = Read-Host "Type 'NUCLEAR' to confirm"
if ($confirm -ne 'NUCLEAR') { Write-Host "Cancelled." -ForegroundColor Green; exit 0 }

# Hard reset git
git reset --hard HEAD
git clean -fdx

# Delete all node_modules recursively
Get-ChildItem -Recurse -Directory -Filter 'node_modules' | Remove-Item -Recurse -Force

# Delete all .simplebeacon directories recursively
Get-ChildItem -Recurse -Directory -Filter '.simplebeacon' | Remove-ChildItem -Recurse -Force

# Delete build artifacts
$artifacts = @(
    'dist', 'build', '.next', 'out', 'coverage',
    'coming-soon/public/js',
    'coming-soon/js-es2018',
    'simplebeacon-vscode-merged/out',
    'simplebeacon-vscode-merged/.vscode-test',
    'simplebeacon-vscode-merged/.vsix-patch-temp'
)
foreach ($a in $artifacts) {
    if (Test-Path $a) { Remove-Item -Recurse -Force -Path $a }
}

# Clear npm and npx caches
npm cache clean --force

# Reinstall from scratch
npm install

Write-Host "Nuclear reset complete. Repository is at clean HEAD." -ForegroundColor Green
Write-Host "Run 'npm run build' to rebuild all packages." -ForegroundColor Cyan
```

---

## 4. Per-Package Recovery

### 4.1 CLI Package (`packages/simplebeacon-cli`)

```bash
cd packages/simplebeacon-cli
rm -rf node_modules package-lock.json
npm install
# Verify build
node -c bin/simplebeacon.js
# Run smoke test
node bin/simplebeacon.js scan --help
```

### 4.2 AI Platform (`ai-platform/`)

```bash
cd ai-platform
rm -rf node_modules package-lock.json
npm install
# Reset local database (if using SQLite for dev)
rm -f data/*.db data/*.db-wal data/*.db-shm
# Reset scan artifacts
rm -rf .simplebeacon/*.json .simplebeacon/*.md
# Restart dev server
npm run dev
```

### 4.3 VS Code: Extension (`simplebeacon-vscode-merged/`)

```bash
cd simplebeacon-vscode-merged
rm -rf node_modules out .vscode-test .vsix-patch-temp
npm install
# Compile TypeScript
npx tsc --noEmit
# Package extension
npx vsce package
# Install locally for testing
code --install-extension simplebeacon-*.vsix
```

### 4.4 Coming-Soon Website (`coming-soon/`)

```bash
cd coming-soon
rm -rf node_modules public/js js-es2018 dist
npm install
# Rebuild public directory
node build-public.js
```

---

## 5. Database Recovery (2.0 Development)

During 2.0 development, you will likely corrupt your local SQLite databases with schema experiments.

### 5.1 SQLite Reset

```bash
# Find all SQLite databases
find . -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' | grep -v node_modules

# Delete and recreate (if using a migration tool)
rm -f ai-platform/data/*.db ai-platform/data/*.db-wal ai-platform/data/*.db-shm
# Re-run migrations
npm run db:migrate
```

### 5.2 PostgreSQL Reset (if using local Postgres)

```bash
# Drop and recreate local database
dropdb simplebeacon_dev
createdb simplebeacon_dev
# Re-run migrations
npm run db:migrate
# Seed test data
npm run db:seed
```

### 5.3 Redis Cache Flush

```bash
redis-cli FLUSHDB
# Or flush all if you're feeling aggressive
# redis-cli FLUSHALL
```

---

## 6. Scan Cache Recovery

The scanner caches file contents and parsed ASTs. If you see stale results:

```bash
# Delete scanner cache
rm -rf .simplebeacon/cache
# Or programmatically
node -e "require('./packages/simplebeacon-cli/src/scan.js').clearFileContentCache?.()"

# Force full rescan
npx simplebeacon scan --full --force
```

---

## 7. Git Cleanup

### 7.1 Untracked Files (Preview First)

```bash
# See what would be deleted
git clean -fdxn
# Actually delete (use with caution)
git clean -fdx
```

### 7.2 Large File Cleanup (BFG Repo-Cleaner)

If someone accidentally commits a large binary:

```bash
# Download BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# Remove file from history
java -jar bfg-1.14.0.jar --delete-files "*.zip"
java -jar bfg-1.14.0.jar --delete-files "*.vsix"

# Clean up
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

> **Warning:** Rewriting history requires force-push. Coordinate with the team.

### 7.3 Submodule Reset

```bash
# Reset all submodules to recorded commits
git submodule foreach --recursive 'git reset --hard && git clean -fdx'
git submodule update --init --recursive --force
```

---

## 8. Environment Recovery

### 8.1 Reset Environment Files

If `.env` files get corrupted or you want to start fresh:

```bash
# Restore from example
cp ai-platform/.env.example ai-platform/.env
cp coming-soon/.env.example coming-soon/.env

# Or generate new secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))" >> ai-platform/.env
```

### 8.2 Reset VS Code: Settings

If the extension host gets into a bad state:

```bash
# Kill all VS Code: processes
pkill -f "Code:"
# Or Windows
# Get-Process *code* | Stop-Process -Force

# Clear extension global storage
rm -rf "$HOME/.config/Code:/Global Storage/simplebeacon"
# Windows: Remove-Item -Recurse -Force "$env:APPDATA\Code:\Global Storage\simplebeacon"
```

---

## 9. Docker Recovery (if using containers)

```bash
# Stop and remove all containers
docker-compose down -v

# Rebuild from scratch
docker-compose up --build -d

# Or just reset volumes
docker volume rm simplebeacon_postgres_data simplebeacon_redis_data
```

---

## 10. Verification Checklist

After any reset, verify these work before resuming development:

- [ ] `npm test` passes in root
- [ ] `node packages/simplebeacon-cli/bin/simplebeacon.js scan --help` works
- [ ] `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate --offline` completes
- [ ] VS Code: extension compiles (`cd simplebeacon-vscode-merged && npx tsc --noEmit`)
- [ ] Web dashboard loads (`cd coming-soon && npm start` or `node server.cjs`)
- [ ] API server starts (`cd ai-platform && npm run dev`)
- [ ] Git status is clean (`git status` shows only expected untracked files)

---

## 11. Common Errors & Fixes

| Error                                  | Cause                           | Fix                                                       |
| -------------------------------------- | ------------------------------- | --------------------------------------------------------- |
| `MODULE_NOT_FOUND`                     | Corrupted `node_modules`        | Run per-package reinstall (Section 4)                     |
| `EACCES: permission denied`            | npm installed with sudo         | `sudo chown -R $(whoami) ~/.npm` then reinstall           |
| `Port 3000 already in use`             | Previous dev server zombie      | `npx kill-port 3000` or `lsof -ti:3000 \| xargs kill -9`  |
| `SQLite database is locked`            | Concurrent processes holding DB | Kill all node processes, delete `*.db-wal` and `*.db-shm` |
| `TypeScript compilation errors`        | Stale `out/` directory          | `rm -rf out && npx tsc`                                   |
| `VS Code: extension fails to activate` | Corrupted extension storage     | Follow Section 8.2                                        |
| `scanner reports stale results`        | File content cache not cleared  | Follow Section 6                                          |

---

## 12. Emergency Contacts

| Issue                             | Who to Ask                                       |
| --------------------------------- | ------------------------------------------------ |
| Database migration failure        | Backend lead — check `#backend` channel          |
| Extension build failure           | Frontend lead — check `#vscode` channel          |
| CLI scanner crash                 | Core maintainer — check `#cli` channel           |
| Git history rewrite               | Repo admin — coordinate before force-push        |
| Can't recover after nuclear reset | Anyone with a clean clone — re-clone from GitHub |

---

_This guide is a living document. Update it when new failure modes are discovered during 2.0 development._
