"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const events = require("../hsm-adapter/events.cjs");
const logger = require("../app-logger.cjs").child("upload-manager");
const { canonicalize } = require("../crypto/jcs-canonicalize.cjs");
const MerkleReassembler = require("../hsm-adapter/track112/merkle-reassembler.cjs");
const { writeAtomicSync } = require("./reassembler.cjs");

let hsmMetrics = null;
try {
  hsmMetrics = require("../hsm-adapter/hsm-metrics.cjs");
} catch (e) {
  hsmMetrics = { incrementCounter: () => {} };
}

class UploadManager {
  constructor({
    baseDir = path.join(process.cwd(), ".data", "track112"),
    defaultTenant = "dev",
  } = {}) {
    this.baseDir = baseDir;
    this.defaultTenant = defaultTenant;
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  _tenantDir(tenant) {
    return path.join(this.baseDir, tenant || this.defaultTenant);
  }

  _sessionDir(tenant, sessionId) {
    return path.join(this._tenantDir(tenant), sessionId);
  }

  createSession({ tenant, maxBytes, traceId } = {}) {
    const id = `upload-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const dir = this._sessionDir(tenant, id);
    fs.mkdirSync(dir, { recursive: true });
    const meta = {
      sessionId: id,
      tenant: tenant || this.defaultTenant,
      maxBytes: maxBytes || 0,
      createdAt: Date.now(),
      lastTouch: Date.now(),
      committed: false,
      traceId: traceId || null,
      leafSize: 4096,
    };
    fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta));
    return id;
  }

  /**
   * Resume an existing session by rebuilding the Merkle tree from disk.
   * Reads existing chunk files and tree-state.json checkpoint.
   * @param {string} sessionId
   * @returns {{ reassembler: MerkleReassembler, meta: object, dir: string }}
   */
  resumeSession(sessionId) {
    const { dir, meta } = this._findSession(sessionId);
    if (!dir) throw new Error("session_not_found");
    const reassembler = new MerkleReassembler({
      leafSize: meta.leafSize || 4096,
      stateDir: dir,
      metrics: hsmMetrics,
    });
    // If checkpoint exists, tree state is already loaded by constructor.
    // If not, rebuild from chunk files on disk.
    if (reassembler.leafCount === 0) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".chunk"));
      const offsets = files
        .map((f) => Number(f.replace(".chunk", "")))
        .sort((a, b) => a - b);
      for (const o of offsets) {
        const chunkBuf = fs.readFileSync(path.join(dir, `${o}.chunk`));
        reassembler.append(o, chunkBuf);
      }
    }
    hsmMetrics.incrementCounter("hsm_track112_session_resumed_total");
    meta.lastTouch = Date.now();
    this._writeMeta(dir, meta);
    return { reassembler, meta, dir };
  }

  _readMeta(dir) {
    try {
      const p = path.join(dir, "meta.json");
      const raw = fs.readFileSync(p, "utf8");
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  _writeMeta(dir, meta) {
    try {
      fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta));
    } catch (e) {
      console.error("upload-manager.cjs error:", e);
    }
  }

  async writeChunkFromStream(sessionId, offset, stream) {
    const { dir, meta } = this._findSession(sessionId);
    if (!dir) throw new Error("session_not_found");
    const chunkPath = path.join(dir, `${offset}.chunk`);
    const tmpPath = path.join(
      dir,
      `.${offset}.chunk.${crypto.randomBytes(6).toString("hex")}.tmp`,
    );
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(tmpPath);
      stream.pipe(writeStream);
      writeStream.on("finish", () => {
        try {
          fs.renameSync(tmpPath, chunkPath);
          hsmMetrics.incrementCounter("hsm_track112_chunk_write_atomic_total");
          // Update Merkle tree incrementally
          const chunkBuf = fs.readFileSync(chunkPath);
          const reassembler = new MerkleReassembler({
            leafSize: meta.leafSize || 4096,
            stateDir: dir,
            metrics: hsmMetrics,
          });
          reassembler.append(offset, chunkBuf);
          // Touch meta
          meta.lastTouch = Date.now();
          this._writeMeta(dir, meta);
          resolve();
        } catch (e) {
          hsmMetrics.incrementCounter(
            "hsm_track112_chunk_write_atomic_failed_total",
          );
          try {
            fs.unlinkSync(tmpPath);
          } catch (_) {}
          reject(e);
        }
      });
      writeStream.on("error", (err) => {
        hsmMetrics.incrementCounter(
          "hsm_track112_chunk_write_atomic_failed_total",
        );
        try {
          fs.unlinkSync(tmpPath);
        } catch (_) {}
        reject(err);
      });
      stream.on("error", (err) => {
        hsmMetrics.incrementCounter(
          "hsm_track112_chunk_write_atomic_failed_total",
        );
        try {
          fs.unlinkSync(tmpPath);
        } catch (_) {}
        reject(err);
      });
    });
  }

  async writeChunkFromBuffer(sessionId, offset, buf) {
    const readable = require("stream").Readable;
    const stream = new readable();
    stream.push(buf);
    stream.push(null);
    return this.writeChunkFromStream(sessionId, offset, stream);
  }

  computeRootHex(sessionId) {
    const { dir, meta } = this._findSession(sessionId);
    if (!dir) throw new Error("session_not_found");
    // Use the incremental Merkle reassembler with disk-persisted checkpoint
    const reassembler = new MerkleReassembler({
      leafSize: meta.leafSize || 4096,
      stateDir: dir,
      metrics: hsmMetrics,
    });
    // If checkpoint already has leaves, tree was built incrementally.
    // If not (e.g. legacy session without tree-state.json), rebuild from chunks.
    if (reassembler.leafCount === 0) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".chunk"));
      const offsets = files
        .map((f) => Number(f.replace(".chunk", "")))
        .sort((a, b) => a - b);
      for (const o of offsets) {
        const chunkBuf = fs.readFileSync(path.join(dir, `${o}.chunk`));
        reassembler.append(o, chunkBuf);
      }
    }
    const rootHex = reassembler.finalize();
    const rootBuf = Buffer.from(rootHex, "hex");
    return { rootBuf, rootHex, dir };
  }

  verifyAndCommitSession(sessionId, publicKeyPem, signature) {
    const { rootBuf, rootHex, dir } = this.computeRootHex(sessionId);
    const meta = this._readMeta(dir) || {};
    const tenant = meta.tenant || this.defaultTenant;
    // RFC 8785 canonicalized commit payload binds root, sessionId, and tenant
    const commitPayload = canonicalize({ root: rootHex, sessionId, tenant });
    try {
      const pubKeyObj = crypto.createPublicKey(publicKeyPem);
      const sigBuf = Buffer.from(signature, "base64");
      const ok = crypto.verify(
        null,
        Buffer.from(commitPayload, "utf8"),
        pubKeyObj,
        sigBuf,
      );
      if (!ok) {
        events.recordSparseEvent("upload_commit_invalid_signature", {
          sessionId,
          tenant,
          traceId: meta.traceId,
        });
        return { ok: false, reason: "invalid_signature" };
      }
    } catch (e) {
      return {
        ok: false,
        reason: "signature_verify_error",
        message: e.message,
      };
    }

    // move to committed area (atomic directory swap with rollback)
    const committedDir = path.join(this.baseDir, "_committed", tenant);
    fs.mkdirSync(committedDir, { recursive: true });
    const dest = path.join(committedDir, sessionId);
    try {
      hsmMetrics.incrementCounter("hsm_track112_commit_atomic_total");
      if (fs.existsSync(dest)) {
        const backup = `${dest}.bak.${crypto.randomBytes(4).toString("hex")}`;
        fs.renameSync(dest, backup);
        try {
          fs.renameSync(dir, dest);
          fs.rmSync(backup, { recursive: true, force: true });
        } catch (swapErr) {
          if (!fs.existsSync(dest) && fs.existsSync(backup))
            fs.renameSync(backup, dest);
          hsmMetrics.incrementCounter(
            "hsm_track112_commit_atomic_rollback_total",
          );
          throw swapErr;
        }
      } else {
        fs.renameSync(dir, dest);
      }
      const newMeta = Object.assign({}, meta, {
        committed: true,
        committedAt: Date.now(),
        root: rootHex,
      });
      fs.writeFileSync(path.join(dest, "meta.json"), JSON.stringify(newMeta));
    } catch (e) {
      console.error("upload-manager.cjs error:", e);
      // fallback: mark committed in place
      meta.committed = true;
      meta.committedAt = Date.now();
      meta.root = rootHex;
      this._writeMeta(dir, meta);
    }
    return { ok: true, root: rootHex };
  }

  /**
   * Find a session directory by searching tenant subdirectories.
   * @param {string} sessionId
   * @returns {{ dir: string|null, meta: object }}
   * @private
   */
  _findSession(sessionId) {
    const tenants = fs.readdirSync(this.baseDir).filter((d) => {
      try {
        return fs.statSync(path.join(this.baseDir, d)).isDirectory();
      } catch (e) {
        return false;
      }
    });
    for (const t of tenants) {
      if (t === "_committed") continue;
      const candidate = path.join(this.baseDir, t, sessionId);
      if (fs.existsSync(candidate)) {
        const meta = this._readMeta(candidate) || {};
        return { dir: candidate, meta };
      }
    }
    return { dir: null, meta: {} };
  }

  // Expose low-level helpers for test & admin use
  listSessions() {
    const tenants = fs
      .readdirSync(this.baseDir)
      .filter((d) => fs.statSync(path.join(this.baseDir, d)).isDirectory());
    const out = [];
    for (const t of tenants) {
      if (t === "_committed") continue;
      const td = path.join(this.baseDir, t);
      for (const s of fs.readdirSync(td)) {
        const dir = path.join(td, s);
        const meta = this._readMeta(dir);
        out.push({ tenant: t, sessionId: s, meta });
      }
    }
    return out;
  }

  removeSessionDir(sessionId) {
    // admin helper
    const tenants = fs
      .readdirSync(this.baseDir)
      .filter((d) => fs.statSync(path.join(this.baseDir, d)).isDirectory());
    for (const t of tenants) {
      const cand = path.join(this.baseDir, t, sessionId);
      if (fs.existsSync(cand)) {
        fs.rmSync(cand, { recursive: true, force: true });
        return true;
      }
    }
    return false;
  }
}

module.exports = UploadManager;
