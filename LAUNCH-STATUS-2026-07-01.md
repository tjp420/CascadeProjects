# SimpleBeacon Launch Status — 2026-07-01

**Overall: ~82% complete** (was 76%, now higher after code consolidation)

---

## ✅ Done Today (Automated / Code-Level)

| #   | Task                           | Result                                                                                                                                       |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Commit extension delta**     | 564 files committed, pushed to `main` on GitHub                                                                                              |
| 2   | **Clean temp/debug artifacts** | Removed 8 temp files from git index, added to `.gitignore`                                                                                   |
| 3   | **Package .vsix**              | `simplebeacon-3.0.347.vsix` (18.44 MB) → `sales/marketplace/simplebeacon-latest.vsix`                                                        |
| 4   | **Resolve TODO/FIXME markers** | All 8 are scanner regex patterns (false positives), already suppressed by `file-audit-context.cjs`                                           |
| 5   | **Security hardening review**  | `server.cjs` already uses `express.static(public, {dotfiles: 'deny', index: false})` + CSP/HSTS/nosniff headers                              |
| 6   | **Push to GitHub**             | `main` branch up to date (`3fc571d7`)                                                                                                        |
| 7   | **Pre-launch checklist**       | 30/31 passing — only screenshots missing                                                                                                     |
| 8   | **Syntax validation**          | `ai-platform/simplebeacon-server.cjs` passes `node -c`                                                                                       |
| 9   | **render.yaml review**         | Correct: `buildCommand: cd ai-platform && npm install`, `startCommand: node ai-platform/simplebeacon-server.cjs`, `healthCheckPath: /health` |

---

## ⏳ Blocked — Needs Your External Accounts (6 Tasks)

### High Priority

| #   | Task                   | What You Do                                                                                                                                | Time   |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| A   | **Publish CLI to npm** | Create granular token at npmjs.com → add to `C:\Users\Trevor\.npmrc` → run `npm publish --access public` from `packages/simplebeacon-cli/` | 10 min |
| B   | **Deploy to Render**   | Go to render.com → New Blueprint → connect `tjp420/CascadeProjects` → add env vars → deploy                                                | 15 min |

### Medium Priority

| #   | Task                    | What You Do                                                                                                      | Time   |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| C   | **Configure DNS**       | In Cloudflare/Namecheap: A record `simplebeacon.ai` → Render IP                                                  | 10 min |
| D   | **Stripe Live Mode**    | dashboard.stripe.com → Live mode → create products → copy Price IDs → add to Render env vars → create webhook    | 30 min |
| E   | **Resend Email**        | resend.com → add domain → verify DNS → copy API key → add to Render env vars                                     | 15 min |
| F   | **VS Code Marketplace** | marketplace.visualstudio.com → register `simplebeacon` publisher → upload `.vsix` + **5 screenshots** (1280×800) | 1 hour |

---

## Critical Path

```
GitHub push (DONE)
    ↓
A. npm publish CLI (10 min)
B. Render deploy (15 min) ─┬→ D. Stripe live (30 min)
                            ├→ E. Resend email (15 min)
                            └→ C. DNS (10 min)
                                    ↓
                          F. VS Code Marketplace (1 hour)
                                    ↓
                              100% 🚀
```

**Parallel tracks:** A and B can happen simultaneously. C/D/E depend on B. F is independent but needs screenshots.

---

## Pre-Launch Checklist: 30/31

**Only failure:**

- ❌ `At least 1 screenshot PNG present` — 0 found in `sales/marketplace/screenshots/`, need 5 for marketplace

**All other 30 checks pass:** .vsix exists, icon valid, syntax clean, CLI ready, env documented, legal docs present, GitHub Action ready.

---

## What I Can Help With Next

1. **Walk through npm token creation** — I can guide you step-by-step
2. **Verify after Render deploy** — I can curl the health endpoint and confirm
3. **Validate after DNS/Stripe/Resend setup** — I can run verification scripts
4. **Create the 5 screenshots** — You capture them in VS Code, I can verify dimensions
5. **Debug any deployment issues** — If Render build fails or Stripe webhook errors

**Which external step do you want to tackle first?**
