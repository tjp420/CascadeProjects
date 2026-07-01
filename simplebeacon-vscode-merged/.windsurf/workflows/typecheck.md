---
description: Run TypeScript type-check after large edits
---

# Type-Check Workflow

Use this after large generation sweeps to catch silent regressions before packaging.

1. Make sure the `simplebeacon-vscode-merged` folder is the active workspace.
2. Run the no-emit type check:
   ```bash
   cd C:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged
   npx tsc --noEmit -p ./
   ```
// turbo
3. If errors appear, read the terminal output and fix the reported files in-place before re-running.
4. After a clean run, run the full compile to update generated assets:
   ```bash
   npm run compile
   ```
