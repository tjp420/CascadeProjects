'use strict';

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn()
  }))
}));

const db = require('../lib/db.cjs');

describe('api-server/lib/db', () => {
  test('exports expected functions', () => {
    expect(typeof db.query).toBe('function');
    expect(typeof db.get).toBe('function');
    expect(typeof db.transaction).toBe('function');
  });

  test('query returns rows and rowCount', async () => {
    const result = await db.query('SELECT 1 as id');
    expect(result.rows).toBeDefined();
    expect(result.rowCount).toBeDefined();
  });

  test('get returns first row', async () => {
    const row = await db.get('SELECT 1 as id');
    expect(row).toBeDefined();
    expect(row.id).toBe(1);
  });

  test('transaction executes callback and returns result', async () => {
    const result = await db.transaction(async (conn) => {
      return await conn.query('SELECT 1 as id');
    });
    expect(result).toBeDefined();
  });
});
