// Vite-bundled inline worker entry point.
// This file is imported with `?worker&inline` so Vite bundles the worker
// and its dependencies into the main JS as a base64 blob — no network fetch
// needed at runtime, which avoids Firefox NS_ERROR_UNKNOWN_HOST on *.pages.dev.
//
// Re-exports everything the original scan-worker.js needs from its dependencies.
// The original worker code is in js-es2018/workers/scan-worker.js but has
// query-param import paths that Vite's worker bundler can't resolve.
// This wrapper uses clean import paths so Vite can bundle it.

import {
  analyzeFileChunks,
  findingsToIssues,
} from "../../js-es2018/workers/scan-wasm-bridge.js";
import { isIgnoredVirtualPath } from "../../js-es2018/utils-lib/simplebeaconignore.browser.js";

// Re-export so the worker code can use them
export { analyzeFileChunks, findingsToIssues, isIgnoredVirtualPath };

// Now include the worker logic directly
// The worker code is loaded as a raw string and evaluated in the worker context
// But since Vite's ?worker&inline bundles this as a worker, we can just
// import and run the worker logic here

// Actually, Vite's ?worker&inline treats THIS file as the worker entry point.
// So we need to put the worker logic HERE, not just re-export it.
// Let's import the worker logic as raw code and eval it... no, that won't work
// in a worker context with strict CSP.

// The cleanest approach: import the worker code as raw strings and combine them.
import workerCode from "../../js-es2018/workers/scan-worker.js?raw";
import bridgeCode from "../../js-es2018/workers/scan-wasm-bridge.js?raw";
import ignoreCode from "../../js-es2018/utils-lib/simplebeaconignore.browser.js?raw";

// Strip import/export statements and combine into a single self-contained script
const importRegex = /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+["'][^"']+["'];?\s*/g;
const exportRegex = /^\s*export\s+/gm;

const combinedCode = [
  `// === Inlined: scan-wasm-bridge.js ===`,
  bridgeCode.replace(importRegex, "").replace(exportRegex, ""),
  `// === Inlined: simplebeaconignore.browser.js ===`,
  ignoreCode.replace(importRegex, "").replace(exportRegex, ""),
  `// === Inlined: scan-worker.js ===`,
  workerCode.replace(importRegex, "").replace(exportRegex, ""),
].join("\n\n");

// Create a blob URL and start the worker from it
const blob = new Blob([combinedCode], { type: "application/javascript" });
const blobUrl = URL.createObjectURL(blob);
const worker = new Worker(blobUrl, { type: "classic" });

// Export the worker constructor for the inline import
export default worker;
