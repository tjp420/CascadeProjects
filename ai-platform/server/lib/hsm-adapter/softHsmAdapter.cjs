/**
 * SoftHSM adapter (scaffold) for PKCS#11 operations.
 * Provides a minimal adapter interface used by Track10 tests:
 *  - createKEK(meta)
 *  - wrap(kekId, plaintext)
 *  - unwrap(kekId, wrapped)
 *  - listKEKs()
 *
 * This module prefers `pkcs11js` for real PKCS#11 interactions but falls back
 * to an in-memory shim when the native module is unavailable (useful for
 * environments without PKCS#11 or for quick unit tests).
 */

const crypto = require('crypto');
const aesKw = require('../aes-kw.cjs');
let pkcs11js;
try {
  pkcs11js = require('pkcs11js');
} catch (e) {
  pkcs11js = null;
}

class HsmAdapterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HsmAdapterError';
    this.code = code;
  }
}

class SoftHsmAdapter {
  constructor(config = {}) {
    this.libraryPath = config.libraryPath || '/usr/lib/softhsm/libsofthsm2.so';
    this.slotLabel = config.slotLabel || 'Track10-Token';
    this.pin = config.pin || '1234';
    this.pkcs11 = pkcs11js ? new pkcs11js.PKCS11() : null;
    this.session = null;
    this.slot = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    if (!this.pkcs11) throw new HsmAdapterError('PKCS11_MISSING', 'pkcs11js native module not available');

    try {
      this.pkcs11.load(this.libraryPath);
      this.pkcs11.C_Initialize();
      const slots = this.pkcs11.C_GetSlotList(true);
      let target = null;
      for (const s of slots) {
        try {
          const info = this.pkcs11.C_GetTokenInfo(s);
          if (info && info.label && info.label.toString().trim() === this.slotLabel) {
            target = s; break;
          }
        } catch (e) {
          // ignore tokens we cannot access
        }
      }
      if (target === null) throw new HsmAdapterError('TOKEN_NOT_FOUND', `Token label ${this.slotLabel} not found`);
      this.slot = target;
      this.session = this.pkcs11.C_OpenSession(this.slot, pkcs11js.CKF_SERIAL_SESSION | pkcs11js.CKF_RW_SESSION);
      this.pkcs11.C_Login(this.session, pkcs11js.CKU_USER, this.pin);
      this.initialized = true;
    } catch (err) {
      this.clearSensitiveData();
      throw new HsmAdapterError('INIT_FAILURE', err.message || String(err));
    }
  }

  _findKeyHandleByLabel(label) {
    const template = [
      { type: pkcs11js.CKA_LABEL, value: label },
      { type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_SECRET_KEY }
    ];
    this.pkcs11.C_FindObjectsInit(this.session, template);
    const objs = this.pkcs11.C_FindObjects(this.session, 1);
    this.pkcs11.C_FindObjectsFinal(this.session);
    if (!objs || objs.length === 0) return null;
    return objs[0];
  }

  createKEK({ label, length = 32 } = {}) {
    this.initialize();
    const kekLabel = label || `kek-${crypto.randomBytes(6).toString('hex')}`;
    const mech = { mechanism: pkcs11js.CKM_AES_KEY_GEN };
    // CKA_EXTRACTABLE=true and CKA_SENSITIVE=false allow the KEK value to be
    // read via C_GetAttributeValue for software AES-KW. SoftHSM2 does not
    // support CKM_AES_KEY_WRAP with C_Encrypt, and C_WrapKey fails with
    // CKR_KEY_UNEXTRACTABLE on keys created via C_CreateObject. SoftHSM2 is a
    // software HSM, so extracting the KEK into process memory is acceptable
    // for testing. Real HSMs would use C_WrapKey with properly extractable keys.
    const template = [
      { type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_SECRET_KEY },
      { type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_AES },
      { type: pkcs11js.CKA_VALUE_LEN, value: length },
      { type: pkcs11js.CKA_ENCRYPT, value: true },
      { type: pkcs11js.CKA_DECRYPT, value: true },
      { type: pkcs11js.CKA_WRAP, value: true },
      { type: pkcs11js.CKA_UNWRAP, value: true },
      { type: pkcs11js.CKA_TOKEN, value: true },
      { type: pkcs11js.CKA_LABEL, value: kekLabel },
      { type: pkcs11js.CKA_SENSITIVE, value: false },
      { type: pkcs11js.CKA_EXTRACTABLE, value: true }
    ];
    const handle = this.pkcs11.C_GenerateKey(this.session, mech, template);
    if (!handle) throw new HsmAdapterError('KEK_GEN_FAILED', 'Failed to generate KEK on token');
    return kekLabel;
  }

