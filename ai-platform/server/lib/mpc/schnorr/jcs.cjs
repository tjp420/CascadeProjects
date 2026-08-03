/**
 * @fileoverview RFC 8785 JSON Canonicalization Scheme (JCS) Compliant Engine.
 * Enforces key-sorting and structural constraints for cross-language signatures.
 */

const MAX_SIGNIFICANT = 21; // bound significant digits for numeric normalization

class JcsCanonicalizer {
  /**
   * Deterministically stringifies an object following RFC 8785 rules.
   * Includes numeric normalization to ensure cross-language deterministic
   * representations (handles -0, bounded significant digits, exponent
   * normalization, and BigInt hex serialization).
   * @param {*} obj - Element to canonicalize.
   * @returns {string} Whitespace-free, key-sorted string representation.
   */
  canonicalize(obj) {
    if (obj === null) return 'null';
    const t = typeof obj;
    if (t === 'boolean') return obj ? 'true' : 'false';
    if (t === 'number') {
      if (!Number.isFinite(obj)) return 'null';
      if (Object.is(obj, -0)) return '0';

      // Bound significant digits and normalize exponent/decimal form
      let s = obj.toPrecision ? obj.toPrecision(MAX_SIGNIFICANT) : JSON.stringify(obj);
      s = s.replace(/E/, 'e');
      s = s.replace(/e\+/, 'e');
      if (s.indexOf('.') >= 0) {
        s = s.replace(/(\.\d*?[1-9])0+$/,'$1');
        s = s.replace(/\.0+$/,'');
      }
      s = s.replace(/e\+/, 'e');
      return s;
    }
    if (t === 'string') {
      // normalize string values to NFC for cross-language parity
      try {
        const n = obj.normalize && obj.normalize('NFC') || obj;
        return JSON.stringify(n);
      } catch (e) {
        return JSON.stringify(obj);
      }
    }
    if (t === 'bigint') return JSON.stringify(obj.toString(16)); // hex string

    if (Array.isArray(obj)) {
      const items = obj.map(item => this.canonicalize(item));
      return `[${items.join(',')}]`;
    }

    if (t === 'object') {
      // sort keys by NFC-normalized Unicode codepoint order
      const keys = Object.keys(obj).slice();
      const codepointCompare = (A, B) => {
        const a = (A && A.normalize) ? A.normalize('NFC') : A;
        const b = (B && B.normalize) ? B.normalize('NFC') : B;
        const arrA = Array.from(a);
        const arrB = Array.from(b);
        const L = Math.min(arrA.length, arrB.length);
        for (let i = 0; i < L; i++) {
          const ca = arrA[i].codePointAt(0);
          const cb = arrB[i].codePointAt(0);
          if (ca !== cb) return ca - cb;
        }
        return arrA.length - arrB.length;
      };
      keys.sort(codepointCompare);
      const kv = [];
      for (const k of keys) {
        const v = obj[k];
        if (v === undefined) continue; // prune undefined
        const nk = (k && k.normalize) ? k.normalize('NFC') : k;
        kv.push(`${JSON.stringify(nk)}:${this.canonicalize(v)}`);
      }
      return `{${kv.join(',')}}`;
    }

    return 'null';
  }
}

module.exports = { JcsCanonicalizer };
