# Tools

This folder contains small developer tools and validators used during Sprint 5.

## test-bitpacking.js

Run the bit-packing performance validator locally:

```bash
# from repository root
node tools/test-bitpacking.js
```

Or via npm (root workspace):

```bash
npm run test:bitpacking
```

Notes:
- The script is intentionally self-contained and has no external dependencies.
- It performs a deterministic pack/unpack benchmark and prints throughput.
