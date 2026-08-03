// Static pbjs-style wrapper for MpcEnvelope (precompiled)
const $protobuf = require('protobufjs/minimal');
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;
const root = $protobuf.roots['default'] || ($protobuf.roots['default'] = {});

root.simplebeacon = root.simplebeacon || {};
root.simplebeacon.mpc = (function() {
  const mpc = {};
  mpc.MpcEnvelope = (function() {
    function MpcEnvelope(p) { if (p) for (const k of Object.keys(p)) this[k]=p[k]; }
    MpcEnvelope.prototype.session_id = "";
    MpcEnvelope.prototype.round_number = 0;
    MpcEnvelope.prototype.step_index = 0;
    MpcEnvelope.prototype.sequence_counter = 0;
    MpcEnvelope.prototype.timestamp_ms = 0;
    MpcEnvelope.prototype.sender_id = "";
    MpcEnvelope.prototype.payload_digest = $util.newBuffer([]);
    MpcEnvelope.prototype.cleartext_payload = $util.newBuffer([]);
    MpcEnvelope.prototype.detached_signature = $util.newBuffer([]);

    MpcEnvelope.create = function create(props){ return new MpcEnvelope(props); };

    MpcEnvelope.encode = function encode(m, w){
      if(!w) w = $Writer.create();
      if(m.session_id!=null) w.uint32(10).string(m.session_id);
      if(m.round_number!=null) w.uint32(16).uint32(m.round_number);
      if(m.step_index!=null) w.uint32(24).uint32(m.step_index);
      if(m.sequence_counter!=null) w.uint32(32).uint32(m.sequence_counter);
      if(m.timestamp_ms!=null) w.uint32(40).uint64(m.timestamp_ms);
      if(m.sender_id!=null) w.uint32(50).string(m.sender_id);
      if(m.payload_digest!=null) w.uint32(58).bytes(m.payload_digest);
      if(m.cleartext_payload!=null) w.uint32(66).bytes(m.cleartext_payload);
      if(m.detached_signature!=null) w.uint32(74).bytes(m.detached_signature);
      return w;
    };

    MpcEnvelope.decode = function decode(r, l){
      if(!(r instanceof $Reader)) r = $Reader.create(r);
      const end = l===undefined ? r.len : r.pos + l;
      const msg = new MpcEnvelope();
      while(r.pos < end){
        const tag = r.uint32();
        switch(tag>>>3){
          case 1: msg.session_id = r.string(); break;
          case 2: msg.round_number = r.uint32(); break;
          case 3: msg.step_index = r.uint32(); break;
          case 4: msg.sequence_counter = r.uint32(); break;
          case 5: msg.timestamp_ms = r.uint64().toNumber(); break;
          case 6: msg.sender_id = r.string(); break;
          case 7: msg.payload_digest = r.bytes(); break;
          case 8: msg.cleartext_payload = r.bytes(); break;
          case 9: msg.detached_signature = r.bytes(); break;
          default: r.skipType(tag & 7); break;
        }
      }
      return msg;
    };

    return MpcEnvelope;
  })();
  return mpc;
})();

const MpcEnvelope = root.simplebeacon.mpc.MpcEnvelope;
function encodeEnvelope(obj){ const m = MpcEnvelope.create(obj); return MpcEnvelope.encode(m).finish(); }
function decodeEnvelope(buf){ return MpcEnvelope.decode(buf); }
module.exports = { encodeEnvelope, decodeEnvelope, MpcEnvelope };
