# 🛡️ SimpleBeacon Repository History Purification Guide

This guide details the maintenance procedure for executing the `git-filter-repo` history purge and recovering local developer workspaces securely.

## 📅 Phase 1: Team Coordination Window
Before running a live history rewrite, you **MUST** freeze active development branches and coordinate with the engineering team:

1. Broadcast a maintenance warning: ask all developers to push final staging commits or export active work into patch files.
2. Freeze upstream merges in GitHub (temporarily restrict PR merges or require explicit admin approval).
3. Take a fresh backup archive of the current repository (offsite) before destructive rewriting.

## ⚡ Phase 2: Running the Automation Suite
Perform these steps from an authorized workstation with Python and `git-filter-repo` available.

PowerShell (dry-run first):

```powershell
# 1. Run a dry-run simulation to inspect the rewritten tree
.\scripts\purge-history.ps1 -RepoUrl 'https://github.com/your-org/your-repo.git'

# 2. Review the script output and verification checks
#    If verification passes, run the live rewrite (force-push) as below
.\scripts\purge-history.ps1 -RepoUrl 'https://github.com/your-org/your-repo.git' -DryRun:$false
```

Notes:
- The script clones a mirror repository at `CascadeProjects-HistoryMirror.git` under the working directory.
- Dry-run is the safe default; it will not push rewritten history to origin.
- The script attempts to install `git-filter-repo` via `pip --user` if it is not present; verify network/pip policies before running.

## 📥 Phase 3: Developer Workspace Recovery (All Team Members)
After the force-push completes, every developer **must** recreate their local clones. Do NOT pull or merge from the rewritten remote.

PowerShell recovery steps for each developer:

```powershell
# 1. Back up any uncommitted local work
Move-Item C:\Users\user\CascadeProjects\your-repo C:\Users\user\CascadeProjects\your-repo.backup

# 2. Clone a pristine copy aligned to the new history
git clone https://github.com/your-org/your-repo.git C:\Users\user\CascadeProjects\your-repo
cd C:\Users\user\CascadeProjects\your-repo

# 3. Reinstall Husky hooks locally (if used)
npx husky install
```

If developers need to recover uncommitted or in-flight changes from their backups, use `git format-patch`/`git cherry-pick` or manual patching — do not merge the old clone against the new remote.

## 🔁 Credential Rotation & Post-Purge Actions
1. Immediately rotate any credentials that were exposed (cloud keys, OAuth tokens, Slack webhooks, CI secrets).
2. Update CI and secrets stores (GitHub Actions Secrets, cloud provider secrets manager) with new tokens.
3. Re-run `gitleaks`/`simplebeacon` on the cleaned repo to confirm no residual secrets remain.
4. Check forks and known mirrors; contact GitHub support if secrets were widely distributed and require repository removal requests.

## 🧾 Verification Checklist (minimal)
- [ ] Dry-run completed and inspected
- [ ] Post-rewrite verification checks passed for each scrubbed path
- [ ] Heuristic secret scans (AWS-like keys, common token patterns) show no findings
- [ ] All exposed credentials rotated
- [ ] Developers notified and recloned

## Troubleshooting & Safety Tips
- Always run the script from an isolated machine with appropriate permissions.
- If you see `git-filter-repo` errors, verify the installed Python version and `pip` availability.
- Keep the backup mirror archive available until you confirm successful recovery across the team.

---
For questions or to request an on-call run of this procedure, contact the Release/DevOps lead.
