# SimpleBeacon Local Scan WASM Analyzer

Rust source for the browser-based streaming file analyzer used by the AI platform dashboard's local scan worker.

## Build

Requires [Rust](https://rustup.rs/) and [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/):

```bash
cd ai-platform/web/simplebeacon-dashboard/wasm
wasm-pack build --target web --out-dir pkg
```

The generated `pkg/` folder is consumed by `js/workers/scan-wasm-bridge.js` at runtime.

## Architecture

- `ChunkAnalyzer` is instantiated once per file.
- Files are streamed into the analyzer in chunks from the worker using `File.slice()` / `Blob.arrayBuffer()`.
- A small overlap buffer is kept between chunks so patterns that span chunk boundaries are not lost.
- The worker calls `get_results()` after the final chunk and parses the returned JSON.

If the WASM module is not built or fails to load, the worker falls back to a pure JavaScript chunk analyzer that performs the same byte-level checks.
