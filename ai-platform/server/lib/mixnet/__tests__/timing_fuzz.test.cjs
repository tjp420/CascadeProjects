const { wrapOnionPayload } = require('../client.cjs');
const Mixnet = require('../mixnet.cjs');
const { createDRBG } = require('./../../mixnet/drbg.cjs');
const crypto = require('crypto');

function highResNs() { return Number(process.hrtime.bigint()); }

describe('mixnet timing fuzz', () => {
  jest.setTimeout(120000);

  test('rejection vs accept timing distributions', async () => {
    const ITER = 500; // sample size, adjust as needed
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
      const dur = Number(end - start);
      if (isGood) acceptTimes.push(dur); else rejectTimes.push(dur);
    }

    // compute basic stats
    function stats(arr) {
      const sorted = arr.slice().sort((a,b)=>a-b);
      const sum = arr.reduce((s,v)=>s+v,0);
      const mean = sum/arr.length;
      const median = sorted[Math.floor(arr.length/2)];
      const variance = arr.reduce((s,v)=>s+Math.pow(v-mean,2),0)/arr.length;
      return { mean, median, variance };
    }

    const sAccept = stats(acceptTimes);
    const sReject = stats(rejectTimes);

    // allow some tolerance — mean and median should be close
    const meanDiff = Math.abs(sAccept.mean - sReject.mean);
    const medianDiff = Math.abs(sAccept.median - sReject.median);

    // Fail if mean or median differ by > 30% or variance ratio > 4
    const meanTol = Math.max(1, sAccept.mean * 0.3);
    const medianTol = Math.max(1, sAccept.median * 0.3);
    const varRatio = (sAccept.variance + 1) / (sReject.variance + 1);

    expect(meanDiff).toBeLessThanOrEqual(meanTol);
    expect(medianDiff).toBeLessThanOrEqual(medianTol);
    expect(varRatio).toBeLessThanOrEqual(4);
  });
});
