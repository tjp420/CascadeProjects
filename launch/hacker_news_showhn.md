Title: Show HN: SimpleBeacon – A local code license and secret analyzer for Node

Hi HN,

I built SimpleBeacon because I got tired of heavy, expensive compliance platforms demanding intrusive full-access cloud permissions to my repositories just to tell me what open-source licenses I was running.

SimpleBeacon is a lightweight, air-gapped static analysis tool designed specifically to scan `package-lock.json` files and surface nested corporate risks (like AGPL-3.0/GPL liabilities and hardcoded cloud keys) before they derail enterprise sales cycles.

How it works technically:

1. It parses your local lockfile tree to construct a complete dependency graph.
2. It looks up licensing schemas locally or queries the public NPM registry using a highly optimized, local cache (`.cache/npm-licenses.json`) to prevent network spamming.
3. It generates a comprehensive, standalone dark-mode HTML ledger mapping legal vulnerabilities, then exits with non-zero system codes to natively block bad pull requests in CI pipelines.

The architecture is built entirely on zero-trust: your actual application code never leaves your machine.

I’m looking to see what edge cases I've missed in deep-nested NPM dependency resolution trees. If you want to check it out, the dashboard is live at https://simplebeacon.ai

The core engine code is fully local, and I’m hanging out here to answer any questions about the parsing structures, AST implementations, or compliance rubrics!
