import { LuaFactory, LuaEngine as WasmoonEngine } from 'wasmoon';

export type LuaCallback = (...args: any[]) => void | Promise<void>;

export interface LuaAPI {
  send: (text: string) => void;
  echo: (text: string) => void;
  createTrigger: (pattern: string, callback: LuaCallback, options?: any) => string;
  createAlias: (pattern: string, callback: LuaCallback, options?: any) => string;
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
    this.engine.global.set('createTrigger', this.api.createTrigger);
    this.engine.global.set('createAlias', this.api.createAlias);
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
      await this.engine.doString(code);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const prefix = filename ? `Error in ${filename}: ` : 'Error: ';
      return { success: false, error: prefix + errorMessage };
    }
  }

  /**
   * Convert a JavaScript array to a Lua table
   * @param arr - JavaScript array to convert
   * @returns Lua table
   */
  arrayToLuaTable(arr: string[]): any {
    if (!this.engine) {
      return arr;
    }

    try {
      // Create a Lua table
      const table = this.engine.global.newTable();

      // Populate it with array elements (Lua uses 1-based indexing)
      for (let i = 0; i < arr.length; i++) {
        table.set(i + 1, arr[i]);
      }

      return table;
    } catch (error) {
      // Fallback to raw array if conversion fails
      return arr;
    }
  }

  /**
   * Get the engine instance (for advanced usage)
   */
  getEngine(): WasmoonEngine | undefined {
    return this.engine;
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
