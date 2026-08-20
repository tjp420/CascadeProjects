"use strict";

const {
  isPublicRegistrationAllowed,
  registrationRequiresApproval,
  validateRegistrationPayload,
} = require("../../server/lib/auth/registration-policy.cjs");

describe("registration-policy", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  test("public registration is off by default", () => {
    delete process.env.SIMPLEBEACON_ALLOW_PUBLIC_REGISTRATION;
    expect(isPublicRegistrationAllowed()).toBe(false);
  });

  test("public registration enables only when env is true", () => {
    process.env.SIMPLEBEACON_ALLOW_PUBLIC_REGISTRATION = "true";
    expect(isPublicRegistrationAllowed()).toBe(true);
  });

  test("approval is required unless auto-activate is true", () => {
    delete process.env.SIMPLEBEACON_REGISTRATION_AUTO_ACTIVATE;
    expect(registrationRequiresApproval()).toBe(true);

    process.env.SIMPLEBEACON_REGISTRATION_AUTO_ACTIVATE = "true";
    expect(registrationRequiresApproval()).toBe(false);
  });

  test("validateRegistrationPayload accepts a complete payload", () => {
    const result = validateRegistrationPayload({
      name: "Jane Doe",
      username: "jane_doe",
      email: "Jane@Example.com",
      password: "securepass",
      confirmPassword: "securepass",
    });
    expect(result.ok).toBe(true);
    expect(result.email).toBe("jane@example.com");
    expect(result.username).toBe("jane_doe");
  });

  test("validateRegistrationPayload rejects weak or mismatched passwords", () => {
    expect(
      validateRegistrationPayload({
        name: "Jane Doe",
        username: "jane",
        email: "jane@example.com",
        password: "short",
        confirmPassword: "short",
      }).ok,
    ).toBe(false);

    expect(
      validateRegistrationPayload({
        name: "Jane Doe",
        username: "jane",
        email: "jane@example.com",
        password: "longenough",
        confirmPassword: "different",
      }).error,
    ).toBe("password_mismatch");
  });
});
