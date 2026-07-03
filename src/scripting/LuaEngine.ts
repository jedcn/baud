import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { LuaFactory, type LuaEngine as WasmoonEngine } from 'wasmoon';

export type LuaCallback = (...args: any[]) => void | Promise<void>;

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

    // Override dofile to read from real filesystem
    const engine = this.engine;
    this.engine.global.set('dofile', (filepath: string) => {
      const code = fs.readFileSync(filepath, 'utf-8');
      return engine.doStringSync(code);
    });
    this.engine.global.set('createTrigger', this.api.createTrigger);
    this.engine.global.set('createOutboundTrigger', this.api.createOutboundTrigger);
    this.engine.global.set('createAlias', this.api.createAlias);
    this.engine.global.set('createTimer', this.api.createTimer);
    this.engine.global.set('getTimers', this.api.getTimers);
    this.engine.global.set('getAliases', this.api.getAliases);
    this.engine.global.set('getTriggers', this.api.getTriggers);
    this.engine.global.set('getOutboundTriggers', this.api.getOutboundTriggers);
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
      return {
        execute: (sql: string, ...params: unknown[]) => db.prepare(sql).run(...params).changes,
        query: (sql: string, ...params: unknown[]) => db.prepare(sql).all(...params),
        queryOne: (sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) ?? null,
        path: dbPath,
      };
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
