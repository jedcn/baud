import { test, expect, describe, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { unlinkSync, existsSync } from 'fs';

const testDbPath = '/tmp/baud-test-sqlite-api.db';

function cleanup() {
  for (const suffix of ['', '-wal', '-shm']) {
    const p = testDbPath + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
}

function openDb() {
  const db = new Database(testDbPath);
  db.exec('PRAGMA journal_mode = WAL');
  return {
    execute:  (sql: string, ...params: unknown[]) => db.prepare(sql).run(...params).changes,
    query:    (sql: string, ...params: unknown[]) => db.prepare(sql).all(...params),
    queryOne: (sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) ?? null,
    path: testDbPath,
    close: () => db.close(),
  };
}

describe('sqlite-api (dbOpen behavior)', () => {
  afterEach(cleanup);

  test('execute creates a table and returns 0 changes', () => {
    const db = openDb();
    const changes = db.execute('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, val TEXT)');
    db.close();
    expect(changes).toBe(0);
  });

  test('execute INSERT returns 1 change', () => {
    const db = openDb();
    db.execute('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, val TEXT)');
    const changes = db.execute('INSERT INTO items (val) VALUES (?)', 'hello');
    db.close();
    expect(changes).toBe(1);
  });

  test('query returns all matching rows', () => {
    const db = openDb();
    db.execute('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, val TEXT)');
    db.execute('INSERT INTO items (val) VALUES (?)', 'a');
    db.execute('INSERT INTO items (val) VALUES (?)', 'b');
    const rows = db.query('SELECT * FROM items') as { id: number; val: string }[];
    db.close();
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.val)).toEqual(['a', 'b']);
  });

  test('queryOne returns the first matching row', () => {
    const db = openDb();
    db.execute('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, val TEXT)');
    db.execute('INSERT INTO items (val) VALUES (?)', 'hello');
    const row = db.queryOne('SELECT * FROM items WHERE val = ?', 'hello') as { id: number; val: string };
    db.close();
    expect(row).not.toBeNull();
    expect(row.val).toBe('hello');
  });

  test('queryOne returns null when no match', () => {
    const db = openDb();
    db.execute('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, val TEXT)');
    const row = db.queryOne('SELECT * FROM items WHERE val = ?', 'missing');
    db.close();
    expect(row).toBeNull();
  });

  test('path property reflects the resolved db path', () => {
    const db = openDb();
    const p = db.path;
    db.close();
    expect(p).toBe(testDbPath);
  });
});
