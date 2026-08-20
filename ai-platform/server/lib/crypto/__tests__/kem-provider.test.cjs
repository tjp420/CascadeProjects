const assert = require("assert");
const kem = require("../ratchet/kem-provider.cjs");

describe("kem-provider prototype", () => {
  it("happy-path: encapsulate/decapsulate produce same shared secret", () => {
    const recipient = kem.generateKeyPair();
    const senderResult = kem.encapsulate(recipient.publicKeyObj);
    const recipientSecret = kem.decapsulate(
      senderResult.ciphertext,
      recipient.privateKeyObj,
    );

    assert.strictEqual(Buffer.from(senderResult.sharedSecret).length, 32);
    assert.strictEqual(Buffer.from(recipientSecret).length, 32);
    assert.deepStrictEqual(
      Buffer.from(senderResult.sharedSecret),
      Buffer.from(recipientSecret),
    );
  });
});
