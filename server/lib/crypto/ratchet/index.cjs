"use strict";

const path = require("path");
const fs = require("fs");

const storageBase = path.join(process.cwd(), ".data", "ratchet");

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (e) {
    console.error("index.cjs error:", e);
  }
}

module.exports = {
  bootstrapSession: function (opts = {}) {
    // opts: { tenant, peerPkSig, peerPkKem, localSkSig }
    // TODO(#817): implement hybrid KEM + signature bootstrap
    const sessionId = "ratchet-" + Date.now();
    const dir = path.join(storageBase, opts.tenant || "default", sessionId);
    ensureDir(dir);
    fs.writeFileSync(
      path.join(dir, "meta.json"),
      JSON.stringify({ createdAt: Date.now(), tenant: opts.tenant }),
    );
    return {
      sessionId,
      publicMetadata: { pk_sig: null, pk_kem: null, version: "0.1.0" },
    };
  },

  processBootstrap: function (envelope) {
    // envelope: { sessionId, envelope, signature }
    // TODO(#817): verify signature, decapsulate KEM, derive session keys
    return { ok: false, reason: "not_implemented" };
  },

  rotate: function (sessionId) {
    // TODO(#817): create rotation envelope and sign it
    return { ok: false, reason: "not_implemented" };
  },

  verifyRotation: function (sessionId, envelope) {
    // TODO(#817): verify rotation and update session state
    return { ok: false, reason: "not_implemented" };
  },

  exportPublicMetadata: function (sessionId) {
    // TODO(#817): load session metadata
    return { pk_sig: null, pk_kem: null, version: "0.1.0" };
  },
};
