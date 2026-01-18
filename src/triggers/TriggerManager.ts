import { Trigger, TriggerCallback, TriggerOptions } from './Trigger.js';
import type { LuaEngine } from '../scripting/LuaEngine.js';

export class TriggerManager {
  private triggers: Trigger[] = [];
  private luaEngine?: LuaEngine;

  /**
   * Set the Lua engine (for converting arrays to Lua tables)
   */
  setLuaEngine(engine: LuaEngine): void {
    this.luaEngine = engine;
  }

  /**
   * Create a new trigger
   * @param pattern - Pattern to match (literal string or regex)
   * @param callback - Function to execute when matched
   * @param options - Optional configuration
   * @returns The created trigger's ID
   */
  createTrigger(
    pattern: string,
    callback: TriggerCallback,
    options?: TriggerOptions
  ): string {
    const trigger = new Trigger(pattern, callback, options);
    this.triggers.push(trigger);

    // Sort by priority (higher priority first)
    this.triggers.sort((a, b) => b.priority - a.priority);

    return trigger.id;
  }

  /**
   * Remove a trigger by ID
   * @param id - Trigger ID to remove
   * @returns True if trigger was found and removed
   */
  removeTrigger(id: string): boolean {
    const index = this.triggers.findIndex((t) => t.id === id);
    if (index >= 0) {
      this.triggers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Enable a trigger
   * @param id - Trigger ID to enable
   */
  enableTrigger(id: string): void {
    const trigger = this.triggers.find((t) => t.id === id);
    if (trigger) {
      trigger.enabled = true;
    }
  }

  /**
   * Disable a trigger
   * @param id - Trigger ID to disable
   */
  disableTrigger(id: string): void {
    const trigger = this.triggers.find((t) => t.id === id);
    if (trigger) {
      trigger.enabled = false;
    }
  }

  /**
   * Process a line of text through all triggers
   * @param text - Text to process
   * @param onError - Optional error handler for Lua errors
   * @returns True if the line should be gagged (hidden)
   */
  async processLine(
    text: string,
    onError?: (error: Error) => void
  ): Promise<boolean> {
    let shouldGag = false;

    for (const trigger of this.triggers) {
      const result = trigger.match(text);
      if (result.matched) {
        // Always convert to Lua table (even if empty) if we have a Lua engine
        let captures = result.captures || [];
        if (this.luaEngine) {
          captures = this.luaEngine.arrayToLuaTable(captures) as any;
        }

        // Execute the trigger callback with error handling
        await trigger.execute(captures, onError);

        // If this trigger has gag enabled, mark the line to be hidden
        if (trigger.gag) {
          shouldGag = true;
        }
      }
    }

    return shouldGag;
  }

  /**
   * Get all triggers
   */
  getTriggers(): Trigger[] {
    return [...this.triggers];
  }

  /**
   * Clear all triggers
   */
  clearTriggers(): void {
    this.triggers = [];
  }
}
