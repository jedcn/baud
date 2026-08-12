import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { LuaFactory, type LuaEngine as WasmoonEngine } from 'wasmoon';

export type LuaCallback = (...args: any[]) => void | Promise<void>;

/**
 * The SQLite handle exposed to Lua scripts by `dbOpen`.
 *
 * wasmoon marshals JS `null` to a *truthy* Lua userdata, not `nil`, so a SQL
 * NULL — a missing row, or a NULL column value — would read as truthy in Lua:
 * `if row then` and `while queryOne(...)` would never see "no result" (the
 * latter loops forever). We convert every null to `undefined`, which wasmoon
 * does push as Lua `nil`, so the db API behaves the way Lua scripts expect.
 */
export function createDbApi(db: Database, dbPath?: string) {
  const toLua = (row: Record<string, unknown> | null | undefined) => {
    if (row == null) return undefined;
    const out: Record<string, unknown> = {};
    for (const key in row) out[key] = row[key] ?? undefined;
    return out;
  };
  return {
    execute: (sql: string, ...params: unknown[]) => db.prepare(sql).run(...params).changes,
    query: (sql: string, ...params: unknown[]) =>
      (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(toLua),
    queryOne: (sql: string, ...params: unknown[]) =>
      toLua(db.prepare(sql).get(...params) as Record<string, unknown> | null),
    path: dbPath,
  };
}

export interface TimerInfo {
  id: string;
  interval: number;
  repeating: boolean;
  enabled: boolean;
  running: boolean;
  name?: string;
}

export interface AliasInfo {
  id: string;
  pattern: string;
  type: 'literal' | 'regex';
  enabled: boolean;
}

export interface TriggerInfo {
  id: string;
  pattern: string;
  type: 'literal' | 'regex';
  enabled: boolean;
}

export interface SoundInfo {
  name: string;
  filepath: string;
}

export interface LuaAPI {
  send: (text: string) => void;
  echo: (text: string) => void;
  cecho: (color: string, text: string) => void;
  cechoBg: (color: string, backgroundColor: string, text: string, bold?: boolean) => void;
  createTrigger: (pattern: string, callback: LuaCallback, options?: any) => string;
  createOutboundTrigger: (pattern: string, callback: LuaCallback, options?: any) => string;
  createAlias: (pattern: string, callback: LuaCallback, options?: any) => string;
  createTimer: (interval: number, callback: LuaCallback, options?: any) => string;
  getTimers: () => TimerInfo[];
  getAliases: () => AliasInfo[];
  getTriggers: () => TriggerInfo[];
  getOutboundTriggers: () => TriggerInfo[];
  removeTrigger: (id: string) => boolean;
  removeTimer: (id: string) => boolean;
  enableTimer: (id: string) => void;
  disableTimer: (id: string) => void;
  setStatus: (segmentsOrFunction: any) => void;
  reloadScript: () => Promise<void>;
  registerSound: (name: string, filepath: string) => void;
  removeSound: (name: string) => boolean;
  playSound: (name: string, options?: any) => void;
  getSounds: () => SoundInfo[];
  say: (text: string, options?: any) => void;
  httpRequest: (url: string, optionsOrCallback?: any, callback?: LuaCallback) => void;
  httpGet: (url: string, callback?: LuaCallback) => void;
  httpPost: (url: string, body: string, callback?: LuaCallback) => void;
}

export class LuaEngine {
  private factory: LuaFactory;
  private engine?: WasmoonEngine;
  private api: LuaAPI;

  constructor(api: LuaAPI) {
    this.factory = new LuaFactory();
    this.api = api;
  }

  /**
   * Initialize the Lua engine and register API functions
   */
  async initialize(): Promise<void> {
    this.engine = await this.factory.createEngine({ injectObjects: true });

    // Register global functions (without namespace)
    this.engine.global.set('send', this.api.send);
    this.engine.global.set('echo', this.api.echo);

    // Wall-clock milliseconds. Lua offers only whole seconds (os.time,
    // os.date), which is too coarse for a script to reason about its own
    // pacing -- measuring the gap between paced moves, say, where the interval
    // under study is itself around a second. os.clock is no substitute: it
    // reports CPU time consumed, not time elapsed.
    this.engine.global.set('nowMs', () => Date.now());

    // Host environment variables. Lua's own os.getenv is useless here: wasmoon
    // runs Lua as WASM, so os.getenv reads emscripten's sandbox environment
    // (PATH comes back as "/") rather than the process baud was launched with.
    // A script that wants to know which character to log in as, or which
    // machine it is running on, has no other way to be told at startup.
    //
    // Two marshalling hazards, hence the shape below. JS null becomes a
    // *truthy* Lua userdata (see createDbApi above), so an unset variable must
    // come back as undefined -- but undefined pushes *zero* return values
    // rather than nil, which makes `tostring(getenv("X"))` fail outright with
    // "value expected" for an unset X. The Lua wrapper's explicit `return v`
    // normalizes that to exactly one value, so getenv reads as nil everywhere.
    this.engine.global.set('__getenv', (name: string) => process.env[name] ?? undefined);
    this.engine.doStringSync(`
      function getenv(name)
        local v = __getenv(name)
        return v
      end
    `);

    // Override dofile to read from the real filesystem. The file's chunk is
    // loaded and run *in Lua* (via load()()), NOT through doStringSync: the
    // latter marshals the module's return value through JS, so a returned table
    // becomes a JS proxy and every `nil` its methods return comes back to Lua as
    // a truthy `js_null` userdata (breaking `if x then` / `while x`). Reading the
    // file is the only part that needs JS.
    this.engine.global.set('__dofileRead', (filepath: string) =>
      fs.readFileSync(filepath, 'utf-8'),
    );
    this.engine.doStringSync(`
      function dofile(path)
        local chunk = assert(load(__dofileRead(path), "@" .. path))
        return chunk()
      end
    `);
    this.engine.global.set('createTrigger', this.api.createTrigger);
    this.engine.global.set('createOutboundTrigger', this.api.createOutboundTrigger);
    this.engine.global.set('createAlias', this.api.createAlias);
    this.engine.global.set('createTimer', this.api.createTimer);
    this.engine.global.set('getTimers', this.api.getTimers);
    this.engine.global.set('getAliases', this.api.getAliases);
    this.engine.global.set('getTriggers', this.api.getTriggers);
    this.engine.global.set('getOutboundTriggers', this.api.getOutboundTriggers);
    this.engine.global.set('removeTrigger', this.api.removeTrigger);
    this.engine.global.set('removeTimer', this.api.removeTimer);
    this.engine.global.set('enableTimer', this.api.enableTimer);
    this.engine.global.set('disableTimer', this.api.disableTimer);
    this.engine.global.set('setStatus', this.api.setStatus);
    this.engine.global.set('cecho', this.api.cecho);
    this.engine.global.set('cechoBg', this.api.cechoBg);
    this.engine.global.set('reloadScript', this.api.reloadScript);
    this.engine.global.set('registerSound', this.api.registerSound);
    this.engine.global.set('removeSound', this.api.removeSound);
    this.engine.global.set('playSound', this.api.playSound);
    this.engine.global.set('getSounds', this.api.getSounds);
    this.engine.global.set('say', this.api.say);
    this.engine.global.set('httpRequest', this.api.httpRequest);
    this.engine.global.set('httpGet', this.api.httpGet);
    this.engine.global.set('httpPost', this.api.httpPost);
    this.engine.global.set('dbOpen', (name: string) => {
      const dbPath = path.join(process.cwd(), name);
      const db = new Database(dbPath);
      db.exec('PRAGMA journal_mode = WAL');
      return createDbApi(db, dbPath);
    });
  }

  /**
   * Execute Lua code
   * @param code - Lua code to execute
   * @returns Result of execution or error message
   */
  async execute(code: string): Promise<{ success: boolean; result?: any; error?: string }> {
    if (!this.engine) {
      return { success: false, error: 'Lua engine not initialized' };
    }

    try {
      const result = await this.engine.doString(code);
      return { success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Load and execute a Lua file
   * @param code - File contents as a string
   * @param filename - Optional filename for error messages
   */
  async loadFile(code: string, filename?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.engine) {
      return { success: false, error: 'Lua engine not initialized' };
    }

    try {
      // Set SCRIPT_DIR global so scripts can load other files relative to themselves
      if (filename) {
        const scriptDir = `${path.dirname(filename)}/`;
        this.engine.global.set('SCRIPT_DIR', scriptDir);
      }

      await this.engine.doString(code);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const prefix = filename ? `Error in ${filename}: ` : 'Error: ';
      return { success: false, error: prefix + errorMessage };
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.engine) {
      this.engine.global.close();
    }
  }
}
