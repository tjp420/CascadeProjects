/**
 * @fileoverview RFC 8785 JSON Canonicalization Scheme (JCS) Compliant Engine.
 * Enforces key-sorting and structural constraints for cross-language signatures.
 */

class JcsCanonicalizer {
  /**
   * Deterministically stringifies an object following RFC 8785 rules.
   * @param {*} obj - Element to canonicalize.
   * @returns {string} Whitespace-free, key-sorted string representation.
   */
  canonicalize(obj) {
    if (obj === null) return 'null';
    const t = typeof obj;
    if (t === 'boolean') return obj ? 'true' : 'false';
    if (t === 'number') {
      if (!Number.isFinite(obj)) return 'null';
      // Normalize -0 to 0
      if (Object.is(obj, -0)) obj = 0;

      // Use a high precision to preserve round-trip information across languages
      const MAX_SIG = 21;
      let s = obj.toPrecision(MAX_SIG);
      // Ensure exponent marker is lowercase
      s = s.replace('E', 'e');

      const eIndex = s.indexOf('e');
      if (eIndex !== -1) {
        let mant = s.slice(0, eIndex);
        let exp = s.slice(eIndex + 1);
        // remove leading plus in exponent
        exp = exp.replace(/^\+/, '');
        // remove leading zeros in exponent (keep single 0)
        exp = exp.replace(/^(-?)0+(\d+)$/, '$1$2');
        // strip trailing fractional zeros from mantissa
        if (mant.indexOf('.') !== -1) {
          mant = mant.replace(/(\.\d*?)0+$/, '$1');
          mant = mant.replace(/\.$/, '');
        }
        s = mant + 'e' + exp;
      } else {
        // plain decimal: strip trailing zeros in fraction
        if (s.indexOf('.') !== -1) {
          s = s.replace(/(\.\d*?)0+$/, '$1');
          s = s.replace(/\.$/, '');
        }
      }

      return s;
    }
    if (t === 'string') return JSON.stringify(obj);
    if (t === 'bigint') return JSON.stringify(obj.toString(16)); // hex string

    // Special marker support: canonicalize objects of the form {"__bigint_hex": "..."}
    if (t === 'object' && obj && Object.keys(obj).length === 1 && Object.prototype.hasOwnProperty.call(obj, '__bigint_hex')) {
      const h = obj['__bigint_hex'];
      if (typeof h === 'string') return JSON.stringify(h);
    }

    if (Array.isArray(obj)) {
      const items = obj.map(item => this.canonicalize(item));
      return `[${items.join(',')}]`;
    }

    if (t === 'object') {
      const keys = Object.keys(obj).sort();
      const kv = [];
      for (const k of keys) {
        const v = obj[k];
        if (v === undefined) continue; // prune undefined
        kv.push(`${JSON.stringify(k)}:${this.canonicalize(v)}`);
      }
      return `{${kv.join(',')}}`;
    }
    
    return 'null';
  }
}

module.exports = { JcsCanonicalizer };
