"use strict";

const fs = require("fs");
const path = require("path");

class MigrationWAL {
  /**
   * @param {string} walPath - path to the JSONL WAL file
   */
  constructor(walPath) {
    this.walPath = String(walPath || path.join(process.cwd(), ".enclave-wal"));
    // ensure directory exists
    try {
      fs.mkdirSync(path.dirname(this.walPath), { recursive: true });
    } catch (e) {}
    // ensure file exists
    if (!fs.existsSync(this.walPath))
      fs.writeFileSync(this.walPath, "", "utf8");
  }

  append(entry) {
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(this.walPath, line, "utf8");
  }

  // read full WAL and compute latest per-id
  _readAll() {
    const raw = fs.existsSync(this.walPath)
      ? fs.readFileSync(this.walPath, "utf8")
      : "";
    if (!raw) return [];
    return raw
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
  }

  getPending() {
    const items = this._readAll();
    const lastById = new Map();
    for (const it of items) {
      lastById.set(it.id, it);
    }
    const pending = [];
    for (const [id, it] of lastById.entries()) {
      if (!it || it.status === "applied") continue;
      pending.push(it);
    }
    return pending;
  }

  markApplied(id, extra = {}) {
    const entry = { id, status: "applied", appliedAt: Date.now(), ...extra };
    this.append(entry);
  }

  // alias for compactLog - rewrites file with only pending entries
  checkpoint() {
    return this.compactLog();
  }

  compactLog() {
    const pending = this.getPending();
    const tmp = this.walPath + `.compact-${process.pid}-${Date.now()}`;
    const content =
      pending.map((e) => JSON.stringify(e)).join("\n") +
      (pending.length ? "\n" : "");
    fs.writeFileSync(tmp, content, "utf8");
    fs.renameSync(tmp, this.walPath);
    return { retained: pending.length };
  }
}

module.exports = { MigrationWAL };