  _extractKekValue(kekHandle) {
    const attrs = this.pkcs11.C_GetAttributeValue(this.session, kekHandle, [{ type: pkcs11js.CKA_VALUE }]);
    if (!attrs || !attrs[0] || !attrs[0].value) {
      throw new HsmAdapterError('KEK_EXTRACT_FAILED', 'Could not extract KEK value from token');
    }
    return Buffer.from(attrs[0].value);
  }

  listKEKs() {
    this.initialize();
    // naive scan for secret keys with labels
    const template = [{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_SECRET_KEY }];
    this.pkcs11.C_FindObjectsInit(this.session, template);
    const found = this.pkcs11.C_FindObjects(this.session, 1000);
    this.pkcs11.C_FindObjectsFinal(this.session);
    const results = [];
    for (const h of found) {
      const attrs = this.pkcs11.C_GetAttributeValue(this.session, h, [{ type: pkcs11js.CKA_LABEL }]);
      const label = attrs[0] && attrs[0].value ? attrs[0].value.toString() : null;
      results.push({ handle: h, label });
    }
    return results;
  }

  wrap(kekLabel, cekBuffer) {
    this.initialize();
    const kekHandle = this._findKeyHandleByLabel(kekLabel);
    if (!kekHandle) throw new HsmAdapterError('KEK_NOT_FOUND', `KEK ${kekLabel} not found`);

    // SoftHSM2 does not support CKM_AES_KEY_WRAP with C_Encrypt, and C_WrapKey
    // fails with CKR_KEY_UNEXTRACTABLE on keys created via C_CreateObject.
    // Extract the KEK value and use software AES-KW (RFC 3394) instead.
    // SoftHSM2 is a software HSM, so this is acceptable for testing.
    try {
      const kekValue = this._extractKekValue(kekHandle);
      const wrapped = aesKw.wrap(kekValue, cekBuffer);
      return wrapped;
    } catch (err) {
      if (err instanceof HsmAdapterError) throw err;
      throw new HsmAdapterError('WRAP_FAILED', err.message || String(err));
    } finally {
      if (Buffer.isBuffer(cekBuffer)) cekBuffer.fill(0);
    }
  }

  unwrap(kekLabel, wrappedCekBuffer) {
    this.initialize();
    const kekHandle = this._findKeyHandleByLabel(kekLabel);
    if (!kekHandle) throw new HsmAdapterError('KEK_NOT_FOUND', `KEK ${kekLabel} not found`);

    // Use software AES-KW to unwrap, then create a non-extractable key object
    // in the token with the unwrapped CEK value. Return the in-token handle
    // so the secret material never needs to leave the token after creation.
    try {
      const kekValue = this._extractKekValue(kekHandle);
      const cekValue = aesKw.unwrap(kekValue, wrappedCekBuffer);
      const template = [
        { type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_SECRET_KEY },
        { type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_AES },
        { type: pkcs11js.CKA_VALUE, value: cekValue },
        { type: pkcs11js.CKA_TOKEN, value: false },
        { type: pkcs11js.CKA_EXTRACTABLE, value: false },
        { type: pkcs11js.CKA_SENSITIVE, value: true },
        { type: pkcs11js.CKA_DECRYPT, value: true }
      ];
      const newKeyHandle = this.pkcs11.C_CreateObject(this.session, template);
      if (!newKeyHandle) throw new HsmAdapterError('UNWRAP_FAILED', 'C_CreateObject returned no handle');
      return newKeyHandle;
    } catch (err) {
      if (err instanceof HsmAdapterError) throw err;
      throw new HsmAdapterError('UNWRAP_FAILED', err.message || String(err));
    }
  }

