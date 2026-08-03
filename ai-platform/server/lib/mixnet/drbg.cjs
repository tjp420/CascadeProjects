const crypto = require('crypto');

function createDRBG(seed) {
  if (!seed) seed = 'mixnet-seed';
  let counter = 0;

  function hmac(data) {
    const m = crypto.createHmac('sha256', Buffer.from(seed));
    m.update(data);
    return m.digest();
  }

  return {
    randomBytes(n) {
      const out = Buffer.allocUnsafe(n);
      let produced = 0;
      while (produced < n) {
        const block = hmac(Buffer.from(String(counter++)));
        const take = Math.min(block.length, n - produced);
        block.copy(out, produced, 0, take);
        produced += take;
      }
      return out;
    },
    // return int in [0, upper)
    randomInt(upper) {
      if (upper <= 0) return 0;
      const bytes = this.randomBytes(4);
      const v = bytes.readUInt32BE(0);
      return v % upper;
    },
    // Fisher-Yates using this PRG
    shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = this.randomInt(i + 1);
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
      }
      return array;
    }
  };
}

module.exports = { createDRBG };
