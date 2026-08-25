"use strict";

/**
 * Filesystem storage adapter for BackupCoordinator.
 *
 * Persists encrypted backup archives to a directory on disk. Each archive is
 * stored as a single file named by its archiveId. A sidecar JSON metadata
 * file is written alongside to support fast listing without reading the
 * full encrypted buffer.
 *
 * @module backup-storage-filesystem
 */

const fs = require("fs");
const path = require("path");

/**
 * Create a filesystem-backed storage adapter.
 *
 * @param {object} opts
 * @param {string} opts.directory - Directory to store archives in
 * @returns {{ write: (string, Buffer) => Promise<void>, read: (string) => Promise<Buffer|null>, delete: (string) => Promise<void>, list: () => Promise<Array> }}
 */
function createFilesystemStorage(opts) {
  if (!opts || !opts.directory) {
    throw new Error(
      "INVALID_CONFIG: backup-storage-filesystem: directory is required",
    );
  }
  const dir = path.resolve(opts.directory);
  fs.mkdirSync(dir, { recursive: true });

  function archivePath(archiveId) {
    return path.join(dir, `${archiveId}.bin`);
  }

  function metaPath(archiveId) {
    return path.join(dir, `${archiveId}.meta.json`);
  }

  function parseArchiveId(archiveId) {
    // Format: bkp-{timestamp}-{hex}
    const parts = archiveId.split("-");
    const timestamp = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
    return { timestamp, valid: parts.length >= 3 };
  }

  return {
    async write(archiveId, buffer) {
      const { timestamp } = parseArchiveId(archiveId);
      const meta = {
        archiveId,
        timestamp,
        size: buffer.length,
        checksum: "",
        createdAt: Date.now(),
      };
      fs.writeFileSync(archivePath(archiveId), buffer);
      fs.writeFileSync(metaPath(archiveId), JSON.stringify(meta));
    },

    async read(archiveId) {
      const p = archivePath(archiveId);
      if (!fs.existsSync(p)) return null;
      return fs.readFileSync(p);
    },

    async delete(archiveId) {
      try {
        fs.unlinkSync(archivePath(archiveId));
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(metaPath(archiveId));
      } catch {
        /* ignore */
      }
    },

    async list() {
      const files = fs.readdirSync(dir);
      const archives = [];
      for (const name of files) {
        if (!name.endsWith(".meta.json")) continue;
        try {
          const meta = JSON.parse(
            fs.readFileSync(path.join(dir, name), "utf8"),
          );
          archives.push({
            archiveId: meta.archiveId,
            timestamp: meta.timestamp,
            size: meta.size,
            checksum: meta.checksum || "",
          });
        } catch {
          /* skip corrupt meta */
        }
      }
      return archives.sort((a, b) => a.timestamp - b.timestamp);
    },
  };
}

module.exports = { createFilesystemStorage };