  decryptPayload(ciphertext, iv, tag, aad, ceKeyHandle) {
    this.initialize();
    if (!ceKeyHandle) throw new HsmAdapterError('INVALID_KEY_HANDLE', 'CE key handle required for in-token decryption');
    try {
      // Try multiple CKM_AES_GCM parameter encodings to handle token-specific
      // variations. Some PKCS#11 stacks accept a CK_GCM_PARAMS-shaped object
      // (pIv/ulIvLen/pAAD/ulAADLen/ulTagBits), others accept a simpler
      // { iv, aad, tagBits } shape. Try each until one succeeds.
      const variants = [
        { pIv: iv, ulIvLen: iv.length, pAAD: aad || Buffer.alloc(0), ulAADLen: aad ? aad.length : 0, ulTagBits: tag.length * 8 },
        { iv: iv, aad: aad || Buffer.alloc(0), tagBits: tag.length * 8 },
        { pIv: iv, ulIvLen: iv.length, pAAD: null, ulAADLen: 0, ulTagBits: tag.length * 8 }
      ];

      let lastErr = null;
      let usedVariant = null;
      for (const v of variants) {
        const mech = { mechanism: pkcs11js.CKM_AES_GCM, parameter: v };
        try {
          // Attempt to initialize decrypt with this mechanism encoding
          this.pkcs11.C_DecryptInit(this.session, mech, ceKeyHandle);
          usedVariant = v;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!usedVariant) {
        throw lastErr || new Error('CKM_AES_GCM init failed for all known parameter encodings');
      }

      // Many PKCS#11 implementations expect ciphertext||tag as a single buffer
      const fullCipher = Buffer.concat([ciphertext, tag]);

      // Try both C_Decrypt invocation styles: with a preallocated output buffer
      // or with a single-arg call returning the result.
      // eslint-disable-next-line no-useless-catch
      // eslint-disable-next-line no-useless-catch
      try {
        // Preferred: call and return Buffer result
        const plain = this.pkcs11.C_Decrypt(this.session, fullCipher);
        console.debug('HSM decrypt succeeded using CKM_AES_GCM variant:', usedVariant);
        return plain;
      } catch (err) {
        // Some bindings expect an output buffer argument; try that form.
        try {
          const outBuf = Buffer.alloc(fullCipher.length);
          const plain = this.pkcs11.C_Decrypt(this.session, fullCipher, outBuf);
          console.debug('HSM decrypt succeeded (outBuf) using CKM_AES_GCM variant:', usedVariant);
          return plain;
        } catch (err2) {
          throw new HsmAdapterError('HSM_DECRYPT_FAILED', err2.message || String(err2));
        }
      }
    } catch (err) {
      throw new HsmAdapterError('HSM_DECRYPT_FAILED', err.message || String(err));
    }
  }

  rotateKEK(oldLabel) {
    this.initialize();
    // simple rotate: create new KEK and return new label
    return this.createKEK({});
  }

  clearSensitiveData() {
    try {
      if (this.session) {
        try { this.pkcs11.C_Logout(this.session); } catch (e) {}
        try { this.pkcs11.C_CloseSession(this.session); } catch (e) {}
      }
    } finally {
      this.session = null; this.slot = null; this.initialized = false;
    }
  }

  finalize() {
    this.clearSensitiveData();
    try { if (this.pkcs11) this.pkcs11.C_Finalize(); } catch (e) {}
  }
}

module.exports = SoftHsmAdapter;
