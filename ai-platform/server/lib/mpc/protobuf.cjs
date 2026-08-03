try {
  module.exports = require('./message_pb.cjs');
} catch (err) {
  const protobuf = require('protobufjs');
  const path = require('path');
  const protoPath = path.join(__dirname, 'message.proto');
  const root = protobuf.loadSync(protoPath);
  const MpcEnvelope = root.lookupType('simplebeacon.mpc.MpcEnvelope');

  function encodeEnvelope(obj) {
    const err = MpcEnvelope.verify(obj);
    if (err) throw new Error(`Invalid MpcEnvelope: ${err}`);
    const message = MpcEnvelope.create(obj);
    return MpcEnvelope.encode(message).finish();
  }

  function decodeEnvelope(buffer) {
    return MpcEnvelope.decode(buffer);
  }

  module.exports = { encodeEnvelope, decodeEnvelope, MpcEnvelope };
}
