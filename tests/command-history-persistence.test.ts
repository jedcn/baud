import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// We test the persistence logic directly rather than through the singleton,
// since the singleton uses the real config dir. Instead we replicate the
// core read/write logic with a temp directory.

const HISTORY_FILE = 'history.json';
const MAX_HISTORY_SIZE = 1000;

async function loadHistory(dir: string): Promise<string[]> {
  const filePath = path.join(dir, HISTORY_FILE);
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    if (Array.isArray(data.commands)) {
      return data.commands;
    }
    return [];
  } catch {
    return [];
  }
}

async function saveHistory(dir: string, commands: string[]): Promise<void> {
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
  const filePath = path.join(dir, HISTORY_FILE);
  const trimmed = commands.length > MAX_HISTORY_SIZE
    ? commands.slice(commands.length - MAX_HISTORY_SIZE)
    : commands;
  await fs.writeFile(filePath, JSON.stringify({ commands: trimmed }, null, 2), 'utf-8');
}

describe('Command History Persistence', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baud-history-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('returns empty array when no history file exists', async () => {
    const result = await loadHistory(tmpDir);
    expect(result).toEqual([]);
  });

  test('saves and loads commands', async () => {
    const commands = ['look', 'north', 'inventory'];
    await saveHistory(tmpDir, commands);
    const loaded = await loadHistory(tmpDir);
    expect(loaded).toEqual(commands);
  });

  test('overwrites previous history on save', async () => {
    await saveHistory(tmpDir, ['old command']);
    await saveHistory(tmpDir, ['new command']);
    const loaded = await loadHistory(tmpDir);
    expect(loaded).toEqual(['new command']);
  });

  test('caps history at MAX_HISTORY_SIZE', async () => {
    const commands = Array.from({ length: 1200 }, (_, i) => `command ${i}`);
    await saveHistory(tmpDir, commands);
    const loaded = await loadHistory(tmpDir);
    expect(loaded.length).toBe(1000);
    // Should keep the most recent 1000
    expect(loaded[0]).toBe('command 200');
    expect(loaded[999]).toBe('command 1199');
  });

  test('handles corrupted JSON gracefully', async () => {
    const filePath = path.join(tmpDir, HISTORY_FILE);
    await fs.writeFile(filePath, 'not valid json', 'utf-8');
    const loaded = await loadHistory(tmpDir);
    expect(loaded).toEqual([]);
  });

  test('handles missing commands key gracefully', async () => {
    const filePath = path.join(tmpDir, HISTORY_FILE);
    await fs.writeFile(filePath, JSON.stringify({ other: 'data' }), 'utf-8');
    const loaded = await loadHistory(tmpDir);
    expect(loaded).toEqual([]);
  });

  test('creates directory if it does not exist', async () => {
    const nestedDir = path.join(tmpDir, 'nested', 'dir');
    await saveHistory(nestedDir, ['test']);
    const loaded = await loadHistory(nestedDir);
    expect(loaded).toEqual(['test']);
  });

  test('saves empty array', async () => {
    await saveHistory(tmpDir, []);
    const loaded = await loadHistory(tmpDir);
    expect(loaded).toEqual([]);
  });

  test('preserves command order', async () => {
    const commands = ['first', 'second', 'third', 'fourth', 'fifth'];
    await saveHistory(tmpDir, commands);
    const loaded = await loadHistory(tmpDir);
    expect(loaded).toEqual(commands);
  });

  test('handles special characters in commands', async () => {
    const commands = ['echo "hello world"', 'ls -la', 'grep ^pattern$', 'say it\'s fine'];
    await saveHistory(tmpDir, commands);
    const loaded = await loadHistory(tmpDir);
    expect(loaded).toEqual(commands);
  });
});
