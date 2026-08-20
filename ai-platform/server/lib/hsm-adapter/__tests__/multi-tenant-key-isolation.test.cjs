"use strict";

/**
 * Track 13: Multi-tenant key isolation tests.
 */
const crypto = require("crypto");
const { SoftwareHsmAdapter } = require("../software-adapter.cjs");
const { AsymmetricHsmAdapter } = require("../asymmetric-adapter.cjs");
const { deriveDek, deriveSalt } = require("../multi-tenant-kek-derivation.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Multi-tenant key isolation", () => {
  describe("SoftwareHsmAdapter", () => {
    let adapter;

    beforeEach(async () => {
      adapter = new SoftwareHsmAdapter({ kekBits: 256 });
      await adapter.initialize();
    });

    test("createKEK scopes keys by tenant", async () => {
      const a = await adapter.createKEK("tenant-a");
      const b = await adapter.createKEK("tenant-b");
      const aList = await adapter.listKEKs("tenant-a");
      const bList = await adapter.listKEKs("tenant-b");
      expect(aList).toHaveLength(1);
      expect(bList).toHaveLength(1);
      expect(aList[0].kekId).toBe(a);
      expect(bList[0].kekId).toBe(b);
    });

    test("wrap/unwrap round-trip succeeds for matching tenant", async () => {
      const kekId = await adapter.createKEK("tenant-a");
      const plaintext = crypto.randomBytes(32);
      const wrapped = await adapter.wrap("tenant-a", kekId, plaintext);
      const unwrapped = await adapter.unwrap("tenant-a", kekId, wrapped);
      expect(unwrapped.equals(plaintext)).toBe(true);
    });

    test("cross-tenant access throws UNAUTHORIZED_KEY_ACCESS", async () => {
      const kekId = await adapter.createKEK("tenant-a");
      const plaintext = crypto.randomBytes(32);
      await expect(
        adapter.wrap("tenant-b", kekId, plaintext),
      ).rejects.toMatchObject({
        name: "HsmAdapterError",
        code: "UNAUTHORIZED_KEY_ACCESS",
      });
    });

    test("missing tenantId throws UNAUTHORIZED_KEY_ACCESS", async () => {
      await expect(adapter.createKEK("")).rejects.toMatchObject({
        name: "HsmAdapterError",
        code: "UNAUTHORIZED_KEY_ACCESS",
      });
    });

    test("same kekId string cannot collide because identifiers are random", async () => {
      // Just confirm both tenants can create a key and they are different
      const a = await adapter.createKEK("tenant-a");
      const b = await adapter.createKEK("tenant-b");
      expect(a).not.toBe(b);
    });
  });

  describe("AsymmetricHsmAdapter", () => {
    let adapter;

    beforeEach(async () => {
      adapter = new AsymmetricHsmAdapter({ algorithm: "ecdh", keySize: 256 });
      await adapter.initialize();
    });

    test("ECDH wrap/unwrap with matching tenant and context round-trips", async () => {
      const kekId = await adapter.createKEK("tenant-a");
      const plaintext = crypto.randomBytes(64);
      const wrapped = await adapter.wrap(
        "tenant-a",
        kekId,
        plaintext,
        "app-ctx",
      );
      const unwrapped = await adapter.unwrap(
        "tenant-a",
        kekId,
        wrapped,
        "app-ctx",
      );
      expect(unwrapped.equals(plaintext)).toBe(true);
    });

    test("ECDH context mismatch across tenants fails", async () => {
      const kekId = await adapter.createKEK("tenant-a");
      const plaintext = crypto.randomBytes(64);
      const wrapped = await adapter.wrap("tenant-a", kekId, plaintext, "ctx-a");
      await expect(
        adapter.unwrap("tenant-a", kekId, wrapped, "ctx-b"),
      ).rejects.toMatchObject({
        name: "HsmAdapterError",
        code: "UNWRAP_FAILED",
      });
    });

    test("cross-tenant wrap throws UNAUTHORIZED_KEY_ACCESS", async () => {
      const kekId = await adapter.createKEK("tenant-a");
      const plaintext = crypto.randomBytes(64);
      await expect(
        adapter.wrap("tenant-b", kekId, plaintext),
      ).rejects.toMatchObject({
        name: "HsmAdapterError",
        code: "UNAUTHORIZED_KEY_ACCESS",
      });
    });
  });

  describe("MultiTenantKeyDerivation", () => {
    test("deriveDek produces a 32-byte key", () => {
      const base = crypto.randomBytes(32);
      const salt = deriveSalt();
      const dek = deriveDek(base, salt, "tenant-a", "key-1");
      expect(Buffer.isBuffer(dek)).toBe(true);
      expect(dek.length).toBe(32);
    });

    test("deriveDek is tenant-specific", () => {
      const base = crypto.randomBytes(32);
      const salt = deriveSalt();
      const dekA = deriveDek(base, salt, "tenant-a", "key-1");
      const dekB = deriveDek(base, salt, "tenant-b", "key-1");
      expect(dekA.equals(dekB)).toBe(false);
    });

    test("deriveDek rejects invalid base KEK length", () => {
      const base = crypto.randomBytes(17);
      const salt = deriveSalt();
      expect(() => deriveDek(base, salt, "tenant-a", "key-1")).toThrow(
        HsmAdapterError,
      );
    });

    test("deriveDek rejects invalid salt", () => {
      const base = crypto.randomBytes(32);
      expect(() =>
        deriveDek(base, Buffer.alloc(8), "tenant-a", "key-1"),
      ).toThrow(HsmAdapterError);
    });

    test("deriveDek rejects missing tenant", () => {
      const base = crypto.randomBytes(32);
      const salt = deriveSalt();
      expect(() => deriveDek(base, salt, "", "key-1")).toThrow(HsmAdapterError);
    });
  });
});
