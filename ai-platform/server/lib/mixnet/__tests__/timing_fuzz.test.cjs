const { wrapOnionPayload } = require('../client.cjs');
const Mixnet = require('../mixnet.cjs');
const { createDRBG } = require('./../../mixnet/drbg.cjs');
const crypto = require('crypto');

function highResNs() { return Number(process.hrtime.bigint()); }

describe('mixnet timing fuzz', () => {
  jest.setTimeout(300000);

  test('rejection vs accept timing distributions', async () => {
    const ITER = 1000; // sample size per profile
    const nodes = new Mixnet(3, { seed: 'timing-test-seed', epochMs: 1000, jitterMs: 10 });
    // create a route of 3 node names matching Mixnet constructor
    const route = ['node-0', 'node-1', 'node-2'];

    const drbg = createDRBG(Buffer.from('timing-fuzz-seed'));
    const acceptTimes = [];
    const rejectTimes = [];

    for (let i = 0; i < ITER; i++) {
      // create either a valid payload or a malformed random blob
      const isGood = (i % 2 === 0);
      let packet;
      if (isGood) {
        const pt = Buffer.from('hello-mixnet-' + i);
        packet = wrapOnionPayload(pt, route.map((_, idx) => `mixnet-seed-${idx}`), { innerSize: 128, outerSize: 256 });
      } else {
        packet = crypto.randomBytes(256);
      }

      const start = process.hrtime.bigint();
      // submit to first node directly as simulate
      const res = await nodes.submitPacket(packet);
      const end = process.hrtime.bigint();
      const dur = end - start; // BigInt nanoseconds
      if (isGood) acceptTimes.push(dur); else rejectTimes.push(dur);
    }

    // compute basic stats
    // Convert BigInt arrays to sorted order for percentile computation
    function sortedCopy(arr) {
      return arr.slice().sort((a,b)=> (a>b?1:(a<b?-1:0)));
    }

    const sAcceptSorted = sortedCopy(acceptTimes);
    const sRejectSorted = sortedCopy(rejectTimes);

    function percentile(sortedArr, p) {
      if (sortedArr.length === 0) return 0n;
      const idx = Math.floor((sortedArr.length - 1) * p);
      return sortedArr[idx];
    }

    const validP95 = percentile(sAcceptSorted, 0.95);
    const validP99 = percentile(sAcceptSorted, 0.99);
    const badP95 = percentile(sRejectSorted, 0.95);
    const badP99 = percentile(sRejectSorted, 0.99);

    // compute absolute deltas as BigInt
    const deltaP95 = validP95 > badP95 ? validP95 - badP95 : badP95 - validP95;
    const deltaP99 = validP99 > badP99 ? validP99 - badP99 : badP99 - validP99;

    // enforce delta/valid <= 0.05 using integer arithmetic: delta*100 <= valid*5
    const okP95 = (deltaP95 * 100n) <= (validP95 * 5n);
    const okP99 = (deltaP99 * 100n) <= (validP99 * 5n);

    expect(okP95).toBeTruthy();
    expect(okP99).toBeTruthy();
  });
});
