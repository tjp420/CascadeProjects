import {
  unique,
  compact,
  flatten,
  range,
  sortBy,
  keyBy,
  chunk,
  times,
  randomChoice,
  intersection,
  difference,
  groupBy,
  partition,
  sample,
  shuffle,
  zip,
  head,
  tail,
  flattenDeep,
  take,
  drop,
  last,
  initial,
  findIndex,
} from '../array';

describe('array utilities', () => {
  describe('unique', () => {
    test('deduplicates primitives', () => {
      expect(unique([1, 2, 2, 3])).toEqual([1, 2, 3]);
    });
    test('deduplicates by key function', () => {
      expect(unique([{ id: 1 }, { id: 1 }, { id: 2 }], (x) => x.id)).toEqual([{ id: 1 }, { id: 2 }]);
    });
    test('handles non-array', () => {
      expect(unique(null as any)).toEqual([]);
    });
  });

  describe('compact', () => {
    test('removes null/undefined', () => {
      expect(compact([0, 1, false, 2, '', 3, null, undefined])).toEqual([0, 1, false, 2, '', 3]);
    });
  });

  describe('flatten', () => {
    test('flattens nested arrays', () => {
      expect(flatten([1, [2, [3, [4]]]])).toEqual([1, 2, 3, 4]);
    });
  });

  describe('flattenDeep', () => {
    test('alias for flatten', () => {
      expect(flattenDeep([1, [2, [3]]])).toEqual([1, 2, 3]);
    });
  });

  describe('range', () => {
    test('0 to n', () => {
      expect(range(3)).toEqual([0, 1, 2]);
    });
    test('start to end', () => {
      expect(range(1, 4)).toEqual([1, 2, 3]);
    });
    test('negative step', () => {
      expect(range(0, -3, -1)).toEqual([0, -1, -2]);
    });
  });

  describe('sortBy', () => {
    test('ascending sort', () => {
      expect(sortBy([3, 1, 2], (x) => x)).toEqual([1, 2, 3]);
    });
    test('descending sort', () => {
      expect(sortBy([3, 1, 2], (x) => x, 'desc')).toEqual([3, 2, 1]);
    });
  });

  describe('keyBy', () => {
    test('creates lookup object', () => {
      expect(keyBy([{ id: 'a' }, { id: 'b' }], (x) => x.id)).toEqual({ a: { id: 'a' }, b: { id: 'b' } });
    });
  });

  describe('chunk', () => {
    test('splits into chunks', () => {
      expect(chunk([1, 2, 3, 4], 2)).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
    test('handles non-array', () => {
      expect(chunk(null as any, 2)).toEqual([]);
    });
  });

  describe('times', () => {
    test('calls function N times', () => {
      expect(times(3, (i) => i)).toEqual([0, 1, 2]);
    });
  });

  describe('randomChoice', () => {
    test('returns an element', () => {
      expect(randomChoice([1])).toBe(1);
    });
    test('undefined for empty', () => {
      expect(randomChoice([])).toBeUndefined();
    });
  });

  describe('intersection', () => {
    test('returns common elements', () => {
      expect(intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
    });
  });

  describe('difference', () => {
    test('returns elements in a not in b', () => {
      expect(difference([1, 2, 3], [2, 3])).toEqual([1]);
    });
  });

  describe('groupBy', () => {
    test('groups by key', () => {
      const map = groupBy([1, 2, 3, 4], (x) => (x % 2 === 0 ? 'even' : 'odd'));
      expect(map.get('even')).toEqual([2, 4]);
      expect(map.get('odd')).toEqual([1, 3]);
    });
  });

  describe('partition', () => {
    test('splits by predicate', () => {
      expect(partition([1, 2, 3, 4], (x) => x % 2 === 0)).toEqual([
        [2, 4],
        [1, 3],
      ]);
    });
  });

  describe('sample', () => {
    test('returns element', () => {
      expect(sample([42])).toBe(42);
    });
    test('undefined for empty', () => {
      expect(sample([])).toBeUndefined();
    });
  });

  describe('shuffle', () => {
    test('returns same length', () => {
      expect(shuffle([1, 2, 3]).length).toBe(3);
    });
    test('contains same elements', () => {
      expect(shuffle([1, 2, 3]).sort()).toEqual([1, 2, 3]);
    });
  });

  describe('zip', () => {
    test('zips arrays', () => {
      expect(zip<any>([1, 2], ['a', 'b'])).toEqual([
        [1, 'a'],
        [2, 'b'],
      ]);
    });
  });

  describe('head', () => {
    test('returns first N', () => {
      expect(head([1, 2, 3], 2)).toEqual([1, 2]);
    });
  });

  describe('tail', () => {
    test('returns last N', () => {
      expect(tail([1, 2, 3], 2)).toEqual([2, 3]);
    });
  });

  describe('take', () => {
    test('returns first N', () => {
      expect(take([1, 2, 3], 2)).toEqual([1, 2]);
    });
  });

  describe('drop', () => {
    test('drops first N', () => {
      expect(drop([1, 2, 3], 2)).toEqual([3]);
    });
  });

  describe('last', () => {
    test('returns last element', () => {
      expect(last([1, 2, 3])).toBe(3);
    });
    test('undefined for empty', () => {
      expect(last([])).toBeUndefined();
    });
  });

  describe('initial', () => {
    test('returns all but last', () => {
      expect(initial([1, 2, 3])).toEqual([1, 2]);
    });
  });

  describe('findIndex', () => {
    test('finds index', () => {
      expect(findIndex([1, 2, 3], (x) => x === 2)).toBe(1);
    });
    test('returns -1 when not found', () => {
      expect(findIndex([1, 2, 3], (x) => x === 5)).toBe(-1);
    });
  });
});
