// DKG index - epoch scheduler and public API

const protocol = require('./protocol.cjs');
const transport = require('./transport.cjs');
const auditor = require('./auditor.cjs');

let running = false;
let config = {
  epochWindowMs: 60 * 1000,
  defaultTimeoutMs: 15 * 1000,
};

async function start() {
  if (running) return;
  running = true;
  // Hook into existing node lifecycle / scheduler here.
}

async function stop() {
  running = false;
}

function configure(opts = {}) {
  config = Object.assign(config, opts);
  protocol.configure({ defaultTimeoutMs: config.defaultTimeoutMs });
  transport.configure(opts.transport || {});
}

async function runRefreshEpoch(epochId, peers, opts = {}) {
  // Top-level helper to run a single proactive refresh epoch.
  // delegates to protocol; collects transcript via auditor.
  const res = await protocol.startRefreshEpoch(epochId, { peers, ...opts });
  await auditor.recordTranscript(epochId, res.transcript || {});
  return res;
}

module.exports = {
  start,
  stop,
  configure,
  runRefreshEpoch,
};
