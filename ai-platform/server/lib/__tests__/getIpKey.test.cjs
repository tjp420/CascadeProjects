const assert = require("assert");
const { getIpKey } = require("../getIpKey.cjs");

function mockReq(headers, remote) {
  return { headers: headers || {}, socket: { remoteAddress: remote } };
}

describe("getIpKey", () => {
  it("hashes ::1 correctly", () => {
    const key = getIpKey(mockReq({}, "::1"));
    assert.strictEqual(key, "eff8e7ca506627fe");
  });

  it("maps IPv4-mapped ipv6 to dotted quad", () => {
    const key = getIpKey(mockReq({}, "::ffff:192.0.2.1"));
    assert.strictEqual(key, "37fcff24bf62035b");
  });

  it("handles ipv6 with port", () => {
    const key = getIpKey(mockReq({}, "[2001:db8::1]:8080"));
    assert.strictEqual(key, "5afd19e856d1c18d");
  });

  it("parses X-Forwarded-For and chooses edge client", () => {
    const headers = { "x-forwarded-for": "198.51.100.42, 203.0.113.5" };
    const key = getIpKey(mockReq(headers, "10.0.0.1"));
    // 203.0.113.5 => 440a628a0c975ea3
    assert.strictEqual(key, "440a628a0c975ea3");
  });

  it("falls back to socket when XFF missing", () => {
    const key = getIpKey(mockReq({}, "192.0.2.1"));
    assert.strictEqual(key, "37fcff24bf62035b");
  });
});
