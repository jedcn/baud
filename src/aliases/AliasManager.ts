import { Alias, AliasCallback, AliasOptions } from './Alias.js';
import type { LuaEngine } from '../scripting/LuaEngine.js';

export class AliasManager {
  private aliases: Alias[] = [];
  private luaEngine?: LuaEngine;

  /**
   * Set the Lua engine (for converting arrays to Lua tables)
   */
  setLuaEngine(engine: LuaEngine): void {
    this.luaEngine = engine;
  }

  /**
   * Create a new alias
   * @param pattern - Pattern to match (literal string or regex)
   * @param callback - Function to execute when matched
   * @param options - Optional configuration
   * @returns The created alias's ID
   */
  createAlias(
    pattern: string,
    callback: AliasCallback,
    options?: AliasOptions
  ): string {
    const alias = new Alias(pattern, callback, options);
    this.aliases.push(alias);
    return alias.id;
  }

  /**
   * Remove an alias by ID
   * @param id - Alias ID to remove
   * @returns True if alias was found and removed
   */
  removeAlias(id: string): boolean {
    const index = this.aliases.findIndex((a) => a.id === id);
    if (index >= 0) {
      this.aliases.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Enable an alias
   * @param id - Alias ID to enable
   */
  enableAlias(id: string): void {
    const alias = this.aliases.find((a) => a.id === id);
    if (alias) {
      alias.enabled = true;
    }
  }

  /**
   * Disable an alias
   * @param id - Alias ID to disable
   */
  disableAlias(id: string): void {
    const alias = this.aliases.find((a) => a.id === id);
    if (alias) {
      alias.enabled = false;
    }
  }

  /**
   * Process user input through all aliases
   * @param text - User input to process
   * @returns True if an alias matched and was executed (input should be consumed)
   */
  async processInput(text: string): Promise<boolean> {
    for (const alias of this.aliases) {
      const result = alias.match(text);
      if (result.matched) {
        // Convert captures to Lua table if we have a Lua engine
        let captures = result.captures;
        if (captures && this.luaEngine) {
          captures = this.luaEngine.arrayToLuaTable(captures) as any;
        }

        // Execute the alias callback
        await alias.execute(captures);
        return true; // Input was consumed by alias
      }
    }

    return false; // No alias matched, send to server
  }

  /**
   * Get all aliases
   */
  getAliases(): Alias[] {
    return [...this.aliases];
  }

  /**
   * Clear all aliases
   */
  clearAliases(): void {
    this.aliases = [];
  }
}
