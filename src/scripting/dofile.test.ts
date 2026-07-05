import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type LuaAPI, LuaEngine } from './LuaEngine.js';

// A no-op stand-in for the host API; dofile doesn't touch any of it.
function stubApi(): LuaAPI {
  const noop = () => {};
  return new Proxy({} as LuaAPI, { get: () => noop });
}

function writeModule(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'baud-dofile-'));
  const p = join(dir, 'mod.lua');
  writeFileSync(p, body);
  return p;
}

describe('dofile', () => {
  it('returns a native Lua module, so a method returning nil stays falsy', async () => {
    // Running the chunk through doStringSync used to marshal the module table
    // through JS, turning it into a proxy whose `nil` method-returns came back
    // as a *truthy* js_null userdata. This pins that `nil` stays `nil`.
    const engine = new LuaEngine(stubApi());
    await engine.initialize();
    const modPath = writeModule('local M = {}\nfunction M.nothing() return nil end\nreturn M\n');

    const res = await engine.execute(`
      local M = dofile(${JSON.stringify(modPath)})
      if M.nothing() then return "truthy" else return "falsy" end
    `);

    expect(res.success).toBe(true);
    expect(res.result).toBe('falsy');
  });

  it('module methods still return real values across calls', async () => {
    const engine = new LuaEngine(stubApi());
    await engine.initialize();
    const modPath = writeModule('local M = {}\nfunction M.add(a, b) return a + b end\nreturn M\n');

    const res = await engine.execute(`
      local M = dofile(${JSON.stringify(modPath)})
      return M.add(2, 3)
    `);

    expect(res.success).toBe(true);
    expect(res.result).toBe(5);
  });
});
