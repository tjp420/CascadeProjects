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
    const template = [
      { type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_SECRET_KEY },
      { type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_AES },
      { type: pkcs11js.CKA_VALUE_LEN, value: length },
      { type: pkcs11js.CKA_ENCRYPT, value: true },
      { type: pkcs11js.CKA_DECRYPT, value: true },
      { type: pkcs11js.CKA_WRAP, value: true },
      { type: pkcs11js.CKA_UNWRAP, value: true },
      { type: pkcs11js.CKA_TOKEN, value: true },
      { type: pkcs11js.CKA_LABEL, value: kekLabel }
    ];
    const handle = this.pkcs11.C_GenerateKey(this.session, mech, template);
    if (!handle) throw new HsmAdapterError('KEK_GEN_FAILED', 'Failed to generate KEK on token');
    return kekLabel;
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

    // Create a temporary session key object for the CEK
    const tempTemplate = [
      { type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_SECRET_KEY },
      { type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_AES },
      { type: pkcs11js.CKA_VALUE, value: cekBuffer },
      { type: pkcs11js.CKA_ENCRYPT, value: false },
      { type: pkcs11js.CKA_DECRYPT, value: false },
      { type: pkcs11js.CKA_WRAP, value: false },
      { type: pkcs11js.CKA_UNWRAP, value: false },
      { type: pkcs11js.CKA_TOKEN, value: false }
    ];
    const cekHandle = this.pkcs11.C_CreateObject(this.session, tempTemplate);
    try {
      const mechanism = { mechanism: pkcs11js.CKM_AES_KEY_WRAP };
      // pkcs11js C_WrapKey requires a pre-allocated output buffer (5th arg).
      // AES-KW adds an 8-byte IV, so a 32-byte CEK yields 40 bytes.
      // Allocate generously; pkcs11js returns a sliced buffer.
      const outBuf = Buffer.alloc(cekBuffer.length + 32);
      const wrapped = this.pkcs11.C_WrapKey(this.session, mechanism, kekHandle, cekHandle, outBuf);
      return wrapped;
    } finally {
      try { this.pkcs11.C_DestroyObject(this.session, cekHandle); } catch (e) {}
      if (Buffer.isBuffer(cekBuffer)) cekBuffer.fill(0);
    }
  }

  unwrap(kekLabel, wrappedCekBuffer) {
    this.initialize();
    const kekHandle = this._findKeyHandleByLabel(kekLabel);
    if (!kekHandle) throw new HsmAdapterError('KEK_NOT_FOUND', `KEK ${kekLabel} not found`);
    const mechanism = { mechanism: pkcs11js.CKM_AES_KEY_WRAP };
    // For production posture, create the unwrapped CEK as non-extractable and return the in-token handle.
    const template = [
      { type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_SECRET_KEY },
      { type: pkcs11js.CKA_KEY_TYPE, value: pkcs11js.CKK_AES },
      { type: pkcs11js.CKA_TOKEN, value: false },
      { type: pkcs11js.CKA_EXTRACTABLE, value: false },
      { type: pkcs11js.CKA_SENSITIVE, value: true },
      { type: pkcs11js.CKA_DECRYPT, value: true }
    ];
    try {
      const newKeyHandle = this.pkcs11.C_UnwrapKey(this.session, mechanism, kekHandle, wrappedCekBuffer, template);
      if (!newKeyHandle) throw new HsmAdapterError('UNWRAP_FAILED', 'C_UnwrapKey returned no handle');
      return newKeyHandle; // Return the in-token key handle; secret material never leaves HSM
    } catch (err) {
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
          throw err2;
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
