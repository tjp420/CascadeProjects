## Summary

<!-- What does this PR do? Why? -->

## Test plan

- [ ] `npm run simplebeacon:pre-pr` passes locally
- [ ] `npm test` passes
- [ ] ESLint errors resolved (if any)

## Checklist

- [ ] No hardcoded credentials, API keys, or secrets added
- [ ] No mock/fiction KPI data in production paths
- [ ] No `debugger` statements or `console.log` left in production code
- [ ] `node_modules` / `coverage` not committed accidentally

---

> **Tip:** Run the full hygiene gate before opening a PR:
>
> ```bash
> cd ai-platform
> npm run simplebeacon:hygiene-gate
> ```
>
> Install git hooks for automatic pre-commit checks:
>
> ```bash
> npx simplebeacon hook install
> ```
