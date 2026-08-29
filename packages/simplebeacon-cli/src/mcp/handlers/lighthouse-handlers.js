/**
 * MCP lighthouse handlers — beacon_scan + beacon_generate tools for
 * token-sipping structural search via the Semantic Lighthouse.
 *
 * Exposes the Semantic Lighthouse as MCP tools so AI agents can:
 *   1. beacon_generate — build a beacon index for the project
 *   2. beacon_scan — scan the beacon index with a query to locate precise
 *      code targets without reading full files
 *
 * This is the "low-cost scan" layer — agents use it before deep retrieval.
 */

const path = require("path");
const fs = require("fs");
const {
  generateBeaconIndex,
  scanBeacons,
  loadIndex,
  defaultIndexPath,
} = require("../../lib/semantic-lighthouse");

function createLighthouseHandlers({
  withGuard,
  resolveProjectRoot,
  formatToolResult,
}) {
  return {
    beacon_scan: withGuard(async (args) => {
      if (!args || typeof args !== "object")
        throw new Error("arguments must be an object");
      if (!args.query || typeof args.query !== "string")
        throw new Error("Missing required argument: query");

      const root = resolveProjectRoot(args.projectRoot);
      const indexPath = defaultIndexPath(root);

      // Try to load existing beacon index
      let index;
      try {
        index = loadIndex(indexPath);
      } catch {
        // Auto-generate if not found (agent convenience)
        const result = await generateBeaconIndex(root, {
          maxFiles: args.maxFiles || 20000,
        });
        index = result.index;
      }

      const results = scanBeacons(index, args.query, {
        k: args.k || 10,
        entityFilter: args.entities
          ? Array.isArray(args.entities)
            ? args.entities
            : [args.entities]
          : null,
      });

      return formatToolResult({
        query: args.query,
        projectRoot: root,
        beaconIndex: {
          filesIndexed: index.summary?.filesIndexed || 0,
          totalBeacons: index.summary?.totalBeacons || 0,
          tokenReductionPct: index.summary?.tokenReductionPct || 0,
        },
        results,
        hint:
          results.length > 0
            ? "Use scan_file or read the target file at the indicated line for deep analysis. These coordinates were found via lightweight structural beacons — no full-file reads needed."
            : "No beacons matched. Try broader terms, or regenerate with beacon_generate.",
      });
    }),

    beacon_generate: withGuard(async (args) => {
      const root = resolveProjectRoot(args?.projectRoot);
      const { index, outputDir } = await generateBeaconIndex(root, {
        maxFiles: args?.maxFiles || 20000,
      });

      return formatToolResult({
        generated: true,
        projectRoot: root,
        outputDir,
        summary: index.summary,
        hint: "Beacon index ready. Use beacon_scan to find precise code targets via lightweight structural signatures.",
      });
    }),
  };
}

module.exports = { createLighthouseHandlers };
