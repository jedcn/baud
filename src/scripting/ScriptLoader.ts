import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { LuaEngine } from './LuaEngine.js';

export class ScriptLoader {
  private luaEngine: LuaEngine;

  constructor(luaEngine: LuaEngine) {
    this.luaEngine = luaEngine;
  }

  /**
   * Load and execute a Lua script file
   * @param scriptPath - Path to the .lua file
   * @returns Success status and optional error message
   */
  async loadScript(scriptPath: string): Promise<{ success: boolean; error?: string }> {
    // Check if file exists
    if (!existsSync(scriptPath)) {
      return {
        success: false,
        error: `Script file not found: ${scriptPath}`,
      };
    }

    // Check if it's a .lua file
    if (path.extname(scriptPath) !== '.lua') {
      return {
        success: false,
        error: `File must have .lua extension: ${scriptPath}`,
      };
    }

    try {
      // Read the file
      const code = await fs.readFile(scriptPath, 'utf-8');

      // Execute the script
      const result = await this.luaEngine.loadFile(code, scriptPath);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to load ${scriptPath}: ${errorMessage}`,
      };
    }
  }

  /**
   * Load multiple script files in order
   * @param scriptPaths - Array of paths to .lua files
   * @returns Array of results for each script
   */
  async loadScripts(
    scriptPaths: string[],
  ): Promise<Array<{ path: string; success: boolean; error?: string }>> {
    const results = [];

    for (const scriptPath of scriptPaths) {
      const result = await this.loadScript(scriptPath);
      results.push({
        path: scriptPath,
        ...result,
      });
    }

    return results;
  }
}
