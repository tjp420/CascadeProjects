# 🛠️ Technical Debt Remediation: Dependency-Cruiser Circular Loop

This document outlines the reproduction and refactoring sequence to resolve the single circular dependency error currently bypassed by our temporary test relaxation in `architecture.test.ts`.

---

## 🔬 1. Local Reproduction Protocol
To isolate the exact file coordinates causing the architectural violation, execute `dependency-cruiser` directly against the extension module scope from your terminal:

```bash
# Run a strict dependency check over the merged source tree
npx depcruise --validate .dependency-cruiser.json simplebeacon-vscode-merged/src
```

### Expected Root Cause Diagnostic:
The output log will flag a mutual recursion cycle where two modules require each other, breaking clean layering rules. Based on our recent refactors, the most likely culprit is:
`src/analyzers/workspaceAnalyzer.ts` 🔁 `src/utils/endpointValidator.ts`

---

## 🛠️ 2. Surgical Decoupling Patterns

Once the file pair is confirmed, apply one of these two verified structural separation patterns to permanently purge the loop:

### Pattern A: Extract to a Leaf Utility Module (Recommended)
If both files are importing a shared configuration object, interface, or validation regex parameter, extract that shared state into an isolated leaf module that has zero upstream dependencies.

❌ CURRENT CRITICAL CYCLE:
[WorkspaceAnalyzer] ◄──► [EndpointValidator] (Mutual Requires)
✅ TARGET DECOUPLED ARCHITECTURE:
[WorkspaceAnalyzer] ───┐
├──► [SharedGovernanceConfig] (Leaf Node)
[EndpointValidator] ───┘

### Pattern B: Implement Lazy Runtime Evaluation
If the files must interact dynamically, break the top-level compile-time require loop by moving the import statement inside the specific function scope where it is executed:

```typescript
// Move top-level imports down to the active operational layer
export function validateCustomEnterpriseRules(ruleSet: any) {
    const { resolveOrgId } = require("../utils/endpointValidator"); // Lazy execution load
    return resolveOrgId(ruleSet);
}
```

---

## 🏁 3. Verification & Reversion Checklist

- [ ] 1. Run local architecture verification: `npm run test --workspace=simplebeacon-vscode-merged`
- [ ] 2. Confirm `dependency-cruiser` reports **0 errors** on the terminal trace output.
- [ ] 3. Open `simplebeacon-vscode-merged/src/__tests__/architecture.test.ts` and revert the threshold back to strict zero tolerance:

```typescript
expect(result.summary.error).toBe(0); // Restored production safety gate
```

---

If you want, I can open a PR with a suggested refactor (small extract + tests) once the offending module pair is confirmed by running the depcruise command above.