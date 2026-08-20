"use strict";

/**
 * Unit tests for the centralized zeroization utility.
 *
 * Verifies that zeroizeBuffer, zeroizeString, and withZeroizedBuffer
 * correctly scrub sensitive data from memory, handle edge cases without
 * throwing, and guarantee cleanup in finally blocks.
 */

const {
  zeroizeBuffer,
  zeroizeString,
  withZeroizedBuffer,
} = require("../crypto/zeroize.cjs");

describe("zeroize utility", () => {
  // ── zeroizeBuffer ──────────────────────────────────────────────────

  describe("zeroizeBuffer", () => {
    test("Z1: fills buffer contents with zeros", () => {
      const buf = Buffer.from("sensitive-key-data", "utf8");
      expect(buf.every((b) => b !== 0)).toBe(true); // has non-zero content
      zeroizeBuffer(buf);
      expect(buf.every((b) => b === 0)).toBe(true);
    });

    test("Z2: is idempotent (calling twice does not throw)", () => {
      const buf = Buffer.from("test", "utf8");
      zeroizeBuffer(buf);
      zeroizeBuffer(buf); // second call should be safe
      expect(buf.every((b) => b === 0)).toBe(true);
    });

    test("Z3: handles null without throwing", () => {
      expect(() => zeroizeBuffer(null)).not.toThrow();
    });

    test("Z4: handles undefined without throwing", () => {
      expect(() => zeroizeBuffer(undefined)).not.toThrow();
    });

    test("Z5: handles empty buffer without throwing", () => {
      const buf = Buffer.alloc(0);
      expect(() => zeroizeBuffer(buf)).not.toThrow();
    });

    test("Z6: handles non-Buffer values without throwing", () => {
      expect(() => zeroizeBuffer("string")).not.toThrow();
      expect(() => zeroizeBuffer(123)).not.toThrow();
      expect(() => zeroizeBuffer({})).not.toThrow();
      expect(() => zeroizeBuffer([])).not.toThrow();
    });

    test("Z7: zeroizes a large buffer (4KB)", () => {
      const buf = Buffer.alloc(4096, 0xab);
      zeroizeBuffer(buf);
      expect(buf.every((b) => b === 0)).toBe(true);
    });

    test("Z8: zeroizes hex-encoded cryptographic buffer", () => {
      const buf = Buffer.from(
        "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
        "hex",
      );
      expect(buf.length).toBe(32);
      zeroizeBuffer(buf);
      expect(buf.every((b) => b === 0)).toBe(true);
    });
  });

  // ── zeroizeString ──────────────────────────────────────────────────

  describe("zeroizeString", () => {
    test("Z9: returns null after zeroizing string buffer copy", () => {
      const result = zeroizeString("sensitive-token-value");
      expect(result).toBe(null);
    });

    test("Z10: handles null without throwing", () => {
      expect(() => zeroizeString(null)).not.toThrow();
      expect(zeroizeString(null)).toBe(null);
    });

    test("Z11: handles undefined without throwing", () => {
      expect(() => zeroizeString(undefined)).not.toThrow();
      expect(zeroizeString(undefined)).toBe(null);
    });

    test("Z12: handles empty string without throwing", () => {
      expect(() => zeroizeString("")).not.toThrow();
      expect(zeroizeString("")).toBe(null);
    });

    test("Z13: handles non-string types without throwing", () => {
      expect(() => zeroizeString(123)).not.toThrow();
      expect(() => zeroizeString({})).not.toThrow();
      expect(() => zeroizeString([])).not.toThrow();
    });

    test("Z14: accepts custom encoding", () => {
      // base64-encoded string
      const result = zeroizeString("c2VjcmV0LWRhdGE=", "base64");
      expect(result).toBe(null);
    });
  });

  // ── withZeroizedBuffer ─────────────────────────────────────────────

  describe("withZeroizedBuffer", () => {
    test("Z15: passes buffer to callback and returns callback result", () => {
      const result = withZeroizedBuffer("hello", (buf) => {
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect(buf.toString("utf8")).toBe("hello");
        return buf.length;
      });
      expect(result).toBe(5);
    });

    test("Z16: zeroizes buffer after callback returns", () => {
      let capturedBuf;
      const result = withZeroizedBuffer("secret-data", (buf) => {
        capturedBuf = buf; // capture reference
        return "ok";
      });
      expect(result).toBe("ok");
      expect(capturedBuf.every((b) => b === 0)).toBe(true);
    });

    test("Z17: zeroizes buffer even when callback throws", () => {
      let capturedBuf;
      expect(() => {
        withZeroizedBuffer("throw-test", (buf) => {
          capturedBuf = buf;
          throw new Error("callback error");
        });
      }).toThrow("callback error");
      // Buffer must still be zeroized despite the throw
      expect(capturedBuf.every((b) => b === 0)).toBe(true);
    });

    test("Z18: accepts existing Buffer and zeroizes it", () => {
      const existing = Buffer.from("existing-secret");
      const len = withZeroizedBuffer(existing, (buf) => buf.length);
      expect(len).toBe(15);
      // Original buffer should be zeroized
      expect(existing.every((b) => b === 0)).toBe(true);
    });

    test("Z19: throws TypeError when fn is not a function", () => {
      expect(() => withZeroizedBuffer("test", "not-a-function")).toThrow(
        TypeError,
      );
      expect(() => withZeroizedBuffer("test", null)).toThrow(TypeError);
      expect(() => withZeroizedBuffer("test", undefined)).toThrow(TypeError);
    });

    test("Z20: handles empty string input", () => {
      const result = withZeroizedBuffer("", (buf) => {
        return buf.length;
      });
      expect(result).toBe(0);
    });

    test("Z21: supports custom encoding for string conversion", () => {
      const result = withZeroizedBuffer(
        "6b6579",
        (buf) => {
          return buf.toString("utf8");
        },
        "hex",
      );
      expect(result).toBe("key");
    });

    test("Z22: callback can return undefined", () => {
      const result = withZeroizedBuffer("test", () => {
        // no return
      });
      expect(result).toBeUndefined();
    });

    test("Z23: zeroizes large buffer (1KB) in finally block", () => {
      const large = "A".repeat(1024);
      let captured;
      withZeroizedBuffer(large, (buf) => {
        captured = buf;
        expect(buf.length).toBe(1024);
      });
      expect(captured.every((b) => b === 0)).toBe(true);
    });

    test("Z24: nested withZeroizedBuffer calls work correctly", () => {
      const result = withZeroizedBuffer("outer", (outerBuf) => {
        return withZeroizedBuffer("inner", (innerBuf) => {
          return outerBuf.toString("utf8") + "+" + innerBuf.toString("utf8");
        });
        // innerBuf is zeroized here
      });
      // outerBuf is zeroized here
      expect(result).toBe("outer+inner");
    });
  });

  // ── Integration: zeroization prevents data recovery ────────────────

  describe("data recovery prevention", () => {
    test("Z25: zeroized buffer does not contain original string", () => {
      const original = "super-secret-api-key-12345";
      const buf = Buffer.from(original, "utf8");
      zeroizeBuffer(buf);
      const recovered = buf.toString("utf8");
      expect(recovered).not.toBe(original);
      expect(recovered).toBe("\x00".repeat(original.length));
    });

    test("Z26: zeroized buffer from withZeroizedBuffer is empty after return", () => {
      let captured;
      withZeroizedBuffer("token-abc-123", (buf) => {
        captured = buf;
        return true;
      });
      const recovered = captured.toString("utf8");
      expect(recovered).not.toContain("token");
      expect(recovered).not.toContain("abc");
      expect(recovered).not.toContain("123");
    });
  });
});
