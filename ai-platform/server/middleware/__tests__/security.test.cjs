"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const { validateInput, validationSchemas } = require("../security.cjs");

describe("security middleware — vault validation schemas", () => {
  describe("validationSchemas", () => {
    it("exports vaultHandshake schema", () => {
      assert.ok(
        validationSchemas.vaultHandshake,
        "vaultHandshake schema should exist",
      );
    });

    it("exports vaultDecrypt schema", () => {
      assert.ok(
        validationSchemas.vaultDecrypt,
        "vaultDecrypt schema should exist",
      );
    });

    it("exports vaultRekey schema", () => {
      assert.ok(validationSchemas.vaultRekey, "vaultRekey schema should exist");
    });
  });

  describe("vaultHandshake schema", () => {
    it("accepts valid provider, keyId, and region", () => {
      const { error, value } = validationSchemas.vaultHandshake.validate({
        provider: "mockhsm",
        keyId: "key-001",
        region: "us-east-1",
      });
      assert.strictEqual(error, undefined);
      assert.strictEqual(value.provider, "mockhsm");
    });

    it("accepts empty object (all fields optional)", () => {
      const { error } = validationSchemas.vaultHandshake.validate({});
      assert.strictEqual(error, undefined);
    });

    it("strips unknown fields", () => {
      const { error, value } = validationSchemas.vaultHandshake.validate(
        {
          provider: "mockhsm",
          maliciousField: "drop table",
        },
        { stripUnknown: true },
      );
      assert.strictEqual(error, undefined);
      assert.strictEqual(value.maliciousField, undefined);
    });

    it("rejects non-string provider", () => {
      const { error } = validationSchemas.vaultHandshake.validate({
        provider: 123,
      });
      assert.ok(error, "should reject non-string provider");
    });
  });

  describe("vaultDecrypt schema", () => {
    it("accepts valid ciphertext", () => {
      const { error, value } = validationSchemas.vaultDecrypt.validate({
        ciphertext: "encrypted-data-here",
      });
      assert.strictEqual(error, undefined);
      assert.strictEqual(value.ciphertext, "encrypted-data-here");
    });

    it("rejects missing ciphertext (required field)", () => {
      const { error } = validationSchemas.vaultDecrypt.validate({});
      assert.ok(error, "should reject missing ciphertext");
      assert.ok(
        error.details[0].message.includes("required"),
        `Expected "required" in: ${error.details[0].message}`,
      );
    });

    it("accepts optional orgId", () => {
      const { error, value } = validationSchemas.vaultDecrypt.validate({
        ciphertext: "data",
        orgId: "org-123",
      });
      assert.strictEqual(error, undefined);
      assert.strictEqual(value.orgId, "org-123");
    });

    it("rejects non-string ciphertext", () => {
      const { error } = validationSchemas.vaultDecrypt.validate({
        ciphertext: 42,
      });
      assert.ok(error, "should reject non-string ciphertext");
    });
  });

  describe("vaultRekey schema", () => {
    it("accepts valid newKeyId and newRegion", () => {
      const { error, value } = validationSchemas.vaultRekey.validate({
        newKeyId: "key-002",
        newRegion: "eu-west-1",
      });
      assert.strictEqual(error, undefined);
      assert.strictEqual(value.newKeyId, "key-002");
    });

    it("accepts empty object (all fields optional)", () => {
      const { error } = validationSchemas.vaultRekey.validate({});
      assert.strictEqual(error, undefined);
    });

    it("rejects non-string newKeyId", () => {
      const { error } = validationSchemas.vaultRekey.validate({
        newKeyId: false,
      });
      assert.ok(error, "should reject non-string newKeyId");
    });
  });

  describe("validateInput middleware", () => {
    function mockReq(body) {
      return { body };
    }
    function mockRes() {
      return {
        statusCode: 200,
        jsonBody: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.jsonBody = body;
          return this;
        },
      };
    }

    it("calls next() for valid vaultHandshake input", () => {
      const middleware = validateInput("vaultHandshake");
      const req = mockReq({
        provider: "mockhsm",
        keyId: "k1",
        region: "us-east-1",
      });
      const res = mockRes();
      let called = false;
      middleware(req, res, () => {
        called = true;
      });
      assert.strictEqual(called, true, "next() should be called");
      assert.strictEqual(res.statusCode, 200);
    });

    it("returns 400 for missing ciphertext on vaultDecrypt", () => {
      const middleware = validateInput("vaultDecrypt");
      const req = mockReq({});
      const res = mockRes();
      let called = false;
      middleware(req, res, () => {
        called = true;
      });
      assert.strictEqual(called, false, "next() should NOT be called");
      assert.strictEqual(res.statusCode, 400);
      assert.ok(res.jsonBody.error.includes("Validation failed"));
    });

    it("returns 400 for unknown schema name", () => {
      const middleware = validateInput("nonexistentSchema");
      const req = mockReq({});
      const res = mockRes();
      let nextError = null;
      middleware(req, res, (err) => {
        nextError = err;
      });
      assert.ok(nextError, "should pass error to next()");
      assert.ok(nextError.message.includes("nonexistentSchema"));
    });

    it("strips unknown fields from vaultHandshake input", () => {
      const middleware = validateInput("vaultHandshake");
      const req = mockReq({ provider: "mockhsm", extraField: "malicious" });
      const res = mockRes();
      middleware(req, res, () => {});
      assert.strictEqual(
        req.body.extraField,
        undefined,
        "unknown fields should be stripped",
      );
      assert.strictEqual(req.body.provider, "mockhsm");
    });
  });
});
