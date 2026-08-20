describe("enforceKeyInterdiction and interdictKey", () => {
  beforeEach(() => jest.resetModules());

  test("interdictKey blocks and enforceKeyInterdiction returns 423", () => {
    const mod = require("../authorize.cjs");
    const key = "k-123";
    const r = mod.interdictKey(key, "test", 10000, "manual");
    expect(r.blocked).toBe(true);

    const mw = mod.enforceKeyInterdiction();
    const req = { headers: { "x-api-key": key } };
    const sent = {};
    const res = {
      status: (s) => {
        sent.status = s;
        return { json: (b) => (sent.body = b) };
      },
    };
    const next = jest.fn();
    mw(req, res, next);
    expect(sent.status).toBe(423);
  });

  test("releaseKey unblocks and middleware calls next", () => {
    const mod = require("../authorize.cjs");
    const key = "k-456";
    mod.interdictKey(key, "test", 10000, "manual");
    const rel = mod.releaseKey(key);
    expect(rel.released).toBe(true);
    const mw = mod.enforceKeyInterdiction();
    const req = { headers: { "x-api-key": key } };
    const res = { status: () => ({ json: () => {} }) };
    const next = jest.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
