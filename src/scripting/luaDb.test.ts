import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { createDbApi } from './LuaEngine.js';

// wasmoon turns JS `null` into a truthy Lua userdata, so the db API must hand
// back `undefined` (which becomes Lua `nil`) for every SQL NULL — otherwise
// `if row then` / `while queryOne(...)` misread "no result" as a hit and, in the
// while case, loop forever. These tests pin that boundary behavior.
function freshDb() {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE t (id INTEGER, note TEXT)');
  db.exec("INSERT INTO t (id, note) VALUES (1, 'hi')");
  db.exec('INSERT INTO t (id, note) VALUES (2, NULL)');
  return db;
}

describe('createDbApi', () => {
  it('queryOne returns undefined (Lua nil) when no row matches', () => {
    const api = createDbApi(freshDb());
    expect(api.queryOne('SELECT id FROM t WHERE id = ?', 99)).toBeUndefined();
  });

  it('queryOne maps a NULL column value to undefined, not null', () => {
    const api = createDbApi(freshDb());
    const row = api.queryOne('SELECT id, note FROM t WHERE id = ?', 2) as Record<string, unknown>;
    expect(row.id).toBe(2);
    expect(row.note).toBeUndefined();
  });

  it('queryOne returns real column values unchanged', () => {
    const api = createDbApi(freshDb());
    expect(api.queryOne('SELECT id, note FROM t WHERE id = ?', 1)).toEqual({ id: 1, note: 'hi' });
  });

  it('query maps NULL column values to undefined across all rows', () => {
    const api = createDbApi(freshDb());
    const rows = api.query('SELECT id, note FROM t ORDER BY id') as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ id: 2, note: undefined });
  });

  it('query returns an empty array when nothing matches', () => {
    const api = createDbApi(freshDb());
    expect(api.query('SELECT id FROM t WHERE id = ?', 99)).toEqual([]);
  });

  it('execute returns the number of changed rows', () => {
    const api = createDbApi(freshDb());
    expect(api.execute('UPDATE t SET note = ? WHERE id = ?', 'yo', 1)).toBe(1);
  });

  it('exposes the db path', () => {
    const api = createDbApi(freshDb(), '/tmp/x.db');
    expect(api.path).toBe('/tmp/x.db');
  });
});
