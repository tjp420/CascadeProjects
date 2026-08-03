const path = require('path');

describe('mixnode native shuffle integration', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('uses nativeShuffle when available and preserves packet refs', () => {
    // mock native module to reverse indices deterministically
    const nativeMock = {
      shuffle: (u32, seed) => {
        // reverse in-place
        for (let i = 0, j = u32.length - 1; i < j; i++, j--) {
          const t = u32[i]; u32[i] = u32[j]; u32[j] = t;
        }
      }
    };

    jest.doMock('../native/index.cjs', () => ({ nativeShuffle: (a, s) => nativeMock.shuffle(a, s), _hasNative: true }));
    const MixNode = require('../mixnode.cjs');

    const node = new MixNode({ id: 'test-node', threshold: 2 });
    const pktA = { id: 'a', payload: Buffer.from('p1') };
    const pktB = { id: 'b', payload: Buffer.from('p2') };
    node.buffer.push(pktA, pktB);
    const out = node.flushSync();
    expect(out.length).toBe(2);
    // since mock reversed, first should be pktB
    expect(out[0].id).toBe('b');
    expect(out[1].id).toBe('a');
    // original objects preserved
    expect(out[0].payload).toBe(pktB.payload);
  });

  test('falls back to JS shuffle when native missing and preserves packet refs', () => {
    jest.doMock('../native/index.cjs', () => ({ nativeShuffle: (a,s) => { /* no-op fallback */ }, _hasNative: false }));
    const MixNode = require('../mixnode.cjs');
    const node = new MixNode({ id: 'test-node-2', threshold: 2 });
    const pktA = { id: 'a', payload: Buffer.from('p1') };
    const pktB = { id: 'b', payload: Buffer.from('p2') };
    node.buffer.push(pktA, pktB);
    const out = node.flushSync();
    expect(out.length).toBe(2);
    // ensure same elements present
    const ids = out.map(x => x.id).sort();
    expect(ids).toEqual(['a','b']);
    expect(out[0].payload === pktA.payload || out[0].payload === pktB.payload).toBeTruthy();
  });
});
