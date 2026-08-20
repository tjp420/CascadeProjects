"use strict";

/**
 * Track 15: Secure zeroization unit tests.
 */
const crypto = require("crypto");
const {
  secureZeroize,
  secureZeroizeKeyObject,
} = require("../secure-zeroize.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("secureZeroize", () => {
  test("random strategy overwrites all bytes", () => {
    const original = crypto.randomBytes(32);
    const before = Buffer.from(original);
    secureZeroize(original, { strategy: "random" });
    expect(original.length).toBe(before.length);
    expect(original.equals(before)).toBe(false);
  });

  test("zeros strategy fills buffer with 0x00", () => {
    const original = crypto.randomBytes(32);
    secureZeroize(original, { strategy: "zeros" });
    expect(original.equals(Buffer.alloc(32))).toBe(true);
  });

  test("both strategy ends as all zeros", () => {
    const original = crypto.randomBytes(32);
    secureZeroize(original, { strategy: "both" });
    expect(original.equals(Buffer.alloc(32))).toBe(true);
  });

  test("default strategy is random", () => {
    const original = crypto.randomBytes(32);
    const before = Buffer.from(original);
    secureZeroize(original);
    expect(original.equals(before)).toBe(false);
  });

  test("throws on non-Buffer input", () => {
    expect(() => secureZeroize("not-a-buffer")).toThrow(HsmAdapterError);
  });

  test("throws on unknown strategy", () => {
    const buf = Buffer.alloc(16);
    expect(() => secureZeroize(buf, { strategy: "xor" })).toThrow(
      HsmAdapterError,
    );
  });
});

describe("secureZeroizeKeyObject", () => {
  test("returns undefined for null input", () => {
    expect(secureZeroizeKeyObject(null)).toBeUndefined();
  });

  test("runs without error for a valid KeyObject", () => {
    const { publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    expect(() => secureZeroizeKeyObject(publicKey)).not.toThrow();
  });
});
