const fs = require("fs");
const ROOT = "C:\\Users\\user\\CascadeProjects";

// 2. schema
const sp =
  ROOT + "/ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json";
let s = fs.readFileSync(sp, "utf8");
if (!s.includes("pqSeabedGating")) {
  const os = s.indexOf("pqFisheriesGating");
  const oe = s.indexOf("}", s.indexOf("requireCanonicalPayloadLayout", os));
  const before = s.substring(0, oe + 1);
  const after = s.substring(oe + 1);
  const insert =
    ',\n    "pqSeabedGating": {\n      "minSovereignQuorum": 6,\n      "maxLeaseWindowSeconds": 31536000,\n      "maxExtractionChainDepth": 15,\n      "allowedPqcSignatureSchemes": ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],\n      "requireIsaAuthorityInitializerAttestation": true,\n      "requireSeabedOversightCommitteeAttestation": true,\n      "allowedAttestationAuthorities": ["mock-authority"],\n      "banMalformedOrOutOfOrderExtractionClaims": true,\n      "requireCanonicalPayloadLayout": true\n    }';
  s = before + insert + after;
  fs.writeFileSync(sp, s);
  JSON.parse(s);
  console.log("2. schema: applied");
} else {
  console.log("2. schema: already has pqSeabedGating");
}

// 3. base-adapter
const bp = ROOT + "/ai-platform/server/lib/hsm-adapter/base-adapter.cjs";
let b = fs.readFileSync(bp, "utf8");
if (!b.includes("emitSeabedGatingPoolInitialized")) {
  const marker = "  // \u2500\u2500 Track 33 recovery sync telemetry hooks";
  const bidx = b.indexOf(marker);
  if (bidx === -1) {
    console.log("3. base-adapter: marker not found");
  } else {
    const insertB = [
      "  // \u2500\u2500 Track 95 PQ deep-sea mineral rights gating telemetry hooks \u2500\u2500",
      "",
      "  /**",
      "   * Emit a seabed gating pool initialized event into the audit pipeline.",
      "   * @param {object} info",
      "   */",
      "  emitSeabedGatingPoolInitialized(info = {}) {",
      "    this._ensureInitialized();",
      "    this._audit('SEABED_GATING_POOL_INITIALIZED', info);",
      "    try { require('./hsm-metrics.cjs').incrementCounter('hsm_seabed_gating_pool_initialized_total'); } catch { }",
      "  }",
      "",
      "  /**",
      "   * Emit a ZK extraction claim verified event into the audit pipeline.",
      "   * @param {object} info",
      "   */",
      "  emitZkExtractionClaimVerified(info = {}) {",
      "    this._ensureInitialized();",
      "    this._audit('ZK_EXTRACTION_CLAIM_VERIFIED', info);",
      "    try { require('./hsm-metrics.cjs').incrementCounter('hsm_zk_extraction_claim_verified_total'); } catch { }",
      "  }",
      "",
      "  /**",
      "   * Emit a lease accreditation completed event into the audit pipeline.",
      "   * @param {object} info",
      "   */",
      "  emitLeaseAccreditationCompleted(info = {}) {",
      "    this._ensureInitialized();",
      "    this._audit('LEASE_ACCREDITATION_COMPLETED', info);",
      "    try { require('./hsm-metrics.cjs').incrementCounter('hsm_lease_accreditation_completed_total'); } catch { }",
      "  }",
      "",
      "",
    ].join("\n");
    b = b.substring(0, bidx) + insertB + b.substring(bidx);
    fs.writeFileSync(bp, b);
    console.log("3. base-adapter: applied");
  }
} else {
  console.log("3. base-adapter: already has emitSeabedGatingPoolInitialized");
}

// 4. hsm-metrics
const mp = ROOT + "/ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs";
let m = fs.readFileSync(mp, "utf8");
if (!m.includes("hsm_seabed_gating_pool_initialized_total")) {
  const mIdx = m.indexOf("hsm_quota_accreditation_completed_total: 0,");
  if (mIdx === -1) {
    console.log("4. hsm-metrics: marker not found");
  } else {
    const mEnd = mIdx + "hsm_quota_accreditation_completed_total: 0,".length;
    const insertM =
      "\n  // Track 95: PQC Deep-Sea Mineral Rights Gating counters\n  hsm_seabed_gating_pool_initialized_total: 0,\n  hsm_zk_extraction_claim_verified_total: 0,\n  hsm_lease_accreditation_completed_total: 0,";
    m = m.substring(0, mEnd) + insertM + m.substring(mEnd);
    fs.writeFileSync(mp, m);
    console.log("4. hsm-metrics: applied");
  }
} else {
  console.log("4. hsm-metrics: already has seabed counters");
}

// 5. run-all-tracks
const rp =
  ROOT + "/ai-platform/server/lib/hsm-adapter/__tests__/run-all-tracks.cjs";
let r = fs.readFileSync(rp, "utf8");
if (!r.includes("pq-deep-sea-mineral-rights-gating")) {
  const rIdx = r.indexOf("'pq-ocean-fisheries-allocation-gating',");
  if (rIdx === -1) {
    console.log("5. run-all-tracks: marker not found");
  } else {
    const rEnd = rIdx + "'pq-ocean-fisheries-allocation-gating',".length;
    const insertR = "\n  'pq-deep-sea-mineral-rights-gating',";
    r = r.substring(0, rEnd) + insertR + r.substring(rEnd);
    fs.writeFileSync(rp, r);
    console.log("5. run-all-tracks: applied");
  }
} else {
  console.log("5. run-all-tracks: already has pq-deep-sea");
}

console.log("Done.");
