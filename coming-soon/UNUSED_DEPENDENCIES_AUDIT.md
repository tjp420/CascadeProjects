# Unused Dependencies Audit — C:\Users\Trevor\CascadeProjects

## Methodology
1. Found every `package.json` (excluding `node_modules`)
2. Extracted all `dependencies` and `devDependencies`
3. Searched source code for `require('package')` and `import ... from 'package'` references
4. Checked `package.json` scripts for transitive usage (e.g., `webpack`, `jest`, `nodemon` invoked via CLI)

---

## Projects Scanned

| Project | package.json | Has Dependencies? |
|---------|-------------|-------------------|
| `coming-soon` | ✅ | Yes (2 deps) |
| `ai-platform` | ✅ | Yes (23 deps + 8 devDeps) |
| `packages/simplebeacon-cli` | ✅ | Yes (2 deps) |
| `packages/simplebeacon-intelligence` | ✅ | Yes (1 optionalDep) |
| `ai-agent` | ✅ | No |
| `ai-tools` | ✅ | No |
| `java-ai-vulnerable` | ✅ | Yes (62 deps + 5 devDeps) — *gitignored, not source-scanned* |
| `java-ai-vulnerable/backend` | ✅ | Yes (3 deps) |
| `java-ai-vulnerable/frontend` | ✅ | Yes (6 deps) |

---

## Findings by Project

### 1. coming-soon

| Dependency | Status | Evidence |
|------------|--------|----------|
| `express` | ✅ **Used** | `server.cjs`, `routes/*.cjs` |
| `jsonwebtoken` | ✅ **Used** | `server.cjs`, `routes/checkout.cjs`, `routes/certificates.cjs` |

**Unused:** 0

---

### 2. ai-platform

#### Regular Dependencies (all used)

| Dependency | Status | Evidence |
|------------|--------|----------|
| `adm-zip` | ✅ Used | `mcp-http-server.cjs`, `server/utils/data-processor.cjs` |
| `archiver` | ✅ Used | `mcp-http-server.cjs`, `server/lib/analyze-export-bundle.cjs`, `src/api/simplebeacon-billing-api.cjs` |
| `bcryptjs` | ✅ Used | `server/middleware/auth.cjs` |
| `busboy` | ✅ Used | `mcp-http-server.cjs` |
| `chokidar` | ✅ Used | `server/routes/upload.cjs`, `src/core/GlobalContextManager.cjs` |
| `cors` | ✅ Used | `server/index.cjs`, `simplebeacon-server.cjs`, tests |
| `dotenv` | ✅ Used | `server/index.cjs`, `simplebeacon-server.cjs`, `mcp-http-server.cjs`, tools |
| `express` | ✅ Used | ~14 files |
| `express-rate-limit` | ✅ Used | `server/index.cjs`, `server/middleware/security.cjs`, `server/routes/flexible-analyze-api.cjs`, etc. |
| `helmet` | ✅ Used | `server/middleware/security.cjs`, tests |
| `http-errors` | ✅ Used | `server/middleware/auth.cjs`, `server/services/phase2-auth-handlers.cjs` |
| `joi` | ✅ Used | `server/middleware/security.cjs` |
| `jsonwebtoken` | ✅ Used | ~14 files |
| `multer` | ✅ Used | `server/routes/flexible-analyze-api.cjs`, `server/routes/upload.cjs`, `server/routes/local-models-api.cjs` |
| `pg` | ✅ Used | `server/lib/database-adapter.cjs`, `tools/verify-production-deploy-readiness.cjs` |
| `redis` | ✅ Used | `server/lib/redis-cache.cjs` |
| `simple-git` | ✅ Used | `server/routes/upload.cjs` |
| `speakeasy` | ✅ Used | `server/middleware/auth.cjs` |
| `stripe` | ✅ Used | `src/api/simplebeacon-billing-api.cjs` |
| `tmp` | ✅ Used | `server/routes/flexible-analyze-api.cjs` |
| `unzipper` | ✅ Used | `server/routes/flexible-analyze-api.cjs` |
| `winston` | ✅ Used | `server/middleware/audit.cjs` |
| `ws` | ✅ Used | `simplebeacon-server.cjs` |

#### DevDependencies

