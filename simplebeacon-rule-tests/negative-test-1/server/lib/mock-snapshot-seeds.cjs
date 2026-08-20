// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
/**
 * Negative Test Case: Platform Infrastructure File
 * Expected Behavior: PASS - Should NOT trigger production leak finding
 * Reason: Mimics platform infrastructure file structure that should be ignored by isPlatformScannerMetaPath
 * This file contains dummy data that looks like secrets but is legitimate platform seed data
 * simplebeacon:production-leak-intent: test-negative-case - Intentional negative test case for SimpleBeacon rule validation
 */

const mockSnapshotSeeds = {
  sampleAuditReport: {
    projectId: "sample-project-123",
    timestamp: "2026-06-01T00:00:00.000Z",
    findings: [
      {
        id: "sample-finding-1",
        severity: "high",
        description: "Sample credential pattern for testing",
        pattern: "sample-api-key-pattern",
      },
    ],
  },
  templateSample: {
    // simplebeacon:production-leak-intent: test-negative-case - Intentional negative test case credentials for SimpleBeacon rule validation
    databaseUrl: "postgresql://user:placeholder@localhost:5432/db", // simplebeacon:production-leak-intent: test-negative-case - Intentional negative test case database URL
    apiKey: "sk_test_your_api_key_here", // simplebeacon:production-leak-intent: test-negative-case - Intentional negative test case API key
    secret: "sample-secret-for-template-rendering",
  },
  sampleJson: {
    mockCredential: "mock-credential-value-for-testing",
    placeholderKey: "placeholder-key-12345",
  },
};

function getSnapshotSeed(type) {
  return mockSnapshotSeeds[type] || null;
}

module.exports = { getSnapshotSeed, mockSnapshotSeeds };
