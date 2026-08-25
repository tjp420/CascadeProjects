"use strict";

const { wrapOnionPayload } = require("./client.cjs");
const Mixnet = require("./mixnet.cjs");
const crypto = require("crypto");

async function run() {
  const ITER = 500;
  const nodes = new Mixnet(3, {
    seed: "timing-test-seed",
    epochMs: 1000,
    jitterMs: 10,
  });
  const route = ["node-0", "node-1", "node-2"];
  const acceptTimes = [];
  const rejectTimes = [];

  for (let i = 0; i < ITER; i++) {
    const isGood = i % 2 === 0;
    let packet;
    if (isGood) {
      const pt = Buffer.from("hello-mixnet-" + i);
      packet = wrapOnionPayload(
        pt,
        route.map((_, idx) => `mixnet-seed-${idx}`),
        { innerSize: 128, outerSize: 256 },
      );
    } else {
      packet = crypto.randomBytes(256);
    }
    const start = process.hrtime.bigint();
    await nodes.submitPacket(packet);
    const end = process.hrtime.bigint();
    const dur = Number(end - start);
    if (isGood) acceptTimes.push(dur);
    else rejectTimes.push(dur);

    // (No per-iteration logging in the permanent runner)
  }

  function stats(arr) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const sum = arr.reduce((s, v) => s + v, 0);
    const mean = sum / arr.length;
    const median = sorted[Math.floor(arr.length / 2)];
    const variance =
      arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length;
    return { mean, median, variance };
  }

  const sAccept = stats(acceptTimes);
  const sReject = stats(rejectTimes);
  const meanDiff = Math.abs(sAccept.mean - sReject.mean);
  const medianDiff = Math.abs(sAccept.median - sReject.median);
  const meanTol = Math.max(1, sAccept.mean * 0.3);
  const medianTol = Math.max(1, sAccept.median * 0.3);
  const varRatio = (sAccept.variance + 1) / (sReject.variance + 1);

  console.log("RUNNER TIMING FUZZ STATS");
  console.log("accept", sAccept);
  console.log("reject", sReject);
  console.log("diffs", { meanDiff, medianDiff, meanTol, medianTol, varRatio });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
