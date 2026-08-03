const { JcsCanonicalizer } = require('../mpc/schnorr/jcs.cjs');
const handshake = require('../hybrid-kem-handshake.cjs');

// Fake socket that captures writes
function makeFakeSocket() {
  const writes = [];
  return {
    writes,
    write(buf) { writes.push(Buffer.from(buf)); },
  };
}

test('sendMessage uses JCS canonicalization for stable frame body', () => {
  const sock = makeFakeSocket();
  const objA = { b: 2, a: 1 };
  const objB = { a: 1, b: 2 };

  // call private function via module export isn't available; re-require the file and call the function by name
  const mod = require('../hybrid-kem-handshake.cjs');
  // Ensure JcsCanonicalizer is available in the module under test
  expect(typeof JcsCanonicalizer).toBe('function');

  mod._sendMessage(sock, objA);
  mod._sendMessage(sock, objB);

  // Two frames written; extract bodies (skip 4-byte header)
  const bodyA = sock.writes[0].slice(4).toString('utf8');
  const bodyB = sock.writes[1].slice(4).toString('utf8');

  expect(bodyA).toBe(bodyB);
  // And body should match the JCS canonicalization of the object
  const jcs = new JcsCanonicalizer();
  const expected = jcs.canonicalize(objA);
  expect(bodyA).toBe(expected);
});
