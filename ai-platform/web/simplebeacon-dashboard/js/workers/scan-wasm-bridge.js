/**
 * WASM loader + JS fallback for the local browser scan worker.
 *
 * If the Rust/WASM package has been built (wasm/pkg/), it is loaded and used
 * for chunked file analysis. If it is missing or fails to load, a pure-JS
 * chunk analyzer is used instead so the scan still works in development.
 */

const WASM_PKG_URL = new URL('../../wasm/pkg/simplebeacon_scan_wasm.js', import.meta.url);
const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1 MB

const SEVERITY_MAP = {
  credentials: 'critical',
  euAiAct: 'high'
};

/** Concatenate two Uint8Arrays without spreading large arrays. */
function concatBytes(a, b) {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

/** Decode a Uint8Array chunk into a string, handling UTF-8 safely. */
function decodeText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

/** Pure-JS chunk analyzer that mirrors the Rust `ChunkAnalyzer` API. */
class JsChunkAnalyzer {
  constructor() {
    this.totalBytes = 0;
    this.isPe = false;
    this.findings = [];
    this.carry = new Uint8Array(0);
    this.lineOffset = 0;
    this.seenPe = false;
  }

  analyze_chunk(chunk, _filePath, _isLast) {
    this.totalBytes += chunk.length;

    if (!this.seenPe && this.totalBytes >= 2) {
      const head = this.carry.length ? this.carry : chunk;
      if (head.length >= 2 && head[0] === 0x4D && head[1] === 0x5A) {
        this.isPe = true;
      }
      this.seenPe = true;
    }

    const buffer = this.carry.length ? concatBytes(this.carry, chunk) : chunk;

    if (!buffer.length) return;

    // Carry over the last incomplete line so patterns that span a chunk
    // boundary are scanned once the full line is available.
    if (_isLast) {
      this.scanTextPatterns(buffer, true);
      this.carry = new Uint8Array(0);
    } else {
      const lastNewline = this.lastNewlineIndex(buffer);
      if (lastNewline === -1) {
        // No complete line yet; accumulate everything for the next chunk.
        this.carry = buffer;
      } else {
        const scanRegion = buffer.slice(0, lastNewline + 1);
        this.carry = buffer.slice(lastNewline + 1);
        this.scanTextPatterns(scanRegion, false);
      }
    }
  }

  lastNewlineIndex(bytes) {
    for (let i = bytes.length - 1; i >= 0; i--) {
      if (bytes[i] === 0x0A) return i;
    }
    return -1;
  }

  get_results() {
    return JSON.stringify({
      total_bytes: this.totalBytes,
      is_pe: this.isPe,
      findings: this.findings
    });
  }

  scanTextPatterns(buffer) {
    const text = decodeText(buffer);
    const lines = text.split('\n');
    const trailingEmpty = text.endsWith('\n') ? 1 : 0;
    const lineCount = Math.max(0, lines.length - trailingEmpty);

    let localLine = 0;
    for (const line of lines) {
      localLine += 1;
      if (localLine > lineCount) break;

      const trimmed = line.trim();
      if (!trimmed) continue;

      if (this.hasConsoleLog(trimmed)) {
        this.pushFinding('debugArtifacts', localLine, trimmed);
      }
      if (this.hasTodo(trimmed)) {
        this.pushFinding('todoMarkers', localLine, trimmed);
      }
      if (this.hasCredential(trimmed)) {
        this.pushFinding('credentials', localLine, trimmed);
      }
    }
    this.lineOffset += lineCount;
  }

  pushFinding(rule, localLine, snippet) {
    this.findings.push({
      rule,
      line: this.lineOffset + localLine,
      snippet: snippet.slice(0, 120)
    });
  }

  hasConsoleLog(line) {
    const lower = line.toLowerCase();
    return lower.includes('console.log') ||
           lower.includes('console.warn') ||
           lower.includes('console.error') ||
           line.includes('debugger;');
  }

  hasTodo(line) {
    const lower = line.toLowerCase();
    return lower.includes('todo') || lower.includes('fixme') ||
           lower.includes('hack') || lower.includes('xxx');
  }

  hasCredential(line) {
    const lower = line.toLowerCase();
    return (lower.includes('password') || lower.includes('secret') ||
            lower.includes('token') || lower.includes('api_key')) &&
           (line.includes("'") || line.includes('"'));
  }
}

/** Thin wrapper around the wasm-bindgen generated analyzer. */
class WasmAnalyzer {
  constructor(wasm) {
    this.wasm = wasm;
    this.inner = new wasm.ChunkAnalyzer();
  }

  analyze_chunk(chunk, filePath, isLast) {
    this.inner.analyze_chunk(chunk, filePath, isLast);
  }

  get_results() {
    return this.inner.get_results();
  }
}

let analyzerFactory = null;
async function createAnalyzer() {
  if (!analyzerFactory) {
    analyzerFactory = await (async () => {
      try {
        const wasm = await import(WASM_PKG_URL);
        await wasm.default();
        return { type: 'wasm', wasm };
      } catch {
        return { type: 'js' };
      }
    })();
  }
  if (analyzerFactory.type === 'wasm') {
    return new WasmAnalyzer(analyzerFactory.wasm);
  }
  return new JsChunkAnalyzer();
}

/**
 * Stream a file through a chunk analyzer and return aggregated findings.
 * @param {File} file
 * @param {string} filePath
 * @param {number} [chunkSize]
 * @returns {Promise<{total_bytes:number, is_pe:boolean, findings:Array}>}
 */
export async function analyzeFileChunks(file, filePath, chunkSize = DEFAULT_CHUNK_SIZE) {
  const analyzer = await createAnalyzer();
  const size = file.size || 0;

  for (let start = 0; start < size; start += chunkSize) {
    const end = Math.min(start + chunkSize, size);
    const arrayBuffer = await file.slice(start, end).arrayBuffer();
    analyzer.analyze_chunk(new Uint8Array(arrayBuffer), filePath, end >= size);
  }

  // Empty file: still run the analyzer once so it can report zero bytes.
  if (size === 0) {
    analyzer.analyze_chunk(new Uint8Array(0), filePath, true);
  }

  return JSON.parse(analyzer.get_results());
}

/**
 * Convert raw WASM findings into the worker's issue format.
 */
export function findingsToIssues(results, filePath) {
  const issues = [];
  for (const f of results.findings || []) {
    issues.push({
      severity: SEVERITY_MAP[f.rule] || 'medium',
      filePath,
      rule: f.rule,
      line: f.line || 1,
      impact: `${f.rule} finding detected`,
      fix: 'Review and remediate before next release.'
    });
  }
  if (results.is_pe) {
    issues.push({
      severity: 'info',
      filePath,
      rule: 'binaryPeHeader',
      line: 1,
      impact: 'File has a Windows executable (PE) header',
      fix: 'Verify that executable files are intended to be scanned.'
    });
  }
  return issues;
}

export { DEFAULT_CHUNK_SIZE };
