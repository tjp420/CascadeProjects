// tools/test-bitpacking.js
// Sprint 5 Zero-Copy Bit-Packing Performance Validator

console.log(
  "⚡ Initializing Sprint 5 Zero-Copy Bit-Packing Performance Validator...",
);

/**
 * Packs scan finding metadata into a single 32-bit Integer slot
 * Schema:
 * [Bits 0-3]   (4 bits) -> Severity Level (0-15)
 * [Bits 4-11]  (8 bits) -> Category Index (0-255)
 * [Bits 12-31] (20 bits) -> Line Number (0-1,048,575)
 */
function packFinding(severity, category, lineNumber) {
  return (
    (severity & 0xf) | ((category & 0xff) << 4) | ((lineNumber & 0xfffff) << 12)
  );
}

function unpackFinding(packedInt) {
  return {
    severity: packedInt & 0xf,
    category: (packedInt >> 4) & 0xff,
    lineNumber: (packedInt >> 12) & 0xfffff,
  };
}

// Execution Speed and Density Benchmark Test
const ITERATIONS = 1_000_000;
console.log(
  `🧠 Compressing and extracting ${ITERATIONS.toLocaleString()} data vectors...`,
);

const startTime = process.hrtime.bigint();
let accumulator = 0n;

for (let i = 0; i < ITERATIONS; i++) {
  const severity = i % 4;
  const category = i % 12;
  const line = i % 5000;

  const packed = packFinding(severity, category, line);
  accumulator += BigInt(packed);

  const unpacked = unpackFinding(packed);
  // minimal sanity check to ensure pack/unpack are consistent
  if (
    unpacked.severity !== severity ||
    unpacked.category !== category ||
    unpacked.lineNumber !== line
  ) {
    console.error("Pack/unpack mismatch at", i, {
      severity,
      category,
      line,
      unpacked,
    });
    process.exit(2);
  }
}

const endTime = process.hrtime.bigint();
const durationMs = Number(endTime - startTime) / 1_000_000;

console.log("\n📊 Bit-Packing Benchmark Results:");
console.log(`⏱️  Duration: ${durationMs.toFixed(2)} ms`);
console.log(
  `📦 Operations per Millisecond: ${(ITERATIONS / durationMs).toFixed(2)} ops/ms`,
);
console.log(
  "🧠 Memory footprint per node: 4 bytes (Fixed Int32) vs ~120 bytes (Standard JS object)",
);
// log accumulator to avoid optimizer dropping loop
console.log(
  "Accumulator (to avoid optimization):",
  accumulator.toString().slice(-12),
);

process.exit(0);