| Dependency | Status | Evidence |
|------------|--------|----------|
| `@eslint/js` | ✅ Used | `eslint.config.js` |
| `eslint` | ✅ Used | `package.json` scripts (`lint`, `lint:fix`), `tools/run-eslint.cjs` |
| `globals` | ✅ Used | `eslint.config.js` |
| `jest` | ✅ Used | `jest.config.js`, `package.json` scripts (`test`, `test:coverage`, etc.) |
| `nodemon` | ✅ Used | `package.json` script `"dev": "nodemon server/index.js"` |
| `webpack` | ✅ Used | `package.json` script `"build": "webpack --mode production"` |
| `webpack-cli` | ✅ Used | Required by `webpack` CLI command above |
| `simplebeacon` | ⚠️ **UNUSED** | **No `require('simplebeacon')` or `import from 'simplebeacon'` found anywhere in source.** |

**Why `simplebeacon` is suspicious:**
- It is the npm package name of the local workspace `packages/simplebeacon-cli`
- All scripts reference the **local path directly**: `node packages/simplebeacon-cli/bin/simplebeacon.js`
- No source file imports `simplebeacon` as a package
- This may be a leftover from before the workspace structure was finalized

**Recommendation:** Remove `simplebeacon` from `ai-platform` devDependencies unless:
- You intentionally want `npx simplebeacon` to resolve to the workspace package from the root, OR
- A CI step references it as a package name rather than local path

---

### 3. packages/simplebeacon-cli

| Dependency | Status | Evidence |
|------------|--------|----------|
| `@babel/parser` | ✅ Used | `src/lib/javascript-ast-scanner.js` |
| `@babel/traverse` | ✅ Used | `src/lib/javascript-ast-scanner.js` |

**Unused:** 0

---

### 4. packages/simplebeacon-intelligence

| Dependency | Status | Evidence |
|------------|--------|----------|
| `web-tree-sitter` | ✅ Used | `src/tree-sitter-loader.js` |

**Unused:** 0

---

### 5. java-ai-vulnerable (intentionally vulnerable demo app)

**Note:** This directory is gitignored. Dependencies were read from `package.json` but source files could not be scanned.

| Dependency | Status | Notes |
|------------|--------|-------|
| All 62 dependencies + 5 devDependencies | 🔍 **Unknown** | Directory gitignored — cannot verify imports. Likely all used by design (vulnerable demo requires them). |

---

### 6. java-ai-vulnerable/fullstack-development-main/backend

| Dependency | Status | Evidence |
|------------|--------|----------|
| `cors` | ✅ Used | `server/index.js` |
| `express` | ✅ Used | `server/index.js` |
| `mongodb` | ✅ Used | `server/index.js`, `server/mongo.js` |

**Unused:** 0

---

### 7. java-ai-vulnerable/fullstack-development-main/frontend

| Dependency | Status | Evidence |
|------------|--------|----------|
| `@testing-library/jest-dom` | ✅ Used | React testing setup |
| `@testing-library/react` | ✅ Used | React testing setup |
| `@testing-library/user-event` | ✅ Used | React testing setup |
| `react` | ✅ Used | Source files |
| `react-dom` | ✅ Used | Source files |
| `react-scripts` | ✅ Used | `package.json` scripts (`start`, `build`, `test`) |
| `web-vitals` | ✅ Used | React reporting setup |

**Unused:** 0

---

## Summary

| Project | Total Deps | Unused | % Unused |
|---------|-----------|--------|----------|
| `coming-soon` | 2 | 0 | 0% |
| `ai-platform` | 31 | **1** (`simplebeacon`) | 3.2% |
| `packages/simplebeacon-cli` | 2 | 0 | 0% |
| `packages/simplebeacon-intelligence` | 1 | 0 | 0% |
| `java-ai-vulnerable` | 67 | Unknown | — |
| `java-ai-vulnerable/backend` | 3 | 0 | 0% |
| `java-ai-vulnerable/frontend` | 7 | 0 | 0% |

---

## Recommended Action

**File:** `c:/Users/Trevor/CascadeProjects/ai-platform/package.json`

```diff
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "eslint": "^9.39.4",
    "globals": "^15.14.0",
    "jest": "^29.6.2",
    "nodemon": "^3.0.1",
-   "simplebeacon": "^1.0.0",
    "webpack": "^5.88.2",
    "webpack-cli": "^5.1.4"
  }
```

**Before removing:** Verify no CI workflow or external script runs `npx simplebeacon` or `simplebeacon` from the `ai-platform` root.
