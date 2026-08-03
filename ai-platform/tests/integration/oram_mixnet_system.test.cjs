const interop = require('../../server/lib/oram/interop.cjs');

describe('ORAM-Mixnet interop (scaffold)', () => {
  test('quantizeQueue pads to DEFAULT_BATCH_SIZE', () => {
    const small = ['blk1', 'blk2'];
    const out = interop.quantizeQueue(small, interop.DEFAULT_BATCH_SIZE);
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBe(interop.DEFAULT_BATCH_SIZE);
    // original ids must be preserved at the front
    expect(out[0]).toBe('blk1');
    expect(out[1]).toBe('blk2');
  });

  test('processMixnetBatch returns results array of length DEFAULT_BATCH_SIZE', async () => {
    const packets = [{ id: 'p1', blockId: 'blkA' }, { id: 'p2', blockId: 'blkB' }];
    const res = await interop.processMixnetBatch(packets);
    expect(res).toHaveProperty('ok', true);
    expect(res).toHaveProperty('results');
    expect(Array.isArray(res.results)).toBe(true);
    expect(res.results.length).toBe(interop.DEFAULT_BATCH_SIZE);
    // entries should have id and data
    expect(res.results[0]).toHaveProperty('id');
    expect(res.results[0]).toHaveProperty('data');
  });
});
