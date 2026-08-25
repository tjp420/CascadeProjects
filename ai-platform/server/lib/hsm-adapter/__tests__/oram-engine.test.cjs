"use strict";

/**
 * Track 56: Oblivious RAM (ORAM) and Secure Side-Channel Memory Attenuation tests.
 */
const crypto = require("crypto");
const {
  OramEngine,
  DEFAULT_OPTIONS,
  BLOCK_STATUS,
} = require("../oram-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Track 56: OramEngine", () => {
  let oram;

  beforeEach(() => {
    oram = new OramEngine({
      bucketSize: 4,
      treeDepth: 4, // 16 leaves
      blockSize: 1024,
      maxStashSize: 50,
      maxBlocks: 100,
      enableDummyAccesses: true,
    });
  });

  describe("write", () => {
    test("writes a block", () => {
      const data = Buffer.from("hello world");
      const result = oram.write(0, data);
      expect(result.written).toBe(true);
      expect(result.blockId).toBe(0);
      expect(result.size).toBe(data.length);
    });

    test("rejects negative block ID", () => {
      expect(() => oram.write(-1, Buffer.from("a"))).toThrow(HsmAdapterError);
    });

    test("rejects block ID too high", () => {
      expect(() => oram.write(100, Buffer.from("a"))).toThrow(HsmAdapterError);
    });

    test("rejects non-Buffer data", () => {
      expect(() => oram.write(0, "not-a-buffer")).toThrow(HsmAdapterError);
    });

    test("rejects data too large", () => {
      const big = Buffer.alloc(2048);
      expect(() => oram.write(0, big)).toThrow(HsmAdapterError);
    });

    test("overwrites existing block", () => {
      oram.write(0, Buffer.from("first"));
      oram.write(0, Buffer.from("second"));
      const result = oram.read(0);
      expect(result.data.toString()).toBe("second");
    });
  });

  describe("read", () => {
    test("reads a written block", () => {
      const data = Buffer.from("hello world");
      oram.write(0, data);
      const result = oram.read(0);
      expect(result.read).toBe(true);
      expect(result.data.toString()).toBe("hello world");
    });

    test("rejects negative block ID", () => {
      expect(() => oram.read(-1)).toThrow(HsmAdapterError);
    });

    test("rejects block ID too high", () => {
      expect(() => oram.read(100)).toThrow(HsmAdapterError);
    });

    test("rejects non-existent block", () => {
      expect(() => oram.read(0)).toThrow(HsmAdapterError);
    });

    test("reads after multiple writes", () => {
      oram.write(0, Buffer.from("block-0"));
      oram.write(1, Buffer.from("block-1"));
      oram.write(2, Buffer.from("block-2"));
      expect(oram.read(0).data.toString()).toBe("block-0");
      expect(oram.read(1).data.toString()).toBe("block-1");
      expect(oram.read(2).data.toString()).toBe("block-2");
    });

    test("reads after overwrite and position remap", () => {
      oram.write(0, Buffer.from("original"));
      oram.read(0); // triggers remap
      oram.write(0, Buffer.from("updated"));
      expect(oram.read(0).data.toString()).toBe("updated");
    });
  });

  describe("delete", () => {
    test("deletes a block", () => {
      oram.write(0, Buffer.from("hello"));
      const result = oram.delete(0);
      expect(result.deleted).toBe(true);
      expect(oram.has(0)).toBe(false);
    });

    test("rejects non-existent block", () => {
      expect(() => oram.delete(0)).toThrow(HsmAdapterError);
    });

    test("rejects negative block ID", () => {
      expect(() => oram.delete(-1)).toThrow(HsmAdapterError);
    });
  });

  describe("has", () => {
    test("returns true for existing block", () => {
      oram.write(0, Buffer.from("a"));
      expect(oram.has(0)).toBe(true);
    });

    test("returns false for non-existent block", () => {
      expect(oram.has(0)).toBe(false);
    });

    test("returns false for negative block ID", () => {
      expect(oram.has(-1)).toBe(false);
    });
  });

  describe("getBlockInfo", () => {
    test("returns block metadata", () => {
      oram.write(0, Buffer.from("hello"));
      const info = oram.getBlockInfo(0);
      expect(info).not.toBeNull();
      expect(info.blockId).toBe(0);
      expect(info.size).toBe(5);
      expect(info.accessCount).toBeGreaterThanOrEqual(1);
    });

    test("returns null for non-existent block", () => {
      expect(oram.getBlockInfo(0)).toBeNull();
    });
  });

  describe("getBlockIds", () => {
    test("returns all block IDs", () => {
      oram.write(2, Buffer.from("a"));
      oram.write(0, Buffer.from("b"));
      oram.write(1, Buffer.from("c"));
      const ids = oram.getBlockIds();
      expect(ids).toEqual([0, 1, 2]);
    });
  });

  describe("getStashSize", () => {
    test("returns stash size", () => {
      const size = oram.getStashSize();
      expect(typeof size).toBe("number");
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getAccessLog", () => {
    test("returns access log entries", () => {
      oram.write(0, Buffer.from("hello"));
      const log = oram.getAccessLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[0].event).toBe("ORAM_WRITE");
    });
  });

  describe("verifyAccessLogIntegrity", () => {
    test("verifies intact log", () => {
      oram.write(0, Buffer.from("a"));
      oram.read(0);
      const result = oram.verifyAccessLogIntegrity();
      expect(result.intact).toBe(true);
    });
  });

  describe("getStats", () => {
    test("returns summary statistics", () => {
      oram.write(0, Buffer.from("a"));
      const stats = oram.getStats();
      expect(stats.totalBlocks).toBe(1);
      expect(stats.treeDepth).toBe(4);
      expect(stats.leafCount).toBe(16);
      expect(stats.accessCount).toBeGreaterThan(0);
    });
  });

  describe("evictStash", () => {
    test("evicts overflow blocks", () => {
      const small = new OramEngine({
        bucketSize: 2,
        treeDepth: 3,
        blockSize: 64,
        maxStashSize: 2,
        maxBlocks: 50,
        enableDummyAccesses: false,
      });
      // Write several blocks to fill stash
      for (let i = 0; i < 10; i++) {
        small.write(i, Buffer.from(`block-${i}`));
      }
      const evicted = small.evictStash();
      expect(evicted).toBeGreaterThanOrEqual(0);
      expect(small.getStashSize()).toBeLessThanOrEqual(2);
    });

    test("returns 0 when no overflow", () => {
      oram.write(0, Buffer.from("a"));
      const evicted = oram.evictStash();
      expect(evicted).toBe(0);
    });
  });

  describe("reset", () => {
    test("clears all state", () => {
      oram.write(0, Buffer.from("a"));
      oram.reset();
      expect(oram.getStats().totalBlocks).toBe(0);
      expect(oram.getStats().accessCount).toBe(0);
    });
  });

  describe("oblivious access patterns", () => {
    test("all reads produce same number of log entries", () => {
      oram.write(0, Buffer.from("block-0"));
      oram.write(1, Buffer.from("block-1"));
      oram.write(2, Buffer.from("block-2"));
      const logBefore0 = oram.getAccessLog().length;
      oram.read(0);
      const logAfter0 = oram.getAccessLog().length;
      const entries0 = logAfter0 - logBefore0;
      oram.read(1);
      const logAfter1 = oram.getAccessLog().length;
      const entries1 = logAfter1 - logAfter0;
      // Each read should produce the same number of log entries
      expect(entries0).toBe(entries1);
    });

    test("dummy accesses are performed", () => {
      const noDummy = new OramEngine({
        bucketSize: 4,
        treeDepth: 4,
        blockSize: 1024,
        maxBlocks: 100,
        enableDummyAccesses: false,
      });
      noDummy.write(0, Buffer.from("a"));
      const statsNoDummy = noDummy.getStats();
      const withDummy = new OramEngine({
        bucketSize: 4,
        treeDepth: 4,
        blockSize: 1024,
        maxBlocks: 100,
        enableDummyAccesses: true,
      });
      withDummy.write(0, Buffer.from("a"));
      const statsWithDummy = withDummy.getStats();
      expect(statsWithDummy.dummyAccessCount).toBeGreaterThan(
        statsNoDummy.dummyAccessCount,
      );
    });
  });

  describe("full ORAM flow", () => {
    test("complete write -> read -> update -> delete flow", () => {
      // Write multiple blocks
      const blocks = [
        { id: 0, data: Buffer.from("first block data") },
        { id: 1, data: Buffer.from("second block data") },
        { id: 2, data: Buffer.from("third block data") },
        { id: 3, data: Buffer.from("fourth block data") },
        { id: 4, data: Buffer.from("fifth block data") },
      ];
      for (const b of blocks) {
        oram.write(b.id, b.data);
      }
      // Verify all blocks can be read
      for (const b of blocks) {
        const result = oram.read(b.id);
        expect(result.data.toString()).toBe(b.data.toString());
      }
      // Update a block
      oram.write(2, Buffer.from("updated third block"));
      expect(oram.read(2).data.toString()).toBe("updated third block");
      // Delete a block
      oram.delete(0);
      expect(oram.has(0)).toBe(false);
      // Verify remaining blocks still accessible
      expect(oram.read(1).data.toString()).toBe("second block data");
      expect(oram.read(3).data.toString()).toBe("fourth block data");
      expect(oram.read(4).data.toString()).toBe("fifth block data");
      // Verify stats
      const stats = oram.getStats();
      expect(stats.totalBlocks).toBe(4); // 0 was deleted
      // Verify log integrity
      const integrity = oram.verifyAccessLogIntegrity();
      expect(integrity.intact).toBe(true);
    });
  });
});
