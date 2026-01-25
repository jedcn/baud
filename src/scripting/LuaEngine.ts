import { LuaFactory, LuaEngine as WasmoonEngine } from 'wasmoon';
import fs from 'node:fs';
import path from 'node:path';

export type LuaCallback = (...args: any[]) => void | Promise<void>;

export interface TimerInfo {
  id: string;
  interval: number;
  repeating: boolean;
  enabled: boolean;
  running: boolean;
  name?: string;
}

export interface LuaAPI {
  send: (text: string) => void;
  echo: (text: string) => void;
  createTrigger: (pattern: string, callback: LuaCallback, options?: any) => string;
  createAlias: (pattern: string, callback: LuaCallback, options?: any) => string;
  createTimer: (interval: number, callback: LuaCallback, options?: any) => string;
  getTimers: () => TimerInfo[];
  removeTimer: (id: string) => boolean;
  enableTimer: (id: string) => void;
  disableTimer: (id: string) => void;
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
    this.engine = await this.factory.createEngine();

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
    this.engine.global.set('createAlias', this.api.createAlias);
    this.engine.global.set('createTimer', this.api.createTimer);
    this.engine.global.set('getTimers', this.api.getTimers);
    this.engine.global.set('removeTimer', this.api.removeTimer);
    this.engine.global.set('enableTimer', this.api.enableTimer);
    this.engine.global.set('disableTimer', this.api.disableTimer);
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
        const scriptDir = path.dirname(filename) + '/';
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
