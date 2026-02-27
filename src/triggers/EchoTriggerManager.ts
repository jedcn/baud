import { Trigger, TriggerCallback, TriggerOptions } from './Trigger.js';

/**
 * Manages echo triggers that fire when text is displayed locally via echo() or cecho().
 * This allows scripts to react to locally-displayed output from other scripts,
 * without any server communication being involved.
 */
export class EchoTriggerManager {
  private triggers: Trigger[] = [];

  /**
   * Create a new echo trigger
   * @param pattern - Pattern to match against echoed text (literal string or regex)
   * @param callback - Function to execute when matched
   * @param options - Optional configuration
   * @returns The created trigger's ID
   */
  createEchoTrigger(
    pattern: string,
    callback: TriggerCallback,
    options?: TriggerOptions
  ): string {
    const trigger = new Trigger(pattern, callback, options);
    this.triggers.push(trigger);
    return trigger.id;
  }

  /**
   * Remove an echo trigger by ID
   * @param id - Trigger ID to remove
   * @returns True if trigger was found and removed
   */
  removeEchoTrigger(id: string): boolean {
    const index = this.triggers.findIndex((t) => t.id === id);
    if (index >= 0) {
      this.triggers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Enable an echo trigger
   * @param id - Trigger ID to enable
   */
  enableEchoTrigger(id: string): void {
    const trigger = this.triggers.find((t) => t.id === id);
    if (trigger) {
      trigger.enabled = true;
    }
  }

  /**
   * Disable an echo trigger
   * @param id - Trigger ID to disable
   */
  disableEchoTrigger(id: string): void {
    const trigger = this.triggers.find((t) => t.id === id);
    if (trigger) {
      trigger.enabled = false;
    }
  }

  /**
   * Process echoed text through all echo triggers.
   * Called when echo() or cecho() displays text locally.
   * @param text - The text being displayed
   * @param onError - Optional error handler for Lua errors
   */
  async processEcho(
    text: string,
    onError?: (error: Error) => void
  ): Promise<void> {
    for (const trigger of this.triggers) {
      const result = trigger.match(text);
      if (result.matched) {
        await trigger.execute(result.captures || [], onError);
      }
    }
  }

  /**
   * Get all echo triggers
   */
  getEchoTriggers(): Trigger[] {
    return [...this.triggers];
  }

  /**
   * Clear all echo triggers
   */
  clearEchoTriggers(): void {
    this.triggers = [];
  }
}
