"use strict";

/**
 * Track 31: Governance derivation tests.
 */
const crypto = require("crypto");
const {
  GovernancePolicyBroker,
  _canonicalPayload,
} = require("../governance-policy-broker.cjs");
const { HomomorphicKeyDeriver } = require("../homomorphic-key-deriver.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

function sign(admin, proposal) {
  const payload = _canonicalPayload({ ...proposal, signer: admin });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

describe("Track 31 governance derivation", () => {
  test("broker reaches quorum and commits a proposal", () => {
    const events = [];
    const broker = new GovernancePolicyBroker({
      minAdminQuorum: 2,
      proposalExpiryMs: 60000,
      allowedAdmins: ["alice", "bob", "carol"],
      audit: (event, info) => events.push({ event, info }),
    });

    const proposal = {
      proposalId: "prop-1",
      nonce: "nonce-1",
      sponsor: "alice",
      policyHash: "deadbeef",
      timestamp: Date.now(),
    };

    broker.initiate(proposal);
    expect(
      events.some((e) => e.event === "GOVERNANCE_PROPOSAL_INITIATED"),
    ).toBe(true);

    broker.sign(proposal.proposalId, {
      signer: "alice",
      signature: sign("alice", proposal),
    });
    broker.sign(proposal.proposalId, {
      signer: "bob",
      signature: sign("bob", proposal),
    });

    const committed = broker.commit(proposal.proposalId);
    expect(committed.committed).toBe(true);
    expect(events.some((e) => e.event === "POLICY_CONSENSUS_COMMITTED")).toBe(
      true,
    );
  });

  test("broker rejects unapproved signer", () => {
    const broker = new GovernancePolicyBroker({
      allowedAdmins: ["alice", "bob"],
    });
    const proposal = {
      proposalId: "prop-2",
      nonce: "n",
      sponsor: "a",
      policyHash: "h",
      timestamp: Date.now(),
    };
    broker.initiate(proposal);
    expect(() =>
      broker.sign(proposal.proposalId, { signer: "mallory", signature: "x" }),
    ).toThrow(HsmAdapterError);
  });

  test("broker rejects expired proposal", () => {
    const broker = new GovernancePolicyBroker({ proposalExpiryMs: 100 });
    const proposal = {
      proposalId: "prop-3",
      nonce: "n",
      sponsor: "a",
      policyHash: "h",
      timestamp: Date.now() - 200,
    };
    broker.initiate(proposal);
    expect(() =>
      broker.sign(proposal.proposalId, { signer: "alice", signature: "x" }),
    ).toThrow(HsmAdapterError);
  });

  test("broker rejects duplicate signers and insufficient quorum", () => {
    const broker = new GovernancePolicyBroker({
      minAdminQuorum: 2,
      allowedAdmins: ["alice", "bob"],
    });
    const proposal = {
      proposalId: "prop-4",
      nonce: "n",
      sponsor: "a",
      policyHash: "h",
      timestamp: Date.now(),
    };
    broker.initiate(proposal);
    broker.sign(proposal.proposalId, {
      signer: "alice",
      signature: sign("alice", proposal),
    });
    expect(() =>
      broker.sign(proposal.proposalId, {
        signer: "alice",
        signature: sign("alice", proposal),
      }),
    ).toThrow(HsmAdapterError);
    expect(() => broker.commit(proposal.proposalId)).toThrow(HsmAdapterError);
  });

  test("deriver produces multi-depth child keys", () => {
    const events = [];
    const deriver = new HomomorphicKeyDeriver({
      parentKey: crypto.randomBytes(32),
      kemPrimitive: "ml-kem-768",
      derivationCurve: "P-384",
      maxChildDerivationDepth: 5,
      audit: (event, info) => events.push({ event, info }),
    });

    const keys = [];
    for (let d = 0; d <= 5; d += 1) {
      const k = deriver.derive(crypto.randomBytes(32), "prop-1", d);
      expect(k.publicKey).toHaveLength(64);
      expect(k.depth).toBe(d);
      keys.push(k.publicKey);
    }

    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
    expect(events.some((e) => e.event === "CHILD_KEY_DERIVED")).toBe(true);
  });

  test("deriver rejects disallowed KEM primitive", () => {
    const deriver = new HomomorphicKeyDeriver({
      parentKey: crypto.randomBytes(32),
      kemPrimitive: "bad-kem",
    });
    expect(() => deriver.derive(crypto.randomBytes(32), "prop", 0)).toThrow(
      HsmAdapterError,
    );
  });

  test("deriver rejects depth exceeding policy", () => {
    const deriver = new HomomorphicKeyDeriver({
      parentKey: crypto.randomBytes(32),
      maxChildDerivationDepth: 3,
    });
    expect(() => deriver.derive(crypto.randomBytes(32), "prop", 4)).toThrow(
      HsmAdapterError,
    );
  });

  test("CryptoPolicyEngine validates governance configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "governance", {
        depth: 5,
        curve: "P-384",
        kemPrimitive: "ml-kem-768",
        requirePqcBlindingFactor: true,
        minAdminQuorum: 3,
      }),
    ).not.toThrow();

    expect(() => engine.validate("t1", "governance", { depth: 100 })).toThrow(
      HsmAdapterError,
    );
    expect(() =>
      engine.validate("t1", "governance", { curve: "B-123" }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "governance", { kemPrimitive: "bad" }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "governance", { requirePqcBlindingFactor: false }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "governance", { minAdminQuorum: 1 }),
    ).toThrow(HsmAdapterError);
  });
});
